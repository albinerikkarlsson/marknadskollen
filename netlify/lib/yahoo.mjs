// Yahoo Finance (inofficiellt gränssnitt). Ger kurser, nyckeltal, bolagsbeskrivning, sök och nyheter
// även för svenska aktier. Yahoo tillåter bara personligt bruk, så det här är en testlösning.
// Alla funktioner kastar ApiError vid fel, så att anroparen kan falla tillbaka på Finnhub.
import { ApiError } from './finnhub.mjs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const HOST = 'https://query2.finance.yahoo.com';

// Cookie och "crumb" behövs för quote och quoteSummary. Sparas så länge funktionen är varm.
let session = null;
let pending = null;

function cookiesFrom(res) {
  const list = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
  return list.map((c) => c.split(';')[0]).filter((c) => c.includes('='));
}

async function newSession() {
  const jar = new Map();
  const add = (res) => { for (const c of cookiesFrom(res)) jar.set(c.split('=')[0], c); };
  for (const url of ['https://fc.yahoo.com/', 'https://finance.yahoo.com/quote/AAPL/']) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' }, redirect: 'manual', signal: AbortSignal.timeout(6000) });
      add(r);
      await r.arrayBuffer().catch(() => {});
    } catch { /* prova nästa */ }
    if (jar.size) break;
  }
  const cookie = [...jar.values()].join('; ');
  const r = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', { headers: { 'user-agent': UA, cookie, accept: '*/*' }, signal: AbortSignal.timeout(6000) });
  const crumb = (await r.text()).trim();
  if (!r.ok || !crumb || crumb.length > 40 || /[<{\s]/.test(crumb)) throw new ApiError(r.status === 429 ? 429 : 502, `Yahoo gav ingen crumb (${r.status})`);
  return { cookie, crumb, t: Date.now() };
}

async function getSession(force = false) {
  if (!force && session && Date.now() - session.t < 50 * 60e3) return session;
  if (!pending) pending = newSession().then((s) => (session = s)).finally(() => { pending = null; });
  return pending;
}

// GET mot Yahoo. withCrumb: lägg till cookie och crumb (krävs för quote/quoteSummary).
export async function yahoo(path, params = {}, { withCrumb = false, timeoutMs = 8000 } = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const url = new URL(HOST + path);
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    const headers = { 'user-agent': UA, accept: 'application/json' };
    if (withCrumb) {
      const s = await getSession(attempt > 0);
      url.searchParams.set('crumb', s.crumb);
      headers.cookie = s.cookie;
    }
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
    const text = await res.text();
    if (withCrumb && attempt === 0 && (res.status === 401 || (res.status === 403 && /crumb|cookie/i.test(text)))) continue;
    if (!res.ok) throw new ApiError(res.status === 404 ? 404 : res.status === 429 ? 429 : 502, `Yahoo ${res.status} på ${path}: ${text.slice(0, 160)}`);
    try { return JSON.parse(text); } catch { throw new ApiError(502, `Yahoo gav inte JSON på ${path}`); }
  }
  throw new ApiError(502, 'Yahoo nekade crumb');
}

// Yahoo svarar ibland med {raw, fmt}. Vi vill bara ha talet.
export const raw = (v) => {
  if (v && typeof v === 'object') v = v.raw;
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/* ---------- Kurser ---------- */
const toQuote = (q) => {
  const kurs = raw(q.regularMarketPrice);
  if (!kurs) return null;
  const t = raw(q.regularMarketTime);
  return { kurs, d1: raw(q.regularMarketChangePercent), tid: t ? new Date(t * 1000).toISOString() : null, namn: q.longName || q.shortName || null, valuta: q.currency || null };
};

// Senaste kurs för flera tickers. Returnerar { SYM: {kurs, d1, tid, namn, valuta} }.
export async function yQuotes(syms) {
  const out = {};
  try {
    const d = await yahoo('/v7/finance/quote', { symbols: syms.join(','), fields: 'regularMarketPrice,regularMarketChangePercent,regularMarketTime,longName,shortName,currency' }, { withCrumb: true });
    for (const q of d?.quoteResponse?.result || []) { const v = toQuote(q); if (v && q.symbol) out[q.symbol.toUpperCase()] = v; }
  } catch (e) { if (e?.status === 404) return out; }
  // Det som saknas hämtas från kursdiagrammet, som inte kräver crumb
  const missing = syms.filter((s) => !out[s]);
  const res = await Promise.allSettled(missing.map((s) => yChart(s, '5d', '1d')));
  missing.forEach((s, i) => { if (res[i].status === 'fulfilled' && res[i].value?.quote) out[s] = res[i].value.quote; });
  return out;
}

