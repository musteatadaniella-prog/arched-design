#!/usr/bin/env node
// Raport lunar pe echipă din calendarele Google.
//
//   node scripts/raport-echipa/genereaza.mjs calc --luna 2026-10   → rapoarte/2026-10/metrics.json
//   node scripts/raport-echipa/genereaza.mjs pdf  --luna 2026-10   → rapoarte/2026-10/raport.html + .pdf
//
// Intrare: rapoarte/<luna>/date/<id>.json — lista de evenimente pentru fiecare persoană din echipa.json.
// Format compact: {t:titlu, s:start, e:sfârșit, c:creat, k:tip, r:răspuns, n:nr. invitați, o:organizator eu}
// (se acceptă și formatul brut Google: summary, start.dateTime, end.dateTime, created, eventType, attendees…).
// Opțional: rapoarte/<luna>/analiza.json — {rezumat, observatii[], recomandari[]} scrise de agent.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

// ---------- argumente ----------
const args = { _: [] };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i];
  else args._.push(a);
}
const cmd = args._[0];
if (!['calc', 'pdf'].includes(cmd) || !/^\d{4}-\d{2}$/.test(args.luna || '')) {
  console.error('Utilizare: node genereaza.mjs <calc|pdf> --luna AAAA-LL [--dir rapoarte] [--config echipa.json] [--membri id1,id2]');
  process.exit(1);
}
const LUNA = args.luna;
const DIR_RAP = path.resolve(ROOT, args.dir || 'rapoarte');
const DIR_LUNA = path.join(DIR_RAP, LUNA);
const CFG_PATH = args.config ? path.resolve(args.config) : path.join(HERE, 'echipa.json');
if (!fs.existsSync(CFG_PATH)) {
  console.error(`Lipsește configurația ${CFG_PATH}. Copiază echipa.example.json în echipa.json și completează.`);
  process.exit(1);
}
const CFG = JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'));
if (args.membri) {
  const ids = args.membri.split(',').map((x) => x.trim());
  const lipsa = ids.filter((id) => !CFG.membri.some((m) => m.id === id));
  if (lipsa.length) { console.error(`Membri necunoscuți în echipa.json: ${lipsa.join(', ')}`); process.exit(1); }
  CFG.membri = CFG.membri.filter((m) => ids.includes(m.id));
}
const TZ = CFG.fusOrar || 'Europe/Chisinau';
const NORMA = (CFG.normaOre || 8) * 60;

const LUNI = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
const ZS = ['D', 'L', 'Ma', 'Mi', 'J', 'V', 'S'];
const PALETA = ['#f6e0a3', '#f4bcd2', '#abc8ee', '#f7c9a0', '#a9dfc2', '#d3c3ee', '#b7e3e1', '#e3c8b0', '#d7e8a7', '#ecc3e3', '#bdd6cc', '#f1b9a8', '#cbcbec', '#f0d7a0', '#c6dcf2'];
const C = { baza: '#abc8ee', ref: '#f7c09d', sed: '#d9d9d9', verde: '#c3e6cb', galben: '#fae6a5', rosu: '#f6bcb3', gri: '#ececec', alb: '#ffffff', mov: '#d6c6ef' };

const KW = {
  pauza: ['pranz', 'pauza', 'lunch', 'обед', 'перерыв'],
  concediu: ['concediu', 'vacation', 'vacanta', 'zi libera', 'day off', 'отпуск', 'выходной', 'boala', 'sick', 'больнич', 'medical'],
  alta: ['facultate', 'universitate', 'univer', 'colegiu', 'сессия'],
  refaceri: ['modific', 'corect', 'adapt', 'refac', 'revizu', 'remediere', 'правк', 'исправ', 'коррект', 'доработ', 'адапт', 'изменен', 'передел'],
  sedinte: ['sedint', 'meet', 'call', 'discut', 'consult', 'intalnire', 'apel', 'zoom', 'teams', 'sync', 'встреч', 'созвон', 'совещ', 'планерк', 'обсужд', 'консульт', 'митинг'],
  ...(CFG.cuvinteCheie || {}),
};

// ---------- utilitare ----------
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const has = (t, list) => list.some((w) => t.includes(norm(w)));
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const r1 = (x) => Math.round(x * 10) / 10;
const f1 = (x) => (x == null || Number.isNaN(x) ? '–' : r1(x).toLocaleString('ro-RO', { maximumFractionDigits: 1 }));
const f0 = (x) => (x == null || Number.isNaN(x) ? '–' : Math.round(x).toLocaleString('ro-RO'));
const pct = (x) => (x == null || Number.isNaN(x) ? '–' : `${Math.round(x)}%`);
const sign = (x, suf = '') => (x == null || Number.isNaN(x) ? '–' : `${x > 0 ? '+' : x < 0 ? '−' : '±'}${f1(Math.abs(x))}${suf}`);
const hhmm = (m) => (m == null ? '–' : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const sum = (a) => a.reduce((x, y) => x + y, 0);
const ddmm = (d) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;

const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function localDin(dateObj) {
  const p = Object.fromEntries(fmt.formatToParts(dateObj).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: +p.hour * 60 + +p.minute };
}
// "2026-10-12" (toată ziua) | "2026-10-12T09:00:00" (oră locală) | "…+03:00"/"…Z"
function parseT(s) {
  if (!s) return null;
  s = String(s);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { date: s, min: 0, allDay: true };
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) return { ...localDin(new Date(s)), allDay: false };
  const m = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  return m ? { date: m[1], min: +m[2] * 60 + +m[3], allDay: false } : null;
}
const addDays = (d, n) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const dow = (d) => new Date(`${d}T12:00:00Z`).getUTCDay();
const lunaAnterioara = (l) => {
  const [y, m] = l.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
};
const numeLuna = (l) => `${LUNI[+l.slice(5, 7) - 1]} ${l.slice(0, 4)}`;

function normalizeaza(ev) {
  const att = ev.attendees || [];
  const eu = att.find((a) => a.self);
  const st = ev.s ?? ev.start?.dateTime ?? ev.start?.date ?? ev.start;
  const en = ev.e ?? ev.end?.dateTime ?? ev.end?.date ?? ev.end;
  const n = ev.n ?? att.length;
  let o = ev.o ?? ev.organizer?.self ?? ev.creator?.self;
  if (o == null) o = n <= 1;
  return { t: ev.t ?? ev.summary ?? '', s: st, e: en, c: ev.c ?? ev.created ?? null, k: String(ev.k ?? ev.eventType ?? 'default').toLowerCase(), r: ev.r ?? eu?.responseStatus ?? null, n, o };
}

