// Funnel stages and lead sources. Must match the checks in supabase/crm.sql.

export const STATUSES = ["new", "contacted", "proposal", "paid", "lost"] as const;
export type LeadStatus = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "Nouă",
  contacted: "Contactat",
  proposal: "Ofertă trimisă",
  paid: "Achitat",
  lost: "Refuz",
};

export const STATUS_TONE: Record<LeadStatus, string> = {
  new: "border-ink bg-ink text-surface",
  contacted: "border-sand bg-sand/40 text-ink",
  proposal: "border-sand bg-sand text-ink",
  paid: "border-ink bg-transparent text-ink",
  lost: "border-line bg-transparent text-muted",
};

export function isStatus(v: unknown): v is LeadStatus {
  return typeof v === "string" && (STATUSES as readonly string[]).includes(v);
}

export const SOURCES = ["site", "manual", "telegram", "business_card"] as const;
export type LeadSource = (typeof SOURCES)[number];

export const SOURCE_LABEL: Record<LeadSource, string> = {
  site: "Site",
  manual: "Manual",
  telegram: "Telegram",
  business_card: "Carte de vizită",
};

export const dateFmt = new Intl.DateTimeFormat("ro-RO", {
  timeZone: "Europe/Chisinau",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
