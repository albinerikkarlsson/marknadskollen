import { cached, fail, ApiError } from '../lib/finnhub.mjs';
import { normName, nameMatch } from '../lib/fi.mjs';

// GET /api/meddelanden?sprak=sv            →  de senaste bolagsmeddelandena från bolag på Stockholmsbörsen och First North
// GET /api/meddelanden?namn=AB Volvo&sprak=sv  →  ett bolags meddelanden det senaste året
// Källa: Nasdaq Nordics meddelandetjänst. Bolagen måste offentliggöra meddelandena, vi visar rubrik, kategori och länk.
const BASE = 'https://api.news.eu.nasdaq.com/news/query.action';
const SE_MARKET = /stockholm|sweden|sverige/i;

async function query(params, sprak = 'sv', timeoutMs = 8000) {
  const p = new URLSearchParams({
    type: 'json', showAttachments: 'false', showCnsSpecific: 'true', showCompany: 'true', countResults: 'false',
    globalName: 'NordicAllMarkets', displayLanguage: sprak, timeZone: 'CET', dateMask: 'yyyy-MM-dd HH:mm:ss', dir: 'DESC', limit: '50', start: '0', ...params
  });
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}?${p}`, { signal: ctrl.signal, headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 (compatible; Finanskollen/1.0; +https://finanskollen.live)' } });
    if (!res.ok) throw new ApiError(502, `Nasdaq ${res.status}`);
    const j = await res.json().catch(() => { throw new ApiError(502, 'Nasdaq gav inte JSON'); });
    const items = j?.results?.item;
    return Array.isArray(items) ? items : [];
  } finally { clearTimeout(t); }
}

// "2026-11-17 10:01:12" i svensk tid → ISO-tid i UTC
function isoFromCet(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  // Hur många timmar svensk tid ligger före UTC just den dagen (1 på vintern, 2 på sommaren)
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Stockholm', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(guess));
  const h = Number(parts.find((x) => x.type === 'hour')?.value);
  const off = ((h - +m[4] + 24) % 24) || 1;
  return new Date(guess - off * 3600e3).toISOString();
}

// Samma meddelande finns ofta på både svenska och engelska. Vi visar ett per tillfälle, på valt språk om det finns.
function pick(items, sprak) {
  const groups = new Map();
  for (const it of items) {
    if (!it?.headline || !it?.messageUrl) continue;
    const key = `${normName(it.company)}|${String(it.published || it.releaseTime).slice(0, 16)}`;
    const g = groups.get(key) || []; g.push(it); groups.set(key, g);
  }
  const out = [];
  for (const g of groups.values()) {
    // Flera olika meddelanden samma minut: behåll alla på valt språk, annars första
    const own = g.filter((x) => x.language === sprak);
    const chosen = own.length ? own : g.filter((x) => x.language === g[0].language);
    for (const it of chosen) {
      const url = String(it.messageUrl);
      if (!/^https:\/\//.test(url)) continue;
      out.push({
        id: String(it.disclosureId || url),
        tid: isoFromCet(it.published || it.releaseTime),
        bolag: String(it.company || '').trim(),
        rubrik: String(it.headline).replace(/\s+/g, ' ').trim(),
        kategori: String(it.cnsCategory || '').trim(),
        marknad: String(it.market || '').trim(),
        sprak: it.language || null,
        lank: url
      });
    }
  }
  return out.filter((x) => x.tid).sort((a, z) => z.tid.localeCompare(a.tid));
}

export default async (req) => {
  try {
    const q = new URL(req.url).searchParams;
    const sprak = q.get('sprak') === 'en' ? 'en' : 'sv';
    const namn = (q.get('namn') || '').trim().slice(0, 80);
    if (namn) {
      const want = normName(namn);
      if (!want) throw new ApiError(400, 'namn saknas');
      // Sök på bolagets mest utmärkande ord och behåll bara meddelanden från just det bolaget
      const term = want.split(' ').filter((w) => w.length >= 2).sort((a, z) => z.length - a.length)[0];
      const from = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
      // Fritextsökningen hittar också andra bolag som nämner ordet. Den används bara för att hitta bolagets exakta namn hos Nasdaq.
      const found = (await Promise.all([0, 50, 100].map((start) => query({ freeText: term, fromDate: from, start: String(start) }, sprak).catch((e) => (start ? [] : Promise.reject(e)))))).flat();
      const exact = found.find((it) => nameMatch(it.company, namn))?.company;
      if (!exact) return cached({ kalla: 'Nasdaq Nordic', bolag: null, items: [], hamtad: new Date().toISOString() }, 3600);
      const own = (await Promise.all([0, 50].map((start) => query({ company: exact, fromDate: from, start: String(start) }, sprak).catch(() => [])))).flat();
      const items = pick([...own, ...found].filter((it) => it.company === exact), sprak).filter((x) => x.tid >= from);
      const seen = new Set(); const uniq = items.filter((x) => (seen.has(x.id) ? false : seen.add(x.id)));
      return cached({ kalla: 'Nasdaq Nordic', bolag: exact, items: uniq.slice(0, 40), hamtad: new Date().toISOString() }, 900);
    }
    // Alla bolag: tre sidor, eftersom Köpenhamn, Helsingfors och Island också är med
    const pages = await Promise.all([0, 50, 100].map((start) => query({ start: String(start) }, sprak).catch((e) => (start ? [] : Promise.reject(e)))));
    const all = pages.flat();
    const se = all.filter((it) => SE_MARKET.test(String(it.market || '')));
    const items = pick(se.length ? se : all, sprak);
    return cached({ kalla: 'Nasdaq Nordic', items: items.slice(0, 80), hamtad: new Date().toISOString() }, 300);
  } catch (e) { return fail(e); }
};

export const config = { path: '/api/meddelanden' };
