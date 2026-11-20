import { kindOf } from '../lib/klass.mjs';
import { finnhub, cached, fail } from '../lib/finnhub.mjs';
import { ySearch } from '../lib/yahoo.mjs';

// GET /api/search?q=volvo b  →  aktier, ETF:er och fonder som matchar
// Yahoo Finance först (hittar även svenska aktier). Svarar Yahoo inte används Finnhub.
// Bolag med flera aktieslag visas tillsammans, B-aktien först (den handlas oftast mest i Sverige),
// om man inte skriver vilket slag man vill ha, t.ex. "volvo a".
const TYP = { 'Common Stock': 'Aktie', EQUITY: 'Aktie', 'ETP': 'ETF', 'ETF': 'ETF', 'ADR': 'ADR', 'REIT': 'Fastighetsbolag', 'Open-End Fund': 'Fond', MUTUALFUND: 'Fond', 'Closed-End Fund': 'Fond', 'Preference': 'Preferensaktie', 'Unit': 'Andel' };
const OTC = new Set(['PNK', 'OTC', 'OBB', 'OQB', 'OQX']);
// Vanliga svenska sökord som Yahoo inte förstår
const ALIAS = { 'h&m': 'Hennes & Mauritz', 'h & m': 'Hennes & Mauritz', 'hm': 'Hennes & Mauritz', 'hennes': 'Hennes & Mauritz', 'seb': 'Skandinaviska Enskilda Banken', 'shb': 'Svenska Handelsbanken', 'nordea': 'Nordea Bank', 'investor': 'Investor AB', 'industrivärden': 'INDU-C.ST', 'industrivarden': 'INDU-C.ST', 'lundbergs': 'lundberg', 'lundbergföretagen': 'lundberg', 'öresund': 'ORES.ST', 'oresund': 'ORES.ST' };
const IDX = (sym, namn, typ = 'Index') => ({ sym, namn, typ, klass: null, borsen: 'IDX', lista: null });
const FIXED = {
  'omx': [IDX('^OMX', 'OMX Stockholm 30')], 'omxs30': [IDX('^OMX', 'OMX Stockholm 30')], 'stockholmsbörsen': [IDX('^OMX', 'OMX Stockholm 30')],
  'guld': [IDX('GC=F', 'Guld', 'Råvara')], 'gold': [IDX('GC=F', 'Guld', 'Råvara')], 'olja': [IDX('CL=F', 'Olja (WTI)', 'Råvara')], 'silver': [IDX('SI=F', 'Silver', 'Råvara')],
  's&p 500': [IDX('^GSPC', 'S&P 500')], 'sp500': [IDX('^GSPC', 'S&P 500')], 'nasdaq': [IDX('^IXIC', 'Nasdaq Composite')], 'dow jones': [IDX('^DJI', 'Dow Jones')]
};
const NORDIC = new Set(['CO', 'OL', 'HE']);
// Små tyska och andra andrahandslistor av samma bolag döljs när huvudlistan finns
const MINOR = new Set(['F', 'DE', 'MU', 'SG', 'HM', 'IL', 'MI', 'BE', 'DU', 'HA', 'XD', 'XC', 'SW', 'VI', 'BO', 'NS', 'JK', 'MX', 'SA', 'BA', 'IR', 'AS', 'PA', 'MC', 'LS', 'WA', 'PR', 'TA', 'KS', 'TW', 'SS', 'SZ', 'HK', 'T', 'KL', 'BK', 'SI', 'AX', 'NZ', 'TO', 'V', 'NE', 'CN', 'JO', 'IS', 'AT', 'BD', 'SR', 'QA', 'CA']);

export default async (req) => {
  try {
    const raw = (new URL(req.url).searchParams.get('q') || '').trim().slice(0, 40);
    // typ: bara en sorts värdepapper (aktie, fond, etf, etp, krypto)
    const typ = TYPER.has(new URL(req.url).searchParams.get('typ')) ? new URL(req.url).searchParams.get('typ') : null;
    const { q, klass } = splitClass(raw);
    if (q.length < 2) return cached({ results: [] }, 3600);
    const key = q.toLowerCase().replace(/\s+/g, ' ');
    const look = ALIAS[key] || q;
    let results = await fromYahoo(look).catch((e) => { console.warn('[search] Yahoo:', e?.message); return null; });
    if (!results) results = await fromFinnhub(look).catch(() => []);
    // Yahoo förstår ofta inte å, ä och ö. Hittas inget svenskt bolag provar vi utan prickar.
    const plain = look.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (plain !== look && !results.some((x) => x.borsen === 'ST')) results = [...results, ...((await fromYahoo(plain).catch(() => null)) || [])];
    const main = results.filter((x) => !MINOR.has(x.borsen));
    // Våra egna listor hittar mindre bolag som Yahoos sökning missar, och fulla svenska bolagsnamn
    const own = await fromLists(req, q, typ).catch((e) => { console.warn('[search] listor:', e?.message); return []; });
    results = [...(FIXED[key] || []), ...own, ...(main.length ? main : results)];
    if (typ) results = results.filter((r) => typOf(r) === typ);
    return cached({ results: order(results, ALIAS[key] ? look : raw, klass).slice(0, typ ? 20 : 12) }, 86400);
  } catch (e) { return fail(e); }
};

