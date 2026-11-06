import { finnhub, cached, fail, cleanSymbol, quoteOrNull } from '../lib/finnhub.mjs';
import { yQuotes } from '../lib/yahoo.mjs';

// GET /api/quote?s=AAPL,SPY,VOLV-B.ST  →  senaste kurs och dagens förändring
// Yahoo Finance först. Det Yahoo inte har hämtas från Finnhub. Saknas en kurs blir den null.
export default async (req) => {
  try {
    const syms = [...new Set((new URL(req.url).searchParams.get('s') || '').split(',').map(cleanSymbol).filter(Boolean))].slice(0, 12);
    if (!syms.length) return cached({ quotes: [] }, 600);
    const y = await yQuotes(syms).catch((e) => { console.warn('[quote] Yahoo:', e?.message); return {}; });
    const missing = syms.filter((s) => !y[s]);
    const res = await Promise.allSettled(missing.map((s) => finnhub('/quote', { symbol: s })));
    const f = {};
    missing.forEach((s, i) => { if (res[i].status === 'fulfilled') f[s] = quoteOrNull(res[i].value); });
    const quotes = syms.map((sym) => {
      const q = y[sym] || f[sym];
      return q ? { sym, kurs: q.kurs, d1: q.d1 == null ? null : Math.round(q.d1 * 100) / 100, tid: q.tid || null, namn: q.namn || null, valuta: q.valuta || null } : { sym, kurs: null, d1: null };
    });
    if (quotes.every((q) => q.kurs == null)) {
      const err = res.find((r) => r.status === 'rejected')?.reason;
      if (err) throw err;
    }
    return cached({ quotes, hamtad: new Date().toISOString() }, 60);
  } catch (e) { return fail(e); }
};

export const config = { path: '/api/quote' };
