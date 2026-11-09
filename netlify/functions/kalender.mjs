import { cached, fail, cleanSymbol, ApiError } from '../lib/finnhub.mjs';
import { yahoo, raw } from '../lib/yahoo.mjs';

// GET /api/kalender?s=VOLV-B.ST  →  kommande rapport, utdelningsdagar och utdelning per aktie
// Källa: Yahoo Finance (calendarEvents). Datum som saknas skickas som null.
export default async (req) => {
  try {
    const sym = cleanSymbol(new URL(req.url).searchParams.get('s'));
    if (!sym) throw new ApiError(400, 'ogiltig ticker');
    const d = await yahoo(`/v10/finance/quoteSummary/${encodeURIComponent(sym)}`, { modules: 'calendarEvents,summaryDetail,price', formatted: 'false', lang: 'en-US', region: 'US' }, { withCrumb: true });
    const r = d?.quoteSummary?.result?.[0];
    if (!r) throw new ApiError(404, 'ingen data för ' + sym);
    const ce = r.calendarEvents || {}; const sd = r.summaryDetail || {}; const pr = r.price || {};
    const day = (v) => { const n = raw(v); return n ? new Date(n * 1000).toISOString().slice(0, 10) : null; };
    const ed = (ce.earnings?.earningsDate || []).map(day).filter(Boolean).sort();
    const perAktie = raw(sd.dividendRate) ?? raw(sd.trailingAnnualDividendRate);
    return cached({
      sym,
      namn: pr.longName || pr.shortName || sym,
      valuta: pr.currency || sd.currency || null,
      rapport: ed[0] || null,
      rapportUppskattad: !!ce.earnings?.isEarningsDateEstimate,
      exUtdelning: day(ce.exDividendDate ?? sd.exDividendDate),
      utbetalning: day(ce.dividendDate),
      utdelningPerAktie: perAktie && perAktie > 0 ? perAktie : null,
      direktavkastning: raw(sd.dividendYield) != null ? raw(sd.dividendYield) * 100 : null,
      kalla: 'Yahoo Finance',
      hamtad: new Date().toISOString()
    }, 6 * 3600);
  } catch (e) { return fail(e); }
};

export const config = { path: '/api/kalender' };