// "volvo b", "volvo ser. b", "volvo b-aktie" → sök "volvo", aktieslag B
export function splitClass(s) {
  const m = s.match(/^(.*?)(?:\s+(?:ser\.?\s*)?([abcd])(?:-?aktien?)?)$/i);
  if (m && m[1].trim().length >= 2) return { q: m[1].trim(), klass: m[2].toUpperCase() };
  return { q: s, klass: null };
}
const classOf = (sym) => { const m = String(sym).match(/-([A-D])(\.[A-Z]+)?$/); return m ? m[1] : null; };

async function fromYahoo(q) {
  const d = await ySearch(q, { quotes: 20 });
  return (d?.quotes || [])
    // Krypto bara i dollar (BTC-USD), samma valuta som i kryptolistan
    .filter((r) => r?.symbol && (r.longname || r.shortname) && (['EQUITY', 'ETF', 'MUTUALFUND'].includes(r.quoteType) || (r.quoteType === 'CRYPTOCURRENCY' && /-USD$/i.test(r.symbol))))
    .map((r) => {
      const sym = r.symbol.toUpperCase();
      const krypto = r.quoteType === 'CRYPTOCURRENCY';
      const k = sym.includes('.') && !krypto ? classOf(sym) : null;
      const slag = r.quoteType === 'MUTUALFUND' || krypto ? null : kindOf(sym, r.longname || r.shortname);
      const typ = krypto ? 'Krypto' : slag === 'etp' ? 'ETP' : slag === 'havstang' ? 'Certifikat' : k ? `${k}-aktie` : TYP[r.quoteType] || r.typeDisp || '';
      return {
        sym,
        namn: krypto ? tidy(r.shortname || r.longname).replace(/\s+USD$/i, '') : tidy(r.longname || r.shortname),
        typ: typ + (OTC.has(r.exchange) ? ' · OTC i USA' : ''),
        klass: k,
        borsen: krypto ? 'KRYPTO' : OTC.has(r.exchange) ? 'OTC' : sym.includes('.') ? sym.split('.').pop() : 'US',
        lista: krypto ? 'Krypto' : r.exchDisp || null
      };
    });
}

// Sökning i våra egna listor: aktier i Sverige, Norden och USA, fonder, ETF:er, ETP:er och krypto. De är cachade, så det går fort.
const LISTOR = [['aktier?m=se', 'aktie'], ['aktier?m=nord', 'aktie'], ['aktier?m=us', 'aktie'], ['lista?typ=fonder', 'fond'], ['lista?typ=etf&m=se', 'etf'], ['lista?typ=etf&m=us', 'etf'], ['lista?typ=etp', 'etp'], ['lista?typ=krypto', 'krypto']];
const plainName = (n) => String(n).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\(publ\.?\)|\b(ab|aktiebolag|asa|oyj|abp|a\/s|inc|corp|plc|ltd|the)\b|[.,()&-]/g, ' ').replace(/\s+/g, ' ').trim();
const TYPER = new Set(['aktie', 'fond', 'etf', 'etp', 'krypto']);
// Vilken sort ett sökresultat är, utifrån typtexten
export const typOf = (r) => { const t = String(r.typ || ''); return /Krypto/.test(t) ? 'krypto' : /^Fond/.test(t) ? 'fond' : /^ETF/.test(t) ? 'etf' : /^(ETP|Certifikat)/.test(t) ? 'etp' : /^Index/.test(t) ? 'index' : 'aktie'; };
async function fromLists(req, q, typ = null) {
  const want = plainName(q); const tick = q.toUpperCase().replace(/\s+/g, '');
  if (want.length < 2) return [];
  const origin = new URL(req.url).origin;
  const lists = await Promise.all(LISTOR.filter(([, slag]) => !typ || slag === typ).map(([u, slag]) => fetch(`${origin}/api/${u}`, { signal: AbortSignal.timeout(3500) }).then((r) => (r.ok ? r.json() : (console.warn('[search] lista', u, r.status), null))).then((d) => (d ? (d.aktier || d.items || []).map((a) => ({ ...a, _slag: a.slag || slag })) : [])).catch((e) => { console.warn('[search] lista', u, e?.message); return []; })));
  const words = want.split(' ');
  const hits = [];
  for (const a of lists.flat()) {
    const n = plainName(a.namn); const base = a._slag === 'krypto' ? a.kod || a.sym.replace(/-USD$/, '') : a.sym.split('.')[0];
    let score = null;
    if (base === tick || base.replace(/-[A-D]$/, '') === tick) score = 0;
    else if (n === want) score = 1;
    else if (n.startsWith(want)) score = 2;
    else if (words.every((w) => n.split(' ').some((x) => x.startsWith(w)))) score = 3;
    else if (want.length >= 5 && n.includes(want)) score = 4;
    if (score != null) hits.push([score, a]);
  }
  const size = (a) => a.mcapSek ?? a.mcap ?? a.storlek ?? 0;
  const TYPNAMN = { fond: 'Fond', etf: 'ETF', etp: 'ETP', havstang: 'Certifikat', krypto: 'Krypto' };
  return hits.sort((x, y) => x[0] - y[0] || size(y[1]) - size(x[1])).slice(0, typ ? 20 : 8).map(([, a]) => {
    const krypto = a._slag === 'krypto';
    const k = a._slag === 'aktie' && a.sym.includes('.') ? classOf(a.sym) : null;
    return { sym: a.sym, namn: tidy(a.namn), typ: k ? `${k}-aktie` : TYPNAMN[a._slag] || 'Aktie', klass: k, borsen: krypto ? 'KRYPTO' : a.sym.includes('.') ? a.sym.split('.').pop() : 'US', lista: a.lista || null };
  });
}

