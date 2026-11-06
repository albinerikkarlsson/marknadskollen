// Finansinspektionens öppna register: insynshandel och blankning.
// Ren tolkning av filerna ligger här så att den går att testa lokalt.
import { inflateRawSync } from 'node:zlib';
import { ApiError } from './finnhub.mjs';

const UA = 'Marknadskollen/1.0 (https://marknadskollen.netlify.app)';

export async function fiFetch(url, timeoutMs = 9000) {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: '*/*' }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new ApiError(res.status === 404 ? 404 : 502, `FI ${res.status} på ${url.slice(0, 120)}`);
  return Buffer.from(await res.arrayBuffer());
}

/* ---------- Namn ---------- */
// "AB Volvo (publ)" och "Volvo, AB" blir båda "volvo"
export function normName(n) {
  return String(n || '')
    .toLowerCase()
    .replace(/\(publ\.?\)/g, ' ')
    .replace(/[,.()"'&]/g, ' ')
    .replace(/\b(ab|aktiebolag|aktiebolaget|publ|asa|oyj|a\/s|plc|inc|corp|ltd|sa|nv|ag|se|ser|class|series)\b/g, ' ')
    .replace(/\b[ab]\b$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export const sameName = (a, b) => !!normName(a) && normName(a) === normName(b);
// Lite friare: det kortare namnet ingår i det längre och resten är bara allmänna ord,
// t.ex. "Hennes & Mauritz AB" och "H & M Hennes & Mauritz AB". "Volvo" och "Volvo Car" räknas inte som samma.
const FILL = new Set(['h', 'm', 'lm', 'the', 'telefonaktiebolaget', 'holding', 'holdings', 'group', 'gruppen', 'koncernen', 'svenska', 'sverige', 'sweden', 'international', 'b', 'a']);
export function nameMatch(a, b) {
  if (sameName(a, b)) return true;
  const x = normName(a).split(' ').filter(Boolean); const y = normName(b).split(' ').filter(Boolean);
  const [s, l] = x.length <= y.length ? [x, y] : [y, x];
  if (!s.length || !s.some((w) => w.length >= 4)) return false;
  return s.every((w) => l.includes(w)) && l.filter((w) => !s.includes(w)).every((w) => FILL.has(w));
}

/* ---------- Tal och datum ---------- */
export function svNum(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(/\s| /g, '');
  if (!s) return null;
  // Decimalkomma, ibland punkt
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(n) ? n : null;
}
export function fiDate(v) {
  const s = String(v || '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

/* ---------- Insynshandel (CSV, UTF-16, semikolon) ---------- */
export function decodeFiText(buf) {
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString('utf16le');
  if (buf[0] === 0xfe && buf[1] === 0xff) return Buffer.from(buf.subarray(2)).swap16().toString('utf16le');
  // UTF-16 utan BOM känns igen på nollbytes
  if (buf.length > 3 && buf[1] === 0 && buf[3] === 0) return buf.toString('utf16le');
  return buf.toString('utf8').replace(/^﻿/, '');
}

function splitCsvLine(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ';') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const KIND = { 'Förvärv': 'Köp', 'Avyttring': 'Sälj', 'Teckning': 'Teckning', 'Tilldelning': 'Tilldelning', 'Gåva lämnad': 'Gåva', 'Gåva mottagen': 'Gåva', 'Pantsättning': 'Pantsättning', 'Lån mottagen': 'Lån', 'Lån utlämnad': 'Lån', 'Lösen ökning': 'Lösen', 'Lösen minskning': 'Lösen', 'Utdelning mottagen': 'Utdelning' };

// Bara aktier ska räknas i kronor. Obligationer anges i nominellt belopp och procent, så volym × pris blir fel.
function isShare(typ, namn) {
  if (typ) return /aktie|share|depåbevis/i.test(typ) && !/option|teckningsr|obligation|konvertib|warrant/i.test(typ);
  return !/float|obl|bond|\d{2}\/\d{2}\/\d{2}|konv|opt|teckn|to\d|wrt/i.test(namn || '');
}

export function parseInsyn(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const head = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, ''));
  const col = (re) => head.findIndex((h) => re.test(h));
  const C = {
    pub: col(/^publiceringsdatum/), bolag: col(/^(utgivare|emittent)$/), person: col(/^personiledandeställning/),
    roll: col(/^befattning/), narst: col(/^närstående/), karaktar: col(/^karaktär/), instr: col(/^instrument(namn)?$/),
    instrTyp: col(/^instrumenttyp/), isin: col(/^isin/), trans: col(/^transaktionsdatum/), volym: col(/^volym$/),
    enhet: col(/^volymsenhet/), pris: col(/^pris$/), valuta: col(/^valuta/), status: col(/^status/), program: col(/aktieprogram/)
  };
  if (C.bolag < 0 || C.karaktar < 0) throw new ApiError(502, 'okänt format på insynsfilen');
  const g = (r, k) => (C[k] >= 0 ? r[C[k]] ?? '' : '');
  const out = [];
  for (const line of lines.slice(1)) {
    const r = splitCsvLine(line);
    if (r.length < 5) continue;
    const status = g(r, 'status');
    if (status && !/aktuell/i.test(status)) continue; // makulerade och ersatta poster visas inte
    const volym = svNum(g(r, 'volym'));
    const pris = svNum(g(r, 'pris'));
    const karaktar = g(r, 'karaktar');
    out.push({
      publicerad: fiDate(g(r, 'pub')),
      datum: fiDate(g(r, 'trans')) || fiDate(g(r, 'pub')),
      bolag: g(r, 'bolag'),
      person: g(r, 'person'),
      roll: g(r, 'roll'),
      narstaende: /^ja$/i.test(g(r, 'narst')),
      typ: KIND[karaktar] || karaktar || 'Övrigt',
      karaktar,
      instrument: g(r, 'instr'),
      instrumentTyp: g(r, 'instrTyp'),
      aktie: isShare(g(r, 'instrTyp'), g(r, 'instr')),
      isin: g(r, 'isin'),
      volym, pris,
      valuta: g(r, 'valuta') || null,
      varde: volym != null && pris != null && isShare(g(r, 'instrTyp'), g(r, 'instr')) ? Math.round(volym * pris) : null,
      program: /^ja$/i.test(g(r, 'program'))
    });
  }
  return out;
}

/* ---------- Blankning (kalkylark: ODS eller XLSX) ---------- */
export function unzip(buf) {
  const files = {};
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 70000); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new ApiError(502, 'inte en zip-fil');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28); const xlen = buf.readUInt16LE(p + 30); const clen = buf.readUInt16LE(p + 32);
    const off = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    p += 46 + nlen + xlen + clen;
    const lnlen = buf.readUInt16LE(off + 26); const lxlen = buf.readUInt16LE(off + 28);
    const start = off + 30 + lnlen + lxlen;
    const data = buf.subarray(start, start + csize);
    files[name] = () => (method === 0 ? data : inflateRawSync(data));
  }
  return files;
}

const unxml = (s) => String(s).replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&amp;/g, '&').trim();
const attr = (a, name) => { const m = a.match(new RegExp(`${name}="([^"]*)"`)); return m ? m[1] : null; };

