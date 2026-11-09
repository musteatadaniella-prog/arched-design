import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { STATUSES, STATUS_LABEL, SOURCE_LABEL, isStatus, type LeadSource, type LeadStatus } from "@/app/admin/statuses";
import { supabaseAdmin } from "@/lib/supabase-admin";

// MCP server for the CRM (Streamable HTTP, stateless, JSON responses).
// Claude Code connects with:
//   claude mcp add --transport http arched-crm https://<site>/api/mcp --header "Authorization: Bearer <MCP_TOKEN>"
// Every request needs that token; without it the server answers 401.

export const dynamic = "force-dynamic";

const PROTOCOL = "2025-06-18";
const SERVER = { name: "arched-crm", version: "1.0.0" };
const TZ = "Europe/Chisinau";
const ACTOR = "MCP";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

type Json = Record<string, unknown>;
type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Json };

// ---------- auth ----------

function authorized(req: Request): "ok" | "unconfigured" | "denied" {
  const expected = process.env.MCP_TOKEN;
  if (!expected || expected.length < 24) return "unconfigured";
  const header = req.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? "ok" : "denied";
}

// ---------- dates (Chisinau calendar days) ----------

const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const today = () => ymd.format(new Date());
const shiftDay = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
// Start of a Chisinau calendar day as an ISO timestamp with the right offset (DST-aware).
function dayStart(d: string): string {
  const probe = new Date(`${d}T12:00:00Z`);
  const off = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" })
    .formatToParts(probe)
    .find((p) => p.type === "timeZoneName")
    ?.value.replace("GMT", "");
  return `${d}T00:00:00${off && off !== "" ? off : "+00:00"}`;
}
const fmt = new Intl.DateTimeFormat("ro-RO", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

function resolvePeriod(a: Json): { from: string; to: string; label: string } | string {
  const t = today();
  const period = typeof a.period === "string" ? a.period : undefined;
  if (period === "today") return { from: t, to: t, label: "azi" };
  if (period === "yesterday") return { from: shiftDay(t, -1), to: shiftDay(t, -1), label: "ieri" };
  if (period === "last_7_days") return { from: shiftDay(t, -6), to: t, label: "ultimele 7 zile" };
  if (period === "last_30_days") return { from: shiftDay(t, -29), to: t, label: "ultimele 30 de zile" };
  if (period === "this_month") return { from: `${t.slice(0, 8)}01`, to: t, label: "luna aceasta" };
  const from = typeof a.from === "string" ? a.from : undefined;
  const to = typeof a.to === "string" ? a.to : from;
  if (!from) return { from: t, to: t, label: "azi" };
  if (!DAY.test(from) || !to || !DAY.test(to)) return "Datele trebuie să fie în formatul AAAA-LL-ZZ.";
  if (to < from) return "„to” trebuie să fie după „from”.";
  return { from, to, label: from === to ? from : `${from} – ${to}` };
}

// ---------- tools ----------

const STATUS_ENUM = [...STATUSES];
const TOOLS = [
  {
    name: "leads_list",
    title: "Cereri pe o perioadă",
    description:
      "Lista cererilor (clienților) din CRM create într-o perioadă, cu numărul pe etape. Fără argumente: azi. Folosește pentru «câte cereri azi», «cereri săptămâna asta», «cereri noi din octombrie».",
    inputSchema: {
      type: "object",
      properties: {
        period: { type: "string", enum: ["today", "yesterday", "last_7_days", "last_30_days", "this_month"], description: "Perioadă predefinită (ora Chișinăului)." },
        from: { type: "string", description: "Prima zi, AAAA-LL-ZZ (în loc de period)." },
        to: { type: "string", description: "Ultima zi inclusiv, AAAA-LL-ZZ. Implicit = from." },
        status: { type: "string", enum: STATUS_ENUM, description: "Doar cererile aflate acum în această etapă." },
        limit: { type: "integer", minimum: 1, maximum: 200, description: "Câte rânduri să întoarcă (implicit 50)." },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "client_search",
    title: "Căutare client",
    description: "Caută clienți după nume, telefon sau email (potrivire parțială). Întoarce etapa curentă, sursa, contactele și ultimele tranziții.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", minLength: 2, description: "Nume, fragment de telefon sau email." },
        limit: { type: "integer", minimum: 1, maximum: 50, description: "Implicit 10." },
      },
      required: ["query"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "lead_set_stage",
    title: "Schimbă etapa în pâlnie",
    description: `Mută un client în altă etapă a pâlniei. Etape: ${STATUSES.map((s) => `${s} (${STATUS_LABEL[s]})`).join(", ")}. Dă fie lead_id, fie query (nume/telefon); dacă query găsește mai mulți clienți, nu schimbă nimic și întoarce lista ca să alegi lead_id. Tranziția apare în istoricul cardului cu autorul «MCP».`,
    inputSchema: {
      type: "object",
      properties: {
        lead_id: { type: "string", description: "ID-ul clientului (uuid)." },
        query: { type: "string", description: "Nume sau telefon, dacă nu ai lead_id." },
        status: { type: "string", description: "Etapa nouă: cod (new, contacted, proposal, paid, lost) sau denumire (Nouă, Contactat, Ofertă trimisă, Achitat, Refuz)." },
      },
      required: ["status"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "lead_get",
    title: "Cardul clientului",
    description: "Cardul complet al unui client: date, notițe, contract, plăți și istoricul tranzițiilor.",
    inputSchema: {
      type: "object",
      properties: { lead_id: { type: "string", description: "ID-ul clientului (uuid)." } },
      required: ["lead_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
function parseStatus(v: unknown): LeadStatus | null {
  if (isStatus(v)) return v;
  if (typeof v !== "string") return null;
  const n = norm(v);
  const byLabel = STATUSES.find((s) => norm(STATUS_LABEL[s]) === n);
  if (byLabel) return byLabel;
  const alias: Record<string, LeadStatus> = { oplaceno: "paid", "оплачено": "paid", achitata: "paid", platit: "paid", oferta: "proposal", "предложение": "proposal", "счет": "proposal", refuzat: "lost", nou: "new", noua: "new" };
  return alias[n] ?? null;
}
const label = (s: string) => (isStatus(s) ? STATUS_LABEL[s] : s);
const srcLabel = (s: string) => SOURCE_LABEL[s as LeadSource] ?? s;
// PostgREST "or" filter values: strip characters that would break the filter syntax.
const safeTerm = (q: string) => q.replace(/[,()*%\\]/g, " ").trim();

type Lead = { id: string; created_at: string; status: string; source: string; name: string; phone: string; email: string | null; project_type: string | null };
const leadLine = (l: Lead) =>
  `• ${l.name} — ${label(l.status)} · ${l.phone}${l.email ? ` · ${l.email}` : ""}${l.project_type ? ` · ${l.project_type}` : ""} · sursa: ${srcLabel(l.source)} · creat ${fmt.format(new Date(l.created_at))} · id ${l.id}`;

class ToolError extends Error {}

async function searchLeads(query: string, limit: number): Promise<Lead[]> {
  const term = safeTerm(query);
  if (term.length < 2) throw new ToolError("Scrie cel puțin 2 caractere pentru căutare.");
  const digits = term.replace(/\D/g, "");
  const ors = [`name.ilike.*${term}*`, `email.ilike.*${term}*`, `phone.ilike.*${term}*`];
  if (digits.length >= 3 && digits !== term) ors.push(`phone.ilike.*${digits}*`);
  const { data, error } = await supabaseAdmin()
    .from("leads")
    .select("id, created_at, status, source, name, phone, email, project_type")
    .or(ors.join(","))
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as Lead[];
}

async function callTool(name: string, a: Json): Promise<string> {
  const db = supabaseAdmin();

  if (name === "leads_list") {
    const p = resolvePeriod(a);
    if (typeof p === "string") throw new ToolError(p);
    const limit = Math.min(200, Math.max(1, Number(a.limit) || 50));
    let q = db
      .from("leads")
      .select("id, created_at, status, source, name, phone, email, project_type", { count: "exact" })
      .gte("created_at", dayStart(p.from))
      .lt("created_at", dayStart(shiftDay(p.to, 1)))
      .order("created_at", { ascending: false })
      .limit(limit);
    if (a.status !== undefined) {
      const st = parseStatus(a.status);
      if (!st) throw new ToolError(`Etapă necunoscută: ${String(a.status)}.`);
      q = q.eq("status", st);
    }
    const { data, error, count } = await q;
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Lead[];
    const total = count ?? rows.length;
    if (!total) return `Nicio cerere în perioada ${p.label}.`;
    // Totals by stage and source cover the whole period, not only the rows shown.
    let all: { status: string; source: string }[] = rows;
    if (rows.length < total) {
      let qa = db.from("leads").select("status, source").gte("created_at", dayStart(p.from)).lt("created_at", dayStart(shiftDay(p.to, 1))).limit(5000);
      if (a.status !== undefined) qa = qa.eq("status", parseStatus(a.status)!);
      const { data: d2, error: e2 } = await qa;
      if (e2) throw new Error(e2.message);
      all = d2 ?? rows;
    }
    const byStatus = STATUSES.map((s) => [s, all.filter((r) => r.status === s).length] as const).filter(([, n]) => n);
    const bySource = [...new Set(all.map((r) => r.source))].map((s) => `${srcLabel(s)} ${all.filter((r) => r.source === s).length}`);
    return [
      `Cereri în perioada ${p.label}: ${total}${rows.length < total ? ` (afișez ${rows.length})` : ""}.`,
      `Pe etape: ${byStatus.map(([s, n]) => `${STATUS_LABEL[s]} ${n}`).join(", ")}. Pe surse: ${bySource.join(", ")}.`,
      "",
      ...rows.map(leadLine),
    ].join("\n");
  }

  if (name === "client_search") {
    const query = typeof a.query === "string" ? a.query : "";
    const rows = await searchLeads(query, Math.min(50, Math.max(1, Number(a.limit) || 10)));
    if (!rows.length) return `Niciun client găsit pentru „${query}”.`;
    const { data: hist } = await db
      .from("lead_stage_history")
      .select("lead_id, from_status, to_status, changed_at, changed_by")
      .in("lead_id", rows.map((r) => r.id))
      .order("changed_at", { ascending: false });
    const lines = rows.map((r) => {
      const h = (hist ?? []).filter((x) => x.lead_id === r.id).slice(0, 3);
      const hs = h.map((x) => `${fmt.format(new Date(x.changed_at))}: ${x.from_status ? `${label(x.from_status)} → ` : ""}${label(x.to_status)}${x.changed_by ? ` (${x.changed_by})` : ""}`);
      return `${leadLine(r)}${hs.length ? `\n   ultimele tranziții: ${hs.join("; ")}` : ""}`;
    });
    return [`Găsiți: ${rows.length}.`, ...lines].join("\n");
  }

  if (name === "lead_set_stage") {
    const st = parseStatus(a.status);
    if (!st) throw new ToolError(`Etapă necunoscută: ${String(a.status)}. Etape: ${STATUSES.map((s) => `${s} (${STATUS_LABEL[s]})`).join(", ")}.`);
    let lead: Lead | undefined;
    if (typeof a.lead_id === "string" && a.lead_id) {
      if (!UUID.test(a.lead_id)) throw new ToolError("lead_id nu este un uuid valid.");
      const { data, error } = await db.from("leads").select("id, created_at, status, source, name, phone, email, project_type").eq("id", a.lead_id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new ToolError("Clientul nu există.");
      lead = data as Lead;
    } else if (typeof a.query === "string" && a.query.trim()) {
      const rows = await searchLeads(a.query, 10);
      if (!rows.length) throw new ToolError(`Niciun client găsit pentru „${a.query}”. Nu am schimbat nimic.`);
      if (rows.length > 1)
        return [`Am găsit ${rows.length} clienți pentru „${a.query}”, deci nu am schimbat nimic. Repetă cu lead_id-ul potrivit:`, ...rows.map(leadLine)].join("\n");
      lead = rows[0];
    } else throw new ToolError("Dă lead_id sau query.");

    if (lead.status === st) return `${lead.name} este deja în etapa „${STATUS_LABEL[st]}”. Nu am schimbat nimic.`;
    const { data: found, error } = await db.rpc("set_lead_stage", { p_id: lead.id, p_status: st, p_actor: ACTOR });
    if (error) throw new Error(error.message);
    if (!found) throw new ToolError("Clientul nu mai există.");
    revalidatePath("/admin", "layout");
    return `Gata: ${lead.name} mutat din „${label(lead.status)}” în „${STATUS_LABEL[st]}”. În istoricul cardului apare cu autorul «${ACTOR}». (id ${lead.id})`;
  }

  if (name === "lead_get") {
    const id = typeof a.lead_id === "string" ? a.lead_id : "";
    if (!UUID.test(id)) throw new ToolError("lead_id nu este un uuid valid.");
    const [{ data: l, error }, { data: hist }, { data: pays }] = await Promise.all([
      db.from("leads").select("*").eq("id", id).maybeSingle(),
      db.from("lead_stage_history").select("from_status, to_status, changed_at, changed_by").eq("lead_id", id).order("changed_at"),
      db.from("lead_payments").select("amount, paid_on, note").eq("lead_id", id).order("paid_on"),
    ]);
    if (error) throw new Error(error.message);
    if (!l) throw new ToolError("Clientul nu există.");
    const paid = (pays ?? []).reduce((s, p) => s + Number(p.amount), 0);
    const cur = l.contract_currency ?? "EUR";
    return [
      `${l.name} — ${label(l.status)} (sursa: ${srcLabel(l.source)})`,
      `Telefon: ${l.phone}${l.email ? ` · Email: ${l.email}` : ""}${l.telegram_username ? ` · Telegram: @${l.telegram_username}` : ""}`,
      l.project_type || l.area ? `Proiect: ${[l.project_type, l.area && `${l.area} m²`].filter(Boolean).join(", ")}` : "",
      l.comment ? `Comentariu client: ${l.comment}` : "",
      l.notes ? `Notițe echipă: ${l.notes}` : "",
      l.contract_amount != null ? `Contract: ${l.contract_amount} ${cur}; achitat ${paid} ${cur}; rest ${Number(l.contract_amount) - paid} ${cur}` : "",
      (pays ?? []).length ? `Plăți: ${(pays ?? []).map((p) => `${p.paid_on} ${p.amount} ${cur}${p.note ? ` (${p.note})` : ""}`).join("; ")}` : "",
      `Creat: ${fmt.format(new Date(l.created_at))} · id ${l.id}`,
      "Istoric etape:",
      ...(hist ?? []).map((h) => `  ${fmt.format(new Date(h.changed_at))}: ${h.from_status ? `${label(h.from_status)} → ` : ""}${label(h.to_status)}${h.changed_by ? ` (${h.changed_by})` : ""}`),
    ]
      .filter(Boolean)
      .join("\n");
  }

  throw new ToolError(`Instrument necunoscut: ${name}`);
}

// ---------- JSON-RPC ----------

const rpcError = (id: Rpc["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

async function handle(msg: Rpc): Promise<Json | null> {
  const id = msg.id;
  const isNotification = id === undefined;
  if (msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return isNotification ? null : rpcError(id, -32600, "Invalid Request");

  switch (msg.method) {
    case "initialize": {
      const asked = typeof msg.params?.protocolVersion === "string" ? msg.params.protocolVersion : PROTOCOL;
      const supported = ["2025-06-18", "2025-03-26", "2024-11-05"];
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: supported.includes(asked) ? asked : PROTOCOL,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER,
          instructions:
            "CRM-ul biroului de arhitectură Arched Design. Etapele pâlniei: Nouă, Contactat, Ofertă trimisă, Achitat, Refuz. Datele sunt în ora Chișinăului. Înainte de a schimba etapa unui client găsit după nume, verifică să fie exact clientul cerut.",
        },
      };
    }
    case "ping":
      return isNotification ? null : { jsonrpc: "2.0", id, result: {} };
    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
    case "tools/call": {
      const name = typeof msg.params?.name === "string" ? msg.params.name : "";
      if (!TOOLS.some((t) => t.name === name)) return rpcError(id, -32602, `Unknown tool: ${name}`);
      const args = (msg.params?.arguments ?? {}) as Json;
      try {
        const text = await callTool(name, args);
        return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text }], isError: false } };
      } catch (e) {
        const known = e instanceof ToolError;
        if (!known) console.error(`[mcp] ${name} failed:`, e instanceof Error ? e.message : e);
        return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: known ? e.message : "Eroare internă la accesarea CRM-ului." }], isError: true } };
      }
    }
    default:
      if (isNotification) return null; // notifications/initialized, notifications/cancelled…
      return rpcError(id, -32601, `Method not found: ${msg.method}`);
  }
}

const HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

function deny(req: Request) {
  const state = authorized(req);
  if (state === "ok") return null;
  if (state === "unconfigured") return NextResponse.json(rpcError(null, -32001, "MCP server is not configured"), { status: 503, headers: HEADERS });
  return NextResponse.json(rpcError(null, -32001, "Unauthorized: valid Bearer token required"), {
    status: 401,
    headers: { ...HEADERS, "WWW-Authenticate": 'Bearer realm="arched-crm"' },
  });
}

export async function POST(req: Request) {
  const denied = deny(req);
  if (denied) return denied;

  const body = (await req.json().catch(() => undefined)) as Rpc | Rpc[] | undefined;
  if (body === undefined) return NextResponse.json(rpcError(null, -32700, "Parse error"), { status: 400, headers: HEADERS });

  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map(handle))).filter(Boolean);
    return out.length ? NextResponse.json(out, { headers: HEADERS }) : new NextResponse(null, { status: 202, headers: HEADERS });
  }
  const out = await handle(body);
  return out ? NextResponse.json(out, { headers: HEADERS }) : new NextResponse(null, { status: 202, headers: HEADERS });
}

// No server-initiated stream: this server is stateless.
export async function GET(req: Request) {
  return deny(req) ?? new NextResponse("Method Not Allowed", { status: 405, headers: { ...HEADERS, Allow: "POST" } });
}

export async function DELETE(req: Request) {
  return deny(req) ?? new NextResponse(null, { status: 405, headers: { ...HEADERS, Allow: "POST" } });
}