// ---------- calc ----------
function zileLuna(l) {
  const [y, m] = l.split('-').map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${l}-${String(i + 1).padStart(2, '0')}`);
}

function proceseaza(p, evenimente, zile) {
  const sarb = new Set(CFG.sarbatori || []);
  const proiecte = (CFG.proiecte || []).map((x) => ({ nume: x.nume, alias: [x.nume, ...(x.alias || [])].map(norm) }));
  const detCat = (p.detaliu || []).map((x) => ({ nume: x.nume, cuv: x.cuvinte.map(norm) }));
  const zileSet = new Set(zile);
  const Z = {}; // date → {cat, proj, det, ev, concediu, alta}
  const zi = (d) => (Z[d] ||= { cat: new Uint8Array(1440), proj: new Int16Array(1440).fill(-1), det: new Int16Array(1440).fill(-1), ev: 0, concediu: false, alta: false });
  const creat = { inainte: 0, aceeasi: 0, dupa: 0 };
  const inv = { raspuns: 0, total: 0 };

  for (const raw of evenimente) {
    const ev = normalizeaza(raw);
    const a = parseT(ev.s);
    const b = parseT(ev.e);
    if (!a || !b) continue;
    const t = norm(ev.t);
    const inLuna = zileSet.has(a.date);

    if (inLuna && !ev.o && ev.n >= 2) {
      inv.total++;
      if (ev.r && ev.r !== 'needsAction') inv.raspuns++;
    }
    if (ev.r === 'declined') continue;

    const eConcediu = ev.k === 'outofoffice' || ev.k === 'out_of_office' || has(t, KW.concediu);
    if (a.allDay) {
      if (eConcediu || has(t, KW.alta)) {
        for (let d = a.date; d < b.date; d = addDays(d, 1)) if (zileSet.has(d)) zi(d)[eConcediu ? 'concediu' : 'alta'] = true;
      }
      continue;
    }
    if (has(t, KW.pauza)) continue;
    if (eConcediu) {
      if (zileSet.has(a.date)) zi(a.date).concediu = true;
      continue;
    }
    if (has(t, KW.alta)) {
      if (zileSet.has(a.date)) zi(a.date).alta = true;
      continue;
    }

    // timp creat vs. ziua evenimentului (doar evenimentele proprii)
    if (inLuna && ev.o && ev.c) {
      const cd = localDin(new Date(ev.c)).date;
      if (cd < a.date) creat.inainte++;
      else if (cd === a.date) creat.aceeasi++;
      else creat.dupa++;
    }

    const cat = has(t, KW.refaceri) ? 2 : has(t, KW.sedinte) || (!ev.o && ev.n >= 2) ? 3 : 1;
    const pj = proiecte.findIndex((x) => x.alias.some((al) => t.includes(al)));
    const dc = detCat.findIndex((x) => x.cuv.some((w) => t.includes(w)));
    const bucati = [];
    if (b.date === a.date) bucati.push([a.date, a.min, b.min]);
    else {
      bucati.push([a.date, a.min, 1440]);
      if (b.date === addDays(a.date, 1)) bucati.push([b.date, 0, b.min]);
    }
    for (const [d, m0, m1] of bucati) {
      if (!zileSet.has(d) || m1 <= m0) continue;
      const z = zi(d);
      z.ev++;
      for (let m = m0; m < Math.min(m1, 1440); m++) {
        if (cat > z.cat[m]) z.cat[m] = cat;
        if (z.proj[m] < 0 && pj >= 0) z.proj[m] = pj;
        if (z.det[m] < 0 && dc >= 0) z.det[m] = dc;
      }
    }
  }

  const out = {
    id: p.id, nume: p.nume, culoare: p.culoare, sursa: p.sursa || 'individual',
    zile: {}, saptamani: {}, proiecte: {}, refaceriProiecte: {}, detaliu: detCat.length ? {} : null,
    concediu: [], alta: [], gol: [], faraDate: [],
  };
  let min = 0, ref = 0, sed = 0, supl = 0, dupa19 = 0, weekend = 0, evActiv = 0;
  const starts = [], ends = [], minActiv = [];
  for (const d of zile) {
    const z = Z[d];
    const lucr = z ? z.cat.reduce((s, v) => s + (v ? 1 : 0), 0) : 0;
    const wd = dow(d);
    if (wd === 0 || wd === 6) {
      weekend += lucr;
      continue;
    }
    if (sarb.has(d)) {
      out.zile[d] = { h: r1(lucr / 60), st: 'sarbatoare' };
      continue;
    }
    if (p.din && d < p.din) {
      out.zile[d] = { h: 0, st: 'faradate' };
      out.faraDate.push(d);
      continue;
    }
    let st;
    if (lucr >= 120) st = 'activ';
    else if (z?.concediu) st = 'concediu';
    else if (z?.alta) st = 'alta';
    else st = 'gol';
    out.zile[d] = { h: r1(lucr / 60), st };
    if (st === 'concediu') out.concediu.push(d);
    if (st === 'alta') out.alta.push(d);
    if (st === 'gol') out.gol.push(d);

    // săptămâna (luni)
    const lun = addDays(d, -((wd + 6) % 7));
    out.saptamani[lun] ||= { min: 0, zileActive: 0 };
    out.saptamani[lun].min += lucr;

    if (!z || !lucr) continue;
    min += lucr;
    for (let m = 0; m < 1440; m++) {
      const v = z.cat[m];
      if (!v) continue;
      if (v === 2) ref++;
      if (v === 3) sed++;
      if (m >= 19 * 60) dupa19++;
      const pn = z.proj[m] >= 0 ? CFG.proiecte[z.proj[m]].nume : null;
      if (pn) {
        out.proiecte[pn] = (out.proiecte[pn] || 0) + 1;
        if (v === 2) out.refaceriProiecte[pn] = (out.refaceriProiecte[pn] || 0) + 1;
      }
      if (out.detaliu) {
        const k = z.det[m] >= 0 ? detCat[z.det[m]].nume : 'Altele';
        out.detaliu[k] = (out.detaliu[k] || 0) + 1;
      }
    }
    if (st === 'activ') {
      out.saptamani[lun].zileActive++;
      minActiv.push(lucr);
      supl += Math.max(0, lucr - NORMA);
      evActiv += z.ev;
      starts.push(z.cat.findIndex((v) => v));
      ends.push(1440 - [...z.cat].reverse().findIndex((v) => v));
    }
  }
  const zileActive = minActiv.length;
  const sapt = Object.values(out.saptamani).filter((s) => s.zileActive >= 3).map((s) => s.min / 60);
  const round15 = (m) => (m == null ? null : Math.round(m / 15) * 15);
  const totInv = creat.inainte + creat.aceeasi + creat.dupa;
  Object.assign(out, {
    ore: r1(min / 60),
    zileActive,
    oreZi: zileActive ? r1(min / 60 / zileActive) : null,
    zile8Pct: zileActive ? (minActiv.filter((m) => m >= NORMA - 15).length / zileActive) * 100 : null,
    zile8: minActiv.filter((m) => m >= NORMA - 15).length,
    acoperirePct: zileActive ? (min / (NORMA * zileActive)) * 100 : null,
    oreSapt: sapt.length ? r1(sum(sapt) / sapt.length) : null,
    refaceriPct: min ? (ref / min) * 100 : 0,
    sedintePct: min ? (sed / min) * 100 : 0,
    bazaPct: min ? ((min - ref - sed) / min) * 100 : 0,
    refaceriOre: r1(ref / 60),
    sedinteOre: r1(sed / 60),
    start: round15(median(starts)),
    sfarsit: round15(median(ends)),
    suplimentare: r1(supl / 60),
    dupa19: r1(dupa19 / 60),
    weekend: r1(weekend / 60),
    evPeZi: zileActive ? r1(evActiv / zileActive) : null,
    creat: { ...creat, total: totInv, inaintePct: totInv ? (creat.inainte / totInv) * 100 : null },
    invitatii: inv,
    putineDate: zileActive < (CFG.minZileClasament || 10),
  });
  for (const k of ['proiecte', 'refaceriProiecte']) for (const n in out[k]) out[k][n] = r1(out[k][n] / 60);
  if (out.detaliu) for (const n in out.detaliu) out.detaliu[n] = r1(out.detaliu[n] / 60);
  for (const s of Object.values(out.saptamani)) s.ore = r1(s.min / 60), delete s.min;
  return out;
}

function calc() {
  const zile = zileLuna(LUNA);
  const sarb = new Set(CFG.sarbatori || []);
  const zileLucratoare = zile.filter((d) => dow(d) % 6 !== 0 && !sarb.has(d)).length;
  const lipsa = [];
  const persoane = CFG.membri.map((p, i) => {
    const f = path.join(DIR_LUNA, 'date', `${p.id}.json`);
    let ev = [];
    if (fs.existsSync(f)) {
      const j = JSON.parse(fs.readFileSync(f, 'utf8'));
      ev = Array.isArray(j) ? j : j.evenimente || j.events || j.items || [];
    } else lipsa.push(p.nume);
    return proceseaza({ ...p, culoare: p.culoare || PALETA[i % PALETA.length] }, ev, zile);
  });

  // proiecte pe echipă
  const proiecte = {};
  for (const p of persoane) {
    for (const [n, h] of Object.entries(p.proiecte)) {
      proiecte[n] ||= { nume: n, ore: 0, refaceri: 0, pePersoane: {}, saptamani: {} };
      proiecte[n].ore += h;
      proiecte[n].pePersoane[p.id] = h;
    }
    for (const [n, h] of Object.entries(p.refaceriProiecte)) proiecte[n].refaceri += h;
  }
  const listaProiecte = Object.values(proiecte)
    .map((x) => ({ ...x, ore: r1(x.ore), refaceri: r1(x.refaceri), refaceriPct: x.ore ? (x.refaceri / x.ore) * 100 : 0 }))
    .sort((a, b) => b.ore - a.ore);

  const cuDate = persoane.filter((p) => p.ore > 0);
  const ore = sum(persoane.map((p) => p.ore));
  const echipa = {
    ore: r1(ore),
    persoane: persoane.length,
    persoaneActive: cuDate.length,
    medieOre: cuDate.length ? r1(ore / cuDate.length) : 0,
    refaceriPct: ore ? (sum(persoane.map((p) => p.refaceriOre)) / ore) * 100 : 0,
    sedintePct: ore ? (sum(persoane.map((p) => p.sedinteOre)) / ore) * 100 : 0,
    suplimentare: r1(sum(persoane.map((p) => p.suplimentare))),
    dupa19: r1(sum(persoane.map((p) => p.dupa19))),
    weekend: r1(sum(persoane.map((p) => p.weekend))),
    zileConcediu: sum(persoane.map((p) => p.concediu.length)),
    oreFaraProiect: r1(ore - sum(listaProiecte.map((x) => x.ore))),
  };

  // comparație cu luna anterioară
  const prevPath = path.join(DIR_RAP, lunaAnterioara(LUNA), 'metrics.json');
  let comparatie = null;
  if (fs.existsSync(prevPath)) {
    const prev = JSON.parse(fs.readFileSync(prevPath, 'utf8'));
    const pm = Object.fromEntries(prev.persoane.map((p) => [p.id, p]));
    comparatie = {
      luna: prev.luna,
      echipa: { ore: prev.echipa.ore, refaceriPct: prev.echipa.refaceriPct, sedintePct: prev.echipa.sedintePct, suplimentare: prev.echipa.suplimentare },
      persoane: persoane.map((p) => {
        const q = pm[p.id];
        return q ? { id: p.id, ore: q.ore, oreZi: q.oreZi, refaceriPct: q.refaceriPct, zile8Pct: q.zile8Pct, suplimentare: q.suplimentare } : { id: p.id };
      }),
      proiecte: Object.fromEntries((prev.proiecte || []).map((x) => [x.nume, x.ore])),
    };
  }

  // clasament după norma de 8 h
  const clasament = persoane
    .filter((p) => !p.putineDate && !p.faraClasament)
    .sort((a, b) => b.zile8Pct - a.zile8Pct || b.acoperirePct - a.acoperirePct)
    .map((p, i) => ({ id: p.id, loc: i + 1 }));

  // semnale automate (agentul le folosește pentru analiză)
  const semnale = [];
  for (const p of persoane) {
    if (p.putineDate) { semnale.push({ tip: 'date', persoana: p.nume, text: `${p.nume}: doar ${p.zileActive} zile active — calendar completat rar.` }); continue; }
    if (p.refaceriPct > 30) semnale.push({ tip: 'refaceri', persoana: p.nume, text: `${p.nume}: ${pct(p.refaceriPct)} din timp pe refaceri (${f1(p.refaceriOre)} h).` });
    if (p.acoperirePct > 120) semnale.push({ tip: 'suprasolicitare', persoana: p.nume, text: `${p.nume}: ${pct(p.acoperirePct)} din normă, ${f1(p.suplimentare)} h peste 8 h/zi — risc de suprasolicitare.` });
    if (p.zile8Pct < 70) semnale.push({ tip: 'norma', persoana: p.nume, text: `${p.nume}: norma de 8 h atinsă doar în ${pct(p.zile8Pct)} din zile.` });
    if (p.dupa19 > 15) semnale.push({ tip: 'seara', persoana: p.nume, text: `${p.nume}: ${f1(p.dupa19)} h lucrate după ora 19:00.` });
    if (p.weekend > 4) semnale.push({ tip: 'weekend', persoana: p.nume, text: `${p.nume}: ${f1(p.weekend)} h lucrate în weekend.` });
    if (p.invitatii.total >= 5 && p.invitatii.raspuns / p.invitatii.total < 0.6) semnale.push({ tip: 'invitatii', persoana: p.nume, text: `${p.nume}: răspunde doar la ${p.invitatii.raspuns} din ${p.invitatii.total} invitații.` });
    if (p.gol.length >= 3) semnale.push({ tip: 'gol', persoana: p.nume, text: `${p.nume}: ${p.gol.length} zile lucrătoare fără intrări (${p.gol.map(ddmm).join(', ')}).` });
    const q = comparatie?.persoane.find((x) => x.id === p.id);
    if (q?.ore && Math.abs(p.ore - q.ore) / q.ore > 0.25) semnale.push({ tip: 'variatie', persoana: p.nume, text: `${p.nume}: ${f0(q.ore)} h → ${f0(p.ore)} h față de luna trecută (${sign(((p.ore - q.ore) / q.ore) * 100, '%')}).` });
  }
  for (const x of listaProiecte) if (x.ore >= 20 && x.refaceriPct > 35) semnale.push({ tip: 'proiect', persoana: null, text: `Proiectul ${x.nume}: ${pct(x.refaceriPct)} refaceri (${f1(x.refaceri)} din ${f1(x.ore)} h).` });

  const metrics = {
    luna: LUNA, departament: CFG.departament || 'Echipa', generatLa: new Date().toISOString(),
    zileLucratoare, sarbatori: (CFG.sarbatori || []).filter((d) => d.startsWith(LUNA)), lipsaDate: lipsa,
    echipa, persoane, proiecte: listaProiecte, comparatie, clasament, semnale,
  };
  fs.mkdirSync(DIR_LUNA, { recursive: true });
  // nu salvăm zilele brute pe minute; metrics.json rămâne mic
  fs.writeFileSync(path.join(DIR_LUNA, 'metrics.json'), JSON.stringify(metrics, null, 1));

  // rezumat scurt pentru agent
  console.log(`Luna ${LUNA}: ${zileLucratoare} zile lucrătoare, ${echipa.persoaneActive}/${echipa.persoane} persoane cu date, ${f0(echipa.ore)} h total.`);
  if (lipsa.length) console.log(`Lipsesc fișierele de date pentru: ${lipsa.join(', ')}`);
  console.log('Persoană | ore | zile active | ore/zi | ≥8h | refaceri | ședințe | suplimentare');
  for (const p of persoane) console.log(`${p.nume} | ${f0(p.ore)} | ${p.zileActive} | ${f1(p.oreZi)} | ${pct(p.zile8Pct)} | ${pct(p.refaceriPct)} | ${f1(p.sedinteOre)} h | ${f1(p.suplimentare)} h`);
  console.log(`Top proiecte: ${listaProiecte.slice(0, 5).map((x) => `${x.nume} ${f0(x.ore)} h`).join(', ') || '—'}`);
  console.log(`Semnale (${semnale.length}):`);
  for (const s of semnale) console.log(`- ${s.text}`);
  console.log(`→ ${path.join(DIR_LUNA, 'metrics.json')}`);
}

// ---------- componente HTML ----------
const hbars = (items, { max, suffix = '', ref } = {}) => {
  const m = max ?? Math.max(1, ...items.map((x) => x.value));
  return `<div class="hb-list">${items
    .map((x) => `<div class="hb"><div class="lbl">${esc(x.label)}</div><div class="trk">${ref ? `<i class="ref" style="left:${(ref / m) * 78}%"></i>` : ''}<div class="bar" style="width:${Math.max(0.5, (x.value / m) * 78)}%;background:${x.color}"></div><span>${x.text ?? f1(x.value) + suffix}</span></div></div>`)
    .join('')}</div>`;
};
const stacked = (rows, legend) => `
  <div class="legend">${legend.map(([n, c]) => `<span><i style="background:${c}"></i>${esc(n)}</span>`).join('')}</div>
  <div class="hb-list">${rows
    .map((r) => `<div class="hb"><div class="lbl">${esc(r.label)}</div><div class="trk st">${r.parts
      .map((p) => `<div style="width:${p.w}%;background:${p.c}">${p.w >= 7 ? `${Math.round(p.w)}%` : ''}</div>`)
      .join('')}</div>${r.after ? `<span class="after">${r.after}</span>` : ''}</div>`)
    .join('')}</div>`;
const tabel = (head, rows, cls = '') => `<table class="tbl ${cls}"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => (typeof c === 'object' && c ? `<td style="${c.s || ''}" class="${c.k || ''}">${c.v}</td>` : `<td>${c}</td>`)).join('')}</tr>`).join('')}</tbody></table>`;
const cel = (v, bg, k = 'heat') => ({ v, s: bg ? `background:${bg}` : '', k });
const albastru = (v, max) => (v > 0 ? `rgba(110,160,220,${0.18 + 0.62 * Math.min(1, v / max)})` : '');
const semafor = (v, bun, rau, invers = false) => {
  if (v == null || Number.isNaN(v)) return '';
  const ok = invers ? v <= bun : v >= bun;
  const ko = invers ? v > rau : v < rau;
  return ok ? C.verde : ko ? C.rosu : C.galben;
};
const sectiune = (titlu, intro, corp, nota = '', cls = '') => `<section class="${cls}"><h2>${titlu}</h2>${intro ? `<p class="intro">${intro}</p>` : ''}${corp}${nota ? `<p class="nota">${nota}</p>` : ''}</section>`;

