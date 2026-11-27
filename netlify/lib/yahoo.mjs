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
export async function yahoo(path, params = {}, { withCrumb = false, timeoutMs = 8000, body = null } = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const url = new URL(HOST + path);
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    const headers = { 'user-agent': UA, accept: 'application/json' };
    if (withCrumb) {
      const s = await getSession(attempt > 0);
      url.searchParams.set('crumb', s.crumb);
      headers.cookie = s.cookie;
    }
    if (body) headers['content-type'] = 'application/json';
    const res = await fetch(url, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeoutMs) });
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
// Dagens förändring: senaste kurs mot föregående stängning, samma som på bolagssidan.
// För krypto är Yahoos egen procentsats rörelsen på 24 timmar, inte sedan dagens början, så den används bara
// som kontroll. Skiljer de sig mer än 15 procentenheter är föregående stängning troligen gammal, och då
// visas förändringen som saknad hellre än fel.
export function dayChange(kurs, prev, cp) {
  if (!kurs) return null;
  const calc = prev ? (kurs / prev - 1) * 100 : null;
  if (calc == null) return cp ?? null;
  if (cp != null && Math.abs(calc - cp) > 15) return null;
  // Tre gånger så högt eller en tredjedel på en dag är nästan alltid en split som inte räknats om
  if (kurs / prev >= 3 || kurs / prev <= 1 / 3) return null;
  return Math.round(calc * 100) / 100;
}
const toQuote = (q) => {
  const kurs = raw(q.regularMarketPrice);
  if (!kurs) return null;
  const t = raw(q.regularMarketTime);
  return { kurs, d1: dayChange(kurs, raw(q.regularMarketPreviousClose), raw(q.regularMarketChangePercent)), prev: raw(q.regularMarketPreviousClose), tid: t ? new Date(t * 1000).toISOString() : null, namn: q.longName || q.shortName || null, valuta: q.currency || null };
};

// Senaste kurs för flera tickers. Returnerar { SYM: {kurs, d1, tid, namn, valuta} }.
export async function yQuotes(syms) {
  const out = {};
  try {
    const d = await yahoo('/v7/finance/quote', { symbols: syms.join(','), fields: 'regularMarketPrice,regularMarketChangePercent,regularMarketPreviousClose,regularMarketTime,longName,shortName,currency' }, { withCrumb: true });
    for (const q of d?.quoteResponse?.result || []) { const v = toQuote(q); if (v && q.symbol) out[q.symbol.toUpperCase()] = v; }
  } catch (e) { if (e?.status === 404) return out; }
  // Det som saknas hämtas från kursdiagrammet, som inte kräver crumb
  const missing = syms.filter((s) => !out[s]);
  const res = await Promise.allSettled(missing.map((s) => yChart(s, '5d', '1d')));
  missing.forEach((s, i) => { if (res[i].status === 'fulfilled' && res[i].value?.quote) out[s] = res[i].value.quote; });
  return out;
}

// Kursdiagram. Ger senaste kurs och dagliga stängningskurser.
// range kan också vara { period1, period2 } i sekunder, för en egen tidsperiod
export async function yChart(sym, range = '1y', interval = '1d') {
  const span = typeof range === 'object' ? { period1: Math.floor(range.period1), period2: Math.floor(range.period2) } : { range };
  const d = await yahoo(`/v8/finance/chart/${encodeURIComponent(sym)}`, { ...span, interval, includePrePost: 'false' });
  const r = d?.chart?.result?.[0];
  if (!r?.meta) throw new ApiError(404, 'inget diagram för ' + sym);
  const m = r.meta;
  const ts = r.timestamp || [];
  // Vanliga stängningskurser, så att de går att jämföra med senaste kurs
  const closes = r.indicators?.quote?.[0]?.close || [];
  const points = ts.map((t, i) => [t, closes[i]]).filter((p) => Number.isFinite(p[1]));
  const kurs = raw(m.regularMarketPrice);
  // Dagens förändring räknas mot föregående stängning: sista stängningen från en tidigare handelsdag än den senaste kursen.
  // Saknas en dag i serien (det händer hos Yahoo) blir det annars fel dag. Yahoos egen uppgift går först när den finns.
  const t0 = raw(m.regularMarketTime); const tz = m.exchangeTimezoneName || 'UTC';
  const dayOf = (t) => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(t * 1000)); } catch { return new Date(t * 1000).toISOString().slice(0, 10); } };
  const lastDay = t0 ? dayOf(t0) : points.length ? dayOf(points[points.length - 1][0]) : null;
  let prevPt = null; for (let i = points.length - 1; i >= 0; i--) { if (lastDay && dayOf(points[i][0]) < lastDay) { prevPt = points[i][1]; break; } }
  const prev = raw(m.regularMarketPreviousClose) ?? (range === '1d' ? raw(m.previousClose) : null) ?? prevPt ?? raw(m.previousClose) ?? null;
  const d1 = dayChange(kurs, prev, raw(m.regularMarketChangePercent));
  const t = t0;
  return {
    meta: m,
    points,
    quote: kurs ? { kurs, d1, prev: prev ?? null, tid: t ? new Date(t * 1000).toISOString() : null, namn: m.longName || m.shortName || null, valuta: m.currency || null } : null
  };
}

