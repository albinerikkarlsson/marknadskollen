import { finnhub, cached, fail } from '../lib/finnhub.mjs';
import { ySearch } from '../lib/yahoo.mjs';

// GET /api/search?q=volvo b  →  aktier, ETF:er och fonder som matchar
// Yahoo Finance först (hittar även svenska aktier). Svarar Yahoo inte används Finnhub.
// Bolag med flera aktieslag visas tillsammans, B-aktien först (den handlas oftast mest i Sverige),
// om man inte skriver vilket slag man vill ha, t.ex. "volvo a".
const TYP = { 'Common Stock': 'Aktie', EQUITY: 'Aktie', 'ETP': 'ETF', 'ETF': 'ETF', 'ADR': 'ADR', 'REIT': 'Fastighetsbolag', 'Open-End Fund': 'Fond', MUTUALFUND: 'Fond', 'Closed-End Fund': 'Fond', 'Preference': 'Preferensaktie', 'Unit': 'Andel' };
const OTC = new Set(['PNK', 'OTC', 'OBB', 'OQB', 'OQX']);

export default async (req) => {
  try {
    const raw = (new URL(req.url).searchParams.get('q') || '').trim().slice(0, 40);
    const { q, klass } = splitClass(raw);
    if (q.length < 2) return cached({ results: [] }, 3600);
    let results = await fromYahoo(q).catch((e) => { console.warn('[search] Yahoo:', e?.message); return null; });
    if (!results) results = await fromFinnhub(q);
    return cached({ results: order(results, raw, klass).slice(0, 12) }, 86400);
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
    .filter((r) => r?.symbol && (r.longname || r.shortname) && ['EQUITY', 'ETF', 'MUTUALFUND'].includes(r.quoteType))
    .map((r) => {
      const sym = r.symbol.toUpperCase();
      const k = sym.includes('.') ? classOf(sym) : null;
      return {
        sym,
        namn: tidy(r.longname || r.shortname),
        typ: k ? `${k}-aktie` : TYP[r.quoteType] || r.typeDisp || '',
        klass: k,
        borsen: OTC.has(r.exchange) ? 'OTC' : sym.includes('.') ? sym.split('.').pop() : 'US',
        lista: r.exchDisp || null
      };
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
  const rank = (r) => (r.sym === exact || r.sym.split('.')[0] === exact ? -20 : 0) + (norm(r.namn) === want ? -1 : 0) + (r.borsen === 'ST' ? 0 : r.borsen === 'US' ? 1 : r.borsen === 'OTC' ? 3 : 2) * 3;
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
