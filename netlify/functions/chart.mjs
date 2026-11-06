import { cached, fail, cleanSymbol, ApiError } from '../lib/finnhub.mjs';
import { yChart } from '../lib/yahoo.mjs';

// GET /api/chart?s=VOLV-B.ST&r=1m|1y|5y  →  stängningskurser för kursdiagrammet
const RANGES = { '1m': ['1mo', '1d', 900], '6m': ['6mo', '1d', 1800], '1y': ['1y', '1d', 3600], '5y': ['5y', '1wk', 6 * 3600] };

export default async (req) => {
  try {
    const p = new URL(req.url).searchParams;
    const sym = cleanSymbol(p.get('s'));
    if (!sym) throw new ApiError(400, 'ogiltig ticker');
    const r = RANGES[p.get('r')] ? p.get('r') : '1y';
    const [range, interval, ttl] = RANGES[r];
    const c = await yChart(sym, range, interval);
    const punkter = c.points.map(([t, v]) => [t, Math.round(v * 100) / 100]);
    if (punkter.length < 2) throw new ApiError(404, 'för få kurser');
    // Senaste kursen läggs till om den är nyare än sista stängningen
    const k = c.quote?.kurs; const tq = c.meta?.regularMarketTime;
    if (k && tq && tq > punkter[punkter.length - 1][0] + 3600) punkter.push([tq, k]);
    const first = punkter[0][1]; const last = punkter[punkter.length - 1][1];
    return cached({ sym, r, valuta: c.meta?.currency || null, punkter, forandring: Math.round((last / first - 1) * 10000) / 100, hamtad: new Date().toISOString() }, ttl);
  } catch (e) { return fail(e); }
};

export const config = { path: '/api/chart' };
