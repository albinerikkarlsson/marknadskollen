// Gemensam kod för API-funktionerna som pratar med Finnhub (samma data som finsheet.io).
// Nyckeln läses från miljövariabeln DATA_API_KEY och skickas aldrig till webbläsaren.

const BASE = 'https://finnhub.io/api/v1';

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function apiKey() {
  const k = Netlify.env.get('DATA_API_KEY');
  if (!k) throw new ApiError(503, 'DATA_API_KEY saknas i Netlify');
  return k;
}

// Hämtar JSON från Finnhub. Kastar ApiError om svaret inte är OK.
export async function finnhub(path, params = {}, timeoutMs = 9000) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json', 'X-Finnhub-Token': apiKey() } });
    const text = await res.text();
    if (!res.ok) throw new ApiError(res.status, `Finnhub ${res.status} på ${path}: ${text.slice(0, 160)}`);
    let data;
    try { data = JSON.parse(text); } catch { throw new ApiError(502, `Finnhub gav inte JSON på ${path}`); }
    if (data && typeof data === 'object' && !Array.isArray(data) && data.error) throw new ApiError(403, `Finnhub: ${data.error}`);
    return data;
  } finally { clearTimeout(t); }
}

// Svar som mellanlagras i Netlifys CDN, så att samma fråga inte förbrukar API-anrop igen.
export function cached(data, seconds) {
  return new Response(JSON.stringify(data), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=30',
      'netlify-cdn-cache-control': `public, durable, s-maxage=${seconds}, stale-while-revalidate=${seconds * 4}`
    }
  });
}

export function fail(err) {
  const status = err instanceof ApiError ? err.status : 500;
  console.error('[api]', err?.message || err);
  const code = status === 503 ? 'no_key' : status === 403 ? 'no_access' : status === 404 ? 'no_data' : status === 429 ? 'limit' : 'upstream';
  return new Response(JSON.stringify({ error: code, status }), {
    status: status >= 400 && status < 600 ? status : 500,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

// Tillåt bara vettiga tickers, t.ex. AAPL, VOLV-B.ST, BRK.B och index som ^OMX
export function cleanSymbol(s) {
  const v = String(s || '').trim().toUpperCase();
  return /^\^?[A-Z0-9][A-Z0-9.\-_:=]{0,24}$/.test(v) ? v : null;
}

export const num = (v) => {
  if (v === null || v === undefined || v === '' || v === 'NA') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Finnhub svarar med nollor när en kurs saknas (t.ex. utländska aktier på gratisplanen)
export function quoteOrNull(q) {
  if (!q || typeof q !== 'object') return null;
  const c = num(q.c); const t = num(q.t);
  if (!c || !t) return null;
  return { kurs: c, d1: num(q.dp), forandring: num(q.d), hog: num(q.h), lag: num(q.l), oppning: num(q.o), forra: num(q.pc), tid: new Date(t * 1000).toISOString() };
}

export const dayIso = (d) => d.toISOString().slice(0, 10);
