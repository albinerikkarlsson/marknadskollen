import { cached, fail, cleanSymbol, ApiError } from '../lib/finnhub.mjs';
import { yChart } from '../lib/yahoo.mjs';

// GET /api/chart?s=VOLV-B.ST&dag=2026-11-04       →  kurserna var femte minut en tidigare dag (de senaste 60 dagarna)
// GET /api/chart?s=VOLV-B.ST&r=1d               →  dagens kurser var femte minut, plus föregående stängning
// GET /api/chart?s=VOLV-B.ST&r=1m|6m|1y|5y      →  stängningskurser för kursdiagrammet
// GET /api/chart?s=VOLV-B.ST&from=2025-03-14     →  dagliga stängningskurser från ett datum (för portföljens tidslinje)
// GET /api/chart?s=VOLV-B.ST&t=1741943400        →  kursen vid en viss tidpunkt (sekunder), för ett köp i portföljen
// 5yd: fem år med dagliga stängningskurser, för bolagssidans riskmått och glidande medelvärden
const RANGES = { '1d': ['1d', '5m', 300], '1m': ['1mo', '1d', 900], '6m': ['6mo', '1d', 1800], '1y': ['1y', '1d', 3600], '5y': ['5y', '1wk', 6 * 3600], '5yd': ['5y', '1d', 3600], 'max': ['max', '1mo', 12 * 3600] };
const DAY = 86400;

export default async (req) => {
  try {
    const p = new URL(req.url).searchParams;
    const sym = cleanSymbol(p.get('s'));
    if (!sym) throw new ApiError(400, 'ogiltig ticker');
    const now = Math.floor(Date.now() / 1000);

    // Kurs vid en tidpunkt. Inom två år finns timkurser, äldre än så används dagens stängning.
    if (p.get('t')) {
      const t = Math.min(now, Math.floor(Number(p.get('t'))));
      if (!Number.isFinite(t) || t < 0) throw new ApiError(400, 'ogiltig tid');
      const recent = now - t < 700 * DAY;
      let pts = []; let meta = null;
      if (recent) {
        const c = await yChart(sym, { period1: t - 6 * DAY, period2: Math.min(now, t + DAY) }, '1h').catch(() => null);
        if (c) { pts = c.points; meta = c.meta; }
      }
      if (!pts.length) { const c = await yChart(sym, { period1: t - 14 * DAY, period2: Math.min(now, t + 2 * DAY) }, '1d'); pts = c.points; meta = c.meta; }
      // Sista kursen som fanns vid tidpunkten. Var börsen stängd gäller senaste stängningskursen innan.
      const before = pts.filter(([pt]) => pt <= t);
      const hit = before.length ? before[before.length - 1] : pts[0];
      if (!hit) throw new ApiError(404, 'ingen kurs vid den tiden');
      const live = now - t < 900 && meta?.regularMarketPrice ? { kurs: meta.regularMarketPrice, tid: meta.regularMarketTime } : null;
      return cached({ sym, valuta: meta?.currency || null, kurs: Math.round((live?.kurs ?? hit[1]) * 10000) / 10000, kursTid: new Date((live?.tid ?? hit[0]) * 1000).toISOString(), upplosning: live ? 'live' : recent && pts.length > 30 ? 'timme' : 'dag' }, now - t > DAY ? 7 * 86400 : 300);
    }

    // En tidigare dag, var femte minut. Yahoo har femminuterskurser i ungefär 60 dagar.
    if (p.get('dag')) {
      const d = p.get('dag'); if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new ApiError(400, 'ogiltigt datum');
      const t0 = Math.floor(new Date(d + 'T00:00:00Z').getTime() / 1000) - 3 * 3600;
      if (!Number.isFinite(t0) || t0 > now) throw new ApiError(400, 'ogiltigt datum');
      if (now - t0 > 58 * DAY) throw new ApiError(404, 'kurser per fem minuter finns bara för de senaste 60 dagarna');
      const c = await yChart(sym, { period1: t0, period2: Math.min(now, t0 + 30 * 3600) }, '5m');
      const punkter = c.points.map(([t, v]) => [t, Math.round(v * 10000) / 10000]);
      return cached({ sym, dag: d, valuta: c.meta?.currency || null, punkter, hamtad: new Date().toISOString() }, d < new Date().toISOString().slice(0, 10) ? 86400 : 300);
    }
    let c; let r = null; let ttl = 3600;
    if (p.get('from')) {
      const from = Math.floor(new Date(p.get('from') + 'T00:00:00Z').getTime() / 1000);
      if (!Number.isFinite(from)) throw new ApiError(400, 'ogiltigt datum');
      const start = Math.max(0, Math.min(from, now - 5 * DAY) - 5 * DAY);
      c = await yChart(sym, { period1: start, period2: now }, now - start > 3 * 365 * DAY ? '1wk' : '1d');
    } else {
      r = RANGES[p.get('r')] ? p.get('r') : '1y';
      const [range, interval, t] = RANGES[r]; ttl = t;
      c = await yChart(sym, range, interval);
    }
    const punkter = c.points.map(([t, v]) => [t, Math.round(v * 10000) / 10000]);
    const prevClose = r === '1d' ? (c.meta?.chartPreviousClose ?? c.meta?.previousClose ?? null) : undefined;
    if (r === '1d') return cached({ sym, r, valuta: c.meta?.currency || null, punkter, prevClose, kurs: c.quote?.kurs ?? null, kursTid: c.quote?.tid ?? null, hamtad: new Date().toISOString() }, ttl);
    if (punkter.length < 2) throw new ApiError(404, 'för få kurser');
    // Senaste kursen läggs till om den är nyare än sista stängningen
    const k = c.quote?.kurs; const tq = c.meta?.regularMarketTime;
    if (k && tq && tq > punkter[punkter.length - 1][0] + 3600) punkter.push([tq, k]);
    const first = punkter[0][1]; const last = punkter[punkter.length - 1][1];
    return cached({ sym, r, valuta: c.meta?.currency || null, punkter, forandring: Math.round((last / first - 1) * 10000) / 100, hamtad: new Date().toISOString() }, ttl);
  } catch (e) { return fail(e); }
};

export const config = { path: '/api/chart' };
