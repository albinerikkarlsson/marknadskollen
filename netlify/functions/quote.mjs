import { finnhub, cached, fail, cleanSymbol, quoteOrNull } from '../lib/finnhub.mjs';

// GET /api/quote?s=AAPL,SPY,VOLV-B.ST  →  senaste kurs och dagens förändring
// Saknar datakällan en kurs (t.ex. svenska aktier på gratisplanen) blir kurs null.
export default async (req) => {
  try {
    const syms = [...new Set((new URL(req.url).searchParams.get('s') || '').split(',').map(cleanSymbol).filter(Boolean))].slice(0, 12);
    if (!syms.length) return cached({ quotes: [] }, 600);
    const res = await Promise.allSettled(syms.map((s) => finnhub('/quote', { symbol: s })));
    const quotes = syms.map((sym, i) => ({ sym, ...(res[i].status === 'fulfilled' ? quoteOrNull(res[i].value) || { kurs: null, d1: null } : { kurs: null, d1: null }) }));
    if (quotes.every((q) => q.kurs == null)) {
      const err = res.find((r) => r.status === 'rejected')?.reason;
      if (err) throw err;
    }
    return cached({ quotes, hamtad: new Date().toISOString() }, 60);
  } catch (e) { return fail(e); }
};

export const config = { path: '/api/quote' };