function odsRows(xml) {
  const table = xml.match(/<table:table\b[\s\S]*?<\/table:table>/)?.[0] || xml;
  const rows = [];
  for (const rm of table.matchAll(/<table:table-row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/table:table-row>)/g)) {
    const cells = [];
    for (const cm of (rm[2] || '').matchAll(/<table:(?:covered-)?table-cell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/table:(?:covered-)?table-cell>)/g)) {
      const a = cm[1];
      const rep = Math.min(Number(attr(a, 'table:number-columns-repeated')) || 1, 30);
      const v = attr(a, 'office:date-value') ?? attr(a, 'office:value') ?? unxml((cm[2] || '').replace(/<\/text:p>\s*<text:p[^>]*>/g, ' '));
      for (let i = 0; i < rep; i++) cells.push(v ?? '');
    }
    if (cells.some((c) => c !== '')) rows.push(cells);
    if (rows.length > 5000) break;
  }
  return rows;
}

function xlsxRows(sheet, shared) {
  const strings = shared ? [...shared.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => unxml(t[1])).join('')) : [];
  const colIdx = (ref) => { let n = 0; for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
  const rows = [];
  for (const rm of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const a = cm[1]; const body = cm[2] || '';
      const i = attr(a, 'r') ? colIdx(attr(a, 'r')) : cells.length;
      const t = attr(a, 't');
      let v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '';
      if (t === 's') v = strings[Number(v)] ?? '';
      else if (t === 'inlineStr') v = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => unxml(x[1])).join('');
      else v = unxml(v);
      cells[i] = v;
    }
    for (let i = 0; i < cells.length; i++) if (cells[i] === undefined) cells[i] = '';
    if (cells.some((c) => c !== '')) rows.push(cells);
  }
  return rows;
}