// Kursdiagram. Ger senaste kurs och dagliga stängningskurser.
export async function yChart(sym, range = '1y', interval = '1d') {
  const d = await yahoo(`/v8/finance/chart/${encodeURIComponent(sym)}`, { range, interval, includePrePost: 'false' });
  const r = d?.chart?.result?.[0];
  if (!r?.meta) throw new ApiError(404, 'inget diagram för ' + sym);
  const m = r.meta;
  const ts = r.timestamp || [];
  // Vanliga stängningskurser, så att de går att jämföra med senaste kurs
  const closes = r.indicators?.quote?.[0]?.close || [];
  const points = ts.map((t, i) => [t, closes[i]]).filter((p) => Number.isFinite(p[1]));
  const kurs = raw(m.regularMarketPrice);
  // Dagens förändring räknas mot föregående stängning (näst sista dagen i serien)
  let d1 = null;
  const prev = points.length > 1 ? points[points.length - 2][1] : raw(m.previousClose);
  if (kurs && prev) d1 = (kurs / prev - 1) * 100;
  else d1 = raw(m.regularMarketChangePercent);
  const t = raw(m.regularMarketTime);
  return {
    meta: m,
    points,
    quote: kurs ? { kurs, d1: d1 == null ? null : Math.round(d1 * 100) / 100, tid: t ? new Date(t * 1000).toISOString() : null, namn: m.longName || m.shortName || null, valuta: m.currency || null } : null
  };
}

// Kursutveckling från dagliga stängningskurser
export function perfFromChart(points, kurs, d1) {
  if (!points?.length || !kurs) return d1 != null ? [['1 dag', d1]] : [];
  const lastT = points[points.length - 1][0];
  const at = (sec) => { let v = null; for (const [t, c] of points) { if (t <= sec) v = c; else break; } return v; };
  const back = (days) => at(lastT - days * 86400);
  const now = new Date(lastT * 1000);
  const startOf = (y, mo) => Date.UTC(y, mo, 1) / 1000 - 1;
  const before = (sec) => at(sec);
  const ch = (base) => (base ? Math.round(((kurs / base) - 1) * 10000) / 100 : null);
  const firstAfterYearAgo = points[0][0] <= lastT - 360 * 86400 ? points[0][1] : null;
  const rows = [
    ['1 dag', d1],
    ['5 dagar', points.length > 5 ? ch(points[points.length - 6][1]) : null],
    ['Månaden', ch(before(startOf(now.getUTCFullYear(), now.getUTCMonth())))],
    ['3 mån', ch(back(91))],
    ['6 mån', ch(back(182))],
    ['I år', ch(before(startOf(now.getUTCFullYear(), 0)))],
    ['1 år', ch(back(365) ?? firstAfterYearAgo)]
  ];
  return rows.filter((r) => r[1] != null && Number.isFinite(r[1]));
}

/* ---------- Bolagsdata ---------- */
export async function ySummary(sym) {
  const d = await yahoo(`/v10/finance/quoteSummary/${encodeURIComponent(sym)}`, {
    modules: 'price,summaryDetail,financialData,defaultKeyStatistics,assetProfile',
    formatted: 'false', lang: 'en-US', region: 'US'
  }, { withCrumb: true });
  const r = d?.quoteSummary?.result?.[0];
  if (!r) throw new ApiError(404, 'ingen bolagsdata för ' + sym);
  return r;
}

// Gör om Yahoos nyckeltal till samma form som Finnhubs metric, så att riskmodellen kan återanvändas
export function metricFromSummary(r) {
  const sd = r.summaryDetail || {}; const fd = r.financialData || {}; const ks = r.defaultKeyStatistics || {}; const p = r.price || {};
  const de = raw(fd.debtToEquity);
  const pm = raw(fd.profitMargins);
  const vol = raw(sd.averageVolume10days) ?? raw(sd.averageDailyVolume10Day) ?? raw(sd.averageVolume);
  const mcap = raw(p.marketCap) ?? raw(sd.marketCap);
  const m = {
    beta: raw(sd.beta) ?? raw(ks.beta),
    '52WeekHigh': raw(sd.fiftyTwoWeekHigh),
    '52WeekLow': raw(sd.fiftyTwoWeekLow),
    'totalDebt/totalEquityQuarterly': de == null ? null : de / 100,
    peTTM: raw(sd.trailingPE),
    epsTTM: raw(ks.trailingEps),
    netProfitMarginTTM: pm == null ? null : pm * 100,
    '10DayAverageTradingVolume': vol == null ? null : vol / 1e6,
    marketCapitalization: mcap == null ? null : mcap / 1e6
  };
  // Tomma fält tas bort så att riskmodellen hoppar över dem
  for (const k of Object.keys(m)) if (m[k] == null) delete m[k];
  return m;
}

/* ---------- Sök och nyheter ---------- */
export async function ySearch(q, { quotes = 12, news = 0 } = {}) {
  return yahoo('/v1/finance/search', { q, quotesCount: quotes, newsCount: news, enableFuzzyQuery: 'false', listsCount: 0, lang: 'en-US', region: 'US' });
}

export function newsFromSearch(d, sym) {
  return (d?.news || []).filter((n) => n?.title && n?.link).map((n) => ({
    headline: n.title,
    summary: '',
    url: n.link,
    source: n.publisher || '',
    datetime: raw(n.providerPublishTime),
    _sym: sym
  }));
}
