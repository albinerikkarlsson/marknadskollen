import { finnhub, cached, fail } from '../lib/finnhub.mjs';
import { ySearch } from '../lib/yahoo.mjs';

// GET /api/search?q=volvo  →  aktier, ETF:er och fonder som matchar
// Yahoo Finance först (hittar även svenska aktier). Svarar Yahoo inte används Finnhub.
const TYP = { 'Common Stock': 'Aktie', EQUITY: 'Aktie', 'ETP': 'ETF', 'ETF': 'ETF', 'ADR': 'ADR', 'REIT': 'Fastighetsbolag', 'Open-End Fund': 'Fond', MUTUALFUND: 'Fond', 'Closed-End Fund': 'Fond', 'Preference': 'Preferensaktie', 'Unit': 'Andel' };

export default async (req) => {
  try {
    const q = (new URL(req.url).searchParams.get('q') || '').trim().slice(0, 40);
    if (q.length < 2) return cached({ results: [] }, 3600);
    let results = await fromYahoo(q).catch((e) => { console.warn('[search] Yahoo:', e?.message); return null; });
    if (!results) results = await fromFinnhub(q);
    results = results.sort((a, z) => rank(a) - rank(z)).slice(0, 12);
    return cached({ results }, 86400);
  } catch (e) { return fail(e); }
};

async function fromYahoo(q) {
  const d = await ySearch(q, { quotes: 15 });
  return (d?.quotes || [])
    .filter((r) => r?.symbol && (r.longname || r.shortname) && ['EQUITY', 'ETF', 'MUTUALFUND'].includes(r.quoteType))
    .map((r) => ({
      sym: r.symbol.toUpperCase(),
      namn: tidy(r.longname || r.shortname),
      typ: TYP[r.quoteType] || r.typeDisp || '',
      borsen: r.symbol.includes('.') ? r.symbol.split('.').pop().toUpperCase() : 'US'
    }));
}

async function fromFinnhub(q) {
  const raw = await finnhub('/search', { q });
  return (raw?.result || [])
    .filter((r) => r?.symbol && r?.description)
    .map((r) => ({ sym: r.symbol, namn: titleCase(r.description), typ: TYP[r.type] || r.type || '', borsen: r.symbol.includes('.') ? r.symbol.split('.').pop() : 'US' }));
}

// Svenska och amerikanska först, sedan resten
const rank = (r) => (r.borsen === 'ST' ? 0 : r.borsen === 'US' ? 1 : 2);
const tidy = (s) => titleCase(String(s).replace(/\s+/g, ' ').trim());
// Namn skrivs ibland med versaler, t.ex. "VOLVO AB-B SHS"
function titleCase(s) {
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/\b([a-zåäö])/g, (c) => c.toUpperCase()).replace(/\b(Ab|Asa|Plc|Inc|Etf|Spdr|Ishares|Adr|Nv|Sa|Ag)\b/g, (w) => ({ Ab: 'AB', Asa: 'ASA', Plc: 'PLC', Etf: 'ETF', Spdr: 'SPDR', Ishares: 'iShares', Adr: 'ADR', Nv: 'NV', Sa: 'SA', Ag: 'AG' }[w] || w));
}

export const config = { path: '/api/search' };