export function sheetRows(buf) {
  if (buf.readUInt32LE(0) !== 0x04034b50) {
    // Inte ett kalkylark. Prova som text med semikolon eller tabb.
    return decodeFiText(buf).split(/\r?\n/).filter(Boolean).map((l) => (l.includes('\t') ? l.split('\t') : splitCsvLine(l)).map((c) => c.replace(/^"|"$/g, '').trim()));
  }
  const z = unzip(buf);
  if (z['content.xml']) return odsRows(z['content.xml']().toString('utf8'));
  const sheetName = Object.keys(z).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort()[0];
  if (sheetName) return xlsxRows(z[sheetName]().toString('utf8'), z['xl/sharedStrings.xml']?.().toString('utf8'));
  throw new ApiError(502, 'okänt kalkylarksformat');
}

// Excel lagrar datum som antal dagar sedan 1899-12-30
const excelDate = (v) => { const n = Number(v); return Number.isFinite(n) && n > 20000 && n < 80000 ? new Date(Math.round((n - 25569) * 864e5)).toISOString().slice(0, 10) : null; };

export function parseBlankning(rows) {
  const hi = rows.findIndex((r) => r.some((c) => /emittent/i.test(c)) && r.some((c) => /position/i.test(c)));
  if (hi < 0) throw new ApiError(502, 'okänt format på blankningsfilen');
  const h = rows[hi].map((c) => String(c).toLowerCase());
  const col = (re) => h.findIndex((c) => re.test(c));
  const C = { holder: col(/innehavare/), issuer: col(/emittent/), isin: col(/isin/), pct: col(/procent|position i/), date: col(/datum/) };
  const positions = [];
  for (const r of rows.slice(hi + 1)) {
    const issuer = String(r[C.issuer] ?? '').trim();
    const procent = svNum(r[C.pct]);
    if (!issuer || procent == null) continue;
    const d = String(r[C.date] ?? '');
    positions.push({ innehavare: String(r[C.holder] ?? '').trim(), emittent: issuer, isin: C.isin >= 0 ? String(r[C.isin] ?? '').trim() : '', procent, datum: fiDate(d) || excelDate(d) });
  }
  const by = new Map();
  for (const p of positions) {
    const key = p.isin || normName(p.emittent);
    if (!by.has(key)) by.set(key, { emittent: p.emittent, isin: p.isin, summa: 0, positioner: [] });
    const b = by.get(key);
    b.summa += p.procent;
    b.positioner.push({ innehavare: p.innehavare, procent: p.procent, datum: p.datum });
  }
  const bolag = [...by.values()].map((b) => ({ ...b, summa: Math.round(b.summa * 100) / 100, positioner: b.positioner.sort((a, z) => z.procent - a.procent) }));
  return bolag.sort((a, z) => z.summa - a.summa);
}

/* ---------- Gemensam inläsning av blankningsregistret ---------- */
const URL_BLANK = 'https://www.fi.se/sv/vara-register/blankningsregistret/GetAktuellFile/';
let blankMemo = null; // { t, bolag }
export async function loadBlankning() {
  if (blankMemo && Date.now() - blankMemo.t < 15 * 60e3) return blankMemo.bolag;
  const buf = await fiFetch(`${URL_BLANK}?_=${Date.now()}`, 9500);
  const bolag = parseBlankning(sheetRows(buf));
  blankMemo = { t: Date.now(), bolag };
  return bolag;
}
export const findBlank = (bolag, namn) => bolag.find((b) => sameName(b.emittent, namn)) || bolag.find((b) => nameMatch(b.emittent, namn)) || null;
