import { finnhub, cached, fail } from '../lib/finnhub.mjs';

// GET /api/search?q=volvo  →  aktier, ETF:er och fonder som matchar
const TYP = { 'Common Stock': 'Aktie', 'ETP': 'ETF', 'ETF': 'ETF', 'ADR': 'ADR', 'REIT': 'Fastighetsbolag', 'Open-End Fund': 'Fond', 'Closed-End Fund': 'Fond', 'Preference': 'Preferensaktie', 'Unit': 'Andel' };

export default async (req) => {
  try {
    const q = (new URL(req.url).searchParams.get('q') || '').trim().slice(0, 40);
    if (q.length < 2) return cached({ results: [] }, 3600);
    const raw = await finnhub('/search', { q });
    const results = (raw?.result || [])
      .filter((r) => r?.symbol && r?.description)
      .map((r) => ({
        sym: r.symbol,
        namn: titleCase(r.description),
        typ: TYP[r.type] || r.type || '',
        borsen: r.symbol.includes('.') ? r.symbol.split('.').pop() : 'US'
      }))
      // Svenska och amerikanska först, sedan resten
      .sort((a, z) => rank(a) - rank(z))
      .slice(0, 12);
    return cached({ results }, 86400);
  } catch (e) { return fail(e); }
};

const rank = (r) => (r.borsen === 'ST' ? 0 : r.borsen === 'US' ? 1 : 2);
// Finnhub skriver ofta namnen med versaler, t.ex. "VOLVO AB-B SHS"
function titleCase(s) {
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/\b([a-zåäö])/g, (c) => c.toUpperCase()).replace(/\b(Ab|Asa|Plc|Inc|Etf|Spdr|Ishares|Adr|Nv|Sa|Ag)\b/g, (w) => ({ Ab: 'AB', Asa: 'ASA', Plc: 'PLC', Etf: 'ETF', Spdr: 'SPDR', Ishares: 'iShares', Adr: 'ADR', Nv: 'NV', Sa: 'SA', Ag: 'AG' }[w] || w));
}

export const config = { path: '/api/search' };
