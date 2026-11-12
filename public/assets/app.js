/* Finanskollen. All data hämtas live via våra API-funktioner (/api/*), som i sin tur hämtar från Yahoo Finance, Finnhub och Finansinspektionen.
   Ingen exempeldata: saknas något visas det som saknat. */

/* ================= Språk ================= */
// Svenska är grundspråket. På engelska byts all text ut efter att sidan ritats (se Översättning längre ner).
const LANG = (() => { try { return localStorage.getItem('mk-lang') === 'en' ? 'en' : 'sv'; } catch { return 'sv'; } })();
const L = LANG === 'en' ? 'en-GB' : 'sv-SE';
const EN = LANG === 'en';
document.documentElement.lang = LANG;

/* ================= Hjälpfunktioner ================= */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (n, d = 2) => { if (n == null) return '–'; const r = Math.abs(n).toFixed(d); return (Number(r) === 0 ? '' : n > 0 ? '+' : '−') + r.replace('.', EN ? '.' : ',') + ' %'; };
const tone = (n) => (n == null ? '' : n >= 0 ? 'up' : 'down');
const kr = (n) => (n == null ? '–' : Number(n).toLocaleString(L, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const cur = (c) => (c === 'SEK' ? (EN ? 'SEK' : 'kr') : c || '');
const LV = { 1: { t: 'Låg', c: 'up' }, 2: { t: 'Medel', c: 'warn' }, 3: { t: 'Hög', c: 'down' } };
const lvlOf = (p) => (p == null ? null : p <= 3 ? 1 : p <= 6 ? 2 : 3);
const $ = (sel, root = document) => root.querySelector(sel);
const short = (sym) => sym.replace('^', '').split('.')[0].split('-')[0].slice(0, 4);
const clock = (iso) => { try { return new Date(iso).toLocaleTimeString(L, { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' }); } catch { return ''; } };
const when = (iso) => {
  const d = new Date(iso); if (!iso || isNaN(d)) return '';
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
  const day = d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
  return day === today ? clock(iso) : d.toLocaleDateString(L, { day: 'numeric', month: 'short', timeZone: 'Europe/Stockholm' }) + ' ' + clock(iso);
};

/* ================= Flaggor: var aktien handlas och var nyheten kommer ifrån ================= */
const fv = (a, b, c) => `<rect width="10" height="20" fill="${a}"/><rect x="10" width="10" height="20" fill="${b}"/><rect x="20" width="10" height="20" fill="${c}"/>`;
const fh = (a, b, c) => `<rect width="30" height="7" fill="${a}"/><rect y="6.67" width="30" height="6.67" fill="${b}"/><rect y="13.33" width="30" height="6.67" fill="${c}"/>`;
const nord = (bg, c1, c2, x = 9) => `<rect width="30" height="20" fill="${bg}"/>${c2 ? `<path d="M${x - 1.5} 0h6v20h-6zM0 7h30v6H0z" fill="${c1}"/><path d="M${x} 0h3v20h-3zM0 8.5h30v3H0z" fill="${c2}"/>` : `<path d="M${x} 0h3.5v20H${x}zM0 8.25h30v3.5H0z" fill="${c1}"/>`}`;
const star = (cx, cy, r, f) => { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r * 0.42 : r; p.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`); } return `<polygon points="${p.join(' ')}" fill="${f}"/>`; };
const UNION = '<rect width="30" height="20" fill="#012169"/><path d="M0 0L30 20M30 0L0 20" stroke="#FFF" stroke-width="4"/><path d="M0 0L30 20M30 0L0 20" stroke="#C8102E" stroke-width="1.4"/><path d="M13 0h4v20h-4zM0 8h30v4H0z" fill="#FFF"/><path d="M13.8 0h2.4v20h-2.4zM0 8.8h30v2.4H0z" fill="#C8102E"/>';
const FLAG = {
  SE: { sv: 'Sverige', en: 'Sweden', d: nord('#006AA7', '#FECC00') },
  NO: { sv: 'Norge', en: 'Norway', d: nord('#BA0C2F', '#FFF', '#00205B') },
  DK: { sv: 'Danmark', en: 'Denmark', d: nord('#C8102E', '#FFF') },
  FI: { sv: 'Finland', en: 'Finland', d: nord('#FFF', '#002F6C') },
  IS: { sv: 'Island', en: 'Iceland', d: nord('#02529C', '#FFF', '#DC1E35') },
  US: { sv: 'USA', en: 'United States', d: `<rect width="30" height="20" fill="#FFF"/>${[0, 2, 4, 6, 8, 10, 12].map((i) => `<rect y="${(i * 20 / 13).toFixed(2)}" width="30" height="${(20 / 13).toFixed(2)}" fill="#B22234"/>`).join('')}<rect width="13" height="10.77" fill="#3C3B6E"/>${[[2.5, 2.5], [6.5, 2.5], [10.5, 2.5], [4.5, 5.4], [8.5, 5.4], [2.5, 8.3], [6.5, 8.3], [10.5, 8.3]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="0.75" fill="#FFF"/>`).join('')}` },
  GB: { sv: 'Storbritannien', en: 'United Kingdom', d: UNION },
  DE: { sv: 'Tyskland', en: 'Germany', d: fh('#000', '#DD0000', '#FFCE00') },
  NL: { sv: 'Nederländerna', en: 'Netherlands', d: fh('#AE1C28', '#FFF', '#21468B') },
  AT: { sv: 'Österrike', en: 'Austria', d: fh('#C8102E', '#FFF', '#C8102E') },
  FR: { sv: 'Frankrike', en: 'France', d: fv('#002654', '#FFF', '#CE1126') },
  IT: { sv: 'Italien', en: 'Italy', d: fv('#009246', '#FFF', '#CE2B37') },
  IE: { sv: 'Irland', en: 'Ireland', d: fv('#169B62', '#FFF', '#FF883E') },
  BE: { sv: 'Belgien', en: 'Belgium', d: fv('#000', '#FDDA24', '#EF3340') },
  ES: { sv: 'Spanien', en: 'Spain', d: '<rect width="30" height="20" fill="#AA151B"/><rect y="5" width="30" height="10" fill="#F1BF00"/>' },
  CH: { sv: 'Schweiz', en: 'Switzerland', d: '<rect width="30" height="20" fill="#DA291C"/><path d="M13 4h4v12h-4zM9 8h12v4H9z" fill="#FFF"/>' },
  JP: { sv: 'Japan', en: 'Japan', d: '<rect width="30" height="20" fill="#FFF"/><circle cx="15" cy="10" r="6" fill="#BC002D"/>' },
  CN: { sv: 'Kina', en: 'China', d: `<rect width="30" height="20" fill="#EE1C25"/>${star(6, 6, 3.6, '#FFDE00')}` },
  HK: { sv: 'Hongkong', en: 'Hong Kong', d: `<rect width="30" height="20" fill="#DE2910"/>${star(15, 10, 5.5, '#FFF')}` },
  CA: { sv: 'Kanada', en: 'Canada', d: `<rect width="30" height="20" fill="#FFF"/><rect width="7.5" height="20" fill="#D52B1E"/><rect x="22.5" width="7.5" height="20" fill="#D52B1E"/>${star(15, 10.5, 5, '#D52B1E')}` },
  AU: { sv: 'Australien', en: 'Australia', d: `<rect width="30" height="20" fill="#012169"/><g transform="scale(0.5)">${UNION}</g>${star(7.5, 15, 2.6, '#FFF')}${star(23, 6, 1.6, '#FFF')}${star(25, 14, 1.6, '#FFF')}${star(20, 11, 1.6, '#FFF')}` }
};
const SUFFIX = { ST: 'SE', OL: 'NO', CO: 'DK', HE: 'FI', IC: 'IS', DE: 'DE', F: 'DE', BE: 'DE', MU: 'DE', SG: 'DE', HM: 'DE', DU: 'DE', HA: 'DE', L: 'GB', IL: 'GB', PA: 'FR', AS: 'NL', BR: 'BE', SW: 'CH', VX: 'CH', MI: 'IT', MC: 'ES', IR: 'IE', VI: 'AT', TO: 'CA', V: 'CA', NE: 'CA', CN: 'CA', T: 'JP', HK: 'HK', SS: 'CN', SZ: 'CN', AX: 'AU' };
const US_IDX = /^\^(GSPC|IXIC|DJI|NDX|RUT|VIX)$/;
function landOf(sym) {
  sym = String(sym || '').toUpperCase();
  if (!sym || /=X$|=F$/.test(sym) || /-(USD|EUR|SEK)$/.test(sym)) return null;
  if (sym.startsWith('^')) return /^\^OMX/.test(sym) ? 'SE' : US_IDX.test(sym) ? 'US' : null;
  const m = sym.match(/\.([A-Z]{1,2})$/);
  return m ? SUFFIX[m[1]] || null : 'US';
}
const landName = (code) => (FLAG[code] ? FLAG[code][LANG] : '');
function flag(code, cls = '') {
  const f = FLAG[code];
  if (!f) return `<span class="cflag globe ${cls}" role="img" aria-label="${LANG === 'en' ? 'International' : 'Internationell'}" title="${LANG === 'en' ? 'International' : 'Internationell'}">${svg('globe', 11)}</span>`;
  return `<span class="cflag ${cls}" role="img" aria-label="${esc(f[LANG])}" title="${esc(f[LANG])}"><svg viewBox="0 0 30 20" preserveAspectRatio="none" aria-hidden="true">${f.d}</svg></span>`;
}
const symFlag = (sym, cls) => { const c = landOf(sym); return c ? flag(c, cls) : ''; };
// Avatar med liten flagga i hörnet
const av = (sym, label) => `<span class="avatar">${esc(label || short(sym))}${symFlag(sym, 'on-avatar')}</span>`;
// Nyhetens ursprung: svenska bolagsnyheter, aktiens land, annars källan
const SRC_LAND = [[/reuters|financial times|\bft\b|bbc|guardian|economist|telegraph|city a\.?m/i, 'GB'], [/cnbc|marketwatch|bloomberg|yahoo|seeking ?alpha|business insider|benzinga|motley|wall street|wsj|barron|forbes|fox business|cnn|associated press|\bap\b|investing\.com|zacks|thestreet|nasdaq|globenewswire|business ?wire|pr ?newswire|accesswire/i, 'US'], [/dagens industri|\bdi\b|di\.se|affärsvärlden|placera|svd|svenska dagbladet|dn\.se|dagens nyheter|aftonbladet|expressen|privata affärer|realtid|finwire|omni|sverigesradio|svt|breakit|börsvärlden|cision|mfn|tt nyhetsbyrån/i, 'SE'], [/handelsblatt|faz|spiegel|boerse|börse/i, 'DE'], [/les echos|le monde|figaro/i, 'FR'], [/e24|dagens næringsliv|finansavisen/i, 'NO'], [/børsen|borsen/i, 'DK'], [/nikkei/i, 'JP'], [/south china|scmp/i, 'HK']];
function newsLand(n, region, sym) {
  if (sym) return landOf(sym);
  if (region === 'se') return 'SE';
  const src = `${n.kalla || ''} ${(() => { try { return new URL(n.lank).hostname; } catch { return ''; } })()}`;
  for (const [re, c] of SRC_LAND) if (re.test(src)) return c;
  if (/\.se$/.test(src.trim())) return 'SE';
  return null;
}

const ICON = {
  home: 'M4 11l8-7 8 7v9H4z',
  search: 'M11 5a6 6 0 1 0 0.01 0M20 20l-4.5-4.5',
  news: 'M5 5h11v14H6a1 1 0 0 1-1-1zM16 9h3v9a1 1 0 0 1-2 0V9M8 9h5M8 12h5M8 15h3',
  star: 'M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.4 7.2 18.9l.9-5.4-3.9-3.8 5.4-.8z',
  logo: 'M4 17l5-6 4 3 7-9',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  globe: 'M12 3a9 9 0 1 0 0.01 0M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  chat: 'M4 5h16v11H9l-5 4z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  pie: 'M12 3v9h9M12 3a9 9 0 1 0 9 9',
  play: 'M4 19V9M10 19V5M16 19v-7M22 19H2',
  ext: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  compare: 'M8 4v16M16 4v16M4 9h8M12 15h8',
  list: 'M4 6h16M4 12h16M4 18h10',
  check: 'M5 12l5 5 9-10',
  share: 'M12 4v11M8 8l4-4 4 4M5 13v6h14v-6',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.5',
  plus: 'M12 5v14M5 12h14',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0',
  bell: 'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0',
  calendar: 'M5 6h14v14H5zM5 10h14M9 4v4M15 4v4',
  chart: 'M4 19h16M7 15l3-4 3 2 4-6'
};
// Bara vanliga webblänkar släpps igenom (inga javascript:- eller data:-länkar)
const safeUrl = (u) => { try { const x = new URL(u); return x.protocol === 'https:' || x.protocol === 'http:' ? x.href : null; } catch { return null; } };
const svg = (name, size = 20, stroke = 'currentColor') =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON[name] || ICON.news}"></path></svg>`;

/* ================= Live-data ================= */
const memo = new Map();
async function api(path, ttlMs = 60e3) {
  const hit = memo.get(path);
  if (hit && Date.now() - hit.t < ttlMs) return hit.p;
  const p = (async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(path, { signal: ctrl.signal, headers: { accept: 'application/json' } });
      const body = await res.json().catch(() => null);
      return res.ok ? body : { error: body?.error || 'upstream', status: res.status };
    } catch { return { error: 'network' }; } finally { clearTimeout(timer); }
  })();
  memo.set(path, { t: Date.now(), p });
  const v = await p;
  if (!v || v.error) memo.delete(path); // misslyckade svar sparas inte
  return v;
}
const liveTag = (iso) => `<span class="pill outline" title="Hämtat live från datakällan">● Live · ${esc(clock(iso))}</span>`;
const ERR = {
  no_key: 'API-nyckeln saknas i Netlify.',
  no_access: 'Datakällorna ger oss inte tillgång till det här värdepappret just nu.',
  no_data: 'Vi hittade ingen data för det här värdepappret. Kontrollera tickern, till exempel VOLV-B.ST för Volvo B.',
  limit: 'Datakällans gräns för antal anrop är nådd. Vänta en minut och prova igen.'
};
const errText = (r) => ERR[r?.error] || 'Datakällan svarar inte just nu. Prova igen om en stund.';
const loading = (txt = 'Hämtar …') => `<div class="empty" aria-busy="true">${esc(txt)}</div>`;
const nf = (n, d) => Number(n).toLocaleString(L, { minimumFractionDigits: d, maximumFractionDigits: d });
const mny = (n, c = 'SEK') => { if (n == null) return '–'; const a = Math.abs(n); const u = cur(c); return a >= 1e9 ? `${nf(n / 1e9, 1)} ${EN ? 'bn' : 'mdr'} ${u}` : a >= 1e6 ? `${nf(n / 1e6, 1)} ${EN ? 'm' : 'mn'} ${u}` : `${nf(n, 0)} ${u}`; };
const pc = (n) => (n == null ? '–' : nf(n, 2) + ' %');
const dag = (d) => { try { return new Date(d + 'T12:00:00').toLocaleDateString(L, { day: 'numeric', month: 'short', timeZone: 'Europe/Stockholm' }).replace('.', ''); } catch { return d || ''; } };
const isSwedish = (sym) => /\.ST$/.test(sym);

/* ================= Marknaden: börsfonder som följer index ================= */
const MARKET = [
  { sym: '^OMX', kort: 'OMX', namn: 'OMX Stockholm 30', sub: 'Stockholmsbörsen', enhet: 'poäng' },
  { sym: 'EWD', namn: 'Sverige', sub: 'iShares MSCI Sweden' },
  { sym: 'SPY', namn: 'USA, S&P 500', sub: 'SPDR S&P 500' },
  { sym: 'QQQ', namn: 'Nasdaq 100', sub: 'Invesco QQQ' },
  { sym: 'DIA', namn: 'Dow Jones', sub: 'SPDR Dow Jones' },
  { sym: 'GLD', namn: 'Guld', sub: 'SPDR Gold Shares' },
  { sym: 'USO', namn: 'Olja', sub: 'United States Oil Fund' }
];

// Har aktien handlats i dag? Före börsöppning skickar källan gårdagens förändring, och den ska inte räknas som i dag.
const sthlmDay = (d) => new Date(d).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
const tradedToday = (tid) => !!tid && sthlmDay(tid) === sthlmDay(Date.now());
const dayShort = (iso) => new Date(iso).toLocaleDateString(L, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Stockholm' });
const d1Label = (d1, tid) => `${pct(d1)} ${tid && !tradedToday(tid) ? dayShort(tid) : EN ? 'today' : 'i dag'}`;
async function getQuotes(syms) {
  const out = {};
  const list = [...new Set(syms)];
  if (!list.length) return out;
  // Servern tar max 12 tickers per anrop, så längre listor delas upp
  const chunks = [];
  for (let i = 0; i < list.length; i += 12) chunks.push(list.slice(i, i + 12));
  const res = await Promise.all(chunks.map((c) => api('/api/quote?s=' + c.map(encodeURIComponent).join(','), 30e3)));
  for (const r of res) {
    if (r?.quotes) { out.__hamtad = out.__hamtad || r.hamtad; for (const q of r.quotes) out[q.sym] = { ...q, idag: tradedToday(q.tid) }; }
    else out.__error = out.__error || r;
  }
  if (out.__hamtad) delete out.__error;
  return out;
}

/* ================= Bevakningslista (sparas i webbläsaren) ================= */
const WKEY = 'mk-bevakning-v3';
const NKEY = 'mk-namn';
const DEFAULT_WATCH = ['VOLV-B.ST', 'INVE-B.ST', 'AAPL', 'NVDA', 'SPY'];
const DEFAULT_NAMES = { AAPL: 'Apple', MSFT: 'Microsoft', NVDA: 'Nvidia', TSLA: 'Tesla', SPY: 'SPDR S&P 500 ETF', EWD: 'iShares MSCI Sweden ETF', QQQ: 'Invesco QQQ', 'VOLV-B.ST': 'Volvo B', 'EVO.ST': 'Evolution', 'SAAB-B.ST': 'Saab B', 'INVE-B.ST': 'Investor B', 'ERIC-B.ST': 'Ericsson B', '^OMX': 'OMX Stockholm 30' };
const readLS = (k, fb) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? fb; } catch { return fb; } };
const KKEY = 'mk-koll'; // val för insyns- och blankningslarm och vad man redan sett
// Varje del sparas för sig. Bara det som ändrats i just den här fliken skickas, så en äldre flik eller enhet kan aldrig skriva över något den inte själv ändrat.
const FIELD = { [WKEY]: 'bevakning', 'mk-larm': 'larm', 'mk-portfolj': 'portfolj', 'mk-ova': 'ova', 'mk-koll': 'koll' };
const DIRTY = new Set();
// Senaste version av varje del som den här fliken vet att kontot har. Används för att räkna ut vad man själv ändrat.
const SNAP = {};
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
function mergeField(f, cloud, local, snap) {
  if (cloud === undefined || snap === undefined) return local;
  if (f === 'bevakning' && Array.isArray(cloud) && Array.isArray(local) && Array.isArray(snap)) {
    const removed = new Set(snap.filter((x) => !local.includes(x))); const added = local.filter((x) => !snap.includes(x));
    const out = cloud.filter((x) => !removed.has(x)); for (const x of added) if (!out.includes(x)) out.push(x); return out;
  }
  if (f === 'portfolj' && Array.isArray(cloud) && Array.isArray(local) && Array.isArray(snap)) {
    const key = (x) => x.id || JSON.stringify(x); const sm = new Map(snap.map((x) => [key(x), JSON.stringify(x)])); const lm = new Map(local.map((x) => [key(x), x]));
    const out = cloud.filter((x) => !(sm.has(key(x)) && !lm.has(key(x)))).map((x) => (lm.has(key(x)) && JSON.stringify(lm.get(key(x))) !== sm.get(key(x)) ? lm.get(key(x)) : x));
    for (const x of local) if (!sm.has(key(x)) && !out.some((y) => key(y) === key(x))) out.push(x); return out;
  }
  if (f === 'larm' && cloud && local && snap && typeof cloud === 'object') {
    const out = { ...cloud }; for (const k of Object.keys(snap)) if (!(k in local)) delete out[k];
    for (const [k, v] of Object.entries(local)) if (JSON.stringify(v) !== JSON.stringify(snap[k])) out[k] = v; return out;
  }
  return local;
}
const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* privat läge */ } const f = FIELD[k]; if (f && !SYNCING) { DIRTY.add(f); saveCloud(); } };
let SYNCING = false;
const LKEY = 'mk-larm';
const getLarm = () => { const v = readLS(LKEY, {}); return v && typeof v === 'object' ? v : {}; };
const getWatch = () => { const v = readLS(WKEY, null); return Array.isArray(v) ? v : DEFAULT_WATCH.slice(); };
const nameOf = (sym) => readLS(NKEY, {})[sym] || DEFAULT_NAMES[sym] || sym;
function rememberName(sym, namn) { if (!sym || !namn || namn === sym) return; const m = readLS(NKEY, {}); m[sym] = namn; writeLS(NKEY, m); }
// Besökare utan konto: be dem skapa ett konto och kom tillbaka hit efteråt
function askLogin(what = 'bevaka aktier') {
  if (!locked()) return false;
  writeLS('mk-efter-login', location.pathname + location.search);
  toast(`Skapa ett gratis konto för att ${what}`, 'Det tar en halv minut. Du kommer tillbaka hit efteråt.');
  navigate('/konto?ny=1');
  return true;
}
function toggleWatch(sym, namn) {
  const w = getWatch(); const i = w.indexOf(sym);
  if (i >= 0) w.splice(i, 1); else { w.push(sym); rememberName(sym, namn); }
  writeLS(WKEY, w);
  return w.includes(sym);
}

/* ================= Gemensamma delar ================= */
const NAV = [
  { group: 'Översikt', items: [
    { id: 'oversikt', href: '/', label: 'Översikt', icon: 'home' },
    { id: 'nyheter', href: '/nyheter', label: 'Nyheter', icon: 'news' },
    { id: 'portfolj', href: '/portfolj', label: 'Min portfölj', icon: 'pie' }
  ] },
  { group: 'Börsen', items: [
    { id: 'sok', href: '/sok', label: 'Bolag', icon: 'search' },
    { id: 'aktier', href: '/aktier', label: 'Alla aktier', icon: 'list' },
    { id: 'jamfor', href: '/jamfor', label: 'Jämför', icon: 'compare' },
    { id: 'bevakning', href: '/bevakning', label: 'Bevakning', icon: 'star', badge: true }
  ] },
  { group: 'Konto', items: [{ id: 'konto', href: '/konto', label: 'Logga in', icon: 'user' }, { id: 'om', href: '/om', label: 'Om oss', icon: 'info' }] }
];

function sidebar(active) {
  const watchCount = getWatch().length;
  const today = new Date().toLocaleDateString(L, { weekday: 'long', day: 'numeric', month: 'long' });
  return `
  <nav class="nav" aria-label="Huvudmeny">
    <a class="brand" href="/" data-link>
      <span class="brand-mark">${svg('logo', 20, '#FFFFFF')}</span>
      <span class="brand-text"><span class="brand-name">Finanskollen</span><span class="brand-sub">Trygg börskoll</span></span>
    </a>
    <div class="welcome"><b>${ACC.user ? `Välkommen tillbaka${firstName() ? `, ${esc(firstName())}` : ''}` : 'Välkommen'}</b><span>${esc(today)}</span></div>
    ${NAV.map((g) => `
      <div class="nav-group">
        <span class="nav-label">${g.group}</span>
        ${g.items.map((it) => `
          <a class="nav-link" href="${it.href}" data-link ${it.id === active ? 'aria-current="page"' : ''}>
            ${svg(it.icon)}<span>${it.id === 'konto' && ACC.user ? 'Mitt konto' : it.label}</span>${it.badge && watchCount && !locked() ? `<span class="nav-badge">${watchCount}</span>` : ''}
          </a>`).join('')}
      </div>`).join('')}
    ${isAdmin() ? `<div class="nav-group"><span class="nav-label">Ägare</span><a class="nav-link" href="/statistik" data-link ${active === 'statistik' ? 'aria-current="page"' : ''}>${svg('chart')}<span>Statistik</span></a></div>` : ''}
    <div class="nav-foot">Data från Yahoo Finance, Finnhub och Finansinspektionen. Ingen investeringsrådgivning.</div>
  </nav>`;
}

function topbar(crumbs, withSearch = true) {
  const parts = crumbs.map((c, i) => (i === crumbs.length - 1 ? `<span class="here">${esc(c[0])}</span>` : `<a href="${c[1]}" data-link>${esc(c[0])}</a><span>/</span>`)).join('');
  return `
  <div class="topbar">
    <div class="crumbs">${svg('home', 20)}${parts}</div>
    ${langSwitch()}
    ${withSearch ? `
    <form class="searchbar" role="search" data-topsearch>
      ${svg('search', 18, '#6B6F76')}
      <label class="sr-only" for="topq">Sök bolag eller ticker</label>
      <input id="topq" name="q" type="search" placeholder="Sök bolag eller ticker" autocomplete="off">
      <button class="btn small" type="submit">Sök</button>
    </form>` : ''}
  </div>`;
}

const footer = (extra = '') =>
  `<footer class="foot"><nav class="foot-links" aria-label="Om sidan"><a href="/om" data-link>Om oss</a><a href="/integritet" data-link>Integritet</a><a href="/ordlista" data-link>Ordlista</a></nav>Ingen investeringsrådgivning. Kurser, nyckeltal och nyheter kommer från Yahoo Finance och Finnhub, insynshandel och blankning från Finansinspektionen. Riskkollen räknas fram med fasta regler som förklaras på varje bolagssida. ${extra}</footer>`;

/* ================= Nyheter ================= */
async function getNews(region) {
  const r = await api(`/api/news?region=${region}`, 5 * 60e3);
  if (r?.items) return { ok: true, hamtad: r.hamtad, items: r.items.map((n) => prepNews(n, region)), ingenAtkomst: !!r.ingenAtkomst };
  return { ok: false, error: r, items: [] };
}
// Vad en nyhet handlar om, utifrån rubrik och ingress. Används för att sortera och filtrera.
const TOPICS = [
  ['Vinstvarning', /vinstvarning|profit warning|sänker (sin )?prognos|cuts? (its )?(guidance|forecast|outlook)|lowers (its )?(guidance|forecast|outlook)/i, 5],
  ['Rapport', /rapport|kvartal|delårs|bokslut|resultat|earnings|quarter|\bq[1-4]\b|results|eps\b|revenue|omsättning|rörelseresultat/i, 4],
  ['Affär', /förvärv|uppköp|\bbud\b|köper .*(bolag|verksamhet)|avyttr|acquir|merger|takeover|buyout|\bdeal\b|to buy\b|to sell\b/i, 3],
  ['Utdelning', /utdelning|dividend|återköp|buyback|share repurchase/i, 3],
  ['Ledning', /\b(ny|nya|new|interim) (vd|ceo|cfo|ordförande|chairman)\b|avgår|lämnar (som|posten)|steps? down|resign|appoint|utnämn|utses|utsedd|names? .{0,30}\b(ceo|cfo|chairman)\b/i, 2],
  ['Analys', /riktkurs|price target|upgrade|downgrade|uppgrader|nedgrader|analyti?ker|analyst/i, 1]
];
const topicOf = (n) => { const t = `${n.rubrik || ''} ${n.text || ''}`; for (const [k, re, w] of TOPICS) if (re.test(t)) return { amne: k, vikt: w }; return { amne: null, vikt: 0 }; };
const prepNews = (n, region, sym) => ({ ...n, ...topicOf(n), tidTxt: when(n.datum), bolagTxt: (n.bolag || []).join(', '), land: newsLand(n, region, sym) });

function newsTitle(n) {
  const u = safeUrl(n.lank);
  return u ? `<a class="news-title" href="${esc(u)}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none">${esc(n.rubrik)} <span class="sr-only">${EN ? '(opens in a new tab)' : '(öppnas i ny flik)'}</span></a>` : `<span class="news-title">${esc(n.rubrik)}</span>`;
}
const sourceLink = (n) => { const u = safeUrl(n.lank); return u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer" style="margin-left:auto;display:inline-flex;gap:6px;align-items:center">Läs hos källan ${svg('ext', 15)}</a>` : ''; };

function frontNewsHTML(data, region) {
  if (!data.ok) return `<div class="empty">${esc(errText(data.error))}</div>`;
  if (!data.items.length) return `<div class="empty">${region === 'se' ? 'Inga nyheter om svenska bolag just nu.' : 'Inga nyheter just nu.'}</div>`;
  const [top, ...rest] = data.items;
  return `
  <div class="split" style="align-items:stretch">
    <article class="wide card dark rings stack" style="gap:12px;padding:26px;justify-content:space-between;min-height:${top.text ? 260 : 190}px">
      <div class="stack" style="gap:12px">
        <div class="meta" style="color:rgba(255,255,255,0.62)"><span class="pill inv src">${flag(top.land)}${esc(top.kalla)}</span><span class="num">${esc(top.tidTxt)}</span>${top.bolagTxt ? `<span>${esc(top.bolagTxt)}</span>` : ''}</div>
        <h3 style="margin:0;font-size:clamp(22px,3vw,30px);font-weight:400;letter-spacing:-0.01em;line-height:1.22">${newsTitle(top)}</h3>
        ${top.text ? `<p class="news-text" style="margin:0;color:rgba(255,255,255,0.75);font-size:15.5px;max-width:640px">${esc(top.text)}</p>` : ''}
      </div>
      <div class="meta" style="color:rgba(255,255,255,0.62)">${sourceLink(top)}</div>
    </article>
    <div class="narrow card" style="padding:10px 22px">
      ${rest.slice(0, 5).map((n) => `
        <div class="row-link" style="align-items:flex-start;gap:14px">
          <span class="grow"><span style="display:block;font-weight:500;line-height:1.35">${newsTitle(n)}</span><span class="small muted num src">${flag(n.land)}${esc(n.tidTxt)} · ${esc(n.kalla)}</span></span>
        </div>`).join('') || '<p class="muted">Inga fler nyheter.</p>'}
    </div>
  </div>
  <p class="small faint" style="margin:8px 0 0">Nyheterna visas på originalspråket, oftast engelska. Klicka på en rubrik för att läsa hela artikeln hos källan.</p>`;
}

/* ================= Finansinspektionen: insynshandel och blankning ================= */
const FI_DOWN = 'Finansinspektionens register svarar inte just nu. Prova igen om en stund.';
const tradePill = (t) => `<span class="pill ${t === 'Köp' ? 'up' : t === 'Sälj' ? 'down' : ''}">${esc(t)}</span>`;

function insynRows(list, withBolag) {
  return list.map((a) => `
    <div class="row-link" style="align-items:flex-start;gap:14px">
      <span class="small muted num" style="width:58px;flex:none;padding-top:2px">${esc(dag(a.datum))}</span>
      <span class="grow" style="min-width:0">
        <span style="display:block;font-weight:500">${esc(withBolag ? a.bolag : a.person)}</span>
        <span class="small muted">${esc([withBolag ? a.person : null, a.roll, a.narstaende ? 'närstående' : null, a.program ? 'aktieprogram' : null].filter(Boolean).join(' · '))}</span>
      </span>
      <span class="stack" style="gap:4px;align-items:flex-end;flex:none">${tradePill(a.typ)}<span class="small num muted">${a.varde != null ? esc(mny(a.varde, a.valuta)) : a.volym != null ? esc(nf(a.volym, 0)) + ' st' : ''}</span></span>
    </div>`).join('');
}

function insynHTML(d) {
  if (!d || d.error) return `<p class="muted" style="margin:0">${FI_DOWN}</p>`;
  if (d.saknas) return '<p class="muted" style="margin:0">Vi hittade inte bolaget i Finansinspektionens insynsregister.</p>';
  const list = d.affarer || [];
  if (!list.length) return '<p class="muted" style="margin:0">Inga anmälda insynsaffärer de senaste tolv månaderna.</p>';
  return `<div class="statbar" style="padding:0">
      <div class="stat"><span class="small muted">Köp, 12 mån</span><span class="num">${d.kop.antal} st · ${esc(mny(d.kop.varde, d.valuta))}</span></div>
      <div class="stat"><span class="small muted">Sälj, 12 mån</span><span class="num">${d.salj.antal} st · ${esc(mny(d.salj.varde, d.valuta))}</span></div>
    </div>
    <div>${insynRows(list.slice(0, 8), false)}</div>
    <p class="small faint" style="margin:0">Källa: Finansinspektionens insynsregister${safeUrl(d.lank) ? `. <a href="${esc(safeUrl(d.lank))}" target="_blank" rel="noopener noreferrer">Se alla affärer hos FI</a>` : ''}. Värdet är antal gånger pris. Köp och sälj av insynspersoner kan ha många skäl och är inget råd.</p>`;
}

function blankHTML(d) {
  if (!d || d.error) return `<p class="muted" style="margin:0">${FI_DOWN}</p>`;
  const b = d.bolag;
  if (!b) return '<p class="muted" style="margin:0">Ingen investerare har en anmäld blankning på 0,5 % eller mer i bolaget just nu.</p>';
  return `<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><span class="num" style="font-size:34px;letter-spacing:-0.02em">${esc(pc(b.summa))}</span><span class="muted">av aktierna är blankade av ${b.positioner.length} ${b.positioner.length === 1 ? 'investerare' : 'investerare'} med minst 0,5 % var</span></div>
    <div>${b.positioner.map((x) => `
      <div class="row-link" style="gap:14px"><span class="grow">${esc(x.innehavare)}</span><span class="small muted num">${esc(x.datum ? dag(x.datum) : '')}</span><span class="pill num">${esc(pc(x.procent))}</span></div>`).join('')}</div>
    <p class="small faint" style="margin:0">Blankning betyder att någon har lånat och sålt aktier för att tjäna på att kursen faller. Mindre positioner än 0,5 % syns inte, så den verkliga blankningen kan vara högre. Källa: <a href="${esc(safeUrl(d.lank) || 'https://www.fi.se')}" target="_blank" rel="noopener noreferrer">Finansinspektionens blankningsregister</a>.</p>`;
}

function insynOverviewHTML(d) {
  if (!d || d.error) return `<p class="muted" style="margin:0">${FI_DOWN}</p>`;
  const list = d.storsta?.length ? d.storsta : d.senaste || [];
  if (!list.length) return '<p class="muted" style="margin:0">Inga insynsaffärer den senaste veckan.</p>';
  return `<div>${insynRows(list.slice(0, 6), true)}</div><p class="small faint" style="margin:8px 0 0">Största köpen och försäljningarna i kronor de senaste sju dagarna. Källa: Finansinspektionen.</p>`;
}

function blankOverviewHTML(d) {
  if (!d || d.error) return `<p class="muted" style="margin:0">${FI_DOWN}</p>`;
  const list = d.topp || [];
  if (!list.length) return '<p class="muted" style="margin:0">Inga anmälda blankningspositioner just nu.</p>';
  const max = Math.max(...list.map((b) => b.summa), 1);
  return `<div>${list.slice(0, 6).map((b) => `
    <div class="row-link" style="gap:14px;flex-wrap:wrap">
      <span class="grow" style="min-width:0"><span style="display:block;font-weight:500">${esc(b.emittent)}</span><span class="small muted">${b.positioner.length} ${b.positioner.length === 1 ? 'investerare' : 'investerare'}</span></span>
      <span class="perf-track" style="width:90px;flex:none" aria-hidden="true"><span class="perf-bar neg" style="left:0;width:${(b.summa / max) * 100}%"></span></span>
      <span class="pill num">${esc(pc(b.summa))}</span>
    </div>`).join('')}</div><p class="small faint" style="margin:8px 0 0">Andel av aktierna som är blankade, räknat på positioner från 0,5 %. Källa: Finansinspektionen.</p>`;
}

/* ================= Översikt ================= */
// Startsidan för besökare utan konto: vad Finanskollen är, och en väg in
const visitorHero = () => `
  <section class="card visitor-hero" aria-labelledby="vh-h">
    <div class="stack" style="gap:14px;max-width:640px">
      <span class="pill outline" style="align-self:flex-start">Gratis · Ingen reklam · Inga köptips</span>
      <h2 id="vh-h" class="vh-title">Se exakt vad som hände med dina aktier i dag</h2>
      <div class="chips"><a class="btn" href="/portfolj" data-link>Testa med dina aktier</a><button type="button" class="btn ghost" data-demo-load="/">Se ett exempel</button></div>
      <span class="small muted" style="margin-top:-4px">Inget konto behövs för att testa.</span>
      <p class="muted" style="margin:0;font-size:16.5px">Finanskollen visar risken i över 3 000 svenska och amerikanska aktier på enkel svenska. Se vad ledningen själv köper och säljer, hur många som satsar på att kursen ska falla och vad nyheterna säger.</p>
      <p class="small" style="margin:0"><a href="/konto?ny=1" data-link>Skapa gratis konto</a> så sparas portföljen och du kan få larm.</p>
    </div>
    <ul class="vh-points">
      <li>${svg('check', 16)}<span><b>Din dag</b>: vilka aktier som drog upp eller ner portföljen, och hur mycket valutan påverkade</span></li>
      <li>${svg('check', 16)}<span><b>Riskkoll för varje aktie</b> från 1 till 10, del för del</span></li>
      <li>${svg('check', 16)}<span><b>Din portfölj</b> med tidslinje, utdelningar och rapportdagar</span></li>
      <li>${svg('check', 16)}<span><b>Larm</b> när kursen rör sig, ledningen handlar eller blankningen ökar</span></li>
      <li>${svg('check', 16)}<span><b>Import</b> av dina affärer från Avanza och Nordnet</span></li>
    </ul>
  </section>`;

const minOversikt = () => (!!ACC.user && !locked()) || (locked() && getPort().length > 0);
function viewOversikt() {
  if (minOversikt()) return viewOversiktMin();
  return `
  ${topbar([['Översikt', '/']])}
  ${locked() ? visitorHero() : ''}
  <div class="ticker num" aria-label="Marknaden" id="ticker">
    ${MARKET.map((m) => `<span><span class="muted">${esc(m.namn)}</span><span data-q="${m.sym}">…</span></span>`).join('')}
  </div>
  <div class="stack" style="gap:6px">
    ${firstName() ? `<span class="greet-mobile">Välkommen tillbaka, ${esc(firstName())}</span>` : ''}
    <span class="eyebrow" id="market-status">Hämtar marknaden …</span>
    <h1 class="title">Börsen i dag</h1>
  </div>

  ${locked() ? '' : `<div id="koll"></div>`}

  <section class="watch-strip" aria-labelledby="mina-h">
    <div class="watch-head"><h2 class="label-up" id="mina-h" style="margin:0">${locked() ? 'Populära aktier' : 'Din bevakning'}</h2><a class="more small" href="${locked() ? '/aktier' : '/bevakning'}" data-link>Visa alla →</a></div>
    <div id="mine" class="watch-row">${getWatch().slice(0, 12).map(() => '<span class="watch-tile is-skel"></span>').join('') || ''}</div>
  </section>

  <section class="stack" style="gap:14px" aria-labelledby="nyh-h">
    <div class="section-head" style="align-items:center">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><h2 class="section" id="nyh-h">Senaste nyheterna</h2><span id="news-status"></span></div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div class="tabs" role="tablist" aria-label="Region">
          <button role="tab" data-oregion="se" aria-selected="true">Sverige</button>
          <button role="tab" data-oregion="world" aria-selected="false">Världen</button>
        </div>
        <a class="more" href="/nyheter" data-link>Alla nyheter →</a>
      </div>
    </div>
    <div id="frontnews">${loading('Hämtar dagens nyheter …')}</div>
  </section>

  <div class="grid g3" id="heroes">
    ${MARKET.slice(0, 3).map((m, i) => `
      <a class="card hero hero-link tilt glare ${i === 0 ? 'dark rings' : ''}" href="/bolag/${encodeURIComponent(m.sym)}" data-link><span class="glare-layer" aria-hidden="true"></span>
        <div style="display:flex;align-items:center;gap:12px">
          ${av(m.sym, m.kort || m.sym)}
          <div><div class="small muted">${esc(m.sub)}</div><div style="font-size:17px;font-weight:500">${esc(m.namn)}</div></div>
        </div>
        <div><div class="small muted">Senast, ${esc(m.enhet || 'USD')}</div><div class="big num" data-hero="${m.sym}">…</div></div>
        <div class="chips"><span class="pill" data-hero-d="${m.sym}">…</span></div>
      </a>`).join('')}
  </div>

  <div class="grid g2">
    <section class="card" aria-labelledby="insyn-o-h" style="padding:24px">
      <div class="section-head" style="margin-bottom:6px"><h2 class="section" id="insyn-o-h" style="font-size:22px">Insynshandel i veckan</h2><span class="small muted">Sverige</span></div>
      <div id="insyn-o">${loading('Hämtar från Finansinspektionen …')}</div>
    </section>
    <section class="card" aria-labelledby="blank-o-h" style="padding:24px">
      <div class="section-head" style="margin-bottom:6px"><h2 class="section" id="blank-o-h" style="font-size:22px">Mest blankade</h2><span class="small muted">Sverige</span></div>
      <div id="blank-o">${loading('Hämtar från Finansinspektionen …')}</div>
    </section>
  </div>

  <div>
    <div class="card dark rings stack" style="padding:24px;gap:14px">
      <div class="orb" aria-hidden="true"><div class="orb-tilt"><div class="orb-spin"><i></i><i></i><i></i></div><b></b></div></div>
      <span class="small muted">Bolag</span>
      <span style="font-size:28px;letter-spacing:-0.01em;line-height:1.2">Hur riskabel är aktien du funderar på?</span>
      <span class="muted" style="font-size:14.5px">Sök bland aktier och fonder och se svängningar, skulder, värdering och lönsamhet förklarat på enkel svenska.</span>
      <form class="searchbar" role="search" data-topsearch style="flex:none;max-width:none">
        ${svg('search', 18, '#6B6F76')}
        <label class="sr-only" for="heroq">Sök bolag eller ticker</label>
        <input id="heroq" name="q" type="search" placeholder="Till exempel Apple, Nvidia eller Volvo" autocomplete="off">
        <button class="btn small" type="submit">Sök</button>
      </form>
    </div>
  </div>
  ${footer('OMX Stockholm 30 visas i indexpoäng. Övriga marknader visas med börsfonder (ETF:er) som följer respektive index, priser i USD.')}`;
}

async function mountOversikt() {
  if (minOversikt()) return mountOversiktMin();
  // Nyheter: Sverige först, och finns inga svenska nyheter växlar vi till Världen
  let region = 'se';
  const tabs = $('[aria-labelledby="nyh-h"] .tabs');
  const setTab = (r) => tabs.querySelectorAll('[data-oregion]').forEach((x) => x.setAttribute('aria-selected', String(x.dataset.oregion === r)));
  const draw = async (auto) => {
    const r = region;
    const data = await getNews(r);
    if (r !== region || !$('#frontnews')) return;
    if (auto && r === 'se' && !data.items.length) { region = 'world'; setTab('world'); return draw(false); }
    $('#frontnews').innerHTML = frontNewsHTML(data, r);
    $('#news-status').innerHTML = data.ok && data.items.length ? liveTag(data.hamtad) : '';
  };
  tabs.addEventListener('click', (e) => {
    const b = e.target.closest('[data-oregion]'); if (!b) return;
    region = b.dataset.oregion; setTab(region);
    $('#frontnews').innerHTML = loading('Hämtar nyheter …');
    draw(false);
  });
  draw(true);

  // Finansinspektionen, parallellt med kurserna
  api('/api/insyn', 30 * 60e3).then((d) => { const b = $('#insyn-o'); if (b) b.innerHTML = insynOverviewHTML(d); });
  api('/api/blankning', 30 * 60e3).then((d) => { const b = $('#blank-o'); if (b) b.innerHTML = blankOverviewHTML(d); });

  // Marknaden och mina aktier i ett anrop
  const watch = getWatch().slice(0, 12);
  const quotes = await getQuotes([...new Set([...MARKET.map((m) => m.sym), ...watch, ...(ACC.user ? mySyms().all.slice(0, 30) : [])])]);
  if (ACC.user) drawKoll(quotes);
  if (!$('#ticker')) return;
  for (const m of MARKET) {
    const q = quotes[m.sym];
    const el = $(`[data-q="${m.sym}"]`);
    if (el) el.outerHTML = q?.kurs != null ? `<span>${kr(q.kurs)}</span><span class="small" style="color:var(--${tone(q.d1)})">${pct(q.d1)}</span>` : '<span class="faint">saknas</span>';
    const h = $(`[data-hero="${m.sym}"]`); if (h) { if (q?.kurs != null) { countUp(h, q.kurs, kr, 900); flash(h, q.d1); } else h.textContent = 'Saknas'; }
    const hd = $(`[data-hero-d="${m.sym}"]`); if (hd) { hd.className = 'pill ' + tone(q?.d1); hd.textContent = q?.d1 != null ? pct(q.d1) + ' i dag' : '–'; }
  }
  $('#market-status').innerHTML = quotes.__hamtad ? `<span style="display:inline-flex;align-items:center;gap:8px"><span class="dot"></span>Uppdaterad kl ${esc(clock(quotes.__hamtad))}</span>` : esc(errText(quotes.__error));
  const el = $('#mine'); if (!el) return;
  el.innerHTML = watch.length ? watch.map((s) => {
    const q = quotes[s];
    return `<a class="watch-tile" href="/bolag/${encodeURIComponent(s)}" data-link>
      <span class="watch-name">${av(s)}<b>${esc(nameOf(s))}</b></span>
      <span class="watch-nums"><span class="num">${q?.kurs != null ? esc(kr(q.kurs)) + ' <span class="small faint">' + esc(cur(q.valuta)) + '</span>' : '<span class="faint small">Kurs saknas</span>'}</span><span class="pill ${tone(q?.d1)}">${q?.d1 != null ? pct(q.d1, 1) : '–'}</span></span>
    </a>`;
  }).join('') : `<a class="watch-tile watch-empty" href="/sok" data-link>${svg('plus', 16)}<span>Du bevakar inga aktier än. Sök på ett bolag och tryck på <b>Bevaka</b>, så syns det här.</span></a>`;
}

/* ================= Översikt för inloggade: portfölj, bevakning, dagens koll och nyheter ================= */
const OV_MARKET = [{ sym: '^OMX', namn: 'OMXS30' }, { sym: '^GSPC', namn: 'S&P 500' }, { sym: '^IXIC', namn: 'Nasdaq' }, { sym: 'GC=F', namn: 'Guld' }];
// Kortare bolagsnamn på översikten, samma i alla kort: "AB Volvo (publ), B-aktie" blir "Volvo B"
const ovName = (s) => (DEFAULT_NAMES[s] || nameOf(s)).replace(/\s*\(publ\.?\)/i, '').replace(/^AB\s+/, '').replace(/\s+AB(?=,|$)/, '').replace(/,\s*ser\.\s*([A-Z])$/i, ' $1').replace(/,\s*([A-Z])-aktie$/i, ' $1').trim();
const pmSign = (n) => (n >= 0 ? '+' : '−');
const krDiff = (n) => (Math.abs(n) < 0.5 ? sekBig(0) : `${pmSign(n)}${sekBig(Math.abs(n))}`);
const pctDiff = (n) => { const r = Math.abs(n).toFixed(1); return `${Number(r) === 0 ? '' : pmSign(n)}${r.replace('.', EN ? '.' : ',')} %`; };
// Liten kurva som SVG-väg, för bevakningen
function sparkPath(pts, w = 56, h = 18) {
  const v = pts.map((p) => p[1]).filter((x) => x != null); if (v.length < 2) return '';
  const lo = Math.min(...v), hi = Math.max(...v);
  return v.map((y, i) => `${i ? 'L' : 'M'}${((i / (v.length - 1)) * w).toFixed(1)} ${(2 + (1 - (y - lo) / ((hi - lo) || 1)) * (h - 4)).toFixed(1)}`).join(' ');
}
// Litet diagram över portföljens värde, med insatta pengar som streckad linje
function miniMoney(V, I) {
  const W = 300, H = 84, P = 6; const all = [...V, ...I].map((p) => p[1]);
  const lo = Math.min(...all), hi = Math.max(...all); const pad = (hi - lo) * 0.08 || hi * 0.03 || 1;
  const t0 = V[0][0], t1 = V[V.length - 1][0];
  const X = (t) => ((t - t0) / ((t1 - t0) || 1)) * W; const Y = (v) => P + (1 - (v - (lo - pad)) / ((hi + pad) - (lo - pad))) * (H - P * 2);
  const path = (pts) => pts.map(([t, v], i) => `${i ? 'L' : 'M'}${X(t).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');
  const line = path(V);
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="ov-chart" role="img" aria-label="Diagram över portföljens värde">
    <path d="${line} L${W} ${H} L0 ${H} Z" fill="rgba(155,227,184,0.14)"></path>
    <path d="${path(I)}" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"></path>
    <path d="${line}" fill="none" stroke="#9BE3B8" stroke-width="1.8" stroke-linejoin="round" vector-effect="non-scaling-stroke"></path></svg>`;
}
function donut(rows) {
  const C = ['#E8EAED', '#3A8FD6', '#8FB3E3', '#E7B547', '#B48EE6', '#5B626D'];
  const tot = rows.reduce((a, x) => a + x[1], 0); if (!tot) return { svg: '', legend: '' };
  let ang = -Math.PI / 2; const P = (a, r) => `${(60 + r * Math.cos(a)).toFixed(2)} ${(60 + r * Math.sin(a)).toFixed(2)}`;
  const list = rows.length > 6 ? [...rows.slice(0, 5), [EN ? 'Other' : 'Övrigt', rows.slice(5).reduce((a, x) => a + x[1], 0)]] : rows;
  const parts = list.map(([name, v], i) => {
    const a0 = ang, a1 = ang + (v / tot) * Math.PI * 2; ang = a1;
    const d = list.length === 1 ? 'M60 4 A56 56 0 1 1 59.99 4 Z' : `M60 60 L${P(a0, 56)} A56 56 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${P(a1 - 0.0001, 56)} Z`;
    return { name, c: C[i % C.length], d, pct: Math.round((v / tot) * 100) };
  });
  return {
    svg: `<svg viewBox="0 0 120 120" class="ov-donut" aria-hidden="true">${parts.map((x) => `<path d="${x.d}" fill="${x.c}" stroke="var(--card)" stroke-width="1.5"></path>`).join('')}<circle cx="60" cy="60" r="34" fill="var(--card)"></circle></svg>`,
    legend: parts.map((x) => `<div class="ov-leg"><i style="background:${x.c}"></i><span>${esc(x.name)}</span><b class="num">${x.pct} %</b></div>`).join('')
  };
}
const newsRow = (n) => { const u = safeUrl(n.lank); return `
  <div class="ov-nrow">${flag(n.land)}
    <span class="grow"><span class="ov-ntitle">${newsTitle(n)}</span><span class="small muted num">${esc(n.tidTxt)}${n.bolagTxt ? ' · ' + esc(n.bolagTxt) : ''}</span></span>
    ${u ? `<a class="ov-src" href="${esc(u)}" target="_blank" rel="noopener noreferrer" aria-label="${esc((EN ? 'Read at ' : 'Läs hos ') + (n.kalla || ''))}">${esc(n.kalla || (EN ? 'Source' : 'Källa'))} ${svg('ext', 11)}</a>` : ''}
  </div>`; };

/* ================= Översikt: din portfölj som en cockpit =================
   Överst en mening om dagen och tre nyckeltal, sedan en stor kurva och vad som drev dagen,
   och under det det som är bra att hålla koll på, viktigaste nyheterna och risken.
   Allt räknas från riktiga kurser. Saknas något skrivs det ut. */
const N_TICK = [{ sym: '^OMX', namn: 'OMXS30' }, { sym: '^GSPC', namn: 'S&P 500' }, { sym: '^IXIC', namn: 'Nasdaq' }, { sym: '^GDAXI', namn: 'DAX' }, { sym: 'GC=F', namn: 'Guld' }, { sym: 'USDSEK=X', namn: 'USD/SEK' }];
const N_PER = [['1d', '1D'], ['1m', '1M'], ['6m', '6M'], ['1y', '1Å'], ['all', 'Allt']];
const nGreet = () => { const h = Number(new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', hour12: false, timeZone: 'Europe/Stockholm' })); const n = firstName();
  const g = EN ? (h < 10 ? 'Good morning' : h < 18 ? 'Hello' : 'Good evening') : (h < 10 ? 'God morgon' : h < 18 ? 'Hej' : 'God kväll');
  return n ? `${g}, ${n}` : (EN ? 'Overview' : 'Översikt'); };
const nTopic = (n) => ({ Vinstvarning: 'var(--down)', Rapport: 'var(--info)', Affär: 'var(--up)', Utdelning: 'var(--up)', Ledning: 'var(--warn)', Analys: 'var(--b-ma200)' }[n.amne] || 'var(--line)');

function viewOversiktMin() {
  return `
  ${topbar([['Översikt', '/']])}
  <div class="n-head">
    <div class="n-hl"><h1>${esc(nGreet())}${locked() && isDemo() ? ' <span class="pill outline ov-expill">Exempel</span>' : ''}</h1><span class="small muted" id="market-status">${EN ? 'Fetching the market …' : 'Hämtar marknaden …'}</span></div>
    <div class="n-bors" id="n-bors">${['VOLV-B.ST', 'AAPL'].map((s) => { const b = borsStatus(s); return `<span class="n-pill ${b.kod}"><i></i>${esc(b.bors)} · ${esc(b.txt)}</span>`; }).join('')}</div>
  </div>
  <div class="n-ticker" id="ov-market" aria-label="${EN ? 'Markets' : 'Marknaden'}"><div class="n-track">${[0, 1].map((k) => N_TICK.map((m) => `<span class="n-tk" ${k ? 'aria-hidden="true"' : ''}><span class="muted">${esc(m.namn)}</span><b class="num" data-q="${m.sym}">…</b><span class="num small" data-qd="${m.sym}"></span><svg viewBox="0 0 56 18" class="n-spark" aria-hidden="true"><path data-qs="${m.sym}" d="" fill="none" stroke-width="1.4"></path></svg></span>`).join('')).join('')}</div></div>
  ${guestBar()}
  <div class="n-kpis">
    <section class="n-story" id="n-story"><span class="muted">${EN ? 'Calculating your portfolio …' : 'Räknar på din portfölj …'}</span></section>
    <section class="b-card n-kpi"><span class="n-k">${EN ? 'Value now' : 'Värde nu'}</span><b class="num" id="k-tot">–</b><span class="small faint" id="k-tot-s"></span></section>
    <section class="b-card n-kpi"><span class="n-k" id="k-day-l">${EN ? 'Today' : 'I dag'}</span><b class="num" id="k-day">–</b><span class="small num" id="k-day-s"></span></section>
    <section class="b-card n-kpi"><span class="n-k">${EN ? 'Since purchase' : 'Sedan köp'}</span><b class="num" id="k-since">–</b><span class="small num" id="k-since-s"></span></section>
  </div>
  <div class="b-grid n-grid">
    <section class="b-card c8 n-curve"><div class="b-ch"><div class="b-chl"><h2 class="b-lbl">${EN ? 'The portfolio' : 'Portföljen'}</h2><span class="small" id="n-chg"></span></div>
      <div class="b-segc" role="tablist" aria-label="Period">${N_PER.map(([k, l]) => `<button type="button" role="tab" data-nper="${k}" aria-selected="${k === '1d'}">${l}</button>`).join('')}</div></div>
      <div id="n-chart" class="n-chart">${loading('Hämtar kurser …')}</div><div class="b-xt num" id="n-axis"></div></section>
    <section class="b-card c4"><div class="b-ch"><h2 class="b-lbl">Vad drev dagen</h2><span class="small faint" id="n-drv-s"></span></div><div id="n-drv">${loading()}</div></section>
    <section class="b-card c4"><div class="b-ch"><h2 class="b-lbl">Att hålla koll på</h2><a class="b-more" href="/portfolj?flik=kalender" data-link>Kalender →</a></div><div id="n-todo">${loading()}</div></section>
    <section class="b-card c4"><div class="b-ch"><h2 class="b-lbl">Viktigast för dig</h2><a class="b-more" href="/nyheter" data-link>Alla nyheter →</a></div><div id="n-news">${loading('Hämtar nyheter …')}</div></section>
    <section class="b-card c4"><div class="b-ch"><h2 class="b-lbl">Riskläge${tip('Riskkoll')}</h2><a class="b-more" href="/portfolj" data-link>Detaljer →</a></div><div id="n-risk">${loading()}</div></section>
  </div>
  ${footer()}`;
}

async function mountOversiktMin() {
  const port = getPort(); const watch = getWatch().slice(0, 8);
  const { all } = mySyms();
  const quotes = await getQuotes([...new Set([...N_TICK.map((m) => m.sym), ...watch, ...all.slice(0, 30)])]);
  if (!$('#ov-market')) return;
  /* ---- Marknaden ---- */
  for (const m of N_TICK) {
    const q = quotes[m.sym];
    document.querySelectorAll(`[data-q="${CSS.escape(m.sym)}"]`).forEach((el) => { el.textContent = q?.kurs != null ? kr(q.kurs) + (m.sym === 'GC=F' && q.valuta ? ' ' + cur(q.valuta) : '') : (EN ? 'missing' : 'saknas'); if (q?.kurs == null) el.classList.add('faint'); });
    document.querySelectorAll(`[data-qd="${CSS.escape(m.sym)}"]`).forEach((el) => { el.textContent = q?.d1 != null ? pct(q.d1) : ''; el.style.color = `var(--${tone(q?.d1) || 'muted'})`; });
  }
  Promise.all(N_TICK.map((m) => api(`/api/chart?s=${encodeURIComponent(m.sym)}&r=1m`, 30 * 60e3).catch(() => null))).then((cs) => N_TICK.forEach((m, i) => {
    const d = sparkPath(cs[i]?.punkter || []); const q = quotes[m.sym];
    document.querySelectorAll(`[data-qs="${CSS.escape(m.sym)}"]`).forEach((p) => { p.setAttribute('d', d); p.setAttribute('stroke', `var(--${q?.d1 != null && q.d1 < 0 ? 'down' : 'up'})`); });
  }));
  $('#market-status').textContent = quotes.__hamtad ? `${new Date().toLocaleDateString(L, { weekday: 'long', day: 'numeric', month: 'long' })} · ${EN ? 'updated' : 'uppdaterad'} ${clock(quotes.__hamtad)}` : errText(quotes.__error);

  // Nyheter, kalender och insyn hämtas parallellt med portföljen
  const newsP = all.length ? getMyNews().catch(() => ({ ok: false, items: [] })) : Promise.resolve({ ok: true, items: [] });
  nTodo(all, port);
  nNews(newsP, all);

  /* ---- Portföljen ---- */
  const story = $('#n-story');
  if (!port.length) {
    story.innerHTML = `<span>${EN ? 'Add your purchases and see here how your stocks move every day.' : 'Lägg in dina köp så ser du här hur dina aktier rör sig varje dag.'}</span><span class="chips"><a class="btn small" href="/portfolj" data-link>${EN ? 'Add a purchase' : 'Lägg till ett köp'}</a>${locked() ? demoBtn() : ''}</span>`;
    $('#n-chart').innerHTML = `<p class="b-note">${EN ? 'The chart shows the value of your portfolio when you have added purchases.' : 'Kurvan visar värdet på din portfölj när du har lagt in köp.'}</p>`;
    $('#n-drv').innerHTML = `<p class="b-note">${EN ? 'Shows which of your stocks moved the most today.' : 'Här ser du vilka av dina aktier som rörde sig mest i dag.'}</p>`;
    $('#n-risk').innerHTML = `<p class="b-note">${EN ? 'Shows the risk in your whole portfolio when you have added purchases.' : 'Här ser du risken i hela portföljen när du har lagt in köp.'}</p>`;
    return;
  }
  let pd;
  try { pd = await pfData(port); } catch { pd = null; }
  if (!$('#n-story')) return;
  if (!pd) { story.innerHTML = `<span>${EN ? 'The prices could not be fetched right now. Try again in a while.' : 'Kurserna kunde inte hämtas just nu. Prova igen om en stund.'}</span>`; return; }
  const m = { items: pd.hold, fx: pd.fxD, dag: pd.refDag, live: pd.dagIdag, ...pd.day };
  const items = pd.hold; const missing = items.filter((h) => h.missing);
  const allMissing = items.length && missing.length === items.length;
  // Nyckeltal
  $('#k-tot').textContent = pd.tot ? sekBig(pd.tot) : '–';
  $('#k-tot-s').textContent = missing.length ? (EN ? `${missing.length} without price` : `${missing.length} utan kurs`) : `${items.length} ${EN ? (items.length === 1 ? 'holding' : 'holdings') : 'innehav'}`;
  $('#k-day-l').textContent = pd.dagIdag || !pd.refDag ? (EN ? 'Today' : 'I dag') : dayShort(pd.refDag + 'T12:00:00');
  const chg = pd.day.change;
  if (allMissing || !pd.refDag) { $('#k-day').textContent = '–'; $('#k-day-s').textContent = EN ? 'Prices missing' : 'Kurser saknas'; }
  else { $('#k-day').textContent = Math.round(chg) ? krDiff(chg) : '0 kr'; $('#k-day').className = 'num ' + tone(chg); $('#k-day-s').textContent = pd.day.pct != null ? pctDiff(pd.day.pct) : ''; $('#k-day-s').className = 'small num ' + tone(chg); }
  if (pd.vinst != null) { $('#k-since').textContent = krDiff(pd.vinst); $('#k-since').className = 'num ' + tone(pd.vinst); $('#k-since-s').textContent = pd.insatt ? pctDiff((pd.vinst / pd.insatt) * 100) + (pd.okanda ? ` · ${pd.okanda} ${EN ? 'without price paid' : 'utan köppris'}` : '') : ''; $('#k-since-s').className = 'small num ' + tone(pd.vinst); }
  else $('#k-since-s').textContent = EN ? 'Add the price you paid' : 'Lägg in vad du betalade';

  // Raderna: aktierna och valutan, hela kronor som summerar exakt till dagens resultat (som på Din dag)
  const stocks = items.filter((h) => h.idag != null && !h.missing);
  const fxRows = Object.entries(pd.day.fxEff || {}).map(([c, v]) => ({ fx: c, idag: v, pct: pd.fxD[c] ? (pd.fxD[c].F1 / pd.fxD[c].F0 - 1) * 100 : null }));
  const rows = [...stocks, ...fxRows].sort((a, b) => b.idag - a.idag);
  { const target = Math.round(chg); const fl = rows.map((x) => Math.floor(x.idag)); let left = target - fl.reduce((a, v) => a + v, 0);
    const order = rows.map((x, i) => [x.idag - Math.floor(x.idag), i]).sort((a, b) => b[0] - a[0]);
    rows.forEach((x, i) => { x.kr = fl[i]; }); for (const [, i] of order) { if (left <= 0) break; rows[i].kr += 1; left -= 1; } }
  const up = stocks.filter((h) => h.idag > 0).sort((a, b) => b.idag - a.idag); const down = stocks.filter((h) => h.idag < 0).sort((a, b) => a.idag - b.idag);
  const omx = quotes['^OMX'];
  const why = [up[0] ? `${EN ? 'Biggest lift' : 'Mest upp'}: ${ovName(up[0].sym)} ${krDiff(up[0].kr)}` : '', down[0] ? `${EN ? 'Biggest drag' : 'Mest ner'}: ${ovName(down[0].sym)} ${krDiff(down[0].kr)}` : '', omx?.d1 != null && omx.idag ? `OMXS30 ${pct(omx.d1)}` : ''].filter(Boolean).join(' · ');
  // Meningen överst
  const dayTxt = pd.dagIdag ? (EN ? 'Today your stocks have moved' : 'I dag har dina aktier gått') : (EN ? `On the last trading day (${dayShort(pd.refDag + 'T12:00:00')}) your stocks moved` : `Senaste börsdagen (${dayShort(pd.refDag + 'T12:00:00')}) gick dina aktier`);
  story.innerHTML = allMissing || !pd.refDag ? `<span>${EN ? 'The prices could not be fetched right now, so your day cannot be calculated.' : 'Kurserna kunde inte hämtas just nu, så din dag kan inte räknas ut.'}</span>`
    : `<span class="n-say">${esc(dayTxt)} <b class="${tone(chg)}">${Math.round(chg) ? krDiff(chg) : '0 kr'}</b>${pd.day.pct != null ? ` <span class="${tone(chg)} n-sayp">(${pctDiff(pd.day.pct)})</span>` : ''}</span>${why ? `<span class="small muted">${esc(why)}</span>` : ''}${missing.length ? `<span class="small warn">${EN ? `${missing.length} of your stocks could not be fetched and are not included.` : `${missing.length} av dina aktier kunde inte hämtas och räknas inte med.`}</span>` : ''}`;

  /* ---- Vad drev dagen ---- */
  const maxAbs = Math.max(1, ...rows.map((h) => Math.abs(h.idag)));
  const notYet = items.filter((h) => h.idag == null && !h.missing);
  let selSym = null;
  const drawDrv = () => {
    const el = $('#n-drv'); if (!el) return;
    if (allMissing) { el.innerHTML = `<p class="b-note">${EN ? 'Prices are missing right now.' : 'Kurserna saknas just nu.'}</p>`; return; }
    $('#n-drv-s').textContent = EN ? 'in kronor' : 'i kronor';
    const row = (h) => { const w = (Math.abs(h.idag) / maxAbs) * 50; const t = tone(h.idag);
      if (h.fx) return `<div class="n-drow"><span class="n-av">${esc(h.fx)}</span><span class="n-dn"><span>${EN ? `Currency ${esc(h.fx)}/SEK` : `Valutan ${esc(h.fx)}/SEK`} <span class="${t}">${h.pct != null ? pct(h.pct, Math.abs(h.pct) < 0.1 ? 2 : 1) : ''}</span></span><span class="n-bar"><i class="z"></i><i class="${t}" style="left:${h.idag >= 0 ? 50 : 50 - w}%;width:${w}%"></i></span></span><b class="num ${t}">${krDiff(h.kr)}</b></div>`;
      return `<button type="button" class="n-drow ${selSym === h.sym ? 'on' : ''}" data-nsel="${esc(h.sym)}"><span class="n-av">${esc(short(h.sym))}${symFlag(h.sym, 'on-avatar')}</span><span class="n-dn"><span>${esc(ovName(h.sym))} <span class="${t}">${h.d1Dag != null ? pct(h.d1Dag, 1) : ''}</span></span><span class="n-bar"><i class="z"></i><i class="${t}" style="left:${h.idag >= 0 ? 50 : 50 - w}%;width:${w}%"></i></span></span><b class="num ${t}">${krDiff(h.kr)}</b></button>`; };
    const sel = selSym ? items.find((h) => h.sym === selSym) : null;
    el.innerHTML = (rows.length ? rows.slice(0, 7).map(row).join('') : `<p class="b-note">${EN ? 'None of your stocks have traded yet.' : 'Ingen av dina aktier har handlats än.'}</p>`)
      + (rows.length > 7 ? `<a class="b-more" href="/portfolj?flik=dagen" data-link>${EN ? `All ${rows.length} in Your portfolio →` : `Alla ${rows.length} under Dagen →`}</a>` : '')
      + (notYet.length ? `<p class="b-src">${EN ? 'Not traded yet' : 'Inte handlade än'}: ${esc(notYet.map((h) => ovName(h.sym)).join(', '))}</p>` : '')
      + (sel ? `<div class="n-sel"><span><span class="n-k">${EN ? 'Value' : 'Värde'}</span><b class="num">${sel.varde != null ? sekBig(sel.varde) : '–'}</b></span><span><span class="n-k">${EN ? 'Since purchase' : 'Sedan köp'}</span><b class="num ${tone(sel.vinst)}">${sel.vinst != null && sel.insatt ? pctDiff((sel.vinst / sel.insatt) * 100) : '–'}</b></span><span><span class="n-k">${EN ? 'Risk check' : 'Riskkoll'}</span><b class="num">${sel.poang != null ? sel.poang + ' / 10' : '–'}</b></span><a class="b-more" href="/bolag/${encodeURIComponent(sel.sym)}" data-link>${EN ? 'Company page' : 'Bolagssidan'} →</a></div>` : '')
      + (!sel && stocks.length ? `<p class="b-src">${EN ? 'Tap a stock to see more.' : 'Tryck på en aktie för att se mer.'}</p>` : '');
  };
  drawDrv();
  $('#n-drv').addEventListener('click', (e) => { const b = e.target.closest('[data-nsel]'); if (!b) return; selSym = selSym === b.dataset.nsel ? null : b.dataset.nsel; drawDrv(); });

  /* ---- Kurvan ---- */
  let per = '1d'; let ser = null; let curve = null; let news = [];
  const chartEl = () => $('#n-chart');
  const msg = (t) => { const el = chartEl(); if (el) el.innerHTML = `<p class="b-note">${esc(t)}</p>`; $('#n-axis').innerHTML = ''; $('#n-chg').textContent = ''; };
  const draw = () => {
    const el = chartEl(); if (!el) return;
    if (per === '1d') {
      if (!curve) { el.innerHTML = loading(EN ? 'Loading the day …' : 'Hämtar dagens kurser …'); return; }
      if (curve.error) { const T = { old: ['', ''], fetch: ['The prices for the curve could not be fetched right now. The numbers above are still correct.', 'Kurserna för kurvan kunde inte hämtas just nu. Siffrorna ovan stämmer ändå.'], none: ['None of your stocks have traded yet, so there is no curve to show.', 'Ingen av dina aktier har handlats än, så det finns ingen kurva att visa.'], live: ['The curve appears when there are prices from today for all your stocks.', 'Kurvan visas när det finns kurser från i dag för alla dina aktier.'], partial: ['Prices every five minutes are missing for some of your stocks, so the curve cannot be shown. The numbers above are still correct.', 'Kurser var femte minut saknas för några av dina aktier, så kurvan kan inte visas. Siffrorna ovan stämmer ändå.'] }[curve.error] || ['The curve cannot be shown right now.', 'Kurvan kan inte visas just nu.']; msg(EN ? T[0] : T[1]); return; }
      const pts = curve.pts; const t0 = pts[0][0]; const t1 = pts[pts.length - 1][0];
      const dots = []; for (const nn of news.slice().sort((a, b) => b.poang - a.poang)) { const t = new Date(nn.datum).getTime() / 1000; if (t < t0 || t > t1) continue; if (dots.some((d) => Math.abs(new Date(d.datum).getTime() / 1000 - t) < (t1 - t0) * 0.03)) continue; dots.push(nn); if (dots.length === 6) break; }
      nDraw(el, pts, { base: 0, money: false, dots });
      const last = pts[pts.length - 1][1];
      $('#n-chg').innerHTML = `<span class="${tone(last)}">${krDiff(last)}</span> <span class="faint">${pd.dagIdag ? (EN ? 'today' : 'i dag') : esc(dayShort(pd.refDag + 'T12:00:00'))}</span>`;
      const hm = (t) => new Date(t * 1000).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' });
      $('#n-axis').innerHTML = `<span>${hm(t0)}</span><span>${dots.length ? (EN ? 'Dots = news about your stocks' : 'Prickarna är nyheter om dina aktier') : (EN ? 'Dashed line = start of the day' : 'Streckad linje = början av dagen')}</span><span>${hm(t1)}</span>`;
      return;
    }
    if (!ser) { el.innerHTML = loading(EN ? 'Loading the history …' : 'Hämtar historiken …'); return; }
    if (ser.error) { msg(ser.error === 'nobuys' ? (EN ? 'The chart needs purchases with a date.' : 'Kurvan kräver köp med datum.') : ser.error === 'fetch' ? (EN ? 'The prices for the chart could not be fetched right now. Try again in a while.' : 'Kurserna för kurvan kunde inte hämtas just nu. Prova igen om en stund.') : (EN ? 'The chart appears when there are at least two days of prices.' : 'Kurvan visas när det finns minst två dagars kurser.')); return; }
    const V = rangeCut(ser.value, per, ser.tNow); const I = rangeCut(ser.invested, per, ser.tNow);
    if (V.length < 2) { msg(EN ? 'Too few days in the period.' : 'För få dagar i perioden.'); return; }
    nDraw(el, V, { invested: I, money: true });
    // Förändringen i perioden räknas som värdeökning minus pengar som satts in under perioden
    const dv = V[V.length - 1][1] - V[0][1]; const di = I[I.length - 1][1] - I[0][1]; const g = dv - di;
    $('#n-chg').innerHTML = `<span class="${tone(g)}">${krDiff(g)}</span> <span class="faint">${EN ? 'in the period' : 'under perioden'}${di > 0.5 ? (EN ? `, not counting ${sekBig(di)} added` : `, utan ${sekBig(di)} som satts in`) : ''}</span>`;
    const d = (t) => new Date(t * 1000).toLocaleDateString(L, { day: 'numeric', month: 'short', year: per === '1m' ? undefined : 'numeric', timeZone: 'Europe/Stockholm' });
    $('#n-axis').innerHTML = `<span>${esc(d(V[0][0]))}</span><span>${EN ? 'Dashed line = money you put in' : 'Streckad linje = pengar du satt in'}</span><span>${esc(d(V[V.length - 1][0]))}</span>`;
  };
  $('.n-curve').addEventListener('click', (e) => {
    const b = e.target.closest('[data-nper]'); if (!b) return;
    per = b.dataset.nper; $('.n-curve').querySelectorAll('[data-nper]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    if (per !== '1d' && !ser) pfSeries(pd).then((x) => { ser = x; draw(); }).catch(() => { ser = { error: 'fetch' }; draw(); });
    draw();
  });
  if (allMissing) msg(EN ? 'The prices could not be fetched right now.' : 'Kurserna kunde inte hämtas just nu.');
  else {
    draw();
    newsP.then((d) => { news = (d.items || []).filter((n) => n.agd); if (curve && !curve.error && per === '1d') draw(); });
    dayCurve(m).then((c) => { curve = c; if (per === '1d') draw(); }).catch(() => { curve = { error: 'fetch' }; if (per === '1d') draw(); });
  }

  /* ---- Riskläge ---- */
  nRisk(pd);
}

// Kurvan: en linje med yta, streckad nivå (början av dagen eller insatta pengar), nyhetsprickar och värde när man håller över
function nDraw(el, pts, { base = null, invested = null, money = false, dots = [] }) {
  const W = 1000, H = 210;
  const t0 = pts[0][0], t1 = pts[pts.length - 1][0];
  const vals = [...pts.map((p) => p[1]), ...(invested || []).map((p) => p[1]), ...(base != null ? [base] : [])];
  let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo) * 0.1 || Math.abs(hi) * 0.02 || 10; lo -= pad; hi += pad;
  const X = (t) => ((t - t0) / ((t1 - t0) || 1)) * W; const Y = (v) => (1 - (v - lo) / (hi - lo)) * H;
  const path = (a) => a.map(([t, v], i) => `${i ? 'L' : 'M'}${X(t).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1][1]; const ref = base != null ? base : invested?.length ? invested[invested.length - 1][1] : pts[0][1];
  const col = last >= ref ? 'var(--up)' : 'var(--down)';
  const valAt = (t) => { let v = pts[0][1]; for (const p of pts) { if (p[0] <= t) v = p[1]; else break; } return v; };
  el.innerHTML = `<div class="b-chart n-plot" style="--h:${H}px">
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${EN ? 'Portfolio chart' : 'Portföljens kurva'}">
      <defs><linearGradient id="ng" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity="0.26"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
      ${base != null ? `<line x1="0" x2="${W}" y1="${Y(base).toFixed(1)}" y2="${Y(base).toFixed(1)}" stroke="var(--muted)" stroke-dasharray="5 5" vector-effect="non-scaling-stroke"/>` : ''}
      ${invested?.length > 1 ? `<path d="${path(invested)}" fill="none" stroke="var(--muted)" stroke-dasharray="5 5" stroke-width="1" vector-effect="non-scaling-stroke"/>` : ''}
      <path d="${path(pts)} L${W} ${H} L0 ${H} Z" fill="url(#ng)"/>
      <path class="n-line" d="${path(pts)}" fill="none" stroke="${col}" stroke-width="2.2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    </svg>
    ${dots.map((n, i) => { const t = new Date(n.datum).getTime() / 1000; return `<button type="button" class="n-dot" data-ndot="${i}" style="left:${(X(t) / W * 100).toFixed(2)}%;top:${(Y(valAt(t)) / H * 100).toFixed(2)}%;--c:${nTopic(n)}" aria-label="${esc(n.rubrik || '')}"></button>`; }).join('')}
    <div class="n-pop" hidden></div>
    <span class="chart-cross" hidden></span><span class="chart-dot" hidden style="background:${col}"></span><div class="chart-tip" hidden></div>
  </div>`;
  const plot = el.querySelector('.n-plot'); const tipEl = plot.querySelector('.chart-tip'); const cross = plot.querySelector('.chart-cross'); const dot = plot.querySelector('.chart-dot'); const pop = plot.querySelector('.n-pop');
  const showPop = (i) => { const n = dots[i]; if (!n) return; const u = safeUrl(n.lank); const b = plot.querySelector(`[data-ndot="${i}"]`);
    pop.innerHTML = `<span class="small muted num">${esc(clock(n.datum))} · ${esc(ovName(n.min || ''))}${n.amne ? ' · ' + esc(n.amne) : ''}</span><b>${esc(n.rubrik || '')}</b>${u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(n.kalla || (EN ? 'Read' : 'Läs'))} ↗</a>` : ''}`;
    pop.hidden = false; const x = b.offsetLeft; pop.style.left = Math.min(plot.clientWidth - 280, Math.max(0, x - 140)) + 'px'; };
  plot.addEventListener('click', (e) => { const b = e.target.closest('[data-ndot]'); if (b) { showPop(Number(b.dataset.ndot)); return; } if (!e.target.closest('.n-pop')) pop.hidden = true; });
  let fr = 0; let lx = 0;
  const move = () => { fr = 0; const r = plot.getBoundingClientRect(); const fx = Math.min(1, Math.max(0, (lx - r.left) / r.width)); const t = t0 + fx * (t1 - t0);
    let k = 0; for (let i = 0; i < pts.length; i++) if (Math.abs(pts[i][0] - t) < Math.abs(pts[k][0] - t)) k = i;
    const px = (X(pts[k][0]) / W) * r.width; const py = (Y(pts[k][1]) / H) * r.height;
    cross.hidden = false; cross.style.transform = `translateX(${px}px)`; dot.hidden = false; dot.style.transform = `translate(${px}px, ${py}px)`;
    const when = money ? new Date(pts[k][0] * 1000).toLocaleDateString(L, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Stockholm' }) : new Date(pts[k][0] * 1000).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' });
    const inv = invested ? (() => { let v = null; for (const p of invested) { if (p[0] <= pts[k][0]) v = p[1]; else break; } return v; })() : null;
    tipEl.hidden = false; tipEl.innerHTML = `<span class="small muted">${esc(when)}</span><b class="num">${money ? sekBig(pts[k][1]) : krDiff(pts[k][1])}</b>${inv != null ? `<span class="small muted num">${EN ? 'Put in' : 'Insatt'} ${sekBig(inv)}</span>` : ''}`;
    const tw = tipEl.offsetWidth; tipEl.style.transform = `translateX(${Math.min(r.width - tw, Math.max(0, px - tw / 2))}px)`; };
  plot.addEventListener('pointermove', (e) => { if (e.target.closest('.n-dot,.n-pop')) return; lx = e.clientX; if (!fr) fr = requestAnimationFrame(move); });
  plot.addEventListener('pointerleave', () => { tipEl.hidden = true; cross.hidden = true; dot.hidden = true; });
}

// Att hålla koll på: rapporter och utdelningsdagar de närmaste tre veckorna, och ledningens affärer i dina svenska bolag
async function nTodo(all, port) {
  const el = $('#n-todo'); if (!el) return;
  if (!all.length) { el.innerHTML = `<p class="b-note">${EN ? 'Watch some stocks or add your purchases, and their reports and dividends will show up here.' : 'Bevaka några aktier eller lägg in dina köp, så visas deras rapporter och utdelningar här.'}</p>`; return; }
  const owned = new Set(port.map((x) => x.sym)); const since = isoDay(Date.now() - 7 * dayMs);
  const se = all.filter(isSwedish).slice(0, 8);
  const [kal, fi] = await Promise.all([getKalender(all).catch(() => null), Promise.all(se.map((s) => getFI(s).catch(() => null)))]);
  if (!$('#n-todo')) return;
  const evAll = kal ? events(kal, 0, 21) : []; const ev = [...evAll.filter((e) => owned.has(e.k.sym)), ...evAll.filter((e) => !owned.has(e.k.sym))].slice(0, 4).sort((a, b) => a.dag.localeCompare(b.dag));
  const trades = fi.flatMap((f, i) => (f?.affarer || []).filter((a) => String(a.datum) >= since && (a.typ === 'Köp' || a.typ === 'Sälj')).map((a) => ({ ...a, sym: se[i] })))
    .sort((a, b) => (b.varde || 0) - (a.varde || 0)).slice(0, Math.max(1, 5 - ev.length));
  const rowEv = (e) => { const d = new Date(e.dag + 'T12:00:00'); const nm = ovName(e.k.sym);
    const t = e.typ === 'rapport' ? (EN ? `${nm} reports` : `${nm} lämnar rapport`) : e.typ === 'ex' ? (EN ? `${nm} ex-dividend date` : `${nm} x-dag`) : (EN ? `${nm} pays dividend` : `${nm} betalar utdelning`);
    const sub = [whenTxt(e.dag), owned.has(e.k.sym) ? (EN ? 'you own it' : 'du äger') : (EN ? 'watched' : 'bevakad'), e.typ !== 'rapport' && e.k.utdelningPerAktie ? `${bn(e.k.utdelningPerAktie, 2)} ${cur(e.k.valuta)} ${EN ? 'per share' : 'per aktie'}` : '', e.typ === 'rapport' && e.k.rapportUppskattad ? (EN ? 'preliminary' : 'preliminärt') : ''].filter(Boolean).join(' · ');
    return `<a class="n-todo" href="/bolag/${encodeURIComponent(e.k.sym)}${e.typ === 'rapport' ? '?flik=rapporter' : '?flik=kalender'}" data-link><span class="n-date"><span>${esc(bMon(d.getMonth()))}</span><b class="num">${d.getDate()}</b></span><span class="n-tt"><b>${esc(t)}</b><span>${esc(sub)}</span></span><span class="pill ${e.typ === 'rapport' ? 'info' : 'up'}">${e.typ === 'rapport' ? 'Rapport' : 'Utdelning'}</span></a>`; };
  const rowTr = (a) => { const d = new Date(a.datum + 'T12:00:00');
    return `<a class="n-todo" href="/bolag/${encodeURIComponent(a.sym)}?flik=insyn" data-link><span class="n-date"><span>${esc(bMon(d.getMonth()))}</span><b class="num">${d.getDate()}</b></span><span class="n-tt"><b>${esc(EN ? `${a.typ === 'Köp' ? 'Insider bought' : 'Insider sold'} in ${ovName(a.sym)}` : `Ledningen ${a.typ === 'Köp' ? 'köpte' : 'sålde'} i ${ovName(a.sym)}`)}</b><span>${esc([a.person, a.roll, a.varde != null ? mny(a.varde, a.valuta || 'SEK') : ''].filter(Boolean).join(' · '))}</span></span>${tradePill(a.typ)}</a>`; };
  const html = ev.map(rowEv).join('') + trades.map(rowTr).join('');
  el.innerHTML = html || `<p class="b-note">${!kal ? (EN ? 'The calendar could not be fetched right now.' : 'Kalendern kunde inte hämtas just nu.') : (EN ? 'No reports, dividends or insider trades in your stocks the next three weeks.' : 'Inga rapporter, utdelningar eller insynsaffärer i dina aktier de närmaste tre veckorna.')}</p>`;
  if (html && !kal) el.insertAdjacentHTML('beforeend', `<p class="b-src">${EN ? 'Reports and dividends could not be fetched right now.' : 'Rapporter och utdelningar kunde inte hämtas just nu.'}</p>`);
}

// Viktigast för dig: nyheter om dina aktier, sorterade efter vikt
async function nNews(newsP, all) {
  const el = $('#n-news'); if (!el) return;
  let items = [];
  if (all.length) { const d = await newsP; if (!$('#n-news')) return; if (d.ok === false && !d.items.length) { el.innerHTML = `<p class="b-note">${EN ? 'The news could not be fetched right now.' : 'Nyheterna kunde inte hämtas just nu.'}</p>`; return; } items = d.items.slice().sort((a, b) => b.poang - a.poang); }
  else { const se = await getNews('se'); if (!$('#n-news')) return; items = se.items.length ? se.items : (await getNews('world')).items; }
  if (!items.length) { el.innerHTML = `<p class="b-note">${EN ? 'No news about your stocks in the last two weeks.' : 'Inga nyheter om dina aktier de senaste två veckorna.'}</p>`; return; }
  el.innerHTML = items.slice(0, 5).map((n) => `<div class="n-nrow"><span class="n-nc" style="background:${nTopic(n)}"></span><span class="n-nt"><span class="n-ntitle">${newsTitle(n)}</span><span class="small muted num">${esc(n.tidTxt)}${n.amne ? ' · ' + esc(n.amne) : ''}${n.min ? ' · ' + esc(ovName(n.min)) : n.bolagTxt ? ' · ' + esc(n.bolagTxt) : ''}</span></span></div>`).join('');
}

// Riskläge: snittet av riskkollen vägt efter värde, hur pengarna är fördelade och det som är värt att tänka på
function nRisk(pd) {
  const el = $('#n-risk'); if (!el) return;
  const { hold, tot, risk } = pd;
  const hv = hold.filter((h) => h.varde).sort((a, b) => b.varde - a.varde);
  if (!hv.length || !tot) { el.innerHTML = `<p class="b-note">${EN ? 'Prices are missing, so the risk cannot be calculated right now.' : 'Kurserna saknas, så risken kan inte räknas just nu.'}</p>`; return; }
  const lv = risk != null ? lvlOf(Math.round(risk)) : null;
  const frac = risk != null ? Math.min(1, Math.max(0, risk / 10)) : 0; const C = 2 * Math.PI * 46;
  const flags = [];
  const top = hv[0]; const n = hv.length;
  if (n > 1 && top.varde / tot > 0.25) flags.push(['warn', `${ovName(top.sym)} är ${nf((top.varde / tot) * 100, 0)} % av portföljen. Faller den aktien märks det mycket på helheten.`]);
  const br = {}; for (const h of hv) br[h.bransch] = (br[h.bransch] || 0) + h.varde; const b0 = Object.entries(br).sort((a, b) => b[1] - a[1])[0];
  if (n > 1 && b0 && b0[1] / tot > 0.5) flags.push(['warn', `${nf((b0[1] / tot) * 100, 0)} % ligger i ${b0[0].toLowerCase()}. Går det dåligt för branschen påverkas en stor del av dina pengar samtidigt.`]);
  const hog = hv.filter((h) => h.poang != null && h.poang >= 7).reduce((a, h) => a + h.varde, 0);
  if (hog / tot > 0.3) flags.push(['warn', `${nf((hog / tot) * 100, 0)} % av pengarna ligger i aktier med hög riskkoll (7 eller mer).`]);
  if (!flags.length) flags.push(['ok', 'Bra spridning: inget enskilt bolag eller bransch dominerar portföljen.']);
  el.innerHTML = `<div class="n-rk"><svg viewBox="0 0 110 110" class="n-ring" role="img" aria-label="${EN ? 'Risk check' : 'Riskkoll'} ${risk != null ? nf(risk, 1) : '–'} ${EN ? 'of 10' : 'av 10'}"><circle cx="55" cy="55" r="46" fill="none" stroke="var(--line-soft)" stroke-width="9"/><circle class="n-ringv" cx="55" cy="55" r="46" fill="none" stroke="var(--${lv ? LV[lv].c : 'line'})" stroke-width="9" stroke-linecap="round" stroke-dasharray="${(frac * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 55 55)"/><text x="55" y="59" text-anchor="middle" font-size="24" font-weight="500" fill="var(--ink)">${risk != null ? nf(risk, 1) : '–'}</text><text x="55" y="75" text-anchor="middle" font-size="9" fill="var(--muted)">${EN ? 'of 10' : 'av 10'}</text></svg>
    <div class="n-conc">${lv ? `<span class="pill ${LV[lv].c}" style="align-self:flex-start">${LV[lv].t} risk</span>` : `<span class="faint small">${EN ? 'Too little data' : 'För lite data'}</span>`}
    ${hv.slice(0, 4).map((h) => `<div><span>${esc(ovName(h.sym))}</span><span class="n-cb"><i style="width:${((h.varde / tot) * 100).toFixed(0)}%;background:var(--${h.poang != null ? LV[lvlOf(h.poang)].c : 'muted'})"></i></span><b class="num">${nf((h.varde / tot) * 100, 0)} %</b></div>`).join('')}</div></div>
    ${flags.slice(0, 2).map(([k, t]) => `<div class="n-flag"><i class="${k === 'ok' ? 'up' : 'warn'}"></i><span>${esc(t)}</span></div>`).join('')}
    <p class="b-src">${EN ? 'Average of the risk check for your stocks, weighted by value. Bars show share of the portfolio, colour shows each stock\'s risk.' : 'Snittet av riskkollen för dina aktier, vägt efter värde. Staplarna visar andel av portföljen, färgen aktiens risk.'}</p>`;
}

/* ================= Din dag: vad hände med portföljen i dag ================= */
// Öppettider per börs i börsens egen tidszon. Helgdagar räknas inte, men en aktie som inte handlats i dag visas som stängd.
const BORS = [
  [/\.ST$/, 'Stockholm', 'Europe/Stockholm', '09:00', '17:30'], [/\.OL$/, 'Oslo', 'Europe/Oslo', '09:00', '16:20'], [/\.CO$/, 'Köpenhamn', 'Europe/Copenhagen', '09:00', '17:00'],
  [/\.HE$/, 'Helsingfors', 'Europe/Helsinki', '10:00', '18:30'], [/\.(DE|F)$/, 'Frankfurt', 'Europe/Berlin', '09:00', '17:30'], [/\.L$/, 'London', 'Europe/London', '08:00', '16:30'],
  [/\.(PA|AS|BR|MI|MC)$/, 'Europa', 'Europe/Paris', '09:00', '17:30'], [/^[^.]+$/, 'USA', 'America/New_York', '09:30', '16:00']];
const borsOf = (sym) => { const b = BORS.find(([rx]) => rx.test(sym)) || BORS[0]; return { namn: b[1], tz: b[2], open: b[3], close: b[4] }; };
const localHm = (tz, d = new Date()) => { const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false }).formatToParts(d); const g = (t) => p.find((x) => x.type === t)?.value; return { hm: `${g('hour')}:${g('minute')}`, wd: g('weekday') }; };
// Börsens öppning och stängning omräknat till svensk tid i dag
const toSthlm = (tz, hm) => { const [h, m] = hm.split(':').map(Number); const now = new Date(); const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);
  for (let off = -14; off <= 14; off += 0.5) { const d = new Date(`${ymd}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`); const t = new Date(d.getTime() - off * 3600e3); if (localHm(tz, t).hm === hm) return t.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' }); } return hm; };
function borsStatus(sym, tid) {
  const b = borsOf(sym); const { hm, wd } = localHm(b.tz); const helg = wd === 'Sat' || wd === 'Sun';
  const opens = toSthlm(b.tz, b.open), closes = toSthlm(b.tz, b.close);
  if (helg) return { kod: 'stangd', txt: EN ? 'Closed today' : 'Stängd i dag', bors: b.namn };
  if (hm < b.open) return { kod: 'fore', txt: (EN ? 'Opens ' : 'Öppnar ') + opens, bors: b.namn };
  if (hm >= b.close) return { kod: 'stangd', txt: (EN ? 'Closed ' : 'Stängde ') + closes, bors: b.namn };
  if (tid && !tradedToday(tid)) return { kod: 'stangd', txt: EN ? 'Not traded today' : 'Ingen handel i dag', bors: b.namn };
  return { kod: 'oppen', txt: (EN ? 'Open until ' : 'Öppen till ') + closes, bors: b.namn };
}

// I dag: samma beräkning som översikten
async function ddToday(port) {
  const d = await pfData(port);
  for (const h of d.hold) h.status = borsStatus(h.sym, h.tid);
  return { items: d.hold, fx: d.fxD, dag: d.refDag, live: d.dagIdag, ...d.day, tot: d.tot };
}
// En tidigare dag: stängningskursen den dagen mot dagen innan, för de aktier man ägde när dagen var slut
async function ddPast(port, dag) {
  const end = new Date(dag + 'T23:59:59').getTime();
  const bys = port.filter((b) => !b.tid || new Date(b.tid).getTime() <= end);
  const syms = [...new Set(bys.map((b) => b.sym))];
  const from = new Date(new Date(dag + 'T12:00:00Z').getTime() - 12 * 864e5).toISOString().slice(0, 10);
  const charts = await Promise.all(syms.map((s) => api(`/api/chart?s=${encodeURIComponent(s)}&from=${from}`, 6 * 3600e3).catch(() => null)));
  const valuta = Object.fromEntries(syms.map((s, i) => [s, charts[i]?.valuta || bys.find((b) => b.sym === s)?.kursValuta || 'SEK']));
  const curs = [...new Set(Object.values(valuta).filter((v) => v !== 'SEK'))];
  const fxc = await Promise.all(curs.map((c) => api(`/api/chart?s=${encodeURIComponent(fxPair(c))}&from=${from}`, 6 * 3600e3).catch(() => null)));
  const fx = { SEK: { F0: 1, F1: 1 } };
  curs.forEach((c, i) => { const d = closesByDay(fxc[i]?.punkter).filter(([day]) => day <= dag); const last = d[d.length - 1]; const prev = d.filter(([day]) => day < dag).pop();
    if (last) fx[c] = { F1: last[1] * fxScale(c), F0: (prev || last)[1] * fxScale(c), pair: fxPair(c), scale: fxScale(c) }; });
  const items = syms.map((s, i) => {
    const d = closesByDay(charts[i]?.punkter).filter(([day]) => day <= dag);
    const last = d[d.length - 1]; const traded = !!last && last[0] === dag; const prev = traded ? d[d.length - 2] : null;
    return { sym: s, valuta: valuta[s], buys: bys.filter((b) => b.sym === s), traded, P1: last?.[1] ?? null, P0: traded ? prev?.[1] ?? null : last?.[1] ?? null,
      status: { kod: 'stangd', bors: borsOf(s).namn, txt: traded ? (EN ? 'Traded' : 'Handlades') : (EN ? 'No trading that day' : 'Ingen handel den dagen') } };
  });
  const day = dayMath(items, fx, dag);
  return { items, fx, dag, live: false, past: true, ...day, tot: day.end };
}
async function mountDinDag() {
  const port = getPort(); const box = $('#dd-body'); const today = sthlmDay(Date.now());
  const inp = $('#dd-date');
  const go = (d) => { const url = d && d < today ? `/portfolj?flik=dagen&dag=${d}` : '/portfolj?flik=dagen'; history.replaceState(null, '', url); render(); };
  inp.addEventListener('change', () => { if (inp.value) go(inp.value > today ? today : inp.value); });
  $('#dd-today').addEventListener('click', () => go(null));
  document.querySelectorAll('.dd-step').forEach((b) => b.addEventListener('click', () => {
    let d = new Date((inp.value || today) + 'T12:00:00Z'); const step = Number(b.dataset.step);
    do { d = new Date(d.getTime() + step * 864e5); } while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
    const iso = d.toISOString().slice(0, 10); if (iso <= today) go(iso);
  }));
  if (!port.length) { box.innerHTML = `<div class="empty">Du har inga köp i portföljen än. <button type="button" class="linkbtn" data-pfgo="kop" data-pffocus="pf-q">Lägg till ett köp</button> så ser du här hur din dag går.${locked() ? `<div class="chips" style="justify-content:center;margin-top:12px">${demoBtn()}</div>` : ''}</div>`; return; }
  const first = port.map((b) => b.tid).filter(Boolean).sort()[0]; if (first) inp.min = sthlmDay(first);
  const q = new URLSearchParams(location.search).get('dag');
  const past = !!(q && /^\d{4}-\d{2}-\d{2}$/.test(q) && q < today);
  const fail = (txt) => { box.innerHTML = `<div class="empty" style="margin-top:16px">${txt} <button class="btn btn-ghost" id="dd-retry" type="button" style="margin-left:6px">${EN ? 'Try again' : 'Försök igen'}</button></div>`; $('#dd-retry')?.addEventListener('click', () => { memo.clear?.(); render(); }); };
  let m;
  try { m = past ? await ddPast(port, q) : await ddToday(port); }
  catch { if ($('#dd-body')) fail(EN ? 'The prices could not be fetched right now, so your day cannot be calculated.' : 'Kurserna kunde inte hämtas just nu, så din dag kan inte räknas ut.'); return; }
  if (!$('#dd-body')) return;
  if (m.items.length && m.items.every((it) => it.missing)) {
    $('#dd-bors').hidden = true;
    fail(past ? (EN ? 'The prices for that day could not be fetched right now, so the day cannot be calculated.' : 'Kurserna för den dagen kunde inte hämtas just nu, så dagen kan inte räknas ut.')
      : (EN ? 'The prices could not be fetched right now, so your day cannot be calculated.' : 'Kurserna kunde inte hämtas just nu, så din dag kan inte räknas ut.'));
    return;
  }
  const { items, dag } = m; const change = m.change;
  const wd = new Date(dag + 'T12:00:00Z').getUTCDay();
  $('#dd-bors').hidden = past;
  if (past) {
    $('#dd-sub').textContent = `${dayShort(dag + 'T12:00:00')} · ${EN ? 'closing prices compared with the day before' : 'stängningskurser jämfört med dagen innan'}`;
    if (!items.length) { box.innerHTML = `<div class="empty" style="margin-top:16px">${EN ? "You didn't own any stocks in the portfolio that day." : 'Du ägde inga aktier i portföljen den dagen.'}</div>`; return; }
    if (wd === 0 || wd === 6 || items.every((it) => !it.traded)) { box.innerHTML = `<div class="empty" style="margin-top:16px">${EN ? 'The markets were closed that day. Pick another day.' : 'Börserna var stängda den dagen. Välj en annan dag.'}</div>`; return; }
  } else {
    const borser = {}; for (const h of items) borser[h.status.bors] = borser[h.status.bors] || h.status;
    $('#dd-bors').innerHTML = Object.values(borser).map((b) => `<span class="dd-bors ${b.kod}"><i></i>${esc(b.bors)} · ${esc(b.txt)}</span>`).join('');
    if (dag) $('#dd-sub').textContent = m.live ? `${dayShort(dag + 'T12:00:00')} · ${EN ? 'compared with the previous close' : 'jämfört med gårdagens stängning'}` : (EN ? `No trading yet today. Showing the last trading day, ${dayShort(dag + 'T12:00:00')}.` : `Ingen handel än i dag. Här är senaste börsdagen, ${dayShort(dag + 'T12:00:00')}.`);
  }
  // Rader: aktierna och valutans rörelse, sorterade efter påverkan i kronor
  const stocks = items.filter((h) => h.idag != null && !h.missing);
  const fxRows = Object.entries(m.fxEff || {}).map(([c, v]) => ({ fx: c, idag: v, pct: m.fx[c] ? (m.fx[c].F1 / m.fx[c].F0 - 1) * 100 : null }));
  const rows = [...stocks, ...fxRows].sort((a, b) => b.idag - a.idag);
  // Hela kronor som summerar exakt till dagens resultat (största rest får avrundningen)
  { const target = Math.round(change); const fl = rows.map((x) => Math.floor(x.idag)); let left = target - fl.reduce((a, v) => a + v, 0);
    const order = rows.map((x, i) => [x.idag - Math.floor(x.idag), i]).sort((a, b) => b[0] - a[0]);
    rows.forEach((x, i) => { x.kr = fl[i]; }); for (const [, i] of order) { if (left <= 0) break; rows[i].kr += 1; left -= 1; } }
  const notYet = items.filter((h) => h.idag == null && !h.missing); const missing = items.filter((h) => h.missing);
  const up = stocks.filter((h) => h.idag > 0).sort((a, b) => b.idag - a.idag), down = stocks.filter((h) => h.idag < 0).sort((a, b) => a.idag - b.idag);
  const sentence = [up[0] ? `${EN ? 'Biggest lift' : 'Mest upp'}: <b>${esc(ovName(up[0].sym))}</b> ${krDiff(up[0].kr ?? up[0].idag)}` : '', down[0] ? `${EN ? 'Biggest drag' : 'Mest ner'}: <b>${esc(ovName(down[0].sym))}</b> ${krDiff(down[0].kr ?? down[0].idag)}` : ''].filter(Boolean).join(' · ');
  const startLbl = EN ? 'Start of the day' : 'Början av dagen', endLbl = m.live ? (EN ? 'Now' : 'Nu') : (EN ? 'End of the day' : 'Slutet av dagen');
  const fxKr = rows.filter((x) => x.fx).reduce((a, x) => a + x.kr, 0);
  const dayLbl = m.live ? `${EN ? 'Your day' : 'Din dag'} · ${dayShort(dag + 'T12:00:00')}` : dayShort(dag + 'T12:00:00');
  // Från gårdagen till nu: varje rad flyttar summan uppåt eller nedåt
  let acc = 0; const steps = rows.map((x) => { const from = acc; acc += x.kr; return { x, from, to: acc }; });
  const wlo = Math.min(0, ...steps.map((s) => Math.min(s.from, s.to)), change), whi = Math.max(0, ...steps.map((s) => Math.max(s.from, s.to)), change); const wsp = whi - wlo || 1;
  const wbar = (a, b, cls) => `<span class="p-wfb"><i class="z" style="left:${((0 - wlo) / wsp * 100).toFixed(1)}%"></i><i class="${cls}" style="left:${((Math.min(a, b) - wlo) / wsp * 100).toFixed(1)}%;width:${Math.max(0.6, Math.abs(b - a) / wsp * 100).toFixed(1)}%"></i></span>`;
  const wrow = ({ x, from, to }) => `${x.fx ? '<div class="p-wf">' : `<a class="p-wf" href="/bolag/${encodeURIComponent(x.sym)}" data-link>`}<span class="p-wfn">${x.fx ? `${EN ? 'Currency' : 'Valutan'} ${esc(x.fx)}` : esc(ovName(x.sym))}</span>${wbar(from, to, x.kr >= 0 ? 'up' : 'down')}<b class="num ${tone(x.kr)}">${krDiff(x.kr)}</b><span class="num small muted">${x.fx ? (x.pct != null ? pct(x.pct, 2) : '') : x.d1Dag != null ? pct(x.d1Dag, 1) : ''}</span>${x.fx ? '</div>' : '</a>'}`;
  // Värmekarta: ytan efter värde, färgen efter dagens rörelse
  const heat = (c) => { if (c == null) return 'var(--surface)'; const t = Math.max(-1, Math.min(1, c / 3)); const a = Math.abs(t); const mix = (x, y) => Math.round(x + (y - x) * a); return t >= 0 ? `rgb(${mix(42, 35)},${mix(47, 130)},${mix(56, 79)})` : `rgb(${mix(42, 180)},${mix(47, 54)},${mix(56, 44)})`; };
  const hv = items.filter((h) => !h.missing && (h.end || 0) > 0).sort((a, b) => b.end - a.end);
  const nRows = hv.length <= 3 ? 1 : hv.length <= 7 ? 2 : 3; const per = Math.ceil(hv.length / nRows);
  const hRows = Array.from({ length: nRows }, (_, i) => hv.slice(i * per, (i + 1) * per)).filter((r) => r.length);
  const hTot = hv.reduce((a, h) => a + h.end, 0) || 1;
  box.innerHTML = `
    <div class="b-grid">
      <section class="b-card c8 p-dhero">
        <div class="p-dsay"><span class="b-lbl">${esc(dayLbl)}</span><span class="p-dbig">${EN ? (m.live ? 'Your stocks have moved' : 'Your stocks moved') : 'Dina aktier har gått'} <b class="num ${tone(change)}">${Math.round(change) ? krDiff(change) : '0 kr'}</b> <span class="num ${tone(change)}">${m.pct != null ? `(${pctDiff(m.pct)})` : ''}</span></span><span class="small muted">${sentence || (EN ? 'No movement.' : 'Ingen rörelse.')}</span></div>
        ${missing.length ? `<p class="dd-warn small">${EN ? `${missing.length === 1 ? '1 stock' : `${missing.length} stocks`} could not be fetched and ${missing.length === 1 ? 'is' : 'are'} not included in the numbers.` : `${missing.length === 1 ? '1 aktie' : `${missing.length} aktier`} kunde inte hämtas och räknas inte med i siffrorna.`}</p>` : ''}
        <div id="dd-chart" class="p-dchart">${loading(EN ? 'Loading the day …' : 'Hämtar dagens kurser …')}</div>
        <div class="dd-axis small num" id="dd-axis"></div>
        <div class="p-dflow">
          <div><span>${startLbl}</span><b class="num">${sekBig(m.start)}</b><span>${past ? (EN ? 'previous close' : 'föregående stängning') : (EN ? "yesterday's close" : 'gårdagens stängning')}</span></div>
          ${m.added ? `<div><span>${EN ? 'Added during the day' : 'Insatt under dagen'}</span><b class="num">+${sekBig(m.added)}</b><span>${EN ? 'purchases' : 'köp'}</span></div>` : ''}
          <div><span>${EN ? 'The stocks' : 'Aktierna'}</span><b class="num ${tone(change - fxKr)}">${krDiff(change - fxKr)}</b><span>${EN ? 'price moves' : 'kursernas rörelse'}</span></div>
          <div><span>${EN ? 'Currency effect' : 'Valutans effekt'}</span><b class="num ${tone(fxKr)}">${krDiff(fxKr)}</b><span>${EN ? 'exchange rates' : 'växelkurserna'}</span></div>
          <div><span>${endLbl}</span><b class="num">${sekBig(m.end)}</b><span>${m.live ? (EN ? 'latest prices' : 'senaste kurserna') : (EN ? 'at close' : 'vid stängning')}</span></div>
        </div>
      </section>
      <section class="b-card c4"><h2 class="b-lbl">${m.live ? (EN ? 'From yesterday until now' : 'Från gårdagen till nu') : (EN ? 'From start to end of the day' : 'Från början till slutet av dagen')}</h2><span class="small faint">${EN ? 'Each stock adds or subtracts' : 'Varje aktie lägger till eller drar ifrån'}</span>
        ${steps.map(wrow).join('')}
        ${notYet.length ? `<div class="dd-sep small muted">${past ? (EN ? 'No trading that day' : 'Ingen handel den dagen') : (EN ? 'Not traded yet today' : 'Har inte handlats i dag än')}: ${esc(notYet.map((h) => ovName(h.sym)).join(', '))}</div>` : ''}
        ${missing.length ? `<div class="dd-sep small muted">${EN ? 'Could not be fetched' : 'Kunde inte hämtas'}: ${esc(missing.map((h) => ovName(h.sym)).join(', '))}</div>` : ''}
        <div class="p-wf p-wft"><span class="p-wfn"><b>${EN ? 'Total' : 'Summa'}</b></span>${wbar(0, change, change >= 0 ? 'up' : 'down')}<b class="num ${tone(change)}">${krDiff(change)}</b><span class="num small muted">${m.pct != null ? pctDiff(m.pct) : ''}</span></div></section>
      <section class="b-card c7"><div class="b-ch"><h2 class="b-lbl">${EN ? 'Heat map' : 'Värmekarta'}</h2><span class="small faint">${EN ? 'size = value, colour = the day\'s move' : 'storlek = värde, färg = dagens rörelse'}</span></div>
        <div class="p-heat">${hRows.map((r) => `<div class="p-hrow" style="flex:${r.reduce((a, h) => a + h.end, 0) / hTot}">${r.map((h) => `<a class="p-hc" href="/bolag/${encodeURIComponent(h.sym)}" data-link style="flex:${h.end / hTot};background:${heat(h.d1Dag)}" title="${esc(ovName(h.sym))}: ${h.d1Dag != null ? pct(h.d1Dag, 1) : ''} · ${sekBig(h.end)}"><b>${esc(ovName(h.sym))}</b><span class="num">${h.d1Dag != null ? pct(h.d1Dag, 1) : (EN ? 'no trading' : 'ingen handel')}</span></a>`).join('')}</div>`).join('')}</div></section>
      <section class="b-card c5"><h2 class="b-lbl">${EN ? 'The day in numbers' : 'Dagen i siffror'}</h2><div id="dd-kv">${loading()}</div></section>
      <section class="b-card c12"><div class="b-ch"><h2 class="b-lbl">${EN ? 'News about the stocks that moved most' : 'Nyheter om dem som rörde sig mest'}</h2></div><div id="dd-news">${loading('Hämtar nyheter …')}</div></section>
    </div>
    <p class="small faint" style="margin:0">${EN ? "Start of the day is what your stocks were worth at the previous close. End of the day is what they are worth now, or at the day's close. The difference is exactly the stocks' moves plus the currency's move. Purchases during the day count as money added, not as profit." : 'Början av dagen är vad dina aktier var värda vid föregående stängning. Slutet är vad de är värda nu, eller vid dagens stängning. Skillnaden är exakt aktiernas rörelse plus valutans rörelse. Köp under dagen räknas som insatta pengar, inte som vinst.'}</p>`;

  // Dagen i siffror, med OMXS30 samma dag
  const traded = stocks.filter((h) => h.d1Dag != null).sort((a, b) => b.d1Dag - a.d1Dag);
  const omxFrom = new Date(new Date(dag + 'T12:00:00Z').getTime() - 12 * 864e5).toISOString().slice(0, 10);
  api(`/api/chart?s=${encodeURIComponent('^OMX')}&from=${omxFrom}`, m.live ? 5 * 60e3 : 6 * 3600e3).catch(() => null).then((c) => {
    const el = $('#dd-kv'); if (!el) return;
    const cl = closesByDay(c?.punkter).filter(([d]) => d <= dag); const last = cl[cl.length - 1]; const prev = cl[cl.length - 2];
    const omx = last && prev && last[0] === dag ? (last[1] / prev[1] - 1) * 100 : null;
    const kv = (k, v, cls = '') => `<div class="b-kv"><span>${esc(k)}</span><b class="num ${cls}">${v}</b></div>`;
    el.innerHTML = [
      traded[0] ? kv(EN ? 'Best' : 'Bäst', `${esc(ovName(traded[0].sym))} ${pct(traded[0].d1Dag, 1)}`, tone(traded[0].d1Dag)) : '',
      traded.length > 1 ? kv(EN ? 'Worst' : 'Sämst', `${esc(ovName(traded[traded.length - 1].sym))} ${pct(traded[traded.length - 1].d1Dag, 1)}`, tone(traded[traded.length - 1].d1Dag)) : '',
      kv(EN ? 'Rose' : 'Steg', `${traded.filter((h) => h.d1Dag > 0).length} ${EN ? 'of' : 'av'} ${traded.length}`),
      ...Object.entries(m.fx || {}).filter(([k, f]) => k !== 'SEK' && f.F0 && items.some((h) => h.valuta === k)).map(([k, f]) => kv(`${EN ? 'Currency' : 'Valutan'} ${k}/SEK`, pct((f.F1 / f.F0 - 1) * 100, 2), tone(f.F1 / f.F0 - 1))),
      kv(EN ? 'OMXS30 that day' : 'OMXS30 samma dag', omx != null ? pct(omx, 2) : `<span class="faint">${EN ? 'Missing' : 'Saknas'}</span>`, tone(omx)),
      omx != null && m.pct != null ? kv(EN ? 'Your portfolio vs OMXS30' : 'Din portfölj mot OMXS30', `${pct(m.pct - omx, 2).replace(' %', '')} ${EN ? 'pp' : 'p.e.'}`, tone(m.pct - omx)) : '',
      m.added ? kv(EN ? 'Bought during the day' : 'Köpt under dagen', sekBig(m.added)) : ''
    ].join('');
  });

  // Kurvan med nyheterna som prickar
  Promise.all([dayCurve(m), getMyNews().catch(() => ({ items: [] }))]).then(([c, nw]) => { const el = $('#dd-chart'); if (!el) return;
    if (c.error) { const T = {
        old: ['Prices every five minutes are only available for the last 60 days, so the curve for this day cannot be shown. The numbers are still correct.', 'Kurser var femte minut finns bara för de senaste 60 dagarna, så kurvan för den här dagen kan inte visas. Siffrorna stämmer ändå.'],
        fetch: ['The prices for the curve could not be fetched right now. The numbers are still correct. Try again in a while.', 'Kurserna för kurvan kunde inte hämtas just nu. Siffrorna stämmer ändå. Prova igen om en stund.'],
        none: ['None of your stocks have traded yet, so there is no curve to show.', 'Ingen av dina aktier har handlats än, så det finns ingen kurva att visa.'],
        live: ['The curve appears when there are prices from today for all your stocks.', 'Kurvan visas när det finns kurser från i dag för alla dina aktier.'],
        partial: ['Prices every five minutes are missing for some of your stocks that day, so the curve cannot be shown. The numbers are still correct.', 'Kurser var femte minut saknas för några av dina aktier den dagen, så kurvan kan inte visas. Siffrorna stämmer ändå.'] }[c.error] || ['The curve cannot be shown right now.', 'Kurvan kan inte visas just nu.'];
      el.innerHTML = `<p class="b-note">${EN ? T[0] : T[1]}</p>`; return; }
    const pts = c.pts; const t0 = pts[0][0], t1 = pts[pts.length - 1][0];
    const own = (nw.items || []).filter((n) => n.agd).sort((a, b) => b.poang - a.poang); const dots = [];
    for (const nn of own) { const t = new Date(nn.datum).getTime() / 1000; if (t < t0 || t > t1) continue; if (dots.some((d) => Math.abs(new Date(d.datum).getTime() / 1000 - t) < (t1 - t0) * 0.03)) continue; dots.push(nn); if (dots.length === 6) break; }
    nDraw(el, pts, { base: 0, money: false, dots });
    const hm = (t) => new Date(t * 1000).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' });
    if ($('#dd-axis')) $('#dd-axis').innerHTML = `<span>${hm(t0)}</span><span>${past ? (EN ? 'Dashed line = previous close' : 'Streckad linje = föregående stängning') : (EN ? "Dashed line = yesterday's close" : 'Streckad linje = gårdagens stängning')}${dots.length ? (EN ? ' · dots are news' : ' · prickarna är nyheter') : ''}</span><span>${hm(t1)}</span>`;
  }).catch(() => { const el = $('#dd-chart'); if (el) el.innerHTML = `<p class="b-note">${EN ? 'The curve could not be shown right now. The numbers are still correct.' : 'Kurvan kunde inte visas just nu. Siffrorna stämmer ändå.'}</p>`; });
  // Nyheter från dagen om de tre som påverkade mest
  const top = stocks.slice().sort((a, b) => Math.abs(b.idag) - Math.abs(a.idag)).slice(0, 3);
  Promise.all(top.map((h) => api('/api/news?s=' + encodeURIComponent(h.sym), 10 * 60e3).then((n) => (n?.error ? null : (n?.items || []).map((x) => prepNews(x, null, h.sym)))).catch(() => null))).then((res0) => {
    const el = $('#dd-news'); if (!el) return;
    if (!top.length) { el.innerHTML = `<p class="small muted" style="margin:0">${EN ? 'None of your stocks have moved yet, so there is no news to show.' : 'Ingen av dina aktier har rört sig än, så det finns inga nyheter att visa.'}</p>`; return; }
    if (res0.every((x) => x == null)) { el.innerHTML = `<p class="small muted" style="margin:0">${EN ? 'The news could not be fetched right now. Try again in a while.' : 'Nyheterna kunde inte hämtas just nu. Prova igen om en stund.'}</p>`; return; }
    const res = res0.map((x) => x || []);
    const dayStart = new Date(dag + 'T00:00:00').getTime(); const from = past ? dayStart - 6 * 3600e3 : Date.now() - 36 * 3600e3; const to = past ? dayStart + 30 * 3600e3 : Infinity; const seen = new Set();
    const list = res.flat().filter((n) => { const t = new Date(n.datum).getTime(); return t >= from && t <= to; }).filter((n) => { const k = n.lank || n.rubrik; if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => String(b.datum).localeCompare(String(a.datum))).slice(0, 6);
    el.innerHTML = list.length ? list.map(newsRow).join('') : `<p class="small muted" style="margin:0">${past ? (EN ? 'No news saved from that day about these stocks. News is kept for a limited time.' : 'Inga nyheter från den dagen om de här aktierna. Nyheter finns bara kvar en begränsad tid.') : (EN ? 'No news in the last day about the stocks that moved most.' : 'Inga nyheter det senaste dygnet om aktierna som rörde sig mest.')}</p>`;
  });
}

/* ================= Sök ================= */
const POPULAR = [
  { sym: 'VOLV-B.ST', namn: 'Volvo B', typ: 'Aktie' },
  { sym: 'INVE-B.ST', namn: 'Investor B', typ: 'Aktie' },
  { sym: 'EVO.ST', namn: 'Evolution', typ: 'Aktie' },
  { sym: 'ERIC-B.ST', namn: 'Ericsson B', typ: 'Aktie' },
  { sym: 'AAPL', namn: 'Apple', typ: 'Aktie' },
  { sym: 'NVDA', namn: 'Nvidia', typ: 'Aktie' },
  { sym: 'SPY', namn: 'SPDR S&P 500 ETF', typ: 'ETF' },
  { sym: 'EWD', namn: 'iShares MSCI Sweden ETF', typ: 'ETF' }
];

function viewSok(params) {
  const q = params.get('q') || '';
  return `
  ${topbar([['Översikt', '/'], ['Bolag', '/sok']], false)}
  <div class="stack" style="gap:6px">
    <span class="eyebrow">Sök på en aktie, fond eller ETF. Du får affärsidé, historia, kursutveckling och en full riskkoll på samma sida.</span>
    <h1 class="title">Bolag</h1>
  </div>
  <form class="big-search" role="search" data-sokform>
    ${svg('search', 22, '#6B6F76')}
    <label class="sr-only" for="sokq">Sök bolag eller ticker</label>
    <input id="sokq" name="q" type="search" value="${esc(q)}" placeholder="Skriv ett bolag eller en ticker, till exempel Volvo, Apple eller NVDA" autocomplete="off">
    <button class="btn" type="submit">Sök</button>
  </form>
  <section class="stack" style="gap:12px" aria-live="polite">
    <span class="label-up" id="results-label">Populära</span>
    <div class="results-grid" id="results"></div>
  </section>
  ${footer()}`;
}

function resultsHTML(list) {
  return list.map((r) => `
    <a class="result tilt" href="/bolag/${encodeURIComponent(r.sym)}" data-link data-namn="${esc(r.klass ? `${r.namn}, ${r.typ}` : r.namn)}" data-sym="${esc(r.sym)}">
      ${av(r.sym)}
      <span style="flex:1;min-width:0"><span style="display:block;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.namn)}</span><span class="small muted">${esc([r.typ, r.sym].filter(Boolean).join(' · '))}</span></span>
      <span class="muted" aria-hidden="true">→</span>
    </a>`).join('');
}

function mountSok(params) {
  let q = params.get('q') || '';
  let timer;
  const label = (t) => { $('#results-label').textContent = t; };
  const show = (list, t) => { label(t); $('#results').innerHTML = resultsHTML(list); };
  const search = async () => {
    const term = q.trim();
    history.replaceState(null, '', '/sok' + (term ? '?q=' + encodeURIComponent(term) : ''));
    if (term.length < 2) { show(POPULAR, 'Populära'); return; }
    label('Söker …');
    const res = await api('/api/search?q=' + encodeURIComponent(term), 60 * 60e3);
    if (term !== q.trim() || !$('#results')) return;
    if (res?.results) {
      const n = res.results.length;
      show(res.results, n ? `${n} ${n === 1 ? 'träff' : 'träffar'} för "${term}"` : `Inga träffar för "${term}"`);
      if (!res.results.length) $('#results').innerHTML = '<div class="empty">Prova bolagets namn eller ticker, till exempel "AAPL" eller "Investor".</div>';
    } else {
      label('Sökningen fungerar inte just nu');
      $('#results').innerHTML = `<div class="empty">${esc(errText(res))}</div>`;
    }
  };
  if (q) search(); else show(POPULAR, 'Populära');
  const input = $('#sokq');
  input.addEventListener('input', () => { q = input.value; clearTimeout(timer); timer = setTimeout(search, 350); });
  $('[data-sokform]').addEventListener('submit', (e) => {
    e.preventDefault(); q = input.value; clearTimeout(timer);
    // Enter med en träff i listan går direkt till första bolaget
    const first = $('#results a.result');
    if (first && q.trim().length >= 2 && $('#results-label').textContent.includes('träff')) { rememberName(first.dataset.sym, first.dataset.namn); navigate(first.getAttribute('href')); return; }
    search();
  });
  $('#results').addEventListener('click', (e) => { const a = e.target.closest('a.result'); if (a) rememberName(a.dataset.sym, a.dataset.namn); });
}

async function getStock(sym) {
  const s = await api('/api/stock?s=' + encodeURIComponent(sym), 10 * 60e3);
  if (!s || s.error) return { error: s };
  if (s.namn === sym) { s.namn = nameOf(sym); if (s.sammanfattning) s.sammanfattning = s.sammanfattning.replace(sym + ':', s.namn + ':'); }
  else rememberName(sym, s.aktieslag ? `${s.namn}, ${s.aktieslag}` : s.namn);
  return s;
}

/* ================= Nyheter ================= */
function viewNyheter() {
  return `
  ${topbar([['Översikt', '/'], ['Nyheter', '/nyheter']])}
  <div class="section-head" style="align-items:flex-end">
    <div class="stack" style="gap:6px">
      <span class="eyebrow" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">Börsnyheter från hela världen <span id="news-status"></span></span>
      <h1 class="title">Nyheter</h1>
    </div>
    <div class="tabs" role="tablist" aria-label="Nyheter">
      ${newsMine() ? '<button role="tab" data-region="mina" aria-selected="true">Mina aktier</button>' : ''}
      <button role="tab" data-region="world" aria-selected="${!newsMine()}">Världen</button>
      <button role="tab" data-region="se" aria-selected="false">Sverige</button>
    </div>
  </div>
  <div class="split">
    <section class="wide stack" aria-label="Nyhetslista" id="newslist">${loading('Hämtar nyheter …')}</section>
    <aside class="narrow stack" style="gap:16px">
      <div class="card dark rings stack" style="gap:10px">
        <span class="small muted">Antal nyheter</span>
        <span class="num" style="font-size:44px;font-weight:300;line-height:1" id="news-count">–</span>
        <span class="small faint" id="news-range"></span>
      </div>
      <div class="card stack">
        <span class="small muted">Ämne</span>
        <div class="chips" id="newsfilter"></div>
        <p class="small faint" style="margin:0" id="news-help"></p>
      </div>
      <div class="empty">Vi visar rubrik, en kort ingress och länk till källan. Läs alltid hela artikeln innan du gör något med dina pengar.</div>
    </aside>
  </div>
  ${footer()}`;
}

// Fliken "Mina aktier" visas för den som har köp eller en egen bevakningslista
const newsMine = () => (ACC.user || getPort().length > 0) && mySyms().all.length > 0;
async function getMyNews() {
  const { port, all } = mySyms(); const syms = [...port, ...all.filter((x) => !port.includes(x))].slice(0, 12);
  const res = await Promise.all(syms.map((sym) => api('/api/news?s=' + encodeURIComponent(sym), 10 * 60e3).then((n) => (n?.error ? null : (n?.items || []).map((x) => ({ ...prepNews(x, null, sym), min: sym, agd: port.includes(sym) })))).catch(() => null)));
  if (res.every((x) => x == null)) return { ok: false, error: { error: 'upstream' }, items: [] };
  const seen = new Set(); const now = Date.now();
  const items = res.flat().filter(Boolean).filter((n) => { const k = n.lank || n.rubrik; if (seen.has(k)) return false; seen.add(k); return true; })
    .filter((n) => now - new Date(n.datum).getTime() < 14 * dayMs)
    .map((n) => { const h = (now - new Date(n.datum).getTime()) / 3600e3; return { ...n, poang: n.vikt * 6 + (n.agd ? 4 : 2) - h / 6 }; });
  return { ok: true, hamtad: new Date().toISOString(), items, mina: true };
}
function mountNyheter() {
  let region = newsMine() ? 'mina' : 'world'; let filt = 'Alla'; let sort = 'viktigt'; let data = null;
  const draw = () => {
    if (!data || !$('#newslist')) return;
    if (!data.ok) { $('#newslist').innerHTML = `<div class="empty">${esc(errText(data.error))}</div>`; $('#newsfilter').innerHTML = ''; $('#news-status').innerHTML = ''; return; }
    const byTime = (a, b) => String(b.datum).localeCompare(String(a.datum));
    const all = data.items.slice().sort(data.mina && sort === 'viktigt' ? (a, b) => b.poang - a.poang || byTime(a, b) : byTime);
    const cats = ['Alla', ...TOPICS.map((t) => t[0]).filter((k) => all.some((n) => n.amne === k))];
    if (!cats.includes(filt)) filt = 'Alla';
    const list = filt === 'Alla' ? all : all.filter((n) => n.amne === filt);
    $('#news-status').innerHTML = all.length ? liveTag(data.hamtad) : '';
    $('#news-count').textContent = String(all.length);
    const times = all.map((n) => n.datum).sort();
    $('#news-range').textContent = all.length ? `Senaste ${when(times[times.length - 1])}, äldsta ${when(times[0])}` : '';
    $('#newsfilter').innerHTML = cats.map((c) => `<button type="button" class="chip-btn" data-filt="${esc(c)}" aria-pressed="${c === filt}">${esc(c)}</button>`).join('')
      + (data.mina ? `<span class="news-sort"><button type="button" class="chip-btn" data-sort="viktigt" aria-pressed="${sort === 'viktigt'}">Viktigast först</button><button type="button" class="chip-btn" data-sort="tid" aria-pressed="${sort === 'tid'}">Senaste först</button></span>` : '');
    $('#news-help').innerHTML = data.mina ? 'Nyheter om aktierna du äger och bevakar. <b>Viktigast först</b> lyfter rapporter, vinstvarningar, affärer, utdelningar och ledningsbyten, och aktier du äger före aktier du bara bevakar. Sorteringen bygger på rubrikens ord och säger inget om hur kursen kommer att gå.' : 'Ämnet sätts utifrån orden i rubriken.';
    $('#newslist').innerHTML = list.map((n) => `
      <article class="card news-item">
        <div class="stack" style="gap:8px;flex:1;min-width:0">
          <div class="meta">${n.amne ? `<span class="pill news-topic t-${esc(n.amne)}">${esc(n.amne)}</span>` : ''}${n.min ? `<a class="pill outline" href="/bolag/${encodeURIComponent(n.min)}" data-link>${esc(ovName(n.min))}${n.agd ? '<span>&nbsp;· du äger</span>' : ''}</a>` : ''}<span class="pill outline src">${flag(n.land)}${esc(n.kalla)}</span><span class="num">${esc(n.tidTxt)}</span>${!n.min && n.bolagTxt ? `<span>${esc(n.bolagTxt)}</span>` : ''}</div>
          <h3>${newsTitle(n)}</h3>
          ${n.text ? `<p class="news-text">${esc(n.text)}</p>` : ''}
          <div class="meta">${sourceLink(n)}</div>
        </div>
      </article>`).join('') || `<div class="empty">${filt !== 'Alla' ? `Inga nyheter om ${esc(filt.toLowerCase())} just nu.` : region === 'mina' ? 'Inga nyheter om dina aktier de senaste två veckorna.' : region === 'se' ? 'Inga nyheter om svenska bolag just nu.' : 'Inga nyheter just nu.'}</div>`;
  };
  const load = async () => {
    const r = region; $('#newslist').innerHTML = loading('Hämtar nyheter …');
    const d = r === 'mina' ? await getMyNews() : await getNews(r); if (r !== region) return; data = d; draw();
  };
  $('.tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-region]'); if (!b) return;
    region = b.dataset.region; filt = 'Alla';
    document.querySelectorAll('[data-region]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    load();
  });
  $('#newsfilter').addEventListener('click', (e) => { const b = e.target.closest('[data-filt]'); if (b) { filt = b.dataset.filt; draw(); } const so = e.target.closest('[data-sort]'); if (so) { sort = so.dataset.sort; draw(); } });
  load();
}

/* ================= Bevakning ================= */
function viewBevakning() {
  return `
  ${topbar([['Översikt', '/'], ['Bevakning', '/bevakning']])}
  <div class="stack" style="gap:6px">
    <span class="eyebrow">${ACC.user ? `Sparas på ditt konto (${esc(ACC.user.email)}) och följer med till alla dina enheter` : 'Sparas i den här webbläsaren. <a href="/konto" data-link>Logga in</a> för att få listan på alla enheter.'}</span>
    <h1 class="title">Mina aktier</h1>
  </div>
  <div id="alarms"></div>
  <section class="card" style="padding:10px" aria-labelledby="lista-h">
    <h2 id="lista-h" class="sr-only">Bevakade värdepapper</h2>
    <div id="watchtable">${loading('Hämtar kurser …')}</div>
  </section>
  ${footer()}`;
}

async function mountBevakning() {
  const draw = async () => {
    const watch = getWatch();
    if (!watch.length) {
      $('#alarms').innerHTML = '';
      $('#watchtable').innerHTML = '<div class="empty" style="margin:12px">Du bevakar inga aktier. Gå till <a href="/sok" data-link>Bolag</a> och tryck på Bevaka.</div>';
      return;
    }
    const quotes = await getQuotes(watch);
    if (!$('#watchtable')) return;
    const rows = watch.map((s) => ({ sym: s, namn: nameOf(s), q: quotes[s] || {} }));
    const larm = getLarm();
    const alarms = rows.filter((r) => larm[r.sym] && r.q.d1 != null && r.q.idag && Math.abs(r.q.d1) >= larm[r.sym]);
    $('#alarms').innerHTML = alarms.length ? `<div class="grid g3">${alarms.map((a, i) => `
      <div class="card ${i === 0 ? 'dark rings' : ''} stack" style="gap:8px">
        <span class="pill ${i === 0 ? 'inv' : tone(a.q.d1)}" style="align-self:flex-start">Larm · rörelse över ${larm[a.sym]} %</span>
        <span style="font-size:17px;font-weight:500">${esc(a.namn)} är ${a.q.d1 < 0 ? 'ner' : 'upp'} ${pct(Math.abs(a.q.d1), 1).replace('+', '')} i dag</span>
        <a class="small" href="/bolag/${encodeURIComponent(a.sym)}" data-link>Se riskkollen →</a>
      </div>`).join('')}</div>` : '';
    $('#watchtable').innerHTML = `${notifyBar()}<div class="table-wrap"><table>
      <thead><tr><th scope="col">Värdepapper</th><th scope="col" class="r">Kurs</th><th scope="col" class="r">I dag</th><th scope="col">Prislarm${tip('Prislarm')}</th><th scope="col">Riskkoll</th><th scope="col"><span class="sr-only">Ta bort</span></th></tr></thead>
      <tbody>${rows.map((r) => `
        <tr>
          <td><a class="co" href="/bolag/${encodeURIComponent(r.sym)}" data-link>${av(r.sym)}<span><span style="display:block;font-weight:500">${esc(r.namn)}</span><span class="small muted">${esc(r.sym)}</span></span></a></td>
          <td class="r num">${r.q.kurs != null ? kr(r.q.kurs) : '<span class="faint">saknas</span>'}</td>
          <td class="r"><span class="pill ${tone(r.q.d1)}">${r.q.d1 != null ? pct(r.q.d1, 1) : '–'}</span></td>
          <td><label class="sr-only" for="larm-${esc(r.sym)}">Prislarm för ${esc(r.namn)}</label><select class="select" id="larm-${esc(r.sym)}" data-larm="${esc(r.sym)}">${[0, 2, 3, 5, 10].map((v) => `<option value="${v}" ${(larm[r.sym] || 0) === v ? 'selected' : ''}>${v ? `± ${v} %` : 'Av'}</option>`).join('')}</select></td>
          <td><a href="/bolag/${encodeURIComponent(r.sym)}" data-link class="small">Visa →</a></td>
          <td class="r"><button class="btn ghost small" type="button" data-unwatch="${esc(r.sym)}" aria-label="Sluta bevaka ${esc(r.namn)}">Ta bort</button></td>
        </tr>`).join('')}</tbody>
    </table></div>
    <p class="small faint" style="margin:6px 14px 10px">${quotes.__hamtad ? `Kurser hämtade kl ${esc(clock(quotes.__hamtad))}. "Saknas" betyder att ingen datakälla har kursen just nu.` : esc(errText(quotes.__error))}</p>`;
  };
  $('.main').addEventListener('click', async (e) => {
    if (e.target.closest('[data-notify]')) { await askNotify(); draw(); return; }
    const b = e.target.closest('[data-unwatch]'); if (!b) return;
    const l = getLarm(); delete l[b.dataset.unwatch]; writeLS(LKEY, l);
    toggleWatch(b.dataset.unwatch); refreshNav('bevakning'); draw();
  });
  $('.main').addEventListener('change', (e) => {
    const sel = e.target.closest('[data-larm]'); if (!sel) return;
    const l = getLarm(); const v = Number(sel.value);
    if (v) l[sel.dataset.larm] = v; else delete l[sel.dataset.larm];
    writeLS(LKEY, l);
    if (v && 'Notification' in window && Notification.permission === 'default') askNotify().then(draw); else draw();
  });
  draw();
}

/* ================= Bolagssida med riskkoll ================= */
function priceBlock(s, big = 40) {
  if (s.saknarKurs) return `<div class="stack" style="gap:4px;align-items:flex-end;text-align:right"><span class="muted" style="font-size:20px">Kurs saknas</span><span class="small faint" style="max-width:300px">Ingen datakälla har en kurs för ${esc(s.sym)} just nu.</span></div>`;
  return `<div class="stack" style="gap:8px;align-items:flex-end">
    <span class="num price-big" style="font-size:${big}px;letter-spacing:-0.02em;line-height:1">${kr(s.kurs)} <span class="muted" style="font-size:16px">${esc(cur(s.valuta))}</span></span>
    <span style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">${s.d1 != null ? `<span class="pill ${tone(s.d1)}">${esc(d1Label(s.d1, s.kursTid))}</span>` : ''}<span class="pill outline" title="Tid för senaste affären enligt ${esc(s.kalla || 'datakällan')}">Senaste kurs ${esc(when(s.kursTid || s.hamtad))}</span></span>
  </div>`;
}

const yahooDesc = (s) => `<div class="stack" style="gap:12px"><p class="lead co-desc">${esc(clipText(s.beskrivning, 700))}</p><p class="small faint" style="margin:0">Texten finns bara på engelska. Källa: ${esc(s.kalla || 'Yahoo Finance')}.</p></div>`;
const clipText = (t, n) => (t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + ' …' : t);

function aboutHTML(a, s) {
  if (!a || a.error || a.saknas) {
    if (s?.beskrivning) return yahooDesc(s);
    return `<p class="muted" style="margin:0">${a?.error ? esc(errText(a)) : 'Vi hittade ingen beskrivning av det här värdepappret. För fonder och mindre bolag saknas den ofta.'}</p>`;
  }
  const facts = a.fakta || [];
  if (!a.affarside && !a.historia?.length && s?.beskrivning) return yahooDesc(s) + (facts.length ? `<dl class="facts" style="margin-top:20px">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : '');
  return `<div class="stack" style="gap:20px">
    ${a.affarside ? `<p class="lead co-desc">${esc(a.affarside)}</p>` : s?.beskrivning ? `<p class="lead">${esc(clipText(s.beskrivning, 520))}</p>` : ''}
    ${facts.length ? `<dl class="facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
    ${a.historia?.length ? `<div class="stack" style="gap:10px"><h3 class="sub">Historia</h3><div class="prose co-desc">${a.historia.map((p) => `<p>${esc(p)}</p>`).join('')}</div></div>` : ''}
    <p class="small faint" style="margin:0">${a.sprak === 'en' ? 'Texten finns bara på engelska än. ' : ''}Källa: ${safeUrl(a.url) ? `<a href="${esc(safeUrl(a.url))}" target="_blank" rel="noopener noreferrer">Wikipedia</a> (CC BY-SA 4.0)` : 'Wikipedia'}${safeUrl(a.wikidata) ? ` och <a href="${esc(safeUrl(a.wikidata))}" target="_blank" rel="noopener noreferrer">Wikidata</a>` : ''}.</p></div>`;
}

/* ================= Bolagssidan =================
   En sida per bolag med egen flikmeny högst upp. All data är riktig och hämtas live:
   kurser och rapportsiffror från Yahoo Finance, insyn och blankning från Finansinspektionen.
   Det vi räknar fram själva (riskmått, medelvärden, marginaler) räknas från de siffrorna i webbläsaren.
   Saknas något skriver sidan det, inget fylls i. */
const B_TABS = [['oversikt', 'Översikt'], ['kurs', 'Kurs och diagram'], ['dagen', 'Dagen'], ['risk', 'Riskanalys'], ['rapporter', 'Rapporter och nyckeltal'], ['insyn', 'Insyn och blankning'], ['kalender', 'Kalender'], ['nyheter', 'Nyheter'], ['om', 'Om bolaget']];
const B_MON = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const B_MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const bMon = (i) => (EN ? B_MON_EN : B_MON)[i];
const bKey = (t) => new Date(t * 1000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
const bDate = (iso, year = true) => { const d = new Date(String(iso).length === 10 ? iso + 'T12:00:00' : iso); return isNaN(d) ? '' : d.toLocaleDateString(L, { day: 'numeric', month: 'short', year: year ? 'numeric' : undefined, timeZone: 'Europe/Stockholm' }).replace('.', ''); };
const bn = (v, d = 1) => (v == null || !Number.isFinite(v) ? null : Number(v).toLocaleString(L, { minimumFractionDigits: d, maximumFractionDigits: d }));
const bPct = (v, d = 1) => (v == null || !Number.isFinite(v) ? null : bn(v, d) + ' %');
const bSign = (v, d = 1) => (v == null || !Number.isFinite(v) ? null : (v > 0 ? '+' : v < 0 ? '−' : '') + bn(Math.abs(v), d) + ' %');
const bBig = (v, c) => { if (v == null || !Number.isFinite(v)) return null; const a = Math.abs(v); const s = v < 0 ? '−' : ''; const u = cur(c); return a >= 1e9 ? `${s}${bn(a / 1e9, 1)} ${EN ? 'bn' : 'mdr'} ${u}` : a >= 1e6 ? `${s}${bn(a / 1e6, 1)} ${EN ? 'm' : 'mn'} ${u}` : `${s}${bn(a, 0)} ${u}`; };
const bMiss = (v, txt) => (v == null ? `<span class="faint">${esc(txt || 'Saknas')}</span>` : esc(v));
const bTone = (v) => (v == null ? '' : v >= 0 ? 'up' : 'down');
const bH = (n, title, sub, id) => `<div class="b-sec" ${id ? `id="${id}"` : ''}><span class="b-sec-n">${n}</span><h2>${esc(title)}</h2>${sub ? `<span class="b-sec-sub">${sub}</span>` : ''}</div>`;
const bCard = (cls, inner, attrs = '') => `<section class="b-card ${cls}" ${attrs}>${inner}</section>`;
const bLabel = (t, k) => `<h3 class="b-lbl">${esc(t)}${k ? tip(k) : ''}</h3>`;
const bErr = (d, fallback) => `<p class="b-note">${esc(d?.error ? errText(d) : fallback)}</p>`;

/* ---------- Beräkningar från stängningskurser ---------- */
function bStats(pts, idx) {
  // pts: [[t, kurs]] dagliga. Returnerar riskmått för senaste året och fem år.
  const out = {};
  if (!pts || pts.length < 30) return out;
  const now = pts[pts.length - 1][0];
  const y1 = pts.filter((p) => p[0] >= now - 365 * 86400);
  const rets = (arr) => arr.slice(1).map((p, i) => ({ t: p[0], r: p[1] / arr[i][1] - 1 }));
  const r1 = rets(y1);
  const sd = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
  const logs = (a) => a.map((x) => Math.log(1 + x.r));
  if (r1.length >= 60) {
    out.vol1 = sd(logs(r1)) * Math.sqrt(252) * 100;
    const sorted = [...r1].sort((a, b) => a.r - b.r);
    out.var95 = sorted[Math.floor(sorted.length * 0.05)].r * 100;
    out.worst = { v: sorted[0].r * 100, t: sorted[0].t };
    out.best = { v: sorted[sorted.length - 1].r * 100, t: sorted[sorted.length - 1].t };
    out.days = r1.length;
    out.hist = r1.map((x) => x.r * 100);
  }
  const r30 = rets(pts.slice(-22));
  if (r30.length >= 15) out.vol30 = sd(logs(r30)) * Math.sqrt(252) * 100;
  const y3 = pts.filter((p) => p[0] >= now - 3 * 365 * 86400);
  if (y3.length > 500) out.vol3 = sd(logs(rets(y3))) * Math.sqrt(252) * 100;
  // Fall från toppen: hur långt under den högsta kursen hittills
  let peak = pts[0][1]; let peakT = pts[0][0]; let maxDd = 0; let maxDdT = null; let maxDdPeakT = null;
  let runStart = null; let longest = 0; let longestFrom = null; let longestTo = null;
  out.dd = pts.map(([t, c]) => {
    if (c >= peak) {
      if (runStart != null && t - runStart > longest) { longest = t - runStart; longestFrom = runStart; longestTo = t; }
      peak = c; peakT = t; runStart = null;
    } else if (runStart == null) runStart = peakT;
    const d = (c / peak - 1) * 100;
    if (d < maxDd) { maxDd = d; maxDdT = t; maxDdPeakT = peakT; }
    return [t, d];
  });
  const ongoing = runStart != null ? now - runStart : 0;
  out.maxDd = { v: maxDd, t: maxDdT, from: maxDdPeakT };
  out.nowDd = out.dd[out.dd.length - 1][1];
  out.recovery = ongoing > longest ? { days: ongoing / 86400, from: runStart, to: null } : longest ? { days: longest / 86400, from: longestFrom, to: longestTo } : null;
  out.years = (now - pts[0][0]) / (365 * 86400);
  // Sämsta kalendermånaden
  const lastOf = {}; for (const [t, c] of pts) lastOf[bKey(t).slice(0, 7)] = c;
  const ms = Object.keys(lastOf).sort(); let wm = null;
  for (let i = 1; i < ms.length; i++) { const r = (lastOf[ms[i]] / lastOf[ms[i - 1]] - 1) * 100; if (!wm || r < wm.v) wm = { v: r, m: ms[i] }; }
  out.worstMonth = wm;
  // Mot index: korrelation senaste året och de största börsfallen på fem år
  if (idx && idx.length > 60) {
    const map = new Map(pts.map(([t, c]) => [bKey(t), c]));
    const both = idx.map(([t, c]) => [bKey(t), c, map.get(bKey(t))]).filter((x) => x[2] != null);
    const b1 = both.filter((x) => x[0] >= bKey(now - 365 * 86400));
    const ra = []; const rb = [];
    for (let i = 1; i < b1.length; i++) { ra.push(b1[i][2] / b1[i - 1][2] - 1); rb.push(b1[i][1] / b1[i - 1][1] - 1); }
    if (ra.length >= 60) {
      const ma = ra.reduce((x, y) => x + y, 0) / ra.length; const mb = rb.reduce((x, y) => x + y, 0) / rb.length;
      let cov = 0; let va = 0; let vb = 0; for (let i = 0; i < ra.length; i++) { cov += (ra[i] - ma) * (rb[i] - mb); va += (ra[i] - ma) ** 2; vb += (rb[i] - mb) ** 2; }
      out.corr = cov / Math.sqrt(va * vb);
      out.betaOwn = cov / vb;
    }
    // Största fallen för index under 20 börsdagar, som inte överlappar varandra
    const W = 20; const wins = [];
    for (let i = W; i < both.length; i++) wins.push({ i, r: both[i][1] / both[i - W][1] - 1 });
    wins.sort((a, b) => a.r - b.r);
    const picked = [];
    for (const w of wins) { if (w.r > -0.05) break; if (picked.every((p) => Math.abs(p.i - w.i) >= W)) picked.push(w); if (picked.length === 4) break; }
    out.falls = picked.sort((a, b) => b.i - a.i).map((w) => ({ from: both[w.i - W][0], to: both[w.i][0], idx: w.r * 100, own: (both[w.i][2] / both[w.i - W][2] - 1) * 100 }));
  }
  return out;
}
// En kurs per dag. Dagens senaste kurs kan komma som en extra punkt, då gäller den senaste.
const bOnePerDay = (d) => { if (!d?.punkter?.length) return d; const m = new Map(); for (const p of d.punkter) m.set(bKey(p[0]), p); return { ...d, punkter: [...m.values()] }; };
const bMA = (pts, k) => { const o = []; let s = 0; for (let i = 0; i < pts.length; i++) { s += pts[i][1]; if (i >= k) s -= pts[i - k][1]; o.push(i >= k - 1 ? s / k : null); } return o; };

/* ---------- Kursdiagram med glidande medelvärden ---------- */
const B_PER = [['1m', '1M', 31], ['3m', '3M', 92], ['6m', '6M', 183], ['1y', '1Å', 366], ['3y', '3Å', 1096], ['5y', '5Å', 1830]];
function bPriceChart(box, pts, { per = '1y', ma50 = true, ma200 = true, from = null, to = null, valuta = '', h = 300 } = {}) {
  if (!pts?.length) { box.innerHTML = '<p class="b-note">Det finns inga kurser för det här värdepappret.</p>'; return null; }
  const A = bMA(pts, 50); const Bm = bMA(pts, 200);
  const last = pts[pts.length - 1][0];
  let i0 = 0; let i1 = pts.length - 1;
  if (from || to) {
    if (from) { const k = pts.findIndex((p) => bKey(p[0]) >= from); i0 = k < 0 ? pts.length - 1 : k; }
    if (to) { let k = -1; for (let i = pts.length - 1; i >= 0; i--) if (bKey(pts[i][0]) <= to) { k = i; break; } i1 = k < 0 ? 0 : k; }
  } else {
    const days = (B_PER.find((x) => x[0] === per) || B_PER[3])[2];
    const k = pts.findIndex((p) => p[0] >= last - days * 86400); i0 = k < 0 ? 0 : k;
  }
  if (i1 - i0 < 1) { box.innerHTML = '<p class="b-note">Det finns för få kurser mellan de datumen. Välj en längre period.</p>'; return null; }
  const P = pts.slice(i0, i1 + 1); const a = A.slice(i0, i1 + 1); const b = Bm.slice(i0, i1 + 1);
  const vals = [...P.map((p) => p[1]), ...(ma50 ? a.filter((v) => v != null) : []), ...(ma200 ? b.filter((v) => v != null) : [])];
  let lo = Math.min(...vals); let hi = Math.max(...vals); const pad = (hi - lo) * 0.06 || 1; lo -= pad; hi += pad;
  const W = 1000; const H = h; const t0 = P[0][0]; const t1 = P[P.length - 1][0];
  const X = (t) => ((t - t0) / (t1 - t0 || 1)) * W; const Y = (v) => (1 - (v - lo) / (hi - lo)) * H;
  const line = (arr) => { let d = ''; let on = false; arr.forEach((v, i) => { if (v == null) { on = false; return; } d += `${on ? 'L' : 'M'}${X(P[i][0]).toFixed(1)},${Y(v).toFixed(1)}`; on = true; }); return d; };
  const main = line(P.map((p) => p[1]));
  const chg = (P[P.length - 1][1] / P[0][1] - 1) * 100;
  const col = chg >= 0 ? 'var(--up)' : 'var(--down)';
  const grid = [0.25, 0.5, 0.75].map((f) => `<line x1="0" x2="${W}" y1="${(f * H).toFixed(1)}" y2="${(f * H).toFixed(1)}" stroke="var(--line-soft)" vector-effect="non-scaling-stroke"/>`).join('');
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => { const t = t0 + f * (t1 - t0); const d = new Date(t * 1000); const span = t1 - t0; return { f, l: span < 100 * 86400 ? `${d.getDate()} ${bMon(d.getMonth())}` : `${bMon(d.getMonth())} ${String(d.getFullYear()).slice(2)}` }; });
  const hiP = Math.max(...P.map((p) => p[1])); const loP = Math.min(...P.map((p) => p[1]));
  box.innerHTML = `
    <div class="b-chart" style="--h:${h}px">
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Kursdiagram">
        <defs><linearGradient id="bpg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity="0.2"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
        ${grid}
        <path d="${main}L${W},${H}L0,${H}Z" fill="url(#bpg)"/>
        ${ma200 ? `<path d="${line(b)}" fill="none" stroke="var(--b-ma200)" stroke-width="1.5" vector-effect="non-scaling-stroke"/>` : ''}
        ${ma50 ? `<path d="${line(a)}" fill="none" stroke="var(--b-ma50)" stroke-width="1.5" vector-effect="non-scaling-stroke"/>` : ''}
        <path d="${main}" fill="none" stroke="${col}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
      </svg>
      <span class="b-yl top num">${esc(EN ? 'High' : 'Högst')} ${kr(hiP)}</span><span class="b-yl bot num">${esc(EN ? 'Low' : 'Lägst')} ${kr(loP)}</span>
      <span class="chart-cross" hidden></span><span class="chart-dot" hidden style="background:${col}"></span>
      <div class="chart-tip" hidden></div>
    </div>
    <div class="b-xt num">${ticks.map((x) => `<span>${esc(x.l)}</span>`).join('')}</div>`;
  const plot = box.querySelector('.b-chart'); const tipEl = plot.querySelector('.chart-tip'); const cross = plot.querySelector('.chart-cross'); const dot = plot.querySelector('.chart-dot');
  let fr = 0; let lx = 0;
  const move = () => {
    fr = 0; const r = plot.getBoundingClientRect(); const fx = Math.min(1, Math.max(0, (lx - r.left) / r.width)); const t = t0 + fx * (t1 - t0);
    let k = 0; for (let i = 0; i < P.length; i++) if (Math.abs(P[i][0] - t) < Math.abs(P[k][0] - t)) k = i;
    const px = (X(P[k][0]) / W) * r.width; const py = (Y(P[k][1]) / H) * r.height;
    cross.hidden = false; cross.style.transform = `translateX(${px}px)`; dot.hidden = false; dot.style.transform = `translate(${px}px, ${py}px)`;
    tipEl.hidden = false;
    tipEl.innerHTML = `<span class="small muted">${esc(bDate(bKey(P[k][0])))}</span><b class="num">${kr(P[k][1])} ${esc(cur(valuta))}</b>${ma50 && a[k] != null ? `<span class="small num" style="color:var(--b-ma50)">MA50 ${kr(a[k])}</span>` : ''}${ma200 && b[k] != null ? `<span class="small num" style="color:var(--b-ma200)">MA200 ${kr(b[k])}</span>` : ''}`;
    const tw = tipEl.offsetWidth; tipEl.style.transform = `translateX(${Math.min(r.width - tw, Math.max(0, px - tw / 2))}px)`;
  };
  plot.addEventListener('pointermove', (e) => { lx = e.clientX; if (!fr) fr = requestAnimationFrame(move); });
  plot.addEventListener('pointerleave', () => { tipEl.hidden = true; cross.hidden = true; dot.hidden = true; });
  return { chg, from: P[0][0], to: P[P.length - 1][0], ma50: A[A.length - 1], ma200: Bm[Bm.length - 1] };
}

/* ---------- Små diagram ---------- */
const bGauge = (p) => {
  const arc = (a0, a1, r) => { const pt = (a) => `${(80 + r * Math.cos(a)).toFixed(2)} ${(80 + r * Math.sin(a)).toFixed(2)}`; return `M${pt(a0)} A${r} ${r} 0 0 1 ${pt(a1)}`; };
  return `<svg viewBox="0 0 160 92" class="b-gauge" role="img" aria-label="Riskkoll ${p ?? 'saknas'} av 10">${Array.from({ length: 10 }, (_, i) => { const a0 = Math.PI + i * Math.PI / 10 + 0.025; const a1 = Math.PI + (i + 1) * Math.PI / 10 - 0.025; const c = i < 3 ? 'var(--up)' : i < 6 ? 'var(--warn)' : 'var(--down)'; return `<path d="${arc(a0, a1, 62)}" stroke="${p != null && i < p ? c : 'var(--line)'}" stroke-width="12" fill="none"/>`; }).join('')}<text x="80" y="78" text-anchor="middle" font-size="32" font-weight="500" fill="var(--ink)">${p ?? '–'}</text><text x="80" y="91" text-anchor="middle" font-size="9.5" fill="var(--muted)">${EN ? 'of 10' : 'av 10'}</text></svg>`;
};
const bSeg = (l) => `<span class="b-seg" aria-hidden="true">${[1, 2, 3].map((i) => `<i style="background:${i <= l ? `var(--${LV[l].c})` : 'var(--line)'}"></i>`).join('')}</span>`;
const bLevel = (l) => `<span class="pill ${LV[l].c}">${LV[l].t}</span>`;
// Staplar per period. vals: [{l, v, txt}] där v kan vara null (visas som saknat)
function bBars(vals, { hl = vals.length - 1, h = 120 } = {}) {
  const ok = vals.filter((x) => x.v != null);
  if (!ok.length) return '<p class="b-note">Saknas i datakällan.</p>';
  const mx = Math.max(0, ...ok.map((x) => x.v)); const mn = Math.min(0, ...ok.map((x) => x.v)); const span = mx - mn || 1;
  return `<div class="b-bars" style="--bh:${h}px">${vals.map((x, i) => {
    if (x.v == null) return `<div class="b-bar"><span class="b-bar-v faint">–</span><span class="b-bar-area"></span><span class="b-bar-l">${esc(x.l)}</span></div>`;
    const top = ((mx - Math.max(x.v, 0)) / span) * 100; const hh = (Math.abs(x.v) / span) * 100;
    return `<div class="b-bar ${i === hl ? 'hl' : ''} ${x.v < 0 ? 'neg' : ''}" title="${esc(x.l + ': ' + x.txt)}"><span class="b-bar-v num">${esc(x.s ?? x.txt)}</span><span class="b-bar-area"><i style="top:${top.toFixed(1)}%;height:${Math.max(1.5, hh).toFixed(1)}%"></i>${mn < 0 ? `<b style="top:${((mx / span) * 100).toFixed(1)}%"></b>` : ''}</span><span class="b-bar-l">${esc(x.l)}</span></div>`;
  }).join('')}</div>`;
}
const bSpark = (pts, base, col) => {
  if (!pts?.length) return '';
  const vs = pts.map((p) => p[1]).concat(base != null ? [base] : []); const lo = Math.min(...vs); const hi = Math.max(...vs); const t0 = pts[0][0]; const t1 = pts[pts.length - 1][0];
  const X = (t) => ((t - t0) / (t1 - t0 || 1)) * 100; const Y = (v) => 2 + (1 - (v - lo) / (hi - lo || 1)) * 26;
  return `<svg viewBox="0 0 100 30" preserveAspectRatio="none" class="b-spark" aria-hidden="true">${base != null ? `<line x1="0" x2="100" y1="${Y(base).toFixed(1)}" y2="${Y(base).toFixed(1)}" stroke="var(--line)" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>` : ''}<path d="${pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('')}" fill="none" stroke="${col}" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>`;
};

/* ---------- Rapportsiffror ---------- */
const bYear = (r) => r.datum.slice(0, 4);
const bQ = (r) => { const d = new Date(r.datum + 'T12:00:00'); return `${bMon(d.getMonth())} ${String(d.getFullYear()).slice(2)}`; };
const bRatio = (a, b) => (a == null || b == null || b === 0 ? null : a / b);
const bYoY = (rows, r, f) => { const d = new Date(r.datum + 'T12:00:00'); const k = `${d.getFullYear() - 1}-${String(d.getMonth() + 1).padStart(2, '0')}`; const p = rows.find((x) => x.datum.slice(0, 7) === k); const a = f(r); const b = p ? f(p) : null; return { prev: p, a, b }; };
const B_MET = {
  oms: { n: 'Försäljning', k: 'Försäljning', f: (r) => r.oms, fmt: (v, c) => bBig(v, c) },
  rorelse: { n: 'Rörelseresultat', k: 'Rörelseresultat', f: (r) => r.rorelse, fmt: (v, c) => bBig(v, c) },
  marg: { n: 'Rörelsemarginal', k: 'Rörelsemarginal', f: (r) => (bRatio(r.rorelse, r.oms) == null ? null : bRatio(r.rorelse, r.oms) * 100), fmt: (v) => bPct(v), pp: true },
  netmarg: { n: 'Vinstmarginal', k: 'Vinstmarginal', f: (r) => (bRatio(r.netto, r.oms) == null ? null : bRatio(r.netto, r.oms) * 100), fmt: (v) => bPct(v), pp: true },
  eps: { n: 'Vinst per aktie', k: 'Vinst per aktie', f: (r) => r.eps, fmt: (v, c) => (v == null ? null : `${bn(v, 2)} ${cur(c)}`) },
  fcf: { n: 'Fritt kassaflöde', k: 'Fritt kassaflöde', f: (r) => r.fcf, fmt: (v, c) => bBig(v, c) },
  utd: { n: 'Utbetald utdelning', k: 'Utbetald utdelning', f: (r) => (r.utd == null ? null : Math.abs(r.utd)), fmt: (v, c) => bBig(v, c) },
  sol: { n: 'Soliditet', k: 'Soliditet', f: (r) => (bRatio(r.ek, r.tillg) == null ? null : bRatio(r.ek, r.tillg) * 100), fmt: (v) => bPct(v) },
  de: { n: 'Skuld / eget kapital', k: 'Skuld / eget kapital', f: (r) => bRatio(r.skuld, r.ek), fmt: (v) => bn(v, 2) }
};
// Ändring mot förra perioden. Marginaler i procentenheter, belopp i procent. Negativ bas ger ingen procent.
const bChange = (m, a, b) => {
  if (a == null || b == null) return null;
  if (B_MET[m]?.pp) { const d = a - b; return { t: `${d >= 0 ? '+' : '−'}${bn(Math.abs(d), 1)} ${EN ? 'pp' : 'procentenheter'}`, v: d }; }
  if (b <= 0) return null;
  const d = (a / b - 1) * 100; return { t: bSign(d), v: d };
};
// Kort etikett ovanför staplar: belopp i miljarder utan enhet
const bShort = (m, v) => (['oms', 'rorelse', 'fcf', 'utd'].includes(m) ? bn(v / 1e9, Math.abs(v) >= 1e11 ? 0 : 1) : m === 'eps' ? bn(v, 2) : m === 'de' ? bn(v, 2) : bn(v, 1));
const bAnnualSeries = (rep, m) => {
  const rows = rep.ar.map((r) => ({ l: bYear(r), v: B_MET[m].f(r) }));
  if (rep.ttm && !['sol', 'de'].includes(m)) rows.push({ l: EN ? '12 m' : '12 mån', v: B_MET[m].f(rep.ttm) });
  else if (rep.ttm && rep.kvartal.length) rows.push({ l: EN ? 'Latest' : 'Senast', v: B_MET[m].f(rep.kvartal[rep.kvartal.length - 1]) });
  return rows.map((x) => ({ ...x, txt: x.v == null ? '–' : B_MET[m].fmt(x.v, rep.valuta), s: x.v == null ? '–' : bShort(m, x.v) }));
};

/* ---------- Sidan ---------- */
function viewBolag(sym) {
  return `
  ${topbar([[EN ? 'Companies' : 'Bolag', '/sok'], [nameOf(sym), '/bolag/' + encodeURIComponent(sym)]])}
  <div id="bolag" class="b-page">${loading('Hämtar bolaget …')}</div>
  ${footer()}`;
}

function bHead(s, tabs, active) {
  const watched = getWatch().includes(s.sym);
  const hi = s.fakta?.find((x) => x[0] === '52 veckor')?.[1];
  const rng = (() => { const m = /^([\d\s.,]+)–([\d\s.,]+)$/.exec(hi || ''); if (!m) return null; const p = (x) => Number(x.replace(/\s/g, '').replace(',', '.')); const lo = p(m[1]); const h = p(m[2]); if (!(h > lo) || s.kurs == null) return null; return { lo, h, f: Math.min(100, Math.max(0, ((s.kurs - lo) / (h - lo)) * 100)) }; })();
  const nt = Object.fromEntries((s.nyckeltal || []).map(([k, v]) => [k, v]));
  const stats = [
    ['Börsvärde', s.fakta?.find((x) => x[0] === 'Börsvärde')?.[1] ?? null, 'Börsvärde'],
    ['P/E', nt['P/E'] ?? null, 'P/E'],
    ['Direktavkastning', nt.Direktavkastning ?? null, 'Direktavkastning'],
    ['Riskkoll', s.poang != null ? `${s.poang} / 10` : null, 'Riskkoll'],
    ['Beta', s.beta != null ? bn(s.beta, 2) : null, 'Beta']
  ];
  return `
  <section class="b-card b-top">
    <div class="b-top-row">
      <div class="b-id">
        <span class="b-av">${esc(s.kort)}${symFlag(s.sym, 'on-avatar')}</span>
        <div style="min-width:0">
          <h1 class="b-name">${esc(s.namn)}</h1>
          <div class="b-chips"><span>${esc(s.sym)}</span>${s.lista ? `<span>${esc(s.lista)}</span>` : ''}${s.aktieslag ? `<span>${esc(s.aktieslag)}${tip('Aktieslag')}</span>` : ''}</div>
        </div>
      </div>
      <div class="b-px">
        <div class="b-px-main"><span class="num b-px-v">${s.kurs != null ? kr(s.kurs) : '–'}</span><span class="muted">${esc(cur(s.valuta))}</span></div>
        ${s.d1 != null ? `<span class="num b-px-d ${tone(s.d1)}">${esc(pct(s.d1))} ${EN ? 'today' : 'i dag'}</span>` : '<span class="faint small">Dagens förändring saknas</span>'}
        <span class="b-px-t"><i class="b-live" aria-hidden="true"></i>${esc(EN ? 'Latest price' : 'Senaste kurs')} ${esc(when(s.kursTid || s.hamtad))}${s.sym.endsWith('.ST') ? (EN ? ' · delayed 15 min' : ' · fördröjd 15 min') : ''}</span>
      </div>
      <div class="b-acts">
        <button class="btn small ${watched ? 'ghost' : ''}" type="button" data-watch="${esc(s.sym)}" data-namn="${esc(s.namn)}" aria-pressed="${watched}">${watched ? 'Bevakas ✓' : 'Bevaka'}</button>
        <a class="btn small ghost" href="/jamfor?a=${encodeURIComponent(s.sym)}" data-link>${svg('compare', 14)} Jämför</a>
        <button type="button" class="btn small ghost" data-share>${svg('share', 14)} Dela</button>
      </div>
    </div>
    <div class="b-stats">
      ${stats.map(([k, v, t]) => `<div><span class="b-stat-k">${esc(k)}${tip(t)}</span><b class="num">${bMiss(v)}</b></div>`).join('')}
      <div class="b-52"><span class="b-stat-k">52 veckor${tip('52 veckor')}</span>${rng ? `<span class="b-52-bar"><i style="width:${rng.f.toFixed(0)}%"></i><b style="left:${rng.f.toFixed(0)}%"></b></span><span class="b-52-l num"><span>${kr(rng.lo)}</span><span>${kr(rng.h)}</span></span>` : `<b>${bMiss(null)}</b>`}</div>
    </div>
    <div class="b-tabs" role="tablist" aria-label="Delar av bolagssidan">
      ${tabs.map(([k, t]) => `<button role="tab" type="button" data-btab="${k}" aria-selected="${k === active}">${esc(t)}</button>`).join('')}
    </div>
  </section>
  <div id="b-panel" role="tabpanel"></div>`;
}

async function mountBolag(sym) {
  const s = await getStock(sym);
  const el = $('#bolag'); if (!el) return;
  if (s.error) {
    el.innerHTML = `<div class="card stack" style="max-width:640px;padding:28px"><span class="label-up">${esc(sym)}</span><h1 class="title" style="font-size:34px">${esc(nameOf(sym))}</h1><p class="muted" style="margin:0">${esc(errText(s.error))}</p><div class="chips" id="alt"><a class="btn ghost" href="/sok" data-link>Till sök</a></div></div>`;
    if (sym.includes('.')) {
      const term = nameOf(sym).replace(/\b(AB|ser\.?|Shs|[AB])\b|-[AB]\b|\(publ\)/gi, ' ').replace(/\s+/g, ' ').trim().split(' ')[0];
      const r = term && term.length > 1 ? await api('/api/search?q=' + encodeURIComponent(term), 60 * 60e3) : null;
      const STOP = new Set(['ab', 'the', 'inc', 'corp', 'co', 'ser', 'class', 'adr', 'ads', 'sponsored', 'unsponsored', 'unsp', 'shs', 'publ', 'a', 'b']);
      const first = (t) => String(t).toLowerCase().replace(/[().,]/g, ' ').split(/[\s-]+/).filter((w) => w && !STOP.has(w))[0] || '';
      const alt = r?.results?.find((x) => !x.sym.includes('.') && first(x.namn) === first(term) && (x.typ === 'ADR' || /\b(adr|sponsored|unsponsored)\b/i.test(x.namn)));
      if (alt && $('#alt')) $('#alt').insertAdjacentHTML('afterbegin', `<a class="btn" href="/bolag/${encodeURIComponent(alt.sym)}" data-link>Visa ${esc(alt.namn)} (${esc(alt.sym)}), noterad i USA</a>`);
    }
    return;
  }
  { const nm = String(s.namn).replace(/\s*\(publ\.?\)/i, '').trim(); const tk = String(s.sym || sym).replace(/\.[A-Z]{1,3}$/, ''); document.title = EN ? `${nm} (${tk}) stock: risk, reports, insider trading · Finanskollen` : `${nm} (${tk}) aktie: risk, rapporter och insynshandel · Finanskollen`; }
  setMeta({}, EN ? `${s.namn}: risk check ${s.poang != null ? s.poang + ' of 10' : ''}, price chart, reports, insider trading and news. Free, without buy tips.` : `${s.namn}: riskkoll ${s.poang != null ? s.poang + ' av 10' : ''}, kursdiagram, rapporter, insynshandel och nyheter. Gratis och utan köptips.`);
  const crumb = $('.crumbs .here'); if (crumb) crumb.textContent = s.namn;

  const se = isSwedish(s.sym);
  const isEq = !s.typ || s.typ === 'Aktie';
  const tabs = B_TABS.filter(([k]) => (k !== 'insyn' || se) && (isEq || !['rapporter', 'kalender'].includes(k)));
  const params = new URLSearchParams(location.search);
  let active = tabs.some((t) => t[0] === params.get('flik')) ? params.get('flik') : 'oversikt';
  el.innerHTML = bHead(s, tabs, active);

  // Data hämtas en gång per sidvisning och delas mellan flikarna
  const C = {};
  const idxSym = se ? '^OMX' : '^GSPC'; const idxName = se ? 'OMXS30' : 'S&P 500';
  const get = {
    px: () => (C.px ||= api(`/api/chart?s=${encodeURIComponent(sym)}&r=5yd`, 30 * 60e3).then(bOnePerDay)),
    idx: () => (C.idx ||= api(`/api/chart?s=${encodeURIComponent(idxSym)}&r=5yd`, 30 * 60e3).then(bOnePerDay)),
    rep: () => (C.rep ||= isEq ? api(`/api/rapporter?s=${encodeURIComponent(sym)}`, 6 * 3600e3) : Promise.resolve({ error: 'ingen' })),
    kal: () => (C.kal ||= isEq ? api(`/api/kalender?s=${encodeURIComponent(sym)}`, 6 * 3600e3) : Promise.resolve({ error: 'ingen' })),
    insyn: () => (C.insyn ||= se ? api('/api/insyn?namn=' + encodeURIComponent(s.namn), 60 * 60e3) : Promise.resolve(null)),
    blank: () => (C.blank ||= se ? api('/api/blankning?namn=' + encodeURIComponent(s.namn), 60 * 60e3) : Promise.resolve(null)),
    news: () => (C.news ||= api('/api/news?s=' + encodeURIComponent(sym), 5 * 60e3)),
    today: () => (C.today ||= api(`/api/chart?s=${encodeURIComponent(sym)}&r=1d`, 5 * 60e3)),
    stats: async () => (C.stats ||= (async () => { const [p, i] = await Promise.all([get.px(), get.idx()]); return bStats(p?.punkter, i?.punkter); })())
  };
  const st = { per: '1y', ma50: true, ma200: true, from: null, to: null, sp: 1, qm: 'oms', fs: 'res', day: null };
  const ctx = { s, sym, se, isEq, get, st, idxName };

  const show = (k) => {
    active = k;
    el.querySelectorAll('[data-btab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.btab === k)));
    const u = new URL(location.href); if (k === 'oversikt') u.searchParams.delete('flik'); else u.searchParams.set('flik', k);
    history.replaceState(history.state, '', u.pathname + u.search);
    const panel = $('#b-panel'); panel.innerHTML = '';
    ({ oversikt: bOversikt, kurs: bKurs, dagen: bDagen, risk: bRisk, rapporter: bRapporter, insyn: bInsyn, kalender: bKalender, nyheter: bNyheter, om: bOm })[k](panel, ctx);
  };
  ctx.go = (k) => { show(k); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  show(active);

  el.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-btab]'); if (t) { show(t.dataset.btab); return; }
    const g = e.target.closest('[data-bgo]'); if (g) { e.preventDefault(); ctx.go(g.dataset.bgo); return; }
    if (e.target.closest('[data-share]')) {
      const url = location.origin + '/bolag/' + encodeURIComponent(s.sym); const title = `${s.namn} · Finanskollen`;
      try { if (navigator.share) { await navigator.share({ title, url }); return; } await navigator.clipboard.writeText(url); toast('Länken är kopierad', 'Klistra in den där du vill dela den.'); }
      catch (err) { if (err?.name !== 'AbortError') toast('Kunde inte dela', url); }
      return;
    }
    const w = e.target.closest('[data-watch]'); if (!w) return;
    if (askLogin()) return;
    const on = toggleWatch(w.dataset.watch, w.dataset.namn);
    w.textContent = on ? 'Bevakas ✓' : 'Bevaka'; w.setAttribute('aria-pressed', String(on)); w.classList.toggle('ghost', on);
    refreshNav('sok');
  });
  el.querySelector('.b-tabs').addEventListener('keydown', (e) => {
    if (!['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
    const bs = [...el.querySelectorAll('[data-btab]')]; const i = bs.findIndex((b) => b.dataset.btab === active);
    const n = bs[(i + (e.key === 'ArrowRight' ? 1 : -1) + bs.length) % bs.length]; n.focus(); show(n.dataset.btab);
  });
}

/* ---------- Gemensamma delar ---------- */
function bChartControls(st, { dates = false } = {}) {
  return `<div class="b-ctrl">
    <div class="b-segc" role="tablist" aria-label="Period">${B_PER.map(([k, l]) => `<button type="button" role="tab" data-per="${k}" aria-selected="${!st.from && !st.to && st.per === k}">${l}</button>`).join('')}</div>
    <span class="b-togw"><button type="button" class="b-tog ma50" data-ma="ma50" aria-pressed="${st.ma50}">MA50</button>${tip('MA50')}</span>
    <span class="b-togw"><button type="button" class="b-tog ma200" data-ma="ma200" aria-pressed="${st.ma200}">MA200</button>${tip('MA200')}</span>
    ${dates ? `<span class="b-dates"><label>Från <input type="date" data-from value="${esc(st.from || '')}"></label><label>till <input type="date" data-to value="${esc(st.to || '')}"></label></span>` : ''}
  </div>`;
}
function bWireChart(root, ctx, draw) {
  root.addEventListener('click', (e) => {
    if (e.target.closest('.tip')) return;
    const p = e.target.closest('[data-per]'); if (p) { ctx.st.per = p.dataset.per; ctx.st.from = null; ctx.st.to = null; root.querySelectorAll('[data-per]').forEach((b) => b.setAttribute('aria-selected', String(b === p))); root.querySelectorAll('[data-from],[data-to]').forEach((i) => { i.value = ''; }); draw(); return; }
    const m = e.target.closest('[data-ma]'); if (m) { ctx.st[m.dataset.ma] = !ctx.st[m.dataset.ma]; m.setAttribute('aria-pressed', String(ctx.st[m.dataset.ma])); draw(); }
  });
  root.addEventListener('change', (e) => {
    if (e.target.matches('[data-from]')) ctx.st.from = e.target.value || null;
    else if (e.target.matches('[data-to]')) ctx.st.to = e.target.value || null;
    else return;
    root.querySelectorAll('[data-per]').forEach((b) => b.setAttribute('aria-selected', 'false'));
    draw();
  });
}
const bLink = (k, t) => `<button type="button" class="b-more" data-bgo="${k}">${esc(t)} →</button>`;

/* ---------- Översikt ---------- */
function bOversikt(panel, ctx) {
  const { s, se, st, get } = ctx;
  panel.innerHTML = `<div class="b-grid">
    ${bCard('c7', `<div class="b-ch"><div class="b-chl">${bLabel('Aktiekurs')}<span class="small num" id="ov-chg"></span></div>${bChartControls(st)}</div><div id="ov-chart">${loading('Hämtar kurser …')}</div><div class="b-foot">${bLink('kurs', 'Större diagram och egna datum')}</div>`)}
    ${bCard('c3', bRiskMini(s))}
    <div class="c2 b-quick">
      <button type="button" class="b-card b-q" data-bgo="dagen"><span class="b-lbl">Dagen</span><b class="num" id="q-day">–</b><span id="q-spark" class="b-q-sp"></span><span class="b-q-s" id="q-day-s">Hämtar …</span></button>
      <button type="button" class="b-card b-q" data-bgo="kalender"><span class="b-lbl">Nästa rapport</span><b id="q-kal">–</b><span class="b-q-s" id="q-kal-s">Hämtar …</span></button>
      <button type="button" class="b-card b-q" data-bgo="risk"><span class="b-lbl">${se ? 'Blankning' : 'Fall från toppen'}</span><b class="num" id="q-3">–</b><span class="b-q-s" id="q-3-s">Hämtar …</span></button>
    </div>
    ${bCard('c7', `<div class="b-ch">${bLabel('Rapporter, per år')}${bLink('rapporter', 'Alla rapporter och nyckeltal')}</div><div id="ov-rep">${loading('Hämtar rapportsiffror …')}</div>`)}
    ${bCard('c5', se ? `<div class="b-ch">${bLabel('Insyn och blankning', 'Insynshandel')}${bLink('insyn', 'Alla affärer')}</div><div id="ov-insyn">${loading('Hämtar insynsaffärer …')}</div>` : `<div class="b-ch">${bLabel('Nyckeltal')}${bLink('rapporter', 'Alla nyckeltal')}</div>${bKeyMini(s)}`)}
  </div>`;
  const draw = async () => {
    const d = await get.px(); const box = $('#ov-chart'); if (!box) return;
    if (!d || d.error || !d.punkter?.length) { box.innerHTML = bErr(d, 'Det finns inget kursdiagram för det här värdepappret.'); return; }
    const r = bPriceChart(box, d.punkter, { per: st.per, ma50: st.ma50, ma200: st.ma200, valuta: d.valuta, h: 250 });
    const c = $('#ov-chg'); if (c && r) { c.textContent = `${pct(r.chg)} ${EN ? 'in the period' : 'under perioden'}`; c.className = `small num ${tone(r.chg)}`; }
  };
  bWireChart(panel.querySelector('.c7'), ctx, draw); draw();
  // Dagen
  get.today().then((d) => {
    const v = $('#q-day'); if (!v) return;
    const pts = d?.punkter || []; const prev = d?.prevClose ?? null;
    const lastP = s.kurs ?? (pts.length ? pts[pts.length - 1][1] : null);
    if (s.d1 == null) { v.textContent = '–'; $('#q-day-s').textContent = d?.error ? errText(d) : 'Dagens förändring saknas'; return; }
    v.textContent = pct(s.d1); v.className = 'num ' + tone(s.d1);
    $('#q-spark').innerHTML = bSpark(pts, prev, s.d1 >= 0 ? 'var(--up)' : 'var(--down)');
    $('#q-day-s').textContent = lastP != null ? `${kr(lastP)} ${cur(s.valuta)} · ${EN ? 'see the day' : 'se dagen'} →` : (EN ? 'See the day →' : 'Se dagen →');
  });
  get.kal().then((k) => {
    const v = $('#q-kal'); if (!v) return; const today = isoDay(Date.now());
    if (!k || k.error || !k.rapport) { v.textContent = '–'; $('#q-kal-s').textContent = k?.error && k.error !== 'ingen' ? 'Kunde inte hämtas just nu' : 'Datum inte känt än'; return; }
    v.textContent = bDate(k.rapport); $('#q-kal-s').textContent = k.rapport >= today ? `${k.rapportUppskattad ? 'Preliminärt · ' : ''}${EN ? 'in' : 'om'} ${Math.round((new Date(k.rapport + 'T12:00:00') - Date.now()) / 864e5)} ${EN ? 'days' : 'dagar'} →` : (EN ? 'Latest report →' : 'Senaste rapporten →');
  });
  if (se) get.blank().then((d) => {
    const v = $('#q-3'); if (!v) return;
    if (!d || d.error) { v.textContent = '–'; $('#q-3-s').textContent = 'FI svarar inte just nu'; return; }
    if (!d.bolag) { v.textContent = '0 %'; $('#q-3-s').textContent = 'Ingen anmäld position'; return; }
    v.textContent = pc(d.bolag.summa); $('#q-3-s').textContent = `${d.bolag.positioner.length} ${EN ? 'investors' : 'investerare'} →`;
  });
  else get.stats().then((x) => { const v = $('#q-3'); if (!v) return; if (x.nowDd == null) { v.textContent = '–'; $('#q-3-s').textContent = 'Saknas'; return; } v.textContent = bSign(x.nowDd); v.className = 'num ' + (x.nowDd < -0.05 ? 'down' : ''); $('#q-3-s').textContent = 'under högsta kursen på 5 år →'; });
  get.rep().then((rep) => {
    const box = $('#ov-rep'); if (!box) return;
    if (!rep || rep.error || !rep.ar?.length) { box.innerHTML = bErr(rep, 'Datakällan har inga rapportsiffror för bolaget.'); return; }
    box.innerHTML = `<div class="b-mini4">${['oms', 'marg', 'eps', 'fcf'].map((m) => { const ser = bAnnualSeries(rep, m); const last = ser[ser.length - 1]; return `<div><span class="b-mini-k">${esc(B_MET[m].n)}${tip(B_MET[m].k)}</span><b class="num">${bMiss(last.v == null ? null : last.txt)}</b><span class="b-mini-s">${esc(last.l)}</span>${bBars(ser, { h: 56 })}</div>`; }).join('')}</div><p class="b-src">${esc(rep.valuta ? `Belopp i ${cur(rep.valuta)}. ` : '')}Källa: ${esc(rep.kalla || 'Yahoo Finance')}.</p>`;
  });
  if (se) Promise.all([get.insyn(), get.blank()]).then(([d, b]) => {
    const box = $('#ov-insyn'); if (!box) return;
    let h = '';
    if (!d || d.error) h += `<p class="b-note">${FI_DOWN}</p>`;
    else if (d.saknas) h += '<p class="b-note">Bolaget finns inte i Finansinspektionens insynsregister.</p>';
    else if (!d.affarer?.length) h += '<p class="b-note">Inga anmälda insynsaffärer de senaste tolv månaderna.</p>';
    else h += `<div class="b-trades">${d.affarer.slice(0, 4).map((a) => `<div><span class="num faint">${esc(dag(a.datum))}</span><span class="b-ell">${esc(a.person)}<span class="faint"> · ${esc(a.roll || '')}</span></span>${tradePill(a.typ)}<span class="num">${a.varde != null ? esc(mny(a.varde, a.valuta)) : a.volym != null ? esc(nf(a.volym, 0)) + ' st' : '–'}</span></div>`).join('')}</div>
      <div class="b-kv"><span>Köp 12 mån</span><b class="num">${d.kop.antal} st · ${esc(mny(d.kop.varde, d.valuta))}</b></div><div class="b-kv"><span>Sälj 12 mån</span><b class="num">${d.salj.antal} st · ${esc(mny(d.salj.varde, d.valuta))}</b></div>`;
    h += `<div class="b-kv"><span>Blankat${tip('Blankning')}</span><b class="num">${!b || b.error ? '<span class="faint">FI svarar inte</span>' : b.bolag ? `${esc(pc(b.bolag.summa))} · ${b.bolag.positioner.length} ${EN ? 'investors' : 'investerare'}` : (EN ? 'No reported position' : 'Ingen anmäld position')}</b></div>`;
    box.innerHTML = h + '<p class="b-src">Källa: Finansinspektionen.</p>';
  });
}
function bRiskMini(s) {
  const lvl = lvlOf(s.poang);
  return `<div class="b-ch">${bLabel('Riskkoll', 'Riskkoll')}<span class="faint small">${EN ? 'Updated' : 'Uppdaterad'} ${esc(when(s.hamtad))}</span></div>
    <div class="b-rk">${bGauge(s.poang)}<div>${lvl ? bLevel(lvl) : '<span class="faint">För lite data</span>'}<p class="small muted" style="margin:6px 0 0">${esc(s.faktorer?.length ? `${s.faktorer.length} ${EN ? 'parts weighed together' : 'delar vägda samman'}` : '')}</p></div></div>
    ${s.faktorer?.length ? `<div class="b-frows">${s.faktorer.map(([n, l, v]) => `<div title="${esc(v)}"><span>${esc(n)}${tip(n)}</span>${bSeg(l)}<span class="${LV[l].c}">${LV[l].t}</span></div>`).join('')}</div>` : '<p class="b-note">Datakällan har för få nyckeltal för en riskkoll.</p>'}
    <div class="b-foot">${bLink('risk', 'Hela riskanalysen')}</div>`;
}
function bKeyMini(s) {
  const nt = (s.nyckeltal || []).filter(([k]) => ['P/E', 'Vinst per aktie (EPS)', 'Direktavkastning', 'Vinstmarginal', 'Rörelsemarginal', 'Avkastning på eget kapital'].includes(k));
  if (!nt.length) return '<p class="b-note">Datakällan har inga nyckeltal för det här värdepappret.</p>';
  return `<div class="b-kgrid">${nt.map(([k, v, h]) => `<div><span class="b-mini-k">${esc(k)}${tip(k)}</span><b class="num">${bMiss(v)}</b></div>`).join('')}</div><p class="b-src">Källa: Yahoo Finance, senaste 12 månaderna.</p>`;
}

/* ---------- Kurs och diagram ---------- */
function bKurs(panel, ctx) {
  const { s, st, get } = ctx;
  const max = Math.max(...(s.perf || []).map((p) => Math.abs(p[1])), 1);
  panel.innerHTML = `<div class="b-grid">
    ${bCard('c12', `<div class="b-ch"><div class="b-chl">${bLabel('Aktiekurs')}<span class="small num" id="k-chg"></span></div>${bChartControls(st, { dates: true })}</div><div id="k-chart">${loading('Hämtar kurser …')}</div><p class="b-src" id="k-src"></p>`)}
    ${bCard('c4', `${bLabel('Utveckling')}<div class="stack" style="gap:10px;margin-top:6px">${(s.perf || []).map(([label, v]) => { const w = (Math.abs(v) / max) * 50; return `<div class="perf-row"><span class="muted">${esc(label)}</span><div class="perf-track" role="img" aria-label="${esc(label)} ${pct(v)}"><span class="zero"></span><span class="perf-bar ${v < 0 ? 'neg' : ''}" style="${v < 0 ? `right:50%;width:${w}%` : `left:50%;width:${w}%`}"></span></div><span class="num ${tone(v)}" style="text-align:right">${pct(v)}</span></div>`; }).join('') || '<p class="b-note">Datakällan har ingen kursutveckling för det här värdepappret.</p>'}</div><p class="b-src">Historisk utveckling säger inget om framtiden.</p>`)}
    ${bCard('c4', `${bLabel('Medelvärden just nu', 'MA200')}<div id="k-ma">${loading()}</div>`)}
    ${bCard('c4', `${bLabel('Välj ett datum')}<label class="b-dl">Datum <input type="date" id="k-date"></label><div id="k-dres"><p class="b-note">Välj ett datum för att se kursen då, och hur 10 000 ${esc(cur(s.valuta))} hade utvecklats sedan dess.</p></div>`)}
  </div>`;
  let pts = null;
  const draw = async () => {
    const d = await get.px(); const box = $('#k-chart'); if (!box) return;
    if (!d || d.error || !d.punkter?.length) { box.innerHTML = bErr(d, 'Det finns inget kursdiagram för det här värdepappret.'); return; }
    pts = d.punkter;
    const r = bPriceChart(box, d.punkter, { per: st.per, ma50: st.ma50, ma200: st.ma200, from: st.from, to: st.to, valuta: d.valuta, h: 360 });
    const c = $('#k-chg'); if (c && r) { c.textContent = `${pct(r.chg)} ${EN ? 'from' : 'från'} ${bDate(bKey(r.from))} ${EN ? 'to' : 'till'} ${bDate(bKey(r.to))}`; c.className = `small num ${tone(r.chg)}`; }
    const first = bKey(d.punkter[0][0]); const lastK = bKey(d.punkter[d.punkter.length - 1][0]);
    panel.querySelectorAll('[data-from],[data-to],#k-date').forEach((i) => { i.min = first; i.max = lastK; });
    $('#k-src').textContent = `Stängningskurser per dag i ${cur(d.valuta)} från ${bDate(first)}. MA50 och MA200 är snittet av de senaste 50 och 200 börsdagarnas stängningskurser. Källa: Yahoo Finance.`;
    const ma = $('#k-ma'); const last = d.punkter[d.punkter.length - 1][1];
    if (ma && r) {
      const row = (n, v) => `<div class="b-kv"><span>${n}</span><b class="num">${v == null ? '<span class="faint">För kort historik</span>' : `${kr(v)} <span class="${tone(last - v)}">(${EN ? 'price' : 'kursen'} ${bSign((last / v - 1) * 100)})</span>`}</b></div>`;
      ma.innerHTML = `${row('MA50' + tip('MA50'), r.ma50)}${row('MA200' + tip('MA200'), r.ma200)}<p class="b-src">Ligger kursen över medelvärdet har den gått bättre än snittet för perioden. Det säger inget om vad som händer sen.</p>`;
    }
  };
  bWireChart(panel.querySelector('.c12'), ctx, draw); draw();
  panel.querySelector('#k-date').addEventListener('change', (e) => {
    const box = $('#k-dres'); const v = e.target.value; if (!pts || !v) return;
    let k = -1; for (let i = pts.length - 1; i >= 0; i--) if (bKey(pts[i][0]) <= v) { k = i; break; }
    if (k < 0) { box.innerHTML = `<p class="b-note">Vi har kurser från ${esc(bDate(bKey(pts[0][0])))}. Välj ett senare datum.</p>`; return; }
    const p0 = pts[k][1]; const p1 = pts[pts.length - 1][1]; const ch = (p1 / p0 - 1) * 100; const same = bKey(pts[k][0]) === v;
    box.innerHTML = `<div class="b-kv"><span>Stängning ${esc(bDate(bKey(pts[k][0])))}${same ? '' : ` <span class="faint">(${EN ? 'closest trading day before' : 'närmaste börsdag före'})</span>`}</span><b class="num">${kr(p0)} ${esc(cur(s.valuta))}</b></div>
      <div class="b-kv"><span>Sedan dess</span><b class="num ${tone(ch)}">${pct(ch)}</b></div>
      <div class="b-kv"><span>10 000 ${esc(cur(s.valuta))} då är värt i dag</span><b class="num ${tone(ch)}">${nf(10000 * p1 / p0, 0)} ${esc(cur(s.valuta))}</b></div>
      <p class="b-src">Räknat på kursen, utan utdelningar och avgifter. Historik säger inget om framtiden.</p>`;
  });
}

/* ---------- Dagen ---------- */
function bDagen(panel, ctx) {
  const { s, get, st, idxName } = ctx;
  const today = isoDay(Date.now());
  const minDay = isoDay(Date.now() - 58 * 864e5);
  panel.innerHTML = `<div class="b-grid">
    ${bCard('c12 b-daynav', `<button type="button" class="b-ib" data-dstep="-1" aria-label="Föregående börsdag">‹</button><label class="sr-only" for="b-day">Välj dag</label><input type="date" id="b-day" min="${minDay}" max="${today}" value="${esc(st.day || today)}"><button type="button" class="b-ib" data-dstep="1" aria-label="Nästa dag">›</button><button type="button" class="btn small" data-dtoday>I dag</button><span class="small muted">Kurser var femte minut finns för de senaste 60 dagarna.</span>`)}
    ${bCard('c8', `<div class="b-ch">${bLabel('Kursen under dagen')}<span class="small num" id="d-chg"></span></div><div id="d-chart">${loading('Hämtar dagens kurser …')}</div><p class="b-src">Streckad linje = föregående dags stängning. Källa: Yahoo Finance.</p>`)}
    ${bCard('c4', `${bLabel('Dagen i siffror')}<div id="d-kv">${loading()}</div>`)}
    ${bCard('c12', `${bLabel('Nyheter den dagen')}<div id="d-news">${loading('Hämtar nyheter …')}</div>`)}
  </div>`;
  const load = async () => {
    let day = st.day || today; let isToday = day === today;
    const [d, px, ix] = await Promise.all([isToday ? get.today() : api(`/api/chart?s=${encodeURIComponent(ctx.sym)}&dag=${day}`, 30 * 60e3), get.px(), get.idx()]);
    const box = $('#d-chart'); if (!box) return;
    const daily = px?.punkter || []; const iDaily = ix?.punkter || [];
    let pts = (d?.punkter || []).filter((p) => bKey(p[0]) === day);
    // Har börsen inte öppnat än i dag visas den senaste handelsdagen (till exempel USA på förmiddagen)
    if (isToday && !pts.length && d?.punkter?.length && !st.day) { day = bKey(d.punkter[d.punkter.length - 1][0]); pts = d.punkter.filter((p) => bKey(p[0]) === day); $('#b-day').value = day; }
    const live = isToday && day === today;
    const di = daily.findIndex((p) => bKey(p[0]) === day);
    const prev = isToday && d?.prevClose != null ? d.prevClose : di > 0 ? daily[di - 1][1] : null;
    isToday = live;
    if (!pts.length) {
      const why = d?.error ? errText(d) : new Date(day + 'T12:00:00').getDay() % 6 === 0 ? 'Börsen var stängd den dagen (helg).' : 'Det finns inga kurser för den dagen. Börsen kan ha varit stängd.';
      box.innerHTML = `<p class="b-note">${esc(why)}</p>`; $('#d-kv').innerHTML = '<p class="b-note">Inget att visa för dagen.</p>'; $('#d-chg').textContent = ''; $('#d-news').innerHTML = '<p class="b-note">Inga kurser den dagen.</p>'; return;
    }
    const close = isToday ? (s.kurs ?? pts[pts.length - 1][1]) : di >= 0 ? daily[di][1] : pts[pts.length - 1][1];
    const ch = prev ? (close / prev - 1) * 100 : null;
    const vs = pts.map((p) => p[1]).concat(prev ? [prev] : []); let lo = Math.min(...vs); let hi = Math.max(...vs); const pad = (hi - lo) * 0.1 || 0.5; lo -= pad; hi += pad;
    const t0 = pts[0][0]; const t1 = Math.max(pts[pts.length - 1][0], t0 + 3600); const W = 1000; const H = 260;
    const X = (t) => ((t - t0) / (t1 - t0)) * W; const Y = (v) => (1 - (v - lo) / (hi - lo)) * H;
    const col = ch == null || ch >= 0 ? 'var(--up)' : 'var(--down)';
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
    box.innerHTML = `<div class="b-chart" style="--h:${H}px"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Kursen under dagen">${prev ? `<line x1="0" x2="${W}" y1="${Y(prev).toFixed(1)}" y2="${Y(prev).toFixed(1)}" stroke="var(--muted)" stroke-dasharray="5 5" vector-effect="non-scaling-stroke"/>` : ''}<path d="${path}L${X(pts[pts.length - 1][0]).toFixed(1)},${H}L0,${H}Z" fill="${col}" fill-opacity="0.1"/><path d="${path}" fill="none" stroke="${col}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg><span class="b-yl top num">${kr(Math.max(...pts.map((p) => p[1])))}</span><span class="b-yl bot num">${kr(Math.min(...pts.map((p) => p[1])))}</span></div><div class="b-xt num"><span>${esc(clock(new Date(t0 * 1000).toISOString()))}</span><span>${esc(clock(new Date(pts[pts.length - 1][0] * 1000).toISOString()))}</span></div>`;
    const c = $('#d-chg'); c.textContent = ch == null ? '' : `${pct(ch)} · ${bDate(day)}`; c.className = 'small num ' + tone(ch);
    const ii = iDaily.findIndex((p) => bKey(p[0]) === day);
    const ich = ii > 0 ? (iDaily[ii][1] / iDaily[ii - 1][1] - 1) * 100 : null;
    const own = getPort().filter((h) => h.sym === ctx.sym).reduce((a, h) => a + h.antal, 0);
    $('#d-kv').innerHTML = `
      <div class="b-kv"><span>Förändring</span><b class="num ${tone(ch)}">${ch == null ? '<span class="faint">Saknas</span>' : pct(ch)}</b></div>
      <div class="b-kv"><span>${isToday && di < 0 ? 'Senaste kurs' : 'Stängning'}</span><b class="num">${kr(close)} ${esc(cur(s.valuta))}</b></div>
      <div class="b-kv"><span>Föregående stängning</span><b class="num">${prev ? kr(prev) : '<span class="faint">Saknas</span>'}</b></div>
      <div class="b-kv"><span>Högst under dagen</span><b class="num">${kr(Math.max(...pts.map((p) => p[1])))}</b></div>
      <div class="b-kv"><span>Lägst under dagen</span><b class="num">${kr(Math.min(...pts.map((p) => p[1])))}</b></div>
      <div class="b-kv"><span>${esc(idxName)} samma dag</span><b class="num ${tone(ich)}">${ich == null ? '<span class="faint">Saknas</span>' : pct(ich)}</b></div>
      ${own > 0 && ch != null && prev ? `<div class="b-kv b-own"><span>Ditt innehav, ${esc(nfAntal(own))} st</span><b class="num ${tone(ch)}">${pmSign(own * (close - prev))}${nf(Math.abs(own * (close - prev)), 0)} ${esc(cur(s.valuta))}</b></div>` : ''}
      <p class="b-src">Högst och lägst räknas från kurser var femte minut.</p>`;
    const n = await get.news(); const nb = $('#d-news'); if (!nb) return;
    const items = (n?.items || []).map((x) => prepNews(x, null, ctx.sym)).filter((x) => x.datum && isoDay(x.datum) === day);
    nb.innerHTML = items.length ? items.map((it) => `<div class="row-link" style="align-items:flex-start"><span class="small muted num" style="width:60px;flex:none">${esc(clock(it.datum))}</span><span class="grow"><span style="display:block;font-weight:500">${newsTitle(it)}</span><span class="small muted src">${flag(it.land)}${esc(it.kalla)}</span></span></div>`).join('') : `<p class="b-note">${n?.error ? esc(errText(n)) : 'Inga nyheter om bolaget den dagen i vårt nyhetsflöde (det sträcker sig två veckor bakåt).'}</p>`;
  };
  const set = (v) => { st.day = v; $('#b-day').value = v; load(); };
  panel.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-dstep]');
    if (b) {
      const px = (await get.px())?.punkter || []; const cur0 = st.day || today; const dir = Number(b.dataset.dstep);
      const days = px.map((p) => bKey(p[0])); let nx = null;
      if (dir < 0) { for (let i = days.length - 1; i >= 0; i--) if (days[i] < cur0) { nx = days[i]; break; } } else nx = days.find((x) => x > cur0) || (cur0 < today ? today : null);
      if (nx && nx >= minDay) set(nx); return;
    }
    if (e.target.closest('[data-dtoday]')) set(today);
  });
  panel.querySelector('#b-day').addEventListener('change', (e) => { if (e.target.value) set(e.target.value); });
  load();
}

/* ---------- Riskanalys ---------- */
const B_RULES = {
  'Kurssvängningar': 'Beta under 0,8 ger Låg, 0,8–1,3 Medel, över 1,3 Hög. Svänger kursen mer än 100 % mellan årets lägsta och högsta blir det Hög.',
  'Skulder': 'Skuld delat med eget kapital. Under 0,5 Låg, 0,5–1,5 Medel, över 1,5 Hög.',
  'Värdering': 'P/E under 20 Låg, 20–35 Medel, över 35 Hög. Ingen vinst räknas som Hög.',
  'Lönsamhet': 'Vinstmarginal över 8 % Låg, 0–8 % Medel, förlust Hög.',
  'Handel': 'Omsättning per dag över 50 miljoner Låg, 5–50 miljoner Medel, under 5 miljoner Hög.',
  'Storlek': 'Börsvärde över 10 miljarder Låg, 1–10 miljarder Medel, under 1 miljard Hög.',
  'Blankning': 'Andel blankade aktier enligt Finansinspektionen. Under 2 % Låg, 2–5 % Medel, över 5 % Hög.'
};
function bRisk(panel, ctx) {
  const { s, se, st, get, idxName } = ctx;
  const f = s.faktorer || []; const lvl = lvlOf(s.poang);
  const sum = f.reduce((a, x) => a + x[1], 0);
  const COLS = ['#E7B547', '#F07167', '#5AA9E6', '#4CC38A', '#B48EE6', '#8B919B', '#3E4552'];
  const contrib = [...f].map((x, i) => ({ n: x[0], l: x[1], w: sum ? (x[1] / sum) * 100 : 0, c: COLS[i % COLS.length] })).sort((a, b) => b.w - a.w);
  const radar = (() => {
    if (f.length < 3) return '';
    const N = f.length; const cx = 160; const cy = 122; const R = 92; const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / N;
    const pt = (i, v) => [cx + Math.cos(ang(i)) * R * (v / 3), cy + Math.sin(ang(i)) * R * (v / 3)];
    const poly = (fn) => Array.from({ length: N }, (_, i) => pt(i, fn(i)).map((x) => x.toFixed(1)).join(',')).join(' ');
    return `<svg viewBox="0 0 320 250" class="b-radar" role="img" aria-label="Riskprofil">${[1, 2, 3].map((r) => `<polygon points="${poly(() => r)}" fill="none" stroke="var(--line)"/>`).join('')}${f.map((x, i) => { const [ex, ey] = pt(i, 3); const lx = cx + Math.cos(ang(i)) * (R + 14); const ly = cy + Math.sin(ang(i)) * (R + 14); return `<line x1="${cx}" y1="${cy}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="var(--line)"/><text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="${Math.abs(lx - cx) < 8 ? 'middle' : lx > cx ? 'start' : 'end'}" font-size="11" fill="var(--muted)">${esc(x[0])}</text>`; }).join('')}<polygon points="${poly((i) => f[i][1])}" fill="rgba(232,234,237,0.1)" stroke="var(--ink)" stroke-width="2"/>${f.map((x, i) => { const [px, py] = pt(i, x[1]); return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4" fill="var(--${LV[x[1]].c})" stroke="var(--card)" stroke-width="1.5"/>`; }).join('')}</svg>`;
  })();
  const own = getPort().filter((h) => h.sym === s.sym).reduce((a, h) => a + h.antal, 0);
  panel.innerHTML = `
  <nav class="b-jump" aria-label="Delar av riskanalysen"><a href="#r1">01 Sammanfattning</a><a href="#r2">02 Riskprofil</a><a href="#r3">03 Kursrisk</a><a href="#r4">04 Stresstest</a>${ctx.isEq ? '<a href="#r5">05 Finansiell styrka</a>' : ''}</nav>
  ${bH('01', 'Sammanfattning', 'Hela risken i en bild', 'r1')}
  <div class="b-grid">
    ${bCard('c4', `<div class="b-rk big">${bGauge(s.poang)}<div class="stack" style="gap:6px">${lvl ? bLevel(lvl) : '<span class="faint">För lite data</span>'}<span class="small">${esc(s.sammanfattning || '')}</span></div></div>`)}
    ${bCard('c4', `<div class="b-kpis" id="r-kpi">${loading('Räknar …')}</div>`)}
    ${bCard('c4', `${bLabel('Vad driver riskkollen', 'Vad driver riskkollen')}${f.length ? `<div class="b-stack">${contrib.map((x) => `<i style="width:${x.w.toFixed(1)}%;background:${x.c}" title="${esc(x.n)}"></i>`).join('')}</div><div class="b-legend">${contrib.map((x) => `<span><i style="background:${x.c}"></i>${esc(x.n)}<b class="num">${bn(x.w, 0)} %</b></span>`).join('')}</div><p class="b-src">Varje del ger 1 (Låg), 2 (Medel) eller 3 (Hög) poäng. Visar hur stor andel av poängen varje del står för.</p>` : '<p class="b-note">Datakällan har för få nyckeltal.</p>'}`)}
  </div>
  ${bH('02', 'Riskprofil', `${f.length} delar, var och en Låg, Medel eller Hög`, 'r2')}
  <div class="b-grid">
    ${radar ? bCard('c4', `${bLabel('Profil')}${radar}<p class="b-src">Längre ut betyder högre risk. Inre ringen Låg, yttre Hög.</p>`) : ''}
    ${bCard(radar ? 'c8' : 'c12', f.length ? `<div class="b-ftab"><div class="b-fhead"><span>Del</span><span>Nivå</span><span>Värde</span><span>Så bedömer vi</span></div>${f.map(([n, l, v, t]) => `<div class="b-frow"><span class="b-fn"><b>${esc(n)}</b>${tip(n)}</span><span class="b-fl">${bSeg(l)}${bLevel(l)}</span><span class="num">${esc(v)}</span><span class="b-ft">${esc(t)}<span class="faint">${esc(B_RULES[n] || '')}</span></span></div>`).join('')}</div>` : '<p class="b-note">Datakällan har inte tillräckligt med nyckeltal för en riskkoll.</p>')}
  </div>
  ${bH('03', 'Kursrisk', 'Hur mycket och hur hårt kursen har rört sig', 'r3')}
  <div class="b-grid">
    ${bCard('c5', `<div class="b-ch">${bLabel('Fall från toppen', 'Fall från toppen')}<span class="small faint" id="r-ddyrs"></span></div><div id="r-dd">${loading('Hämtar kurser …')}</div>`)}
    ${bCard('c4', `<div class="b-ch">${bLabel('Dagsrörelser senaste året', 'Dålig dag')}<span class="small faint" id="r-hdays"></span></div><div id="r-hist">${loading()}</div>`)}
    ${bCard('c3', `${bLabel('Riskmått')}<div id="r-met">${loading()}</div>`)}
  </div>
  ${bH('04', 'Stresstest', `Vad har hänt när ${esc(idxName)} föll`, 'r4')}
  <div class="b-grid">
    ${bCard('c7', `<div class="b-ch">${bLabel('Testa ett börsfall', 'Stresstest')}<div class="b-segc" role="tablist" aria-label="Börsfall">${[-10, -20, -30, -40].map((v, i) => `<button type="button" role="tab" data-sp="${i}" aria-selected="${st.sp === i}">${esc(idxName)} ${v} %</button>`).join('')}</div></div><div id="r-sim"></div>`)}
    ${bCard('c5', `${bLabel(`Största fallen för ${idxName}`)}<div id="r-falls">${loading()}</div>`)}
  </div>
  ${ctx.isEq ? `${bH('05', 'Finansiell styrka', 'Klarar bolaget sina skulder', 'r5')}<div id="r-fin">${loading('Hämtar rapportsiffror …')}</div>` : ''}
  <p class="b-src" style="margin-top:6px">Riskkollen är vår egen förenkling räknad med fasta regler från siffrorna ovan. Ett högt tal betyder mer risk, inte att aktien är dålig. Inget råd.</p>`;
  const sim = () => {
    const box = $('#r-sim'); if (!box) return;
    const m = [-10, -20, -30, -40][st.sp];
    if (s.beta == null) { box.innerHTML = '<p class="b-note">Beta saknas i datakällan, så vi kan inte räkna ett väntat fall.</p>'; return; }
    const exp = s.beta * m; const px = s.kurs != null ? s.kurs * (1 + exp / 100) : null;
    box.innerHTML = `<div class="b-sim">
      <div><span class="b-mini-k">Om aktien följer sin beta (${bn(s.beta, 2)})${tip('Beta')}</span><b class="num down" style="font-size:28px;font-weight:400">${bSign(exp)}</b><span class="small faint">${px != null ? `${EN ? 'price about' : 'kursen ca'} ${kr(px)} ${esc(cur(s.valuta))}` : ''}</span></div>
      ${own > 0 && s.kurs != null ? `<div class="b-own"><span class="b-mini-k">Ditt innehav, ${esc(nfAntal(own))} st</span><b class="num down" style="font-size:22px;font-weight:500">−${nf(Math.abs(own * s.kurs * exp / 100), 0)} ${esc(cur(s.valuta))}</b><span class="small faint">av ${nf(own * s.kurs, 0)} ${esc(cur(s.valuta))}</span></div>` : `<div><span class="b-mini-k">Per 10 000 ${esc(cur(s.valuta))}</span><b class="num down" style="font-size:22px;font-weight:500">−${nf(Math.abs(100 * exp), 0)} ${esc(cur(s.valuta))}</b><span class="small faint">om aktien följer sin beta</span></div>`}
    </div>
    <div class="b-simbar"><i style="width:${Math.min(100, Math.abs(exp) / 60 * 100).toFixed(0)}%"></i></div>
    <p class="b-src">Beta jämför aktiens rörelser med börsen historiskt. Det är en enkel räkning, inte en prognos: i verkliga fall kan aktien falla mer eller mindre. Se de verkliga fallen till höger.</p>`;
  };
  sim();
  panel.addEventListener('click', (e) => { const b = e.target.closest('[data-sp]'); if (!b) return; st.sp = Number(b.dataset.sp); panel.querySelectorAll('[data-sp]').forEach((x) => x.setAttribute('aria-selected', String(x === b))); sim(); });
  get.stats().then((x) => {
    if (!$('#r-kpi')) return;
    const none = '<span class="faint">Saknas</span>';
    const kpi = (k, v, sub, t) => `<div><span class="b-mini-k">${esc(k)}${t ? tip(t) : ''}</span><b class="num">${v ?? none}</b><span class="small faint">${sub || ''}</span></div>`;
    $('#r-kpi').innerHTML = kpi('Volatilitet 1 år', bPct(x.vol1), '', 'Volatilitet') + kpi('Beta', s.beta != null ? bn(s.beta, 2) : null, `mot ${esc(idxName)} enligt Yahoo`, 'Beta') + kpi(`Största fall, ${x.years ? bn(Math.min(5, x.years), 0) : ''} år`, x.maxDd ? bSign(x.maxDd.v) : null, x.maxDd?.t ? `${esc(bDate(bKey(x.maxDd.from)))} → ${esc(bDate(bKey(x.maxDd.t)))}` : '', 'Fall från toppen') + kpi('Sämsta dag, 1 år', x.worst ? bSign(x.worst.v) : null, x.worst ? esc(bDate(bKey(x.worst.t))) : '');
    const dd = $('#r-dd');
    if (!x.dd) { const err = '<p class="b-note">Det finns för få kurser för att räkna kursrisk.</p>'; dd.innerHTML = err; $('#r-hist').innerHTML = err; $('#r-met').innerHTML = err; $('#r-falls').innerHTML = err; return; }
    $('#r-ddyrs').textContent = `${bn(x.years, 1)} år`;
    const pts = x.dd; const W = 420; const H = 150; const lo = Math.min(-5, x.maxDd.v * 1.1); const t0 = pts[0][0]; const t1 = pts[pts.length - 1][0];
    const X = (t) => ((t - t0) / (t1 - t0)) * W; const Y = (v) => 6 + (v / lo) * (H - 22);
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
    const gl = [0, Math.round(lo / 2 / 5) * 5, Math.round(lo / 5) * 5].filter((v, i, a) => a.indexOf(v) === i);
    dd.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="b-svg" role="img" aria-label="Fall från högsta kursen">${gl.map((v) => `<line x1="0" x2="${W}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="var(--line-soft)"/><text x="${W - 2}" y="${(Y(v) - 3).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--muted)">${String(v).replace('-', '−')} %</text>`).join('')}<path d="${path}L${W},${Y(0)}L0,${Y(0)}Z" fill="var(--down)" fill-opacity="0.12"/><path d="${path}" fill="none" stroke="var(--down)" stroke-width="1.4"/><circle cx="${X(x.maxDd.t).toFixed(1)}" cy="${Y(x.maxDd.v).toFixed(1)}" r="4" fill="var(--down)" stroke="var(--card)" stroke-width="1.5"/></svg><div class="b-xt num"><span>${esc(bDate(bKey(t0)))}</span><span>${esc(bDate(bKey(t1)))}</span></div><p class="b-src">Noll betyder att kursen stod på sin högsta nivå hittills (räknat på kursen, utan utdelningar). Nu: <b class="${x.nowDd < -0.05 ? 'down' : ''}">${bSign(x.nowDd)}</b> från toppen.</p>`;
    if (x.hist) {
      $('#r-hdays').textContent = `${x.days} ${EN ? 'trading days' : 'börsdagar'}`;
      const ext = Math.min(15, Math.max(4, Math.ceil(Math.max(...x.hist.map(Math.abs)))));
      const NB = 24; const bw = (2 * ext) / NB; const cnt = Array(NB).fill(0); x.hist.forEach((v) => { const k = Math.min(NB - 1, Math.max(0, Math.floor((v + ext) / bw))); cnt[k]++; });
      const mx = Math.max(...cnt); const W2 = 300; const H2 = 110;
      const vx = ((x.var95 + ext) / (2 * ext)) * W2;
      $('#r-hist').innerHTML = `<svg viewBox="0 0 ${W2} ${H2 + 14}" class="b-svg" role="img" aria-label="Hur ofta kursen rört sig olika mycket på en dag">${cnt.map((c, i) => { const h = (c / mx) * (H2 - 14); const lo2 = -ext + i * bw; return `<rect x="${(i * W2 / NB + 1).toFixed(1)}" y="${(H2 - h).toFixed(1)}" width="${(W2 / NB - 2).toFixed(1)}" height="${Math.max(c ? 1.5 : 0, h).toFixed(1)}" rx="1" fill="${lo2 + bw <= x.var95 + 1e-9 ? 'var(--down)' : lo2 < 0 ? 'var(--line)' : 'var(--b-blue)'}"><title>${bn(lo2, 1)} till ${bn(lo2 + bw, 1)} %: ${c} ${EN ? 'days' : 'dagar'}</title></rect>`; }).join('')}<line x1="${vx.toFixed(1)}" x2="${vx.toFixed(1)}" y1="4" y2="${H2}" stroke="var(--down)" stroke-dasharray="3 3"/><text x="${(vx - 4).toFixed(1)}" y="11" text-anchor="end" font-size="9.5" fill="var(--down)">1 av 20 dagar</text>${[-ext, 0, ext].map((v) => `<text x="${(((v + ext) / (2 * ext)) * W2).toFixed(1)}" y="${H2 + 12}" text-anchor="${v < 0 ? 'start' : v > 0 ? 'end' : 'middle'}" font-size="9.5" fill="var(--muted)">${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)} %</text>`).join('')}</svg><p class="b-src">Varje stapel är hur många dagar kursen rörde sig så mycket. Röda = de 5 % sämsta dagarna, fall på ${bn(Math.abs(x.var95), 1)} % eller mer.</p>`;
    } else $('#r-hist').innerHTML = '<p class="b-note">Det finns för få kurser det senaste året.</p>';
    const row = (k, v, sub, t) => `<div class="b-kv"><span>${esc(k)}${t ? tip(t) : ''}${sub ? `<span class="faint b-kv-s">${sub}</span>` : ''}</span><b class="num">${v ?? '<span class="faint">Saknas</span>'}</b></div>`;
    $('#r-met').innerHTML = row('Volatilitet 30 dagar', bPct(x.vol30), '', 'Volatilitet') + row('Volatilitet 3 år', bPct(x.vol3)) + row(`Samvariation med ${idxName}`, x.corr != null ? bn(x.corr, 2) : null, '1 = följer helt', 'Korrelation') + row('Dålig dag, 1 av 20', x.var95 != null ? bSign(x.var95) : null, '', 'Dålig dag') + row('Bästa dag, 1 år', x.best ? bSign(x.best.v) : null, x.best ? esc(bDate(bKey(x.best.t))) : '') + row('Sämsta månad', x.worstMonth ? bSign(x.worstMonth.v) : null, x.worstMonth ? esc(`${bMon(Number(x.worstMonth.m.slice(5)) - 1)} ${x.worstMonth.m.slice(0, 4)}`) : '') + row('Längst under toppen', x.recovery ? `${bn(x.recovery.days / 30.44, 0)} mån` : null, x.recovery ? (x.recovery.to ? `${esc(bDate(bKey(x.recovery.from)))} → ${esc(bDate(bKey(x.recovery.to)))}` : `${EN ? 'since' : 'sedan'} ${esc(bDate(bKey(x.recovery.from)))}, ${EN ? 'ongoing' : 'pågår'}`) : '', 'Fall från toppen');
    const fb = $('#r-falls');
    fb.innerHTML = x.falls?.length ? `<div class="b-falls"><div class="b-fhead"><span>Period</span><span>${esc(idxName)}</span><span>${esc(short(s.sym))}</span></div>${x.falls.map((w) => `<div><span class="small">${esc(bDate(w.from))} → ${esc(bDate(w.to))}</span><b class="num down">${bSign(w.idx)}</b><b class="num ${tone(w.own)}">${bSign(w.own)}</b></div>`).join('')}</div><p class="b-src">De ${x.falls.length} största fallen för ${esc(idxName)} under 20 börsdagar i följd de senaste fem åren, och hur aktien rörde sig samtidigt.</p>` : `<p class="b-note">${esc(idxName)} har inte fallit mer än 5 % på 20 börsdagar under perioden vi har kurser för.</p>`;
  });
  if (ctx.isEq) get.rep().then((rep) => {
    const box = $('#r-fin'); if (!box) return;
    if (!rep || rep.error || (!rep.ttm && !rep.kvartal?.length && !rep.ar?.length)) { box.innerHTML = bCard('', bErr(rep, 'Datakällan har inga rapportsiffror för bolaget, så vi kan inte visa finansiell styrka.')); return; }
    const L0 = rep.kvartal?.length ? rep.kvartal[rep.kvartal.length - 1] : rep.ar[rep.ar.length - 1];
    const T = rep.ttm || rep.ar[rep.ar.length - 1];
    const nd = L0.skuld != null && L0.kassa != null ? L0.skuld - L0.kassa : null;
    const tiles = [
      ['Skuld / eget kapital', bRatio(L0.skuld, L0.ek), (v) => bn(v, 2), 'Lånen jämfört med ägarnas kapital i bolaget.', 'Skuld / eget kapital'],
      ['Soliditet', bRatio(L0.ek, L0.tillg) == null ? null : bRatio(L0.ek, L0.tillg) * 100, (v) => bPct(v), 'Hur stor del av tillgångarna som är ägarnas egna pengar.', 'Soliditet'],
      ['Nettoskuld / EBITDA', nd != null && T.ebitda > 0 ? nd / T.ebitda : null, (v) => (v < 0 ? (EN ? 'Net cash' : 'Nettokassa') : bn(v, 1) + ' ggr'), 'Hur många års rörelseresultat före avskrivningar som behövs för att betala lånen.', 'Nettoskuld / EBITDA'],
      ['Räntetäckning', T.rorelse != null && T.ranta > 0 ? T.rorelse / T.ranta : null, (v) => bn(v, 1) + ' ggr', 'Hur många gånger rörelseresultatet täcker räntekostnaden.', 'Räntetäckning'],
      ['Balanslikviditet', bRatio(L0.omsTillg, L0.kortSkuld), (v) => bn(v, 2), 'Tillgångar som snart blir pengar, delat med skulder som ska betalas inom ett år.', 'Balanslikviditet'],
      ['Vinst mot utdelning', (() => { const A = rep.ar[rep.ar.length - 1]; const src = T.netto != null && T.utd ? T : A && A.netto != null && A.utd ? A : null; return src ? src.netto / Math.abs(src.utd) : null; })(), (v) => bn(v, 1) + ' ggr', 'Hur många gånger vinsten räcker till utdelningen som betalats ut.', 'Vinst mot utdelning']
    ];
    box.innerHTML = `<div class="b-tiles">${tiles.map(([n, v, fm, t, k]) => `<section class="b-card"><span class="b-mini-k">${esc(n)}${tip(k)}</span><b class="num">${v == null || !Number.isFinite(v) ? '<span class="faint">Saknas</span>' : esc(fm(v))}</b><span class="small faint">${esc(t)}</span></section>`).join('')}</div><p class="b-src">Balansposter från rapporten för perioden som slutade ${esc(bDate(L0.datum))}, resultat och kassaflöde ${rep.ttm ? 'för de senaste 12 månaderna' : `för helåret ${esc(bYear(T))}`}. Källa: ${esc(rep.kalla || 'Yahoo Finance')}. Banker och bolag med egen finansverksamhet har ofta högre skulder av naturliga skäl.</p>`;
  });
}

/* ---------- Rapporter och nyckeltal ---------- */
function bRapporter(panel, ctx) {
  const { s, st, get } = ctx;
  panel.innerHTML = `
  <nav class="b-jump" aria-label="Delar av rapporter"><a href="#p1">01 Senaste rapporten</a><a href="#p2">02 Kvartal</a><a href="#p3">03 Nyckeltal</a><a href="#p4">04 Per år</a><a href="#p5">05 Räkenskaper</a></nav>
  <div id="p-body">${loading('Hämtar rapportsiffror …')}</div>`;
  Promise.all([get.rep(), get.kal()]).then(([rep, kal]) => {
    const box = $('#p-body'); if (!box) return;
    const c = rep?.valuta;
    const has = rep && !rep.error && (rep.ar?.length || rep.kvartal?.length);
    const today = isoDay(Date.now());
    const kalTxt = !kal || kal.error ? (kal?.error === 'ingen' ? 'Saknas' : 'Kunde inte hämtas just nu') : !kal.rapport ? 'Datum inte känt än' : null;
    const web = safeUrl(s.webb);
    const nextCard = bCard('c3', `${bLabel(kal?.rapport && kal.rapport < today ? 'Senaste rapportdag' : 'Nästa rapport')}<b class="b-big">${kalTxt ? `<span class="faint">${esc(kalTxt)}</span>` : esc(bDate(kal.rapport))}</b>${kal?.rapport && kal.rapport >= today ? `<span class="small muted">${kal.rapportUppskattad ? 'Preliminärt datum · ' : ''}om ${Math.round((new Date(kal.rapport + 'T12:00:00') - Date.now()) / 864e5)} dagar</span>` : ''}<div class="b-links">${web ? `<a href="${esc(web)}" target="_blank" rel="noopener noreferrer">Bolagets webbplats ↗</a>` : ''}<a href="https://finance.yahoo.com/quote/${encodeURIComponent(s.sym)}/financials/" target="_blank" rel="noopener noreferrer">Yahoo Finance ↗</a></div><span class="small faint">Hela rapporterna finns oftast under Investerare på bolagets webbplats.</span>`);
    let h = bH('01', 'Senaste rapporten', has && rep.kvartal?.length ? `Kvartalet som slutade ${esc(bDate(rep.kvartal[rep.kvartal.length - 1].datum))}` : '', 'p1');
    if (has && rep.kvartal?.length) {
      const q = rep.kvartal[rep.kvartal.length - 1];
      const tiles = ['oms', 'marg', 'eps', 'fcf'].map((m) => { const y = bYoY(rep.kvartal, q, B_MET[m].f); const chg = bChange(m, y.a, y.b); return `<div><span class="b-mini-k">${esc(B_MET[m].n)}${tip(B_MET[m].k)}</span><b class="num">${bMiss(y.a == null ? null : B_MET[m].fmt(y.a, c))}</b><span class="small num ${chg ? bTone(chg.v) : 'faint'}">${chg ? `${esc(chg.t)} ${EN ? 'vs' : 'mot'} ${esc(bQ(y.prev))}` : (y.prev ? 'Jämförelse saknas' : 'Samma kvartal i fjol saknas')}</span></div>`; }).join('');
      h += `<div class="b-grid">${bCard('c9', `<div class="b-tiles5">${tiles}</div><p class="b-src">Jämfört med samma kvartal året innan. Marginaler jämförs i procentenheter. Källa: ${esc(rep.kalla)}.</p>`)}${nextCard}</div>`;
    } else h += `<div class="b-grid">${bCard('c9', bErr(rep, 'Datakällan har inga kvartalssiffror för bolaget.'))}${nextCard}</div>`;
    // Kvartal
    h += bH('02', 'Kvartal för kvartal', has && rep.kvartal?.length ? `${rep.kvartal.length} senaste kvartalen som finns i datakällan` : '', 'p2');
    h += has && rep.kvartal?.length ? `<div class="b-grid">${bCard('c12', `<div class="b-ch"><div class="b-chl">${bLabel('Utveckling per kvartal')}</div><div class="b-segc" role="tablist" aria-label="Mått">${['oms', 'rorelse', 'marg', 'eps', 'fcf'].map((m) => `<button type="button" role="tab" data-qm="${m}" aria-selected="${st.qm === m}">${esc(B_MET[m].n)}</button>`).join('')}</div></div><div id="p-q"></div>`)}</div>` : `<div class="b-grid">${bCard('c12', '<p class="b-note">Kvartalssiffror saknas i datakällan.</p>')}</div>`;
    // Nyckeltal
    h += bH('03', 'Nyckeltal', 'Senaste 12 månaderna', 'p3');
    h += `<div class="b-grid">${bCard('c12', s.nyckeltal?.length ? `<div class="b-ntgrid">${s.nyckeltal.map(([k, v, t]) => `<div><span class="b-mini-k">${esc(k)}${ORD[k] ? tip(k) : tipMark(k, t)}</span><b class="num">${bMiss(v)}</b></div>`).join('')}</div><p class="b-src">Källa: Yahoo Finance. Nyckeltalen visar läget i dag och säger inget om hur aktien går framöver.</p>` : '<p class="b-note">Datakällan har inga nyckeltal för det här värdepappret.</p>')}</div>`;
    // Per år
    h += bH('04', 'Per år', has && rep.ar?.length ? `Helår ${esc(bYear(rep.ar[0]))}–${esc(bYear(rep.ar[rep.ar.length - 1]))}${rep.ttm ? ' och senaste 12 månaderna' : ''}` : '', 'p4');
    h += has && rep.ar?.length ? `<div class="b-grid b-g4">${['oms', 'rorelse', 'marg', 'netmarg', 'eps', 'fcf', 'utd', 'sol'].map((m) => { const ser = bAnnualSeries(rep, m); const lastV = [...ser].reverse().find((x) => x.v != null); return bCard('', `<div class="b-ch">${bLabel(B_MET[m].n, B_MET[m].k)}<b class="num small">${bMiss(lastV?.txt)}</b></div>${bBars(ser, { h: 96 })}`); }).join('')}</div><p class="b-src">Staplarnas tal: ${['Försäljning', 'rörelseresultat', 'kassaflöde och utdelning'].join(', ')} i miljarder ${esc(cur(c))}. Rapportsiffrorna kommer från bolagens redovisning via ${esc(rep.kalla)} och kan skilja något från nyckeltalen ovan, som räknas på ett annat sätt (till exempel andra kvartal eller antal aktier).</p>` : `<div class="b-grid">${bCard('c12', '<p class="b-note">Helårssiffror saknas i datakällan.</p>')}</div>`;
    // Räkenskaper
    h += bH('05', 'Räkenskaper', c ? `Belopp i ${EN ? 'billions' : 'miljarder'} ${esc(cur(c))} om inget annat står` : '', 'p5');
    h += has && rep.ar?.length ? `<div class="b-grid">${bCard('c8', `<div class="b-ch">${bLabel('Sammanställning')}<div class="b-segc" role="tablist" aria-label="Räkenskap">${[['res', 'Resultat'], ['bal', 'Balans'], ['kf', 'Kassaflöde']].map(([k, l]) => `<button type="button" role="tab" data-fs="${k}" aria-selected="${st.fs === k}">${l}</button>`).join('')}</div></div><div id="p-fs"></div>`)}${bCard('c4', `${bLabel('Fritt kassaflöde mot utdelning', 'Fritt kassaflöde')}<div id="p-cash"></div>`)}</div>` : '';
    box.innerHTML = h;
    if (!has) return;
    const drawQ = () => {
      const qb = $('#p-q'); if (!qb || !rep.kvartal?.length) return; const m = st.qm;
      const ser = rep.kvartal.map((r) => ({ l: bQ(r), v: B_MET[m].f(r) })).map((x) => ({ ...x, txt: x.v == null ? '–' : B_MET[m].fmt(x.v, c) }));
      const q = rep.kvartal[rep.kvartal.length - 1]; const y = bYoY(rep.kvartal, q, B_MET[m].f); const chg = bChange(m, y.a, y.b);
      qb.innerHTML = `${bBars(ser, { h: 160 })}<p class="b-src">${chg ? `Senaste kvartalet <b class="${bTone(chg.v)}">${esc(chg.t)}</b> mot samma kvartal året innan. ` : ''}Staplarna visar kvartal efter slutmånad. Källa: ${esc(rep.kalla)}.</p>`;
    };
    const drawFS = () => {
      const fb = $('#p-fs'); if (!fb) return;
      const ROWS = { res: [['Försäljning', 'oms'], ['Bruttoresultat', 'brutto'], ['Rörelseresultat', 'rorelse'], ['Resultat före skatt', 'fore'], ['Nettoresultat', 'netto'], ['Vinst per aktie', 'eps', 'eps']], bal: [['Totala tillgångar', 'tillg'], ['Eget kapital', 'ek'], ['Skulder (lån)', 'skuld'], ['Kassa', 'kassa'], ['Soliditet', 'sol', 'pct']], kf: [['Kassaflöde från rörelsen', 'kassaflode'], ['Investeringar', 'capex'], ['Fritt kassaflöde', 'fcf'], ['Utbetald utdelning', 'utd']] }[st.fs];
      const cols = [...rep.ar.map((r) => ({ l: bYear(r), r }))];
      if (st.fs === 'bal' && rep.kvartal?.length) cols.push({ l: bQ(rep.kvartal[rep.kvartal.length - 1]), r: rep.kvartal[rep.kvartal.length - 1] });
      else if (rep.ttm) cols.push({ l: EN ? '12 m' : '12 mån', r: rep.ttm });
      const val = (r, k, t) => { if (t === 'pct') { const v = bRatio(r.ek, r.tillg); return v == null ? null : v * 100; } return r[k]; };
      const fm = (v, t) => (v == null ? '–' : t === 'eps' ? bn(v, 2) : t === 'pct' ? bPct(v) : bn(v / 1e9, 1));
      fb.innerHTML = `<div class="b-fs" style="--n:${cols.length}"><div class="b-fs-h"><span></span>${cols.map((x) => `<span>${esc(x.l)}</span>`).join('')}<span>${EN ? 'Change' : 'Ändring'}</span></div>${ROWS.map(([n, k, t]) => { const vs = cols.map((x) => val(x.r, k, t)); const a = vs[vs.length - 1]; const b = vs[vs.length - 2]; const ch = t === 'pct' ? (a != null && b != null ? { t: `${a - b >= 0 ? '+' : '−'}${bn(Math.abs(a - b), 1)} pe`, v: a - b } : null) : (a != null && b != null && b > 0 ? { t: bSign((a / b - 1) * 100), v: a / b - 1 } : null); return `<div class="b-fs-r"><span>${esc(n)}${tip(n)}${t === 'eps' ? ` <span class="faint">(${esc(cur(c))})</span>` : ''}</span>${vs.map((v, i) => `<span class="num ${i === vs.length - 1 ? '' : 'muted'}">${fm(v, t)}</span>`).join('')}<span class="num ${ch ? bTone(ch.v) : 'faint'}">${ch ? esc(ch.t) : '–'}</span></div>`; }).join('')}</div><p class="b-src">Ändring = sista kolumnen mot kolumnen före. ${st.fs === 'bal' ? 'Balansen visar läget vid periodens slut.' : rep.ttm ? '12 mån = de fyra senaste kvartalen tillsammans.' : ''} Negativa tal (−) är pengar som gått ut. Källa: ${esc(rep.kalla)}.</p>`;
    };
    const cb = $('#p-cash');
    if (cb) {
      const rows = rep.ar.map((r) => ({ l: bYear(r), a: r.fcf, b: r.utd == null ? null : Math.abs(r.utd) }));
      if (rep.ttm) rows.push({ l: EN ? '12 m' : '12 mån', a: rep.ttm.fcf, b: rep.ttm.utd == null ? null : Math.abs(rep.ttm.utd) });
      const ok = rows.filter((x) => x.a != null || x.b != null);
      if (!ok.length) cb.innerHTML = '<p class="b-note">Saknas i datakällan.</p>';
      else {
        const mx = Math.max(1, ...ok.flatMap((x) => [Math.abs(x.a || 0), x.b || 0]));
        cb.innerHTML = `<div class="b-pairs">${rows.map((x) => `<div><span class="b-pair"><i class="${x.a != null && x.a < 0 ? 'neg' : ''}" style="height:${x.a == null ? 0 : Math.max(2, Math.abs(x.a) / mx * 100).toFixed(0)}%" title="Fritt kassaflöde ${esc(bBig(x.a, c) || 'saknas')}"></i><i class="b" style="height:${x.b == null ? 0 : Math.max(2, x.b / mx * 100).toFixed(0)}%" title="Utdelning ${esc(bBig(x.b, c) || 'saknas')}"></i></span><span class="b-bar-l">${esc(x.l)}</span></div>`).join('')}</div><div class="b-legend"><span><i style="background:var(--up)"></i>Fritt kassaflöde</span><span><i style="background:var(--line)"></i>Utbetald utdelning</span></div><p class="b-src">Är den grå stapeln högre än den gröna betalade bolaget ut mer i utdelning än det fria kassaflödet det året. Röd stapel = negativt kassaflöde.</p>`;
      }
    }
    drawQ(); drawFS();
    box.addEventListener('click', (e) => {
      if (e.target.closest('.tip')) return;
      const q = e.target.closest('[data-qm]'); if (q) { st.qm = q.dataset.qm; box.querySelectorAll('[data-qm]').forEach((b) => b.setAttribute('aria-selected', String(b === q))); drawQ(); return; }
      const f = e.target.closest('[data-fs]'); if (f) { st.fs = f.dataset.fs; box.querySelectorAll('[data-fs]').forEach((b) => b.setAttribute('aria-selected', String(b === f))); drawFS(); }
    });
  });
}

/* ---------- Insyn, kalender, nyheter, om ---------- */
function bInsyn(panel, ctx) {
  panel.innerHTML = `<div class="b-grid">${bCard('c7', `${bLabel('Insynshandel', 'Insynshandel')}<p class="small muted" style="margin:4px 0 10px">Personer i bolagets ledning och styrelse måste anmäla sina affärer i aktien. Här är de senaste tolv månaderna.</p><div id="i-body" class="stack" style="gap:14px">${loading('Hämtar insynsaffärer …')}</div>`)}${bCard('c5', `${bLabel('Blankning', 'Blankning')}<div id="i-blank" class="stack" style="gap:14px;margin-top:8px">${loading('Hämtar blankning …')}</div>`)}</div>`;
  ctx.get.insyn().then((d) => { const b = $('#i-body'); if (b) b.innerHTML = insynHTML(d); });
  ctx.get.blank().then((d) => { const b = $('#i-blank'); if (b) b.innerHTML = blankHTML(d); });
}
function bKalender(panel, ctx) {
  const { s } = ctx;
  panel.innerHTML = `<div class="b-grid">${bCard('c7', `${bLabel('Kommande och senaste händelser')}<div id="c-list">${loading('Hämtar kalendern …')}</div>`)}${bCard('c5', `${bLabel('Utdelning')}<div id="c-utd">${loading()}</div>`)}</div>`;
  ctx.get.kal().then((k) => {
    const lb = $('#c-list'); if (!lb) return;
    if (!k || k.error) { lb.innerHTML = bErr(k?.error === 'ingen' ? null : k, 'Kalendern kunde inte hämtas just nu.'); $('#c-utd').innerHTML = '<p class="b-note">Saknas.</p>'; return; }
    const today = isoDay(Date.now());
    const ev = [[k.rapport, k.rapport && k.rapport >= today ? 'Nästa rapport' : 'Senaste rapport', 'rep', k.rapportUppskattad ? 'Preliminärt datum' : ''], [k.exUtdelning, 'X-dag för utdelning', 'utd', 'Sista dagen med rätt till utdelning är dagen före.'], [k.utbetalning, 'Utbetalning av utdelning', 'utd', '']].filter((x) => x[0]).sort((a, b) => a[0].localeCompare(b[0]));
    lb.innerHTML = ev.length ? ev.map(([d, t, c, n]) => { const dd = new Date(d + 'T12:00:00'); return `<div class="b-ev ${d < today ? 'past' : ''}"><span class="b-ev-d"><span>${esc(bMon(dd.getMonth()))}</span><b class="num">${dd.getDate()}</b><span class="faint">${dd.getFullYear()}</span></span><span class="grow"><b>${esc(t)}</b>${n ? `<span class="small faint" style="display:block">${esc(n)}</span>` : ''}</span><span class="pill ${c === 'rep' ? 'info' : 'up'}">${c === 'rep' ? 'Rapport' : 'Utdelning'}</span><span class="small faint num">${d >= today ? `${EN ? 'in' : 'om'} ${Math.round((dd - Date.now()) / 864e5)} ${EN ? 'd' : 'dagar'}` : ''}</span></div>`; }).join('') + `<a class="b-more" href="/portfolj?flik=kalender" data-link>Kalender för alla dina aktier →</a>` : '<p class="b-note">Datakällan har inga kända datum för bolaget just nu.</p>';
    $('#c-utd').innerHTML = `<div class="b-kv"><span>Utdelning per aktie och år</span><b class="num">${k.utdelningPerAktie != null ? `${bn(k.utdelningPerAktie, 2)} ${esc(cur(k.valuta || s.valuta))}` : '<span class="faint">Saknas</span>'}</b></div><div class="b-kv"><span>Direktavkastning${tip('Direktavkastning')}</span><b class="num">${k.direktavkastning != null ? bPct(k.direktavkastning, 2) : '<span class="faint">Saknas</span>'}</b></div><div class="b-kv"><span>X-dag</span><b class="num">${k.exUtdelning ? esc(bDate(k.exUtdelning)) : '<span class="faint">Saknas</span>'}</b></div><p class="b-src">Källa: ${esc(k.kalla || 'Yahoo Finance')}. Datumen kan ändras, kontrollera hos bolaget.</p>`;
  });
}
async function bNyheter(panel, ctx) {
  const { s, sym } = ctx;
  panel.innerHTML = `<div class="b-grid">${bCard('c12', `${bLabel(`Senaste om ${s.namn}`)}<div id="ai-sum"></div><div id="bolagnews">${loading('Hämtar nyheter …')}</div>`)}</div>`;
  aiSummary(sym, s.namn);
  const n = await ctx.get.news(); const box = $('#bolagnews'); if (!box) return;
  const items = (n?.items || []).map((x) => prepNews(x, null, sym));
  box.innerHTML = items.length ? `<div>${items.slice(0, 15).map((it) => `
    <div class="row-link" style="align-items:flex-start">
      <span class="small muted num" style="width:96px;flex:none;padding-top:2px">${esc(it.tidTxt)}</span>
      <span class="grow"><span style="display:block;font-weight:500">${newsTitle(it)}</span><span class="small muted src">${it.amne ? `<span class="pill news-topic t-${esc(it.amne)}">${esc(it.amne)}</span> ` : ''}${flag(it.land)}${esc(it.kalla)}</span></span>
    </div>`).join('')}</div>` : `<p class="b-note">${n?.error ? esc(errText(n)) : n?.ingenAtkomst ? 'Inga nyheter om bolaget hittades just nu.' : 'Inga nyheter om bolaget de senaste två veckorna.'}</p>`;
}
function bOm(panel, ctx) {
  const { s, sym } = ctx;
  panel.innerHTML = `<div class="b-grid">${bCard('c8', `${bLabel('Affärsidé och historia')}<div id="about-body">${loading('Hämtar affärsidé och historia …')}</div>`)}${bCard('c4', `${bLabel('Fakta')}${s.fakta?.length ? s.fakta.map(([k, v]) => `<div class="b-kv"><span>${esc(k)}${tip(k)}</span><b>${esc(v)}</b></div>`).join('') : '<p class="b-note">Saknas.</p>'}${safeUrl(s.webb) ? `<a class="b-more" href="${esc(safeUrl(s.webb))}" target="_blank" rel="noopener noreferrer">Bolagets webbplats ↗</a>` : ''}`)}</div>`;
  api('/api/about?s=' + encodeURIComponent(sym) + (EN ? '&lang=en' : ''), 60 * 60e3).then((a) => { const b = $('#about-body'); if (b) b.innerHTML = aboutHTML(a, s); });
}

function viewNotFound() {
  return `
  ${topbar([['Översikt', '/'], ['Sidan finns inte', location.pathname]])}
  <div class="card stack" style="max-width:560px">
    <h1 class="title" style="font-size:36px">Sidan finns inte</h1>
    <p class="muted" style="margin:0">Länken kan vara fel, eller så har sidan flyttat.</p>
    <a class="btn" href="/" data-link style="align-self:flex-start">Till översikten</a>
  </div>`;
}

/* ================= Router ================= */
const LEGACY = { evo: 'EVO.ST', saab: 'SAAB-B.ST', volvo: 'VOLV-B.ST' };
/* ================= Alla aktier: lista med filter ================= */
const KATEGORIER = [
  ['alla', 'Alla', () => true],
  ['utdelare', 'Utdelare', (a) => a.utd != null && a.utd >= 3],
  ['vinnare', 'Dagens vinnare', (a) => a.d1 != null && a.d1 >= 2],
  ['forlorare', 'Dagens förlorare', (a) => a.d1 != null && a.d1 <= -2],
  ['lagpe', 'Låg värdering', (a) => a.pe != null && a.pe > 0 && a.pe < 15],
  ['aret', 'Årets vinnare', (a) => a.ar != null && a.ar >= 30],
  ['forlust', 'Går med förlust', (a) => a.pe === -1],
  ['bevakade', 'Mina bevakade', (a) => getWatch().includes(a.sym)]
];
// Storlek efter börsvärde. Gränserna gäller i respektive valuta (kronor för Sverige, dollar för USA).
const STORLEK = {
  se: [['alla', 'Alla storlekar'], ['stora', 'Stora · över 10 mdr kr', (v) => v >= 10e9], ['medel', 'Medel · 1–10 mdr kr', (v) => v >= 1e9 && v < 10e9], ['sma', 'Små · under 1 mdr kr', (v) => v < 1e9]],
  us: [['alla', 'Alla storlekar'], ['stora', 'Stora · över 200 mdr $', (v) => v >= 200e9], ['medel', 'Medel · 10–200 mdr $', (v) => v >= 10e9 && v < 200e9], ['sma', 'Mindre · under 10 mdr $', (v) => v < 10e9]]
};
const SORTS = [['mcap', 'Börsvärde'], ['d1', 'I dag'], ['ar', '1 år'], ['pe', 'P/E'], ['utd', 'Utdelning'], ['oms', 'Omsättning'], ['namn', 'Namn']];
const PAGE = 50;

function viewAktier() {
  return `
  ${topbar([['Översikt', '/'], ['Alla aktier', '/aktier']])}
  <div class="stack" style="gap:6px">
    <span class="eyebrow" id="ak-status">Hämtar listan …</span>
    <h1 class="title">Alla aktier</h1>
  </div>
  <section class="card ak-filters" aria-label="Filter">
    <div class="ak-row">
      <div class="tabs" role="tablist" aria-label="Marknad"><button role="tab" data-m="se">Sverige</button><button role="tab" data-m="us">USA</button></div>
      <form class="searchbar" role="search" style="flex:1;min-width:200px;max-width:none" data-akform>
        ${svg('search', 18, '#6B6F76')}
        <label class="sr-only" for="ak-q">Filtrera på namn eller ticker</label>
        <input id="ak-q" type="search" placeholder="Filtrera på namn eller ticker" autocomplete="off">
      </form>
      <label class="sr-only" for="ak-sort">Sortera</label>
      <select class="select" id="ak-sort">${SORTS.map(([k, t]) => `<option value="${k}">Sortera: ${t}</option>`).join('')}</select>
    </div>
    <div class="ak-group"><span class="label-up">Kategori</span><div class="chips" id="ak-kat"></div></div>
    <div class="ak-group"><span class="label-up">Bransch</span><div class="chips" id="ak-bransch"></div></div>
    <div class="ak-group"><span class="label-up">Storlek</span><div class="chips" id="ak-storlek"></div></div>
  </section>
  <section class="card" style="padding:8px 8px 14px" aria-labelledby="ak-count">
    <div class="section-head" style="padding:12px 14px 4px;align-items:center"><h2 class="section" id="ak-count" style="font-size:20px">Hämtar …</h2><button class="linkbtn small" type="button" data-reset hidden>Rensa filter</button></div>
    <div id="ak-list">${loading('Hämtar alla aktier …')}</div>
  </section>
  ${footer('Listan visar aktier som datakällan klassar i en bransch. Kurser kan vara fördröjda upp till 15 minuter. P/E räknas på vinsten de senaste tolv månaderna, och utdelning är direktavkastningen det senaste året.')}`;
}

function mountAktier(params) {
  const st = {
    m: params.get('m') === 'us' ? 'us' : 'se',
    q: params.get('q') || '',
    k: KATEGORIER.some((x) => x[0] === params.get('k')) ? params.get('k') : 'alla',
    b: params.get('b') || 'alla',
    st: ['alla', 'stora', 'medel', 'sma'].includes(params.get('st')) ? params.get('st') : 'alla',
    s: SORTS.some((x) => x[0] === params.get('s')) ? params.get('s') : 'mcap',
    d: params.get('d') === 'asc' ? 'asc' : 'desc',
    n: PAGE
  };
  let data = null;
  const syncUrl = () => {
    const p = new URLSearchParams();
    if (st.m !== 'se') p.set('m', st.m); if (st.q) p.set('q', st.q); if (st.k !== 'alla') p.set('k', st.k);
    if (st.b !== 'alla') p.set('b', st.b); if (st.st !== 'alla') p.set('st', st.st);
    if (st.s !== 'mcap') p.set('s', st.s); if (st.d !== 'desc') p.set('d', st.d);
    history.replaceState(null, '', '/aktier' + (p.toString() ? '?' + p : ''));
  };
  $('#ak-q').value = st.q; $('#ak-sort').value = st.s;
  const tabs = () => document.querySelectorAll('[data-m]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.m === st.m)));
  tabs();

  // Filtrera i tur och ordning. Bransch-räknaren visar hur många som finns med övriga filter.
  const pass = (a, skip) => {
    if (st.q) { const q = st.q.toLowerCase(); if (!a.namn.toLowerCase().includes(q) && !a.sym.toLowerCase().includes(q)) return false; }
    if (skip !== 'k' && !KATEGORIER.find((x) => x[0] === st.k)[2](a)) return false;
    if (skip !== 'b' && st.b !== 'alla' && a.bransch !== st.b) return false;
    if (skip !== 'st' && st.st !== 'alla') { const f = STORLEK[st.m].find((x) => x[0] === st.st)[2]; if (a.mcap == null || !f(a.mcap)) return false; }
    return true;
  };
  const sorted = (list) => {
    const dir = st.d === 'asc' ? 1 : -1; const k = st.s;
    return list.slice().sort((x, y) => {
      if (k === 'namn') return dir * -1 * x.namn.localeCompare(y.namn, 'sv');
      const a = k === 'pe' && x.pe === -1 ? null : x[k]; const b = k === 'pe' && y.pe === -1 ? null : y[k];
      if (a == null && b == null) return 0; if (a == null) return 1; if (b == null) return -1;
      return dir * (a - b);
    });
  };

  const drawChips = () => {
    const base = data.aktier;
    $('#ak-kat').innerHTML = KATEGORIER.map(([k, t]) => { const n = base.filter((a) => pass(a, 'k') && KATEGORIER.find((x) => x[0] === k)[2](a)).length; return `<button type="button" class="chip-btn" data-k="${k}" aria-pressed="${st.k === k}" ${n || st.k === k ? '' : 'disabled'}>${esc(t)} <span class="chip-n">${n}</span></button>`; }).join('');
    const counts = {}; for (const a of base) if (pass(a, 'b')) counts[a.bransch] = (counts[a.bransch] || 0) + 1;
    const all = [...new Set(base.map((a) => a.bransch))].sort((a, b) => a.localeCompare(b, 'sv'));
    $('#ak-bransch').innerHTML = `<button type="button" class="chip-btn" data-b="alla" aria-pressed="${st.b === 'alla'}">Alla <span class="chip-n">${base.filter((a) => pass(a, 'b')).length}</span></button>` +
      all.map((b) => `<button type="button" class="chip-btn" data-b="${esc(b)}" aria-pressed="${st.b === b}" ${counts[b] || st.b === b ? '' : 'disabled'}>${esc(b)} <span class="chip-n">${counts[b] || 0}</span></button>`).join('');
    $('#ak-storlek').innerHTML = STORLEK[st.m].map(([k, t]) => `<button type="button" class="chip-btn" data-st="${k}" aria-pressed="${st.st === k}">${esc(t)}</button>`).join('');
  };

  const th = (k, t, cls = '') => `<th scope="col" class="${cls}" aria-sort="${st.s === k ? (st.d === 'asc' ? 'ascending' : 'descending') : 'none'}"><button type="button" class="th-sort" data-sort="${k}">${t}${st.s === k ? (st.d === 'asc' ? ' ↑' : ' ↓') : ''}</button>${tip(t)}</th>`;
  const drawList = () => {
    const list = sorted(data.aktier.filter((a) => pass(a)));
    const filtered = st.q || st.k !== 'alla' || st.b !== 'alla' || st.st !== 'alla';
    $('#ak-count').textContent = `${list.length.toLocaleString(L)} ${list.length === 1 ? 'aktie' : 'aktier'}`;
    $('[data-reset]').hidden = !filtered;
    if (!list.length) { $('#ak-list').innerHTML = '<div class="empty">Inga aktier matchar filtren. Prova att ta bort något filter.</div>'; return; }
    const watch = new Set(getWatch());
    const show = list.slice(0, st.n);
    $('#ak-list').innerHTML = `<div class="table-wrap"><table class="ak-table">
      <thead><tr>${th('namn', 'Bolag')}<th scope="col" class="hide-sm">Bransch</th>${th('d1', 'I dag', 'r')}${th('ar', '1 år', 'r hide-xs')}${th('pe', 'P/E', 'r hide-sm')}${th('utd', 'Utdelning', 'r hide-sm')}${th('mcap', 'Börsvärde', 'r hide-sm')}<th scope="col" class="r"><span class="sr-only">Bevaka</span></th></tr></thead>
      <tbody>${show.map((a) => `<tr>
        <td><a class="ak-name" href="/bolag/${encodeURIComponent(a.sym)}" data-link data-namn="${esc(a.namn)}">${av(a.sym)}<span><b>${esc(a.namn)}</b><span class="small muted">${symFlag(a.sym, 'mob-ak')}${esc(a.sym)} · ${a.kurs != null ? esc(kr(a.kurs)) + ' ' + esc(cur(a.valuta)) : '–'}</span></span></a></td>
        <td class="hide-sm small muted">${esc(a.bransch)}</td>
        <td class="r"><span class="pill ${tone(a.d1)}">${a.d1 != null ? pct(a.d1, 1) : '–'}</span></td>
        <td class="r num hide-xs" style="color:var(--${tone(a.ar)})">${a.ar != null ? pct(a.ar, 0) : '–'}</td>
        <td class="r num hide-sm">${a.pe === -1 ? '<span class="small muted">Förlust</span>' : a.pe != null ? esc(nf(a.pe, 1)) : '–'}</td>
        <td class="r num hide-sm">${a.utd ? esc(nf(a.utd, 1)) + ' %' : a.utd === 0 ? '0 %' : '–'}</td>
        <td class="r num hide-sm">${a.mcap ? esc(mny(a.mcap, a.valuta)) : '–'}</td>
        <td class="r"><button type="button" class="star-btn" data-star="${esc(a.sym)}" data-namn="${esc(a.namn)}" aria-pressed="${watch.has(a.sym)}" aria-label="${watch.has(a.sym) ? 'Sluta bevaka' : 'Bevaka'} ${esc(a.namn)}">${svg('star', 18)}</button></td>
      </tr>`).join('')}</tbody></table></div>
      ${list.length > show.length ? `<div style="display:flex;justify-content:center;padding:14px"><button class="btn ghost" type="button" data-more>Visa fler (${(list.length - show.length).toLocaleString(L)} kvar)</button></div>` : ''}`;
  };
  const draw = () => { if (!data) return; syncUrl(); drawChips(); drawList(); };

  const load = async () => {
    $('#ak-status').textContent = 'Hämtar listan …';
    $('#ak-list').innerHTML = loading('Hämtar alla aktier …');
    const m = st.m;
    const d = await api('/api/aktier?m=' + m, 10 * 60e3);
    if (!$('#ak-list') || m !== st.m) return;
    if (!d || d.error || !d.aktier?.length) {
      $('#ak-status').textContent = 'Listan kunde inte hämtas';
      $('#ak-count').textContent = 'Inga aktier';
      $('#ak-list').innerHTML = `<div class="empty">${esc(d?.error ? errText(d) : 'Datakällan svarade inte.')} Prova igen om en stund.</div>`;
      return;
    }
    data = d;
    if (st.b !== 'alla' && !d.aktier.some((a) => a.bransch === st.b)) st.b = 'alla';
    $('#ak-status').textContent = `${d.aktier.length.toLocaleString(L)} aktier${d.urval ? ' (urval av de största)' : ''} · ${d.kalla} · hämtat kl ${clock(d.hamtad)}`;
    draw();
  };

  let qt;
  $('#ak-q').addEventListener('input', (e) => { clearTimeout(qt); qt = setTimeout(() => { st.q = e.target.value.trim(); st.n = PAGE; draw(); }, 150); });
  $('[data-akform]').addEventListener('submit', (e) => e.preventDefault());
  $('#ak-sort').addEventListener('change', (e) => { st.s = e.target.value; st.d = st.s === 'namn' ? 'asc' : st.s === 'pe' ? 'asc' : 'desc'; st.n = PAGE; draw(); });
  $('.main').addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) { const a = e.target.closest('.ak-name'); if (a) rememberName(decodeURIComponent(a.getAttribute('href').split('/').pop()), a.dataset.namn); return; }
    if (t.dataset.m && t.dataset.m !== st.m) { st.m = t.dataset.m; st.b = 'alla'; st.st = 'alla'; st.n = PAGE; data = null; tabs(); syncUrl(); load(); return; }
    if (t.dataset.k) { st.k = t.dataset.k; st.n = PAGE; draw(); return; }
    if (t.dataset.b) { st.b = t.dataset.b; st.n = PAGE; draw(); return; }
    if (t.dataset.st) { st.st = t.dataset.st; st.n = PAGE; draw(); return; }
    if (t.dataset.sort) { const k = t.dataset.sort; if (st.s === k) st.d = st.d === 'asc' ? 'desc' : 'asc'; else { st.s = k; st.d = k === 'namn' || k === 'pe' ? 'asc' : 'desc'; } $('#ak-sort').value = st.s; st.n = PAGE; draw(); return; }
    if (t.hasAttribute('data-more')) { st.n += PAGE * 2; drawList(); return; }
    if (t.hasAttribute('data-reset')) { st.q = ''; st.k = 'alla'; st.b = 'alla'; st.st = 'alla'; $('#ak-q').value = ''; st.n = PAGE; draw(); return; }
    if (t.dataset.star) {
      if (askLogin()) return;
      rememberName(t.dataset.star, t.dataset.namn);
      const on = toggleWatch(t.dataset.star, t.dataset.namn);
      t.setAttribute('aria-pressed', String(!!on)); refreshNav('aktier'); drawChips();
      if (st.k === 'bevakade' && !on) drawList();
      toast(on ? `${t.dataset.namn} bevakas` : `${t.dataset.namn} bevakas inte längre`, '');
    }
  });
  load();
}

/* ================= Ordförklaringar ================= */
const ORD = {
  'Riskkoll': 'Vår egen sammanvägning av sju saker som påverkar hur riskabel en aktie är, från 1 (låg) till 10 (hög). Ett högt tal betyder att värdet kan svänga mer, inte att aktien är dålig.',
  'Börsvärde': 'Vad hela bolaget är värt på börsen just nu: aktiekursen gånger antalet aktier.',
  '52 veckor': 'Lägsta och högsta kursen det senaste året. Visar hur mycket aktien har svängt.',
  'Bransch': 'Vilken typ av verksamhet bolaget har, till exempel teknik, bank eller fastigheter.',
  'Utdelning': 'Den del av vinsten som bolaget betalar ut till ägarna, räknat i procent av aktiekursen (direktavkastning). 3 % betyder ungefär 3 kr per år för varje 100 kr du äger, om utdelningen ligger kvar.',
  'P/E': 'Pris delat med vinst per aktie. Visar hur många års vinst du betalar för aktien. Lågt tal betyder billigare i förhållande till vinsten, men kan också betyda att marknaden tror på sämre tider.',
  'Kurssvängningar': 'Hur mycket och hur snabbt kursen brukar röra sig. Mäts med beta och årets högsta och lägsta kurs.',
  'Beta': 'Jämför aktiens svängningar med börsen. Beta 1 betyder att den svänger som börsen, 1,5 betyder ungefär 50 % mer.',
  'Skulder': 'Hur mycket bolaget har lånat jämfört med ägarnas egna pengar i bolaget (skuld/eget kapital). Mycket lån blir tungt om räntorna stiger.',
  'Värdering': 'Hur dyr aktien är jämfört med vinsten (P/E). Dyra aktier kan falla mycket om bolaget gör besvikelse.',
  'Lönsamhet': 'Hur stor del av försäljningen som blir vinst (vinstmarginal).',
  'Handel': 'Hur mycket aktien köps och säljs per dag. Lite handel gör det svårare att sälja när man vill.',
  'Storlek': 'Bolagets börsvärde. Små bolag svänger ofta mer och granskas mindre av analytiker och media.',
  'Blankning': 'Att låna aktier och sälja dem för att tjäna pengar om kursen faller. Hög blankning betyder att många professionella investerare tror på ett fall. Det är en signal, inte ett facit.',
  'Insynshandel': 'Köp och försäljningar av personer i bolagets ledning och styrelse, och deras närstående. De måste anmäla affärerna till Finansinspektionen.',
  '1 år': 'Hur mycket kursen har gått upp eller ner det senaste året.',
  'Ticker': 'Aktiens förkortning på börsen, till exempel VOLV-B.ST för Volvo B på Stockholmsbörsen.',
  'Aktieslag': 'Många svenska bolag har A- och B-aktier. A-aktier har oftast mer rösträtt, B-aktier handlas oftast mest.',
  'ETF': 'En fond som handlas på börsen som en aktie. Den följer ofta ett index, till exempel hela Stockholmsbörsen.',
  'Prislarm': 'Du får en notis när en aktie du bevakar rör sig mer än gränsen du valt under dagen.',
  'Direktavkastning': 'Utdelningen per år i procent av aktiekursen. 3 % betyder ungefär 3 kr per år för varje 100 kr du äger, om utdelningen ligger kvar.',
  'MA50': 'Glidande medelvärde 50 dagar: snittet av de senaste 50 börsdagarnas stängningskurser. Visar trenden på kort sikt.',
  'MA200': 'Glidande medelvärde 200 dagar: snittet av de senaste 200 börsdagarnas stängningskurser, ungefär ett år. Visar den långa trenden.',
  'Mot OMXS30': 'Hur din tidsviktade avkastning sedan första köpet står sig mot Stockholmsbörsens 30 största bolag (OMXS30) under samma tid, i procentenheter. I diagrammet ser du också vad pengarna hade varit värda i kronor om du satt in dem i OMXS30 samma dagar. Indexet räknas utan utdelningar.',
  'Tidsviktad avkastning': 'Avkastningen räknad dag för dag utan dina insättningar, så att nya köp inte ser ut som vinst. Det är samma sätt som fonder redovisar sin avkastning på. Per år visas när du har minst ett års historik.',
  'Volatilitet': 'Hur mycket kursen brukar svänga, räknat som ett årstal i procent. 20 % betyder att kursen under ett normalt år kan röra sig ungefär 20 % upp eller ner från snittet. Räknat från dagliga stängningskurser.',
  'Fall från toppen': 'Hur många procent kursen har legat under sin högsta nivå hittills. Visar hur djupa och hur långa nedgångarna har varit.',
  'Dålig dag': 'En av 20 börsdagar det senaste året föll kursen minst så här mycket. Kallas ofta VaR 95 %.',
  'Korrelation': 'Hur lika aktien och börsen rör sig från dag till dag, från −1 till 1. 1 betyder att de alltid rör sig åt samma håll, 0 att de inte hänger ihop.',
  'Stresstest': 'Vad som kan hända med aktien om hela börsen faller. Vi visar både en enkel räkning med beta och vad som faktiskt hände vid tidigare fall.',
  'Vad driver riskkollen': 'Riskkollen är ett snitt av flera delar. Här ser du hur stor del av poängen varje del står för. Delar med Hög väger tyngst.',
  'Försäljning': 'Bolagets intäkter under perioden, även kallat nettoomsättning.',
  'Bruttoresultat': 'Försäljningen minus vad varorna eller tjänsterna kostade att ta fram.',
  'Rörelseresultat': 'Vinsten från den vanliga verksamheten, före räntor och skatt. Kallas också EBIT.',
  'Resultat före skatt': 'Vinsten efter räntor men innan skatten är betald.',
  'Nettoresultat': 'Det som blir kvar till ägarna efter alla kostnader, räntor och skatt.',
  'Rörelsemarginal': 'Rörelseresultatet i procent av försäljningen. Visar hur mycket av varje intjänad krona som blir vinst i verksamheten.',
  'Vinstmarginal': 'Nettoresultatet i procent av försäljningen, efter alla kostnader, räntor och skatt.',
  'Vinst per aktie': 'Nettoresultatet delat på antalet aktier. Kallas också EPS.',
  'Fritt kassaflöde': 'Pengarna som verksamheten drar in minus investeringarna. Det är det bolaget kan använda till utdelning, lån eller nya köp.',
  'Utbetald utdelning': 'Hur mycket pengar bolaget betalade ut till ägarna under perioden.',
  'Kassaflöde från rörelsen': 'Pengarna som den vanliga verksamheten faktiskt drog in under perioden.',
  'Investeringar': 'Pengar som gått till maskiner, fabriker och annat som ska användas länge. Visas som minus eftersom pengarna går ut.',
  'Totala tillgångar': 'Allt bolaget äger: fabriker, lager, kundfordringar, kassa och annat.',
  'Eget kapital': 'Ägarnas pengar i bolaget: tillgångarna minus skulderna.',
  'Skulder (lån)': 'Bolagets lån, både korta och långa.',
  'Kassa': 'Pengar på banken och tillgångar som snabbt kan bli pengar.',
  'Soliditet': 'Eget kapital i procent av alla tillgångar. Högre betyder att bolaget har mindre lån i förhållande till vad det äger.',
  'Skuld / eget kapital': 'Lånen delat med ägarnas kapital. 1 betyder lika mycket lån som eget kapital.',
  'Nettoskuld / EBITDA': 'Lånen minus kassan, delat med rörelseresultatet före avskrivningar för ett år. Ungefär hur många års vinst som behövs för att betala tillbaka lånen.',
  'Räntetäckning': 'Rörelseresultatet delat med räntekostnaden. 10 ggr betyder att vinsten räcker till räntorna tio gånger om.',
  'Balanslikviditet': 'Tillgångar som snart blir pengar, delat med skulder som ska betalas inom ett år. Över 1 betyder att de korta skulderna täcks.',
  'Vinst mot utdelning': 'Nettoresultatet delat med utbetald utdelning. Under 1 betyder att bolaget delade ut mer än det tjänade.',
  'Fakta': 'Grundfakta om bolaget från Yahoo Finance.',
  'Börs': 'Var aktien handlas.',
  'Land': 'Var bolaget har sitt huvudkontor.',
  'Anställda': 'Antal heltidsanställda enligt senaste uppgift.'
};
// Förklaringar sitter på själva texten: håll musen över eller tryck på ordet. En osynlig markör talar om vilket ord det gäller.
const tipMark = (k, txt) => `<span class="tip" data-tip="${esc(k)}"${txt ? ` data-tiptext="${esc(txt)}"` : ''} tabindex="0" role="button" aria-label="Vad betyder ${esc(k)}?" aria-expanded="false"></span>`;
const tip = (k) => (ORD[k] ? tipMark(k) : '');
// En gemensam förklaringsruta för hela sidan
(() => {
  let box = null; let owner = null; let byHover = false; let hov = null;
  const hostOf = (el) => { try { return el?.closest?.(':has(> .tip)') || null; } catch { return null; } };
  const markOf = (host) => host?.querySelector(':scope > .tip');
  const close = () => { if (box) { box.remove(); box = null; } if (owner) { markOf(owner)?.setAttribute('aria-expanded', 'false'); owner.classList.remove('tip-on'); owner = null; } byHover = false; };
  const open = (host, hover) => {
    const m = markOf(host); if (!m) return;
    close(); owner = host; byHover = hover; m.setAttribute('aria-expanded', 'true'); host.classList.add('tip-on');
    box = document.createElement('div'); box.className = 'tip-box'; box.setAttribute('role', 'tooltip');
    box.innerHTML = `<b>${esc(m.dataset.tip)}</b><span>${esc(ORD[m.dataset.tip] || m.dataset.tiptext || '')}</span><a href="/ordlista" data-link>Fler förklaringar</a>`;
    document.body.append(box);
    const r = host.getBoundingClientRect(); const w = Math.min(320, innerWidth - 24);
    box.style.width = w + 'px';
    box.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.left + Math.min(r.width, 160) / 2 - w / 2)) + 'px';
    const below = r.bottom + 8 + box.offsetHeight < innerHeight;
    box.style.top = (below ? r.bottom + 8 + scrollY : r.top - 8 - box.offsetHeight + scrollY) + 'px';
  };
  document.addEventListener('click', (e) => {
    if (e.target.closest?.('.tip-box')) return;
    const host = hostOf(e.target);
    // Knappar och länkar inuti texten gör sitt vanliga jobb, till exempel sortering
    const inter = e.target.closest?.('a,button,input,select,label,[data-btab],[data-bgo]');
    if (!host || (inter && host.contains(inter) && inter !== host)) { if (box) close(); return; }
    e.preventDefault(); e.stopPropagation();
    if (owner === host && !byHover) { close(); return; }
    open(host, false);
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { close(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('tip')) { e.preventDefault(); const h = e.target.parentElement; if (owner === h) close(); else open(h, false); }
  });
  // Med mus räcker det att hålla över texten
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const host = hostOf(e.target); if (!host || owner === host) return;
    clearTimeout(hov); hov = setTimeout(() => { if (owner !== host && host.matches(':hover')) open(host, true); }, 180);
  });
  document.addEventListener('pointerout', (e) => {
    if (e.pointerType !== 'mouse') return;
    const host = hostOf(e.target); clearTimeout(hov); if (!host || owner !== host || !byHover) return;
    const to = e.relatedTarget; if (to && (host.contains(to) || to.closest?.('.tip-box'))) return;
    close();
  });
  document.addEventListener('pointerleave', (e) => { if (byHover && e.target === box) close(); }, true);
  window.addEventListener('popstate', close);
  window.addEventListener('scroll', () => { if (byHover) close(); }, { passive: true });
  document.addEventListener('mk-navigate', close);
})();

function viewOrdlista() {
  return `${topbar([['Översikt', '/'], ['Ordlista', '/ordlista']], false)}
  <div class="stack" style="gap:6px"><span class="eyebrow">Börsens ord på enkel svenska</span><h1 class="title">Ordlista</h1></div>
  <section class="card" style="padding:8px 24px">
    <dl class="glossary">${Object.entries(ORD).sort((a, b) => a[0].localeCompare(b[0], 'sv')).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
  </section>
  ${footer()}`;
}

/* ================= Om oss ================= */
// Fylls i med Albins svar. Tomma fält visas inte.
const OM = {
  namn: 'Albin',
  ansvarig: 'Albin Karlsson',
  roll: 'Grundare av Finanskollen',
  stad: '',
  bild: '',
  mejl: 'kontakt.finanskollen@gmail.com',
  orgnr: '',
  ingress: 'Vi vill att alla ska kunna känna sig trygga i sina affärer inom finans. Finanskollen visar risken i ett bolag på enkel svenska, med fakta från öppna källor, så att du kan förstå innan du sätter in pengar.',
  historia: [
    'Finanskollen startades av Albin, som pluggar till försäljare och själv handlar med aktier och Solana-tokens. Han har sett hur otrygg finansvärlden kan kännas: svåra ord, tips från okända i chattar och sociala medier, och bolag som är svåra att genomskåda.',
    'Därför samlar vi det viktigaste på ett ställe: risken i varje bolag, vad ledningen själv köper och säljer, hur många som satsar på att kursen ska falla och vad nyheterna säger. Allt förklarat så att vem som helst kan förstå.'
  ],
  forVem: 'Finanskollen är till för alla, oavsett om du aldrig har ägt en aktie eller har handlat i många år.',
  loften: [
    'Vi ger aldrig köp- eller säljtips. Vi visar fakta och förklarar risken, du bestämmer själv.',
    'Vi säljer aldrig dina uppgifter, och vi visar ingen reklam som spårar dig.',
    'Vi visar alltid varifrån informationen kommer och när den hämtades.',
    'Saknas det data säger vi det, i stället för att gissa.'
  ],
  vi: 'vi'
};

function viewOm() {
  const p = OM.vi === 'vi';
  return `${topbar([['Översikt', '/'], ['Om oss', '/om']], false)}
  <div class="stack" style="gap:6px"><span class="eyebrow">Vem står bakom Finanskollen?</span><h1 class="title">Om oss</h1></div>
  <div class="om-grid">
    <section class="card om-person">
      ${OM.bild ? `<img src="${esc(OM.bild)}" alt="${esc(OM.namn)}" class="om-photo" width="120" height="120">` : `<span class="avatar om-photo" aria-hidden="true">${esc(OM.namn.split(' ').map((w) => w[0]).join('').slice(0, 2))}</span>`}
      <div><b style="font-size:20px;font-weight:500">${esc(OM.namn)}</b><div class="muted">${esc([OM.roll, OM.stad].filter(Boolean).join(' · '))}</div></div>
      ${OM.mejl ? `<div class="om-contact"><a class="btn" href="mailto:${esc(OM.mejl)}">${svg('chat', 15, '#FFFFFF')} Mejla ${p ? 'oss' : 'mig'}</a><a class="small om-mail" href="mailto:${esc(OM.mejl)}">${esc(OM.mejl)}</a></div>` : ''}
      <p class="small muted" style="margin:0">${OM.orgnr ? `Organisationsnummer ${esc(OM.orgnr)}.` : `Finanskollen drivs just nu av ${esc(OM.namn)} som privatperson.`}</p>
    </section>
    <div class="stack" style="gap:20px">
      <section class="card co-section"><p class="lead" style="margin:0">${esc(OM.ingress)}</p>
        ${OM.historia.map((t) => `<p style="margin:0;font-size:16px;line-height:1.6">${esc(t)}</p>`).join('')}
        ${OM.forVem ? `<p style="margin:0;font-size:16px;line-height:1.6">${esc(OM.forVem)}</p>` : ''}
      </section>
      <section class="card co-section"><span class="label-up">${p ? 'Våra' : 'Mina'} löften till dig</span>
        <ul class="om-list">${OM.loften.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      </section>
      <section class="card co-section"><span class="label-up">Varifrån kommer informationen?</span>
        <ul class="om-list">
          <li><b>Kurser, nyckeltal och nyheter:</b> Yahoo Finance, med Finnhub som reserv.</li>
          <li><b>Insynshandel och blankning:</b> Finansinspektionens öppna register.</li>
          <li><b>Bolagsbeskrivningar och historia:</b> Wikipedia och Wikidata.</li>
          <li><b>AI-sammanfattningar:</b> skrivs av Claude utifrån nyhetsrubrikerna och märks alltid som AI.</li>
          <li><b>Riskkollen:</b> räknas med fasta regler som förklaras på varje bolagssida. Den är en förenkling och inte ett råd.</li>
        </ul>
      </section>
      <section class="card co-section"><span class="label-up">Bra att veta</span>
        <p style="margin:0">Finanskollen ger ingen investeringsrådgivning. Allt du läser här är information, inte en rekommendation att köpa eller sälja. Har du frågor om ditt sparande, prata med din bank eller en rådgivare med tillstånd från Finansinspektionen.</p>
        <p style="margin:0">Har någon kontaktat dig om en placering som låter för bra för att vara sann? Kolla <a href="https://www.fi.se/sv/vara-register/varningslistan/" target="_blank" rel="noopener noreferrer">Finansinspektionens varningslista</a> innan du gör något.</p>
        <p style="margin:0">Finanskollen byggs av Albin Karlsson. Koden skrivs med hjälp av AI. Idéerna, reglerna bakom riskkollen och kontrollen av att siffrorna stämmer mot riktiga kurser gör Albin.</p>
        <p class="small" style="margin:0"><a href="/integritet" data-link>Så hanterar vi dina uppgifter</a> · <a href="/ordlista" data-link>Ordlista</a></p>
      </section>
    </div>
  </div>
  ${footer()}`;
}

/* ================= Integritet ================= */
const SUPA_REGION = 'Sverige, inom EU';
function viewIntegritet() {
  return `${topbar([['Översikt', '/'], ['Integritet', '/integritet']], false)}
  <div class="stack" style="gap:6px"><span class="eyebrow">Senast uppdaterad 9 november 2026</span><h1 class="title">Så hanterar vi dina uppgifter</h1></div>
  <section class="card co-section prose-sec">
    <h2 class="section">Kort sagt</h2>
    <ul class="om-list">
      <li>Vi sparar bara det som behövs för att ditt konto ska fungera: e-post, namn, din bevakning och dina prislarm.</li>
      <li>Vi säljer aldrig dina uppgifter, visar ingen reklam och använder inga spårningscookies.</li>
      <li>Du kan radera ditt konto och allt som hör till det när du vill, med en knapp under <a href="/konto" data-link>Mitt konto</a>.</li>
    </ul>

    <h2 class="section">Vilka uppgifter sparas?</h2>
    <ul class="om-list">
      <li><b>Konto:</b> din e-postadress, ditt namn och ett lösenord. Lösenordet sparas krypterat och kan inte läsas av någon, inte heller av oss.</li>
      <li><b>Inställningar:</b> vilka aktier du bevakar, dina prislarm, dina val för insyns- och blankningslarm, om du vill ha veckobrevet och om du har gått igenom startguiden.</li>
      <li><b>Besöksstatistik:</b> vi räknar hur många som besöker sidan, vilka sidor de läser, varifrån de kommer (till exempel google.com) och om de använder mobil eller dator. Inga cookies används och inget sparas i din webbläsare. För att räkna unika besökare används en förvrängd kod av IP-adress och webbläsare som raderas efter högst två dygn. IP-adressen sparas aldrig.</li>
      <li><b>Portföljer:</b> innehaven du själv skriver in eller importerar under Min portfölj. De syns bara för dig.</li>
      <li><b>Import från banken:</b> filen från Avanza eller Nordnet läses bara i din webbläsare. Själva filen skickas aldrig till oss, bara köpen du väljer att lägga in.</li>
      <li><b>I din webbläsare:</b> din inloggning, din bevakning och dina val sparas lokalt (localStorage) så att sidan går snabbt. Det är inte spårningscookies och försvinner om du rensar webbläsaren.</li>
      <li><b>Tekniska loggar:</b> när du besöker sidan sparar vår webbhotell en kort logg med bland annat din IP-adress, för att kunna hitta fel och stoppa attacker. Loggarna rensas automatiskt.</li>
    </ul>

    <h2 class="section">Var sparas de?</h2>
    <ul class="om-list">
      <li><b>Konton och dina sparade uppgifter</b> sparas hos Supabase${SUPA_REGION ? `, på servrar i ${esc(SUPA_REGION)}` : ''}. Varje användare kan bara läsa sin egen information.</li>
      <li><b>Sidan</b> körs hos Netlify. Deras servrar kan finnas utanför EU, och överföringen sker då med EU:s standardavtalsklausuler.</li>
    </ul>

    <h2 class="section">Delar vi något med andra?</h2>
    <ul class="om-list">
      <li>Kurser, nyheter och register hämtas av vår server från Yahoo Finance, Finnhub, Finansinspektionen och Wikipedia. Din IP-adress och dina uppgifter skickas inte till dem.</li>
      <li>AI-sammanfattningarna skapas av Anthropic (Claude). Bara nyhetsrubriker skickas dit, aldrig något om dig.</li>
      <li>Loggar du in med Google får vi ditt namn, din e-postadress och din profilbild från Google. Vi får aldrig ditt lösenord, och Google ser inte vad du gör på Finanskollen.</li>
      <li>Har du valt veckobrevet skickas det via Resend, en tjänst för e-post. De får din e-postadress och mejlets innehåll, inget annat.</li>
      <li>Typsnittet ligger på vår egen server, så inget skickas till Google.</li>
    </ul>

    <h2 class="section">Notiser</h2>
    <p style="margin:0">Prislarmen och larmen om insynshandel och blankning räknas ut i din webbläsare. Notiserna skickas inte via någon annan tjänst, och du kan stänga av dem i webbläsarens inställningar.</p>

    <h2 class="section">Dina rättigheter</h2>
    <p style="margin:0">Enligt dataskyddsförordningen (GDPR) har du rätt att få veta vilka uppgifter vi har om dig, få fel rättade och få allt raderat. Det mesta ser du själv under Mitt konto, där du också kan radera kontot. ${OM.mejl ? `Har du frågor, mejla <a href="mailto:${esc(OM.mejl)}">${esc(OM.mejl)}</a>.` : ''} Tycker du att vi hanterar dina uppgifter fel kan du klaga hos <a href="https://www.imy.se" target="_blank" rel="noopener noreferrer">Integritetsskyddsmyndigheten (IMY)</a>.</p>

    <h2 class="section">Vem ansvarar?</h2>
    <p style="margin:0">${esc(OM.ansvarig || OM.namn)}${OM.orgnr ? `, organisationsnummer ${esc(OM.orgnr)}` : ', som driver Finanskollen som privatperson,'} ansvarar för behandlingen av dina personuppgifter. Kontakt: <a href="mailto:${esc(OM.mejl)}">${esc(OM.mejl)}</a>. Läs mer <a href="/om" data-link>om oss</a>.</p>
  </section>
  ${footer()}`;
}

/* ================= Radera konto ================= */
// Använder databasfunktionen delete_my_account i Supabase. Den raderar bara den inloggade användaren.
async function deleteAccount() {
  const c = await accCfg(); const t = await token();
  if (!c || !t) throw new Error('Inte inloggad');
  const res = await fetch(c.url + '/rest/v1/rpc/delete_my_account', { method: 'POST', headers: { apikey: c.anon, authorization: 'Bearer ' + t, 'content-type': 'application/json' }, body: '{}' });
  if (res.status === 404) throw Object.assign(new Error('saknas'), { code: 'missing' });
  if (!res.ok) throw new Error('Radering misslyckades (' + res.status + ')');
  for (const k of ['mk-session', 'mk-sync-user', WKEY, LKEY, 'mk-larm-skickat', 'mk-onboarded', NKEY, 'mk-portfolj', 'mk-ova', KKEY, 'mk-kalender']) { try { localStorage.removeItem(k); } catch { /* privat läge */ } }
  ACC.session = null; ACC.user = null;
}
function confirmDelete(onYes) {
  const d = document.createElement('div'); d.className = 'modal-back';
  d.innerHTML = `<div class="modal card" role="dialog" aria-modal="true" aria-labelledby="del-h">
    <h2 class="section" id="del-h" style="font-size:22px">Radera ditt konto?</h2>
    <p style="margin:0">Ditt konto, ditt namn, din bevakning, dina prislarm och dina portföljer raderas för alltid. Det går inte att ångra.</p>
    <label class="field"><span>Skriv RADERA för att bekräfta</span><input type="text" autocomplete="off" data-confirm></label>
    <p class="small" role="status" data-msg style="margin:0;min-height:1em"></p>
    <div class="chips" style="justify-content:flex-end"><button class="btn ghost" type="button" data-no>Avbryt</button><button class="btn danger" type="button" data-yes disabled>Radera kontot</button></div></div>`;
  document.body.append(d);
  const inp = d.querySelector('[data-confirm]'); const yes = d.querySelector('[data-yes]');
  inp.focus();
  inp.addEventListener('input', () => { yes.disabled = inp.value.trim().toUpperCase() !== 'RADERA'; });
  const close = () => d.remove();
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-no]')) close(); });
  d.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  yes.addEventListener('click', async () => {
    yes.disabled = true; d.querySelector('[data-msg]').textContent = 'Raderar …';
    try { await onYes(); close(); }
    catch (err) { yes.disabled = false; d.querySelector('[data-msg]').textContent = err.code === 'missing' ? `Radering är inte påslagen än. ${OM.mejl ? 'Mejla ' + OM.mejl + ' så raderar vi kontot åt dig.' : 'Kontakta oss så raderar vi kontot åt dig.'}` : 'Det gick inte att radera just nu. Prova igen om en stund.'; }
  });
}

/* ================= Kom igång: välj aktier ================= */
const START_VAL = [
  ['VOLV-B.ST', 'Volvo B', 'Lastbilar och bussar'], ['INVE-B.ST', 'Investor B', 'Investmentbolag'], ['ERIC-B.ST', 'Ericsson B', 'Telekom'],
  ['HM-B.ST', 'H&M B', 'Kläder'], ['ATCO-A.ST', 'Atlas Copco A', 'Industri'], ['SEB-A.ST', 'SEB A', 'Bank'],
  ['AZN.ST', 'AstraZeneca', 'Läkemedel'], ['SAAB-B.ST', 'Saab B', 'Försvar'], ['EVO.ST', 'Evolution', 'Onlinespel'],
  ['AAPL', 'Apple', 'Teknik, USA'], ['NVDA', 'Nvidia', 'Halvledare, USA'], ['MSFT', 'Microsoft', 'Mjukvara, USA'],
  ['TSLA', 'Tesla', 'Elbilar, USA'], ['AMZN', 'Amazon', 'E-handel, USA'], ['SPY', 'S&P 500', 'Fond (ETF), USA'], ['EWD', 'Sverige', 'Fond (ETF)']
];
const onboarded = () => !!(ACC.user?.user_metadata?.onboarded || readLS('mk-onboarded', null) === ACC.user?.id);
const needsOnboarding = () => !!ACC.user && !onboarded();

function viewValkommen() {
  return `<div class="stack" style="gap:6px;max-width:760px">
    <span class="eyebrow">Steg 1 av 1 · tar 20 sekunder</span>
    <h1 class="title">Välkommen${firstName() ? ', ' + esc(firstName()) : ''}! Vilka aktier vill du följa?</h1>
    <p class="muted" style="margin:0;font-size:16px">Välj minst tre. De hamnar under Bevakning och på din startsida, och du kan ändra när du vill.</p>
  </div>
  <form class="searchbar" role="search" style="max-width:520px;flex:none;width:100%" data-onsearch>${svg('search', 18, '#6B6F76')}<label class="sr-only" for="on-q">Sök fler bolag</label><input id="on-q" type="search" placeholder="Sök fler bolag, till exempel Spotify" autocomplete="off"></form>
  <div id="on-results"></div>
  <div class="on-grid" id="on-grid"></div>
  <div class="on-bar"><span id="on-count" class="muted">0 valda</span><button class="linkbtn small" type="button" data-skip>Hoppa över</button><button class="btn" type="button" data-done disabled>Klar, visa min startsida</button></div>`;
}
function mountValkommen() {
  const picked = new Map(getWatch().filter(() => readLS(WKEY, null) !== null).map((s) => [s, nameOf(s)]));
  const extra = [];
  const card = ([sym, namn, sub], q) => `<button type="button" class="on-card" data-pick="${esc(sym)}" data-namn="${esc(namn)}" aria-pressed="${picked.has(sym)}">
      ${av(sym)}<span class="grow" style="text-align:left;min-width:0"><b>${esc(namn)}</b><span class="small muted">${esc(sub)}</span></span>
      <span class="on-check" aria-hidden="true">${svg('check', 14)}</span>
      ${q?.d1 != null ? `<span class="on-d1" style="color:var(--${tone(q.d1)})">${pct(q.d1, 1)}</span>` : ''}</button>`;
  let quotes = {};
  const draw = () => {
    $('#on-grid').innerHTML = [...extra, ...START_VAL].map((x) => card(x, quotes[x[0]])).join('');
    $('#on-count').textContent = `${picked.size} ${picked.size === 1 ? 'vald' : 'valda'}`;
    $('[data-done]').disabled = picked.size < 1;
    $('[data-done]').textContent = picked.size < 3 ? `Välj ${3 - picked.size} till` : 'Klar, visa min startsida';
    if (picked.size >= 1) $('[data-done]').disabled = false;
  };
  draw();
  getQuotes(START_VAL.map((x) => x[0])).then((q) => { quotes = q; if ($('#on-grid')) draw(); });
  const finish = async (save) => {
    if (save) {
      SYNCING = true;
      try { for (const [s, n] of picked) rememberName(s, n); writeLS(WKEY, [...picked.keys()]); } finally { SYNCING = false; }
    }
    writeLS('mk-onboarded', ACC.user.id);
    try { const t = await token(); if (t) ACC.user = await auth('/user', { data: { onboarded: true, ...(save ? { bevakning: [...picked.keys()], namn: Object.fromEntries([...picked].map(([s, n]) => [s, n])) } : {}) } }, 'PUT', t); } catch { /* sparas lokalt ändå */ }
    if (save) toast(`Klart! Du bevakar ${picked.size} ${picked.size === 1 ? 'aktie' : 'aktier'}.`, 'Välj ett prislarm under Bevakning om du vill få en notis när de rör sig mycket.');
    goAfterLogin();
  };
  $('.main').addEventListener('click', (e) => {
    const c = e.target.closest('[data-pick]');
    if (c) { const s = c.dataset.pick; if (picked.has(s)) picked.delete(s); else picked.set(s, c.dataset.namn); c.setAttribute('aria-pressed', String(picked.has(s))); draw(); return; }
    const r = e.target.closest('[data-addpick]');
    if (r) { const s = r.dataset.addpick; if (!START_VAL.some((x) => x[0] === s) && !extra.some((x) => x[0] === s)) extra.unshift([s, r.dataset.namn, r.dataset.sub]); picked.set(s, r.dataset.namn); $('#on-q').value = ''; $('#on-results').innerHTML = ''; draw(); return; }
    if (e.target.closest('[data-done]')) finish(true);
    if (e.target.closest('[data-skip]')) finish(false);
  });
  let timer;
  $('#on-q').addEventListener('input', (e) => {
    clearTimeout(timer); const term = e.target.value.trim();
    if (term.length < 2) { $('#on-results').innerHTML = ''; return; }
    timer = setTimeout(async () => {
      const r = await api('/api/search?q=' + encodeURIComponent(term), 60 * 60e3);
      if (!$('#on-results') || term !== $('#on-q').value.trim()) return;
      $('#on-results').innerHTML = `<div class="pick-results card" style="padding:6px 10px">${(r?.results || []).slice(0, 5).map((x) => `<button type="button" class="pick" data-addpick="${esc(x.sym)}" data-namn="${esc(x.klass ? `${x.namn}, ${x.typ}` : x.namn)}" data-sub="${esc([x.typ, x.sym].filter(Boolean).join(' · '))}">${av(x.sym)}<span class="grow" style="text-align:left"><span style="display:block;font-weight:500">${esc(x.namn)}</span><span class="small muted">${esc([x.typ, x.sym].filter(Boolean).join(' · '))}</span></span>${svg('plus', 16)}</button>`).join('') || '<p class="small muted">Inga träffar.</p>'}</div>`;
    }, 300);
  });
  $('[data-onsearch]').addEventListener('submit', (e) => { e.preventDefault(); $('#on-results .pick')?.click(); });
}

/* ================= Lägg till på hemskärmen ================= */
let installEvt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; document.querySelectorAll('[data-install]').forEach((b) => { b.hidden = false; }); });
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function installHTML() {
  if (isStandalone()) return '';
  if (isIOS()) return `<div class="install-tip">${svg('plus', 16)}<span class="small">Lägg Finanskollen på hemskärmen: tryck på <b>Dela</b> och välj <b>Lägg till på hemskärmen</b>. Då fungerar prislarmen som notiser.</span></div>`;
  return `<button class="btn ghost small" type="button" data-install ${installEvt ? '' : 'hidden'}>${svg('plus', 14)} Installera som app</button>`;
}
document.addEventListener('click', async (e) => {
  if (!e.target.closest?.('[data-install]') || !installEvt) return;
  installEvt.prompt();
  const r = await installEvt.userChoice.catch(() => null);
  if (r?.outcome === 'accepted') toast('Finanskollen är installerad', 'Du hittar den bland dina appar.');
  installEvt = null; document.querySelectorAll('[data-install]').forEach((b) => { b.hidden = true; });
});

/* ================= Valutor till kronor ================= */
// Yahoo har växelkurser som "USDSEK=X". Kurser i pence (GBp) räknas om till pund.
async function fxToSek(currencies) {
  const out = { SEK: 1 };
  const need = [...new Set(currencies.filter(Boolean).map((c) => (c === 'GBp' || c === 'GBX' ? 'GBP' : c)).filter((c) => c !== 'SEK'))];
  if (!need.length) return out;
  const q = await getQuotes(need.map((c) => `${c}SEK=X`));
  for (const c of need) if (q[`${c}SEK=X`]?.kurs) out[c] = q[`${c}SEK=X`].kurs;
  if (out.GBP) { out.GBp = out.GBP / 100; out.GBX = out.GBP / 100; }
  return out;
}
const sek = (n) => (n == null ? '–' : `${nf(n, Math.abs(n) >= 1000 ? 0 : 2)} ${cur('SEK')}`);
const sekBig = (n) => (n == null ? '–' : Math.abs(n) >= 1e6 ? `${nf(n / 1e6, 2)} ${EN ? 'm' : 'mn'} ${cur('SEK')}` : `${nf(n, 0)} ${cur('SEK')}`);

// Gemensam sökruta för att välja ett värdepapper
function pickerHTML(id, placeholder) {
  return `<div class="picker-wrap"><form class="searchbar" role="search" style="flex:none;max-width:none" data-pform="${id}">${svg('search', 18, '#6B6F76')}<label class="sr-only" for="${id}">${esc(placeholder)}</label><input id="${id}" type="search" placeholder="${esc(placeholder)}" autocomplete="off"></form><div class="pick-results" data-presults="${id}"></div></div>`;
}
function bindPicker(id, onPick) {
  const input = $('#' + id); const list = $(`[data-presults="${id}"]`); let timer;
  if (!input) return;
  const search = async () => {
    const term = input.value.trim(); if (term.length < 2) { list.innerHTML = ''; return; }
    const r = await api('/api/search?q=' + encodeURIComponent(term), 60 * 60e3);
    if (term !== input.value.trim()) return;
    list.innerHTML = (r?.results || []).slice(0, 6).map((x) => `<button type="button" class="pick" data-sym="${esc(x.sym)}" data-namn="${esc(x.klass ? `${x.namn}, ${x.typ}` : x.namn)}">${av(x.sym)}<span class="grow" style="text-align:left"><span style="display:block;font-weight:500">${esc(x.namn)}</span><span class="small muted">${esc([x.typ, x.sym].filter(Boolean).join(' · '))}</span></span></button>`).join('') || '<p class="small muted" style="padding:6px">Inga träffar.</p>';
  };
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(search, 300); });
  $(`[data-pform="${id}"]`).addEventListener('submit', (e) => { e.preventDefault(); const f = list.querySelector('.pick'); if (f) f.click(); else search(); });
  list.addEventListener('click', (e) => { const p = e.target.closest('.pick'); if (!p) return; rememberName(p.dataset.sym, p.dataset.namn); input.value = ''; list.innerHTML = ''; onPick(p.dataset.sym, p.dataset.namn); });
}
const bar = (pct, cls = '') => `<span class="mini-bar" aria-hidden="true"><span class="${cls}" style="width:${Math.max(2, Math.min(100, pct))}%"></span></span>`;

/* ================= Min portfölj ================= */
// Varje köp sparas med aktie, belopp, valuta och tidpunkt. Antal aktier räknas ut från den riktiga kursen vid köpet.
const PKEY = 'mk-portfolj';
const PF_VALUTOR = ['SEK', 'USD', 'EUR'];
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const getPort = () => {
  const v = readLS(PKEY, []);
  if (!Array.isArray(v)) return [];
  // Äldre innehav (bara antal) behålls men saknar köpdatum
  return v.filter((x) => x && x.sym && x.antal > 0).map((x) => (x.id ? x : { id: uid(), sym: x.sym, antal: x.antal, tid: null, belopp: null, valuta: null, kurs: x.gav ?? null, kursValuta: null, insattSek: null, gammal: true }));
};
const fmtTid = (iso) => new Date(iso).toLocaleString(L, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' });
const fmtDag = (t) => new Date(t * 1000).toLocaleDateString(L, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Stockholm' });
const nfAntal = (n) => (Number.isInteger(n) ? nf(n, 0) : nf(n, n >= 100 ? 1 : n >= 1 ? 2 : 4));

// Kurs och växelkurs vid en tidpunkt. Valuta X till kronor via "XSEK=X".
async function priceAt(sym, t) { return api(`/api/chart?s=${encodeURIComponent(sym)}&t=${t}`, 24 * 60 * 60e3); }
// Exempelportfölj för besökare: 10 000 kr i fyra välkända aktier för ett halvår sedan, med de riktiga kurserna den dagen
const DEMO_SYMS = ['VOLV-B.ST', 'INVE-B.ST', 'ERIC-B.ST', 'AAPL'];
const isDemo = () => getPort().some((b) => b.demo);
async function loadDemo() {
  let d = new Date(Date.now() - 182 * 864e5); while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d = new Date(d.getTime() - 864e5);
  const t = Math.floor(new Date(d.toISOString().slice(0, 10) + 'T15:00:00Z').getTime() / 1000);
  const buys = (await Promise.all(DEMO_SYMS.map(async (sym) => {
    const p = await priceAt(sym, t).catch(() => null); if (!p?.kurs) return null;
    const r = await fxAt(p.valuta, t).catch(() => null); if (!r) return null;
    const insattSek = 10000;
    return { id: 'demo-' + uid(), demo: true, sym, belopp: 10000, valuta: 'SEK', kurs: p.kurs, kursValuta: p.valuta || 'SEK', kursTid: p.kursTid, antal: insattSek / r / p.kurs, insattSek, tid: new Date(t * 1000).toISOString() };
  }))).filter(Boolean);
  if (!buys.length) throw new Error('demo');
  writeLS(PKEY, buys);
}
function clearDemo() { writeLS(PKEY, getPort().filter((b) => !b.demo)); }
// Visas på portföljsidorna för den som inte har konto
const guestBar = () => {
  if (!locked()) return '';
  if (isDemo()) return `<div class="guest-bar"><div><b>${EN ? 'This is an example portfolio.' : 'Det här är en exempelportfölj.'}</b> <span>${EN ? 'Made-up purchases of 10,000 SEK each, six months ago, with the real prices. Not buy tips.' : 'Påhittade köp för 10 000 kr styck för ett halvår sedan, med de riktiga kurserna. Inga köptips.'}</span></div><span class="chips" style="flex:none"><button type="button" class="btn small" data-demo-clear>${EN ? 'Clear and add my own' : 'Töm och lägg in mina egna'}</button><a class="btn ghost small" href="/konto?ny=1" data-link>${EN ? 'Create free account' : 'Skapa gratis konto'}</a></span></div>`;
  return `<div class="guest-bar"><div><b>${EN ? "You're trying it without an account." : 'Du testar utan konto.'}</b> <span>${EN ? 'Your stocks are only saved in this browser. With a free account they are saved, show up on all your devices and you can get alerts.' : 'Dina aktier sparas bara i den här webbläsaren. Med ett gratis konto sparas de, syns på alla dina enheter och du kan få larm.'}</span></div><a class="btn small" href="/konto?ny=1" data-link>${EN ? 'Create free account' : 'Skapa gratis konto'}</a></div>`;
};
const demoBtn = (label) => (locked() && !getPort().length ? `<button type="button" class="btn ghost small" data-demo-load>${label || (EN ? 'Show an example portfolio' : 'Visa en exempelportfölj')}</button>` : '');
document.addEventListener('click', async (e) => {
  const load = e.target.closest('[data-demo-load]'); const clear = e.target.closest('[data-demo-clear]');
  if (load) { e.preventDefault(); load.disabled = true; load.textContent = EN ? 'Fetching prices …' : 'Hämtar kurser …';
    try { await loadDemo(); const to = load.dataset.demoLoad || location.pathname; if (to !== location.pathname) history.pushState(null, '', to); render(); }
    catch { load.disabled = false; load.textContent = EN ? 'Could not fetch prices right now. Try again' : 'Kurserna kunde inte hämtas just nu. Försök igen'; } }
  if (clear) { e.preventDefault(); clearDemo(); history.pushState(null, '', '/portfolj'); render(); }
});
async function fxAt(c, t) {
  if (!c || c === 'SEK') return 1;
  const base = c === 'GBp' || c === 'GBX' ? 'GBP' : c;
  const r = await priceAt(`${base}SEK=X`, t);
  return r?.kurs ? r.kurs / (base !== c ? 100 : 1) : null;
}


/* ================= Import från Avanza och Nordnet ================= */
// Läser bankens exportfil med transaktioner. Köp och försäljningar räknas ihop per värdepapper
// med genomsnittsmetoden: en försäljning minskar alla köp lika mycket. Det som finns kvar blir köp i Min portfölj.
function decodeFile(buf) {
  const b = new Uint8Array(buf);
  if (b[0] === 0xFF && b[1] === 0xFE) return new TextDecoder('utf-16le').decode(buf);
  if (b[0] === 0xFE && b[1] === 0xFF) return new TextDecoder('utf-16be').decode(buf);
  // UTF-16 utan BOM: varannan byte är noll
  if (b.length > 4 && b[1] === 0 && b[3] === 0) return new TextDecoder('utf-16le').decode(buf);
  const t = new TextDecoder('utf-8').decode(buf);
  return t.includes('�') ? new TextDecoder('windows-1252').decode(buf) : t;
}
function splitRow(line, d) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (c === d && !q) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur); return out.map((x) => x.trim());
}
function parseNum(v) {
  let s = String(v ?? '').replace(/[\s  ]/g, '').replace('−', '-');
  if (!s || s === '-') return null;
  const lc = s.lastIndexOf(','); const ld = s.lastIndexOf('.');
  if (lc > ld) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, '');
  const n = Number(s); return Number.isFinite(n) ? n : null;
}
function parseDay(v) {
  const s = String(v || '').trim(); let m;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return `${m[1]}-${m[2]}-${m[3]}`;
  if ((m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/))) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}
const norm = (h) => h.toLowerCase().replace(/[^a-zåäöæøé]/g, '');
// Hittar köp och försäljningar i filen. Returnerar { bank, affarer: [{ dag, typ, namn, isin, antal, kurs, belopp, valuta, kursValuta }] }
function parseBankFile(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error('Filen är tom.');
  const head = lines[0];
  const d = ['\t', ';', ','].map((c) => [c, head.split(c).length]).sort((a, b) => b[1] - a[1])[0][0];
  const H = splitRow(head, d).map(norm);
  const find = (...names) => { for (const n of names) { const i = H.indexOf(norm(n)); if (i >= 0) return i; } return -1; };
  const c = {
    dag: find('Affärsdag', 'Handelsdag', 'Datum', 'Bokföringsdag', 'Handelsdato', 'Bogføringsdag'),
    typ: find('Transaktionstyp', 'Typ av transaktion', 'Transaksjonstype', 'Typ'),
    namn: find('Värdepapper', 'Värdepapper/beskrivning', 'Verdipapir', 'Værdipapirer', 'Instrument'),
    isin: find('ISIN'), antal: find('Antal', 'Antall'), kurs: find('Kurs'), belopp: find('Belopp', 'Beløp', 'Beløb'),
    instr: find('Instrumentvaluta')
  };
  if (c.dag < 0 || c.typ < 0 || c.antal < 0 || (c.namn < 0 && c.isin < 0)) throw new Error('Vi känner inte igen filen. Välj exportfilen med transaktioner från Avanza eller Nordnet.');
  // Valutan för beloppet: Avanzas "Transaktionsvaluta", annars kolumnen "Valuta" direkt efter "Belopp"
  let cv = find('Transaktionsvaluta');
  if (cv < 0 && c.belopp >= 0 && H[c.belopp + 1] === 'valuta') cv = c.belopp + 1;
  if (cv < 0) cv = find('Valuta');
  const bank = H.includes('typavtransaktion') || H.includes('värdepapperbeskrivning') ? 'Avanza' : H.includes('affärsdag') || H.includes('likviddag') ? 'Nordnet' : 'banken';
  const affarer = [];
  for (const line of lines.slice(1)) {
    const r = splitRow(line, d);
    const t = (r[c.typ] || '').toLowerCase();
    const typ = /^(köp|köpt|kjøpt|køb|købt|buy|bought)/.test(t) ? 'kop' : /^(sälj|sålt|salg|solgt|sell|sold)/.test(t) ? 'salj' : null;
    if (!typ) continue;
    const dag = parseDay(r[c.dag]); const antal = Math.abs(parseNum(r[c.antal]) || 0);
    if (!dag || !antal) continue;
    affarer.push({ dag, typ, namn: c.namn >= 0 ? r[c.namn] : '', isin: c.isin >= 0 ? (r[c.isin] || '').toUpperCase() : '', antal, kurs: c.kurs >= 0 ? Math.abs(parseNum(r[c.kurs]) || 0) : null, belopp: c.belopp >= 0 ? Math.abs(parseNum(r[c.belopp]) || 0) : null, valuta: (cv >= 0 && r[cv]) || 'SEK', kursValuta: c.instr >= 0 ? r[c.instr] || null : null });
  }
  if (!affarer.length) throw new Error('Filen innehåller inga köp eller försäljningar av aktier eller fonder.');
  return { bank, affarer: affarer.sort((a, b) => a.dag.localeCompare(b.dag)) };
}
// Kvar efter försäljningar, per värdepapper, med genomsnittsmetoden
function netLots(affarer) {
  const by = new Map();
  for (const a of affarer) {
    const k = a.isin || a.namn.toLowerCase(); if (!by.has(k)) by.set(k, { isin: a.isin, namn: a.namn, lots: [], kursValuta: a.kursValuta });
    const g = by.get(k);
    if (a.typ === 'kop') g.lots.push({ dag: a.dag, antal: a.antal, kurs: a.kurs, belopp: a.belopp ?? (a.kurs ? a.kurs * a.antal : null), valuta: a.valuta });
    else { const tot = g.lots.reduce((s, l) => s + l.antal, 0); if (tot <= 0) continue; const f = Math.max(0, 1 - a.antal / tot); for (const l of g.lots) { l.antal *= f; if (l.belopp != null) l.belopp *= f; } g.lots = g.lots.filter((l) => l.antal > 1e-6); }
  }
  return [...by.values()].filter((g) => g.lots.length);
}
async function findSym(g) {
  const search = async (q) => {
    const r = await api('/api/search?q=' + encodeURIComponent(q.slice(0, 40)), 24 * 60 * 60e3);
    const list = r?.results || []; if (!list.length) return null;
    // Svenska ISIN-nummer handlas oftast i Stockholm
    const pick = (g.isin.startsWith('SE') && list.find((x) => x.sym.endsWith('.ST'))) || list[0];
    return { sym: pick.sym, namn: pick.namn };
  };
  // 1. ISIN-numret är säkrast
  if (g.isin.length >= 12) { const hit = await search(g.isin); if (hit) return hit; }
  // 2. Nordnet skriver ofta tickern, t.ex. "INVE B". Svenska ISIN betyder Stockholmsbörsen.
  const tick = String(g.namn || '').trim().toUpperCase();
  if ((g.isin.startsWith('SE') || !g.isin) && /^[A-Z0-9&]{2,6}( [A-Z])?$/.test(tick)) {
    const sym = tick.replace(' ', '-').replace('&', '') + '.ST';
    const q = await getQuotes([sym]);
    if (q[sym]?.kurs) return { sym, namn: q[sym].namn || tick };
  }
  // 3. Namnet
  return g.namn && g.namn.length >= 2 ? search(g.namn) : null;
}

// Beta vägt efter värde. Saknas beta räknas aktien som börsen (1,0).
const pfBetaOf = (S, sym) => { const b = S[sym]?.beta; return b != null && Number.isFinite(b) ? b : null; };
function pfBeta(hv, S, tot) { const missing = hv.filter((h) => pfBetaOf(S, h.sym) == null); return { beta: tot ? hv.reduce((a, h) => a + h.varde * (pfBetaOf(S, h.sym) ?? 1), 0) / tot : null, missing }; }
function pfStress(hv, S, fall) { const rows = hv.map((h) => { const b = pfBetaOf(S, h.sym); return { h, beta: b, pct: fall * (b ?? 1), loss: h.varde * (fall / 100) * (b ?? 1) }; }).sort((a, b) => a.loss - b.loss); return { rows, sum: rows.reduce((a, r) => a + r.loss, 0) }; }
/* ================= Min portfölj: flikar som på bolagssidan =================
   Översikt, Dagen, Innehav, Risk och analys, Nyheter, Kalender och utdelning, Köp och sälj.
   Alla flikar finns i sidan hela tiden, så att formulär och import fungerar som förut. */
const PF_TABS = [['oversikt', 'Översikt'], ['dagen', 'Dagen'], ['innehav', 'Innehav'], ['risk', 'Risk och analys'], ['nyheter', 'Nyheter'], ['kalender', 'Kalender och utdelning'], ['kop', 'Köp och sälj']];
const pfTab = () => { const f = new URLSearchParams(location.search).get('flik'); return PF_TABS.some((t) => t[0] === f) ? f : 'oversikt'; };
const PF_PAL = ['#E8EAED', '#3A8FD6', '#8FB3E3', '#E7B547', '#B48EE6', '#5B626D']; // samma färger som fördelningen
function ddPanelHTML() {
  const today = sthlmDay(Date.now()); const dag = new URLSearchParams(location.search).get('dag');
  return `<div class="b-card p-dayhead"><div><h2 class="b-lbl" id="dd-title">${EN ? 'Pick a day' : 'Välj dag'}</h2><p class="small muted" style="margin:2px 0 0" id="dd-sub">${EN ? 'How the portfolio moved and which stocks mattered most.' : 'Hur portföljen har rört sig och vilka aktier som påverkade mest.'}</p></div>
    <div class="dd-pick"><button type="button" class="dd-step" data-step="-1" aria-label="Föregående börsdag">‹</button>
      <label class="dd-date"><span class="sr-only">Välj dag</span><input type="date" id="dd-date" max="${today}" value="${esc(dag && dag < today ? dag : today)}"></label>
      <button type="button" class="dd-step" data-step="1" aria-label="Nästa börsdag">›</button>
      <button type="button" class="dd-todaybtn" id="dd-today" ${!dag || dag >= today ? 'hidden' : ''}>I dag</button></div>
    <div class="chips p-bors" id="dd-bors"></div></div>
  <div id="dd-body">${loading('Räknar på din dag …')}</div>`;
}
function viewPortfolj() {
  const tab = pfTab();
  const P = (k, inner) => `<div class="p-panel" data-ppanel="${k}" ${k === tab ? '' : 'hidden'}>${inner}</div>`;
  const C = (cls, inner, id) => `<section class="b-card ${cls}"${id ? ` id="${id}"` : ''}>${inner}</section>`;
  const H = (t, sub) => `<div class="b-ch"><h2 class="b-lbl">${esc(t)}</h2>${sub || ''}</div>`;
  const S = (t) => `<span class="small faint">${t}</span>`;
  return `${topbar([['Översikt', '/'], ['Min portfölj', '/portfolj']])}
  ${guestBar()}
  <section class="b-card b-top p-top">
    <div class="b-top-row">
      <div class="b-id"><span class="b-av p-av">${svg('pie', 18)}</span><div><h1 class="b-name">Min portfölj</h1><span class="small muted" id="pf-sub">${EN ? 'Loading …' : 'Hämtar …'}</span></div></div>
      <div class="b-px"><div class="b-px-main"><span class="num b-px-v" id="pf-tot">–</span></div><button type="button" class="num b-px-d p-daybtn" id="pf-day" data-pfgo="dagen"></button><span class="b-px-t"><i class="b-live" aria-hidden="true"></i><span id="pf-live">${EN ? 'Live prices' : 'Live kurser'}</span></span></div>
      <div class="b-acts"><button type="button" class="btn small" data-pfgo="kop" data-pffocus="pf-q">${svg('plus', 13)} ${EN ? 'Add purchase' : 'Lägg till köp'}</button><button type="button" class="btn small ghost" data-pfgo="kop" data-pffocus="pf-import">${EN ? 'Import' : 'Importera'}</button></div>
    </div>
    <div class="b-stats p-stats" id="pf-sum">${['Insatt', 'Sedan köp', 'Per år', 'Mot OMXS30', 'Riskkoll', 'Volatilitet', 'Utdelning'].map((k) => `<div><span class="b-stat-k">${esc(k)}</span><b class="num">–</b></div>`).join('')}</div>
    <div class="b-tabs" role="tablist" aria-label="Delar av portföljen">${PF_TABS.map(([k, t]) => `<button role="tab" type="button" data-ptab="${k}" aria-selected="${k === tab}">${esc(t)}</button>`).join('')}</div>
  </section>
  ${P('oversikt', `<div class="b-grid">
    ${C('c8', `<div class="b-ch"><div class="b-chl"><h2 class="b-lbl">${EN ? 'Value over time' : 'Värde över tid'}</h2><span class="small" id="pf-tlchg"></span></div><div class="b-ctrl"><div class="b-segc" role="tablist" aria-label="Period" id="pf-range">${[['1m', '1M'], ['6m', '6M'], ['1y', '1Å'], ['all', 'Allt']].map(([k, t]) => `<button role="tab" type="button" data-pfrange="${k}" aria-selected="${k === 'all'}">${t}</button>`).join('')}</div><button type="button" class="b-tog ma200" data-pfidx aria-pressed="true">${EN ? 'Compare with OMXS30' : 'Jämför med OMXS30'}</button></div></div>
      <div id="pf-tl" class="chart p-tl">${loading('Räknar fram tidslinjen …')}</div>`)}
    ${C('c4', `${H(EN ? 'In plain words' : 'I klartext')}${S(EN ? 'The most important about your portfolio right now' : 'Det viktigaste om din portfölj just nu')}<div id="pf-ins">${loading()}</div>`)}
    ${C('c5', `${H(EN ? 'Return per period' : 'Avkastning per period', S(EN ? 'time-weighted, without deposits' : 'tidsviktad, utan insättningar'))}<div id="pf-perf">${loading()}</div>`)}
    ${C('c4', `${H(EN ? 'What made the profit' : 'Vad har gett vinsten', S(EN ? 'since purchase, SEK' : 'sedan köp, kr'))}<div id="pf-contr">${loading()}</div>`)}
    ${C('c3', `${H(EN ? 'Allocation' : 'Fördelning')}<div class="b-segc" role="tablist" aria-label="Fördelning" id="pf-aseg">${[['bransch', 'Bransch'], ['land', 'Land'], ['valuta', 'Valuta'], ['innehav', 'Innehav']].map(([k, t]) => `<button role="tab" type="button" data-pfalloc="${k}" aria-selected="${k === 'bransch'}">${t}</button>`).join('')}</div><div id="pf-alloc">${loading()}</div>`)}
    ${C('c12', `${H(EN ? 'Holdings' : 'Innehav', S(EN ? 'Sorted by value · tap to open the company' : 'Sorterat efter värde · tryck för att öppna bolaget'))}<div id="pf-ovtable">${loading('Hämtar kurser …')}</div>`)}
  </div>`)}
  ${P('dagen', ddPanelHTML())}
  ${P('innehav', `<div class="b-grid">
    ${C('c12', `${H(EN ? 'All holdings' : 'Alla innehav', `<span class="small muted" id="pf-count"></span>`)}<div id="pf-htable">${loading('Hämtar kurser …')}</div>`)}
    ${C('c12', `${H(EN ? 'Your purchases per stock' : 'Dina köp per aktie')}${S(EN ? 'Tap a holding to see your purchases, add more or remove one.' : 'Tryck på ett innehav för att se dina köp, lägga till fler eller ta bort ett.')}<div id="pf-list">${loading('Hämtar kurser …')}</div>`)}
  </div>`)}
  ${P('risk', `<div id="pf-risk">${loading('Räknar på risken …')}</div><div class="p-side" id="pf-side"></div>`)}
  ${P('nyheter', `<div class="b-grid">
    ${C('c8', `<div class="b-ch"><h2 class="b-lbl">${EN ? 'News about your stocks' : 'Nyheter om dina aktier'}</h2><div class="b-segc" role="tablist" aria-label="Sortering"><button type="button" role="tab" data-pfnsort="vikt" aria-selected="true">Viktigast</button><button type="button" role="tab" data-pfnsort="tid" aria-selected="false">Senaste</button></div></div><div class="p-nchips" id="pf-nchips"></div><div id="pf-news">${loading('Hämtar nyheter …')}</div>`)}
    <div class="c4 p-col">
      ${C('', `<div class="b-ch"><h2 class="b-lbl p-ai"><span aria-hidden="true">✦</span>${EN ? 'The week in your stocks' : 'Veckan i dina aktier'}</h2></div><div id="pf-week">${loading()}</div>`)}
      ${C('', `${H(EN ? 'News per holding, 14 days' : 'Nyheter per innehav, 14 dagar')}<div id="pf-ncount">${loading()}</div>`)}
      ${C('', `${H(EN ? 'Important ahead' : 'Viktigt framåt', `<button type="button" class="b-more linkbtn" data-pfgo="kalender">${EN ? 'Calendar →' : 'Kalender →'}</button>`)}<div id="pf-ahead">${loading()}</div>`)}
    </div>
  </div>`)}
  ${P('kalender', `<div class="b-grid">
    ${C('c7', `${H(EN ? 'Dividends per month, next 12 months' : 'Utdelningar per månad, kommande 12 mån', `<span class="small up" id="pf-utdtot"></span>`)}<div id="pf-utdm">${loading()}</div>`)}
    ${C('c5', `${H(EN ? 'Expected dividend' : 'Väntad utdelning')}<div id="pf-utd">${loading()}</div>`)}
    ${C('c12', `${H(EN ? 'Coming up for your stocks' : 'Kommande för dina aktier', S(EN ? 'Next 4 months' : 'De närmaste fyra månaderna'))}<div id="pf-kal">${loading()}</div>`)}
    ${C('c12', `${H(EN ? 'Per holding' : 'Per innehav')}<div id="pf-kalh">${loading()}</div><span class="b-src">${EN ? 'Dates and dividends come from Yahoo Finance and can change. The dividend per year is based on the latest known dividend and is no guarantee. The months are estimated from when the company paid in the last 12 months. The ex-date is the first day the stock trades without the right to the dividend.' : 'Datum och utdelningar kommer från Yahoo Finance och kan ändras. Utdelningen per år bygger på den senast kända utdelningen och är ingen garanti. Månaderna är uppskattade från när bolaget delade ut de senaste 12 månaderna. X-dagen är första dagen aktien handlas utan rätt till utdelning.'}</span>`)}
  </div>`)}
  ${P('kop', `<div class="b-grid">
    ${C('c12', `${H(EN ? 'All purchases' : 'Alla köp', `<span class="b-ctrl"><span class="small faint" id="pf-txn-s"></span><button type="button" class="b-more linkbtn" data-pfcsv>${EN ? 'Export to CSV' : 'Exportera till CSV'}</button></span>`)}<div id="pf-txn">${loading()}</div>`)}
    ${C('c7', `<h2 class="b-lbl">${EN ? 'Add a purchase' : 'Lägg till ett köp'}</h2>${pickerHTML('pf-q', 'Vilken aktie eller fond köpte du? Till exempel Volvo')}<div id="pf-form"></div>`, 'pf-add-card')}
    ${C('c5', `<div class="b-ch"><h2 class="b-lbl">${EN ? 'Import from Avanza or Nordnet' : 'Importera från Avanza eller Nordnet'}</h2><span class="pill outline">CSV</span></div>
      <details class="imp-help"><summary>Så hämtar du filen</summary><ol class="om-list">
        <li><b>Avanza:</b> logga in på avanza.se, gå till <b>Transaktioner</b>, välj hela perioden och tryck på <b>Exportera</b>.</li>
        <li><b>Nordnet:</b> logga in på nordnet.se, gå till <b>Transaktioner och notor</b>, välj hela perioden och tryck på <b>Exportera</b>.</li>
        <li>Välj filen här nedanför. Filen läses bara i din webbläsare och skickas aldrig till oss.</li></ol></details>
      <label class="btn ghost imp-file">${svg('plus', 14)} Välj fil<input type="file" accept=".csv,.txt,text/csv,text/plain" data-impfile hidden></label>
      <div id="pf-imp"></div>`, 'pf-import')}
  </div>`)}
  <p class="small faint" style="margin:0">Köpen sparas på ditt konto och syns bara för dig. Vi räknar med kursen vid den tid du anger (timkurser för de senaste två åren, annars dagens stängningskurs) och med växelkursen samma dag. Avgifter som courtage räknas inte med. Portföljkollen är en förenkling och inget råd.</p>
  ${footer()}`;
}

/* ---- Historik: tidsviktad avkastning, OMXS30 och riskmått ---- */
// Index med samma insättningar: varje köp köper OMXS30 för samma summa samma dag
async function pfIndexSeries(buys, ser) {
  const bs = buys.filter((b) => b.tid && b.insattSek != null);
  if (!bs.length || !ser?.value?.length) return null;
  const from = new Date(Math.min(...bs.map((b) => new Date(b.tid).getTime())) - 5 * 864e5).toISOString().slice(0, 10);
  const c = await api(`/api/chart?s=${encodeURIComponent('^OMX')}&from=${from}`, 30 * 60e3).catch(() => null);
  const pts = c?.punkter || []; if (pts.length < 2) return null;
  const at = (t) => { let v = null; for (const p of pts) { if (p[0] <= t) v = p[1]; else break; } return v ?? pts[0][1]; };
  const lots = bs.map((b) => { const t = new Date(b.tid).getTime() / 1000; return { t, units: b.insattSek / at(t) }; });
  return ser.value.map(([t]) => [t, Math.round(lots.filter((l) => l.t <= t).reduce((a, l) => a + l.units, 0) * at(t))]);
}
// Tidsviktad avkastning dag för dag: insättningar räknas bort så att nya köp inte ser ut som vinst
function pfTwr(ser) {
  const V = ser.value, I = ser.invested; const r = [];
  const daily = V.length > 1 && V[1][0] - V[0][0] <= 86400 * 1.5;
  for (let i = 1; i < V.length; i++) { const flow = I[i][1] - I[i - 1][1]; if (V[i - 1][1] > 0) r.push({ t: V[i][0], day: sthlmDay(V[i][0] * 1000), r: (V[i][1] - flow) / V[i - 1][1] - 1 }); }
  // Lördag och söndag har ingen handel: deras avkastning är noll och räknas bort, måndagen får rörelsen sedan fredagen
  return daily ? r.filter((x) => { const d = new Date(x.t * 1000).getUTCDay(); return d !== 0 && d !== 6; }) : r;
}
// Skillnad i procentenheter med en decimal, utan tecken när den avrundas till noll
const ppDiff = (d) => { const r = Math.abs(d).toFixed(1); return (Number(r) === 0 ? '' : d > 0 ? '+' : '−') + r.replace('.', EN ? '.' : ','); };
const pfSd = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
const pfCorrOf = (a, b) => { const ma = a.reduce((x, y) => x + y, 0) / a.length, mb = b.reduce((x, y) => x + y, 0) / b.length; let c = 0, va = 0, vb = 0; for (let i = 0; i < a.length; i++) { c += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; } return c / Math.sqrt(va * vb); };
// Allt som räknas fram ur tidslinjen. omx = OMXS30:s stängningskurser per dag.
function pfStats(ser, omx, day) {
  const out = { ok: false };
  if (!ser || ser.error) return out;
  const r = pfTwr(ser); if (!r.length) return out;
  out.ok = true; out.n = r.length; out.daily = ser.value[1][0] - ser.value[0][0] <= 86400 * 1.5;
  const firstDay = sthlmDay(ser.value[0][0] * 1000); out.firstDay = firstDay;
  const lastDay = r[r.length - 1].day;
  const omxMap = new Map(omx || []); const omxDays = (omx || []).map((x) => x[0]);
  const omxAt = (d) => { let v = null; for (const [k, c] of omx || []) { if (k <= d) v = c; else break; } return v; };
  const twrFrom = (d) => r.filter((x) => x.day > d).reduce((a, x) => a * (1 + x.r), 1) - 1;
  // Avkastning per period
  const today = sthlmDay(Date.now()); const back = (n) => sthlmDay(Date.now() - n * 864e5);
  const P = [[EN ? 'Today' : 'I dag', 'idag'], [EN ? '1 week' : '1 vecka', back(7)], [EN ? '1 month' : '1 månad', back(30)], [EN ? '3 months' : '3 månader', back(91)], [EN ? 'This year' : 'I år', `${today.slice(0, 4) - 1}-12-31`], [EN ? '1 year' : '1 år', back(365)], [EN ? 'Since start' : 'Sedan start', firstDay]];
  const omxLast = omx?.length ? omx[omx.length - 1][1] : null;
  out.perf = P.map(([n, d]) => {
    if (d === 'idag') { const prevO = omx?.length > 1 ? omx[omx.length - 2][1] : null; return { n, u: day?.pct ?? null, i: omxLast && prevO && omx[omx.length - 1][0] === today ? (omxLast / prevO - 1) * 100 : null }; }
    const u = d >= firstDay ? twrFrom(d) * 100 : null;
    const o = omxAt(d); return { n, u, i: omxLast && o ? (omxLast / o - 1) * 100 : null };
  });
  out.twrStart = twrFrom(firstDay) * 100; out.omxStart = out.perf[out.perf.length - 1].i;
  out.days = (Date.parse(lastDay) - Date.parse(firstDay)) / 864e5;
  out.perYear = out.days >= 365 ? ((1 + out.twrStart / 100) ** (365 / out.days) - 1) * 100 : null;
  // Svängningar, senaste året
  const last = r.slice(-252).map((x) => x.r);
  if (last.length >= 40) {
    out.vol = pfSd(last) * Math.sqrt(out.daily ? 252 : 52) * 100;
    const s = [...last].sort((a, b) => a - b); out.var95 = s[Math.floor(s.length * 0.05)] * 100; out.best = s[s.length - 1] * 100; out.worst = s[0] * 100;
    out.upDays = last.filter((x) => x > 0).length / last.length * 100;
    if (r.length >= 22) out.vol30 = pfSd(r.slice(-21).map((x) => x.r)) * Math.sqrt(252) * 100;
  }
  // OMXS30: svängningar och samvariation med portföljen
  const oret = []; for (let i = 1; i < omxDays.length; i++) oret.push([omxDays[i], omxMap.get(omxDays[i]) / omxMap.get(omxDays[i - 1]) - 1]);
  const o1y = oret.slice(-252).map((x) => x[1]); if (o1y.length >= 40) out.omxVol = pfSd(o1y) * Math.sqrt(252) * 100;
  const om = new Map(oret); const pair = r.slice(-252).filter((x) => om.has(x.day)).map((x) => [x.r, om.get(x.day)]);
  if (pair.length >= 40) out.corrOmx = pfCorrOf(pair.map((x) => x[0]), pair.map((x) => x[1]));
  if (out.perYear != null && out.vol) out.retRisk = out.perYear / out.vol;
  // Fall från toppen, och hur lång tid det tog att komma tillbaka
  let idx = 1, peak = 1, peakT = r[0].t, maxDd = 0, ddT = null, ddPeakT = null; const dd = [];
  for (const x of r) { idx *= 1 + x.r; if (idx >= peak) { peak = idx; peakT = x.t; } const d = (idx / peak - 1) * 100; dd.push([x.t, d]); if (d < maxDd) { maxDd = d; ddT = x.t; ddPeakT = peakT; } }
  out.dd = dd; out.maxDd = maxDd; out.ddT = ddT; out.nowDd = dd[dd.length - 1][1];
  if (ddT) { const after = dd.find(([t, d]) => t > ddT && d >= -0.0001); out.recovery = after ? { days: (after[0] - ddPeakT) / 86400, done: true } : { days: (r[r.length - 1].t - ddPeakT) / 86400, done: false }; }
  return out;
}
// Samvariation och riskbidrag ur de senaste årets dagliga kurser, i varje akties egen valuta
async function pfCov(hold) {
  const top = hold.filter((h) => h.varde).sort((a, b) => b.varde - a.varde).slice(0, 12);
  if (top.length < 2) return null;
  const cs = await Promise.all(top.map((h) => api(`/api/chart?s=${encodeURIComponent(h.sym)}&r=1y`, 60 * 60e3).catch(() => null)));
  const ok = top.map((h, i) => [h, new Map(closesByDay(cs[i]?.punkter))]).filter(([, m]) => m.size > 60);
  if (ok.length < 2) return null;
  const days = [...ok[0][1].keys()].filter((d) => ok.every(([, m]) => m.has(d))).sort();
  if (days.length < 60) return null;
  const R = ok.map(([, m]) => days.slice(1).map((d, i) => m.get(d) / m.get(days[i]) - 1));
  const mean = R.map((a) => a.reduce((x, y) => x + y, 0) / a.length);
  const cov = R.map((a, i) => R.map((b, j) => a.reduce((s, x, k) => s + (x - mean[i]) * (b[k] - mean[j]), 0) / (a.length - 1)));
  const tw = ok.reduce((a, [h]) => a + h.varde, 0); const w = ok.map(([h]) => h.varde / tw);
  const Sw = cov.map((row) => row.reduce((s, c, j) => s + c * w[j], 0)); const varP = w.reduce((s, x, i) => s + x * Sw[i], 0);
  const syms = ok.map(([h]) => h.sym);
  return { syms, w, contr: w.map((x, i) => (x * Sw[i]) / varP * 100), corr: cov.map((row, i) => row.map((c, j) => c / Math.sqrt(cov[i][i] * cov[j][j]))), days: days.length, covered: tw };
}

function pfRiskHTML(pd, st, cov, plan) {
  const { hold, tot, risk, S, valOf } = pd;
  const hv = hold.filter((h) => h.varde).sort((a, b) => b.varde - a.varde);
  if (!hv.length || !tot) return `<p class="b-note">${EN ? 'Prices are missing, so the risk cannot be calculated right now.' : 'Kurserna saknas, så risken kan inte räknas just nu.'}</p>`;
  const share = (x) => (x / tot) * 100; const miss = `<span class="faint">${EN ? 'Missing' : 'Saknas'}</span>`;
  const grp = (f) => { const m = {}; for (const h of hv) { const k = f(h); m[k] = (m[k] || 0) + h.varde; } return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const br = grp((h) => h.bransch); const la = grp((h) => h.land); const va = grp((h) => valOf(h.sym));
  const foreign = va.filter(([k]) => k !== 'SEK').reduce((a, x) => a + x[1], 0);
  const usd = va.find(([k]) => k === 'USD')?.[1] || 0;
  const pb = pfBeta(hv, S, tot); const betaW = pb.beta; const noBeta = pb.missing;
  const s20 = pfStress(hv, S, -20).sum;
  const badMonth = st?.vol != null ? -1.2816 * (st.vol / Math.sqrt(12)) / 100 * tot : null;
  const brS = share(br[0][1]);
  const cardsP = [
    [EN ? 'A normal bad month' : 'En vanlig dålig månad', badMonth != null ? krDiff(badMonth) : null, EN ? 'about one month in ten falls this much, estimated from the swings' : 'ungefär var tionde månad faller portföljen så här mycket, räknat från svängningarna', 'down'],
    [EN ? 'If the market falls 20 %' : 'Om börsen faller 20 %', krDiff(s20), `${EN ? 'the portfolio falls about' : 'portföljen faller ca'} ${nf(Math.abs(s20) / tot * 100, 1)} %, ${betaW > 1.02 ? (EN ? 'more than the market' : 'mer än börsen') : betaW < 0.98 ? (EN ? 'less than the market' : 'mindre än börsen') : (EN ? 'about as much as the market' : 'ungefär som börsen')}${noBeta.length ? (EN ? ` (beta missing for ${noBeta.length}, counted as the market)` : ` (beta saknas för ${noBeta.length}, räknas som börsen)`) : ''}`, 'down'],
    [EN ? 'If the dollar falls 10 %' : 'Om dollarn faller 10 %', usd ? krDiff(-0.1 * usd) : '0 kr', usd ? `${nf(share(usd), 0)} % ${EN ? 'of the money is in USD' : 'av pengarna ligger i USD'}` : (EN ? 'none of your holdings are in USD' : 'inga av dina innehav är i USD'), usd ? 'warn' : 'up'],
    [EN ? 'Biggest concentration' : 'Största koncentrationen', br[0][0], `${nf(brS, 0)} % ${EN ? 'of the money' : 'av pengarna'}${cov ? '' : ''}`, brS > 50 ? 'down' : 'warn']
  ];
  const L = (l) => ({ 1: ['Låg', 'up'], 2: ['Medel', 'warn'], 3: ['Hög', 'down'] }[l]);
  const topShare = share(hv[0].varde); const fShare = share(foreign);
  const effN = 1 / hv.reduce((a, h) => a + (h.varde / tot) ** 2, 0);
  const pairs = []; if (cov) for (let i = 0; i < cov.syms.length; i++) for (let j = i + 1; j < cov.syms.length; j++) pairs.push([cov.syms[i], cov.syms[j], cov.corr[i][j]]);
  pairs.sort((a, b) => b[2] - a[2]); const tight = pairs.filter((p) => p[2] >= 0.6);
  const parts = [
    ['Spridning', `${EN ? 'Largest holding' : 'Största innehav'} ${nf(topShare, 0)} %`, hv.length < 5 || topShare > 30 ? 3 : topShare > 20 || effN < 5 ? 2 : 1, `${hv.length} ${EN ? 'holdings' : 'innehav'}, ${EN ? 'which works like' : 'vilket motsvarar ungefär'} ${nf(effN, 1)} ${EN ? 'equally large ones' : 'lika stora'}.${tight.length ? ` ${ovName(tight[0][0])} ${EN ? 'and' : 'och'} ${ovName(tight[0][1])} ${EN ? 'move almost alike.' : 'rör sig nästan likadant.'}` : ''}${hv.length < 5 ? (EN ? ' With fewer than five, one fall can hit hard.' : ' Med färre än fem kan ett enskilt fall slå hårt.') : ''}`],
    ['Bransch', `${br[0][0]} ${nf(brS, 0)} %`, brS > 50 ? 3 : brS > 35 ? 2 : 1, brS > 35 ? (EN ? 'A bad year for the sector hits a large part of the portfolio at the same time.' : 'Ett dåligt år för branschen slår mot en stor del av portföljen samtidigt.') : (EN ? 'Spread over several sectors.' : 'Spritt över flera branscher.')],
    ['Valuta', `${EN ? 'Foreign' : 'Utländsk'} ${nf(fShare, 0)} %`, fShare > 60 ? 3 : fShare > 25 ? 2 : 1, fShare > 25 ? (EN ? 'The value in kronor moves with the exchange rate, both ways.' : 'Värdet i kronor påverkas av växelkursen, åt båda hållen.') : (EN ? 'Mostly in Swedish kronor.' : 'Mest i svenska kronor.')],
    ['Svängningar', st?.vol != null ? `${EN ? 'Volatility' : 'Volatilitet'} ${nf(st.vol, 1)} %` : (EN ? 'Too short history' : 'För kort historik'), st?.vol == null ? null : st.vol > 30 ? 3 : st.vol > (st.omxVol || 18) * 1.1 ? 2 : 1, st?.vol == null ? (EN ? 'Shown when there are at least two months of prices since your first purchase.' : 'Visas när det finns minst två månaders kurser sedan ditt första köp.') : st.omxVol ? `${EN ? 'OMXS30 swung' : 'OMXS30 svängde'} ${nf(st.omxVol, 1)} % ${EN ? 'the same year.' : 'samma år.'} ${st.vol > st.omxVol * 1.1 ? (EN ? 'Larger ups and downs than the market.' : 'Större upp- och nedgångar än börsen.') : st.vol < st.omxVol * 0.9 ? (EN ? 'Calmer than the market.' : 'Lugnare än börsen.') : (EN ? 'About like the market.' : 'Ungefär som börsen.')}` : ''],
    ['Enskilda bolag', risk != null ? `${EN ? 'Risk check' : 'Riskkoll'} ${nf(risk, 1)}` : '–', risk == null ? null : lvlOf(Math.round(risk)), (() => { const hi = hv.filter((h) => h.poang != null && h.poang >= 7); const mid = hv.filter((h) => h.poang != null && h.poang >= 4 && h.poang < 7); return hi.length ? `${hi.map((h) => ovName(h.sym)).join(', ')} ${EN ? 'has a high risk check.' : 'har hög riskkoll.'}` : mid.length ? `${EN ? 'No holding has a high risk check.' : 'Inget innehav har hög riskkoll.'} ${mid.slice(0, 2).map((h) => ovName(h.sym)).join(EN ? ' and ' : ' och ')} ${EN ? 'are medium.' : 'ligger på medel.'}` : (EN ? 'None of your holdings has a high risk check.' : 'Inget av dina innehav har hög riskkoll.'); })()]
  ];
  // Vem står för risken: andel av portföljens svängningar. Saknas kurser används värde × riskkoll.
  const rc = cov ? cov.syms.map((s, i) => ({ s, p: cov.contr[i], m: share(hold.find((h) => h.sym === s).varde) })) : hv.filter((h) => h.poang != null).map((h) => ({ s: h.sym, x: h.varde * h.poang, m: share(h.varde) }));
  if (!cov) { const sum = rc.reduce((a, x) => a + x.x, 0); rc.forEach((x) => { x.p = x.x / sum * 100; }); }
  rc.sort((a, b) => b.p - a.p); const rcMax = Math.max(1, ...rc.map((x) => x.p));
  const expo = (title, list) => `<div class="p-expo"><span class="n-k">${esc(title)}</span><span class="p-expo-bar">${list.slice(0, 6).map(([k, v], i) => `<i style="width:${share(v).toFixed(1)}%;background:${PF_PAL[i]}" title="${esc(k)}"></i>`).join('')}</span><span class="p-expo-leg">${list.slice(0, 6).map(([k, v], i) => `<span><i style="background:${PF_PAL[i]}"></i>${esc(k)} ${nf(share(v), 0)} %</span>`).join('')}</span></div>`;
  const cbg = (x) => (x >= 0.999 ? 'var(--line)' : x >= 0 ? `rgba(240,113,103,${(x * 0.8).toFixed(2)})` : `rgba(90,169,230,${(-x * 0.8).toFixed(2)})`);
  const n6 = cov ? Math.min(6, cov.syms.length) : 0;
  const lv = risk != null ? lvlOf(Math.round(risk)) : null; const C = 2 * Math.PI * 46;
  const falls = [-10, -20, -30];
  const kv = (k, v, s, t) => `<div class="b-kv"><span>${esc(k)}${t ? tip(t) : ''}${s ? `<span class="faint b-kv-s">${esc(s)}</span>` : ''}</span><b class="num">${v ?? miss}</b></div>`;
  const mon = (d) => (d < 45 ? `${Math.max(1, Math.round(d))} ${EN ? 'days' : 'dagar'}` : `${Math.round(d / 30.4)} ${EN ? 'months' : 'månader'}`);
  return `
  <nav class="b-jump" aria-label="Delar av riskanalysen"><a href="#pr1">01 I klartext</a><a href="#pr2">02 Riskens delar</a><a href="#pr3">03 Var risken sitter</a><a href="#pr4">04 Om det går dåligt</a><a href="#pr5">05 Riskmått</a></nav>
  ${bH('01', EN ? 'Your risk in plain words' : 'Din risk i klartext', EN ? 'What the risks mean in kronor for you' : 'Vad riskerna betyder i kronor för just dig', 'pr1')}
  <div class="p-plain">${cardsP.map(([q, v, s, t]) => `<div class="p-pc ${t}"><span>${esc(q)}</span><b class="num">${v == null ? miss : esc(v)}</b><span class="small">${esc(s)}</span></div>`).join('')}</div>
  ${bH('02', EN ? 'The parts of the risk' : 'Riskens delar', EN ? 'Five things that decide how risky your portfolio is' : 'Fem saker som avgör hur riskabel din portfölj är', 'pr2')}
  <div class="b-grid">
    <section class="b-card c4"><div class="b-ch"><h3 class="b-lbl">${EN ? 'Risk check for the portfolio' : 'Riskkoll för portföljen'}${tip('Riskkoll')}</h3><span class="small faint">${EN ? 'weighted by value' : 'vägt efter värde'}</span></div>
      <div class="n-rk"><svg viewBox="0 0 110 110" class="n-ring" role="img" aria-label="Riskkoll"><circle cx="55" cy="55" r="46" fill="none" stroke="var(--line-soft)" stroke-width="9"/><circle class="n-ringv" cx="55" cy="55" r="46" fill="none" stroke="var(--${lv ? LV[lv].c : 'line'})" stroke-width="9" stroke-linecap="round" stroke-dasharray="${((risk || 0) / 10 * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 55 55)"/><text x="55" y="59" text-anchor="middle" font-size="24" font-weight="500" fill="var(--ink)">${risk != null ? nf(risk, 1) : '–'}</text><text x="55" y="75" text-anchor="middle" font-size="9" fill="var(--muted)">${EN ? 'of 10' : 'av 10'}</text></svg>
      <div class="stack" style="gap:6px">${lv ? `<span class="pill ${LV[lv].c}" style="align-self:flex-start">${LV[lv].t} risk</span>` : ''}<span class="small" style="color:var(--ink-2)">${st?.vol != null && st.omxVol ? `${EN ? 'Your portfolio has swung' : 'Din portfölj har svängt'} <b>${nf(st.vol, 1)} %</b> ${EN ? 'the last year, OMXS30' : 'senaste året, OMXS30'} <b>${nf(st.omxVol, 1)} %</b>. ` : ''}${brS > 35 || fShare > 25 ? `${EN ? 'Most of the risk comes from' : 'Mest risk kommer från'} ${[brS > 35 ? `${br[0][0].toLowerCase()} (${nf(brS, 0)} %)` : '', fShare > 25 ? `${EN ? 'foreign currency' : 'utländsk valuta'} (${nf(fShare, 0)} %)` : ''].filter(Boolean).join(EN ? ' and ' : ' och ')}.` : (EN ? 'The average of the risk check for your stocks, weighted by how much money you have in each.' : 'Snittet av riskkollen för dina aktier, vägt efter hur mycket pengar du har i varje.')}</span></div></div></section>
    <section class="b-card c8"><div class="p-parts">${parts.map(([n, k, l, t]) => `<div class="p-part"><span class="b-fn" style="flex-direction:column;align-items:flex-start"><b>${esc(n)}</b><span class="small faint">${esc(k)}</span></span><span class="b-fl">${l ? `${bSeg(l)}<span class="pill ${L(l)[1]}">${L(l)[0]}</span>` : '<span class="faint small">–</span>'}</span><span class="small" style="color:var(--ink-2)">${esc(t)}</span></div>`).join('')}</div></section>
  </div>
  ${bH('03', EN ? 'Where the risk sits' : 'Var risken sitter', EN ? 'Which stocks, sectors and currencies matter most' : 'Vilka aktier, branscher och valutor som påverkar mest', 'pr3')}
  <div class="b-grid">
    <section class="b-card c4"><h3 class="b-lbl">${EN ? 'Who carries the risk' : 'Vem står för risken'}</h3><span class="small faint">${cov ? (EN ? 'Share of the portfolio\'s swings, not of the money' : 'Andel av portföljens svängningar, inte av pengarna') : (EN ? 'Share of value × risk check' : 'Andel av värde × riskkoll')}</span>
      ${rc.slice(0, 8).map((x) => `<div class="p-rc"><span>${esc(ovName(x.s))}</span><span class="n-cb"><i style="width:${(Math.max(0, x.p) / rcMax * 100).toFixed(0)}%;background:var(--${x.p > x.m * 1.15 ? 'warn' : 'info'})"></i></span><b class="num">${nf(x.p, 0)} %</b><span class="num faint">${nf(x.m, 0)} %</span></div>`).join('')}
      <span class="b-src">${EN ? 'Left: share of the risk · right: share of the money. Yellow = more risk than money.' : 'Vänster: andel av risken · höger: andel av pengarna. Gult = mer risk än pengar.'}${cov ? ` ${EN ? 'Based on' : 'Räknat på'} ${cov.days} ${EN ? 'trading days, each stock in its own currency.' : 'börsdagar, varje aktie i sin egen valuta.'}` : ''}</span></section>
    <section class="b-card c4"><h3 class="b-lbl">${EN ? 'Exposure' : 'Exponering'}</h3>${expo(EN ? 'Sector' : 'Bransch', br)}${expo(EN ? 'Country' : 'Land', la)}${expo(EN ? 'Currency' : 'Valuta', va)}</section>
    <section class="b-card c4"><h3 class="b-lbl">${EN ? 'How your stocks move together' : 'Samvariation mellan dina aktier'}${tip('Korrelation')}</h3><span class="small faint">${EN ? 'Stocks that move alike often fall at the same time' : 'Rör sig aktierna likadant faller de ofta samtidigt'}</span>
      ${cov ? `<div class="p-cm" style="--n:${n6}"><span></span>${cov.syms.slice(0, n6).map((s) => `<span class="p-cmh">${esc(short(s))}</span>`).join('')}${cov.syms.slice(0, n6).map((s, i) => `<span class="p-cmh l">${esc(short(s))}</span>${cov.corr[i].slice(0, n6).map((x, j) => `<span class="p-cmc" style="background:${cbg(i === j ? 1 : x)}" title="${esc(ovName(s))} ${EN ? 'and' : 'och'} ${esc(ovName(cov.syms[j]))}: ${nf(x, 2)}">${i === j ? '' : nf(x, 1)}</span>`).join('')}`).join('')}</div>
      <p class="small" style="margin:0;color:var(--ink-2)">${tight.length ? `${[...new Set(tight.slice(0, 3).flatMap((p) => [p[0], p[1]]))].map(ovName).join(', ').replace(/, ([^,]*)$/, EN ? ' and $1' : ' och $1')} ${EN ? 'often move together' : 'följs ofta åt'} (${nf(tight[Math.min(2, tight.length - 1)][2], 2)}–${nf(tight[0][2], 2)}). ${EN ? 'They work more like one large position than separate ones.' : 'De fungerar mer som en stor post än som separata innehav.'}` : (EN ? 'Your largest stocks do not move very alike, which spreads the risk.' : 'Dina största aktier rör sig inte särskilt likadant, det sprider risken.')}</p>
      <span class="b-src">${EN ? '1 = always move the same way · 0 = no link · based on' : '1 = rör sig alltid lika · 0 = ingen koppling · räknat på'} ${cov.days} ${EN ? 'trading days' : 'börsdagar'}</span>` : `<p class="b-note">${EN ? 'Needs at least two holdings with a year of prices.' : 'Kräver minst två innehav med ett års kurser.'}</p>`}</section>
  </div>
  ${bH('04', EN ? 'If things go badly' : 'Om det går dåligt', EN ? 'Earlier falls and what a market fall could mean' : 'Tidigare fall och vad ett börsfall kan betyda', 'pr4')}
  <div class="b-grid">
    <section class="b-card c6"><div class="b-ch"><h3 class="b-lbl">${EN ? 'Fall from peak, whole portfolio' : 'Fall från toppen, hela portföljen'}${tip('Fall från toppen')}</h3>${st?.maxDd ? `<span class="small down">${EN ? 'largest' : 'största'} ${bSign(st.maxDd)}${st.ddT ? ` (${esc(bMon(new Date(st.ddT * 1000).getMonth()))} ${new Date(st.ddT * 1000).getFullYear()})` : ''}</span>` : ''}</div>
      <div id="pf-dd">${st?.dd ? '' : `<p class="b-note">${EN ? 'Shown when there are at least two days of prices since your first purchase.' : 'Visas när det finns minst två dagars kurser sedan ditt första köp.'}</p>`}</div>
      ${st?.recovery && st.maxDd < -1 ? `<span class="small" style="color:var(--ink-2)">${st.recovery.done ? `${EN ? 'It took' : 'Det tog'} <b>${mon(st.recovery.days)}</b> ${EN ? 'to get back to the peak after the largest fall.' : 'att komma tillbaka till toppen efter det största fallet.'}` : `${EN ? 'The portfolio has not yet recovered from the largest fall' : 'Portföljen har inte kommit tillbaka till toppen än efter det största fallet'} (${mon(st.recovery.days)}). ${EN ? 'Now' : 'Nu'} ${bSign(st.nowDd)} ${EN ? 'from the peak.' : 'från toppen.'}`}</span>` : ''}
      ${st?.dd ? `<span class="b-src">${EN ? 'Calculated on the portfolio\'s return, without your deposits.' : 'Räknat på portföljens avkastning, utan dina insättningar.'}</span>` : ''}</section>
    <section class="b-card c6"><div class="b-ch"><h3 class="b-lbl">Stresstest${tip('Stresstest')}</h3><div class="b-segc" role="tablist" aria-label="Börsfall">${falls.map((f, i) => `<button type="button" role="tab" data-pfsp="${f}" aria-selected="${i === 1}">${i === 0 ? (EN ? 'Market ' : 'Börsen ') : ''}−${Math.abs(f)} %</button>`).join('')}</div></div><div id="pf-stress"></div></section>
  </div>
  ${bH('05', EN ? 'Risk measures for those who want to go deeper' : 'Riskmått för den som vill fördjupa sig', EN ? 'Hover over a word to see what it means' : 'Håll över ordet så förklaras måttet', 'pr5')}
  <section class="b-card"><div class="p-rm">${[
    kv(EN ? 'Volatility, 1 year' : 'Volatilitet, 1 år', st?.vol != null ? bPct(st.vol) : null, st?.omxVol ? `OMXS30: ${bPct(st.omxVol)}` : '', 'Volatilitet'),
    kv(EN ? 'Volatility, 30 days' : 'Volatilitet, 30 dagar', st?.vol30 != null ? bPct(st.vol30) : null, EN ? 'the last month' : 'senaste månaden', 'Volatilitet'),
    kv(EN ? 'Beta vs the market' : 'Beta mot börsen', bn(betaW, 2), betaW != null ? (EN ? `swings ${nf(Math.abs(betaW - 1) * 100, 0)} % ${betaW >= 1 ? 'more' : 'less'} than the market` : `svänger ${nf(Math.abs(betaW - 1) * 100, 0)} % ${betaW >= 1 ? 'mer' : 'mindre'} än börsen`) : '', 'Beta'),
    kv(EN ? 'Correlation with OMXS30' : 'Samvariation med OMXS30', st?.corrOmx != null ? bn(st.corrOmx, 2) : null, EN ? '1 = follows the market completely' : '1 = följer börsen helt', 'Korrelation'),
    kv(EN ? 'Bad day, 1 in 20' : 'Dålig dag, 1 av 20', st?.var95 != null && st.daily ? bSign(st.var95) : null, st?.var95 != null && st.daily ? `≈ ${krDiff(st.var95 / 100 * tot)}` : '', 'Dålig dag'),
    kv(EN ? 'Worst day, 1 year' : 'Sämsta dagen, 1 år', st?.worst != null && st.daily ? bSign(st.worst) : null, st?.best != null && st.daily ? `${EN ? 'best' : 'bästa'} ${bSign(st.best)}` : '', null),
    kv(EN ? 'Largest fall' : 'Största fall', st?.maxDd != null ? bSign(st.maxDd) : null, st?.ddT ? bDate(bKey(st.ddT)) : '', 'Fall från toppen'),
    kv(EN ? 'Days up' : 'Dagar upp', st?.upDays != null ? bPct(st.upDays, 0) : null, EN ? 'share of trading days, 1 year' : 'andel av börsdagarna, 1 år', null),
    kv(EN ? 'Return per risk' : 'Avkastning per risk', st?.retRisk != null ? bn(st.retRisk, 2) : null, st?.retRisk != null ? (EN ? 'return per year ÷ volatility' : 'avkastning per år ÷ volatilitet') : (EN ? 'needs a year of history' : 'kräver ett års historik'), null),
    kv(EN ? 'Effective number of stocks' : 'Effektivt antal aktier', nf(effN, 1), `${EN ? 'of' : 'av'} ${hv.length}, ${EN ? 'higher = better spread' : 'högre = bättre spridning'}`, null),
    kv(EN ? 'In foreign currency' : 'I utländsk valuta', nf(fShare, 0) + ' %', va.filter(([k]) => k !== 'SEK').map(([k]) => k).join(', '), null),
    kv(EN ? 'Expected dividend' : 'Väntad utdelning', plan?.rows?.length ? sekBig(plan.total) : null, plan?.rows?.length && tot ? `${nf(plan.total / tot * 100, 1)} % ${EN ? 'per year' : 'per år'}` : '', null)
  ].join('')}</div></section>`;
}

// Portföljens siffror, gemensamt för Min portfölj och översikten
/* ---- Exakt dagsresultat i kronor ----
   Början av dagen = antal × föregående stängningskurs × växelkursen då.
   Slutet = antal × kursen nu (eller dagens stängning) × växelkursen nu.
   Köp under dagen räknas som insatta pengar, inte som vinst. Aktiernas rörelse + valutans rörelse = slut − början − insatt, exakt. */
const fxPair = (c) => (c === 'GBp' || c === 'GBX' ? 'GBP' : c) + 'SEK=X';
const fxScale = (c) => (c === 'GBp' || c === 'GBX' ? 0.01 : 1);
async function fxDay(currencies, dag) {
  const out = { SEK: { F0: 1, F1: 1 } }; const need = [...new Set(currencies.filter((c) => c && c !== 'SEK'))]; if (!need.length) return out;
  const q = await getQuotes(need.map(fxPair));
  for (const c of need) { const x = q[fxPair(c)]; if (!x?.kurs) continue; const k = fxScale(c);
    const same = !!x.tid && sthlmDay(x.tid) === dag; const prev = same ? (x.prev ?? (x.d1 != null ? x.kurs / (1 + x.d1 / 100) : x.kurs)) : x.kurs;
    out[c] = { F0: prev * k, F1: x.kurs * k, pair: fxPair(c), scale: k }; }
  return out;
}
function dayMath(items, fx, dag) {
  let start = 0, added = 0, end = 0; const fxEff = {};
  for (const it of items) {
    const f = fx[it.valuta] || (it.valuta === 'SEK' ? { F0: 1, F1: 1 } : null);
    it.nya = it.buys.filter((b) => b.tid && sthlmDay(b.tid) === dag && b.insattSek != null);
    it.qOld = it.buys.filter((b) => !it.nya.includes(b)).reduce((a, b) => a + b.antal, 0);
    if (it.P1 == null || it.P0 == null || !f) { it.missing = true; it.missWhy = it.P1 == null || it.P0 == null ? 'kurs' : 'fx'; it.idag = null; it.d1Dag = null; continue; }
    const qNew = it.nya.reduce((a, b) => a + b.antal, 0), cost = it.nya.reduce((a, b) => a + b.insattSek, 0);
    it.F0 = f.F0; it.F1 = f.F1;
    it.start = it.qOld * it.P0 * f.F0; it.added = cost; it.end = (it.qOld + qNew) * it.P1 * f.F1;
    const stock = it.qOld * (it.P1 - it.P0) * f.F1 + (qNew * it.P1 * f.F1 - cost);
    it.fxEff = it.qOld * it.P0 * (f.F1 - f.F0);
    it.idag = it.traded || it.nya.length ? stock : null;
    it.d1Dag = it.traded && it.P0 ? (it.P1 / it.P0 - 1) * 100 : null;
    start += it.start; added += cost; end += it.end;
    if (it.valuta !== 'SEK' && Math.abs(it.fxEff) > 0.005) fxEff[it.valuta] = (fxEff[it.valuta] || 0) + it.fxEff;
  }
  const change = end - start - added;
  return { start, added, end, change, pct: start + added > 0 ? (change / (start + added)) * 100 : null, fxEff };
}
// Kurvan för dagen var femte minut. Börjar på 0 vid föregående stängning och slutar exakt på dagens resultat.
async function dayCurve(m) {
  const { items, fx, dag, live } = m;
  const url = (sym) => (live ? `/api/chart?s=${encodeURIComponent(sym)}&r=1d` : `/api/chart?s=${encodeURIComponent(sym)}&dag=${dag}`);
  const ttl = live ? 5 * 60e3 : 6 * 3600e3;
  const traded = items.filter((it) => it.traded && !it.missing);
  const curs = Object.keys(fx).filter((c) => c !== 'SEK' && items.some((it) => it.valuta === c && !it.missing));
  const [S, F] = await Promise.all([Promise.all(traded.map((it) => api(url(it.sym), ttl).catch(() => null))), Promise.all(curs.map((c) => api(url(fx[c].pair), ttl).catch(() => null)))]);
  const onDay = (c) => (c?.punkter || []).filter(([t]) => sthlmDay(t * 1000) === dag);
  const P = new Map(traded.map((it, i) => [it.sym, onDay(S[i])]));
  if (!traded.length) return { error: 'none' };
  if ([...P.values()].some((p) => !p.length)) {
    const failed = traded.some((it, i) => !S[i] || S[i].error);
    const old = !live && Date.now() - new Date(dag + 'T12:00:00Z').getTime() > 57 * 864e5;
    return { error: old ? 'old' : failed ? 'fetch' : live ? 'live' : 'partial' };
  }
  const FX = Object.fromEntries(curs.map((c, i) => [c, onDay(F[i]).map(([t, v]) => [t, v * fx[c].scale])]));
  const at = (pts, t, fb) => { let v = fb; for (const [pt, pv] of pts) { if (pt <= t) v = pv; else break; } return v; };
  const times = [...new Set([...P.values()].flatMap((p) => p.map((x) => x[0])))].sort((a, b) => a - b);
  const val = (t) => { let v = 0;
    for (const it of items) { if (it.missing) continue; const Ft = it.valuta === 'SEK' ? 1 : at(FX[it.valuta] || [], t, it.F0); const Pt = it.traded ? at(P.get(it.sym), t, it.P0) : it.P0;
      v += it.qOld * (Pt * Ft - it.P0 * it.F0);
      for (const n of it.nya) if (new Date(n.tid).getTime() / 1000 <= t + 300) v += n.antal * Pt * Ft - n.insattSek; }
    return v; };
  const pts = [[times[0], 0], ...times.map((t) => [t + 300, val(t)])];
  const tEnd = live ? Math.max(Math.floor(Date.now() / 1000), pts[pts.length - 1][0]) : pts[pts.length - 1][0];
  if (live) pts.push([tEnd, m.change]); else pts[pts.length - 1] = [tEnd, m.change];
  return { pts };
}
function drawDayCurve(el, pts, past) {
  const W = 900, H = 200; const t0 = pts[0][0], t1 = pts[pts.length - 1][0];
  const vals = pts.map((p) => p[1]); const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals); const pad = (hi - lo) * 0.12 || 10;
  const X = (t) => ((t - t0) / ((t1 - t0) || 1)) * W, Y = (v) => H - ((v - (lo - pad)) / ((hi + pad) - (lo - pad))) * H;
  const line = pts.map(([t, v], i) => `${i ? 'L' : 'M'}${X(t).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1][1]; const col = last < 0 ? '#FFB4AC' : '#9BE3B8';
  const hm = (t) => new Date(t * 1000).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' });
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="dd-svg" role="img" aria-label="${EN ? 'Portfolio change during the day' : 'Portföljens förändring under dagen'}">
    <line x1="0" x2="${W}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}" stroke="rgba(255,255,255,.25)" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/>
    <path d="${line} L${X(t1).toFixed(1)} ${Y(0).toFixed(1)} L${X(t0).toFixed(1)} ${Y(0).toFixed(1)} Z" fill="${col}" opacity=".12"/>
    <path d="${line}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>
    <div class="dd-axis small num"><span>${hm(t0)}</span><span>${past ? (EN ? 'Dashed line = start of the day (previous close)' : 'Streckad linje = början av dagen (föregående stängning)') : (EN ? 'Dashed line = start of the day (yesterday\'s close)' : 'Streckad linje = början av dagen (gårdagens stängning)')}</span><span>${hm(t1)}</span></div>`;
}
// Dagliga stängningskurser, en per dag (den senaste om en dag förekommer två gånger)
const closesByDay = (pts) => { const m = new Map(); for (const [t, v] of pts || []) m.set(sthlmDay(t * 1000), v); return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])); };

async function pfData(port) {
  const syms = [...new Set(port.map((x) => x.sym))];
  const [quotes, stocks] = await Promise.all([getQuotes(syms), Promise.all(syms.map((s) => getStock(s)))]);
  const S = Object.fromEntries(syms.map((s, i) => [s, stocks[i]?.error ? null : stocks[i]]));
  const valOf = (s) => quotes[s]?.valuta || S[s]?.valuta || port.find((x) => x.sym === s)?.kursValuta || 'SEK';
  const fxNow = await fxToSek(syms.map(valOf));
  const kursNu = (s) => quotes[s]?.kurs ?? S[s]?.kurs ?? null;
  // Per köp och per aktie
  const buys = port.map((b) => {
    const k = kursNu(b.sym); const r = fxNow[valOf(b.sym)] ?? null;
    const varde = k != null && r != null ? b.antal * k * r : null;
    return { ...b, varde, vinst: varde != null && b.insattSek != null ? varde - b.insattSek : null };
  });
  const hold = syms.map((s) => {
    const bs = buys.filter((b) => b.sym === s); const st = S[s];
    const antal = bs.reduce((a, b) => a + b.antal, 0);
    const varde = bs.every((b) => b.varde != null) ? bs.reduce((a, b) => a + b.varde, 0) : null;
    const kand = bs.filter((b) => b.insattSek != null);
    const insatt = kand.length === bs.length ? kand.reduce((a, b) => a + b.insattSek, 0) : null;
    const d1 = quotes[s]?.d1 ?? st?.d1 ?? null; const tid = quotes[s]?.tid ?? st?.kursTid ?? null;
    return {
      sym: s, namn: nameOf(s), bs, antal, varde, insatt, vinst: varde != null && insatt != null ? varde - insatt : null,
      snitt: kand.length && kand.every((b) => b.kurs) ? kand.reduce((a, b) => a + b.kurs * b.antal, 0) / kand.reduce((a, b) => a + b.antal, 0) : null,
      kurs: kursNu(s), valuta: valOf(s), d1, tid, dag: tid ? sthlmDay(tid) : null,
      ...holdMeta(s, st)
    };
  });
  // Dagens förändring: bara aktier som handlats i dag. Har ingen handlats än i dag (helg, före 09.00) visas senaste börsdagen.
  const dagar = hold.map((h) => h.dag).filter(Boolean).sort();
  const refDag = dagar.includes(sthlmDay(Date.now())) ? sthlmDay(Date.now()) : dagar[dagar.length - 1] || null;
  const fxD = await fxDay(syms.map(valOf), refDag);
  const items = hold.map((h) => { h.raknas = h.dag === refDag; const q = quotes[h.sym];
    const P0 = h.kurs == null ? null : h.raknas ? (q?.prev ?? (h.d1 != null ? h.kurs / (1 + h.d1 / 100) : null)) : h.kurs;
    return Object.assign(h, { valuta: h.valuta, P1: h.kurs, P0, traded: h.raknas, buys: h.bs }); });
  const day = dayMath(items, fxD, refDag);
  const dagIdag = refDag === sthlmDay(Date.now());
  const tot = hold.reduce((a, h) => a + (h.varde || 0), 0);
  // Vinst räknas på de köp där vi vet vad du betalade
  const kanda = buys.filter((b) => b.insattSek != null && b.varde != null);
  const insatt = kanda.reduce((a, b) => a + b.insattSek, 0);
  const kandaInsatt = kanda.length > 0;
  const okanda = buys.length - kanda.length;
  const vinst = kandaInsatt ? kanda.reduce((a, b) => a + b.varde, 0) - insatt : null;
  const idag = day.change; const idagPct = day.pct;
  const scored = hold.filter((h) => h.poang != null && h.varde);
  const risk = scored.length ? scored.reduce((a, h) => a + h.poang * h.varde, 0) / scored.reduce((a, h) => a + h.varde, 0) : null;

  return { syms, quotes, S, valOf, fxNow, buys, hold, tot, insatt, kandaInsatt, okanda, vinst, idag, idagPct, day, fxD, risk, refDag, dagIdag };
}

// Värdet dag för dag jämfört med insatta pengar, för tidslinjen
async function pfSeries(c) {
  const buys = c.buys.filter((b) => b.tid && b.insattSek != null);
  if (!buys.length) return { error: 'nobuys' };
  const syms = [...new Set(buys.map((b) => b.sym))];
  const firstDay = (s) => new Date(Math.min(...buys.filter((b) => b.sym === s).map((b) => new Date(b.tid).getTime()))).toISOString().slice(0, 10);
  const curs = [...new Set(syms.map(c.valOf).filter((x) => x && x !== 'SEK'))];
  const start = new Date(Math.min(...buys.map((b) => new Date(b.tid).getTime()))).toISOString().slice(0, 10);
  const [hist, fxh] = await Promise.all([
    Promise.all(syms.map((s) => api(`/api/chart?s=${encodeURIComponent(s)}&from=${firstDay(s)}`, 30 * 60e3))),
    Promise.all(curs.map((x) => api(`/api/chart?s=${encodeURIComponent((x === 'GBp' || x === 'GBX' ? 'GBP' : x) + 'SEK=X')}&from=${start}`, 30 * 60e3)))
  ]);
  if ([...hist, ...fxh].some((x) => !x || x.error)) return { error: 'fetch' };
  const H = Object.fromEntries(syms.map((s, i) => [s, hist[i]?.punkter || []]));
  const F = Object.fromEntries(curs.map((x, i) => [x, (fxh[i]?.punkter || []).map(([t, v]) => [t, x === 'GBp' || x === 'GBX' ? v / 100 : v])]));
  const at = (pts, t) => { let v = null; for (const p of pts) { if (p[0] <= t) v = p[1]; else break; } return v ?? pts[0]?.[1] ?? null; };
  const DAY = 86400; const t0 = Math.floor(new Date(start + 'T00:00:00Z').getTime() / 1000); const tNow = Math.floor(Date.now() / 1000);
  const step = tNow - t0 > 3 * 365 * DAY ? 7 * DAY : DAY;
  const value = []; const invested = [];
  for (let t = t0 + DAY - 1; t < tNow + step; t += step) {
    const tt = Math.min(t, tNow);
    let v = 0; let inv = 0; let ok = true;
    for (const b of buys) {
      if (new Date(b.tid).getTime() / 1000 > tt) continue;
      const cu = c.valOf(b.sym);
      const k = tt >= tNow - 60 ? (c.quotes[b.sym]?.kurs ?? at(H[b.sym], tt)) : at(H[b.sym], tt);
      const r = !cu || cu === 'SEK' ? 1 : tt >= tNow - 60 ? (c.fxNow[cu] ?? at(F[cu], tt)) : at(F[cu], tt);
      if (k == null || r == null) { ok = false; continue; }
      v += b.antal * k * r; inv += b.insattSek;
    }
    if (ok && inv > 0) { value.push([tt, Math.round(v)]); invested.push([tt, Math.round(inv)]); }
    if (tt === tNow) break;
  }
  if (value.length < 2) return { error: 'short' };
  return { value, invested, tNow };
}
const rangeCut = (pts, range, tNow) => { const from = range === 'all' ? 0 : tNow - ({ '1m': 31, '6m': 183, '1y': 366 }[range]) * 86400; const v = pts.filter((p) => p[0] >= from); return v.length > 1 ? v : pts.slice(-2); };

function mountPortfolj() {
  let port = getPort();
  let range = 'all';
  let open = null; // aktie vars köp visas
  const save = () => writeLS(PKEY, port);

  /* ---- Formulär för nytt köp ---- */
  const now = new Date();
  const todayIso = now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
  const formFor = (sym, namn) => {
    $('#pf-form').innerHTML = `<form class="pf-form" data-pfbuy="${esc(sym)}" novalidate>
      <div class="picked">${av(sym)}<span class="grow"><b style="display:block;font-weight:500">${esc(namn || nameOf(sym))}</b><span class="small muted">${esc(sym)}</span></span></div>
      <div class="pf-fields">
        <label class="field"><span>Belopp</span><input name="belopp" type="number" min="1" step="any" inputmode="decimal" placeholder="T.ex. 5 000" required></label>
        <label class="field"><span>Valuta</span><select class="select field-select" name="valuta">${PF_VALUTOR.map((v) => `<option value="${v}" ${v === 'SEK' ? 'selected' : ''}>${v === 'SEK' ? 'SEK, kronor' : v === 'USD' ? 'USD, dollar' : 'EUR, euro'}</option>`).join('')}</select></label>
        <label class="field"><span>Datum för köpet</span><input name="datum" type="date" max="${todayIso}" value="${todayIso}" required></label>
        <label class="field"><span>Klockslag</span><input name="tid" type="time" value="12:00" required></label>
      </div>
      <div class="pf-preview" data-preview><span class="small muted">Fyll i belopp, datum och tid så hämtar vi kursen vid köpet.</span></div>
      <div class="chips"><button class="btn" type="submit" disabled>Lägg till köpet</button><button class="btn ghost" type="button" data-pfcancel>Avbryt</button></div>
    </form>`;
    const f = $('[data-pfbuy]'); let calc = null; let seq = 0;
    const preview = async () => {
      const id = ++seq; calc = null; f.querySelector('[type=submit]').disabled = true;
      const belopp = Number(String(f.belopp.value).replace(',', '.'));
      const when = new Date(`${f.datum.value}T${f.tid.value || '12:00'}:00`);
      const box = f.querySelector('[data-preview]');
      if (!(belopp > 0) || Number.isNaN(when.getTime())) { box.innerHTML = '<span class="small muted">Fyll i belopp, datum och tid så hämtar vi kursen vid köpet.</span>'; return; }
      if (when.getTime() > Date.now() + 60e3) { box.innerHTML = '<span class="small" style="color:var(--down)">Tiden ligger i framtiden.</span>'; return; }
      box.innerHTML = '<span class="small muted">Hämtar kursen vid köpet …</span>';
      const t = Math.floor(when.getTime() / 1000);
      const p = await priceAt(sym, t);
      if (id !== seq) return;
      if (!p?.kurs) { box.innerHTML = `<span class="small" style="color:var(--down)">Vi hittade ingen kurs för ${esc(nameOf(sym))} vid den tiden. Fanns aktien på börsen då?</span>`; return; }
      const [rIn, rStock] = await Promise.all([fxAt(f.valuta.value, t), fxAt(p.valuta, t)]);
      if (id !== seq) return;
      if (!rIn || !rStock) { box.innerHTML = '<span class="small" style="color:var(--down)">Växelkursen för den dagen saknas just nu. Prova igen om en stund.</span>'; return; }
      const insattSek = belopp * rIn; const antal = insattSek / rStock / p.kurs;
      calc = { t, belopp, valuta: f.valuta.value, kurs: p.kurs, kursValuta: p.valuta || 'SEK', kursTid: p.kursTid, antal, insattSek };
      box.innerHTML = `<div class="pf-calc">
        <div><span class="small muted">Kurs vid köpet</span><b class="num">${esc(kr(p.kurs))} ${esc(cur(p.valuta))}</b><span class="small faint">${esc(fmtTid(p.kursTid))}${p.upplosning === 'dag' ? ', dagens stängning' : ''}</span></div>
        <div><span class="small muted">Du fick</span><b class="num">${esc(nfAntal(antal))} st</b><span class="small faint">aktier, räknat på hela beloppet</span></div>
        <div><span class="small muted">I kronor</span><b class="num">${esc(sek(insattSek))}</b><span class="small faint">${f.valuta.value !== 'SEK' ? `1 ${esc(f.valuta.value)} = ${nf(rIn, 2)} kr den dagen` : 'insatt belopp'}</span></div>
      </div>`;
      f.querySelector('[type=submit]').disabled = false;
    };
    let timer; f.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(preview, 450); });
    f.addEventListener('submit', (e) => {
      e.preventDefault(); if (!calc) return;
      port.push({ id: uid(), sym, ...calc, tid: new Date(calc.t * 1000).toISOString(), t: undefined });
      save(); rememberName(sym, namn || nameOf(sym));
      $('#pf-form').innerHTML = ''; open = sym;
      toast(`Köpet av ${nameOf(sym)} är sparat`, `${nfAntal(calc.antal)} st för ${sek(calc.insattSek)}.`);
      draw();
    });
    f.belopp.focus();
  };
  bindPicker('pf-q', (sym, namn) => formFor(sym, namn));

  /* ---- Import ---- */
  let imp = null; // { bank, rader: [{ g, sym, namn, valt }] }
  const impBox = () => $('#pf-imp');
  const drawImp = () => {
    if (!imp) { impBox().innerHTML = ''; return; }
    const ok = imp.rader.filter((x) => x.sym && x.valt);
    impBox().innerHTML = `<div class="imp-list">
      <p class="small muted" style="margin:0">Hittade ${imp.rader.length} värdepapper som du fortfarande äger enligt filen från ${esc(imp.bank)}. Kontrollera att rätt aktie är vald.</p>
      ${imp.rader.map((x, i) => {
        const antal = x.g.lots.reduce((a, l) => a + l.antal, 0);
        return `<div class="imp-row ${x.valt ? '' : 'off'}">
          <input type="checkbox" data-impval="${i}" ${x.valt && x.sym ? 'checked' : ''} ${x.sym ? '' : 'disabled'} aria-label="Ta med ${esc(x.g.namn)}">
          <span class="grow" style="min-width:0"><b>${esc(x.g.namn || x.g.isin)}</b><span class="small muted">${esc(nfAntal(antal))} st · ${x.g.lots.length} köp${x.g.isin ? ' · ' + esc(x.g.isin) : ''}</span></span>
          <span class="imp-match">${x.sym ? `${symFlag(x.sym)}<span><b>${esc(x.namn || nameOf(x.sym))}</b><span class="small muted">${esc(x.sym)}</span></span>` : '<span class="small" style="color:var(--down)">Hittades inte</span>'}<button type="button" class="linkbtn small" data-impchange="${i}">Byt</button></span>
        </div>${imp.byt === i ? `<div class="imp-pick">${pickerHTML('imp-q', 'Sök rätt aktie eller fond')}</div>` : ''}`;
      }).join('')}
      <label class="imp-opt"><input type="checkbox" data-impreplace ${imp.replace ? 'checked' : ''}> Ersätt köp som jag har importerat tidigare</label>
      <div class="chips"><button class="btn" type="button" data-impgo ${ok.length ? '' : 'disabled'}>Importera ${ok.length} värdepapper</button><button class="btn ghost" type="button" data-impcancel>Avbryt</button></div>
      <p class="small faint" style="margin:0">Köpen läggs in med dagen för affären och beloppet du betalade, avgifter inräknade. Har du sålt en del räknas det bort med genomsnittsmetoden, samma som Skatteverket använder.</p>
    </div>`;
    if (imp.byt != null) bindPicker('imp-q', (sym, namn) => { const x = imp.rader[imp.byt]; x.sym = sym; x.namn = namn; x.valt = true; imp.byt = null; drawImp(); });
  };
  $('#pf-import').addEventListener('change', async (e) => {
    const inp = e.target.closest('[data-impfile]');
    if (inp?.files?.[0]) {
      const file = inp.files[0]; inp.value = '';
      if (file.size > 5e6) { impBox().innerHTML = '<p class="small" style="color:var(--down);margin:0">Filen är för stor. Välj exportfilen med transaktioner.</p>'; return; }
      impBox().innerHTML = loading('Läser filen …');
      try {
        const { bank, affarer } = parseBankFile(decodeFile(await file.arrayBuffer()));
        const groups = netLots(affarer);
        if (!groups.length) { impBox().innerHTML = '<p class="small muted" style="margin:0">Enligt filen har du sålt allt du köpt. Det finns inget att importera.</p>'; return; }
        impBox().innerHTML = loading(`Letar upp ${groups.length} värdepapper …`);
        const found = await Promise.all(groups.map((g) => findSym(g).catch(() => null)));
        imp = { bank, replace: true, byt: null, rader: groups.map((g, i) => ({ g, sym: found[i]?.sym || null, namn: found[i]?.namn || null, valt: !!found[i] })) };
        drawImp();
      } catch (err) { impBox().innerHTML = `<p class="small" style="color:var(--down);margin:0">${esc(err.message || 'Filen kunde inte läsas.')}</p>`; }
      return;
    }
    const v = e.target.closest('[data-impval]'); if (v) { imp.rader[Number(v.dataset.impval)].valt = v.checked; drawImp(); return; }
    if (e.target.closest('[data-impreplace]')) imp.replace = e.target.checked;
  });
  $('#pf-import').addEventListener('click', async (e) => {
    const ch = e.target.closest('[data-impchange]'); if (ch) { imp.byt = imp.byt === Number(ch.dataset.impchange) ? null : Number(ch.dataset.impchange); drawImp(); if (imp.byt != null) $('#imp-q')?.focus(); return; }
    if (e.target.closest('[data-impcancel]')) { imp = null; drawImp(); return; }
    if (!e.target.closest('[data-impgo]')) return;
    const valda = imp.rader.filter((x) => x.sym && x.valt);
    impBox().innerHTML = loading('Räknar om till kronor …');
    const nya = [];
    for (const x of valda) {
      for (const l of x.g.lots) {
        const tid = new Date(l.dag + 'T12:00:00').toISOString(); const t = Math.floor(new Date(tid).getTime() / 1000);
        let sekBelopp = l.belopp;
        if (sekBelopp != null && l.valuta && l.valuta !== 'SEK') { const rr = await fxAt(l.valuta, t).catch(() => null); sekBelopp = rr ? sekBelopp * rr : null; }
        nya.push({ id: uid(), sym: x.sym, belopp: l.belopp != null ? Math.round(l.belopp * 100) / 100 : null, valuta: l.valuta || 'SEK', tid, kurs: l.kurs || (l.belopp && l.antal ? l.belopp / l.antal : null), kursValuta: x.g.kursValuta || null, antal: l.antal, insattSek: sekBelopp != null ? Math.round(sekBelopp * 100) / 100 : null, imp: imp.bank });
      }
      rememberName(x.sym, x.namn || x.g.namn);
    }
    port = [...(imp.replace ? port.filter((p) => !p.imp) : port), ...nya];
    save(); imp = null; drawImp();
    toast(`${valda.length} värdepapper importerade`, `${nya.length} köp lades in i Min portfölj.`);
    draw();
  });

  /* ---- Flikar ---- */
  const loaded = {};
  const showTab = (k) => {
    document.querySelectorAll('[data-ptab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.ptab === k)));
    document.querySelectorAll('[data-ppanel]').forEach((p) => { p.hidden = p.dataset.ppanel !== k; });
    const u = new URLSearchParams(location.search);
    if (k === 'oversikt') u.delete('flik'); else u.set('flik', k);
    if (k !== 'dagen') u.delete('dag');
    const qs = u.toString(); history.replaceState(null, '', '/portfolj' + (qs ? '?' + qs : ''));
    lazy(k);
  };
  const lazy = (k) => {
    if (k === 'dagen' && !loaded.dagen) { loaded.dagen = true; mountDinDag(); }
    if (k === 'nyheter' && !loaded.news) { loaded.news = true; loadNews(); }
    if (k === 'risk') drawRisk();
  };

  /* ---- Beräkningar ---- */
  let cache = null; let pd = null; let serP = null; let planP = null; let kalP = null; let omxP = null; let statsP = null;
  let alloc = 'bransch'; let cmpOn = true; let idxP = null; let stressF = -20;
  const panelOpen = (k) => !$(`[data-ppanel="${k}"]`)?.hidden;
  // Hela kronor som summerar exakt till dagens resultat (största rest får avrundningen), samma som fliken Dagen
  const wholeKr = (rows, change) => { const target = Math.round(change); const fl = rows.map((x) => Math.floor(x.idag)); let left = target - fl.reduce((a, v) => a + v, 0);
    const order = rows.map((x, i) => [x.idag - Math.floor(x.idag), i]).sort((a, b) => b[0] - a[0]);
    rows.forEach((x, i) => { x.kr = fl[i]; }); for (const [, i] of order) { if (left <= 0) break; rows[i].kr += 1; left -= 1; } };
  const miss = () => `<span class="faint">${EN ? 'Missing' : 'Saknas'}</span>`;
  const statsHTML = (o) => o.map(([k, v, s, t, cls, act]) => `<div${act ? ` class="p-stat-btn" role="button" tabindex="0" data-pfgo="${act}"` : ''}><span class="b-stat-k">${esc(k)}${t ? tip(t) : ''}</span><b class="num ${cls || ''}">${v ?? miss()}</b>${s ? `<span class="p-stat-s">${s}</span>` : ''}</div>`).join('');
  const share = (v) => (pd?.tot ? (v / pd.tot) * 100 : 0);

  const draw = async () => {
    $('#pf-count').textContent = port.length ? `${new Set(port.map((x) => x.sym)).size} ${EN ? 'holdings' : 'innehav'}` : '';
    loaded.dagen = false; loaded.news = false;
    if (!port.length) {
      $('#pf-tot').textContent = '0 kr'; $('#pf-day').textContent = ''; $('#pf-sub').textContent = EN ? 'No purchases yet' : 'Inga köp än';
      $('#pf-sum').innerHTML = statsHTML([['Insatt', '0 kr'], ['Sedan köp', '–'], ['Per år', '–'], ['Riskkoll', '–']]);
      const empty = `<div class="empty">Du har inga köp inlagda än. Gå till <button type="button" class="linkbtn" data-pfgo="kop" data-pffocus="pf-q">Köp och sälj</button> och sök fram aktien du köpte, eller importera en fil från Avanza eller Nordnet.${locked() ? `<div class="chips" style="justify-content:center;margin-top:12px">${demoBtn(EN ? 'Or show an example portfolio' : 'Eller visa en exempelportfölj')}</div>` : ''}</div>`;
      for (const id of ['#pf-tl', '#pf-ins', '#pf-perf', '#pf-contr', '#pf-alloc', '#pf-ovtable', '#pf-htable', '#pf-list', '#pf-risk', '#pf-news', '#pf-week', '#pf-ncount', '#pf-ahead', '#pf-kal', '#pf-utd', '#pf-utdm', '#pf-kalh', '#pf-txn']) { const el = $(id); if (el) el.innerHTML = id === '#pf-ovtable' || id === '#pf-txn' ? empty : `<p class="b-note">${EN ? 'Shown when you have added your first purchase.' : 'Visas när du har lagt in ditt första köp.'}</p>`; }
      $('#pf-side').innerHTML = ''; $('#pf-nchips').innerHTML = ''; $('#pf-txn-s').textContent = ''; $('#pf-utdtot').textContent = '';
      if (panelOpen('dagen')) { loaded.dagen = true; mountDinDag(); }
      return;
    }
    pd = await pfData(port);
    if (!$('#pf-list')) return;
    const { syms, buys, hold, tot, insatt, kandaInsatt, okanda, vinst, risk, day } = pd;
    const lv = risk != null ? LV[lvlOf(Math.round(risk))] : null;
    const first = buys.filter((b) => b.tid).map((b) => new Date(b.tid).getTime()).sort((a, b) => a - b)[0];
    const idag = day.change;
    const lands = new Set(hold.filter((h) => h.varde).map((h) => h.land)).size;

    /* Toppkortet */
    $('#pf-tot').textContent = sekBig(tot);
    $('#pf-day').innerHTML = `<span class="${tone(idag)}">${krDiff(idag)}${day.pct != null ? ` (${pctDiff(day.pct)})` : ''}</span> ${pd.dagIdag ? (EN ? 'today' : 'i dag') : (EN ? 'latest trading day' : 'senaste börsdagen')} ›`;
    $('#pf-sub').textContent = `${hold.length} ${EN ? (hold.length === 1 ? 'holding' : 'holdings') : 'innehav'} · ${lands} ${EN ? (lands === 1 ? 'country' : 'countries') : (lands === 1 ? 'land' : 'länder')}${first ? ` · ${EN ? 'since' : 'sedan'} ${new Date(first).toLocaleDateString(L, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''} · ${EN ? 'updated' : 'uppdaterad'} ${clock(new Date().toISOString())}`;
    const extra = {};
    const sumStats = () => statsHTML([
      ['Insatt', kandaInsatt ? sekBig(insatt) : null, first ? `${EN ? 'since' : 'sedan'} ${new Date(first).toLocaleDateString(L, { month: 'short', year: 'numeric' })}${okanda ? ` · ${okanda} ${EN ? 'without amount' : 'utan belopp'}` : ''}` : ''],
      ['Sedan köp', vinst != null ? krDiff(vinst) : null, vinst != null && insatt ? `<span class="${tone(vinst)}">${pctDiff((vinst / insatt) * 100)}</span>` : '', null, tone(vinst)],
      [extra.py?.k || 'Per år', extra.py?.v ?? null, extra.py?.s ?? (EN ? 'Calculating …' : 'Räknar …'), 'Tidsviktad avkastning', extra.py?.c || ''],
      ['Mot OMXS30', extra.cmp ?? null, extra.cmpS ?? (EN ? 'Calculating …' : 'Räknar …'), 'Mot OMXS30', extra.cmpTone || ''],
      ['Riskkoll', risk != null ? `${nf(risk, 1)} / 10` : null, lv ? `<span class="${lv.c}">${lv.t}</span>` : '', 'Riskkoll', '', 'risk'],
      ['Volatilitet', extra.vol ?? null, extra.volS ?? (EN ? 'Calculating …' : 'Räknar …'), 'Volatilitet', '', 'risk'],
      ['Utdelning', extra.utd ?? null, extra.utdS ?? (EN ? 'Calculating …' : 'Räknar …'), null, '', 'kalender']
    ]);
    const paintStats = () => { if ($('#pf-sum')) $('#pf-sum').innerHTML = sumStats(); };
    paintStats();

    /* Innehavstabellen, samma avrundning som fliken Dagen */
    const sorted = hold.slice().sort((a, b) => (b.varde || 0) - (a.varde || 0));
    const stocks = hold.filter((h) => h.idag != null && !h.missing);
    const fxRows = Object.entries(day.fxEff || {}).map(([c, v]) => ({ fx: c, idag: v, pct: pd.fxD[c] ? (pd.fxD[c].F1 / pd.fxD[c].F0 - 1) * 100 : null }));
    wholeKr([...stocks, ...fxRows], idag);
    const maxShare = Math.max(1, ...sorted.map((h) => share(h.varde || 0)));
    $('#pf-ovtable').innerHTML = `<div class="p-tbl" role="table">
      <div class="p-tr p-th" role="row"><span>${EN ? 'Holding' : 'Innehav'}</span><span>${EN ? 'Share' : 'Andel'}</span><span class="r">${EN ? 'Today' : 'I dag'}</span><span class="r">${EN ? 'Today, SEK' : 'I dag, kr'}</span><span class="r">${EN ? 'Value' : 'Värde'}</span><span class="r">${EN ? 'Since purchase' : 'Sedan köp'}</span><span class="r p-hide">Riskkoll</span><span class="p-hide">30 ${EN ? 'days' : 'dagar'}</span></div>
      ${sorted.map((h) => { const sh = h.varde && tot ? share(h.varde) : null; return `<a class="p-tr" role="row" href="/bolag/${encodeURIComponent(h.sym)}" data-link>
        <span class="p-tn">${symFlag(h.sym)}<span><b>${esc(ovName(h.sym))}</b><span class="small faint">${esc(h.bransch)} · ${esc(h.land)}</span></span></span>
        <span class="p-sh">${sh != null ? `<span class="n-cb"><i style="width:${(sh / maxShare * 100).toFixed(0)}%;background:var(--info)"></i></span><span class="num small">${nf(sh, 1)} %</span>` : '–'}</span>
        <span class="r num ${tone(h.d1Dag)}">${h.d1Dag != null ? pct(h.d1Dag, 1) : `<span class="faint small">${h.missing ? (EN ? 'missing' : 'saknas') : (EN ? 'no trading' : 'ingen handel')}</span>`}</span>
        <span class="r num ${tone(h.idag)}">${h.idag != null ? krDiff(h.kr ?? h.idag) : '–'}</span>
        <span class="r num">${h.varde != null ? sekBig(h.varde) : '–'}</span>
        <span class="r num ${tone(h.vinst)}">${h.vinst != null ? `${krDiff(h.vinst)}<span class="small" style="display:block">${h.insatt ? pctDiff((h.vinst / h.insatt) * 100) : ''}</span>` : '<span class="faint small">–</span>'}</span>
        <span class="r p-hide">${h.poang != null ? `<span class="pill ${LV[lvlOf(h.poang)].c}">${h.poang} / 10</span>` : '<span class="faint small">–</span>'}</span>
        <span class="p-hide p-sp" data-spark="${esc(h.sym)}"></span></a>`; }).join('')}
      ${fxRows.map((f) => `<div class="p-tr p-fx" role="row"><span class="p-tn"><span class="dd-fx">${esc(f.fx)}</span><span><b>${EN ? `Currency ${esc(f.fx)}/SEK` : `Valutan ${esc(f.fx)}/SEK`}</b><span class="small faint">${EN ? 'effect on your foreign stocks' : 'påverkan på dina utländska aktier'}</span></span></span><span></span><span class="r num ${tone(f.pct)}">${f.pct != null ? pct(f.pct, 2) : ''}</span><span class="r num ${tone(f.idag)}">${krDiff(f.kr ?? f.idag)}</span><span></span><span></span><span class="p-hide"></span><span class="p-hide"></span></div>`).join('')}
      <div class="p-tr p-tot" role="row"><span><b>${EN ? 'Total' : 'Summa'}</b></span><span class="num small">100 %</span><span class="r num ${tone(day.pct)}">${day.pct != null ? pctDiff(day.pct) : ''}</span><span class="r num ${tone(idag)}"><b>${krDiff(idag)}</b></span><span class="r num"><b>${sekBig(tot)}</b></span><span class="r num ${tone(vinst)}"><b>${vinst != null ? krDiff(vinst) : '–'}</b></span><span class="r p-hide num">${risk != null ? nf(risk, 1) : ''}</span><span class="p-hide"></span></div>
    </div>`;
    Promise.all(sorted.map((h) => api(`/api/chart?s=${encodeURIComponent(h.sym)}&r=1m`, 30 * 60e3).catch(() => null))).then((cs) => {
      sorted.forEach((h, i) => { h.m1 = closesByDay(cs[i]?.punkter); const el = document.querySelector(`[data-spark="${CSS.escape(h.sym)}"]`); const p = h.m1; if (!el || p.length < 2) return;
        const pts = p.map(([d, v]) => [new Date(d + 'T12:00:00').getTime() / 1000, v]); const ch = pts[pts.length - 1][1] / pts[0][1] - 1;
        el.innerHTML = bSpark(pts, pts[0][1], ch >= 0 ? 'var(--up)' : 'var(--down)'); el.title = `${EN ? '30 days' : '30 dagar'}: ${pct(ch * 100, 1)}`; });
      if (news) drawNews();
    });

    /* Vad har gett vinsten */
    const cv = sorted.filter((h) => h.vinst != null).map((h) => ({ n: ovName(h.sym), v: h.vinst })).sort((a, b) => b.v - a.v);
    const mP = Math.max(0, ...cv.map((x) => x.v)), mN = Math.max(0, ...cv.map((x) => -x.v)); const span = mP + mN || 1; const z = (mN / span) * 100;
    $('#pf-contr').innerHTML = cv.length ? cv.map((x) => { const w = (Math.abs(x.v) / span) * 100; return `<div class="p-ct"><span>${esc(x.n)}</span><span class="p-ctb">${mN ? `<i class="z" style="left:${z.toFixed(1)}%"></i>` : ''}<i class="${x.v >= 0 ? 'up' : 'down'}" style="left:${(x.v >= 0 ? z : z - w).toFixed(1)}%;width:${Math.max(0.5, w).toFixed(1)}%"></i></span><b class="num ${tone(x.v)}">${krDiff(x.v)}</b></div>`; }).join('') + `<div class="b-kv"><span>${EN ? 'Total since purchase' : 'Totalt sedan köp'}</span><b class="num ${tone(vinst)}">${vinst != null ? krDiff(vinst) : '–'}</b></div>`
      : `<p class="b-note">${EN ? 'Shown for purchases with an amount.' : 'Visas för köp med belopp.'}</p>`;
    drawAlloc();

    /* Innehav: utförlig tabell och köpen per aktie */
    $('#pf-htable').innerHTML = `<div class="p-tbl p-hold" role="table"><div class="p-tr p-th" role="row"><span>${EN ? 'Holding' : 'Innehav'}</span><span class="r">${EN ? 'Shares' : 'Antal'}</span><span class="r p-hide">${EN ? 'Avg. price' : 'Snittkurs'}</span><span class="r">${EN ? 'Price' : 'Kurs'}</span><span class="r p-hide">${EN ? 'Invested' : 'Insatt'}</span><span class="r">${EN ? 'Value' : 'Värde'}</span><span class="r">${EN ? 'Since purchase' : 'Sedan köp'}</span><span class="r p-hide">${EN ? 'Share' : 'Andel'}</span><span class="r p-hide">Riskkoll</span><span class="r p-hide">Beta</span></div>
      ${sorted.map((h) => `<a class="p-tr" role="row" href="/bolag/${encodeURIComponent(h.sym)}" data-link><span class="p-tn">${symFlag(h.sym)}<span><b>${esc(ovName(h.sym))}</b><span class="small faint">${esc(h.sym)} · ${esc(h.bransch)}</span></span></span><span class="r num">${esc(nfAntal(h.antal))}</span><span class="r num p-hide">${h.snitt ? `${esc(kr(h.snitt))} ${esc(cur(h.valuta))}` : '–'}</span><span class="r num">${h.kurs != null ? `${esc(kr(h.kurs))} ${esc(cur(h.valuta))}` : '–'}${h.d1Dag != null ? `<span class="small ${tone(h.d1Dag)}" style="display:block">${pct(h.d1Dag, 1)}</span>` : ''}</span><span class="r num p-hide">${h.insatt != null ? sekBig(h.insatt) : '–'}</span><span class="r num">${h.varde != null ? sekBig(h.varde) : '–'}</span><span class="r num ${tone(h.vinst)}">${h.vinst != null ? `${krDiff(h.vinst)}<span class="small" style="display:block">${h.insatt ? pctDiff((h.vinst / h.insatt) * 100) : ''}</span>` : '–'}</span><span class="r num p-hide">${h.varde ? nf(share(h.varde), 1) + ' %' : '–'}</span><span class="r p-hide">${h.poang != null ? `<span class="pill ${LV[lvlOf(h.poang)].c}">${h.poang}</span>` : '–'}</span><span class="r num p-hide">${pfBetaOf(pd.S, h.sym) != null ? bn(pfBetaOf(pd.S, h.sym), 2) : '–'}</span></a>`).join('')}
      <div class="p-tr p-tot" role="row"><span><b>${EN ? 'Total' : 'Summa'}</b></span><span></span><span class="p-hide"></span><span></span><span class="r num p-hide"><b>${kandaInsatt ? sekBig(insatt) : '–'}</b></span><span class="r num"><b>${sekBig(tot)}</b></span><span class="r num ${tone(vinst)}"><b>${vinst != null ? krDiff(vinst) : '–'}</b></span><span class="r num p-hide">100 %</span><span class="r p-hide num">${risk != null ? nf(risk, 1) : ''}</span><span class="r p-hide num">${bn(pfBeta(sorted.filter((h) => h.varde), pd.S, tot).beta, 2) ?? ''}</span></div></div>`;
    $('#pf-list').innerHTML = `<div class="pf-holdings">${sorted.map((h) => `
      <div class="pf-hold ${open === h.sym ? 'open' : ''}">
        <button type="button" class="pf-row" data-pfopen="${esc(h.sym)}" aria-expanded="${open === h.sym}">
          ${av(h.sym)}
          <span class="grow pf-name"><b>${symFlag(h.sym, 'mob-pf')}${esc(h.namn)}</b><span class="small muted">${esc(nfAntal(h.antal))} st · ${h.kurs != null ? esc(kr(h.kurs)) + ' ' + esc(cur(h.valuta)) : 'kurs saknas'}${h.bs.length > 1 ? ` · ${h.bs.length} köp` : ''}</span></span>
          <span class="pf-val"><b class="num">${h.varde != null ? sek(h.varde) : '–'}</b><span class="small num" style="color:var(--${tone(h.vinst)})">${h.vinst != null ? `${krDiff(h.vinst)} (${pct((h.vinst / h.insatt) * 100, 1)})` : h.bs.some((b) => b.gammal) ? 'köpdatum saknas' : ''}</span></span>
          <span class="pf-chev" aria-hidden="true">${svg('arrow', 14)}</span>
        </button>
        ${open === h.sym ? `<div class="pf-detail">
          <div class="pf-buys">${h.bs.slice().sort((a, b) => String(b.tid).localeCompare(String(a.tid))).map((b) => `
            <div class="pf-buy">
              <span class="grow"><b>${b.tid ? esc(fmtTid(b.tid)) : 'Köpdatum saknas'}</b><span class="small muted">${b.belopp ? `${esc(nf(b.belopp, 0))} ${esc(b.valuta)} · ` : ''}${esc(nfAntal(b.antal))} st${b.kurs ? ` à ${esc(kr(b.kurs))} ${esc(cur(b.kursValuta || h.valuta))}` : ''}</span></span>
              <span class="pf-val"><b class="num small">${b.varde != null ? sek(b.varde) : '–'}</b><span class="small num" style="color:var(--${tone(b.vinst)})">${b.vinst != null ? krDiff(b.vinst) : ''}</span></span>
              <button type="button" class="linkbtn small danger-link" data-pfdel="${esc(b.id)}" aria-label="Ta bort köpet">Ta bort</button>
            </div>`).join('')}
            ${h.bs.some((b) => b.gammal) ? '<p class="small muted" style="margin:0">Det här innehavet lades in innan vi frågade efter datum. Ta bort det och lägg in köpet igen med belopp, datum och tid för rätt siffror och tidslinje.</p>' : ''}
          </div>
          <div class="chips"><button type="button" class="btn ghost small" data-pfmore="${esc(h.sym)}">${svg('plus', 13)} Lägg till ett köp till</button><a class="btn ghost small" href="/bolag/${encodeURIComponent(h.sym)}" data-link>Bolagssida och riskkoll</a></div>
        </div>` : ''}
      </div>`).join('')}</div>`;

    /* Köp och sälj: alla köp */
    const bl = buys.slice().sort((a, b) => String(b.tid || '').localeCompare(String(a.tid || '')));
    $('#pf-txn-s').textContent = `${bl.length} ${EN ? 'purchases' : 'köp'}`;
    $('#pf-txn').innerHTML = `<div class="p-tbl p-txn" role="table"><div class="p-tr p-th" role="row"><span>${EN ? 'Date' : 'Datum'}</span><span>${EN ? 'Stock' : 'Aktie'}</span><span class="r">${EN ? 'Amount' : 'Belopp'}</span><span class="r p-hide">${EN ? 'Shares' : 'Antal'}</span><span class="r p-hide">${EN ? 'Price' : 'Kurs'}</span><span class="r">${EN ? 'Value now' : 'Värde nu'}</span><span class="r">${EN ? 'Result' : 'Resultat'}</span><span></span></div>
      ${bl.map((b) => `<div class="p-tr" role="row"><span class="num small">${b.tid ? esc(fmtTid(b.tid)) : `<span class="faint">${EN ? 'Date missing' : 'Datum saknas'}</span>`}</span><span class="p-tn">${symFlag(b.sym)}<span><b>${esc(ovName(b.sym))}</b><span class="small faint">${EN ? 'Buy' : 'Köp'}${b.imp ? ` · ${esc(b.imp)}` : ''}</span></span></span><span class="r num">${b.insattSek != null ? sekBig(b.insattSek) : '–'}${b.valuta && b.valuta !== 'SEK' && b.belopp ? `<span class="small faint" style="display:block">${esc(nf(b.belopp, 0))} ${esc(b.valuta)}</span>` : ''}</span><span class="r num p-hide">${esc(nfAntal(b.antal))}</span><span class="r num p-hide">${b.kurs ? `${esc(kr(b.kurs))} ${esc(cur(b.kursValuta || pd.valOf(b.sym)))}` : '–'}</span><span class="r num">${b.varde != null ? sekBig(b.varde) : '–'}</span><span class="r num ${tone(b.vinst)}">${b.vinst != null ? krDiff(b.vinst) : '–'}${b.vinst != null && b.insattSek ? `<span class="small" style="display:block">${pctDiff((b.vinst / b.insattSek) * 100)}</span>` : ''}</span><span class="r"><button type="button" class="linkbtn small danger-link" data-pfdel="${esc(b.id)}">${EN ? 'Remove' : 'Ta bort'}</button></span></div>`).join('')}</div>`;

    /* Risk: flaggor och riskens delar från bolagens riskkoll */
    pfInsight(hold, tot, '#pf-side', true, true);
    cache = { buys, valOf: pd.valOf, quotes: pd.quotes, fxNow: pd.fxNow, tot, insatt };
    serP = pfSeries(cache).catch(() => ({ error: 'fetch' }));
    idxP = null; riskFor = null;
    const firstIso = first ? sthlmDay(first) : sthlmDay(Date.now());
    const omxFrom = [firstIso, sthlmDay(Date.now() - 400 * 864e5), `${new Date().getFullYear() - 1}-12-20`].sort()[0];
    omxP = api(`/api/chart?s=${encodeURIComponent('^OMX')}&from=${omxFrom}`, 30 * 60e3).then((c) => closesByDay(c?.punkter)).catch(() => []);
    statsP = Promise.all([serP, omxP]).then(([ser, omx]) => pfStats(ser, omx, day));
    kalP = getKalender([...new Set([...syms, ...mySyms().all])]).catch(() => []);
    planP = kalP.then(dividendPlan).catch(() => ({ rows: [], total: 0, utan: syms }));

    // Siffror som kräver tidslinjen eller kalendern fylls i när de är klara
    Promise.all([statsP, serP]).then(async ([st, ser]) => {
      if (st.ok) {
        if (st.perYear != null) extra.py = { k: 'Per år', v: pctDiff(st.perYear), s: EN ? 'time-weighted return' : 'tidsviktad avkastning', c: tone(st.perYear) };
        else extra.py = { k: EN ? 'Return' : 'Avkastning', v: pctDiff(st.twrStart), s: `${EN ? 'time-weighted, since' : 'tidsviktad, sedan'} ${bDate(st.firstDay, false)}`, c: tone(st.twrStart) };
        if (st.vol != null) { extra.vol = bPct(st.vol); extra.volS = st.omxVol ? `OMXS30 ${bPct(st.omxVol)}` : (EN ? 'last year' : 'senaste året'); } else { extra.vol = null; extra.volS = EN ? 'needs 2 months of history' : 'kräver två månaders historik'; }
        if (st.omxStart != null) { const d = st.twrStart - st.omxStart; extra.cmp = `${ppDiff(d)} ${EN ? 'pp' : 'p.e.'}`; extra.cmpTone = tone(d); extra.cmpS = d >= 0 ? (EN ? 'better than the index' : 'bättre än index') : (EN ? 'worse than the index' : 'sämre än index'); }
      } else { extra.py = { k: 'Per år', v: null, s: EN ? 'needs purchases with dates' : 'kräver köp med datum' }; extra.vol = null; extra.volS = ''; extra.cmp = null; extra.cmpS = EN ? 'needs purchases with dates' : 'kräver köp med datum'; }
      const ix = ser && !ser.error ? await getIdx(ser) : null;
      paintStats(); drawPerf(st); drawInsights(st);
    });
    planP.then((plan) => {
      extra.utd = plan.rows.length ? sekBig(plan.total) : '0 kr';
      extra.utdS = plan.rows.length && tot ? `${EN ? 'per year' : 'per år'}, ${nf((plan.total / tot) * 100, 1)} %` : (EN ? 'no known dividend' : 'ingen känd utdelning');
      paintStats();
    });
    drawKalender();
    timeline();
    if (pfTab() === 'risk') drawRisk(); if (panelOpen('dagen')) { loaded.dagen = true; mountDinDag(); } if (panelOpen('nyheter')) { loaded.news = true; loadNews(); }
  };
  const getIdx = (ser) => (idxP ||= pfIndexSeries(cache.buys, ser).catch(() => null));

  /* ---- Avkastning per period ---- */
  const drawPerf = (st) => {
    const el = $('#pf-perf'); if (!el) return;
    if (!st.ok) { el.innerHTML = `<p class="b-note">${EN ? 'Needs purchases with dates and at least two days of prices.' : 'Kräver köp med datum och minst två dagars kurser.'}</p>`; return; }
    const f = (v) => (v == null ? '<span class="faint">–</span>' : pctDiff(v));
    el.innerHTML = `<div class="p-perf"><div class="p-pr p-th"><span></span><span class="r">${EN ? 'You' : 'Du'}</span><span class="r">OMXS30</span><span class="r">${EN ? 'Difference' : 'Skillnad'}</span></div>
      ${st.perf.map((p) => { const d = p.u != null && p.i != null ? p.u - p.i : null; return `<div class="p-pr"><span>${esc(p.n)}</span><b class="r num ${tone(p.u)}">${f(p.u)}</b><span class="r num muted">${f(p.i)}</span><b class="r num ${d != null && Math.abs(d) >= 0.05 ? tone(d) : ''}">${d == null ? '<span class="faint">–</span>' : ppDiff(d)}</b></div>`; }).join('')}</div>
      <span class="b-src">${EN ? 'Your return is calculated day by day without your deposits, so new purchases do not count as profit. Skillnad in percentage points. OMXS30 without dividends. "–" = you had no stocks then.' : 'Din avkastning räknas dag för dag utan dina insättningar, så nya köp räknas inte som vinst. Skillnaden i procentenheter. OMXS30 utan utdelningar. "–" = du ägde inga aktier då.'}</span>`;
  };
  /* ---- I klartext: det viktigaste just nu ---- */
  const drawInsights = (st) => {
    const el = $('#pf-ins'); if (!el || !pd) return;
    const { hold, tot, valOf } = pd; const hv = hold.filter((h) => h.varde);
    if (!hv.length) { el.innerHTML = `<p class="b-note">${EN ? 'Prices are missing.' : 'Kurserna saknas.'}</p>`; return; }
    const grp = (f) => { const m = {}; for (const h of hv) m[f(h)] = (m[f(h)] || 0) + h.varde; return Object.entries(m).sort((a, b) => b[1] - a[1]); };
    const br = grp((h) => h.bransch)[0]; const fx = grp((h) => valOf(h.sym)).filter(([k]) => k !== 'SEK'); const fxSum = fx.reduce((a, x) => a + x[1], 0);
    const top = hv.slice().sort((a, b) => b.varde - a.varde)[0];
    const withV = hv.filter((h) => h.vinst != null && h.insatt);
    const worst = withV.slice().sort((a, b) => a.vinst / a.insatt - b.vinst / b.insatt)[0]; const best = withV.slice().sort((a, b) => b.vinst - a.vinst)[0];
    const out = [];
    if (br && share(br[1]) > 30 && hv.length > 1) out.push(['!', 'warn', `${br[0]} ${EN ? 'is' : 'är'} ${nf(share(br[1]), 0)} % ${EN ? 'of the money' : 'av pengarna'}`, EN ? `If ${br[0].toLowerCase()} has a bad time, ${share(br[1]) > 50 ? 'more than half' : 'a large part'} of the portfolio is hit at the same time.` : `Går det dåligt för ${br[0].toLowerCase()} påverkas ${share(br[1]) > 50 ? 'mer än hälften' : 'en stor del'} av portföljen samtidigt.`]);
    if (fxSum && share(fxSum) > 10) out.push(['$', 'info', `${nf(share(fxSum), 0)} % ${EN ? 'is in' : 'ligger i'} ${fx.map(([k]) => k).join(EN ? ' and ' : ' och ')}`, EN ? `If the currency falls 10 % against the krona you lose about ${sekBig(fxSum * 0.1)}, even if the stocks stand still.` : `Faller valutan 10 % mot kronan tappar du ca ${sekBig(fxSum * 0.1)}, även om aktierna står still.`]);
    if (st?.ok && st.omxStart != null) { const d = st.twrStart - st.omxStart; out.push([d >= 0 ? '↑' : '↓', d >= 0 ? 'up' : 'down', EN ? `You have done ${nf(Math.abs(d), 1)} percentage points ${d >= 0 ? 'better' : 'worse'} than OMXS30` : `Du har gått ${nf(Math.abs(d), 1)} procentenheter ${d >= 0 ? 'bättre' : 'sämre'} än OMXS30`, EN ? `Counted from your first purchase, without your deposits. You ${pctDiff(st.twrStart)}, OMXS30 ${pctDiff(st.omxStart)}.` : `Räknat från ditt första köp, utan dina insättningar. Du ${pctDiff(st.twrStart)}, OMXS30 ${pctDiff(st.omxStart)}.`]); }
    if (worst && worst.vinst < 0) out.push(['↓', 'down', `${ovName(worst.sym)} ${EN ? 'is down' : 'är ner'} ${nf(Math.abs(worst.vinst / worst.insatt * 100), 1)} % ${EN ? 'since purchase' : 'sedan köp'}`, `${krDiff(worst.vinst)}.${worst.poang != null ? ` ${EN ? 'Risk check' : 'Riskkoll'} ${worst.poang} ${EN ? 'of' : 'av'} 10.` : ''}`]);
    else if (best && best.vinst > 0) out.push(['↑', 'up', EN ? `${ovName(best.sym)} has given the most` : `${ovName(best.sym)} har gett mest`, `${krDiff(best.vinst)} ${EN ? 'since purchase' : 'sedan köp'} (${pctDiff(best.vinst / best.insatt * 100)}).`]);
    if (out.length < 4 && hv.length > 1 && share(top.varde) > 20) out.push(['!', 'warn', `${ovName(top.sym)} ${EN ? 'is' : 'är'} ${nf(share(top.varde), 0)} % ${EN ? 'of the portfolio' : 'av portföljen'}`, EN ? 'If that stock falls, the whole portfolio feels it.' : 'Faller den aktien märks det mycket på helheten.']);
    if (out.length < 4 && st?.vol != null && st.omxVol) out.push(['~', st.vol > st.omxVol * 1.1 ? 'warn' : 'info', `${EN ? 'Volatility' : 'Volatiliteten'} ${nf(st.vol, 1)} %`, EN ? `OMXS30 ${nf(st.omxVol, 1)} % the same year.` : `OMXS30 ${nf(st.omxVol, 1)} % samma år.`]);
    el.innerHTML = out.slice(0, 4).map(([ic, c, t, s]) => `<div class="p-in"><span class="p-ic ${c}">${esc(ic)}</span><span><b>${esc(t)}</b><span class="small">${esc(s)}</span></span></div>`).join('') || `<p class="b-note">${EN ? 'Nothing special right now.' : 'Inget särskilt just nu.'}</p>`;
  };

  /* ---- Fördelning ---- */
  const drawAlloc = () => {
    const el = $('#pf-alloc'); if (!el || !pd) return;
    const m = {}; for (const h of pd.hold) if (h.varde) { const k = alloc === 'bransch' ? h.bransch : alloc === 'land' ? h.land : alloc === 'valuta' ? pd.valOf(h.sym) : ovName(h.sym); m[k] = (m[k] || 0) + h.varde; }
    const rows = Object.entries(m).sort((a, b) => b[1] - a[1]);
    if (!rows.length) { el.innerHTML = `<p class="b-note">${EN ? 'Prices are missing.' : 'Kurserna saknas.'}</p>`; return; }
    const d = donut(rows);
    const lab = { bransch: EN ? 'sectors' : 'branscher', land: EN ? 'countries' : 'länder', valuta: EN ? 'currencies' : 'valutor', innehav: EN ? 'holdings' : 'innehav' }[alloc];
    el.innerHTML = `<div class="p-alloc"><div class="p-donut">${d.svg}<span class="p-dn"><b class="num">${rows.length}</b><span>${esc(lab)}</span></span></div><div class="ov-legs">${d.legend}</div></div>`;
  };

  /* ---- Tidslinje: värdet dag för dag jämfört med insatta pengar, och OMXS30 med samma insättningar ---- */
  let tlSeq = 0;
  const timeline = async () => {
    const id = ++tlSeq; const box = $('#pf-tl'); if (!box || !cache) return;
    if (!cache.buys.some((b) => b.tid && b.insattSek != null)) { box.innerHTML = '<div class="empty">Tidslinjen kräver köp med datum. Lägg in dina köp med belopp, datum och tid.</div>'; return; }
    box.classList.add('is-loading');
    const ser = await serP;
    const ix = cmpOn && !ser.error ? await getIdx(ser) : null;
    if (id !== tlSeq || !$('#pf-tl')) return;
    box.classList.remove('is-loading');
    if (ser.error === 'fetch') { box.innerHTML = '<div class="empty">Kurserna för tidslinjen kunde inte hämtas just nu. Prova igen om en stund.</div>'; return; }
    if (ser.error) { box.innerHTML = '<div class="empty">Tidslinjen visas när det finns minst två dagars kurser efter ditt första köp.</div>'; return; }
    const V = rangeCut(ser.value, range, ser.tNow), I = rangeCut(ser.invested, range, ser.tNow);
    drawMoneyChart(box, V, I, cmpOn && ix ? { cmp: rangeCut(ix, range, ser.tNow), cmpLabel: EN ? 'If the money was in OMXS30' : 'Om pengarna legat i OMXS30' } : {});
    const g = V[V.length - 1][1] - V[0][1] - (I[I.length - 1][1] - I[0][1]);
    if ($('#pf-tlchg')) $('#pf-tlchg').innerHTML = `<span class="${tone(g)}">${krDiff(g)}</span> <span class="faint">${EN ? 'in the period' : 'under perioden'}</span>`;
    if (cmpOn && !ix) box.insertAdjacentHTML('beforeend', `<p class="b-note">${EN ? 'OMXS30 could not be fetched right now.' : 'OMXS30 kunde inte hämtas just nu.'}</p>`);
  };

  /* ---- Risk och analys ---- */
  let riskFor = null; let riskSeq = 0;
  const drawRisk = async () => {
    const box = $('#pf-risk'); if (!box || !pd || riskFor === pd) return;
    riskFor = pd; const id = ++riskSeq; const me = pd;
    const [st, cov, plan] = await Promise.all([statsP, pfCov(me.hold).catch(() => null), planP]);
    if (id !== riskSeq || !$('#pf-risk')) return;
    box.innerHTML = pfRiskHTML(me, st, cov, plan);
    if (st?.dd) drawDD($('#pf-dd'), st.dd);
    drawStress();
  };
  const drawStress = () => {
    const el = $('#pf-stress'); if (!el || !pd) return;
    const hv = pd.hold.filter((h) => h.varde); const { rows, sum } = pfStress(hv, pd.S, stressF);
    const max = Math.max(1, ...rows.map((r) => Math.abs(r.loss))); const hard = rows.slice().sort((a, b) => a.pct - b.pct)[0];
    el.innerHTML = `<div class="p-st3"><div><span>${EN ? 'Expected for the portfolio' : 'Väntat för portföljen'}</span><b class="num down">${pctDiff((sum / pd.tot) * 100)}</b></div><div><span>${EN ? 'In kronor' : 'I kronor'}</span><b class="num down">${krDiff(sum)}</b></div><div><span>${EN ? 'Hit hardest' : 'Hårdast drabbad'}</span><b>${esc(ovName(hard.h.sym))} ${pctDiff(hard.pct)}</b></div></div>
      ${rows.map((r) => `<div class="p-rc"><span>${esc(ovName(r.h.sym))}</span><span class="n-cb"><i style="width:${(Math.abs(r.loss) / max * 100).toFixed(0)}%;background:var(--down)"></i></span><b class="num">${krDiff(r.loss)}</b><span class="num faint">β ${r.beta != null ? bn(r.beta, 2) : '–'}</span></div>`).join('')}
      <span class="b-src">${EN ? 'Each stock\'s beta × the market fall (Yahoo Finance, five years of monthly data). Stocks without a beta are counted as the market (1.0). A simple calculation, not a forecast.' : 'Varje akties beta × börsfallet (Yahoo Finance, fem års månadsdata). Aktier utan beta räknas som börsen (1,0). En enkel räkning, ingen prognos.'}</span>`;
  };
  const drawDD = (el, dd) => {
    if (!el || dd.length < 2) return;
    const W = 600, H = 150; const t0 = dd[0][0], t1 = dd[dd.length - 1][0]; const lo = Math.min(-1, ...dd.map((p) => p[1])) * 1.1;
    const X = (t) => ((t - t0) / (t1 - t0 || 1)) * W, Y = (v) => (v / lo) * (H - 4) + 2;
    const line = dd.map(([t, v], i) => `${i ? 'L' : 'M'}${X(t).toFixed(1)},${Y(v).toFixed(1)}`).join('');
    const mid = lo / 2;
    el.innerHTML = `<div class="p-dd"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${EN ? 'Fall from peak' : 'Fall från toppen'}">
      <line x1="0" x2="${W}" y1="${Y(mid).toFixed(1)}" y2="${Y(mid).toFixed(1)}" stroke="var(--line-soft)" vector-effect="non-scaling-stroke"/>
      <path d="${line}L${W},2L0,2Z" fill="var(--down)" opacity=".16"/><path d="${line}" fill="none" stroke="var(--down)" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>
      <span class="p-dd-y t num">0 %</span><span class="p-dd-y m num">${bSign(mid, 0)}</span><span class="p-dd-y b num">${bSign(lo, 0)}</span></div>
      <div class="dd-axis small num"><span>${esc(fmtDag(t0))}</span><span>${esc(fmtDag(t1))}</span></div>`;
  };

  /* ---- Nyheter om aktierna du äger ---- */
  let nsort = 'vikt'; let nfilt = 'alla'; let news = null;
  const loadNews = async () => {
    $('#pf-news').innerHTML = loading('Hämtar nyheter …');
    const d = await getMyNews().catch(() => ({ ok: false, items: [] }));
    if (!$('#pf-news')) return;
    news = d; drawNews(); drawNewsSide();
  };
  // Kursen sedan nyheten: från stängningskursen dagen före nyheten till kursen nu
  const since = (n) => { const h = pd?.hold.find((x) => x.sym === n.min); if (!h?.m1?.length || h.kurs == null) return null;
    const nd = sthlmDay(n.datum); const prev = h.m1.filter(([d]) => d < nd).pop(); if (!prev) return null;
    const p = (h.kurs / prev[1] - 1) * 100; return { p, kr: h.varde != null ? h.varde - h.varde / (1 + p / 100) : null }; };
  const drawNews = () => {
    const el = $('#pf-news'); if (!el || !news) return;
    if (news.ok === false && !news.items.length) { el.innerHTML = `<p class="b-note">${EN ? 'The news could not be fetched right now. Try again in a while.' : 'Nyheterna kunde inte hämtas just nu. Prova igen om en stund.'}</p>`; $('#pf-nchips').innerHTML = ''; return; }
    const own = news.items.filter((n) => n.agd);
    const cnt = {}; for (const n of own) cnt[n.min] = (cnt[n.min] || 0) + 1;
    const owned = (pd?.hold || []).slice().sort((a, b) => (b.varde || 0) - (a.varde || 0)).map((h) => h.sym);
    if (nfilt !== 'alla' && !cnt[nfilt]) nfilt = 'alla';
    $('#pf-nchips').innerHTML = [['alla', `${EN ? 'All' : 'Alla'} ${own.length}`], ...owned.filter((s) => cnt[s]).map((s) => [s, `${ovName(s)} ${cnt[s]}`])].map(([k, t]) => `<button type="button" class="chip-btn" data-pfnf="${esc(k)}" aria-pressed="${k === nfilt}">${esc(t)}</button>`).join('');
    const byTime = (a, b) => String(b.datum).localeCompare(String(a.datum));
    const list = own.filter((n) => nfilt === 'alla' || n.min === nfilt).sort(nsort === 'vikt' ? (a, b) => b.poang - a.poang || byTime(a, b) : byTime).slice(0, 30);
    el.innerHTML = list.length ? list.map((n) => { const s = since(n); const c = n.amne ? nTopic(n) : 'var(--muted)'; const st = s && Math.abs(s.p) >= 0.05 ? tone(s.p) : ''; return `<div class="p-nw"><span class="p-nwc" style="background:${c}"></span><span class="p-nwm"><span class="small faint"><span class="p-topic" style="--c:${c}">${esc(n.amne || (EN ? 'News' : 'Nyhet'))}</span> ${esc(n.tidTxt)}${n.kalla ? ' · ' + esc(n.kalla) : ''}</span><span class="p-nwt">${newsTitle(n)}</span>${n.text ? `<span class="small muted p-nwx">${esc(String(n.text).slice(0, 180))}</span>` : ''}</span>
      <span class="p-nwr"><a class="p-nws" href="/bolag/${encodeURIComponent(n.min)}" data-link>${esc(ovName(n.min))}</a>${s ? `<span class="small"><b class="num ${st}">${pctDiff(s.p)}</b> <span class="faint">${EN ? 'since' : 'sedan dess'}</span></span>${s.kr != null ? `<span class="small num ${st}">${krDiff(s.kr)} ${EN ? 'for you' : 'för dig'}</span>` : ''}` : ''}</span></div>`; }).join('') + `<span class="b-src">${EN ? 'Price since = from the closing price the day before the news to the price now. It shows how the stock has moved, not that the news caused it.' : 'Kursen sedan dess = från stängningskursen dagen före nyheten till kursen nu. Den visar hur aktien rört sig, inte att nyheten var orsaken.'}</span>`
      : `<p class="b-note">${EN ? 'No news about your stocks in the last two weeks.' : 'Inga nyheter om dina aktier de senaste två veckorna.'}</p>`;
  };
  const drawNewsSide = async () => {
    if (!pd) return;
    const own = (news?.items || []).filter((n) => n.agd); const now = Date.now();
    const hs = pd.hold.slice().sort((a, b) => (b.varde || 0) - (a.varde || 0));
    const c14 = hs.map((h) => [h.sym, own.filter((n) => n.min === h.sym && now - new Date(n.datum).getTime() < 14 * 864e5).length]); const mx = Math.max(1, ...c14.map((x) => x[1]));
    if ($('#pf-ncount')) $('#pf-ncount').innerHTML = c14.map(([s, k]) => `<div class="p-rc p-rc3"><span>${esc(ovName(s))}</span><span class="n-cb"><i style="width:${(k / mx * 100).toFixed(0)}%;background:var(--info)"></i></span><b class="num">${k}</b></div>`).join('') + `<span class="b-src">${EN ? 'Number of news items in our sources. Many news items often means something is happening.' : 'Antal nyheter i våra källor. Många nyheter betyder ofta att något händer.'}</span>`;
    kalP.then((kal) => { const el = $('#pf-ahead'); if (!el) return; const ev = events(kal, 0, 60).filter((e) => pd.syms.includes(e.k.sym)).slice(0, 4);
      el.innerHTML = ev.length ? ev.map((e) => { const d = new Date(e.dag + 'T12:00:00'); const h = pd.hold.find((x) => x.sym === e.k.sym); return `<a class="n-todo" href="/bolag/${encodeURIComponent(e.k.sym)}?flik=${e.typ === 'rapport' ? 'rapporter' : 'kalender'}" data-link><span class="n-date"><span>${esc(bMon(d.getMonth()))}</span><b class="num">${d.getDate()}</b></span><span class="n-tt"><b>${esc(ovName(e.k.sym))} ${esc(e.typ === 'rapport' ? (EN ? 'reports' : 'lämnar rapport') : e.typ === 'ex' ? (EN ? 'ex-dividend date' : 'x-dag') : (EN ? 'pays dividend' : 'betalar utdelning'))}</b><span>${esc(whenTxt(e.dag))}${h?.varde ? ` · ${EN ? 'you own' : 'du äger'} ${nf(share(h.varde), 0)} %` : ''}${e.typ !== 'rapport' && e.k.utdelningPerAktie ? ` · ${kr(e.k.utdelningPerAktie)} ${cur(e.k.valuta)} ${EN ? 'per share' : 'per aktie'}` : ''}</span></span></a>`; }).join('') : `<p class="b-note">${EN ? 'No known reports or dividend dates in the next two months.' : 'Inga kända rapporter eller utdelningsdagar de närmaste två månaderna.'}</p>`; });
    const wk = $('#pf-week'); if (!wk) return;
    await accCfg();
    if (!ACC.ai) { wk.innerHTML = `<p class="b-note">${EN ? 'The AI summary is not available right now.' : 'AI-sammanfattningen är inte tillgänglig just nu.'}</p>`; return; }
    const top = hs.slice(0, 8);
    const d = await api(`/api/summary?syms=${encodeURIComponent(top.map((h) => h.sym).join(','))}&namn=${encodeURIComponent(top.map((h) => ovName(h.sym)).join(','))}${EN ? '&lang=en' : ''}`, 60 * 60e3).catch(() => null);
    if (!$('#pf-week')) return;
    wk.innerHTML = d?.punkter?.length ? `<ul class="ai-text">${d.punkter.map((p) => `<li>${esc(p)}</li>`).join('')}</ul><span class="b-src">${EN ? `Summarised by AI from ${d.antalNyheter} headlines from the last week. May contain errors. No advice.` : `Sammanfattat av AI från ${d.antalNyheter} rubriker från senaste veckan. Kan innehålla fel. Inget råd.`}</span>`
      : `<p class="b-note">${d?.saknas === 'no_news' ? (EN ? 'No news about your stocks in the last week.' : 'Inga nyheter om dina aktier den senaste veckan.') : (EN ? 'The summary could not be made right now.' : 'Sammanfattningen kunde inte göras just nu.')}</p>`;
  };

  /* ---- Kalender och utdelning ---- */
  const drawKalender = async () => {
    const [kal, plan] = await Promise.all([kalP, planP]); if (!$('#pf-kal') || !pd) return;
    const own = new Set(pd.syms); const today = isoDay(Date.now());
    // Utdelningar per månad: årets väntade utdelning per aktie fördelad på de månader bolaget delade ut de senaste 12 månaderna
    const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + i); return { k: d.toISOString().slice(0, 7), m: d.getMonth(), y: d.getFullYear(), v: 0, n: [] }; });
    const mIdx = Object.fromEntries(months.map((m, i) => [m.k, i])); const yearAgo = isoDay(Date.now() - 365 * 864e5);
    let utan = 0;
    for (const r of plan.rows) {
      if (!r.perAr) continue;
      const hist = (r.k.historik || []).filter((x) => x.dag > yearAgo);
      const sum = hist.reduce((a, x) => a + x.belopp, 0);
      const ev = hist.length ? hist.map((x) => { const d = new Date(x.dag + 'T12:00:00'); d.setFullYear(d.getFullYear() + 1); let k = d.toISOString().slice(0, 7); if (k < months[0].k) k = months[0].k; return [k, x.belopp / sum]; })
        : r.k.exUtdelning ? [[(r.k.exUtdelning >= today ? r.k.exUtdelning : (() => { const d = new Date(r.k.exUtdelning + 'T12:00:00'); while (isoDay(d) < today) d.setFullYear(d.getFullYear() + 1); return isoDay(d); })()).slice(0, 7), 1]] : [];
      if (!ev.length) { utan += r.perAr; continue; }
      for (const [k, f] of ev) { const i = mIdx[k]; if (i == null) continue; months[i].v += r.perAr * f; if (!months[i].n.includes(r.k.sym)) months[i].n.push(r.k.sym); }
    }
    const mmax = Math.max(1, ...months.map((m) => m.v));
    $('#pf-utdtot').textContent = `${sekBig(plan.total)} ${EN ? 'per year' : 'per år'}`;
    $('#pf-utdm').innerHTML = `<div class="p-mb">${months.map((m) => `<div class="p-mbc" title="${esc(m.n.map(ovName).join(', '))}"><span class="num small">${m.v >= 0.5 ? nf(m.v, 0) : ''}</span><i style="height:${(m.v / mmax * 100).toFixed(1)}%"></i><span class="small faint">${esc(bMon(m.m))}</span></div>`).join('')}</div>
      <span class="b-src">${EN ? 'Estimated: the expected dividend per year spread over the months when each company paid in the last 12 months (ex-date month).' : 'Uppskattat: väntad utdelning per år fördelad på de månader varje bolag delade ut de senaste 12 månaderna (månaden för X-dagen).'}${utan >= 0.5 ? ` ${sekBig(utan)} ${EN ? 'has no known month.' : 'saknar känd månad.'}` : ''}</span>`;
    const ev = events(kal, 0, 122);
    $('#pf-kal').innerHTML = ev.length ? '<div class="p-evs">' + ev.map((e) => { const dd = new Date(e.dag + 'T12:00:00'); const p = plan.rows.find((x) => x.k.sym === e.k.sym); const n = daysTo(e.dag);
      const extra = e.typ !== 'rapport' && e.k.utdelningPerAktie ? `${kr(e.k.utdelningPerAktie)} ${cur(e.k.valuta)} ${EN ? 'per share and year' : 'per aktie och år'}${p?.perAr ? ` · ${EN ? 'about' : 'ca'} ${sekBig(p.perAr)} ${EN ? 'for you' : 'för dig'}` : ''}` : e.typ === 'rapport' && e.k.rapportUppskattad ? (EN ? 'Preliminary date' : 'Preliminärt datum') : '';
      return `<a class="b-ev" href="/bolag/${encodeURIComponent(e.k.sym)}?flik=${e.typ === 'rapport' ? 'rapporter' : 'kalender'}" data-link><span class="b-ev-d"><span>${esc(bMon(dd.getMonth()))}</span><b class="num">${dd.getDate()}</b><span class="faint">${n === 0 ? (EN ? 'today' : 'i dag') : n === 1 ? (EN ? 'tomorrow' : 'i morgon') : `${EN ? 'in' : 'om'} ${n} d`}</span></span><span class="grow" style="min-width:0"><b>${esc(ovName(e.k.sym))}</b><span class="small faint" style="display:block">${esc(EVT[e.typ][0])}${extra ? ' · ' + esc(extra) : ''}</span></span><span class="pill ${e.typ === 'rapport' ? 'info' : 'up'}">${e.typ === 'rapport' ? (EN ? 'Report' : 'Rapport') : (EN ? 'Dividend' : 'Utdelning')}</span>${own.has(e.k.sym) ? `<span class="pill outline">${EN ? 'Own' : 'Äger'}</span>` : `<span class="pill outline faint">${EN ? 'Watch' : 'Bevakar'}</span>`}</a>`; }).join('') + '</div>'
      : `<p class="b-note">${EN ? 'No known reports or dividend dates in the next four months.' : 'Inga kända rapporter eller utdelningsdagar de närmaste fyra månaderna.'}</p>`;
    const next = (typs) => ev.find((e) => own.has(e.k.sym) && typs.includes(e.typ));
    const nr = next(['rapport']); const nu = next(['ex', 'utbet']);
    const tot = pd.tot;
    $('#pf-utd').innerHTML = `<div class="p-big"><b class="num">${sekBig(plan.total)}</b><span class="small muted">${EN ? 'per year' : 'per år'}${tot ? ` · ${nf((plan.total / tot) * 100, 1)} % ${EN ? 'of the value' : 'av värdet'}` : ''}</span></div>
      ${plan.rows.filter((r) => r.perAr).map((r) => `<div class="p-rc p-rc3"><span>${esc(ovName(r.k.sym))}</span><span class="n-cb"><i style="width:${(r.perAr / Math.max(1, plan.rows[0].perAr || 1) * 100).toFixed(0)}%;background:var(--up)"></i></span><b class="num">${sekBig(r.perAr)}</b></div>`).join('')}
      <div class="b-kv"><span>${EN ? 'Per month on average' : 'Per månad i snitt'}</span><b class="num">${sekBig(plan.total / 12)}</b></div>
      <div class="b-kv"><span>${EN ? 'Next report' : 'Nästa rapport'}</span><b class="num">${nr ? `${esc(ovName(nr.k.sym))} · ${esc(whenTxt(nr.dag))}` : miss()}</b></div>
      <div class="b-kv"><span>${EN ? 'Next dividend date' : 'Nästa utdelningsdag'}</span><b class="num">${nu ? `${esc(ovName(nu.k.sym))} · ${esc(whenTxt(nu.dag))}` : `<span class="faint">${EN ? 'Not decided' : 'Inte beslutad'}</span>`}</b></div>
      ${plan.utan.length ? `<p class="b-src">${EN ? 'No known dividend' : 'Ingen känd utdelning'}: ${esc(plan.utan.map(ovName).join(', '))}.</p>` : ''}`;
    const kmap = Object.fromEntries(kal.map((k) => [k.sym, k]));
    const hs = pd.hold.slice().sort((a, b) => (b.varde || 0) - (a.varde || 0));
    const dt = (d) => (d ? `<span class="${d < today ? 'faint' : ''}">${esc(bDate(d))}</span>` : '<span class="faint">–</span>');
    $('#pf-kalh').innerHTML = `<div class="p-tbl p-kal" role="table"><div class="p-tr p-th" role="row"><span>${EN ? 'Holding' : 'Innehav'}</span><span class="r">${EN ? 'Report' : 'Rapport'}</span><span class="r">${EN ? 'Ex-date' : 'X-dag'}</span><span class="r p-hide">${EN ? 'Payment' : 'Utbetalning'}</span><span class="r p-hide">${EN ? 'Per share' : 'Per aktie'}</span><span class="r p-hide">${EN ? 'Yield' : 'Direktavk.'}</span><span class="r">${EN ? 'Per year for you' : 'Per år för dig'}</span></div>
      ${hs.map((h) => { const k = kmap[h.sym]; const p = plan.rows.find((x) => x.k.sym === h.sym); return `<a class="p-tr" role="row" href="/bolag/${encodeURIComponent(h.sym)}?flik=kalender" data-link><span class="p-tn">${symFlag(h.sym)}<b>${esc(ovName(h.sym))}</b></span><span class="r num small">${k ? dt(k.rapport) : '–'}${k?.rapportUppskattad && k.rapport >= today ? `<span class="faint" style="display:block">${EN ? 'prelim.' : 'prel.'}</span>` : ''}</span><span class="r num small">${k ? dt(k.exUtdelning) : '–'}</span><span class="r num small p-hide">${k ? dt(k.utbetalning) : '–'}</span><span class="r num small p-hide">${k?.utdelningPerAktie ? `${kr(k.utdelningPerAktie)} ${esc(cur(k.valuta))}` : '<span class="faint">–</span>'}</span><span class="r num small p-hide">${k?.direktavkastning != null ? bPct(k.direktavkastning, 1) : '<span class="faint">–</span>'}</span><span class="r num">${p?.perAr != null ? sekBig(p.perAr) : `<span class="faint small">${EN ? 'none known' : 'ingen känd'}</span>`}</span></a>`; }).join('')}
      <div class="p-tr p-tot" role="row"><span><b>${EN ? 'Total' : 'Summa'}</b></span><span></span><span></span><span class="p-hide"></span><span class="p-hide"></span><span class="p-hide"></span><span class="r num"><b>${sekBig(plan.total)}</b></span></div></div>`;
  };

  /* ---- Export av alla köp ---- */
  const exportCsv = () => {
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`; const n = (v) => (v == null ? '' : String(Math.round(v * 10000) / 10000).replace('.', ','));
    const rows = [['Datum', 'Aktie', 'Ticker', 'Typ', 'Belopp', 'Valuta', 'Antal', 'Kurs', 'Kursvaluta', 'Insatt kr', 'Värde nu kr', 'Resultat kr'].map(q).join(';')];
    for (const b of (pd?.buys || port).slice().sort((a, c) => String(a.tid || '').localeCompare(String(c.tid || '')))) rows.push([b.tid ? fmtTid(b.tid) : '', ovName(b.sym), b.sym, 'Köp', n(b.belopp), b.valuta || '', n(b.antal), n(b.kurs), b.kursValuta || '', n(b.insattSek), n(b.varde), n(b.vinst)].map((x, i) => (i >= 4 && i !== 5 && i !== 8 ? x : q(x))).join(';'));
    const blob = new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `min-portfolj-${isoDay(Date.now())}.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  /* ---- Händelser ---- */
  const go = (k, focus) => { showTab(k); if (focus) setTimeout(() => { const el = $('#' + focus); if (!el) return; el.scrollIntoView({ block: 'center', behavior: 'smooth' }); if (el.matches('input')) el.focus(); }, 30); };
  $('.main').addEventListener('click', (e) => {
    const t = e.target.closest('[data-ptab]'); if (t) { showTab(t.dataset.ptab); return; }
    const g = e.target.closest('[data-pfgo]'); if (g && !(g.classList.contains('p-stat-btn') && e.target.closest('.b-stat-k'))) { go(g.dataset.pfgo, g.dataset.pffocus); return; }
    const o = e.target.closest('[data-pfopen]'); if (o) { open = open === o.dataset.pfopen ? null : o.dataset.pfopen; draw(); return; }
    const m = e.target.closest('[data-pfmore]'); if (m) { formFor(m.dataset.pfmore, nameOf(m.dataset.pfmore)); go('kop', 'pf-add-card'); return; }
    if (e.target.closest('[data-pfcancel]')) { $('#pf-form').innerHTML = ''; return; }
    if (e.target.closest('[data-pfcsv]')) { exportCsv(); return; }
    const d = e.target.closest('[data-pfdel]'); if (d) { const b = port.find((x) => x.id === d.dataset.pfdel); port = port.filter((x) => x.id !== d.dataset.pfdel); save(); toast('Köpet är borttaget', b ? nameOf(b.sym) : ''); draw(); return; }
    const r = e.target.closest('[data-pfrange]'); if (r) { range = r.dataset.pfrange; document.querySelectorAll('[data-pfrange]').forEach((x) => x.setAttribute('aria-selected', String(x === r))); timeline(); return; }
    if (e.target.closest('[data-pfidx]')) { cmpOn = !cmpOn; $('[data-pfidx]').setAttribute('aria-pressed', String(cmpOn)); timeline(); return; }
    const a = e.target.closest('[data-pfalloc]'); if (a) { alloc = a.dataset.pfalloc; document.querySelectorAll('[data-pfalloc]').forEach((x) => x.setAttribute('aria-selected', String(x === a))); drawAlloc(); return; }
    const sp = e.target.closest('[data-pfsp]'); if (sp) { stressF = Number(sp.dataset.pfsp); document.querySelectorAll('[data-pfsp]').forEach((x) => x.setAttribute('aria-selected', String(x === sp))); drawStress(); return; }
    const ns = e.target.closest('[data-pfnsort]'); if (ns) { nsort = ns.dataset.pfnsort; document.querySelectorAll('[data-pfnsort]').forEach((x) => x.setAttribute('aria-selected', String(x === ns))); drawNews(); return; }
    const nf2 = e.target.closest('[data-pfnf]'); if (nf2) { nfilt = nf2.dataset.pfnf; drawNews(); return; }
  });
  $('.main').addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('.p-stat-btn')) { e.preventDefault(); go(e.target.dataset.pfgo); } });
  draw();
}

// Tidslinje för pengar: värdet som yta och insatta pengar som streckad linje, med förklaring vid hovring
const holdMeta = (s, st) => ({
  poang: st?.poang ?? null, bransch: st?.fakta?.find((f) => f[0] === 'Bransch')?.[1] || (st?.typ === 'ETF' ? 'Fonder (ETF)' : 'Okänd bransch'),
  land: st?.fakta?.find((f) => f[0] === 'Land')?.[1] || (s.endsWith('.ST') ? 'Sverige' : 'Övriga'), typ: st?.typ, faktorer: st?.faktorer || []
});
// Portföljkollen, riskkollen för helheten och fördelning per bransch och land
function pfInsight(hold, tot, target, aiLink, noDist = false) {
  const sorted = hold.slice().sort((a, b) => (b.varde || 0) - (a.varde || 0));
    const group = (key) => { const m = {}; for (const h of hold) if (h.varde) m[h[key]] = (m[h[key]] || 0) + h.varde; return Object.entries(m).sort((a, b) => b[1] - a[1]); };
    const br = group('bransch'); const la = group('land');
    const top = sorted.find((h) => h.varde);
    const n = hold.filter((h) => h.varde).length;
    const etfShare = hold.filter((h) => h.typ === 'ETF' || h.typ === 'Fond').reduce((a, h) => a + (h.varde || 0), 0) / (tot || 1);
    const flags = [];
    if (top && tot && top.varde / tot > 0.25 && n > 1) flags.push(['warn', `${ovName(top.sym)} är ${nf((top.varde / tot) * 100, 0)} % av portföljen. Faller den aktien märks det mycket på helheten.`]);
    if (br[0] && tot && br[0][1] / tot > 0.5 && n > 1) flags.push(['warn', `${nf((br[0][1] / tot) * 100, 0)} % ligger i ${br[0][0].toLowerCase()}. Går det dåligt för branschen påverkas en stor del av dina pengar samtidigt.`]);
    if (n < 5 && etfShare < 0.5) flags.push(['warn', `Du har ${n} ${n === 1 ? 'innehav' : 'innehav'}. Med färre än fem bolag kan ett enskilt fall slå hårt. En bred fond är ett sätt många använder för att sprida risken.`]);
    const hog = hold.filter((h) => h.poang != null && h.poang >= 7 && h.varde).reduce((a, h) => a + h.varde, 0);
    if (tot && hog / tot > 0.3) flags.push(['warn', `${nf((hog / tot) * 100, 0)} % av pengarna ligger i aktier med hög riskkoll (7 eller mer).`]);
    const forlust = hold.filter((h) => h.vinst != null && h.insatt && h.vinst / h.insatt < -0.3);
    if (forlust.length) flags.push(['info', `${forlust.map((h) => ovName(h.sym)).join(', ')} har gått ner mer än 30 % sedan du köpte. Titta gärna på bolagssidan vad som hänt innan du bestämmer dig.`]);
    if (la[0] && tot && la[0][1] / tot > 0.9 && n >= 3) flags.push(['info', `Nästan allt ligger i ${la[0][0]}. Det är vanligt, men gör dig beroende av ett lands ekonomi och valuta.`]);
    if (!flags.length) flags.push(['ok', 'Bra spridning: inget enskilt bolag eller bransch dominerar portföljen.']);
    // Vilka riskdelar som väger tyngst i hela portföljen
    const delar = {};
    for (const h of hold) if (h.varde && tot) for (const f of h.faktorer) { const d = (delar[f[0]] = delar[f[0]] || { v: 0, w: 0 }); d.v += f[1] * h.varde; d.w += h.varde; }
    const delRows = Object.entries(delar).map(([k, d]) => [k, d.v / d.w]).sort((a, b) => b[1] - a[1]);
    const dist = (title, list) => `<section class="card co-section"><span class="label-up">${title}</span><div class="dist">${list.slice(0, 7).map(([k, v]) => `<div class="dist-row"><span>${esc(k)}</span>${bar((v / tot) * 100)}<span class="num small" style="width:44px;text-align:right">${nf((v / tot) * 100, 0)} %</span></div>`).join('')}</div></section>`;
  $(target).innerHTML = `
      <section class="card co-section"><span class="label-up">Portföljkollen</span><ul class="flags">${flags.map(([t, s]) => `<li class="flag ${t}">${svg(t === 'ok' ? 'check' : 'info', 16)}<span>${esc(s)}</span></li>`).join('')}</ul>
</section>
      ${delRows.length ? `<section class="card co-section"><span class="label-up">Riskkollen för hela portföljen</span>
        <p class="small muted" style="margin:0">Varje del vägd efter hur mycket pengar du har i bolagen. 1 är låg risk och 3 hög.</p>
        <div class="dist">${delRows.map(([k, v]) => `<div class="dist-row"><span>${esc(k)}${tip(k)}</span>${bar(((v - 1) / 2) * 100, v >= 2.4 ? 'hi' : v >= 1.7 ? 'mid' : 'lo')}<span class="small" style="width:56px;text-align:right">${v >= 2.4 ? 'Hög' : v >= 1.7 ? 'Medel' : 'Låg'}</span></div>`).join('')}</div></section>` : ''}
      ${noDist ? '' : dist('Fördelning per bransch', br)}
      ${noDist ? '' : dist('Fördelning per land', la)}`;
  return { br };
}

function drawMoneyChart(box, V, I, o = {}) {
  const inL = o.inLabel || 'Insatt';
  const W = 1000; const H = 300; const PAD = 10;
  const C = o.cmp?.length > 1 ? o.cmp : null;
  const all = [...V, ...I, ...(C || [])]; const t0 = V[0][0]; const t1 = V[V.length - 1][0];
  let lo = Math.min(...all.map((p) => p[1])); let hi = Math.max(...all.map((p) => p[1]));
  const pad = (hi - lo) * 0.1 || hi * 0.05 || 1; lo = Math.max(0, lo - pad); hi += pad;
  const X = (t) => ((t - t0) / (t1 - t0 || 1)) * W; const Y = (v) => PAD + (1 - (v - lo) / (hi - lo)) * (H - PAD * 2);
  const path = (pts) => pts.map(([t, v], i) => `${i ? 'L' : 'M'}${X(t).toFixed(1)},${Y(v).toFixed(1)}`).join('');
  const last = V[V.length - 1][1]; const lastI = I[I.length - 1][1]; const res = last - lastI;
  const startV = V[0][1]; const change = last - startV - (lastI - I[0][1]);
  const col = res >= 0 ? 'var(--up)' : 'var(--down)';
  const peak = V.reduce((a, p) => (p[1] > a[1] ? p : a), V[0]); const low = V.reduce((a, p) => (p[1] < a[1] ? p : a), V[0]);
  box.innerHTML = `
    <div class="chart-head"><span class="chart-key"><i style="background:${col}"></i>Värde <b class="num">${sekBig(last)}</b></span><span class="chart-key"><i class="dash"></i>${esc(inL)} <b class="num">${sekBig(lastI)}</b></span>${C ? `<span class="chart-key"><i class="cmp"></i>${esc(o.cmpLabel || 'Jämförelse')} <b class="num">${sekBig(C[C.length - 1][1])}</b></span>` : ''}<span class="chart-key">Utveckling i perioden <b class="num" style="color:var(--${tone(change)})">${change >= 0 ? '+' : '−'}${sekBig(Math.abs(change))}</b></span><span class="small muted" style="margin-left:auto">${esc(fmtDag(t0))} – ${esc(fmtDag(t1))}</span></div>
    <div class="chart-plot">
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Portföljens värde över tid">
        <defs><linearGradient id="pfg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity="0.18"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
        <path d="${path(V)}L${W},${H}L0,${H}Z" fill="url(#pfg)"/>
        <path d="${path(I)}" fill="none" stroke="var(--faint)" stroke-width="1.5" stroke-dasharray="6 5" vector-effect="non-scaling-stroke"/>
        ${C ? `<path d="${path(C)}" fill="none" stroke="var(--b-ma200)" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>` : ''}
        <path class="chart-line" d="${path(V)}" fill="none" stroke="${col}" stroke-width="2.2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
      </svg>
      <span class="chart-y top num">${esc(sekBig(hi - pad))}</span><span class="chart-y bottom num">${esc(sekBig(Math.max(0, lo + pad)))}</span>
      <span class="chart-cross" hidden></span><span class="chart-dot" hidden style="background:${col}"></span>
      <div class="chart-tip" hidden></div>
    </div>
    <div class="pf-tl-facts"><span class="small muted">Högst: <b class="num">${sekBig(peak[1])}</b> ${esc(fmtDag(peak[0]))}</span><span class="small muted">Lägst: <b class="num">${sekBig(low[1])}</b> ${esc(fmtDag(low[0]))}</span><span class="small faint">${esc(o.note || 'Streckad linje = pengar du satt in. Ytan = vad de var värda varje dag.')}</span></div>`;
  const plot = box.querySelector('.chart-plot'); const tipEl = box.querySelector('.chart-tip'); const cross = box.querySelector('.chart-cross'); const dot = box.querySelector('.chart-dot');
  let frame = 0; let lastX = 0;
  const move = () => {
    frame = 0; const r = plot.getBoundingClientRect(); const t = t0 + Math.min(1, Math.max(0, (lastX - r.left) / r.width)) * (t1 - t0);
    let i = 0; for (let j = 0; j < V.length; j++) if (Math.abs(V[j][0] - t) < Math.abs(V[i][0] - t)) i = j;
    const [tt, v] = V[i]; const inv = I[Math.min(i, I.length - 1)][1]; const px = (X(tt) / W) * r.width;
    cross.hidden = false; cross.style.transform = `translateX(${px}px)`;
    dot.hidden = false; dot.style.transform = `translate(${px}px, ${(Y(v) / H) * r.height}px)`;
    tipEl.hidden = false;
    tipEl.innerHTML = `<span class="small muted">${esc(fmtDag(tt))}</span><b class="num">Värde ${esc(sekBig(v))}</b><span class="small">${esc(inL)} ${esc(sekBig(inv))}</span><span class="small" style="color:${v - inv >= 0 ? '#8FD3A8' : '#F4A79D'}">${v - inv >= 0 ? '+' : '−'}${esc(sekBig(Math.abs(v - inv)))} (${pct(inv ? ((v - inv) / inv) * 100 : 0, 1)})</span>${C ? `<span class="small">${esc(o.cmpLabel || '')} ${esc(sekBig(C[Math.min(i, C.length - 1)][1]))}</span>` : ''}`;
    const tw = tipEl.offsetWidth; tipEl.style.transform = `translateX(${Math.min(r.width - tw, Math.max(0, px - tw / 2))}px)`;
  };
  plot.addEventListener('pointermove', (e) => { lastX = e.clientX; if (!frame) frame = requestAnimationFrame(move); });
  plot.addEventListener('pointerleave', () => { tipEl.hidden = true; cross.hidden = true; dot.hidden = true; });
}

// Övningsportföljen är borttagen. Sparad data finns kvar på kontot och tas inte bort.
const OKEY = 'mk-ova';

// Gamla sparade AI-konversationer tas bort från webbläsaren, chatten finns inte längre
try { for (const k of Object.keys(localStorage)) if (k.startsWith('mk-chattar-') || k === 'mk-chatt') localStorage.removeItem(k); sessionStorage.removeItem('mk-chatt'); sessionStorage.removeItem('mk-pf-sammanfattning'); } catch { /* privat läge */ }

/* ================= Konto (Supabase Auth via REST, utan extra bibliotek) ================= */
// Bevakning, larm och namn sparas i kontots användardata. Ingen databastabell behövs.
const ACC = { cfg: undefined, ai: false, session: readLS('mk-session', null), user: null };
const fullName = () => String(ACC.user?.user_metadata?.full_name || '').trim();
const firstName = () => fullName().split(/\s+/)[0] || '';
// Hela sidan kräver inloggning när Supabase är påslaget
const locked = () => !!ACC.cfg && !ACC.user;
async function accCfg() {
  if (ACC.cfg === undefined) {
    const c = await api('/api/config', 5 * 60e3);
    ACC.cfg = c?.supabase || false; ACC.ai = !!c?.ai; ACC.googleId = c?.google || null;
  }
  return ACC.cfg;
}
// Vilka inloggningssätt som är påslagna i Supabase. Google-knappen visas bara när Google är påslaget.
let PROVIDERS = null;
async function authProviders() {
  if (PROVIDERS) return PROVIDERS;
  const c = await accCfg(); if (!c) return {};
  try { const r = await fetch(c.url + '/auth/v1/settings', { headers: { apikey: c.anon } }); const j = await r.json(); PROVIDERS = j?.external || {}; } catch { PROVIDERS = {}; }
  return PROVIDERS;
}
async function googleLogin() {
  const c = await accCfg(); if (!c) return;
  writeLS('mk-oauth', 'google');
  location.href = `${c.url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(location.origin + '/konto')}`;
}
// Googles egen knapp (Google Identity Services). Rutan öppnas på finanskollen.live och inte på Supabase-adressen.
// Fungerar inte skriptet faller vi tillbaka på vanlig inloggning via Supabase.
let GIS = null;
function loadGis() {
  if (GIS) return GIS;
  GIS = new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = 'https://accounts.google.com/gsi/client'; sc.async = true; sc.onload = () => (window.google?.accounts?.id ? ok(window.google.accounts.id) : no(new Error('gis'))); sc.onerror = () => { GIS = null; no(new Error('gis')); }; document.head.append(sc); });
  return GIS;
}
const sha256hex = async (t) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))].map((b) => b.toString(16).padStart(2, '0')).join('');
async function mountGoogleButton(slot, mode, onMsg) {
  if (!ACC.googleId || !slot) return false;
  try {
    const gid = await loadGis(); if (!slot.isConnected) return true;
    const raw = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
    gid.initialize({
      client_id: ACC.googleId, nonce: await sha256hex(raw), ux_mode: 'popup', use_fedcm_for_button: true,
      callback: async (resp) => {
        onMsg('Loggar in …');
        try {
          const j = await auth('/token?grant_type=id_token', { provider: 'google', id_token: resp.credential, nonce: raw });
          setSession(j); ACC.user = j.user; await loadCloud();
          toast(`Välkommen${firstName() ? ', ' + firstName() : ''}!`, 'Du är inloggad med Google.'); goAfterLogin();
        } catch (err) { onMsg(authErr(err)); }
      }
    });
    slot.innerHTML = '';
    gid.renderButton(slot, { type: 'standard', theme: 'outline', size: 'large', shape: 'pill', text: mode === 'signup' ? 'signup_with' : 'signin_with', locale: EN ? 'en' : 'sv', width: Math.min(400, Math.max(220, Math.round(slot.getBoundingClientRect().width) || 320)) });
    return true;
  } catch { return false; }
}
const GOOGLE_G = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.2 5.6c4.2-3.9 7.1-9.6 7.1-17z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.2C1 16.4 0 20.1 0 24s1 7.6 2.6 10.9l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.2-5.6c-2 1.4-4.7 2.3-8.7 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.2C6.6 42.6 14.6 48 24 48z"/></svg>';
async function auth(path, body, method = 'POST', tok) {
  const c = await accCfg();
  if (!c) throw Object.assign(new Error('Inloggning är inte påslagen'), { code: 'off' });
  const res = await fetch(c.url + '/auth/v1' + path, {
    // Publika nycklar (sb_publishable_…) skickas bara som apikey. Inloggade anrop får dessutom sin egen token.
    method, headers: { apikey: c.anon, 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : c.anon.startsWith('eyJ') ? { authorization: 'Bearer ' + c.anon } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(j.msg || j.error_description || j.message || 'Något gick fel'), { code: j.error_code || j.code || j.error, status: res.status });
  return j;
}
function setSession(j) {
  ACC.session = j?.access_token ? { access: j.access_token, refresh: j.refresh_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 } : null;
  writeLS('mk-session', ACC.session);
  if (j?.user) ACC.user = j.user;
  if (!ACC.session) ACC.user = null;
}
let REFRESHING = null;
async function token() {
  const s = ACC.session; if (!s) return null;
  if (Date.now() < s.exp - 60e3) return s.access;
  // Ett förnyande åt gången. Bara ett nej från inloggningen loggar ut, inte ett nätverksfel.
  if (!REFRESHING) REFRESHING = auth('/token?grant_type=refresh_token', { refresh_token: s.refresh })
    .then((j) => { setSession(j); return j.access_token; })
    .catch((e) => { if (e?.status >= 400 && e?.status < 500) setSession(null); return null; })
    .finally(() => { REFRESHING = null; });
  return REFRESHING;
}
/* ---- Användardata: tabellen anvandardata i Supabase, med kontots metadata som reserv ---- */
// TABLE: true när tabellen finns, false när den saknas (då sparas allt i kontots metadata som förut).
ACC.table = null; ACC.veckobrev = false;
async function rest(path, { method = 'GET', body, prefer } = {}) {
  const c = await accCfg(); const t = await token(); if (!c || !t) throw Object.assign(new Error('ej inloggad'), { status: 401 });
  const res = await fetch(c.url + '/rest/v1/' + path, { method, headers: { apikey: c.anon, authorization: 'Bearer ' + t, 'content-type': 'application/json', ...(prefer ? { prefer } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const txt = await res.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch { /* tomt svar */ }
  if (!res.ok) throw Object.assign(new Error(j?.message || 'REST ' + res.status), { status: res.status, code: j?.code });
  return j;
}
const tableMissing = (e) => e?.status === 404 || e?.code === 'PGRST205' || e?.code === '42P01' || e?.code === 'PGRST106';
// Kontot är facit. Första gången på en enhet slås den lokala listan ihop med kontots.
async function loadCloud() {
  let d = null; let migrate = false;
  try {
    const rows = await rest(`anvandardata?select=data,veckobrev&user_id=eq.${encodeURIComponent(ACC.user.id)}`);
    ACC.table = true;
    if (rows?.length) { d = rows[0].data || {}; ACC.veckobrev = !!rows[0].veckobrev; } else migrate = true;
  } catch (e) { ACC.table = tableMissing(e) ? false : ACC.table; }
  if (!d) d = ACC.user?.user_metadata || {};
  applyCloud(d);
  if (!migrate && DIRTY.size) saveNow().catch(() => {});
  // Flytta data från metadata till tabellen en gång, och gör metadata liten igen
  if (migrate) { for (const f of Object.values(FIELD)) DIRTY.add(f); await saveNow().catch(() => {}); const t = await token(); if (t) auth('/user', { data: { bevakning: null, larm: null, portfolj: null, ova: null, namn: null } }, 'PUT', t).then((u) => { ACC.user = u; }).catch(() => {}); }
}
function applyCloud(d) {
  const skip = (f) => DIRTY.has(f); // en ändring här som inte hunnit sparas vinner
  const cloud = skip('bevakning') ? null : Array.isArray(d.bevakning) ? d.bevakning.filter((x) => typeof x === 'string') : null;
  const first = readLS('mk-sync-user', null) !== ACC.user.id;
  SYNCING = true;
  try {
    if (d.namn && typeof d.namn === 'object') writeLS(NKEY, { ...d.namn, ...readLS(NKEY, {}) });
    // Bara aktier man själv har lagt till slås ihop, inte startlistan med exempel
    const own = readLS(WKEY, null);
    if (cloud) writeLS(WKEY, first && Array.isArray(own) ? [...new Set([...cloud, ...own])].slice(0, 60) : cloud);
    if (!skip('larm') && d.larm && typeof d.larm === 'object') writeLS(LKEY, first ? { ...d.larm, ...getLarm() } : d.larm);
    if (!skip('koll') && d.koll && typeof d.koll === 'object') writeLS(KKEY, d.koll);
    if (first && getPort().some((b) => b.demo)) writeLS(PKEY, getPort().filter((b) => !b.demo));
    if (!skip('portfolj') && Array.isArray(d.portfolj)) {
      const own = getPort();
      if (!first || !own.length) writeLS(PKEY, d.portfolj);
      else { const ids = new Set(d.portfolj.map((b) => b.id)); const extra = own.filter((b) => !ids.has(b.id));
        writeLS(PKEY, [...d.portfolj, ...extra]); if (extra.length) DIRTY.add('portfolj'); }
    } else if (first && getPort().length) DIRTY.add('portfolj');
    if (!skip('ova') && d.ova && typeof d.ova.kassa === 'number' && (!first || !readLS(OKEY, null))) {
      // Behåll en längre lokal historik om den hör till samma övningsportfölj
      const loc = readLS(OKEY, null);
      const keep = loc && loc.start === d.ova.start && (loc.historik || []).length > (d.ova.historik || []).length && loc.historik[loc.historik.length - 1]?.t === d.ova.historik?.[d.ova.historik.length - 1]?.t;
      writeLS(OKEY, keep ? { ...d.ova, historik: loc.historik } : d.ova);
    }
  } finally { SYNCING = false; }
  for (const f of Object.values(FIELD)) if (!skip(f) && d[f] !== undefined) SNAP[f] = clone(d[f]);
  writeLS('mk-sync-user', ACC.user.id);
  if (first || (!cloud && !skip('bevakning'))) { for (const f of Object.values(FIELD)) DIRTY.add(f); saveCloud(); }
  ACC.loadedAt = Date.now();
}
let saveTimer;
const cloudData = () => {
  const watch = getWatch(); const port = getPort().filter((b) => !b.demo); const ova = readLS(OKEY, null);
  const syms = [...new Set([...watch, ...port.map((x) => x.sym), ...Object.keys(ova?.innehav || {})])];
  // Tabellen rymmer hela historiken. Kontots metadata hålls liten, därför bara de senaste 40 affärerna där.
  const hist = (ova?.historik || []).slice(ACC.table ? -1000 : -40);
  return { bevakning: watch, larm: getLarm(), koll: readLS(KKEY, {}), portfolj: port, ...(ova ? { ova: { ...ova, historik: hist } } : {}), namn: Object.fromEntries(syms.map((x) => [x, nameOf(x)])) };
};
async function saveNow() {
  if (!ACC.user) return;
  const fields = [...DIRTY]; if (!fields.length) return;
  const local = cloudData();
  let base = null;
  if (ACC.table) { const rows = await rest(`anvandardata?select=data&user_id=eq.${encodeURIComponent(ACC.user.id)}`); base = rows?.[0]?.data || null; }
  else { const t = await token(); if (!t) return; base = (await auth('/user', null, 'GET', t))?.user_metadata || null; }
  // Saknas data i kontot sparas allt. Annars bara de delar som ändrats här, resten lämnas som det är.
  const data = base ? { ...base } : { ...local };
  if (base) for (const f of fields) { const v = mergeField(f, base[f], local[f], SNAP[f]); if (v !== undefined) data[f] = v; else delete data[f]; }
  data.namn = { ...(base?.namn || {}), ...local.namn };
  if (ACC.table) await rest('anvandardata?on_conflict=user_id', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: { user_id: ACC.user.id, data, uppdaterad: new Date().toISOString() } });
  else { const t = await token(); if (!t) return; ACC.user = await auth('/user', { data }, 'PUT', t); }
  for (const f of fields) DIRTY.delete(f);
  // Visa det som andra flikar eller enheter sparat under tiden, ihopslaget med det man ändrat här
  applyCloud(data);
}
function saveCloud() {
  if (!ACC.user) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = null; saveNow().catch((e) => console.warn('Kunde inte spara till kontot', e.message)); }, 500);
}
// Spara direkt om man lämnar sidan, och hämta det senaste från kontot när man kommer tillbaka
document.addEventListener('visibilitychange', () => {
  if (!ACC.user) return;
  if (document.visibilityState === 'hidden') { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; saveNow().catch(() => {}); } return; }
  if (Date.now() - (ACC.loadedAt || 0) < 30e3 || DIRTY.size) return;
  const before = JSON.stringify([getWatch(), getPort()]);
  loadCloud().then(() => { if (JSON.stringify([getWatch(), getPort()]) !== before) render(); }).catch(() => {});
});
async function setVeckobrev(on) {
  if (!ACC.table) throw new Error('tabell saknas');
  const rows = await rest(`anvandardata?user_id=eq.${encodeURIComponent(ACC.user.id)}`, { method: 'PATCH', prefer: 'return=representation', body: { veckobrev: on, uppdaterad: new Date().toISOString() } });
  if (!rows?.length) await rest('anvandardata?on_conflict=user_id', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: { user_id: ACC.user.id, data: cloudData(), veckobrev: on, uppdaterad: new Date().toISOString() } });
  ACC.veckobrev = on;
}
async function bootAccount() {
  // Länkar från bekräftelse- och återställningsmejl kommer tillbaka med inloggningen i adressens #-del
  const h = new URLSearchParams(location.hash.slice(1));
  let recovery = false;
  if (h.get('access_token')) {
    setSession({ access_token: h.get('access_token'), refresh_token: h.get('refresh_token'), expires_in: h.get('expires_in') });
    recovery = h.get('type') === 'recovery';
    ACC.fromLink = !recovery;
    ACC.viaGoogle = readLS('mk-oauth', null) === 'google';
    history.replaceState(null, '', location.pathname + location.search);
  }
  try { localStorage.removeItem('mk-oauth'); } catch { /* privat läge */ }
  if (h.get('error_description')) { toast('Länken fungerade inte', h.get('error_description').replace(/\+/g, ' ')); history.replaceState(null, '', location.pathname + location.search); }
  if (!(await accCfg()) || !ACC.session) return;
  const t = await token(); if (!t) return;
  // Bekräftelselänken loggar in. Skicka vidare dit man var på väg.
  try { ACC.user = await auth('/user', null, 'GET', t); } catch (e) { if (e?.status === 401 || e?.status === 403) setSession(null); return; }
  await loadCloud();
  if (recovery) { history.replaceState(null, '', '/konto?nytt=1'); }
}

const AUTH_ERR = {
  invalid_credentials: 'Fel e-post eller lösenord.',
  email_not_confirmed: 'Du behöver bekräfta din e-post först. Klicka på länken i mejlet vi skickade.',
  user_already_exists: 'Det finns redan ett konto med den e-posten. Logga in i stället.',
  email_exists: 'Det finns redan ett konto med den e-posten. Logga in i stället.',
  weak_password: 'Lösenordet är för svagt. Använd minst 8 tecken.',
  over_email_send_rate_limit: 'För många mejl på kort tid. Vänta en stund och prova igen.',
  over_request_rate_limit: 'För många försök. Vänta en minut och prova igen.',
  validation_failed: 'Kontrollera e-postadressen.',
  same_password: 'Det nya lösenordet måste skilja sig från det gamla.'
};
// Efter inloggning: tillbaka till sidan man försökte öppna, annars översikten
function goAfterLogin() {
  let to = readLS('mk-efter-login', '/');
  try { localStorage.removeItem('mk-efter-login'); } catch { /* privat läge */ }
  if (typeof to !== 'string' || !to.startsWith('/') || to.startsWith('//') || to.startsWith('/konto') || to.startsWith('/valkommen')) to = '/';
  navigate(to);
}
const authErr = (e) => AUTH_ERR[e?.code] || (e?.status === 400 ? 'Kontrollera uppgifterna och prova igen.' : 'Det gick inte att nå inloggningen just nu.');

function viewKonto() {
  if (locked()) {
    return `<div class="auth-wrap">
      <div class="auth-top"><a class="auth-brand" href="/" data-link><span class="brand-mark">${svg('logo', 22, '#FFFFFF')}</span><span><b>Finanskollen</b><span class="small muted">Trygg börskoll</span></span></a>${langSwitch()}</div>
      <div class="auth-intro"><h1 class="title" style="font-size:clamp(30px,5vw,42px)">Börsen på enkel svenska</h1>
        <p class="muted" style="margin:0;font-size:16px">Skapa ett gratis konto för att bevaka aktier, få prislarm, följa din portfölj och öva med låtsaspengar. Riskkollen, nyheterna och alla aktier kan du se utan konto.</p></div>
      <div id="konto" class="auth-card">${loading('Hämtar …')}</div>
      <p class="small faint" style="margin:0;text-align:center">Ingen investeringsrådgivning. Data från Yahoo Finance, Finnhub och Finansinspektionen.</p>
      <p class="small" style="margin:0;text-align:center"><a href="/" data-link>← Till startsidan</a> · <a href="/om" data-link>Om oss</a> · <a href="/integritet" data-link>Så hanterar vi dina uppgifter</a> · <a href="/ordlista" data-link>Ordlista</a></p>
    </div>`;
  }
  return `
  ${topbar([['Översikt', '/'], [ACC.user ? 'Mitt konto' : 'Logga in', '/konto']])}
  <div class="stack" style="gap:6px">
    <span class="eyebrow">Spara din bevakning och dina prislarm på alla enheter</span>
    <h1 class="title">${ACC.user ? 'Mitt konto' : 'Logga in'}</h1>
  </div>
  <div id="konto" style="max-width:520px">${loading('Hämtar …')}</div>
  ${footer()}`;
}

async function mountKonto() {
  const box = $('#konto');
  const cfg = await accCfg();
  if (!$('#konto')) return;
  const params = new URLSearchParams(location.search);
  if (!cfg) {
    box.innerHTML = `<div class="card stack" style="gap:10px;padding:26px"><span class="label-up">Inte påslaget än</span><p style="margin:0">Inloggning är inte påslagen på sidan än. Din bevakning och dina larm sparas i den här webbläsaren så länge.</p><a class="btn ghost" href="/bevakning" data-link style="align-self:flex-start">Till bevakningen</a></div>`;
    return;
  }
  if (ACC.user && params.get('nytt')) {
    box.innerHTML = `<form class="card stack" style="gap:14px;padding:26px" data-newpw>
      <span class="label-up">Nytt lösenord</span>
      <label class="field"><span>Nytt lösenord</span><input name="password" type="password" minlength="8" required autocomplete="new-password"></label>
      <p class="small" role="status" data-msg></p>
      <button class="btn" type="submit">Spara lösenord</button></form>`;
    box.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault(); const msg = box.querySelector('[data-msg]');
      try { await auth('/user', { password: new FormData(e.target).get('password') }, 'PUT', await token()); history.replaceState(null, '', '/konto'); toast('Lösenordet är sparat', ''); render(); }
      catch (err) { msg.textContent = authErr(err); }
    });
    return;
  }
  if (ACC.user) {
    const n = getWatch().length; const l = Object.keys(getLarm()).length;
    box.innerHTML = `<div class="card stack" style="gap:16px;padding:26px">
      <div style="display:flex;align-items:center;gap:14px"><span class="avatar" style="width:52px;height:52px;font-size:16px">${firstName() ? esc(initials()) : svg('user', 22)}</span><div><div style="font-weight:500">${esc(fullName() || ACC.user.email)}</div><div class="small muted">${esc(ACC.user.email)}</div></div></div>
      <form class="stack" style="gap:8px" data-nameform><label class="field"><span>Namn</span><input name="name" type="text" maxlength="60" autocomplete="name" value="${esc(fullName())}" required></label><div style="display:flex;gap:10px;align-items:center"><button class="btn ghost small" type="submit">Spara namn</button><span class="small muted" data-namemsg role="status"></span></div></form>
      <div class="statbar" style="padding:0"><div class="stat"><span class="small muted">Bevakar</span><span class="num">${n} st</span></div><div class="stat"><span class="small muted">Prislarm</span><span class="num">${l} st</span></div></div>
      <p class="small muted" style="margin:0">Din bevakning och dina larm sparas på kontot och syns när du loggar in på mobilen eller datorn.</p>
      <div class="chips"><a class="btn" href="/bevakning" data-link>Till bevakningen</a><button class="btn ghost" type="button" data-logout>Logga ut</button>${installHTML()}</div></div>
    <div class="card stack" style="gap:12px;padding:22px 26px;margin-top:16px">
      <span class="label-up">Veckobrev</span>
      ${ACC.table ? `<label class="imp-opt"><input type="checkbox" data-veckobrev ${ACC.veckobrev ? 'checked' : ''}> Skicka ett mejl varje måndag morgon om hur mina aktier har gått och vad som händer veckan som kommer</label><p class="small muted" style="margin:0" data-vbmsg>Mejlet går till ${esc(ACC.user.email)}. Du kan stänga av det när du vill.</p>` : '<p class="small muted" style="margin:0">Veckobrevet går att slå på så snart det är aktiverat på sidan.</p>'}
    </div>
    <div class="card stack" style="gap:10px;padding:22px 26px;margin-top:16px">
      <span class="label-up">Dina uppgifter</span>
      <p class="small muted" style="margin:0">Vi sparar din e-post, ditt namn, din bevakning, dina prislarm och dina portföljer. <a href="/integritet" data-link>Läs mer</a></p>
      <button class="linkbtn small danger-link" type="button" data-delete>Radera mitt konto</button>
    </div>`;
    box.querySelector('[data-veckobrev]')?.addEventListener('change', async (e) => {
      const on = e.target.checked; const m = box.querySelector('[data-vbmsg]');
      try { await setVeckobrev(on); m.textContent = on ? `Klart! Första mejlet kommer på måndag till ${ACC.user.email}.` : 'Veckobrevet är avstängt.'; }
      catch { e.target.checked = !on; m.textContent = 'Det gick inte att spara just nu. Prova igen om en stund.'; }
    });
    box.querySelector('[data-delete]').addEventListener('click', () => confirmDelete(async () => {
      await deleteAccount();
      toast('Ditt konto är raderat', 'Tack för att du testade Finanskollen.');
      navigate('/konto');
    }));
    box.querySelector('[data-nameform]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = String(new FormData(e.target).get('name') || '').replace(/\s+/g, ' ').trim().slice(0, 60);
      const m = box.querySelector('[data-namemsg]');
      if (name.length < 2) { m.textContent = 'Skriv ditt namn.'; return; }
      try { ACC.user = await auth('/user', { data: { full_name: name } }, 'PUT', await token()); m.textContent = 'Sparat'; refreshNav('konto'); }
      catch (err) { m.textContent = authErr(err); }
    });
    box.querySelector('[data-logout]').addEventListener('click', async () => {
      const t = ACC.session?.access; setSession(null); writeLS('mk-sync-user', null);
      if (t) auth('/logout', null, 'POST', t).catch(() => {});
      toast('Du är utloggad', ''); navigate('/konto');
    });
    return;
  }
  let mode = params.get('ny') ? 'signup' : 'login';
  const draw = () => {
    box.innerHTML = `<form class="card stack" style="gap:14px;padding:26px" novalidate>
      <div class="tabs" role="tablist" aria-label="Logga in eller skapa konto" style="align-self:flex-start">
        <button type="button" role="tab" data-mode="login" aria-selected="${mode === 'login'}">Logga in</button>
        <button type="button" role="tab" data-mode="signup" aria-selected="${mode === 'signup'}">Skapa konto</button>
      </div>
      ${mode !== 'forgot' && PROVIDERS?.google ? `<div class="google-slot" data-gslot><button class="btn ghost google-btn" type="button" data-google>${GOOGLE_G}<span>${mode === 'signup' ? 'Skapa konto med Google' : 'Logga in med Google'}</span></button></div><div class="auth-or"><span>eller med e-post</span></div>` : ''}
      ${mode === 'signup' ? '<label class="field"><span>Namn</span><input name="name" type="text" required maxlength="60" autocomplete="name"></label>' : ''}
      <label class="field"><span>E-post</span><input name="email" type="email" required autocomplete="email" inputmode="email"></label>
      ${mode !== 'forgot' ? `<label class="field"><span>Lösenord${mode === 'signup' ? ' (minst 8 tecken)' : ''}</span><input name="password" type="password" minlength="${mode === 'signup' ? 8 : 1}" required autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}"></label>` : ''}
      <p class="small" role="status" data-msg style="margin:0;min-height:1em"></p>
      <button class="btn" type="submit">${mode === 'signup' ? 'Skapa konto' : mode === 'forgot' ? 'Skicka återställningslänk' : 'Logga in'}</button>
      ${mode === 'login' ? '<button class="linkbtn small" type="button" data-mode="forgot">Glömt lösenordet?</button>' : mode === 'forgot' ? '<button class="linkbtn small" type="button" data-mode="login">Tillbaka till inloggning</button>' : '<p class="small faint" style="margin:0">Vi sparar bara din e-post, din bevakning, dina larm och dina portföljer. Inga betaluppgifter.</p>'}
    </form>`;
    const f = box.querySelector('form');
    // Googles egen knapp ersätter vår när klient-ID finns. Annars ligger vår knapp kvar och går via Supabase.
    const gslot = f.querySelector('[data-gslot]');
    if (gslot && ACC.googleId) { const keep = gslot.innerHTML; mountGoogleButton(gslot, mode, (t) => { f.querySelector('[data-msg]').textContent = t; }).then((ok) => { if (!ok && gslot.isConnected) gslot.innerHTML = keep; }); }
    f.addEventListener('click', (e) => { if (e.target.closest('[data-google]')) { googleLogin(); return; } const b = e.target.closest('[data-mode]'); if (b) { mode = b.dataset.mode; draw(); } });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(f); const email = String(fd.get('email') || '').trim(); const password = String(fd.get('password') || '');
      const name = String(fd.get('name') || '').replace(/\s+/g, ' ').trim().slice(0, 60);
      if (mode === 'signup' && name.length < 2) { f.querySelector('[data-msg]').textContent = 'Skriv ditt namn.'; return; }
      const msg = f.querySelector('[data-msg]'); const btn = f.querySelector('[type=submit]');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { msg.textContent = 'Skriv en giltig e-postadress.'; return; }
      if (mode === 'signup' && password.length < 8) { msg.textContent = 'Lösenordet behöver minst 8 tecken.'; return; }
      btn.disabled = true; msg.textContent = 'Vänta …';
      const back = encodeURIComponent(location.origin + '/konto');
      try {
        if (mode === 'forgot') {
          await auth(`/recover?redirect_to=${back}`, { email });
          msg.textContent = 'Om det finns ett konto med den e-posten har vi skickat en länk för att välja nytt lösenord.';
        } else if (mode === 'signup') {
          const j = await auth(`/signup?redirect_to=${back}`, { email, password, data: { full_name: name } });
          if (j.access_token) { setSession(j); ACC.user = j.user; await loadCloud(); toast(`Välkommen, ${name.split(' ')[0]}!`, 'Ditt konto är skapat.'); goAfterLogin(); return; }
          f.innerHTML = `<div class="stack" style="gap:10px"><span class="label-up">Nästan klart</span><p style="margin:0;font-size:17px">Tack ${esc(name.split(' ')[0])}! Vi har skickat ett mejl till <b>${esc(email)}</b>.</p><p class="muted" style="margin:0">Klicka på länken i mejlet för att bekräfta din e-post. Då loggas du in automatiskt. Hittar du inte mejlet, titta i skräpposten.</p></div>`;
          return;
        } else {
          const j = await auth('/token?grant_type=password', { email, password });
          setSession(j); ACC.user = j.user; await loadCloud();
          toast(`Välkommen tillbaka${firstName() ? ', ' + firstName() : ''}!`, ''); goAfterLogin(); return;
        }
      } catch (err) { msg.textContent = authErr(err); }
      btn.disabled = false;
    });
  };
  draw();
  // Visa Google-knappen när vi vet att Google är påslaget
  if (!PROVIDERS) authProviders().then((p) => { if (p.google && box.isConnected && !box.querySelector('[data-google]') && mode !== 'forgot' && box.querySelector('form [data-mode]')) draw(); });
}

/* ================= Notiser och prislarm ================= */
function toast(title, body = '', href = null) {
  let wrap = $('#toasts');
  if (!wrap) { wrap = document.createElement('div'); wrap.id = 'toasts'; wrap.setAttribute('aria-live', 'polite'); document.body.append(wrap); }
  const t = document.createElement(href ? 'a' : 'div');
  t.className = 'toast'; if (href) { t.href = href; t.dataset.link = ''; }
  t.innerHTML = `<b>${esc(title)}</b>${body ? `<span>${esc(body)}</span>` : ''}`;
  wrap.append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 6500);
}
const initials = () => fullName().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('');
const notifyState = () => (!('Notification' in window) ? 'unsupported' : Notification.permission);
async function askNotify() {
  if (notifyState() !== 'default') return notifyState();
  try { return await Notification.requestPermission(); } catch { return notifyState(); }
}

/* ================= Dina aktier: dagens koll, kalender, utdelning och larm ================= */
const getKoll = () => { const v = readLS(KKEY, {}); return v && typeof v === 'object' ? v : {}; };
const mySyms = () => { const port = [...new Set(getPort().map((x) => x.sym))]; return { port, all: [...new Set([...port, ...getWatch()])] }; };
const dayMs = 864e5;
const isoDay = (d) => new Date(d).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
const fmtDayShort = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString(L, { weekday: 'short', day: 'numeric', month: 'short' });
const daysTo = (iso) => Math.round((new Date(iso + 'T12:00:00') - new Date(isoDay(Date.now()) + 'T12:00:00')) / dayMs);
const whenTxt = (iso) => { const n = daysTo(iso); return n === 0 ? 'I dag' : n === 1 ? 'I morgon' : n > 1 && n < 7 ? `Om ${n} dagar` : fmtDayShort(iso); };
async function getKalender(syms) {
  const r = await Promise.all(syms.slice(0, 30).map((s) => api('/api/kalender?s=' + encodeURIComponent(s), 6 * 60 * 60e3)));
  return r.filter((x) => x && !x.error && x.sym);
}
// Kommande händelser för en lista med kalenderdata: rapporter och utdelningsdagar
function events(kal, fromDays = 0, toDays = 90) {
  const out = [];
  for (const k of kal) {
    const add = (dag, typ) => { if (!dag) return; const n = daysTo(dag); if (n >= fromDays && n <= toDays) out.push({ dag, typ, k }); };
    add(k.rapport, 'rapport'); add(k.exUtdelning, 'ex'); add(k.utbetalning, 'utbet');
  }
  return out.sort((a, b) => a.dag.localeCompare(b.dag));
}
const EVT = { rapport: ['Rapport', ''], ex: ['X-dag, handlas utan utdelning', 'warn'], utbet: ['Utdelning betalas ut', 'up'] };
const evtLabel = (e) => EVT[e.typ][0] + (e.typ === 'rapport' && e.k.rapportUppskattad ? ' (uppskattat datum)' : '');
// Insyn och blankning för ett svenskt bolag, med bolagets namn från bolagsdatan
async function getFI(sym) {
  if (!isSwedish(sym)) return null;
  const st = await getStock(sym); if (!st || st.error || !st.namn) return null;
  const q = encodeURIComponent(st.namn);
  const [ins, bl] = await Promise.all([api('/api/insyn?namn=' + q, 60 * 60e3), api('/api/blankning?namn=' + q, 60 * 60e3)]);
  return { sym, namn: st.namn, affarer: Array.isArray(ins?.affarer) ? ins.affarer.filter((a) => a.typ === 'Köp' || a.typ === 'Sälj') : [], valuta: ins?.valuta || 'SEK', blank: bl?.bolag || null };
}
const tradeTxt = (a) => `${a.person || 'Okänd'}${a.roll ? ` (${a.roll})` : ''} ${a.typ === 'Köp' ? 'köpte' : 'sålde'}${a.varde ? ` för ${mny(a.varde, a.valuta || 'SEK')}` : ''}`;

// Kortet "Dagens koll" på översikten
async function drawKoll(quotes) {
  const box = $('#koll'); if (!box) return;
  const { port, all } = mySyms();
  if (!all.length) { box.innerHTML = ''; return; }
  box.innerHTML = `<section class="card koll" aria-labelledby="koll-h"><div class="section-head" style="align-items:center"><div><span class="label-up">Dagens koll</span><h2 class="section" id="koll-h" style="margin-top:4px;font-size:24px">Det här händer i dina aktier</h2></div><a class="more small" href="/portfolj?flik=kalender" data-link>Kalender →</a></div>
    <div class="koll-grid"><div class="koll-col" id="koll-move"></div><div class="koll-col" id="koll-cal">${loading('Hämtar kalendern …')}</div><div class="koll-col" id="koll-fi">${loading('Hämtar från Finansinspektionen …')}</div></div></section>`;
  // 1. Störst rörelse i dag
  const moves = all.map((s) => ({ s, q: quotes[s] })).filter((x) => x.q?.d1 != null).sort((a, b) => Math.abs(b.q.d1) - Math.abs(a.q.d1)).slice(0, 4);
  $('#koll-move').innerHTML = `<h3 class="koll-h">${svg('chart', 16)} Rör sig mest i dag</h3>${moves.length ? moves.map((x) => `<a class="koll-row" href="/bolag/${encodeURIComponent(x.s)}" data-link>${av(x.s)}<span class="grow"><b>${esc(nameOf(x.s))}</b><span class="small muted">${esc(kr(x.q.kurs))} ${esc(cur(x.q.valuta))}${port.includes(x.s) ? ' · i din portfölj' : ''}</span></span><span class="pill ${tone(x.q.d1)}">${pct(x.q.d1, 1)}</span></a>`).join('') : '<p class="small muted" style="margin:0">Inga kurser just nu.</p>'}`;
  // 2. Rapporter och utdelningar de närmaste två veckorna
  getKalender(all).then((kal) => {
    const b = $('#koll-cal'); if (!b) return;
    const ev = events(kal, 0, 14).slice(0, 5);
    b.innerHTML = `<h3 class="koll-h">${svg('calendar', 16)} Kommer snart</h3>${ev.length ? ev.map((e) => `<a class="koll-row" href="/bolag/${encodeURIComponent(e.k.sym)}" data-link><span class="koll-date"><b>${esc(whenTxt(e.dag))}</b></span><span class="grow"><b>${esc(nameOf(e.k.sym))}</b><span class="small muted">${esc(evtLabel(e))}</span></span></a>`).join('') : '<p class="small muted" style="margin:0">Inga rapporter eller utdelningar de närmaste två veckorna.</p>'}`;
  });
  // 3. Ledningens affärer och blankning i dina svenska bolag
  const se = all.filter(isSwedish).slice(0, 8);
  if (!se.length) { $('#koll-fi').innerHTML = `<h3 class="koll-h">${svg('info', 16)} Ledning och blankning</h3><p class="small muted" style="margin:0">Finansinspektionens register gäller svenska bolag. Bevaka en svensk aktie så visar vi vad ledningen gör.</p>`; return; }
  const fi = (await Promise.all(se.map((s) => getFI(s).catch(() => null)))).filter(Boolean);
  const b = $('#koll-fi'); if (!b) return;
  const since = isoDay(Date.now() - 14 * dayMs);
  const trades = fi.flatMap((f) => f.affarer.filter((a) => String(a.datum) >= since).map((a) => ({ ...a, sym: f.sym }))).sort((a, z) => String(z.datum).localeCompare(String(a.datum))).slice(0, 4);
  const shorts = fi.filter((f) => f.blank?.summa >= 1).sort((a, z) => z.blank.summa - a.blank.summa).slice(0, 2);
  b.innerHTML = `<h3 class="koll-h">${svg('info', 16)} Ledning och blankning</h3>${trades.map((a) => `<a class="koll-row" href="/bolag/${encodeURIComponent(a.sym)}" data-link>${tradePill(a.typ)}<span class="grow"><b>${esc(nameOf(a.sym))}</b><span class="small muted">${esc(tradeTxt(a))} · ${esc(dag(a.datum))}</span></span></a>`).join('')}${shorts.map((f) => `<a class="koll-row" href="/bolag/${encodeURIComponent(f.sym)}" data-link><span class="pill ${f.blank.summa >= 5 ? 'down' : f.blank.summa >= 2 ? 'warn' : ''}">${nf(f.blank.summa, 2)} %</span><span class="grow"><b>${esc(nameOf(f.sym))}</b><span class="small muted">av aktierna är blankade</span></span></a>`).join('')}${!trades.length && !shorts.length ? '<p class="small muted" style="margin:0">Inga insynsaffärer de senaste två veckorna och ingen större blankning i dina svenska bolag.</p>' : ''}`;
}

// Larm när ledningen handlar eller blankningen ökar. Körs när sidan är öppen.
let kollRunning = false;
async function checkKoll() {
  if (kollRunning || locked() || ACC.cfg === undefined || !ACC.user) return; kollRunning = true;
  try {
    const k = getKoll(); const insynOn = k.insynLarm !== false; const blankOn = k.blankLarm !== false;
    if (!insynOn && !blankOn) return;
    const se = mySyms().all.filter(isSwedish).slice(0, 10); if (!se.length) return;
    const fi = (await Promise.all(se.map((s) => getFI(s).catch(() => null)))).filter(Boolean);
    const seen = new Set(k.sett || []); const firstRun = !k.sett; const blank = { ...(k.blank || {}) };
    const since = isoDay(Date.now() - 7 * dayMs); const nyaSett = [];
    for (const f of fi) {
      for (const a of f.affarer) {
        if (String(a.datum) < since) continue;
        const id = [f.sym, a.datum, a.person, a.typ, a.volym].join('|'); nyaSett.push(id);
        if (!firstRun && insynOn && !seen.has(id)) showNotice(`Insynsaffär i ${nameOf(f.sym)}`, `${tradeTxt(a)}.`, '/bolag/' + encodeURIComponent(f.sym));
      }
      const now = f.blank?.summa ?? 0; const prev = blank[f.sym];
      if (blankOn && prev != null && now - prev >= 0.5) showNotice(`Blankningen ökar i ${nameOf(f.sym)}`, `Nu är ${nf(now, 2)} % av aktierna blankade, upp från ${nf(prev, 2)} %.`, '/bolag/' + encodeURIComponent(f.sym));
      blank[f.sym] = now;
    }
    writeLS(KKEY, { ...getKoll(), sett: [...new Set([...nyaSett, ...seen])].slice(0, 300), blank });
  } finally { kollRunning = false; }
}
const kollSettings = () => { const k = getKoll(); return `<div class="koll-set"><label><input type="checkbox" data-kollset="insynLarm" ${k.insynLarm !== false ? 'checked' : ''}> Larma när ledningen köper eller säljer i dina svenska aktier</label><label><input type="checkbox" data-kollset="blankLarm" ${k.blankLarm !== false ? 'checked' : ''}> Larma när blankningen ökar med minst 0,5 procentenheter</label></div>`; };
document.addEventListener('change', (e) => { const c = e.target.closest?.('[data-kollset]'); if (!c) return; writeLS(KKEY, { ...getKoll(), [c.dataset.kollset]: c.checked }); toast(c.checked ? 'Larmet är på' : 'Larmet är av', ''); });

/* ---- Kalendersidan ---- */
// Väntad utdelning per år för portföljen, i kronor
async function dividendPlan(kal) {
  const port = getPort(); const per = {};
  for (const p of port) per[p.sym] = (per[p.sym] || 0) + p.antal;
  const rows = kal.filter((k) => per[k.sym] && k.utdelningPerAktie);
  const fx = await fxToSek(rows.map((k) => k.valuta || 'SEK'));
  const out = rows.map((k) => { const r = fx[k.valuta || 'SEK'] ?? null; return { k, antal: per[k.sym], perAr: r != null ? per[k.sym] * k.utdelningPerAktie * r : null }; }).sort((a, b) => (b.perAr || 0) - (a.perAr || 0));
  return { rows: out, total: out.reduce((s, x) => s + (x.perAr || 0), 0), utan: Object.keys(per).filter((s) => !rows.some((x) => x.sym === s)) };
}
function notifyBar() {
  const st = notifyState(); const any = Object.keys(getLarm()).length;
  const txt = st === 'granted' ? 'Notiser är på. Du får en notis när en aktie rör sig mer än gränsen du valt, så länge sidan är öppen i en flik.'
    : st === 'denied' ? 'Notiser är blockerade i webbläsaren. Larmen visas ändå här på sidan. Du kan tillåta notiser i webbläsarens inställningar för sidan.'
    : st === 'unsupported' ? 'Din webbläsare stöder inte notiser. Larmen visas här på sidan. På iPhone fungerar notiser när sidan är tillagd på hemskärmen.'
    : 'Välj en gräns under Prislarm, så säger vi till när aktien rör sig mer än så under dagen.';
  return `${kollSettings()}<div class="notify-bar">${svg('bell', 18)}<span class="grow small">${txt}</span>${st === 'default' && any ? '<button class="btn small" type="button" data-notify>Slå på notiser</button>' : ''}</div>${any && isIOS() && !isStandalone() ? installHTML() : ''}`;
}
async function showNotice(title, body, href) {
  title = trS(title); body = trS(body); // notiser ligger utanför sidan och översätts här
  toast(title, body, href);
  if (notifyState() !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg) { await reg.showNotification(title, { body, tag: href, data: { href } }); return; }
    const n = new Notification(title, { body, tag: href });
    n.onclick = () => { window.focus(); navigate(href); n.close(); };
  } catch { /* toasten räcker */ }
}
let checking = false;
async function checkAlarms() {
  if (checking || locked() || ACC.cfg === undefined) return; checking = true;
  try {
    const larm = getLarm(); const watch = getWatch();
    const syms = Object.keys(larm).filter((x) => larm[x] > 0 && watch.includes(x));
    if (!syms.length) return;
    for (const x of syms) memo.delete('/api/quote?s=' + encodeURIComponent(x));
    const q = await getQuotes(syms);
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
    const sent = readLS('mk-larm-skickat', {});
    for (const k of Object.keys(sent)) if (!k.startsWith(today)) delete sent[k];
    for (const x of syms) {
      const d1 = q[x]?.d1; if (d1 == null || !q[x].idag || Math.abs(d1) < larm[x]) continue;
      const key = `${today}|${x}|${d1 < 0 ? 'ner' : 'upp'}`; if (sent[key]) continue;
      sent[key] = 1;
      showNotice(`${nameOf(x)} är ${d1 < 0 ? 'ner' : 'upp'} ${pct(Math.abs(d1), 1).replace('+', '')} i dag`, `Ditt larm är satt på ± ${larm[x]} %. Senaste kurs ${kr(q[x].kurs)}.`, '/bolag/' + encodeURIComponent(x));
    }
    try { localStorage.setItem('mk-larm-skickat', JSON.stringify(sent)); } catch { /* privat läge */ }
  } finally { checking = false; }
}

/* ================= Kursdiagram ================= */
const chartMemo = new Map();
async function mountChart(sym, range) {
  const box = $('#chart'); if (!box) return;
  box.dataset.range = range;
  if (!box.querySelector('svg')) box.innerHTML = loading('Hämtar kurser …');
  else box.classList.add('is-loading');
  const d = await api(`/api/chart?s=${encodeURIComponent(sym)}&r=${range}`, 10 * 60e3);
  if (!$('#chart') || box.dataset.range !== range) return;
  box.classList.remove('is-loading');
  if (!d || d.error || !d.punkter?.length) { box.innerHTML = `<p class="muted" style="margin:0">${d?.error ? esc(errText(d)) : 'Det finns inget kursdiagram för det här värdepappret.'}</p>`; return; }
  drawChart(box, [{ punkter: d.punkter, namn: nameOf(sym) }], { valuta: d.valuta, range });
}

// Ritar ett eller två linjediagram i en SVG. Med två serier visas förändring i procent så att de går att jämföra.
function drawChart(box, series, { valuta = '', range = '1y', relative = false } = {}) {
  const W = 1000; const H = 300; const PAD = 8;
  const rel = relative || series.length > 1;
  const S = series.map((s) => {
    const base = s.punkter[0][1];
    return { ...s, v: s.punkter.map(([t, c]) => [t, rel ? (c / base - 1) * 100 : c]) };
  });
  const all = S.flatMap((s) => s.v);
  const t0 = Math.min(...all.map((p) => p[0])); const t1 = Math.max(...all.map((p) => p[0]));
  let lo = Math.min(...all.map((p) => p[1])); let hi = Math.max(...all.map((p) => p[1]));
  const pad = (hi - lo) * 0.08 || 1; lo -= pad; hi += pad;
  const X = (t) => ((t - t0) / (t1 - t0 || 1)) * W;
  const Y = (v) => PAD + (1 - (v - lo) / (hi - lo)) * (H - PAD * 2);
  const COL = ['var(--ink)', '#3D63DD'];
  const ch = (s) => s.v[s.v.length - 1][1] - (rel ? 0 : s.v[0][1]);
  const one = S.length === 1;
  const colorOf = (s, i) => (one ? (ch(s) >= 0 ? 'var(--up)' : 'var(--down)') : COL[i]);
  const path = (s) => s.v.map(([t, v], i) => `${i ? 'L' : 'M'}${X(t).toFixed(1)},${Y(v).toFixed(1)}`).join('');
  const fmtV = (v) => (rel ? pct(v, 1) : kr(v));
  const fmtD = (t) => new Date(t * 1000).toLocaleDateString(L, { day: 'numeric', month: 'short', year: range === '1m' || range === '6m' ? undefined : 'numeric', timeZone: 'Europe/Stockholm' });
  const zero = rel && lo < 0 && hi > 0 ? `<line x1="0" x2="${W}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}" stroke="var(--line)" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/>` : '';
  box.innerHTML = `
    <div class="chart-head">${S.map((s, i) => `<span class="chart-key"><i style="background:${colorOf(s, i)}"></i>${esc(s.namn)} <b class="num" style="color:var(--${ch(s) >= 0 ? 'up' : 'down'})">${pct(rel ? ch(s) : (s.v[s.v.length - 1][1] / s.v[0][1] - 1) * 100, 1)}</b></span>`).join('')}<span class="small muted" style="margin-left:auto">${esc(fmtD(t0))} – ${esc(fmtD(t1))}</span></div>
    <div class="chart-plot">
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Kursdiagram ${esc(S.map((s) => s.namn).join(' och '))}">
        <defs>${S.map((s, i) => `<linearGradient id="cg${i}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${colorOf(s, i)}" stop-opacity="${one ? 0.16 : 0}"/><stop offset="1" stop-color="${colorOf(s, i)}" stop-opacity="0"/></linearGradient>`).join('')}</defs>
        ${zero}
        ${S.map((s, i) => `${one ? `<path d="${path(s)}L${W},${H}L0,${H}Z" fill="url(#cg${i})"/>` : ''}<path class="chart-line" d="${path(s)}" fill="none" stroke="${colorOf(s, i)}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>`).join('')}
      </svg>
      <span class="chart-y top num">${esc(fmtV(hi - pad))}</span><span class="chart-y bottom num">${esc(fmtV(lo + pad))}</span>
      <span class="chart-cross" hidden></span>${S.map((s, i) => `<span class="chart-dot" data-i="${i}" hidden style="background:${colorOf(s, i)}"></span>`).join('')}
      <div class="chart-tip" hidden></div>
    </div>
    ${rel ? '<p class="small faint" style="margin:8px 0 0">Visar förändring i procent från periodens början, så att olika kurser går att jämföra.</p>' : valuta ? `<p class="small faint" style="margin:8px 0 0">Stängningskurser i ${esc(cur(valuta) === 'kr' ? 'kronor' : valuta)}. Historisk utveckling säger inget om framtiden.</p>` : ''}`;
  const plot = box.querySelector('.chart-plot'); const tip = box.querySelector('.chart-tip'); const cross = box.querySelector('.chart-cross');
  const dots = [...box.querySelectorAll('.chart-dot')];
  const near = (s, t) => { let b = s.v[0]; for (const p of s.v) { if (Math.abs(p[0] - t) < Math.abs(b[0] - t)) b = p; } return b; };
  let frame = 0; let lastX = 0;
  const move = () => {
    frame = 0;
    const r = plot.getBoundingClientRect(); const fx = Math.min(1, Math.max(0, (lastX - r.left) / r.width));
    const t = t0 + fx * (t1 - t0);
    const pts = S.map((s) => near(s, t));
    const px = (X(pts[0][0]) / W) * r.width;
    cross.hidden = false; cross.style.transform = `translateX(${px}px)`;
    dots.forEach((d, i) => { d.hidden = false; d.style.transform = `translate(${(X(pts[i][0]) / W) * r.width}px, ${(Y(pts[i][1]) / H) * r.height}px)`; });
    tip.hidden = false;
    tip.innerHTML = `<span class="small muted">${esc(fmtD(pts[0][0]))}</span>${pts.map((p, i) => `<b class="num">${S.length > 1 ? `<i style="background:${colorOf(S[i], i)}"></i>` : ''}${esc(fmtV(p[1]))}</b>`).join('')}`;
    const tw = tip.offsetWidth; tip.style.transform = `translateX(${Math.min(r.width - tw, Math.max(0, px - tw / 2))}px)`;
  };
  plot.addEventListener('pointermove', (e) => { lastX = e.clientX; if (!frame) frame = requestAnimationFrame(move); });
  plot.addEventListener('pointerleave', () => { tip.hidden = true; cross.hidden = true; dots.forEach((d) => { d.hidden = true; }); });
}

/* ================= AI-sammanfattning ================= */
async function aiSummary(sym, namn) {
  await accCfg();
  const box = $('#ai-sum'); if (!box || !ACC.ai) return;
  box.innerHTML = `<div class="ai-box">${loading('AI sammanfattar nyheterna …')}</div>`;
  const d = await api(`/api/summary?s=${encodeURIComponent(sym)}&namn=${encodeURIComponent(namn)}${EN ? '&lang=en' : ''}`, 60 * 60e3);
  if (!$('#ai-sum')) return;
  if (!d?.punkter?.length) { box.innerHTML = ''; return; }
  box.innerHTML = `<div class="ai-box"><span class="label-up">AI-sammanfattning på svenska</span>
    <ul class="ai-text">${d.punkter.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
    <span class="small faint">Skriven av AI utifrån ${d.antalNyheter} rubriker. Kan innehålla fel, läs gärna artiklarna själv. Inget råd.</span></div>`;
}

/* ================= Jämför två bolag ================= */
function viewJamfor() {
  return `
  ${topbar([['Översikt', '/'], ['Jämför', '/jamfor']])}
  <div class="stack" style="gap:6px">
    <span class="eyebrow">Välj två aktier eller fonder och se dem sida vid sida</span>
    <h1 class="title">Jämför två bolag</h1>
  </div>
  <div class="grid g2" id="pickers">
    ${['a', 'b'].map((k, i) => `
    <div class="card picker" data-slot="${k}">
      <span class="label-up">${i ? 'Andra' : 'Första'} bolaget</span>
      <div class="picked" data-picked></div>
      <form class="searchbar" role="search" style="flex:none;max-width:none" data-pickform>
        ${svg('search', 18, '#6B6F76')}
        <label class="sr-only" for="pick-${k}">Sök ${i ? 'andra' : 'första'} bolaget</label>
        <input id="pick-${k}" type="search" placeholder="Till exempel Volvo eller Apple" autocomplete="off">
      </form>
      <div class="pick-results" data-results></div>
    </div>`).join('')}
  </div>
  <div id="jamfor-res"></div>
  ${footer()}`;
}

function mountJamfor(params) {
  const sel = { a: cleanSym(params.get('a')), b: cleanSym(params.get('b')) };
  const sync = () => { const p = new URLSearchParams(); if (sel.a) p.set('a', sel.a); if (sel.b) p.set('b', sel.b); history.replaceState(null, '', '/jamfor' + (p.toString() ? '?' + p : '')); };
  const showPicked = () => {
    for (const k of ['a', 'b']) {
      const c = $(`[data-slot="${k}"] [data-picked]`); if (!c) continue;
      c.innerHTML = sel[k] ? `${av(sel[k])}<span class="grow"><b style="display:block;font-weight:500">${esc(nameOf(sel[k]))}</b><span class="small muted">${esc(sel[k])}</span></span><button class="btn ghost small" type="button" data-clear="${k}">Byt</button>` : '<span class="muted">Inget valt än</span>';
    }
  };
  for (const k of ['a', 'b']) {
    const card = $(`[data-slot="${k}"]`); const input = card.querySelector('input'); const list = card.querySelector('[data-results]');
    let timer;
    const search = async () => {
      const term = input.value.trim(); if (term.length < 2) { list.innerHTML = ''; return; }
      const r = await api('/api/search?q=' + encodeURIComponent(term), 60 * 60e3);
      if (term !== input.value.trim()) return;
      list.innerHTML = (r?.results || []).slice(0, 6).map((x) => `<button type="button" class="pick" data-sym="${esc(x.sym)}" data-namn="${esc(x.klass ? `${x.namn}, ${x.typ}` : x.namn)}">${av(x.sym)}<span class="grow" style="text-align:left"><span style="display:block;font-weight:500">${esc(x.namn)}</span><span class="small muted">${esc([x.typ, x.sym].filter(Boolean).join(' · '))}</span></span></button>`).join('') || (r?.results ? '<p class="small muted">Inga träffar.</p>' : `<p class="small muted">${esc(errText(r))}</p>`);
    };
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(search, 300); });
    card.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); const f = list.querySelector('.pick'); if (f) f.click(); else search(); });
    card.addEventListener('click', (e) => {
      const p = e.target.closest('.pick');
      if (p) { sel[k] = p.dataset.sym; rememberName(p.dataset.sym, p.dataset.namn); input.value = ''; list.innerHTML = ''; sync(); showPicked(); compare(); return; }
      if (e.target.closest('[data-clear]')) { sel[k] = null; sync(); showPicked(); compare(); input.focus(); }
    });
  }
  showPicked();
  const compare = async () => {
    const box = $('#jamfor-res'); if (!box) return;
    if (!sel.a || !sel.b) { box.innerHTML = `<div class="empty">Välj ${!sel.a && !sel.b ? 'två bolag' : 'ett bolag till'} ovanför för att jämföra.</div>`; return; }
    if (sel.a === sel.b) { box.innerHTML = '<div class="empty">Välj två olika värdepapper.</div>'; return; }
    box.innerHTML = loading('Hämtar båda bolagen …');
    const [A, B, ca, cb] = await Promise.all([getStock(sel.a), getStock(sel.b), api(`/api/chart?s=${encodeURIComponent(sel.a)}&r=1y`, 10 * 60e3), api(`/api/chart?s=${encodeURIComponent(sel.b)}&r=1y`, 10 * 60e3)]);
    if (!$('#jamfor-res')) return;
    showPicked();
    const CMP = [A, B];
    const bad = CMP.find((x) => x.error);
    if (bad) { box.innerHTML = `<div class="empty">${esc(errText(bad.error))}</div>`; return; }
    const head = CMP.map((s) => `<div class="card stack cmp-head" style="gap:10px">
        <span class="label-up">${esc(s.lista || s.sym)}</span>
        <a href="/bolag/${encodeURIComponent(s.sym)}" data-link style="color:inherit;text-decoration:none;font-size:22px;font-weight:500;line-height:1.2">${esc(s.namn)}</a>
        <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><span class="num" style="font-size:28px">${s.kurs != null ? kr(s.kurs) : '–'} <span class="muted" style="font-size:14px">${esc(cur(s.valuta))}</span></span>${s.d1 != null ? `<span class="pill ${tone(s.d1)}">${esc(d1Label(s.d1, s.kursTid))}</span>` : ''}</div>
        <div style="display:flex;align-items:center;gap:10px"><span class="small muted">Riskkoll</span>${s.poang != null ? `<b class="num" style="font-size:20px">${s.poang} / 10</b><span class="pill ${LV[lvlOf(s.poang)].c}">${LV[lvlOf(s.poang)].t}</span>` : '<span class="small muted">För lite data</span>'}</div>
      </div>`).join('');
    const names = [...new Set(CMP.flatMap((s) => (s.faktorer || []).map((f) => f[0])))];
    const factorRow = (n) => `<tr><th scope="row">${esc(n)}</th>${CMP.map((s) => { const f = (s.faktorer || []).find((x) => x[0] === n); return `<td>${f ? `<span class="pill ${LV[f[1]].c}">${LV[f[1]].t}</span><span class="small muted cmp-sub">${esc(f[2])}</span>` : '<span class="faint">–</span>'}</td>`; }).join('')}</tr>`;
    const factKeys = [...new Set(CMP.flatMap((s) => (s.fakta || []).map((f) => f[0])))];
    const factRow = (k) => `<tr><th scope="row">${esc(k)}</th>${CMP.map((s) => `<td class="num">${esc((s.fakta || []).find((f) => f[0] === k)?.[1] || '–')}</td>`).join('')}</tr>`;
    const perfKeys = [...new Set(CMP.flatMap((s) => (s.perf || []).map((p) => p[0])))];
    const perfRow = (k) => `<tr><th scope="row">${esc(k)}</th>${CMP.map((s) => { const v = (s.perf || []).find((p) => p[0] === k)?.[1]; return `<td class="num" style="color:var(--${tone(v)})">${v != null ? pct(v) : '–'}</td>`; }).join('')}</tr>`;
    const tbl = (title, rows) => rows.length ? `<section class="card" style="padding:8px 22px 14px"><div class="table-wrap"><table class="cmp"><caption class="label-up" style="text-align:left;padding:12px 0 4px">${title}</caption><thead><tr><th scope="col"><span class="sr-only">Mått</span></th>${CMP.map((s) => `<th scope="col">${esc(short(s.sym))}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div></section>` : '';
    box.innerHTML = `<div class="stack" style="gap:20px">
      <div class="grid g2">${head}</div>
      <section class="card co-section"><span class="label-up">Senaste året</span><h2 class="section">Kursutveckling i procent</h2><div id="cmp-chart" class="chart"></div></section>
      ${tbl('Riskkoll, del för del', names.map(factorRow))}
      ${tbl('Nyckeltal', factKeys.map(factRow))}
      ${tbl('Kursutveckling', perfKeys.map(perfRow))}
      <p class="small faint" style="margin:0">Jämförelsen visar fakta och vår förenklade riskkoll. Den säger inte vilket bolag som är bäst att köpa.</p>
    </div>`;
    const cc = $('#cmp-chart');
    if (ca?.punkter && cb?.punkter) drawChart(cc, [{ punkter: ca.punkter, namn: A.namn }, { punkter: cb.punkter, namn: B.namn }], { range: '1y', relative: true });
    else cc.innerHTML = '<p class="muted" style="margin:0">Kursdiagram saknas för ett av bolagen.</p>';
  };
  compare();
  if (!sel.a) $('#pick-a')?.focus(); else if (!sel.b) $('#pick-b')?.focus();
}
const cleanSym = (s) => { const v = String(s || '').trim().toUpperCase(); return /^\^?[A-Z0-9][A-Z0-9.\-_:=]{0,24}$/.test(v) ? v : null; };

function route() {
  // Sidor som alla får se, även utan konto
  const PUBLIC = ['/om', '/integritet', '/ordlista'];
  const PRIVATE = ['/portfolj', '/ova', '/bevakning', '/kalender', '/idag'];
  const here = location.pathname.replace(/\/+$/, '') || '/';
  if (here === '/om') return { active: 'om', title: 'Om oss', html: viewOm(), mount: () => {} };
  if (here === '/integritet') return { active: 'integritet', title: 'Integritet', html: viewIntegritet(), mount: () => {} };
  if (here === '/ordlista') return { active: 'ordlista', title: 'Ordlista', html: viewOrdlista(), mount: () => {} };
  // Första gången efter inloggning: välj aktier
  if (needsOnboarding() && here !== '/valkommen' && !here.startsWith('/konto') && !PUBLIC.includes(here)) {
    if (!readLS('mk-efter-login', null)) writeLS('mk-efter-login', location.pathname + location.search);
    history.replaceState(null, '', '/valkommen');
  }
  if ((location.pathname.replace(/\/+$/, '') || '/') === '/valkommen' && ACC.user) return { active: '', title: 'Välkommen', html: viewValkommen(), mount: mountValkommen };
  // Inte inloggad: de personliga sidorna kräver konto. Resten är öppet för alla.
  const GUEST_OK = ['/portfolj', '/idag', '/kalender'];
  if (locked() && !GUEST_OK.includes(here) && PRIVATE.some((x) => here === x || here.startsWith(x + '/'))) {
    writeLS('mk-efter-login', location.pathname + location.search);
    history.replaceState(null, '', '/konto');
  }
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(location.search);
  if (path === '/') return { active: 'oversikt', title: 'Översikt', html: viewOversikt(), mount: mountOversikt };
  if (path === '/sok' && params.get('s')) { history.replaceState(null, '', '/bolag/' + encodeURIComponent(params.get('s'))); return route(); }
  if (path === '/sok') return { active: 'sok', title: 'Bolag', html: viewSok(params), mount: () => mountSok(params) };
  if (path === '/nyheter') return { active: 'nyheter', title: 'Nyheter', html: viewNyheter(), mount: mountNyheter };
  if (path === '/bevakning') return { active: 'bevakning', title: 'Bevakning', html: viewBevakning(), mount: mountBevakning };
  if (path === '/portfolj') return { active: 'portfolj', title: 'Min portfölj', html: viewPortfolj(), mount: mountPortfolj };
  // Din dag och Kalender finns nu som flikar i Min portfölj
  if (path === '/idag' || path === '/kalender') { const q = new URLSearchParams({ flik: path === '/idag' ? 'dagen' : 'kalender' }); if (path === '/idag' && params.get('dag')) q.set('dag', params.get('dag')); history.replaceState(null, '', '/portfolj?' + q); return route(); }
  if (path === '/ova') { history.replaceState(null, '', '/portfolj'); return route(); } // Övningsportföljen är borttagen
  if (path === '/fraga') { history.replaceState(null, '', '/'); return route(); }
  if (path === '/aktier') return { active: 'aktier', title: 'Alla aktier', html: viewAktier(), mount: () => mountAktier(params) };
  if (path === '/jamfor') return { active: 'jamfor', title: 'Jämför', html: viewJamfor(), mount: () => mountJamfor(params) };
  if (path === '/statistik') return ACC.user ? { active: 'statistik', title: 'Statistik', html: viewStatistik(), mount: mountStatistik } : { active: 'statistik', title: 'Statistik', html: `${topbar([['Statistik', '/statistik']], false)}<div class="empty">Logga in för att se statistiken.</div>` };
  if (path === '/konto') return { active: 'konto', title: ACC.user ? 'Mitt konto' : 'Logga in', html: viewKonto(), mount: mountKonto };
  const m = path.match(/^\/bolag\/([^/]+)$/);
  if (m) {
    let sym = decodeURIComponent(m[1]);
    if (LEGACY[sym.toLowerCase()]) sym = LEGACY[sym.toLowerCase()];
    sym = sym.toUpperCase();
    if (/^\^?[A-Z0-9][A-Z0-9.\-_:=]{0,24}$/.test(sym)) return { active: 'sok', title: nameOf(sym), html: viewBolag(sym), mount: () => mountBolag(sym) };
  }
  return { active: '', title: 'Sidan finns inte', html: viewNotFound() };
}

/* ---- Sidans beskrivning för Google och för förhandsvisning när länkar delas ---- */
const META = {
  oversikt: ['Riskkoll för svenska och amerikanska aktier på enkel svenska. Insynshandel, blankning, nyheter och din portfölj på ett ställe. Gratis och utan köptips.', 'Risk check for Swedish and US stocks in plain language. Insider trading, short selling, news and your portfolio in one place. Free and without buy tips.'],
  nyheter: ['Börsnyheter om svenska bolag och från hela världen, med länk till källan.', 'Market news about Swedish companies and from around the world, with links to the source.'],
  sok: ['Sök på en aktie eller fond och få affärsidé, kursutveckling och en full riskkoll på enkel svenska.', 'Search for a stock or fund and get the business idea, price development and a full risk check in plain language.'],
  aktier: ['Alla aktier på Stockholmsbörsen och de största i USA. Filtrera på bransch, storlek, P/E och utdelning.', 'All stocks on the Stockholm Stock Exchange and the largest in the US. Filter by sector, size, P/E and dividend.'],
  jamfor: ['Jämför två aktier sida vid sida: kurs, nyckeltal och riskkoll.', 'Compare two stocks side by side: price, key figures and risk check.'],
  om: ['Finanskollen drivs av Albin och finns för att alla ska känna sig trygga med aktier. Aldrig köptips, aldrig sålda uppgifter.', 'Finanskollen is run by Albin so that everyone can feel safe with stocks. Never buy tips, never sold data.'],
  integritet: ['Så hanterar Finanskollen dina uppgifter.', 'How Finanskollen handles your data.'],
  ordlista: ['Börsens ord förklarade på enkel svenska: P/E, blankning, beta, utdelning och mer.', 'Market terms explained in plain language: P/E, short selling, beta, dividend and more.']
};
function setMeta(r, desc) {
  const d = desc || (META[r.active] || META.oversikt)[EN ? 1 : 0];
  const url = location.origin + location.pathname;
  const set = (sel, attr, val) => { let el = document.head.querySelector(sel); if (!el) { el = document.createElement(sel.startsWith('link') ? 'link' : 'meta'); const m = sel.match(/\[(\w+)="([^"]+)"\]/); el.setAttribute(m[1], m[2]); document.head.append(el); } el.setAttribute(attr, val); };
  set('meta[name="description"]', 'content', d);
  set('meta[property="og:description"]', 'content', d);
  set('meta[property="og:title"]', 'content', document.title);
  set('meta[property="og:url"]', 'content', url);
  set('link[rel="canonical"]', 'href', url);
}

/* ================= Besöksstatistik utan cookies ================= */
// Varje sidvisning räknas i Supabase (funktionen rakna_besok). Inget sparas i webbläsaren.
// Bara sidans ägare kan läsa siffrorna, på /statistik.
const ADMIN_ID = '58911bfa-5fbd-4179-8e61-0ee24b77ac42';
const isAdmin = () => ACC.user?.id === ADMIN_ID;
let lastHit = null; let firstHit = true;
async function trackVisit() {
  const p = location.pathname;
  if (p === lastHit || /^(localhost|127\.|\[::1\])/.test(location.hostname) || navigator.webdriver) return;
  lastHit = p;
  // Bolagssidor räknas per bolag, privata sidor bara som sin sida
  const sida = p.length > 100 ? p.slice(0, 100) : p;
  let kalla = 'intern';
  if (firstHit) {
    const qs = new URLSearchParams(location.search);
    const utm = (qs.get('utm_source') || qs.get('ref') || '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 40);
    let ref = ''; try { ref = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : ''; } catch { /* okänd */ }
    kalla = utm || (ref && ref !== location.hostname ? ref : 'direkt');
  }
  firstHit = false;
  try {
    const c = await accCfg(); if (!c || isAdmin()) return;
    fetch(c.url + '/rest/v1/rpc/rakna_besok', { method: 'POST', keepalive: true, headers: { apikey: c.anon, 'content-type': 'application/json', ...(c.anon.startsWith('eyJ') ? { authorization: 'Bearer ' + c.anon } : {}) }, body: JSON.stringify({ p_sida: sida, p_kalla: kalla, p_enhet: matchMedia('(max-width: 760px)').matches ? 'mobil' : 'dator' }) }).catch(() => {});
  } catch { /* statistik får aldrig störa sidan */ }
}

function viewStatistik() {
  return `${topbar([['Statistik', '/statistik']], false)}
  <div class="section-head"><div><h1 class="title">Statistik</h1><p class="muted" style="margin:6px 0 0">Besök på Finanskollen. Räknas utan cookies. Bara du ser den här sidan.</p></div>
    <div class="ov-seg" role="tablist" aria-label="Period">${[[7, '7 dagar'], [30, '30 dagar'], [90, '90 dagar']].map(([d, t]) => `<button type="button" role="tab" data-stdagar="${d}" aria-selected="${d === 30}">${t}</button>`).join('')}</div></div>
  <div id="st-body">${loading('Hämtar statistiken …')}</div>
  ${footer()}`;
}
async function mountStatistik() {
  const box = $('#st-body'); let dagar = 30;
  const draw = async () => {
    box.innerHTML = loading('Hämtar statistiken …');
    let d;
    try { const c = await accCfg(); const t = await token(); const res = await fetch(c.url + '/rest/v1/rpc/besok_statistik', { method: 'POST', headers: { apikey: c.anon, authorization: 'Bearer ' + t, 'content-type': 'application/json' }, body: JSON.stringify({ p_dagar: dagar }) });
      d = await res.json(); if (!res.ok) throw Object.assign(new Error(d?.message || ''), { status: res.status }); }
    catch (e) { box.innerHTML = `<div class="empty">${e.status === 404 ? 'Statistiken är inte påslagen än. Kör SQL-filen kor-detta.sql i Supabase.' : e.status === 403 || /behörighet/i.test(e.message) ? 'Du har inte behörighet att se statistiken.' : 'Det gick inte att hämta statistiken just nu.'}</div>`; return; }
    if (!$('#st-body')) return;
    const days = d.dagar || []; const sum = (k, arr = days) => arr.reduce((a, x) => a + (x[k] || 0), 0);
    const idag = days[days.length - 1] || { visningar: 0, besokare: 0 }; const v7 = days.slice(-7);
    const max = Math.max(1, ...days.map((x) => x.visningar));
    const list = (rows, key, label) => rows.length ? rows.map((r) => `<div class="st-row"><span class="grow">${esc(label(r[key]))}</span><b class="num">${nf(r.visningar, 0)}</b></div>`).join('') : '<p class="small muted" style="margin:0">Inga besök än.</p>';
    box.innerHTML = `
      <div class="st-kpis">
        <div class="ov-card"><span class="small muted">Besökare i dag</span><b class="num">${nf(idag.besokare, 0)}</b><span class="small muted num">${nf(idag.visningar, 0)} sidvisningar</span></div>
        <div class="ov-card"><span class="small muted">Senaste 7 dagarna</span><b class="num">${nf(sum('besokare', v7), 0)}</b><span class="small muted num">${nf(sum('visningar', v7), 0)} sidvisningar</span></div>
        <div class="ov-card"><span class="small muted">Hela perioden</span><b class="num">${nf(sum('besokare'), 0)}</b><span class="small muted num">${nf(sum('visningar'), 0)} sidvisningar</span></div>
      </div>
      <section class="ov-card" style="margin-top:14px"><div class="ov-cardhead"><h2>Sidvisningar per dag</h2><span class="small muted">Besökare räknas en gång per dag</span></div>
        <div class="st-bars" role="img" aria-label="Sidvisningar per dag">${days.map((x) => `<span title="${esc(x.dag)}: ${x.visningar} sidvisningar, ${x.besokare} besökare"><i style="height:${Math.round((x.visningar / max) * 100)}%"></i></span>`).join('')}</div>
        <div class="st-axis small muted num"><span>${esc(days[0]?.dag || '')}</span><span>${esc(idag.dag || '')}</span></div></section>
      <div class="st-grid">
        <section class="ov-card"><div class="ov-cardhead"><h2>Mest besökta sidor</h2></div>${list(d.sidor || [], 'sida', (s) => s)}</section>
        <section class="ov-card"><div class="ov-cardhead"><h2>Varifrån de kommer</h2></div>${list(d.kallor || [], 'kalla', (s) => (s === 'direkt' ? 'Direkt eller okänt' : s))}
          <p class="small muted" style="margin:10px 0 0">Tips: lägg till <b>?ref=tiktok</b> på länken i din profil så syns den här.</p></section>
        <section class="ov-card"><div class="ov-cardhead"><h2>Mobil eller dator</h2></div>${list(d.enheter || [], 'enhet', (s) => (s === 'mobil' ? 'Mobil' : 'Dator'))}</section>
      </div>`;
  };
  $('#main').addEventListener('click', (e) => { const b = e.target.closest('[data-stdagar]'); if (!b) return; dagar = Number(b.dataset.stdagar); document.querySelectorAll('[data-stdagar]').forEach((x) => x.setAttribute('aria-selected', String(x === b))); draw(); });
  draw();
}

function refreshNav(active) { $('#sidebar').innerHTML = sidebar(active); }

function render() {
  const r = route();
  const pub = ['om', 'integritet', 'ordlista'].includes(r.active);
  // Inloggningssidan visas utan meny. Allt annat har menyn, även för besökare.
  document.body.classList.toggle('locked', locked() && r.active === 'konto');
  document.body.classList.remove('nosidebar');
  setMeta(r);
  document.title = location.pathname === '/' ? (EN ? 'Finanskollen – risk check for Swedish stocks' : 'Finanskollen – riskkoll för svenska aktier') : `${trS(r.title)} · Finanskollen`;
  refreshNav(r.active);
  const main = $('#main');
  const fresh = main.cloneNode(false); // tar bort gamla lyssnare
  fresh.innerHTML = r.html;
  main.replaceWith(fresh);
  r.mount?.();
  trackVisit();
}

function navigate(href) {
  history.pushState(null, '', href);
  document.dispatchEvent(new Event('mk-navigate'));
  const swap = () => { render(); window.scrollTo(0, 0); $('#main').focus({ preventScroll: true }); };
  // Mjuk övergång mellan sidor i webbläsare som stöder det, annars direkt
  if (document.startViewTransition && !REDUCED) document.startViewTransition(swap); else swap();
}

/* ================= Rörelse: 3D-lutning, ljusreflex och räkneverk ================= */
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
if (FINE && !REDUCED) {
  let el = null; let frame = 0; let ev = null;
  const apply = () => {
    frame = 0; if (!el || !ev) return;
    const r = el.getBoundingClientRect();
    const x = (ev.clientX - r.left) / r.width; const y = (ev.clientY - r.top) / r.height;
    const max = el.classList.contains('result') ? 5 : 7;
    el.style.setProperty('--ry', ((x - 0.5) * 2 * max).toFixed(2) + 'deg');
    el.style.setProperty('--rx', ((0.5 - y) * 2 * max).toFixed(2) + 'deg');
    el.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
    el.style.setProperty('--my', (y * 100).toFixed(1) + '%');
  };
  const reset = (t) => { t.classList.remove('is-tilting'); t.style.setProperty('--rx', '0deg'); t.style.setProperty('--ry', '0deg'); };
  document.addEventListener('pointermove', (e) => {
    const t = e.target.closest?.('.tilt');
    if (t !== el) { if (el) reset(el); el = t; if (el) el.classList.add('is-tilting'); }
    ev = e; if (el && !frame) frame = requestAnimationFrame(apply);
  }, { passive: true });
  document.addEventListener('pointerleave', () => { if (el) reset(el); el = null; });
}
// Räknar upp ett tal till sitt värde. Text som inte är ett tal lämnas orörd.
function countUp(node, to, fmt = (v) => String(Math.round(v)), ms = 700, start = null) {
  if (!node || REDUCED || !Number.isFinite(to)) { if (node && Number.isFinite(to)) node.textContent = fmt(to); return; }
  const from = start ?? to * 0.92; const t0 = performance.now();
  const step = (t) => { const p = Math.min(1, (t - t0) / ms); const e = 1 - Math.pow(1 - p, 3); node.textContent = fmt(from + (to - from) * e); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
const flash = (node, d1) => { if (!node || d1 == null || REDUCED) return; node.classList.remove('flash-up', 'flash-down'); void node.offsetWidth; node.classList.add(d1 >= 0 ? 'flash-up' : 'flash-down'); };

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-link]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
  e.preventDefault();
  navigate(a.getAttribute('href'));
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest('[data-topsearch]');
  if (!f) return;
  e.preventDefault();
  const q = String(new FormData(f).get('q') || '').trim();
  navigate('/sok' + (q ? '?q=' + encodeURIComponent(q) : ''));
});

/* ================= Översättning till engelska ================= */
// All text skrivs på svenska. På engelska letar vi upp varje textbit i ordlistan en.js efter att den ritats.
// Siffror byts mot {n} innan uppslaget, så "Du har 3 köp" och "Du har 12 köp" delar samma rad.
let TR = null; let TRX = []; let TRF = [];
const MISSING = new Set(); window.__i18nMissing = MISSING;
const DONE = new Set(); // färdig engelsk text, ska inte slås upp igen
// Siffror, valutakoder och engelska månads- och dagnamn byts mot {n}
const NUM_RX = /[−+-]?\d+(?:[   .,:]\d+)*|\b(?:SEK|USD|EUR|GBP|GBp|NOK|DKK|CHF|JPY|CAD|HKD|CNY|AUD|Jan|Feb|Mar|Apr|May|June?|July?|Aug|Sept?|Oct|Nov|Dec|January|February|March|April|August|September|October|November|December|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/g;
const SKIP_SEL = '[data-noi18n], script, style, code, .ai-text, .msg.user, .news-title, .news-text, .chat-title, .co-desc';
const ATTRS = ['placeholder', 'aria-label', 'title', 'data-ask', 'alt'];
// Siffror som servern formaterat på svenska (1 234,5) skrivs om till engelskt format (1,234.5)
const SV_NUM = /^[−+-]?\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:,\d{1,2})?$|^[−+-]?\d+,\d{1,2}$/;
const fixNum = (x) => (EN && SV_NUM.test(x) ? x.replace(/[ \u00a0\u202f]/g, ',').replace(/,(\d{1,2})$/, '.$1') : x);
function tr(raw) {
  if (!TR) return null;
  const s = String(raw).replace(/\s+/g, ' ').trim();
  if (!s || !/[A-Za-zÅÄÖåäöÉé]/.test(s) || DONE.has(s)) return null;
  let hit = TR[s]; if (hit != null) return hit;
  const nums = []; const k = s.replace(NUM_RX, (m) => { nums.push(m); return '{n}'; });
  if (nums.length) { hit = TR[k]; if (hit != null) { let i = 0; return hit.replace(/\{n\}/g, () => fixNum(nums[i++] ?? '')); } }
  for (const [re, out] of TRX) { re.lastIndex = 0; if (re.test(s)) return s.replace(re, out); }
  // Sammansatt text som "Aktie · AAPL": översätt varje del för sig
  if (s.includes(' · ')) { const parts = s.split(' · '); const out = parts.map((x) => trQuiet(x) ?? x); if (out.some((x, i) => x !== parts[i])) return out.join(' · '); }
  // Textbitar runt inskjutna värden: byt kända fraser i texten
  let f = s; for (const [a, b] of TRF) if (f.includes(a)) f = f.split(a).join(b);
  if (f !== s) return f;
  MISSING.add(s); return null;
}
const trQuiet = (x) => { const k = String(x).replace(/\s+/g, ' ').trim(); const had = MISSING.has(k); const out = tr(x); if (!had) MISSING.delete(k); return out; };
const trS = (s) => (EN ? tr(s) ?? s : s); // för text i kod, t.ex. sidtitlar
function trNode(root) {
  if (!TR) return;
  if (root.nodeType === 3) { trText(root); return; }
  if (root.nodeType !== 1 || root.closest?.(SKIP_SEL)) return;
  trAttrs(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, { acceptNode: (n) => (n.nodeType === 1 && n.matches(SKIP_SEL) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
  let n; while ((n = w.nextNode())) { if (n.nodeType === 3) trText(n); else trAttrs(n); }
}
function trText(t) {
  const v = t.nodeValue; if (!v || !v.trim() || t.parentElement?.closest(SKIP_SEL)) return;
  if (!/[A-Za-zÅÄÖåäöÉé]/.test(v)) { NUM_RX.lastIndex = 0; const nv = v.replace(NUM_RX, fixNum); if (nv !== v) t.nodeValue = nv; return; }
  const out = tr(v); if (out == null || out === v.trim()) return;
  if (DONE.size > 5000) DONE.clear(); DONE.add(out.replace(/\s+/g, ' ').trim());
  const lead = v.match(/^\s*/)[0]; const trail = v.match(/\s*$/)[0];
  t.nodeValue = lead + out + trail;
}
function trAttrs(el) {
  for (const a of ATTRS) { const v = el.getAttribute?.(a); if (v) { const out = tr(v); if (out != null && out !== v) el.setAttribute(a, out); } }
  if (el.tagName === 'OPTION' || el.tagName === 'BUTTON') { /* text sköts av textnoderna */ }
}
async function startI18n() {
  if (!EN) return;
  try {
    const mod = await import(new URL('./en.js', import.meta.url).href + new URL(import.meta.url).search);
    TR = mod.default; TRX = mod.RX ? mod.RX(trQuiet) : []; TRF = (mod.FRAG || []).slice().sort((a, b) => b[0].length - a[0].length);
  } catch (e) { console.warn('[i18n]', e); return; }
  trNode(document.body);
  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'characterData') trText(m.target);
      else if (m.type === 'attributes') trAttrs(m.target);
      else m.addedNodes.forEach(trNode);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
function setLang(l) { try { localStorage.setItem('mk-lang', l); } catch { /* privat läge */ } location.reload(); }
const langSwitch = () => `<div class="lang-switch" role="group" aria-label="${EN ? 'Language' : 'Språk'}" data-noi18n>
  <button type="button" data-lang="sv" aria-pressed="${!EN}" title="Svenska">${flag('SE')}<span>SV</span></button><button type="button" data-lang="en" aria-pressed="${EN}" title="English">${flag('GB')}<span>EN</span></button></div>`;
document.addEventListener('click', (e) => { const b = e.target.closest('[data-lang]'); if (b && b.dataset.lang !== LANG) setLang(b.dataset.lang); });

window.addEventListener('popstate', render);
// Kolla inloggningen först så att ingenting av sidan syns innan
(async () => {
  document.body.classList.add('booting');
  $('#main').innerHTML = loading(EN ? 'Loading …' : 'Laddar …');
  await startI18n();
  await bootAccount().catch(() => {});
  await accCfg().catch(() => {});
  document.body.classList.remove('booting');
  render();
  // Kom man in via bekräftelselänken i mejlet: välkomna och gå vidare
  if (ACC.user && ACC.fromLink) { toast(`Välkommen${firstName() ? ', ' + firstName() : ''}!`, ACC.viaGoogle ? 'Du är inloggad med Google.' : 'Din e-post är bekräftad och du är inloggad.'); goAfterLogin(); }
})();
setTimeout(checkAlarms, 5000);
setTimeout(checkKoll, 12000);
setInterval(checkKoll, 30 * 60e3);
setInterval(checkAlarms, 60e3);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