function pdf() {
  const mPath = path.join(DIR_LUNA, 'metrics.json');
  if (!fs.existsSync(mPath)) { console.error(`Lipsește ${mPath}. Rulează întâi „calc”.`); process.exit(1); }
  const M = JSON.parse(fs.readFileSync(mPath, 'utf8'));
  const aPath = path.join(DIR_LUNA, 'analiza.json');
  const A = fs.existsSync(aPath) ? JSON.parse(fs.readFileSync(aPath, 'utf8')) : null;
  const P = M.persoane;
  const PI = Object.fromEntries(P.map((p) => [p.id, p]));
  const cuDate = P.filter((p) => p.ore > 0);
  const prev = M.comparatie;
  const prevP = Object.fromEntries((prev?.persoane || []).map((x) => [x.id, x]));
  const titluPer = `${numeLuna(M.luna)} · ${M.departament}`;
  const zile = zileLuna(M.luna).filter((d) => dow(d) % 6 !== 0);
  const s = [];

  // ---- antet + KPI ----
  const kpi = (et, val, sub) => `<div class="kpi"><div class="k-et">${et}</div><div class="k-val">${val}</div><div class="k-sub">${sub || '&nbsp;'}</div></div>`;
  const dlt = (a, b, suf = '', invers = false) => {
    if (b == null) return '';
    const d = a - b;
    const bun = invers ? d < 0 : d > 0;
    return `<span class="${Math.abs(d) < 0.05 ? '' : bun ? 'up' : 'down'}">${sign(d, suf)} față de ${LUNI[+prev.luna.slice(5) - 1]}</span>`;
  };
  s.push(`<header><h1>${esc(M.departament)}</h1><p class="sub">Raport lunar · ${numeLuna(M.luna)} · ${M.zileLucratoare} zile lucrătoare · ${M.echipa.persoane} persoane · doar zilele lucrătoare</p></header>`);
  s.push(`<div class="kpis">
    ${kpi('Ore lucrate, echipa', `${f0(M.echipa.ore)} h`, prev ? dlt(M.echipa.ore, prev.echipa.ore, ' h') : `${f1(M.echipa.medieOre)} h / persoană`)}
    ${kpi('Medie pe persoană', `${f0(M.echipa.medieOre)} h`, `normă: ${M.zileLucratoare * (CFG.normaOre || 8)} h`)}
    ${kpi('Refaceri', pct(M.echipa.refaceriPct), prev ? dlt(M.echipa.refaceriPct, prev.echipa.refaceriPct, ' pp', true) : 'din timpul total')}
    ${kpi('Ședințe', pct(M.echipa.sedintePct), prev ? dlt(M.echipa.sedintePct, prev.echipa.sedintePct, ' pp', true) : 'din timpul total')}
    ${kpi('Ore peste normă', `${f0(M.echipa.suplimentare)} h`, `${f0(M.echipa.dupa19)} h după 19:00 · ${f0(M.echipa.weekend)} h weekend`)}
  </div>`);

  s.push(`<div class="cards">${P.map((p) => `<div class="card" style="background:${p.culoare}"><b>${esc(p.nume)}</b><div class="big">${f0(p.ore)} h</div><div>${f1(p.oreZi)} h / zi</div><div>${pct(p.refaceriPct)} refaceri</div>${prevP[p.id]?.ore != null ? `<div class="mini">${sign(p.ore - prevP[p.id].ore, ' h')}</div>` : ''}</div>`).join('')}</div>`);
  const indiv = P.filter((p) => p.sursa !== 'grup').map((p) => p.nume);
  const grup = P.filter((p) => p.sursa === 'grup').map((p) => p.nume);
  const putine = P.filter((p) => p.putineDate).map((p) => p.nume);
  s.push(`<p class="nota">${indiv.length ? `Calendare individuale: ${indiv.join(', ')}. ` : ''}${grup.length ? `Din calendarul de grup: ${grup.join(', ')} (poate fi incomplet). ` : ''}${putine.length ? `Date puține (sub ${CFG.minZileClasament || 10} zile active): ${putine.join(', ').replace(/.$/, '')}. ` : ''}${M.sarbatori.length ? `Sărbători legale excluse: ${M.sarbatori.map(ddmm).join(', ')}. ` : ''}${M.lipsaDate.length ? `<b>Lipsesc datele pentru: ${M.lipsaDate.join(', ')}.</b>` : ''}</p>`);

  // ---- analiză (scrisă de agent) ----
  const sem = M.semnale;
  if (A || sem.length) {
    const lista = (t, arr) => (arr?.length ? `<h3>${t}</h3><ul>${arr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
    s.push(sectiune('Concluziile lunii', A?.rezumat ? esc(A.rezumat) : '', `<div class="analiza">${lista('Ce se vede', A?.observatii || sem.slice(0, 8).map((x) => x.text))}${lista('Ce recomandăm', A?.recomandari)}</div>`));
  }

  // ---- cum e folosit timpul ----
  const maxRef = [...cuDate].sort((a, b) => b.refaceriPct - a.refaceriPct).slice(0, 3);
  const maxSed = [...cuDate].sort((a, b) => b.sedintePct - a.sedintePct).slice(0, 2);
  s.push(sectiune('Cum este folosit timpul',
    `Cele mai multe refaceri: ${maxRef.map((p) => `${esc(p.nume)} (${pct(p.refaceriPct)})`).join(', ')}. Cel mai mult timp în ședințe: ${maxSed.map((p) => `${esc(p.nume)} (${pct(p.sedintePct)})`).join(', ')}.`,
    stacked(cuDate.map((p) => ({ label: p.nume, parts: [{ w: p.bazaPct, c: C.baza }, { w: p.refaceriPct, c: C.ref }, { w: p.sedintePct, c: C.sed }] })), [['Lucru de bază', C.baza], ['Refaceri', C.ref], ['Ședințe', C.sed]])));

  // ---- comparație cu luna trecută ----
  if (prev) {
    const rows = P.map((p) => {
      const q = prevP[p.id] || {};
      const d = q.ore != null ? p.ore - q.ore : null;
      const dr = q.refaceriPct != null ? p.refaceriPct - q.refaceriPct : null;
      return [cel(esc(p.nume), p.culoare, 'nm'), f0(q.ore), f0(p.ore), cel(sign(d, ' h'), d == null ? '' : d >= 0 ? C.verde : C.rosu), f1(q.oreZi), f1(p.oreZi), pct(q.refaceriPct), pct(p.refaceriPct), cel(sign(dr, ' pp'), dr == null ? '' : dr <= 0 ? C.verde : C.rosu), f1(q.suplimentare), f1(p.suplimentare)];
    });
    const lp = LUNI[+prev.luna.slice(5) - 1].slice(0, 3), lc = LUNI[+M.luna.slice(5) - 1].slice(0, 3);
    s.push(sectiune(`Față de ${LUNI[+prev.luna.slice(5) - 1]}`, `Echipa: ${f0(prev.echipa.ore)} h → ${f0(M.echipa.ore)} h (${sign(M.echipa.ore - prev.echipa.ore, ' h')}); refaceri ${pct(prev.echipa.refaceriPct)} → ${pct(M.echipa.refaceriPct)}.`,
      tabel(['Persoană', `Ore ${lp}`, `Ore ${lc}`, 'Δ ore', `Ore/zi ${lp}`, `Ore/zi ${lc}`, `Refaceri ${lp}`, `Refaceri ${lc}`, 'Δ refaceri', `Peste normă ${lp}`, `Peste normă ${lc}`], rows)));
  } else {
    s.push(`<p class="nota">Comparația cu luna anterioară apare automat de luna viitoare (lipsește ${lunaAnterioara(M.luna)}/metrics.json).</p>`);
  }

  // ---- harta zilelor ----
  const culZi = (z) => {
    if (!z) return [C.alb, ''];
    if (z.st === 'sarbatoare') return [C.mov, 'S'];
    if (z.st === 'faradate') return ['#f5f5f5', ''];
    if (z.st === 'concediu') return [C.gri, 'C'];
    if (z.st === 'alta') return ['#e6dcf5', 'A'];
    if (z.st === 'gol') return [z.h > 0 ? C.rosu : C.alb, z.h > 0 ? f1(z.h) : '–'];
    return [z.h >= 8 ? C.verde : z.h >= 6 ? C.galben : C.rosu, f1(z.h)];
  };
  const harta = `<table class="tbl map"><thead><tr><th></th>${zile.map((d) => `<th>${ZS[dow(d)]}<br>${+d.slice(8)}</th>`).join('')}</tr></thead><tbody>${P.map((p) => `<tr><td class="nm" style="background:${p.culoare}">${esc(p.nume)}</td>${zile.map((d) => { const [bg, t] = culZi(p.zile[d]); return `<td style="background:${bg}">${t}</td>`; }).join('')}</tr>`).join('')}</tbody></table>
    <div class="legend"><span><i style="background:${C.verde}"></i>≥ 8 h</span><span><i style="background:${C.galben}"></i>6–8 h</span><span><i style="background:${C.rosu}"></i>sub 6 h</span><span><i style="background:${C.gri}"></i>C = concediu</span><span><i style="background:#e6dcf5"></i>A = altă absență</span><span><i style="background:${C.mov}"></i>S = sărbătoare</span><span><i style="background:#fff;border:1px solid #ddd"></i>fără intrări</span></div>`;
  const abs = P.filter((p) => p.concediu.length || p.gol.length || p.alta.length)
    .map((p) => `${esc(p.nume)}: ${[p.concediu.length && `concediu ${p.concediu.map(ddmm).join(', ')}`, p.alta.length && `${p.alta.length} ${p.alta.length === 1 ? 'zi' : 'zile'} cu altă absență`, p.gol.length && `${p.gol.length} ${p.gol.length === 1 ? 'zi' : 'zile'} fără intrări (${p.gol.map(ddmm).join(', ')})`].filter(Boolean).join('; ')}`);
  s.push(sectiune('Harta zilelor', 'Fiecare pătrat este o zi lucrătoare, cu orele înregistrate.', harta, abs.length ? `Zile fără activitate — ${abs.join('. ')}.` : 'Nicio zi lucrătoare fără activitate.', 'brk'));

  // ---- ritm pe săptămâni ----
  const sapt = [...new Set(P.flatMap((p) => Object.keys(p.saptamani)))].sort();
  const maxS = Math.max(1, ...P.flatMap((p) => Object.values(p.saptamani).map((x) => x.ore)));
  s.push(sectiune('Ritm pe săptămâni', 'Orele lucrate în fiecare săptămână (zilele lucrătoare din lună).',
    tabel(['Persoană', ...sapt.map((w) => `săpt. ${ddmm(w)}`), 'Medie / săpt.*'], P.map((p) => [cel(esc(p.nume), p.culoare, 'nm'), ...sapt.map((w) => { const v = p.saptamani[w]?.ore; return cel(v ? f0(v) : '', v ? albastru(v, maxS) : ''); }), `<b>${f1(p.oreSapt)}</b>`])),
    '* doar săptămânile cu cel puțin 3 zile active.'));

  // ---- program zilnic ----
  const prog = cuDate.filter((p) => p.start != null);
  s.push(sectiune('Program zilnic', 'Ora tipică de început și de sfârșit a zilei (mediana zilelor active).',
    `<div class="prog">${prog.map((p) => `<div class="hb"><div class="lbl">${esc(p.nume)}</div><div class="trk axis"><div class="rng" style="left:${((p.start - 360) / 960) * 100}%;width:${((p.sfarsit - p.start) / 960) * 100}%;background:${p.culoare}">${hhmm(p.start)} – ${hhmm(p.sfarsit)}</div></div></div>`).join('')}
    <div class="hb"><div class="lbl"></div><div class="ticks">${[6, 9, 12, 15, 18, 21].map((h) => `<span style="left:${((h * 60 - 360) / 960) * 100}%">${String(h).padStart(2, '0')}:00</span>`).join('')}</div></div></div>`));

  // ---- ședințe ----
  s.push(sectiune('Timp în ședințe', 'Ponderea și orele petrecute în ședințe, consultări și discuții.',
    hbars(cuDate.map((p) => ({ label: p.nume, value: p.sedintePct, color: p.culoare, text: `${pct(p.sedintePct)} · ${f0(p.sedinteOre)} h` })), { max: Math.max(10, ...cuDate.map((p) => p.sedintePct)) })));

  // ---- ore peste normă (nou) ----
  const supl = [...cuDate].sort((a, b) => b.suplimentare - a.suplimentare);
  s.push(sectiune('Ore peste normă, seara și în weekend',
    `Ore peste ${CFG.normaOre || 8} h/zi adunate pe lună. ${supl[0]?.suplimentare ? `Cele mai multe: ${esc(supl[0].nume)} (${f1(supl[0].suplimentare)} h).` : ''} Seara = după ora 19:00.`,
    tabel(['Persoană', 'Peste normă', 'După 19:00', 'Weekend', 'Evenimente / zi', 'Zile ≥ 10 h'], supl.map((p) => {
      const z10 = Object.values(p.zile).filter((z) => z.st === 'activ' && z.h >= 10).length;
      return [cel(esc(p.nume), p.culoare, 'nm'), cel(`${f1(p.suplimentare)} h`, semafor(p.suplimentare, 10, 25, true)), cel(`${f1(p.dupa19)} h`, semafor(p.dupa19, 5, 15, true)), cel(`${f1(p.weekend)} h`, semafor(p.weekend, 0.5, 4, true)), f1(p.evPeZi), z10];
    })), 'Multe evenimente pe zi înseamnă o zi fragmentată, cu multe comutări între sarcini.', 'brk'));

  // ---- disciplina calendarului ----
  const elig = P.filter((p) => !p.putineDate).sort((a, b) => b.zile8Pct - a.zile8Pct);
  if (elig.length) {
    s.push(sectiune('Cine respectă calendarul cel mai des', `Sunt incluși cei cu cel puțin ${CFG.minZileClasament || 10} zile active.`, ''));
    s.push(sectiune(`1. Zile cu norma de ${CFG.normaOre || 8} h atinsă`, `Pe primele locuri: ${elig.slice(0, 3).map((p) => `${esc(p.nume)} (${pct(p.zile8Pct)})`).join(', ')}.`,
      hbars(elig.map((p) => ({ label: p.nume, value: p.zile8Pct, color: p.culoare, text: `${pct(p.zile8Pct)} (${p.zile8} din ${p.zileActive} zile)` })), { max: 100 }), '', 'sub'));
    const acop = [...elig].sort((a, b) => b.acoperirePct - a.acoperirePct);
    s.push(sectiune('2. Cât din norma totală este acoperită', 'Ore înregistrate raportate la 8 h pe zi activă. Peste 100% înseamnă ore în plus.',
      hbars(acop.map((p) => ({ label: p.nume, value: p.acoperirePct, color: p.culoare, text: pct(p.acoperirePct) })), { max: Math.max(130, ...acop.map((p) => p.acoperirePct)), ref: 100 }), '', 'sub'));
  }
  const cr = P.filter((p) => p.creat.total >= 5);
  if (cr.length) {
    s.push(sectiune('3. Cum își completează calendarul', 'Când sunt create evenimentele proprii: înainte de zi (planificat), în aceeași zi sau după (completat retroactiv).',
      stacked(cr.map((p) => ({ label: p.nume, parts: [{ w: (p.creat.inainte / p.creat.total) * 100, c: C.verde }, { w: (p.creat.aceeasi / p.creat.total) * 100, c: C.galben }, { w: (p.creat.dupa / p.creat.total) * 100, c: C.rosu }] })), [['Creat înainte de zi', C.verde], ['Aceeași zi', C.galben], ['În zilele următoare', C.rosu]]), '', 'sub'));
  }
  const iv = P.filter((p) => p.invitatii.total > 0);
  if (iv.length) {
    s.push(sectiune('4. Răspunsul la invitații', 'Invitațiile la ședințe primite de la alții. „Fără răspuns” nu înseamnă neapărat absență.',
      stacked(iv.map((p) => ({ label: p.nume, parts: [{ w: (p.invitatii.raspuns / p.invitatii.total) * 100, c: C.verde }, { w: 100 - (p.invitatii.raspuns / p.invitatii.total) * 100, c: C.rosu }], after: `${p.invitatii.raspuns} din ${p.invitatii.total}` })), [['Cu răspuns', C.verde], ['Fără răspuns', C.rosu]]), '', 'sub'));
  }

  // ---- proiecte ----
  const PR = M.proiecte.filter((x) => x.ore >= 1);
  if (PR.length) {
    const maxP = Math.max(...PR.map((x) => x.ore));
    const rows = PR.slice(0, 15).map((x) => {
      const parts = Object.entries(x.pePersoane).sort((a, b) => b[1] - a[1]).map(([id, h]) => `<div title="${esc(PI[id]?.nume)}" style="width:${(h / maxP) * 78}%;background:${PI[id]?.culoare}"></div>`).join('');
      const pv = prev?.proiecte?.[x.nume];
      return `<div class="hb"><div class="lbl">${esc(x.nume)}</div><div class="trk st plain">${parts}<span>${f0(x.ore)} h${pv != null ? ` <small>(${sign(x.ore - pv, ' h')})</small>` : ''}</span></div></div>`;
    }).join('');
    const top = PR.slice(0, 3);
    s.push(sectiune('Unde s-a lucrat', `Cele mai multe ore: ${top.map((x) => { const lead = Object.entries(x.pePersoane).sort((a, b) => b[1] - a[1])[0]; return `${esc(x.nume)} (${f0(x.ore)} h, în principal ${esc(PI[lead[0]]?.nume)})`; }).join(', ')}. Fără proiect în titlu: ${f0(M.echipa.oreFaraProiect)} h.`,
      `<div class="legend">${P.filter((p) => Object.keys(p.proiecte).length).map((p) => `<span><i style="background:${p.culoare}"></i>${esc(p.nume)}</span>`).join('')}</div><div class="hb-list">${rows}</div>`, '', 'brk'));
    const rf = PR.filter((x) => x.refaceri > 0).sort((a, b) => b.refaceri - a.refaceri).slice(0, 10);
    if (rf.length) {
      const mx = Math.max(...rf.map((x) => x.ore));
      s.push(sectiune('Unde se pierde timp', `Cea mai mare pondere de refaceri: ${esc([...rf].sort((a, b) => b.refaceriPct - a.refaceriPct)[0].nume)} (${pct([...rf].sort((a, b) => b.refaceriPct - a.refaceriPct)[0].refaceriPct)}); cele mai multe ore de refaceri: ${esc(rf[0].nume)} (${f0(rf[0].refaceri)} h).`,
        `<div class="legend"><span><i style="background:${C.baza}"></i>Lucru de bază</span><span><i style="background:${C.ref}"></i>Refaceri</span></div><div class="hb-list">${rf.map((x) => `<div class="hb"><div class="lbl">${esc(x.nume)}</div><div class="trk st plain"><div style="width:${((x.ore - x.refaceri) / mx) * 70}%;background:${C.baza}"></div><div style="width:${(x.refaceri / mx) * 70}%;background:${C.ref}"></div><span>${f0(x.refaceri)} h refaceri · ${pct(x.refaceriPct)}</span></div></div>`).join('')}</div>`));
    }
  }

  // ---- detaliu pe persoane marcate ----
  for (const p of P.filter((x) => x.detaliu && x.ore > 0)) {
    const it = Object.entries(p.detaliu).sort((a, b) => b[1] - a[1]);
    s.push(sectiune(`${esc(p.nume)}: pe ce merge timpul`, `Din ${f0(p.ore)} h înregistrate: ${it.slice(0, 3).map(([n, h]) => `${esc(n)} ${f0(h)} h (${pct((h / p.ore) * 100)})`).join(', ')}.`,
      hbars(it.map(([n, h]) => ({ label: n, value: h, color: n === 'Altele' ? C.sed : p.culoare, text: `${f0(h)} h · ${pct((h / p.ore) * 100)}` }))), 'Categoriile sunt stabilite după cuvintele din titlurile evenimentelor (vezi echipa.json).'));
  }

  // ---- cifre cheie + clasament ----
  s.push(sectiune('Cifre cheie', '', tabel(['Persoană', 'Zile active', 'Ore totale', 'Ore / zi', 'Zile ≥ 8 h', 'Ore / săpt.', 'Refaceri', 'Ședințe', 'Peste normă', 'Început–sfârșit'],
    P.map((p) => [cel(esc(p.nume), p.culoare, 'nm'), p.zileActive, f0(p.ore), f1(p.oreZi), p.putineDate ? '–' : pct(p.zile8Pct), f1(p.oreSapt), cel(pct(p.refaceriPct), semafor(p.refaceriPct, 15, 30, true)), `${f0(p.sedinteOre)} h`, `${f1(p.suplimentare)} h`, p.start != null ? `${hhmm(p.start)}–${hhmm(p.sfarsit)}` : '–'])), '', 'brk'));
  const loc = Object.fromEntries(M.clasament.map((x) => [x.id, x.loc]));
  const ordine = [...P].sort((a, b) => (loc[a.id] ?? 99) - (loc[b.id] ?? 99));
  s.push(sectiune(`Clasament după norma de ${CFG.normaOre || 8} h`, '', tabel(['Persoană', 'Loc', 'Zile ≥ 8 h', 'Din normă', 'Calendar în avans', 'Invitații cu răspuns'],
    ordine.map((p) => [cel(esc(p.nume), p.culoare, 'nm'), loc[p.id] ? `#${loc[p.id]}` : '–', loc[p.id] ? pct(p.zile8Pct) : '–', loc[p.id] ? pct(p.acoperirePct) : '–', p.creat.total >= 5 ? pct(p.creat.inaintePct) : '–', p.invitatii.total ? `${p.invitatii.raspuns} din ${p.invitatii.total}` : '–'])),
    `Locul se stabilește după procentul de zile cu 8 h sau mai mult, apoi după ore / normă. „–” = date indisponibile sau persoană cu sub ${CFG.minZileClasament || 10} zile active.`));
  s.push(`<p class="nota">Ore nete (suprapunerile se numără o singură dată), doar luni–vineri, fără pauze; includ ședințele. Zile active = zile cu cel puțin 2 h. „Refaceri” = modificări, corecturi sau adaptări, identificate după cuvinte-cheie din titluri (inclusiv în rusă); este o estimare. Proiectele afișează doar orele cu nume de proiect în titlu. Calendarele reflectă timpul înregistrat, nu rezultatul muncii. Generat ${new Date(M.generatLa).toLocaleString('ro-RO', { timeZone: TZ })}.</p>`);

  const html = `<!doctype html><html lang="ro"><head><meta charset="utf-8"><title>${esc(titluPer)}</title>
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:14mm 14mm 16mm;@bottom-left{content:"${esc(titluPer).replace(/"/g,"")} · luni–vineri";font:8px Roboto,Arial,sans-serif;color:#aaa}@bottom-right{content:counter(page);font:8px Roboto,Arial,sans-serif;color:#aaa}}
*{box-sizing:border-box}
body{font-family:Roboto,"Segoe UI",Arial,sans-serif;color:#3a3a3a;font-size:10.5px;margin:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
header h1{font-size:30px;margin:0 0 2px;font-weight:700}
.sub{font-size:13px;font-weight:300;margin:0 0 14px}
h2{font-size:15px;margin:18px 0 3px}
h3{font-size:11.5px;margin:8px 0 3px}
.intro{font-size:11.5px;font-weight:300;margin:0 0 8px}
.nota{font-size:8.5px;color:#999;margin:6px 0}
section{break-inside:avoid}
section.brk{break-before:page}
section.sub h2{font-size:13px}
.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:10px}
.kpi{border:1px solid #eee;border-radius:6px;padding:7px 8px}
.k-et{font-size:8.5px;color:#888;text-transform:uppercase;letter-spacing:.03em}
.k-val{font-size:19px;font-weight:700;margin:2px 0}
.k-sub{font-size:8.5px;color:#888}
.up{color:#2e8b57}.down{color:#c0392b}
.cards{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:4px 0}
.card{border-radius:6px;padding:7px 6px;text-align:center;font-size:9.5px;line-height:1.6;break-inside:avoid}
.card b{font-size:11px}
.card .big{font-size:20px;font-weight:700;margin:3px 0}
.card .mini{font-size:8.5px;color:#555}
.analiza{background:#f7f6fb;border-radius:6px;padding:4px 12px 6px;font-size:10.5px}
.analiza ul{margin:2px 0 6px;padding-left:16px}.analiza li{margin:2px 0}
.legend{display:flex;flex-wrap:wrap;gap:4px 12px;justify-content:center;font-size:9px;margin:4px 0 6px}
.legend i{display:inline-block;width:18px;height:8px;margin-right:4px;vertical-align:middle;border-radius:1px}
.hb-list{margin:2px 0}
.hb{display:flex;align-items:center;margin:2.5px 0}
.lbl{width:120px;flex:none;text-align:right;padding-right:7px;font-size:9.5px;color:#555}
.trk{flex:1;display:flex;align-items:center;position:relative;height:14px}
.trk .bar{height:14px;border-radius:1px}
.trk span{margin-left:6px;font-size:9.5px;font-weight:500;white-space:nowrap}
.trk small{font-weight:400;color:#888}
.trk .ref{position:absolute;top:-3px;bottom:-3px;border-left:1px dashed #999}
.trk.st>div{height:14px;font-size:8.5px;font-weight:500;display:flex;align-items:center;justify-content:center;overflow:hidden;white-space:nowrap}
.trk.st:not(.plain){background:#f3f3f3}
.after{font-size:9px;margin-left:6px;width:60px;white-space:nowrap}
.axis{background:repeating-linear-gradient(90deg,transparent 0,transparent calc(18.75% - 1px),#eee calc(18.75% - 1px),#eee 18.75%)}
.rng{position:absolute;height:12px;font-size:8.5px;font-weight:700;display:flex;align-items:center;justify-content:center;border-radius:1px}
.ticks{flex:1;position:relative;height:12px;border-top:1px solid #999;font-size:8px;color:#777}
.ticks span{position:absolute;transform:translateX(-50%);top:2px}
.tbl{width:100%;border-collapse:separate;border-spacing:2px;font-size:9.5px}
.tbl th{background:#efe9f8;font-weight:500;text-align:left;padding:4px 5px;font-size:9px}
.tbl td{padding:4px 5px;border-bottom:1px solid #f0f0f0}
.tbl td.nm{white-space:nowrap}
.tbl td.heat{text-align:center;border-bottom:none}
.map{border-spacing:1.5px;font-size:7.5px}
.map th{background:none;text-align:center;padding:0;font-size:7px;color:#777;font-weight:400}
.map td{text-align:center;padding:3px 0;border:1px solid #f0f0f0;min-width:20px}
.map td.nm{text-align:right;padding:3px 5px;font-size:8.5px;min-width:70px;border:none}
</style></head><body>
${s.join('\n')}
</body></html>`;

  const htmlPath = path.join(DIR_LUNA, 'raport.html');
  fs.writeFileSync(htmlPath, html);
  const pdfName = `Raport_${(CFG.departament || 'echipa').replace(/[^\p{L}\p{N}]+/gu, '_')}_${M.luna}.pdf`;
  const pdfPath = path.join(DIR_LUNA, pdfName);
  const browsers = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
  const br = browsers.find((b) => fs.existsSync(b));
  if (!br) { console.log(`HTML gata: ${htmlPath}. Nu am găsit Chrome/Edge pentru PDF — setează CHROME_PATH.`); return; }
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'raport-chrome-'));
  try {
    execFileSync(br, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${profil}`, '--no-pdf-header-footer', '--virtual-time-budget=8000', `--print-to-pdf=${pdfPath}`, pathToFileURL(htmlPath).href], { stdio: 'ignore', timeout: 120000 });
  } finally {
    fs.rmSync(profil, { recursive: true, force: true });
  }
  console.log(fs.existsSync(pdfPath) ? `PDF gata: ${pdfPath}` : `Nu s-a generat PDF-ul. HTML: ${htmlPath}`);
}

if (cmd === 'calc') calc();
else pdf();
