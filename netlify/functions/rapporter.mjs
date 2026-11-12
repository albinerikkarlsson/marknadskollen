import { cached, fail, cleanSymbol, ApiError } from '../lib/finnhub.mjs';
import { yahoo } from '../lib/yahoo.mjs';
import { buildReports, typesParam } from '../lib/reports.mjs';

// GET /api/rapporter?s=VOLV-B.ST  →  försäljning, resultat, balans och kassaflöde per år och kvartal
// Källa: Yahoo Finance. Det som inte finns skickas som null och visas som saknat.
export default async (req) => {
  try {
    const sym = cleanSymbol(new URL(req.url).searchParams.get('s'));
    if (!sym) throw new ApiError(400, 'ogiltig ticker');
    const now = Math.floor(Date.now() / 1000);
    const d = await yahoo(`/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(sym)}`, { type: typesParam(), period1: now - 7 * 365 * 86400, period2: now + 86400 });
    const r = buildReports(d);
    if (!r.ar.length && !r.kvartal.length) throw new ApiError(404, 'inga rapportsiffror för ' + sym);
    return cached({ sym, ...r, kalla: 'Yahoo Finance', hamtad: new Date().toISOString() }, 12 * 3600);
  } catch (e) { return fail(e); }
};

export const config = { path: '/api/rapporter' };