async function fromFinnhub(q) {
  const raw = await finnhub('/search', { q });
  return (raw?.result || [])
    .filter((r) => r?.symbol && r?.description)
    .map((r) => { const k = r.symbol.includes('.') ? classOf(r.symbol) : null; return { sym: r.symbol, namn: titleCase(r.description), typ: k ? `${k}-aktie` : TYP[r.type] || r.type || '', klass: k, borsen: r.symbol.includes('.') ? r.symbol.split('.').pop() : 'US' }; });
}

// Sortering: exakt ticker först, sedan Stockholm, USA, övriga börser och sist OTC (utländska kopior).
// Inom samma bolag: det aktieslag man skrev, annars B före A.
export function order(list, raw, klass) {
  const exact = raw.toUpperCase().replace(/\s+/g, '');
  const firstSeen = new Map();
  list.forEach((r, i) => { const key = r.borsen + '|' + r.namn.toLowerCase(); if (!firstSeen.has(key)) firstSeen.set(key, i); });
  const want = norm(raw.replace(/\s+(ser\.?\s*)?[abcd](-?aktien?)?$/i, ''));
  // Bolag vars namn är precis det man skrev (t.ex. "AB Volvo" för "volvo") går före liknande namn
  const base = (r) => r.sym.split('.')[0].replace(/-[A-D]$/, '');
  // Oslo, Helsingfors och Köpenhamn räknas som huvudlistor, precis som USA
  const tier = (b) => (b === 'ST' ? 0 : b === 'US' || b === 'KRYPTO' || NORDIC.has(b) ? 1 : b === 'OTC' ? 3 : 2);
  const rank = (r) => (r.borsen === 'IDX' ? -100 : 0) + (r.borsen === 'ST' && base(r) === exact ? -25 : 0) + (r.sym === exact || r.sym.split('.')[0] === exact || base(r) === exact ? -20 : 0) + (norm(r.namn) === want ? -1 : 0) + tier(r.borsen) * 3;
  const cls = (r) => (!r.klass ? 0 : klass ? (r.klass === klass ? 0 : 2) : r.klass === 'B' ? 0 : r.klass === 'A' ? 1 : 2);
  const seen = new Set();
  return list
    .filter((r) => (seen.has(r.sym) ? false : seen.add(r.sym)))
    .sort((a, z) => rank(a) - rank(z) || firstSeen.get(a.borsen + '|' + a.namn.toLowerCase()) - firstSeen.get(z.borsen + '|' + z.namn.toLowerCase()) || cls(a) - cls(z));
}

const norm = (n) => String(n).toLowerCase().replace(/\(publ\.?\)|\b(ab|aktiebolag|inc|corp|plc|asa|ltd|the)\b|[.,()]/g, ' ').replace(/\s+/g, ' ').trim();
const tidy = (s) => titleCase(String(s).replace(/\s+/g, ' ').trim());
// Namn skrivs ibland med versaler, t.ex. "VOLVO AB-B SHS"
function titleCase(s) {
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/\b([a-zåäö])/g, (c) => c.toUpperCase()).replace(/\b(Ab|Asa|Plc|Inc|Etf|Spdr|Ishares|Adr|Nv|Sa|Ag)\b/g, (w) => ({ Ab: 'AB', Asa: 'ASA', Plc: 'PLC', Etf: 'ETF', Spdr: 'SPDR', Ishares: 'iShares', Adr: 'ADR', Nv: 'NV', Sa: 'SA', Ag: 'AG' }[w] || w));
}

export const config = { path: '/api/search' };