// Kursutveckling från dagliga stängningskurser
// Tidpunkten för det senaste hoppet där kursen blir minst tre gånger så hög eller en tredjedel på en dag.
// Det är nästan alltid en split eller sammanläggning som Yahoo inte har räknat om historiken för.
// Förändringar som räknas från en kurs före hoppet blir fel och visas därför inte.
export function splitJumpT(points) {
  let t = null;
  for (let i = 1; i < (points?.length || 0); i++) { const a = points[i - 1][1], b = points[i][1]; if (a > 0 && b > 0 && (b / a >= 3 || b / a <= 1 / 3)) t = points[i][0]; }
  return t;
}
export function perfFromChart(points, kurs, d1) {
  if (!points?.length || !kurs) return d1 != null ? [['1 dag', d1]] : [];
  const lastT = points[points.length - 1][0];
  const jumpT = splitJumpT(points);
  const at = (sec) => { let v = null; for (const p of points) { if (p[0] <= sec) v = p; else break; } return v; };
  const back = (days) => at(lastT - days * 86400);
  const now = new Date(lastT * 1000);
  const startOf = (y, mo) => Date.UTC(y, mo, 1) / 1000 - 1;
  const ch = (p) => (p && p[1] && !(jumpT && p[0] < jumpT) ? Math.round(((kurs / p[1]) - 1) * 10000) / 100 : null);
  const firstAfterYearAgo = points[0][0] <= lastT - 360 * 86400 ? points[0] : null;
  const rows = [
    ['1 dag', d1],
    ['5 dagar', points.length > 5 ? ch(points[points.length - 6]) : null],
    ['Månaden', ch(at(startOf(now.getUTCFullYear(), now.getUTCMonth())))],
    ['3 mån', ch(back(91))],
    ['6 mån', ch(back(182))],
    ['I år', ch(at(startOf(now.getUTCFullYear(), 0)))],
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
  return yahoo('/v1/finance/search', { q, quotesCount: quotes, newsCount: news, enableFuzzyQuery: 'false', quotesQueryId: 'tss_match_phrase_query', newsQueryId: 'news_cie_vespa', listsCount: 0, lang: 'en-US', region: 'US' });
}

// Yahoo blandar in artiklar om andra bolag. Behåll bara de som handlar om bolaget:
// tickern finns bland artikelns bolag, eller nyckelordet (t.ex. "Volvo") står i rubriken.
export function newsFromSearch(d, sym, keyword = '') {
  const base = String(sym || '').toUpperCase();
  const kw = String(keyword || '').trim();
  const relevant = (n) => {
    const rel = (n.relatedTickers || []).map((t) => String(t).toUpperCase());
    if (base && rel.includes(base)) return true;
    if (kw.length >= 3 && new RegExp(`(^|[^A-Za-zÅÄÖåäö])${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-zÅÄÖåäö0-9])`).test(n.title)) return true;
    return false;
  };
  return (d?.news || []).filter((n) => n?.title && n?.link && relevant(n)).map((n) => ({
    headline: n.title,
    summary: '',
    url: n.link,
    source: n.publisher || '',
    datetime: raw(n.providerPublishTime),
    // Källans bild: den största upplösningen upp till 800 pixlar bred
    image: (n.thumbnail?.resolutions || []).filter((r) => r?.url && (r.width || 0) <= 800).sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url || n.thumbnail?.resolutions?.[0]?.url || '',
    _sym: sym
  }));
}

/* ---------- Aktiefilter (screener) ---------- */
// Hämtar upp till 250 värdepapper per anrop som matchar ett filter, t.ex. alla svenska aktier i en bransch.
// quoteType kan vara EQUITY, ETF, MUTUALFUND eller CRYPTOCURRENCY.
export async function yScreen(operands, { size = 250, offset = 0, sortField = 'intradaymarketcap', quoteType = 'EQUITY' } = {}) {
  const d = await yahoo('/v1/finance/screener', { formatted: 'false', lang: 'en-US', region: 'US', corsDomain: 'finance.yahoo.com' }, {
    withCrumb: true, timeoutMs: 9000,
    body: { offset, size, sortField, sortType: 'DESC', quoteType, query: { operator: 'AND', operands }, userId: '', userIdType: 'guid' }
  });
  const r = d?.finance?.result?.[0];
  if (!r) throw new ApiError(502, 'Yahoo gav inget filterresultat: ' + JSON.stringify(d?.finance?.error || d).slice(0, 160));
  return { total: r.total ?? (r.quotes || []).length, quotes: r.quotes || [] };
}

/* ---------- Kursen för ett år sedan ---------- */
// Samma regel som "1 år" på bolagssidan (perfFromChart): dagliga stängningskurser för ett år,
// sista stängningen på eller före dagen för 365 dagar sedan. Finns den inte tas första kursen om den är minst 360 dagar gammal.
export function yearAgoClose(points) {
  if (!points?.length) return null;
  const lastT = points[points.length - 1][0]; const lim = lastT - 365 * 86400;
  let v = null; for (const p of points) { if (p[0] <= lim) v = p; else break; }
  if (v == null && points[0][0] <= lastT - 360 * 86400) v = points[0];
  const jumpT = splitJumpT(points);
  if (!v || (jumpT && v[0] < jumpT)) return null;
  return v[1];
}
// Kursen för fem år sedan: sista stängningen fem år (1 826 dagar) före den senaste. Med days = 1 096 blir det tre år. Börjar historiken
// högst en vecka senare än så används första kursen. Samma regel som diagrammets 5 år på sidan för varje värdepapper.
export function fiveYearAgoClose(points, days = 1826) {
  if (!points?.length) return null;
  const lastT = points[points.length - 1][0]; const lim = lastT - days * 86400;
  let v = null; for (const p of points) { if (p[0] <= lim) v = p; else break; }
  if (v == null && points[0][0] <= lim + 7 * 86400) v = points[0];
  const jumpT = splitJumpT(points);
  if (!v || (jumpT && v[0] < jumpT)) return null;
  return v[1];
}
// Svängning: hur mycket kursen har rört sig det senaste året, som årlig standardavvikelse i procent (volatilitet).
// Samma mått som fonder anger i sina faktablad. Kräver minst 100 dagar med kurser.
export function yearVol(points, perYear = 252) {
  if (!points?.length) return null;
  const lastT = points[points.length - 1][0]; const p = points.filter((x) => x[0] > lastT - 365 * 86400 && x[1] > 0);
  if (p.length < 101) return null;
  const jumpT = splitJumpT(p); if (jumpT) return null;
  const r = []; for (let i = 1; i < p.length; i++) r.push(Math.log(p[i][1] / p[i - 1][1]));
  const m = r.reduce((a, c) => a + c, 0) / r.length;
  const sd = Math.sqrt(r.reduce((a, c) => a + (c - m) ** 2, 0) / (r.length - 1));
  return Math.round(sd * Math.sqrt(perYear) * 1000) / 10;
}
// En liten kurva för listor: det senaste året med n punkter
export function sparkOf(points, n = 40) {
  if (!points?.length) return null;
  const lastT = points[points.length - 1][0]; const p = points.filter((x) => x[0] >= lastT - 365 * 86400);
  if (p.length < 20 || splitJumpT(p)) return null;
  const out = []; for (let i = 0; i < n; i++) { const v = p[Math.round((i * (p.length - 1)) / (n - 1))][1]; out.push(Number(v.toPrecision(5))); }
  return out;
}
// Yahoo tar högst 20 tickers per anrop
export async function ySpark(syms, range = '1y', interval = '1d') {
  const d = await yahoo('/v8/finance/spark', { symbols: syms.join(','), range, interval }, { timeoutMs: 8000 });
  const out = {};
  for (const s of syms) {
    const x = d?.[s]; if (!x?.timestamp || !x?.close) continue;
    out[s] = x.timestamp.map((t, i) => [t, x.close[i]]).filter((p) => Number.isFinite(p[1]));
  }
  return out;
}
