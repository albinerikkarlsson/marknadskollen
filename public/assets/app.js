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
const pct = (n, d = 2) => (n == null ? '–' : (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toFixed(d).replace('.', EN ? '.' : ',') + ' %');
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
const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* privat läge */ } if ((k === WKEY || k === LKEY || k === 'mk-portfolj' || k === 'mk-ova' || k === KKEY) && !SYNCING) saveCloud(); };
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
    { id: 'sok', href: '/sok', label: 'Sök och riskkoll', icon: 'search' },
    { id: 'aktier', href: '/aktier', label: 'Alla aktier', icon: 'list' },
    { id: 'jamfor', href: '/jamfor', label: 'Jämför', icon: 'compare' }
  ] },
  { group: 'Mina pengar', items: [
    { id: 'kalender', href: '/kalender', label: 'Kalender', icon: 'calendar' },
    { id: 'ova', href: '/ova', label: 'Övningsportfölj', icon: 'play' },
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
const prepNews = (n, region, sym) => ({ ...n, tidTxt: when(n.datum), bolagTxt: (n.bolag || []).join(', '), land: newsLand(n, region, sym) });

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
      <h2 id="vh-h" class="vh-title">Förstå risken innan du köper en aktie</h2>
      <p class="muted" style="margin:0;font-size:16.5px">Finanskollen visar risken i över 3 000 svenska och amerikanska aktier på enkel svenska. Se vad ledningen själv köper och säljer, hur många som satsar på att kursen ska falla och vad nyheterna säger.</p>
      <div class="chips"><a class="btn" href="/konto?ny=1" data-link>Skapa gratis konto</a><a class="btn ghost" href="/aktier" data-link>Se alla aktier</a></div>
    </div>
    <ul class="vh-points">
      <li>${svg('check', 16)}<span><b>Riskkoll för varje aktie</b> från 1 till 10, del för del</span></li>
      <li>${svg('check', 16)}<span><b>Din portfölj</b> med tidslinje, utdelningar och rapportdagar</span></li>
      <li>${svg('check', 16)}<span><b>Larm</b> när kursen rör sig, ledningen handlar eller blankningen ökar</span></li>
      <li>${svg('check', 16)}<span><b>Import</b> av dina affärer från Avanza och Nordnet</span></li>
    </ul>
  </section>`;

const minOversikt = () => !!ACC.user && !locked();
function viewOversikt() {
  if (minOversikt()) return viewOversiktMin();
  return `
  ${topbar([['Översikt', '/']])}
  <div class="ticker num" aria-label="Marknaden" id="ticker">
    ${MARKET.map((m) => `<span><span class="muted">${esc(m.namn)}</span><span data-q="${m.sym}">…</span></span>`).join('')}
  </div>
  <div class="stack" style="gap:6px">
    ${firstName() ? `<span class="greet-mobile">Välkommen tillbaka, ${esc(firstName())}</span>` : ''}
    <span class="eyebrow" id="market-status">Hämtar marknaden …</span>
    <h1 class="title">Börsen i dag</h1>
  </div>

  ${locked() ? visitorHero() : `<div id="koll"></div>`}

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
      <span class="small muted">Sök och riskkoll</span>
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
const krDiff = (n) => `${pmSign(n)}${sekBig(Math.abs(n))}`;
const pctDiff = (n) => `${pmSign(n)}${Math.abs(n).toFixed(1).replace('.', EN ? '.' : ',')} %`;
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
  const C = ['#111214', '#3D6FB6', '#8FB3E3', '#C98A2B', '#D5D8DD', '#5E6168'];
  const tot = rows.reduce((a, x) => a + x[1], 0); if (!tot) return { svg: '', legend: '' };
  let ang = -Math.PI / 2; const P = (a, r) => `${(60 + r * Math.cos(a)).toFixed(2)} ${(60 + r * Math.sin(a)).toFixed(2)}`;
  const list = rows.length > 6 ? [...rows.slice(0, 5), [EN ? 'Other' : 'Övrigt', rows.slice(5).reduce((a, x) => a + x[1], 0)]] : rows;
  const parts = list.map(([name, v], i) => {
    const a0 = ang, a1 = ang + (v / tot) * Math.PI * 2; ang = a1;
    const d = list.length === 1 ? 'M60 4 A56 56 0 1 1 59.99 4 Z' : `M60 60 L${P(a0, 56)} A56 56 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${P(a1 - 0.0001, 56)} Z`;
    return { name, c: C[i % C.length], d, pct: Math.round((v / tot) * 100) };
  });
  return {
    svg: `<svg viewBox="0 0 120 120" class="ov-donut" aria-hidden="true">${parts.map((x) => `<path d="${x.d}" fill="${x.c}" stroke="#FFFFFF" stroke-width="1.5"></path>`).join('')}<circle cx="60" cy="60" r="30" fill="#FFFFFF"></circle></svg>`,
    legend: parts.map((x) => `<div class="ov-leg"><i style="background:${x.c}"></i><span>${esc(x.name)}</span><b class="num">${x.pct} %</b></div>`).join('')
  };
}
const newsRow = (n) => { const u = safeUrl(n.lank); return `
  <div class="ov-nrow">${flag(n.land)}
    <span class="grow"><span class="ov-ntitle">${newsTitle(n)}</span><span class="small muted num">${esc(n.tidTxt)}${n.bolagTxt ? ' · ' + esc(n.bolagTxt) : ''}</span></span>
    ${u ? `<a class="ov-src" href="${esc(u)}" target="_blank" rel="noopener noreferrer" aria-label="${esc((EN ? 'Read at ' : 'Läs hos ') + (n.kalla || ''))}">${esc(n.kalla || (EN ? 'Source' : 'Källa'))} ${svg('ext', 11)}</a>` : ''}
  </div>`; };

function viewOversiktMin() {
  return `
  ${topbar([['Översikt', '/']])}
  <div class="ov-head">
    <div class="ov-title"><h1>Översikt</h1><span class="small muted" id="market-status">Hämtar marknaden …</span></div>
    <div class="ov-market" id="ov-market">${OV_MARKET.map((m) => `<span class="ov-chip"><span class="muted">${esc(m.namn)}</span><span class="num" data-q="${m.sym}">…</span></span>`).join('')}</div>
  </div>
  <div class="ov-grid">
    <div class="ov-col">
      <section class="ov-card ov-dark" id="ov-port" aria-label="Min portfölj">${loading('Räknar på din portfölj …')}</section>
      <section class="ov-card" id="ov-watch" aria-labelledby="ovw-h"><div class="ov-cardhead"><h2 id="ovw-h">Min bevakning</h2><a href="/bevakning" data-link>Alla →</a></div><div id="ov-watch-list">${loading('Hämtar kurser …')}</div></section>
    </div>
    <section class="ov-card" id="ov-koll" aria-labelledby="ovk-h"><div class="ov-cardhead"><h2 id="ovk-h">Dagens koll</h2><a href="/kalender" data-link>Kalender →</a></div><div id="ov-koll-body">${loading('Hämtar …')}</div></section>
    <section class="ov-card" id="ov-news" aria-labelledby="ovn-h"><div class="ov-cardhead"><h2 id="ovn-h">Nyheter</h2>
      <div class="ov-seg" role="tablist" aria-label="Nyheter"><button role="tab" type="button" data-ovnews="mina" aria-selected="true">Mina aktier</button><button role="tab" type="button" data-ovnews="alla" aria-selected="false">Alla</button></div></div>
      <div id="ov-news-body">${loading('Hämtar nyheter …')}</div>
      <a class="small ov-more" href="/nyheter" data-link>Alla nyheter →</a>
    </section>
  </div>
  ${footer()}`;
}

async function mountOversiktMin() {
  const port = getPort(); const watch = getWatch().slice(0, 8);
  const { all } = mySyms();
  const quotes = await getQuotes([...new Set([...OV_MARKET.map((m) => m.sym), ...watch, ...all.slice(0, 30)])]);
  if (!$('#ov-market')) return;
  for (const m of OV_MARKET) { const q = quotes[m.sym]; const el = $(`[data-q="${m.sym}"]`); if (el) el.outerHTML = q?.kurs != null ? `<span class="num">${kr(q.kurs)}${m.sym === 'GC=F' && q.valuta ? ' ' + esc(cur(q.valuta)) : ''}</span><span class="num small" style="color:var(--${tone(q.d1)})">${pct(q.d1)}</span>` : '<span class="faint">saknas</span>'; }
  $('#market-status').textContent = quotes.__hamtad ? `${new Date().toLocaleDateString(L, { weekday: 'short', day: 'numeric', month: 'short' })} · ${EN ? 'updated' : 'uppdaterad'} ${clock(quotes.__hamtad)}` : errText(quotes.__error);

  /* ---- Min bevakning ---- */
  let redrawWatch = () => {};
  const wl = $('#ov-watch-list');
  if (!watch.length) wl.innerHTML = '<p class="small muted" style="margin:0">Du bevakar inga aktier än. Sök på ett bolag och tryck på <b>Bevaka</b>.</p>';
  else {
    let wCharts = {};
    const draw = (charts = wCharts) => { wCharts = charts; if (!$('#ov-watch-list')) return; wl.innerHTML = watch.map((s) => { const q = quotes[s]; const d = q?.d1;
      return `<a class="ov-wrow" href="/bolag/${encodeURIComponent(s)}" data-link>${symFlag(s)}<span class="ov-name">${esc(ovName(s))}</span>
        <svg viewBox="0 0 56 18" class="ov-spark" aria-hidden="true"><path d="${charts[s] || ''}" fill="none" stroke="var(--${d != null && d < 0 ? 'down' : 'up'})" stroke-width="1.4" stroke-linejoin="round"></path></svg>
        <span class="num muted">${q?.kurs != null ? esc(kr(q.kurs)) : '–'}</span><span class="pill ${tone(d)} num">${d != null ? pct(d, 1) : '–'}</span></a>`; }).join(''); };
    draw();
    Promise.all(watch.map((s) => api(`/api/chart?s=${encodeURIComponent(s)}&r=1m`, 30 * 60e3).catch(() => null))).then((cs) => draw(Object.fromEntries(watch.map((s, i) => [s, sparkPath(cs[i]?.punkter || [])]))));
    redrawWatch = () => draw();
  }

  /* ---- Nyheter ---- */
  let tab = 'mina'; let seq = 0;
  const nb = $('#ov-news-body');
  const drawNews = async () => {
    const id = ++seq; nb.innerHTML = loading('Hämtar nyheter …');
    let items = [];
    if (tab === 'mina' && all.length) {
      const syms = [...new Set([...port.map((x) => x.sym), ...watch])].slice(0, 6);
      const res = await Promise.all(syms.map((s) => api('/api/news?s=' + encodeURIComponent(s), 10 * 60e3).then((n) => (n?.items || []).map((x) => prepNews(x, null, s))).catch(() => [])));
      const seen = new Set(); items = res.flat().filter((n) => { const k = n.lank || n.rubrik; if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => String(b.datum).localeCompare(String(a.datum)));
    } else {
      const se = await getNews('se'); items = se.items.length ? se.items : (await getNews('world')).items;
    }
    if (id !== seq || !$('#ov-news-body')) return;
    if (!items.length) { nb.innerHTML = `<p class="small muted" style="margin:0">${tab === 'mina' ? 'Inga nyheter om dina aktier just nu.' : 'Inga nyheter just nu.'}</p>`; return; }
    const [top, ...rest] = items; const u = safeUrl(top.lank);
    nb.innerHTML = `<article class="ov-top">
        <span class="ov-topmeta">${flag(top.land)}<span class="small muted num">${esc(top.tidTxt)}${top.bolagTxt ? ' · ' + esc(top.bolagTxt) : ''}</span></span>
        <b>${newsTitle(top)}</b>
        ${u ? `<a class="ov-src" href="${esc(u)}" target="_blank" rel="noopener noreferrer" style="align-self:flex-start">${esc(top.kalla || 'Källa')} ${svg('ext', 11)}</a>` : ''}
      </article>${rest.slice(0, 7).map(newsRow).join('')}`;
  };
  $('#ov-news').addEventListener('click', (e) => { const b = e.target.closest('[data-ovnews]'); if (!b || b.dataset.ovnews === tab) return; tab = b.dataset.ovnews; $('#ov-news').querySelectorAll('[data-ovnews]').forEach((x) => x.setAttribute('aria-selected', String(x === b))); drawNews(); });
  drawNews();

  /* ---- Min portfölj ---- */
  const pb = $('#ov-port'); let pdata = null;
  if (!port.length) {
    pb.innerHTML = `<div class="ov-cardhead"><h2>Min portfölj</h2></div><p style="margin:0;color:rgba(255,255,255,0.75)">Lägg in dina köp så ser du värde, vinst i kronor och procent, risk och utdelning här.</p>
      <div class="chips"><a class="ov-btn" href="/portfolj" data-link>Lägg till ett köp</a><a class="ov-btn ghost" href="/portfolj#pf-import" data-link>Importera från Avanza eller Nordnet</a></div>`;
  } else {
    pdata = await pfData(port);
    if (!$('#ov-port')) return;
    redrawWatch();
    const { hold, tot, insatt, vinst, idag, risk } = pdata;
    const sorted = hold.slice().sort((a, b) => (b.varde || 0) - (a.varde || 0));
    pb.innerHTML = `<div class="ov-cardhead"><h2>Min portfölj</h2><a href="/portfolj" data-link>Öppna →</a></div>
      <b class="ov-big num">${sekBig(tot)}</b>
      <div class="ov-gains">
        <a href="/idag" data-link class="ov-gainlink ${idag < 0 ? 'neg' : ''}"><span>${pdata.dagIdag || !pdata.refDag ? 'I dag' : esc(dayShort(pdata.refDag + 'T12:00:00'))} ›</span><b class="num">${idag ? krDiff(idag) : '–'}</b><span class="num">${idag && tot ? pctDiff((idag / (tot - idag)) * 100) : ''}</span></a>
        <div class="${vinst != null && vinst < 0 ? 'neg' : ''}"><span>Sedan köp</span><b class="num">${vinst != null ? krDiff(vinst) : '–'}</b><span class="num">${vinst != null && insatt ? pctDiff((vinst / insatt) * 100) : ''}</span></div>
      </div>
      <div class="ov-chartbox"><div class="ov-charthead"><span id="ov-chg">${EN ? 'Value over time' : 'Värde över tid'}</span><div class="ov-seg dark" role="tablist" aria-label="Period">${[['1m', '1 mån'], ['6m', '6 mån'], ['1y', '1 år'], ['all', 'Allt']].map(([k, t]) => `<button role="tab" type="button" data-ovrange="${k}" aria-selected="${k === '6m'}">${t}</button>`).join('')}</div></div><div id="ov-chart"><div class="ov-chart-empty"></div></div></div>
      <div class="ov-facts"><span><span>Riskkoll</span><b class="num">${risk != null ? nf(risk, 1) + ' / 10' : '–'}</b></span><span><span>Utdelning per år</span><b class="num" id="ov-utd">…</b></span></div>
      <div class="ov-hold">${sorted.slice(0, 6).map((h) => `<a href="/bolag/${encodeURIComponent(h.sym)}" data-link>${symFlag(h.sym)}<span class="ov-name">${esc(ovName(h.sym))}</span><span class="num ov-dim">${h.varde != null ? sek(h.varde) : '–'}</span><span class="ov-gain num ${h.vinst != null && h.vinst < 0 ? 'neg' : ''}"><span>${h.vinst != null ? krDiff(h.vinst) : '–'}</span><span>${h.vinst != null && h.insatt ? pctDiff((h.vinst / h.insatt) * 100) : ''}</span></span></a>`).join('')}</div>`;
    // Diagrammet
    let range = '6m'; let ser = null;
    const drawChart = () => { const c = $('#ov-chart'); if (!c || !ser) return;
      if (ser.error) { c.innerHTML = `<p class="small" style="margin:0;color:rgba(255,255,255,0.6)">${ser.error === 'nobuys' ? 'Diagrammet kräver köp med datum.' : 'Diagrammet visas när det finns minst två dagars kurser.'}</p>`; return; }
      const V = rangeCut(ser.value, range, ser.tNow); const I = rangeCut(ser.invested, range, ser.tNow);
      const ch = V[V.length - 1][1] - V[0][1];
      $('#ov-chg').innerHTML = `${EN ? 'Value over time' : 'Värde över tid'} · <span style="color:${ch < 0 ? '#FFB4AC' : '#9BE3B8'}">${krDiff(ch)} (${pctDiff(V[0][1] ? (ch / V[0][1]) * 100 : 0)})</span>`;
      c.innerHTML = miniMoney(V, I); };
    pfSeries(pdata).then((x) => { ser = x; drawChart(); }).catch(() => {});
    pb.addEventListener('click', (e) => { const b = e.target.closest('[data-ovrange]'); if (!b) return; range = b.dataset.ovrange; pb.querySelectorAll('[data-ovrange]').forEach((x) => x.setAttribute('aria-selected', String(x === b))); drawChart(); });
    getKalender(port.map((x) => x.sym)).then(dividendPlan).then((plan) => { const u = $('#ov-utd'); if (u) u.textContent = plan.rows.length ? sekBig(plan.total) : '–'; }).catch(() => { const u = $('#ov-utd'); if (u) u.textContent = '–'; });
  }

  /* ---- Dagens koll ---- */
  const kb = $('#ov-koll-body');
  if (!all.length) { kb.innerHTML = '<p class="small muted" style="margin:0">Bevaka några aktier eller lägg in dina köp, så visar vi vad som händer i dem här.</p>'; return; }
  const moves = all.map((s) => ({ s, q: quotes[s] })).filter((x) => x.q?.d1 != null && x.q.idag).sort((a, b) => b.q.d1 - a.q.d1);
  const best = moves[0]; const worst = moves.length > 1 ? moves[moves.length - 1] : null;
  const tile = (x, label) => { if (!x) return ''; const d = x.q.d1; const per = x.q.kurs - x.q.kurs / (1 + d / 100);
    return `<a class="ov-tile ${d < 0 ? 'neg' : ''}" href="/bolag/${encodeURIComponent(x.s)}" data-link><span class="small">${label}</span><b>${esc(ovName(x.s))}</b><span class="ov-tilepct num">${pct(d, 1)}</span><span class="small num">${pmSign(per)}${kr(Math.abs(per))} ${esc(cur(x.q.valuta))} ${EN ? 'per share' : 'per aktie'}</span></a>`; };
  // Fem handelsdagar från i dag
  const days = []; for (let d = new Date(); days.length < 5; d = new Date(d.getTime() + dayMs)) { if (d.getDay() !== 0 && d.getDay() !== 6) days.push(isoDay(d)); }
  kb.innerHTML = `
    <div class="ov-tiles">${tile(best, 'Bäst i dag')}${worst && worst.q.d1 < best.q.d1 ? tile(worst, 'Sämst i dag') : ''}</div>
    <div class="ov-block"><div class="ov-blockhead"><span>Veckan för dina aktier</span><span class="ov-legend"><span class="rep">● <span>Rapport</span></span><span class="utd">● <span>Utdelning</span></span></span></div>
      <div class="ov-week" id="ov-week">${days.map((d, i) => `<div class="ov-day ${i === 0 ? 'today' : ''}"><span>${i === 0 ? 'I dag' : esc(new Date(d + 'T12:00:00').toLocaleDateString(L, { weekday: 'short' }))}</span><b class="num">${Number(d.slice(8))}</b><span class="ov-ev" data-day="${d}"></span></div>`).join('')}</div></div>
    <div class="ov-block" id="ov-fi"><div class="ov-blockhead"><span>Ledningen handlar · senaste 7 dagarna</span></div><div class="small muted">${EN ? 'Loading …' : 'Hämtar …'}</div></div>
    ${pdata && pdata.hold.some((h) => h.varde) ? `<div class="ov-block"><div class="ov-blockhead"><span>Så är dina pengar fördelade</span><div class="ov-seg" role="tablist" aria-label="Fördelning">${[['bransch', 'Bransch'], ['land', 'Land'], ['innehav', 'Innehav']].map(([k, t]) => `<button role="tab" type="button" data-ovpie="${k}" aria-selected="${k === 'bransch'}">${t}</button>`).join('')}</div></div><div class="ov-pie" id="ov-pie"></div></div>` : ''}`;
  // Fördelning
  const drawPie = (k) => { const el = $('#ov-pie'); if (!el || !pdata) return; const m = {};
    for (const h of pdata.hold) if (h.varde) { const key = k === 'innehav' ? ovName(h.sym) : h[k]; m[key] = (m[key] || 0) + h.varde; }
    const d = donut(Object.entries(m).sort((a, b) => b[1] - a[1])); el.innerHTML = `${d.svg}<div class="ov-legs">${d.legend}</div>`; };
  drawPie('bransch');
  kb.addEventListener('click', (e) => { const b = e.target.closest('[data-ovpie]'); if (!b) return; kb.querySelectorAll('[data-ovpie]').forEach((x) => x.setAttribute('aria-selected', String(x === b))); drawPie(b.dataset.ovpie); });
  // Rapporter och utdelningar i veckan
  getKalender(all).then((kal) => {
    for (const e of events(kal, 0, 10)) { const el = $(`.ov-ev[data-day="${e.dag}"]`); if (!el) continue;
      el.insertAdjacentHTML('beforeend', `<a class="${e.typ === 'rapport' ? 'rep' : 'utd'}" href="/bolag/${encodeURIComponent(e.k.sym)}" data-link title="${esc(nameOf(e.k.sym) + ': ' + evtLabel(e))}">${esc(ovName(e.k.sym).split(/[ ,]/)[0])}</a>`); }
  }).catch(() => {});
  // Insynsaffärer i dina svenska bolag
  const se = all.filter(isSwedish).slice(0, 8); const since = isoDay(Date.now() - 7 * dayMs);
  const fiBox = () => $('#ov-fi');
  if (!se.length) { fiBox().innerHTML = '<div class="ov-blockhead"><span>Ledningen handlar</span></div><p class="small muted" style="margin:0">Finansinspektionens register gäller svenska bolag.</p>'; }
  else Promise.all(se.map((s) => getFI(s).catch(() => null))).then((fi) => {
    const b = fiBox(); if (!b) return;
    const tr = fi.filter(Boolean).flatMap((f) => f.affarer.filter((a) => String(a.datum) >= since));
    const kop = tr.filter((a) => a.typ === 'Köp').reduce((a, x) => a + (x.varde || 0), 0); const salj = tr.filter((a) => a.typ === 'Sälj').reduce((a, x) => a + (x.varde || 0), 0);
    const sum = kop + salj;
    b.innerHTML = `<div class="ov-blockhead"><span>Ledningen handlar · senaste 7 dagarna</span></div>${sum ? `<div class="ov-bar"><span class="up" style="width:${(kop / sum) * 100}%"></span><span class="down" style="width:${(salj / sum) * 100}%"></span></div>
      <div class="ov-barleg num"><span class="up"><span>Köp</span> ${esc(mny(kop, 'SEK'))}</span><span class="down"><span>Sälj</span> ${esc(mny(salj, 'SEK'))}</span></div>` : '<p class="small muted" style="margin:0">Inga insynsaffärer i dina svenska bolag de senaste 7 dagarna.</p>'}`;
  });
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

function viewDinDag() {
  return `${topbar([['Översikt', '/'], ['Min portfölj', '/portfolj'], ['Din dag', '/idag']])}
  <div class="section-head"><div><h1 class="title">Din dag</h1><p class="muted" style="margin:6px 0 0" id="dd-sub">Hur portföljen har rört sig i dag och vilka aktier som påverkade mest.</p></div><div class="chips" id="dd-bors"></div></div>
  <div id="dd-body">${loading('Räknar på din dag …')}</div>
  ${footer()}`;
}
async function mountDinDag() {
  const port = getPort(); const box = $('#dd-body');
  if (!port.length) { box.innerHTML = `<div class="empty">Du har inga köp i portföljen än. <a href="/portfolj" data-link>Lägg till ett köp</a> så ser du här hur din dag går.</div>`; return; }
  const d = await pfData(port); if (!$('#dd-body')) return;
  const { hold, tot, idag, refDag, dagIdag } = d;
  // Börsernas läge just nu
  const borser = {}; for (const h of hold) { const st = borsStatus(h.sym, h.tid); h.status = st; borser[st.bors] = borser[st.bors] || st; }
  $('#dd-bors').innerHTML = Object.values(borser).map((b) => `<span class="dd-bors ${b.kod}"><i></i>${esc(b.bors)} · ${esc(b.txt)}</span>`).join('');
  if (refDag) $('#dd-sub').textContent = dagIdag ? `${dayShort(refDag + 'T12:00:00')} · ${EN ? 'compared with the previous close' : 'jämfört med gårdagens stängning'}` : (EN ? `No trading yet today. Showing the last trading day, ${dayShort(refDag + 'T12:00:00')}.` : `Ingen handel än i dag. Här är senaste börsdagen, ${dayShort(refDag + 'T12:00:00')}.`);
  const counted = hold.filter((h) => h.idag != null);
  const up = counted.filter((h) => h.idag > 0).sort((a, b) => b.idag - a.idag), down = counted.filter((h) => h.idag < 0).sort((a, b) => a.idag - b.idag);
  const maxAbs = Math.max(1, ...counted.map((h) => Math.abs(h.idag)));
  const notYet = hold.filter((h) => h.idag == null);
  const sentence = [up[0] ? `${EN ? 'Biggest lift' : 'Mest upp'}: <b>${esc(ovName(up[0].sym))}</b> ${krDiff(up[0].idag)}` : '', down[0] ? `${EN ? 'Biggest drag' : 'Mest ner'}: <b>${esc(ovName(down[0].sym))}</b> ${krDiff(down[0].idag)}` : ''].filter(Boolean).join(' · ');
  const row = (h) => { const w = h.idag != null ? Math.round((Math.abs(h.idag) / maxAbs) * 100) : 0;
    return `<a class="dd-row" href="/bolag/${encodeURIComponent(h.sym)}" data-link>${symFlag(h.sym)}
      <span class="dd-name"><b>${esc(ovName(h.sym))}</b><span class="small muted">${esc(h.status.bors)} · ${esc(h.status.txt)}</span></span>
      <span class="dd-bar"><span class="dd-neg">${h.idag < 0 ? `<i style="width:${w}%"></i>` : ''}</span><span class="dd-pos">${h.idag > 0 ? `<i style="width:${w}%"></i>` : ''}</span></span>
      <span class="dd-num num"><b style="color:var(--${h.idag == null ? 'muted' : tone(h.idag)})">${h.idag != null ? krDiff(h.idag) : '–'}</b><span class="small muted">${h.d1Dag != null ? pct(h.d1Dag, 1) : (EN ? 'not traded yet' : 'inte handlad än')}</span></span></a>`; };
  box.innerHTML = `
    <section class="ov-card ov-dark dd-hero">
      <div class="dd-top"><div><span class="small" style="color:rgba(255,255,255,.6)">${dagIdag ? (EN ? 'Today' : 'I dag') : esc(dayShort(refDag + 'T12:00:00'))}</span>
        <b class="ov-big num" style="color:${idag < 0 ? '#FFB4AC' : '#9BE3B8'}">${idag ? krDiff(idag) : '0 kr'}</b>
        <span class="num" style="color:${idag < 0 ? '#FFB4AC' : '#9BE3B8'}">${idag && tot ? pctDiff((idag / (tot - idag)) * 100) : ''}</span></div>
        <p class="dd-sent">${sentence || (EN ? 'No movement yet today.' : 'Ingen rörelse än i dag.')}</p></div>
      <div id="dd-chart" class="dd-chart"><div class="small" style="color:rgba(255,255,255,.55)">${EN ? 'Loading the day …' : 'Hämtar dagens kurser …'}</div></div>
    </section>
    <div class="dd-grid">
      <section class="ov-card"><div class="ov-cardhead"><h2>Så påverkade dina aktier dagen</h2><span class="small muted">${EN ? 'In kronor' : 'I kronor'}</span></div>
        ${[...up, ...down].map(row).join('')}${notYet.length ? `<div class="dd-sep small muted">${EN ? 'Not traded yet today' : 'Har inte handlats i dag än'}</div>${notYet.map(row).join('')}` : ''}</section>
      <section class="ov-card"><div class="ov-cardhead"><h2>Nyheter om dem som rörde sig mest</h2></div><div id="dd-news">${loading('Hämtar nyheter …')}</div></section>
    </div>
    <p class="small faint" style="margin:14px 0 0">Förändringen räknas i aktiens egen valuta mot föregående stängning och räknas om till kronor med dagens växelkurs. Valutans rörelse under dagen ingår inte. Aktier vars börs inte har öppnat räknas inte, så gårdagens rörelse blandas aldrig in.</p>`;

  // Kurvan för dagen, var femte minut
  const day = refDag;
  Promise.all(counted.map((h) => api(`/api/chart?s=${encodeURIComponent(h.sym)}&r=1d`, 5 * 60e3).catch(() => null))).then((cs) => {
    const el = $('#dd-chart'); if (!el) return;
    const series = counted.map((h, i) => { const c = cs[i]; const pts = (c?.punkter || []).filter(([t]) => sthlmDay(t * 1000) === day); const base = c?.prevClose ?? (h.kurs != null && h.d1 != null ? h.kurs / (1 + h.d1 / 100) : null);
      return { per: h.varde != null && h.kurs ? h.varde / h.kurs : 0, base, pts }; }).filter((x) => x.base && x.pts.length);
    if (!series.length) { el.innerHTML = `<div class="small" style="color:rgba(255,255,255,.55)">${EN ? 'No intraday prices yet.' : 'Inga kurser under dagen än.'}</div>`; return; }
    const t0 = Math.min(...series.map((x) => x.pts[0][0])), t1 = Math.max(...series.map((x) => x.pts[x.pts.length - 1][0]));
    const pts = []; for (let t = t0; t <= t1; t += 300) { let v = 0; for (const x of series) { let p = null; for (const q of x.pts) { if (q[0] <= t) p = q[1]; else break; } v += p != null ? (p - x.base) * x.per : 0; } pts.push([t, v]); }
    const W = 900, H = 200; const vals = pts.map((p) => p[1]); const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals); const pad = (hi - lo) * 0.12 || 10;
    const X = (t) => ((t - t0) / ((t1 - t0) || 1)) * W, Y = (v) => H - ((v - (lo - pad)) / ((hi + pad) - (lo - pad))) * H;
    const line = pts.map(([t, v], i) => `${i ? 'L' : 'M'}${X(t).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');
    const last = pts[pts.length - 1][1]; const col = last < 0 ? '#FFB4AC' : '#9BE3B8';
    const hm = (t) => new Date(t * 1000).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' });
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="dd-svg" role="img" aria-label="${EN ? 'Portfolio change during the day' : 'Portföljens förändring under dagen'}">
      <line x1="0" x2="${W}" y1="${Y(0)}" y2="${Y(0)}" stroke="rgba(255,255,255,.25)" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/>
      <path d="${line} L${W} ${Y(0)} L0 ${Y(0)} Z" fill="${col}" opacity=".12"/>
      <path d="${line}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>
      <div class="dd-axis small num"><span>${hm(t0)}</span><span>${EN ? 'Dashed line = yesterday\'s close' : 'Streckad linje = gårdagens stängning'}</span><span>${hm(t1)}</span></div>`;
  });
  // Nyheter från dagen om de tre som påverkade mest
  const top = counted.slice().sort((a, b) => Math.abs(b.idag) - Math.abs(a.idag)).slice(0, 3);
  Promise.all(top.map((h) => api('/api/news?s=' + encodeURIComponent(h.sym), 10 * 60e3).then((n) => (n?.items || []).map((x) => prepNews(x, null, h.sym))).catch(() => []))).then((res) => {
    const el = $('#dd-news'); if (!el) return;
    const since = Date.now() - 36 * 3600e3; const seen = new Set();
    const items = res.flat().filter((n) => new Date(n.datum).getTime() >= since).filter((n) => { const k = n.lank || n.rubrik; if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => String(b.datum).localeCompare(String(a.datum))).slice(0, 6);
    el.innerHTML = items.length ? items.map(newsRow).join('') : `<p class="small muted" style="margin:0">${EN ? 'No news in the last day about the stocks that moved most.' : 'Inga nyheter det senaste dygnet om aktierna som rörde sig mest.'}</p>`;
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
  ${topbar([['Översikt', '/'], ['Sök och riskkoll', '/sok']], false)}
  <div class="stack" style="gap:6px">
    <span class="eyebrow">Sök på en aktie, fond eller ETF. Du får affärsidé, historia, kursutveckling och en full riskkoll på samma sida.</span>
    <h1 class="title">Sök och riskkoll</h1>
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
    <div class="tabs" role="tablist" aria-label="Region">
      <button role="tab" data-region="world" aria-selected="true">Världen</button>
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
        <span class="small muted">Källor</span>
        <div class="chips" id="newsfilter"></div>
      </div>
      <div class="empty">Vi visar rubrik, en kort ingress och länk till källan. Läs alltid hela artikeln innan du gör något med dina pengar.</div>
    </aside>
  </div>
  ${footer()}`;
}

function mountNyheter() {
  let region = 'world'; let filt = 'Alla'; let data = null;
  const draw = () => {
    if (!data || !$('#newslist')) return;
    if (!data.ok) { $('#newslist').innerHTML = `<div class="empty">${esc(errText(data.error))}</div>`; $('#newsfilter').innerHTML = ''; $('#news-status').innerHTML = ''; return; }
    const all = data.items;
    const cats = ['Alla', ...new Set(all.map((n) => n.kalla))].slice(0, 10);
    if (!cats.includes(filt)) filt = 'Alla';
    const list = filt === 'Alla' ? all : all.filter((n) => n.kalla === filt);
    $('#news-status').innerHTML = all.length ? liveTag(data.hamtad) : '';
    $('#news-count').textContent = String(all.length);
    $('#news-range').textContent = all.length ? `Senaste ${all[0].tidTxt}, äldsta ${all[all.length - 1].tidTxt}` : '';
    $('#newsfilter').innerHTML = cats.map((c) => `<button type="button" class="chip-btn" data-filt="${esc(c)}" aria-pressed="${c === filt}">${esc(c)}</button>`).join('');
    $('#newslist').innerHTML = list.map((n) => `
      <article class="card news-item">
        <div class="stack" style="gap:8px;flex:1;min-width:0">
          <div class="meta"><span class="pill outline src">${flag(n.land)}${esc(n.kalla)}</span><span class="num">${esc(n.tidTxt)}</span>${n.bolagTxt ? `<span>${esc(n.bolagTxt)}</span>` : ''}</div>
          <h3>${newsTitle(n)}</h3>
          ${n.text ? `<p class="news-text">${esc(n.text)}</p>` : ''}
          <div class="meta">${sourceLink(n)}</div>
        </div>
      </article>`).join('') || `<div class="empty">${region === 'se' ? 'Inga nyheter om svenska bolag just nu.' : 'Inga nyheter just nu.'}</div>`;
  };
  const load = async () => {
    const r = region; $('#newslist').innerHTML = loading('Hämtar nyheter …');
    const d = await getNews(r); if (r !== region) return; data = d; draw();
  };
  $('.tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-region]'); if (!b) return;
    region = b.dataset.region; filt = 'Alla';
    document.querySelectorAll('[data-region]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    load();
  });
  $('#newsfilter').addEventListener('click', (e) => { const b = e.target.closest('[data-filt]'); if (b) { filt = b.dataset.filt; draw(); } });
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
      $('#watchtable').innerHTML = '<div class="empty" style="margin:12px">Du bevakar inga aktier. Gå till <a href="/sok" data-link>Sök och riskkoll</a> och tryck på Bevaka.</div>';
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

function viewBolag(sym) {
  return `
  ${topbar([['Sök', '/sok'], [nameOf(sym), '/bolag/' + encodeURIComponent(sym)]])}
  <div id="bolag">${loading('Hämtar bolaget …')}</div>
  ${footer()}`;
}

function bolagHTML(s) {
  const watched = getWatch().includes(s.sym);
  const max = Math.max(...(s.perf || []).map((p) => Math.abs(p[1])), 1);
  const lvl = lvlOf(s.poang);
  return `
  <div class="stack" style="gap:24px">
    <header class="co-head">
      <div style="display:flex;align-items:center;gap:18px;min-width:0">
        <span class="avatar" style="width:68px;height:68px;font-size:14px">${esc(s.kort)}${symFlag(s.sym, 'on-avatar big')}</span>
        <div style="min-width:0">
          <span class="label-up">${esc(s.lista || s.sym)}</span>
          <h1 class="title" style="margin:2px 0 6px">${esc(s.namn)}</h1>
          <div class="chips"><span class="pill outline num">${esc(s.sym)}</span>${s.aktieslag ? `<span class="pill outline">${esc(s.aktieslag)}</span>` : ''}<a class="pill outline" href="/jamfor?a=${encodeURIComponent(s.sym)}" data-link style="text-decoration:none">${svg('compare', 13)} Jämför</a><button type="button" class="pill outline pill-btn" data-share>${svg('share', 13)} Dela</button>${safeUrl(s.webb) ? `<a class="pill outline" href="${esc(safeUrl(s.webb))}" target="_blank" rel="noopener noreferrer" style="text-decoration:none">Webbplats ${svg('ext', 13)}</a>` : ''}
            <button class="btn small ${watched ? 'ghost' : ''}" type="button" data-watch="${esc(s.sym)}" data-namn="${esc(s.namn)}" aria-pressed="${watched}">${watched ? 'Bevakas ✓' : 'Bevaka'}</button></div>
        </div>
      </div>
      ${priceBlock(s)}
    </header>

    ${s.fakta?.length ? `<div class="statbar card">${s.fakta.map(([k, v]) => `<div class="stat"><span class="small muted">${esc(k)}${tip(k)}</span><span class="num">${esc(v)}</span></div>`).join('')}</div>` : ''}

    <div class="co-grid">
      <div class="co-main stack" style="gap:24px">
        <section class="card co-section" aria-labelledby="chart-h">
          <div class="section-head" style="align-items:center"><div><span class="label-up">Kursdiagram</span><h2 class="section" id="chart-h" style="margin-top:4px">Kursen över tid</h2></div>
            <div class="tabs" role="tablist" aria-label="Period">${[['1m', '1 mån'], ['6m', '6 mån'], ['1y', '1 år'], ['5y', '5 år']].map(([k, t]) => `<button role="tab" data-range="${k}" aria-selected="${k === '1y'}">${t}</button>`).join('')}</div></div>
          <div id="chart" class="chart">${loading('Hämtar kurser …')}</div>
        </section>

        <section class="card co-section" aria-labelledby="om-h" id="about">
          <span class="label-up">Om bolaget</span>
          <h2 class="section" id="om-h">Affärsidé</h2>
          <div id="about-body">${loading('Hämtar affärsidé och historia …')}</div>
        </section>

        <section class="card co-section" aria-labelledby="utv-h">
          <span class="label-up">Aktien</span>
          <div class="section-head"><h2 class="section" id="utv-h">Så har kursen gått</h2><span class="small muted">Förändring i procent</span></div>
          <div class="stack" style="gap:12px">
          ${(s.perf || []).map(([label, v]) => {
            const w = (Math.abs(v) / max) * 50;
            return `<div class="perf-row"><span class="muted">${esc(label)}</span>
              <div class="perf-track" role="img" aria-label="${esc(label)} ${pct(v)}"><span class="zero"></span><span class="perf-bar ${v < 0 ? 'neg' : ''}" style="${v < 0 ? `right:50%;width:${w}%` : `left:50%;width:${w}%`}"></span></div>
              <span class="num" style="text-align:right;color:var(--${tone(v)})">${pct(v)}</span></div>`;
          }).join('') || '<span class="muted">Datakällan har ingen kursutveckling för det här värdepappret.</span>'}
          </div>
          <span class="small faint">Historisk utveckling säger inget om framtiden.</span>
        </section>

        ${isSwedish(s.sym) ? `
        <section class="card co-section" aria-labelledby="insyn-h">
          <span class="label-up">Finansinspektionen</span>
          <h2 class="section" id="insyn-h">Insynshandel${tip('Insynshandel')}</h2>
          <p class="small muted" style="margin:0">Personer i bolagets ledning och styrelse måste anmäla sina affärer i aktien. Här är de senaste tolv månaderna.</p>
          <div id="insyn-body" class="stack" style="gap:16px">${loading('Hämtar insynsaffärer …')}</div>
        </section>

        <section class="card co-section" aria-labelledby="blank-h">
          <span class="label-up">Finansinspektionen</span>
          <h2 class="section" id="blank-h">Blankning${tip('Blankning')}</h2>
          <div id="blank-body" class="stack" style="gap:16px">${loading('Hämtar blankning …')}</div>
        </section>` : ''}

        <section class="card co-section" aria-labelledby="bnyh-h">
          <span class="label-up">Nyheter</span>
          <h2 class="section" id="bnyh-h">Senaste om ${esc(s.namn)}</h2>
          <div id="ai-sum"></div>
          <div id="bolagnews">${loading('Hämtar nyheter …')}</div>
        </section>
      </div>

      <aside class="co-side" aria-label="Riskkoll">
        <section class="card dark rings stack tilt glare" style="gap:14px;padding:26px" aria-labelledby="risk-h"><span class="glare-layer" aria-hidden="true"></span>
          <span class="label-up" style="color:rgba(255,255,255,0.6)">Riskkoll${tip('Riskkoll')}</span>
          ${s.poang != null ? `
          <div style="display:flex;align-items:baseline;gap:8px"><span class="score num" data-count="${s.poang}">${s.poang}</span><span class="muted" style="font-size:18px">/ 10</span>
            <span class="pill inv" style="margin-left:auto;align-self:center">${LV[lvl].t} risk</span></div>
          <div class="meter" role="img" aria-label="Risk ${s.poang} av 10">${Array.from({ length: 10 }, (_, i) => `<span class="${i < s.poang ? 'on' : ''}" style="--i:${i}"></span>`).join('')}</div>` : '<span style="font-size:20px">För lite data för att räkna en total.</span>'}
          <h2 class="sr-only" id="risk-h">Riskkoll</h2>
          <p style="margin:0;color:rgba(255,255,255,0.85);font-size:15px">${esc(s.sammanfattning)}</p>
          ${s.saknarNyckeltal ? '<span class="small faint">Datakällan har inga nyckeltal för det här värdepappret med nuvarande plan.</span>' : ''}
          <span class="small faint">Ett högre tal betyder mer risk, inte att aktien är dålig.</span>
        </section>

        ${s.faktorer?.length ? `<section class="card" style="padding:8px 22px" aria-label="Riskens delar">
          ${s.faktorer.map(([namn, l, varde, text]) => `
            <div class="factor-row">
              <span style="font-weight:500">${esc(namn)}${tip(namn)}</span>
              <span class="pill ${LV[l].c}">${LV[l].t}</span>
              <span class="small muted num" style="grid-column:1/-1">${esc(varde)}</span>
              <span style="grid-column:1/-1;font-size:14px;color:var(--ink-2)">${esc(text)}</span>
            </div>`).join('')}
        </section>` : ''}

        ${s.tank?.length ? `<section class="card stack" style="gap:10px" aria-label="Tänk på det här">
          <span class="label-up">Tänk på det här</span>
          ${s.tank.map((t) => `<span style="display:flex;gap:10px;font-size:14px;color:var(--ink-2)"><span aria-hidden="true">→</span>${esc(t)}</span>`).join('')}
        </section>` : ''}

        <details class="card" style="padding:16px 22px">
          <summary style="cursor:pointer;font-weight:500;font-size:14px">Så räknar vi fram riskkollen</summary>
          <div class="stack" style="gap:6px;margin-top:12px;color:var(--ink-2);font-size:13.5px">
            <span><b>Kurssvängningar:</b> beta och årets spann. Beta under 0,8 låg, 0,8–1,3 medel, över 1,3 hög.</span>
            <span><b>Skulder:</b> skuld delat med eget kapital. Under 0,5 låg, 0,5–1,5 medel, över 1,5 hög.</span>
            <span><b>Värdering:</b> P/E. Under 20 låg, 20–35 medel, över 35 hög. Ingen vinst räknas som hög.</span>
            <span><b>Lönsamhet:</b> vinstmarginal. Över 8 % låg, 0–8 % medel, förlust hög.</span>
            <span><b>Handel:</b> omsättning per dag. Över 50 miljoner låg, 5–50 miljoner medel, under 5 miljoner hög.</span>
            <span><b>Storlek:</b> börsvärde. Över 10 miljarder låg, 1–10 miljarder medel, under 1 miljard hög.</span>
            <span><b>Blankning</b> (svenska aktier): andel av aktierna som är blankade enligt Finansinspektionen. Under 2 % låg, 2–5 % medel, över 5 % hög.</span>
            <span>Medelvärdet räknas om till 1–10. Minst en hög del ger minst 4. En egen förenkling, inte ett råd.</span>
          </div>
        </details>
      </aside>
    </div>
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

async function mountBolag(sym) {
  const s = await getStock(sym);
  const el = $('#bolag'); if (!el) return;
  if (s.error) {
    el.innerHTML = `<div class="card stack" style="max-width:640px;padding:28px"><span class="label-up">${esc(sym)}</span><h1 class="title" style="font-size:34px">${esc(nameOf(sym))}</h1><p class="muted" style="margin:0">${esc(errText(s.error))}</p><div class="chips" id="alt"><a class="btn ghost" href="/sok" data-link>Till sök</a></div></div>`;
    // Svenska bolag saknas på gratisplanen. Föreslå samma bolag noterat i USA om det finns.
    if (sym.includes('.')) {
      const term = nameOf(sym).replace(/\b(AB|ser\.?|Shs|[AB])\b|-[AB]\b|\(publ\)/gi, ' ').replace(/\s+/g, ' ').trim().split(' ')[0];
      const r = term && term.length > 1 ? await api('/api/search?q=' + encodeURIComponent(term), 60 * 60e3) : null;
      // Bara samma bolag: samma första ord i namnet och noterat som ADR (bolagets aktie i USA)
      const STOP = new Set(['ab', 'the', 'inc', 'corp', 'co', 'ser', 'class', 'adr', 'ads', 'sponsored', 'unsponsored', 'unsp', 'shs', 'publ', 'a', 'b']);
      const first = (t) => String(t).toLowerCase().replace(/[().,]/g, ' ').split(/[\s-]+/).filter((w) => w && !STOP.has(w))[0] || '';
      const alt = r?.results?.find((x) => !x.sym.includes('.') && first(x.namn) === first(term) && (x.typ === 'ADR' || /\b(adr|sponsored|unsponsored)\b/i.test(x.namn)));
      if (alt && $('#alt')) $('#alt').insertAdjacentHTML('afterbegin', `<a class="btn" href="/bolag/${encodeURIComponent(alt.sym)}" data-link>Visa ${esc(alt.namn)} (${esc(alt.sym)}), noterad i USA</a>`);
    }
    return;
  }
  { const nm = String(s.namn).replace(/\s*\(publ\.?\)/i, '').trim(); const tk = String(s.sym || sym).replace(/\.[A-Z]{1,3}$/, ''); document.title = EN ? `${nm} (${tk}) stock: risk, insider trading and short selling · Finanskollen` : `${nm} (${tk}) aktie: risk, insynshandel och blankning · Finanskollen`; } // bolagsnamn översätts inte
  setMeta({}, EN ? `${s.namn}: risk check ${s.poang != null ? s.poang + ' of 10' : ''}, price chart, insider trading, short selling and news. Free, without buy tips.` : `${s.namn}: riskkoll ${s.poang != null ? s.poang + ' av 10' : ''}, kursdiagram, insynshandel, blankning och nyheter. Gratis och utan köptips.`);
  const crumb = $('.crumbs .here'); if (crumb) crumb.textContent = s.namn;
  el.innerHTML = bolagHTML(s);
  const sc = $('.score[data-count]', el); if (sc) countUp(sc, Number(sc.dataset.count), (v) => String(Math.round(v)), 700, 1);
  const big = $('.co-head .price-big', el); if (big && s.kurs != null) { const n = big.firstChild; if (n && n.nodeType === 3) { const span = document.createElement('span'); big.replaceChild(span, n); countUp(span, s.kurs, (v) => kr(v) + ' ', 800); } }
  el.addEventListener('click', async (e) => {
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
  // Affärsidé/historia och nyheter hämtas parallellt
  api('/api/about?s=' + encodeURIComponent(sym) + (EN ? '&lang=en' : ''), 60 * 60e3).then((a) => { const b = $('#about-body'); if (b) b.innerHTML = aboutHTML(a, s); });
  mountChart(sym, '1y');
  el.querySelector('[aria-labelledby="chart-h"] .tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-range]'); if (!b) return;
    b.parentElement.querySelectorAll('[data-range]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    mountChart(sym, b.dataset.range);
  });
  aiSummary(sym, s.namn);
  if (isSwedish(sym)) {
    const q = encodeURIComponent(s.namn);
    api('/api/insyn?namn=' + q, 60 * 60e3).then((d) => { const b = $('#insyn-body'); if (b) b.innerHTML = insynHTML(d); });
    api('/api/blankning?namn=' + q, 60 * 60e3).then((d) => { const b = $('#blank-body'); if (b) b.innerHTML = blankHTML(d); });
  }
  const n = await api('/api/news?s=' + encodeURIComponent(sym), 5 * 60e3);
  const box = $('#bolagnews'); if (!box) return;
  const items = (n?.items || []).map((x) => prepNews(x, null, sym));
  box.innerHTML = items.length ? `<div>${items.slice(0, 6).map((it) => `
    <div class="row-link" style="align-items:flex-start">
      <span class="small muted num" style="width:96px;flex:none;padding-top:2px">${esc(it.tidTxt)}</span>
      <span class="grow"><span style="display:block;font-weight:500">${newsTitle(it)}</span><span class="small muted src">${flag(it.land)}${esc(it.kalla)}</span></span>
    </div>`).join('')}</div>` : `<p class="muted" style="margin:0">${n?.error ? esc(errText(n)) : n?.ingenAtkomst ? 'Inga nyheter om bolaget hittades just nu.' : 'Inga nyheter om bolaget de senaste två veckorna.'}</p>`;
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
  'Prislarm': 'Du får en notis när en aktie du bevakar rör sig mer än gränsen du valt under dagen.'
};
const tip = (k) => (ORD[k] ? `<button type="button" class="tip" data-tip="${esc(k)}" aria-label="Vad betyder ${esc(k)}?" aria-expanded="false">?</button>` : '');
// En gemensam förklaringsruta för hela sidan
(() => {
  let box = null; let owner = null;
  const close = () => { if (box) { box.remove(); box = null; } if (owner) { owner.setAttribute('aria-expanded', 'false'); owner = null; } };
  document.addEventListener('click', (e) => {
    const b = e.target.closest?.('.tip');
    if (!b) { if (box && !e.target.closest('.tip-box')) close(); return; }
    e.preventDefault(); e.stopPropagation();
    if (owner === b) { close(); return; }
    close(); owner = b; b.setAttribute('aria-expanded', 'true');
    box = document.createElement('div'); box.className = 'tip-box'; box.setAttribute('role', 'tooltip');
    box.innerHTML = `<b>${esc(b.dataset.tip)}</b><span>${esc(ORD[b.dataset.tip] || '')}</span><a href="/ordlista" data-link>Fler förklaringar</a>`;
    document.body.append(box);
    const r = b.getBoundingClientRect(); const w = Math.min(320, innerWidth - 24);
    box.style.width = w + 'px';
    box.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width / 2 - w / 2)) + 'px';
    const below = r.bottom + 8 + box.offsetHeight < innerHeight;
    box.style.top = (below ? r.bottom + 8 + scrollY : r.top - 8 - box.offsetHeight + scrollY) + 'px';
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  window.addEventListener('popstate', close);
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
      <li><b>Portföljer:</b> innehaven du själv skriver in eller importerar under Min portfölj och dina låtsasaffärer i övningsportföljen. De syns bara för dig.</li>
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
const nfAntal = (n) => nf(n, n >= 100 ? 1 : n >= 1 ? 2 : 4);

// Kurs och växelkurs vid en tidpunkt. Valuta X till kronor via "XSEK=X".
async function priceAt(sym, t) { return api(`/api/chart?s=${encodeURIComponent(sym)}&t=${t}`, 24 * 60 * 60e3); }
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

function viewPortfolj() {
  return `${topbar([['Översikt', '/'], ['Min portfölj', '/portfolj']])}
  <div class="stack" style="gap:6px"><span class="eyebrow">Lägg in dina köp med belopp, datum och tid. Vi räknar ut resten med de riktiga kurserna.</span><h1 class="title">Min portfölj</h1></div>
  <div id="pf-sum"></div>
  <section class="card co-section" aria-labelledby="pf-tl-h">
    <div class="section-head" style="align-items:center"><div><span class="label-up">Tidslinje</span><h2 class="section" id="pf-tl-h" style="margin-top:4px">Så har dina pengar utvecklats</h2></div>
      <div class="tabs" role="tablist" aria-label="Period" id="pf-range">${[['1m', '1 mån'], ['6m', '6 mån'], ['1y', '1 år'], ['all', 'Allt']].map(([k, t]) => `<button role="tab" data-pfrange="${k}" aria-selected="${k === 'all'}">${t}</button>`).join('')}</div></div>
    <div id="pf-tl" class="chart">${loading('Räknar fram tidslinjen …')}</div>
  </section>
  <div class="pf-layout">
    <div class="stack" style="gap:20px;min-width:0">
      <section class="card co-section"><div class="section-head" style="align-items:center"><h2 class="section" style="font-size:22px">Dina innehav</h2><span class="small muted" id="pf-count"></span></div>
        <div id="pf-list">${loading('Hämtar kurser …')}</div>
      </section>
      <section class="card co-section" id="pf-add-card"><span class="label-up">Lägg till ett köp</span>
        ${pickerHTML('pf-q', 'Vilken aktie eller fond köpte du? Till exempel Volvo')}
        <div id="pf-form"></div>
      </section>
      <section class="card co-section" id="pf-import"><div class="section-head" style="align-items:center"><span class="label-up">Importera från Avanza eller Nordnet</span><span class="pill outline">CSV</span></div>
        <details class="imp-help"><summary>Så hämtar du filen</summary><ol class="om-list">
          <li><b>Avanza:</b> logga in på avanza.se, gå till <b>Transaktioner</b>, välj hela perioden och tryck på <b>Exportera</b>.</li>
          <li><b>Nordnet:</b> logga in på nordnet.se, gå till <b>Transaktioner och notor</b>, välj hela perioden och tryck på <b>Exportera</b>.</li>
          <li>Välj filen här nedanför. Filen läses bara i din webbläsare och skickas aldrig till oss.</li></ol></details>
        <label class="btn ghost imp-file">${svg('plus', 14)} Välj fil<input type="file" accept=".csv,.txt,text/csv,text/plain" data-impfile hidden></label>
        <div id="pf-imp"></div>
      </section>
    </div>
    <div class="stack" style="gap:20px;min-width:0" id="pf-side"></div>
  </div>
  <p class="small faint" style="margin:0">Köpen sparas på ditt konto och syns bara för dig. Vi räknar med kursen vid den tid du anger (timkurser för de senaste två åren, annars dagens stängningskurs) och med växelkursen samma dag. Avgifter som courtage räknas inte med. Portföljkollen är en förenkling och inget råd.</p>
  ${footer()}`;
}

// Portföljens siffror, gemensamt för Min portfölj och översikten
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
  for (const h of hold) { h.raknas = h.dag === refDag; h.d1Dag = h.raknas ? h.d1 : null; h.idag = h.raknas && h.varde != null && h.d1 != null ? h.varde - h.varde / (1 + h.d1 / 100) : null; }
  const dagIdag = refDag === sthlmDay(Date.now());
  const tot = hold.reduce((a, h) => a + (h.varde || 0), 0);
  // Vinst räknas på de köp där vi vet vad du betalade
  const kanda = buys.filter((b) => b.insattSek != null && b.varde != null);
  const insatt = kanda.reduce((a, b) => a + b.insattSek, 0);
  const kandaInsatt = kanda.length > 0;
  const okanda = buys.length - kanda.length;
  const vinst = kandaInsatt ? kanda.reduce((a, b) => a + b.varde, 0) - insatt : null;
  const idag = hold.reduce((a, h) => a + (h.idag || 0), 0);
  const scored = hold.filter((h) => h.poang != null && h.varde);
  const risk = scored.length ? scored.reduce((a, h) => a + h.poang * h.varde, 0) / scored.reduce((a, h) => a + h.varde, 0) : null;

  return { syms, quotes, S, valOf, fxNow, buys, hold, tot, insatt, kandaInsatt, okanda, vinst, idag, risk, refDag, dagIdag };
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

  /* ---- Beräkningar ---- */
  let cache = null; // { quotes, stocks, fx, hist }
  const draw = async () => {
    $('#pf-count').textContent = port.length ? `${new Set(port.map((x) => x.sym)).size} st` : '';
    if (!port.length) {
      $('#pf-sum').innerHTML = '';
      $('#pf-tl').innerHTML = '<div class="empty">Tidslinjen visas när du har lagt in ditt första köp.</div>';
      $('#pf-list').innerHTML = '<div class="empty">Du har inga köp inlagda än. Sök fram aktien du köpte nedanför, och skriv belopp, datum och tid.</div>';
      $('#pf-side').innerHTML = `<section class="card co-section"><span class="label-up">Så fungerar det</span><ol class="om-list">
        <li><b>Sök fram aktien</b> eller fonden du köpte.</li>
        <li><b>Skriv beloppet</b> och valutan du betalade med, till exempel 5 000 kr.</li>
        <li><b>Välj datum och klockslag</b> för köpet. Vi hämtar den riktiga kursen vid just den tiden och räknar ut hur många aktier du fick.</li>
        <li>Du ser direkt <b>värde, vinst eller förlust, en tidslinje</b> och <b>riskkollen</b> för hela portföljen.</li>
        <li>Har du Avanza eller Nordnet? <b>Importera alla dina affärer</b> på en gång med en fil från banken, längre ner på sidan.</li></ol>
        <p class="small muted" style="margin:0">Ingenting kopplas till din bank. Du skriver in allt själv, och bara du ser det.</p></section>`;
      return;
    }
    const { syms, quotes, valOf, fxNow, buys, hold, tot, insatt, kandaInsatt, okanda, vinst, idag, risk } = await pfData(port);
    if (!$('#pf-list')) return;
    const lv = risk != null ? LV[lvlOf(Math.round(risk))] : null;
    const first = buys.filter((b) => b.tid).map((b) => new Date(b.tid).getTime()).sort((a, b) => a - b)[0];

    $('#pf-sum').innerHTML = `<div class="statbar card pf-stats">
      <div class="stat"><span class="small muted">Värde nu</span><span class="num big">${sekBig(tot)}</span></div>
      <div class="stat"><span class="small muted">Insatt</span><span class="num">${kandaInsatt ? sekBig(insatt) : '–'}</span><span class="small faint">${first ? 'sedan ' + esc(new Date(first).toLocaleDateString(L, { day: 'numeric', month: 'short', year: 'numeric' })) : ''}${okanda ? ` · ${okanda} köp utan belopp räknas inte` : ''}</span></div>
      <div class="stat"><span class="small muted">Vinst eller förlust</span><span class="num" style="color:var(--${tone(vinst)})">${vinst != null ? `${vinst >= 0 ? '+' : '−'}${sekBig(Math.abs(vinst))}` : '–'}</span><span class="small" style="color:var(--${tone(vinst)})">${vinst != null && insatt ? pct((vinst / insatt) * 100, 1) : ''}</span></div>
      <a class="stat stat-link" href="/idag" data-link><span class="small muted">I dag ›</span><span class="num" style="color:var(--${tone(idag)})">${idag ? `${idag > 0 ? '+' : '−'}${sekBig(Math.abs(idag))}` : '–'}</span><span class="small faint">${tot && idag ? pct((idag / (tot - idag)) * 100, 1) : ''}</span></a>
      <div class="stat"><span class="small muted">Riskkoll för hela portföljen${tip('Riskkoll')}</span><span class="num">${risk != null ? `${nf(risk, 1)} / 10` : '–'}</span>${lv ? `<span class="pill ${lv.c}" style="align-self:flex-start">${lv.t}</span>` : ''}</div>
    </div>`;

    /* ---- Innehav ---- */
    const sorted = hold.slice().sort((a, b) => (b.varde || 0) - (a.varde || 0));
    $('#pf-list').innerHTML = `<div class="pf-holdings">${sorted.map((h) => `
      <div class="pf-hold ${open === h.sym ? 'open' : ''}">
        <button type="button" class="pf-row" data-pfopen="${esc(h.sym)}" aria-expanded="${open === h.sym}">
          ${av(h.sym)}
          <span class="grow pf-name"><b>${symFlag(h.sym, 'mob-pf')}${esc(h.namn)}</b><span class="small muted">${esc(nfAntal(h.antal))} st · ${h.kurs != null ? esc(kr(h.kurs)) + ' ' + esc(cur(h.valuta)) : 'kurs saknas'}${h.bs.length > 1 ? ` · ${h.bs.length} köp` : ''}</span></span>
          <span class="pf-val"><b class="num">${h.varde != null ? sek(h.varde) : '–'}</b><span class="small num" style="color:var(--${tone(h.vinst)})">${h.vinst != null ? `${h.vinst >= 0 ? '+' : '−'}${sek(Math.abs(h.vinst))} (${pct((h.vinst / h.insatt) * 100, 1)})` : h.bs.some((b) => b.gammal) ? 'köpdatum saknas' : ''}</span></span>
          <span class="pf-chev" aria-hidden="true">${svg('arrow', 14)}</span>
        </button>
        ${open === h.sym ? `<div class="pf-detail">
          <div class="pf-facts">
            <div><span class="small muted">Andel av portföljen</span><b class="num">${h.varde && tot ? nf((h.varde / tot) * 100, 0) + ' %' : '–'}</b></div>
            <div><span class="small muted">Snittkurs vid köp</span><b class="num">${h.snitt ? esc(kr(h.snitt)) + ' ' + esc(cur(h.valuta)) : '–'}</b></div>
            <div><span class="small muted">I dag</span><b class="num" style="color:var(--${tone(h.d1)})">${h.d1 != null ? pct(h.d1, 1) : '–'}</b></div>
            <div><span class="small muted">Riskkoll${tip('Riskkoll')}</span><b class="num">${h.poang != null ? `${h.poang} / 10 · ${LV[lvlOf(h.poang)].t}` : 'för lite data'}</b></div>
          </div>
          <div class="pf-buys"><span class="label-up">Dina köp</span>${h.bs.slice().sort((a, b) => String(b.tid).localeCompare(String(a.tid))).map((b) => `
            <div class="pf-buy">
              <span class="grow"><b>${b.tid ? esc(fmtTid(b.tid)) : 'Köpdatum saknas'}</b><span class="small muted">${b.belopp ? `${esc(nf(b.belopp, 0))} ${esc(b.valuta)} · ` : ''}${esc(nfAntal(b.antal))} st${b.kurs ? ` à ${esc(kr(b.kurs))} ${esc(cur(b.kursValuta || h.valuta))}` : ''}</span></span>
              <span class="pf-val"><b class="num small">${b.varde != null ? sek(b.varde) : '–'}</b><span class="small num" style="color:var(--${tone(b.vinst)})">${b.vinst != null ? `${b.vinst >= 0 ? '+' : '−'}${sek(Math.abs(b.vinst))}` : ''}</span></span>
              <button type="button" class="linkbtn small danger-link" data-pfdel="${esc(b.id)}" aria-label="Ta bort köpet">Ta bort</button>
            </div>`).join('')}
            ${h.bs.some((b) => b.gammal) ? '<p class="small muted" style="margin:0">Det här innehavet lades in innan vi frågade efter datum. Ta bort det och lägg in köpet igen med belopp, datum och tid för rätt siffror och tidslinje.</p>' : ''}
          </div>
          <div class="chips"><button type="button" class="btn ghost small" data-pfmore="${esc(h.sym)}">${svg('plus', 13)} Lägg till ett köp till</button><a class="btn ghost small" href="/bolag/${encodeURIComponent(h.sym)}" data-link>Bolagssida och riskkoll</a></div>
        </div>` : ''}
      </div>`).join('')}</div>`;

    /* ---- Portföljkollen ---- */
    const { br } = pfInsight(hold, tot, '#pf-side', true);
    getKalender(syms).then(dividendPlan).then((plan) => {
      const side = $('#pf-side'); if (!side || !plan.rows.length) return;
      $('#pf-utd')?.remove();
      side.insertAdjacentHTML('afterbegin', `<section class="card co-section" id="pf-utd"><span class="label-up">Utdelning</span><div><span class="num" style="font-size:26px">${sekBig(plan.total)}</span> <span class="small muted">per år</span></div><p class="small muted" style="margin:0">Väntad utdelning för dina aktier, räknat på den senast kända utdelningen per aktie.</p><a class="btn ghost small" href="/kalender" data-link style="align-self:flex-start">${svg('calendar', 14)} Rapporter och utdelningsdagar</a></section>`);
    }).catch(() => {});

    cache = { buys, valOf, quotes, fxNow, tot, insatt };
    timeline();
  };

  /* ---- Tidslinje: värdet dag för dag jämfört med insatta pengar ---- */
  let tlSeq = 0;
  const timeline = async () => {
    const id = ++tlSeq; const box = $('#pf-tl'); if (!box || !cache) return;
    if (!cache.buys.some((b) => b.tid && b.insattSek != null)) { box.innerHTML = '<div class="empty">Tidslinjen kräver köp med datum. Lägg in dina köp med belopp, datum och tid.</div>'; return; }
    box.classList.add('is-loading');
    const ser = await pfSeries(cache);
    if (id !== tlSeq || !$('#pf-tl')) return;
    box.classList.remove('is-loading');
    if (ser.error) { box.innerHTML = '<div class="empty">Tidslinjen visas när det finns minst två dagars kurser efter ditt första köp.</div>'; return; }
    drawMoneyChart(box, rangeCut(ser.value, range, ser.tNow), rangeCut(ser.invested, range, ser.tNow));
  };

  /* ---- Händelser ---- */
  $('.main').addEventListener('click', (e) => {
    const o = e.target.closest('[data-pfopen]'); if (o) { open = open === o.dataset.pfopen ? null : o.dataset.pfopen; draw(); return; }
    const m = e.target.closest('[data-pfmore]'); if (m) { formFor(m.dataset.pfmore, nameOf(m.dataset.pfmore)); $('#pf-add-card').scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    if (e.target.closest('[data-pfcancel]')) { $('#pf-form').innerHTML = ''; return; }
    const d = e.target.closest('[data-pfdel]'); if (d) { const b = port.find((x) => x.id === d.dataset.pfdel); port = port.filter((x) => x.id !== d.dataset.pfdel); save(); toast('Köpet är borttaget', b ? nameOf(b.sym) : ''); draw(); return; }
    const r = e.target.closest('[data-pfrange]'); if (r) { range = r.dataset.pfrange; document.querySelectorAll('[data-pfrange]').forEach((x) => x.setAttribute('aria-selected', String(x === r))); timeline(); }
  });
  draw();
}

// Tidslinje för pengar: värdet som yta och insatta pengar som streckad linje, med förklaring vid hovring
// Gemensamt för Min portfölj och Övningsportföljen
const holdMeta = (s, st) => ({
  poang: st?.poang ?? null, bransch: st?.fakta?.find((f) => f[0] === 'Bransch')?.[1] || (st?.typ === 'ETF' ? 'Fonder (ETF)' : 'Okänd bransch'),
  land: st?.fakta?.find((f) => f[0] === 'Land')?.[1] || (s.endsWith('.ST') ? 'Sverige' : 'Övriga'), typ: st?.typ, faktorer: st?.faktorer || []
});
// Portföljkollen, riskkollen för helheten och fördelning per bransch och land
function pfInsight(hold, tot, target, aiLink) {
  const sorted = hold.slice().sort((a, b) => (b.varde || 0) - (a.varde || 0));
    const group = (key) => { const m = {}; for (const h of hold) if (h.varde) m[h[key]] = (m[h[key]] || 0) + h.varde; return Object.entries(m).sort((a, b) => b[1] - a[1]); };
    const br = group('bransch'); const la = group('land');
    const top = sorted.find((h) => h.varde);
    const n = hold.filter((h) => h.varde).length;
    const etfShare = hold.filter((h) => h.typ === 'ETF' || h.typ === 'Fond').reduce((a, h) => a + (h.varde || 0), 0) / (tot || 1);
    const flags = [];
    if (top && tot && top.varde / tot > 0.25 && n > 1) flags.push(['warn', `${top.namn} är ${nf((top.varde / tot) * 100, 0)} % av portföljen. Faller den aktien märks det mycket på helheten.`]);
    if (br[0] && tot && br[0][1] / tot > 0.5 && n > 1) flags.push(['warn', `${nf((br[0][1] / tot) * 100, 0)} % ligger i ${br[0][0].toLowerCase()}. Går det dåligt för branschen påverkas en stor del av dina pengar samtidigt.`]);
    if (n < 5 && etfShare < 0.5) flags.push(['warn', `Du har ${n} ${n === 1 ? 'innehav' : 'innehav'}. Med färre än fem bolag kan ett enskilt fall slå hårt. En bred fond är ett sätt många använder för att sprida risken.`]);
    const hog = hold.filter((h) => h.poang != null && h.poang >= 7 && h.varde).reduce((a, h) => a + h.varde, 0);
    if (tot && hog / tot > 0.3) flags.push(['warn', `${nf((hog / tot) * 100, 0)} % av pengarna ligger i aktier med hög riskkoll (7 eller mer).`]);
    const forlust = hold.filter((h) => h.vinst != null && h.insatt && h.vinst / h.insatt < -0.3);
    if (forlust.length) flags.push(['info', `${forlust.map((h) => h.namn).join(', ')} har gått ner mer än 30 % sedan du köpte. Titta gärna på bolagssidan vad som hänt innan du bestämmer dig.`]);
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
      ${dist('Fördelning per bransch', br)}
      ${dist('Fördelning per land', la)}`;
  return { br };
}

function drawMoneyChart(box, V, I, o = {}) {
  const inL = o.inLabel || 'Insatt';
  const W = 1000; const H = 300; const PAD = 10;
  const all = [...V, ...I]; const t0 = V[0][0]; const t1 = V[V.length - 1][0];
  let lo = Math.min(...all.map((p) => p[1])); let hi = Math.max(...all.map((p) => p[1]));
  const pad = (hi - lo) * 0.1 || hi * 0.05 || 1; lo = Math.max(0, lo - pad); hi += pad;
  const X = (t) => ((t - t0) / (t1 - t0 || 1)) * W; const Y = (v) => PAD + (1 - (v - lo) / (hi - lo)) * (H - PAD * 2);
  const path = (pts) => pts.map(([t, v], i) => `${i ? 'L' : 'M'}${X(t).toFixed(1)},${Y(v).toFixed(1)}`).join('');
  const last = V[V.length - 1][1]; const lastI = I[I.length - 1][1]; const res = last - lastI;
  const startV = V[0][1]; const change = last - startV - (lastI - I[0][1]);
  const col = res >= 0 ? 'var(--up)' : 'var(--down)';
  const peak = V.reduce((a, p) => (p[1] > a[1] ? p : a), V[0]); const low = V.reduce((a, p) => (p[1] < a[1] ? p : a), V[0]);
  box.innerHTML = `
    <div class="chart-head"><span class="chart-key"><i style="background:${col}"></i>Värde <b class="num">${sekBig(last)}</b></span><span class="chart-key"><i class="dash"></i>${esc(inL)} <b class="num">${sekBig(lastI)}</b></span><span class="chart-key">Utveckling i perioden <b class="num" style="color:var(--${tone(change)})">${change >= 0 ? '+' : '−'}${sekBig(Math.abs(change))}</b></span><span class="small muted" style="margin-left:auto">${esc(fmtDag(t0))} – ${esc(fmtDag(t1))}</span></div>
    <div class="chart-plot">
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Portföljens värde över tid">
        <defs><linearGradient id="pfg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity="0.18"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
        <path d="${path(V)}L${W},${H}L0,${H}Z" fill="url(#pfg)"/>
        <path d="${path(I)}" fill="none" stroke="var(--faint)" stroke-width="1.5" stroke-dasharray="6 5" vector-effect="non-scaling-stroke"/>
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
    tipEl.innerHTML = `<span class="small muted">${esc(fmtDag(tt))}</span><b class="num">Värde ${esc(sekBig(v))}</b><span class="small">${esc(inL)} ${esc(sekBig(inv))}</span><span class="small" style="color:${v - inv >= 0 ? '#8FD3A8' : '#F4A79D'}">${v - inv >= 0 ? '+' : '−'}${esc(sekBig(Math.abs(v - inv)))} (${pct(inv ? ((v - inv) / inv) * 100 : 0, 1)})</span>`;
    const tw = tipEl.offsetWidth; tipEl.style.transform = `translateX(${Math.min(r.width - tw, Math.max(0, px - tw / 2))}px)`;
  };
  plot.addEventListener('pointermove', (e) => { lastX = e.clientX; if (!frame) frame = requestAnimationFrame(move); });
  plot.addEventListener('pointerleave', () => { tipEl.hidden = true; cross.hidden = true; dot.hidden = true; });
}

/* ================= Övningsportfölj ================= */
const OKEY = 'mk-ova';
const START_KASSA = 100000;
const newOva = () => ({ kassa: START_KASSA, start: new Date().toISOString(), innehav: {}, historik: [] });
const getOva = () => { const v = readLS(OKEY, null); return v && typeof v.kassa === 'number' && v.innehav ? v : newOva(); };

function viewOva() {
  return `${topbar([['Översikt', '/'], ['Övningsportfölj', '/ova']])}
  <div class="stack" style="gap:6px"><span class="eyebrow">Öva med 100 000 låtsaskronor på riktiga kurser, helt utan risk</span><h1 class="title">Övningsportfölj</h1></div>
  <div id="ov-sum"></div>
  <section class="card co-section" aria-labelledby="ov-tl-h">
    <div class="section-head" style="align-items:center"><div><span class="label-up">Tidslinje</span><h2 class="section" id="ov-tl-h" style="margin-top:4px">Så har dina låtsaspengar utvecklats</h2></div>
      <div class="tabs" role="tablist" aria-label="Period">${[['1m', '1 mån'], ['6m', '6 mån'], ['1y', '1 år'], ['all', 'Allt']].map(([k, t]) => `<button role="tab" data-ovrange="${k}" aria-selected="${k === 'all'}">${t}</button>`).join('')}</div></div>
    <div id="ov-tl" class="chart">${loading('Räknar fram tidslinjen …')}</div>
  </section>
  <div class="pf-layout">
    <div class="stack" style="gap:20px;min-width:0">
      <section class="card co-section"><div class="section-head" style="align-items:center"><h2 class="section" style="font-size:22px">Dina innehav</h2><span class="pill">Låtsaspengar</span></div>
        <div id="ov-list">${loading('Hämtar kurser …')}</div>
      </section>
      <section class="card co-section" id="ov-add-card"><span class="label-up">Handla</span>
        ${pickerHTML('ov-q', 'Sök aktie eller fond att köpa, till exempel Apple')}
        <div id="ov-trade"></div>
      </section>
      <section class="card co-section"><span class="label-up">Senaste affärerna</span><div id="ov-hist"></div></section>
    </div>
    <div class="stack" style="gap:20px;min-width:0">
      <div class="stack" style="gap:20px" id="ov-side"></div>
      <section class="card co-section"><span class="label-up">Bra att veta</span><ul class="om-list"><li>Du handlar till senaste kursen, utan avgifter. I verkligheten kostar varje affär lite (courtage).</li><li>Utländska aktier räknas om till kronor med dagens växelkurs.</li><li>Det här är bara för att lära sig. Låtsaspengar kan inte tas ut.</li></ul>
        <button class="linkbtn small danger-link" type="button" data-ovreset>Börja om med 100 000 kr</button></section>
    </div>
  </div>
  ${footer()}`;
}

function mountOva() {
  let ova = getOva();
  const save = () => writeLS(OKEY, ova);
  let quotes = {}; let fx = { SEK: 1 }; let S = {};
  let open = null; let range = 'all';
  const priceSek = (sym) => { const q = quotes[sym]; if (!q?.kurs) return null; const r = fx[q.valuta || 'SEK']; return r ? q.kurs * r : null; };

  /* ---- Köp och sälj: skriv antal eller belopp, det andra räknas ut ---- */
  const tradeForm = async (sym, namn, mode = 'kop') => {
    $('#ov-trade').innerHTML = loading('Hämtar kurs …');
    const q = await getQuotes([sym]); quotes = { ...quotes, ...q };
    fx = { ...fx, ...(await fxToSek([q[sym]?.valuta])) };
    const p = priceSek(sym); const has = ova.innehav[sym]?.antal || 0;
    if (!p) { $('#ov-trade').innerHTML = '<div class="empty">Kursen saknas just nu, så det går inte att handla den här.</div>'; return; }
    const max = mode === 'kop' ? Math.floor(ova.kassa / p) : has;
    $('#ov-trade').innerHTML = `<form class="pf-form" data-ovform="${esc(sym)}" novalidate>
      <div class="picked">${av(sym)}<span class="grow"><b style="display:block;font-weight:500">${esc(namn || nameOf(sym))}</b><span class="small muted">${esc(kr(q[sym].kurs))} ${esc(cur(q[sym].valuta))}${q[sym].valuta !== 'SEK' ? ` · ${sek(p)}` : ''} per aktie · du äger ${has} st</span></span></div>
      <div class="tabs" role="tablist" aria-label="Köp eller sälj" style="align-self:flex-start"><button type="button" role="tab" data-ovmode="kop" aria-selected="${mode === 'kop'}">Köp</button><button type="button" role="tab" data-ovmode="salj" aria-selected="${mode === 'salj'}" ${has ? '' : 'disabled'}>Sälj</button></div>
      <div class="pf-fields">
        <label class="field"><span>Antal aktier</span><input name="antal" type="number" min="1" step="1" max="${max}" inputmode="numeric" placeholder="Max ${max} st"></label>
        <label class="field"><span>Eller belopp i kronor</span><input name="belopp" type="number" min="1" step="any" inputmode="decimal" placeholder="T.ex. 10 000"></label>
      </div>
      <div class="pf-preview" data-ovsum><span class="small muted">${mode === 'kop' ? `Du har ${sek(ova.kassa)} i låtsaspengar.` : `Du äger ${has} st, värda ${sek(has * p)}.`}</span></div>
      <div class="chips"><button class="btn" type="submit" disabled>${mode === 'kop' ? 'Köp' : 'Sälj'} med låtsaspengar</button><button class="btn ghost" type="button" data-ovcancel>Avbryt</button><button class="linkbtn small" type="button" data-ovmax>${mode === 'kop' ? 'Köp för allt' : 'Sälj alla'}</button></div></form>`;
    const f = $('[data-ovform]'); f.dataset.mode = mode;
    const out = f.querySelector('[data-ovsum]'); const btn = f.querySelector('[type=submit]');
    const show = (n) => {
      btn.disabled = true;
      if (!n) { out.innerHTML = `<span class="small muted">${mode === 'kop' ? `Du har ${sek(ova.kassa)} i låtsaspengar.` : `Du äger ${has} st.`}</span>`; return; }
      if (n > max) { out.innerHTML = `<span class="small" style="color:var(--down)">${mode === 'kop' ? `Du har låtsaspengar till högst ${max} st.` : `Du äger bara ${has} st.`}</span>`; return; }
      out.innerHTML = `<div class="pf-calc">
        <div><span class="small muted">Antal</span><b class="num">${n} st</b><span class="small faint">à ${esc(sek(p))}</span></div>
        <div><span class="small muted">${mode === 'kop' ? 'Kostar' : 'Du får'}</span><b class="num">${esc(sek(n * p))}</b><span class="small faint">utan avgifter</span></div>
        <div><span class="small muted">Kontanter efteråt</span><b class="num">${esc(sek(ova.kassa + (mode === 'kop' ? -1 : 1) * n * p))}</b><span class="small faint">låtsaspengar</span></div></div>`;
      btn.disabled = false;
    };
    f.antal.addEventListener('input', () => { const n = Math.floor(Number(f.antal.value)) || 0; f.belopp.value = n ? Math.round(n * p) : ''; f.dataset.n = n; show(n); });
    f.belopp.addEventListener('input', () => { const n = Math.floor((Number(String(f.belopp.value).replace(',', '.')) || 0) / p); f.antal.value = n || ''; f.dataset.n = n; show(n); });
    f.querySelector('[data-ovmax]').addEventListener('click', () => { f.antal.value = max; f.antal.dispatchEvent(new Event('input')); });
    f.antal.focus();
  };
  bindPicker('ov-q', (sym, namn) => { rememberName(sym, namn || nameOf(sym)); tradeForm(sym, namn, 'kop'); });

  /* ---- Översikt, innehav och portföljkollen ---- */
  let cache = null;
  const draw = async () => {
    const syms = Object.keys(ova.innehav);
    if (syms.length) {
      const [q, st] = await Promise.all([getQuotes(syms), Promise.all(syms.map((s) => (S[s] !== undefined ? S[s] : getStock(s))))]);
      quotes = { ...quotes, ...q }; syms.forEach((s, i) => { S[s] = st[i]?.error ? null : st[i]; });
      fx = { ...fx, ...(await fxToSek(syms.map((s) => quotes[s]?.valuta))) };
    }
    if (!$('#ov-list')) return;
    const hold = syms.map((s) => {
      const h = ova.innehav[s]; const p = priceSek(s); const varde = p != null ? p * h.antal : null; const d1 = quotes[s]?.d1 ?? S[s]?.d1 ?? null;
      return { sym: s, namn: nameOf(s), antal: h.antal, insatt: h.kostnad, varde, vinst: varde != null ? varde - h.kostnad : null, d1, idag: varde != null && d1 != null && tradedToday(quotes[s]?.tid ?? S[s]?.kursTid) ? varde - varde / (1 + d1 / 100) : null, kurs: quotes[s]?.kurs ?? null, valuta: quotes[s]?.valuta || 'SEK', ...holdMeta(s, S[s]) };
    });
    const innehav = hold.reduce((a, h) => a + (h.varde ?? h.insatt), 0);
    const tot = ova.kassa + innehav; const res = tot - START_KASSA;
    const idag = hold.reduce((a, h) => a + (h.idag || 0), 0);
    const scored = hold.filter((h) => h.poang != null && h.varde);
    const risk = scored.length ? scored.reduce((a, h) => a + h.poang * h.varde, 0) / scored.reduce((a, h) => a + h.varde, 0) : null;
    const lv = risk != null ? LV[lvlOf(Math.round(risk))] : null;
    $('#ov-sum').innerHTML = `<div class="statbar card pf-stats">
      <div class="stat"><span class="small muted">Totalt värde</span><span class="num big">${sekBig(tot)}</span><span class="small faint">startade med ${sekBig(START_KASSA)} ${esc(new Date(ova.start).toLocaleDateString(L, { day: 'numeric', month: 'short', year: 'numeric' }))}</span></div>
      <div class="stat"><span class="small muted">Vinst eller förlust</span><span class="num" style="color:var(--${tone(res)})">${res >= 0 ? '+' : '−'}${sekBig(Math.abs(res))}</span><span class="small" style="color:var(--${tone(res)})">${pct((res / START_KASSA) * 100, 1)}</span></div>
      <div class="stat"><span class="small muted">I dag</span><span class="num" style="color:var(--${tone(idag)})">${idag ? `${idag > 0 ? '+' : '−'}${sekBig(Math.abs(idag))}` : '–'}</span><span class="small faint">${innehav && idag ? pct((idag / (innehav - idag)) * 100, 1) + ' på aktierna' : ''}</span></div>
      <div class="stat"><span class="small muted">Kontanter</span><span class="num">${sekBig(ova.kassa)}</span><span class="small faint">i aktier ${sekBig(innehav)}</span></div>
      <div class="stat"><span class="small muted">Riskkoll för hela portföljen${tip('Riskkoll')}</span><span class="num">${risk != null ? `${nf(risk, 1)} / 10` : '–'}</span>${lv ? `<span class="pill ${lv.c}" style="align-self:flex-start">${lv.t}</span>` : ''}</div>
    </div>`;

    const sorted = hold.slice().sort((a, b) => (b.varde || 0) - (a.varde || 0));
    const affarer = (s) => ova.historik.filter((h) => h.sym === s).slice().reverse();
    $('#ov-list').innerHTML = sorted.length ? `<div class="pf-holdings">${sorted.map((h) => `
      <div class="pf-hold ${open === h.sym ? 'open' : ''}">
        <button type="button" class="pf-row" data-ovopen="${esc(h.sym)}" aria-expanded="${open === h.sym}">
          ${av(h.sym)}
          <span class="grow pf-name"><b>${symFlag(h.sym, 'mob-pf')}${esc(h.namn)}</b><span class="small muted">${h.antal} st · ${h.kurs != null ? esc(kr(h.kurs)) + ' ' + esc(cur(h.valuta)) : 'kurs saknas'}</span></span>
          <span class="pf-val"><b class="num">${h.varde != null ? sek(h.varde) : '–'}</b><span class="small num" style="color:var(--${tone(h.vinst)})">${h.vinst != null && h.insatt ? `${h.vinst >= 0 ? '+' : '−'}${sek(Math.abs(h.vinst))} (${pct((h.vinst / h.insatt) * 100, 1)})` : ''}</span></span>
          <span class="pf-chev" aria-hidden="true">${svg('arrow', 14)}</span>
        </button>
        ${open === h.sym ? `<div class="pf-detail">
          <div class="pf-facts">
            <div><span class="small muted">Andel av aktierna</span><b class="num">${h.varde && innehav ? nf((h.varde / innehav) * 100, 0) + ' %' : '–'}</b></div>
            <div><span class="small muted">Snittpris vid köp</span><b class="num">${h.antal ? esc(sek(h.insatt / h.antal)) : '–'}</b></div>
            <div><span class="small muted">I dag</span><b class="num" style="color:var(--${tone(h.d1)})">${h.d1 != null ? pct(h.d1, 1) : '–'}</b></div>
            <div><span class="small muted">Riskkoll${tip('Riskkoll')}</span><b class="num">${h.poang != null ? `${h.poang} / 10 · ${LV[lvlOf(h.poang)].t}` : 'för lite data'}</b></div>
          </div>
          <div class="pf-buys"><span class="label-up">Dina affärer</span>${affarer(h.sym).slice(0, 8).map((a) => `
            <div class="pf-buy"><span class="pill ${a.typ === 'Köp' ? 'up' : 'down'}">${esc(a.typ)}</span>
              <span class="grow"><b>${esc(fmtTid(a.t))}</b><span class="small muted">${a.antal} st à ${esc(kr(a.pris))} ${esc(cur(a.valuta))}</span></span>
              <span class="pf-val"><b class="num small">${sek(a.belopp)}</b></span></div>`).join('')}</div>
          <div class="chips"><button type="button" class="btn ghost small" data-ovbuy="${esc(h.sym)}">${svg('plus', 13)} Köp mer</button><button type="button" class="btn ghost small" data-ovsell="${esc(h.sym)}">Sälj</button><a class="btn ghost small" href="/bolag/${encodeURIComponent(h.sym)}" data-link>Bolagssida och riskkoll</a></div>
        </div>` : ''}
      </div>`).join('')}</div>`
      : '<div class="empty">Du äger inga aktier än. Sök fram en aktie under Handla och gör ditt första låtsasköp.</div>';

    $('#ov-hist').innerHTML = ova.historik.length ? `<div>${ova.historik.slice(-8).reverse().map((h) => `<div class="row-link" style="gap:12px"><span class="pill ${h.typ === 'Köp' ? 'up' : 'down'}">${esc(h.typ)}</span><span class="grow"><b style="font-weight:500">${esc(nameOf(h.sym))}</b><span class="small muted" style="display:block">${h.antal} st · ${esc(fmtTid(h.t))}</span></span><span class="num small">${sek(h.belopp)}</span></div>`).join('')}</div>` : '<p class="small muted" style="margin:0">Inga affärer än.</p>';

    if (hold.some((h) => h.varde)) pfInsight(hold, innehav, '#ov-side', false);
    else $('#ov-side').innerHTML = `<section class="card co-section"><span class="label-up">Så fungerar det</span><ol class="om-list">
      <li><b>Sök fram en aktie</b> eller fond under Handla.</li>
      <li><b>Skriv antal eller belopp</b>, till exempel 10 000 kr. Du handlar till den riktiga kursen just nu.</li>
      <li>Du ser direkt <b>värde, vinst eller förlust, en tidslinje</b> och <b>riskkollen</b> för hela portföljen, precis som i Min portfölj.</li></ol></section>`;
    cache = { tot };
    timeline();
  };

  /* ---- Tidslinje: spelar upp alla affärer dag för dag ---- */
  let tlSeq = 0;
  const timeline = async () => {
    const id = ++tlSeq; const box = $('#ov-tl'); if (!box) return;
    const trades = ova.historik.slice().sort((a, b) => a.t.localeCompare(b.t));
    if (!trades.length) { box.innerHTML = '<div class="empty">Tidslinjen visas efter din första affär.</div>'; return; }
    // Läget före den äldsta sparade affären räknas baklänges från dagens läge.
    // Kontot sparar bara de senaste affärerna, så på en ny enhet kan de första saknas.
    let k0 = ova.kassa; const n0 = Object.fromEntries(Object.entries(ova.innehav).map(([x, h]) => [x, h.antal]));
    for (const a of trades) { const buy = a.typ === 'Köp'; k0 += buy ? a.belopp : -a.belopp; n0[a.sym] = (n0[a.sym] || 0) + (buy ? -a.antal : a.antal); }
    if (Object.values(n0).some((v) => v < -1e-6)) { box.innerHTML = '<div class="empty">Tidslinjen kan inte räknas fram för de här affärerna. Den visas som vanligt om du börjar om.</div>'; return; }
    const complete = Math.abs(k0 - START_KASSA) < 5 && Object.values(n0).every((v) => Math.abs(v) < 1e-6);
    box.classList.add('is-loading');
    const start = (complete && ova.start < trades[0].t ? ova.start : trades[0].t).slice(0, 10);
    const syms = [...new Set([...trades.map((a) => a.sym), ...Object.keys(n0).filter((x) => n0[x] > 0)])];
    const first = (s) => (n0[s] > 0 ? start : trades.find((a) => a.sym === s).t.slice(0, 10));
    const curOf = (s) => trades.find((a) => a.sym === s)?.valuta || quotes[s]?.valuta || 'SEK';
    const curs = [...new Set(syms.map(curOf).filter((c) => c && c !== 'SEK'))];
    const [hist, fxh] = await Promise.all([
      Promise.all(syms.map((s) => api(`/api/chart?s=${encodeURIComponent(s)}&from=${first(s)}`, 30 * 60e3))),
      Promise.all(curs.map((c) => api(`/api/chart?s=${encodeURIComponent((c === 'GBp' || c === 'GBX' ? 'GBP' : c) + 'SEK=X')}&from=${start}`, 30 * 60e3)))
    ]);
    if (id !== tlSeq || !$('#ov-tl')) return;
    box.classList.remove('is-loading');
    const H = Object.fromEntries(syms.map((s, i) => [s, hist[i]?.punkter || []]));
    const F = Object.fromEntries(curs.map((c, i) => [c, (fxh[i]?.punkter || []).map(([t, v]) => [t, c === 'GBp' || c === 'GBX' ? v / 100 : v])]));
    const at = (pts, t) => { let v = null; for (const p of pts) { if (p[0] <= t) v = p[1]; else break; } return v ?? pts[0]?.[1] ?? null; };
    const valuta = Object.fromEntries(syms.map((x) => [x, curOf(x)]));
    const DAY = 86400; const t0 = Math.floor(new Date(start + 'T00:00:00Z').getTime() / 1000); const tNow = Math.floor(Date.now() / 1000);
    const step = tNow - t0 > 3 * 365 * DAY ? 7 * DAY : DAY;
    const V = []; const I = [];
    for (let t = t0 + DAY - 1; ; t += step) {
      const tt = Math.min(t, tNow); let kassa = k0; const n = { ...n0 };
      for (const a of trades) { if (new Date(a.t).getTime() / 1000 > tt) break; kassa += a.typ === 'Köp' ? -a.belopp : a.belopp; n[a.sym] = (n[a.sym] || 0) + (a.typ === 'Köp' ? a.antal : -a.antal); }
      let v = kassa; let ok = true;
      for (const [s, cnt] of Object.entries(n)) {
        if (cnt <= 0) continue; const live = tt >= tNow - 60; const c = valuta[s];
        const k = live ? (quotes[s]?.kurs ?? at(H[s], tt)) : at(H[s], tt);
        const r = c === 'SEK' ? 1 : live ? (fx[c] ?? at(F[c], tt)) : at(F[c], tt);
        if (k == null || r == null) { ok = false; break; }
        v += cnt * k * r;
      }
      if (ok) { V.push([tt, Math.round(v)]); I.push([tt, START_KASSA]); }
      if (tt === tNow) break;
    }
    if (V.length < 2) { box.innerHTML = '<div class="empty">Tidslinjen visas när det finns minst två dagars kurser efter din första affär. Kom tillbaka i morgon!</div>'; return; }
    const from = range === 'all' ? 0 : tNow - ({ '1m': 31, '6m': 183, '1y': 366 }[range]) * DAY;
    const v2 = V.filter((p) => p[0] >= from); const i2 = I.filter((p) => p[0] >= from);
    drawMoneyChart(box, v2.length > 1 ? v2 : V.slice(-2), i2.length > 1 ? i2 : I.slice(-2), { inLabel: 'Start', note: 'Streckad linje = de 100 000 låtsaskronor du började med. Ytan = vad portföljen var värd varje dag, kontanter inräknade.' });
  };

  $('.main').addEventListener('click', (e) => {
    const o = e.target.closest('[data-ovopen]'); if (o) { open = open === o.dataset.ovopen ? null : o.dataset.ovopen; draw(); return; }
    const b = e.target.closest('[data-ovbuy],[data-ovsell]');
    if (b) { const s = b.dataset.ovbuy || b.dataset.ovsell; tradeForm(s, nameOf(s), b.dataset.ovbuy ? 'kop' : 'salj'); $('#ov-add-card').scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    const m = e.target.closest('[data-ovmode]'); if (m && !m.disabled) { const f = $('[data-ovform]'); tradeForm(f.dataset.ovform, nameOf(f.dataset.ovform), m.dataset.ovmode); return; }
    if (e.target.closest('[data-ovcancel]')) { $('#ov-trade').innerHTML = ''; return; }
    const r = e.target.closest('[data-ovrange]'); if (r) { range = r.dataset.ovrange; document.querySelectorAll('[data-ovrange]').forEach((x) => x.setAttribute('aria-selected', String(x === r))); timeline(); return; }
    if (e.target.closest('[data-ovreset]')) {
      const d = document.createElement('div'); d.className = 'modal-back';
      d.innerHTML = `<div class="modal card" role="dialog" aria-modal="true" aria-labelledby="ovr-h"><h2 class="section" id="ovr-h" style="font-size:22px">Börja om?</h2><p style="margin:0">Alla låtsasinnehav och affärer raderas, och du får 100 000 nya låtsaskronor.</p><div class="chips" style="justify-content:flex-end"><button class="btn ghost" type="button" data-no>Avbryt</button><button class="btn" type="button" data-yes>Börja om</button></div></div>`;
      document.body.append(d);
      d.addEventListener('click', (ev) => { if (ev.target === d || ev.target.closest('[data-no]')) d.remove(); if (ev.target.closest('[data-yes]')) { ova = newOva(); open = null; save(); d.remove(); $('#ov-trade').innerHTML = ''; toast('Ny övningsportfölj', 'Du har 100 000 låtsaskronor att handla för.'); draw(); } });
    }
  });
  $('.main').addEventListener('submit', (e) => {
    const f = e.target.closest('[data-ovform]'); if (!f) return; e.preventDefault();
    const sym = f.dataset.ovform; const mode = f.dataset.mode; const n = Math.floor(Number(f.dataset.n)) || 0; const p = priceSek(sym);
    if (n < 1 || !p) return;
    const h = ova.innehav[sym] || { antal: 0, kostnad: 0 };
    if (mode === 'kop') {
      if (n * p > ova.kassa + 0.01) return;
      ova.kassa -= n * p; h.antal += n; h.kostnad += n * p; ova.innehav[sym] = h;
    } else {
      if (n > h.antal) return;
      const snitt = h.kostnad / h.antal; ova.kassa += n * p; h.antal -= n; h.kostnad -= snitt * n;
      if (h.antal <= 0) delete ova.innehav[sym]; else ova.innehav[sym] = h;
    }
    ova.historik.push({ t: new Date().toISOString(), typ: mode === 'kop' ? 'Köp' : 'Sälj', sym, antal: n, pris: quotes[sym].kurs, valuta: quotes[sym].valuta || 'SEK', belopp: Math.round(n * p * 100) / 100 });
    ova.historik = ova.historik.slice(-1000);
    ova.kassa = Math.round(ova.kassa * 100) / 100;
    save(); $('#ov-trade').innerHTML = ''; open = sym;
    toast(`${mode === 'kop' ? 'Köpt' : 'Sålt'}: ${n} st ${nameOf(sym)}`, `För ${sek(n * p)} i låtsaspengar.`);
    draw();
  });
  draw();
}

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
  // Flytta data från metadata till tabellen en gång, och gör metadata liten igen
  if (migrate) { await saveNow().catch(() => {}); const t = await token(); if (t) auth('/user', { data: { bevakning: null, larm: null, portfolj: null, ova: null, namn: null } }, 'PUT', t).then((u) => { ACC.user = u; }).catch(() => {}); }
}
function applyCloud(d) {
  const cloud = Array.isArray(d.bevakning) ? d.bevakning.filter((x) => typeof x === 'string') : null;
  const first = readLS('mk-sync-user', null) !== ACC.user.id;
  SYNCING = true;
  try {
    if (d.namn && typeof d.namn === 'object') writeLS(NKEY, { ...d.namn, ...readLS(NKEY, {}) });
    // Bara aktier man själv har lagt till slås ihop, inte startlistan med exempel
    const own = readLS(WKEY, null);
    if (cloud) writeLS(WKEY, first && Array.isArray(own) ? [...new Set([...cloud, ...own])].slice(0, 60) : cloud);
    if (d.larm && typeof d.larm === 'object') writeLS(LKEY, first ? { ...d.larm, ...getLarm() } : d.larm);
    if (d.koll && typeof d.koll === 'object') writeLS(KKEY, d.koll);
    if (Array.isArray(d.portfolj) && (!first || !getPort().length)) writeLS(PKEY, d.portfolj);
    if (d.ova && typeof d.ova.kassa === 'number' && (!first || !readLS(OKEY, null))) {
      // Behåll en längre lokal historik om den hör till samma övningsportfölj
      const loc = readLS(OKEY, null);
      const keep = loc && loc.start === d.ova.start && (loc.historik || []).length > (d.ova.historik || []).length && loc.historik[loc.historik.length - 1]?.t === d.ova.historik?.[d.ova.historik.length - 1]?.t;
      writeLS(OKEY, keep ? { ...d.ova, historik: loc.historik } : d.ova);
    }
  } finally { SYNCING = false; }
  writeLS('mk-sync-user', ACC.user.id);
  if (first || !cloud) saveCloud();
}
let saveTimer;
const cloudData = () => {
  const watch = getWatch(); const port = getPort(); const ova = readLS(OKEY, null);
  const syms = [...new Set([...watch, ...port.map((x) => x.sym), ...Object.keys(ova?.innehav || {})])];
  // Tabellen rymmer hela historiken. Kontots metadata hålls liten, därför bara de senaste 40 affärerna där.
  const hist = (ova?.historik || []).slice(ACC.table ? -1000 : -40);
  return { bevakning: watch, larm: getLarm(), koll: readLS(KKEY, {}), portfolj: port, ...(ova ? { ova: { ...ova, historik: hist } } : {}), namn: Object.fromEntries(syms.map((x) => [x, nameOf(x)])) };
};
async function saveNow() {
  const data = cloudData();
  if (ACC.table) {
    await rest('anvandardata?on_conflict=user_id', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: { user_id: ACC.user.id, data, uppdaterad: new Date().toISOString() } });
  } else {
    const t = await token(); if (!t) return;
    ACC.user = await auth('/user', { data }, 'PUT', t);
  }
}
function saveCloud() {
  if (!ACC.user) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveNow().catch((e) => console.warn('Kunde inte spara till kontot', e.message)); }, 500);
}
async function setVeckobrev(on) {
  if (!ACC.table) throw new Error('tabell saknas');
  await rest('anvandardata?on_conflict=user_id', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: { user_id: ACC.user.id, data: cloudData(), veckobrev: on, uppdaterad: new Date().toISOString() } });
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
  box.innerHTML = `<section class="card koll" aria-labelledby="koll-h"><div class="section-head" style="align-items:center"><div><span class="label-up">Dagens koll</span><h2 class="section" id="koll-h" style="margin-top:4px;font-size:24px">Det här händer i dina aktier</h2></div><a class="more small" href="/kalender" data-link>Kalender →</a></div>
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
function viewKalender() {
  return `${topbar([['Översikt', '/'], ['Kalender', '/kalender']])}
  <div class="stack" style="gap:6px"><span class="eyebrow">Rapporter och utdelningar för aktierna du äger och bevakar</span><h1 class="title">Kalender</h1></div>
  <div id="kal-sum"></div>
  <div class="pf-layout">
    <section class="card co-section" style="min-width:0"><span class="label-up">De kommande tre månaderna</span><div id="kal-list">${loading('Hämtar kalendern …')}</div></section>
    <section class="card co-section" style="min-width:0;align-self:start"><span class="label-up">Utdelning per innehav</span><div id="kal-utd">${loading('Räknar …')}</div></section>
  </div>
  <p class="small faint" style="margin:0">Datum och utdelningar kommer från Yahoo Finance och kan ändras. Utdelningen per år bygger på den senast kända utdelningen och är ingen garanti. X-dagen är första dagen aktien handlas utan rätt till utdelning. För att få utdelningen måste du äga aktien senast dagen före.</p>
  ${footer()}`;
}
// Väntad utdelning per år för portföljen, i kronor
async function dividendPlan(kal) {
  const port = getPort(); const per = {};
  for (const p of port) per[p.sym] = (per[p.sym] || 0) + p.antal;
  const rows = kal.filter((k) => per[k.sym] && k.utdelningPerAktie);
  const fx = await fxToSek(rows.map((k) => k.valuta || 'SEK'));
  const out = rows.map((k) => { const r = fx[k.valuta || 'SEK'] ?? null; return { k, antal: per[k.sym], perAr: r != null ? per[k.sym] * k.utdelningPerAktie * r : null }; }).sort((a, b) => (b.perAr || 0) - (a.perAr || 0));
  return { rows: out, total: out.reduce((s, x) => s + (x.perAr || 0), 0), utan: Object.keys(per).filter((s) => !rows.some((x) => x.sym === s)) };
}
async function mountKalender() {
  const { port, all } = mySyms();
  if (!all.length) { $('#kal-list').innerHTML = '<div class="empty">Du äger och bevakar inga aktier än. Lägg till aktier under Bevakning eller Min portfölj.</div>'; $('#kal-utd').innerHTML = ''; return; }
  const kal = await getKalender(all); if (!$('#kal-list')) return;
  const ev = events(kal, 0, 92);
  const plan = await dividendPlan(kal); if (!$('#kal-list')) return;
  const nextR = ev.find((e) => e.typ === 'rapport'); const nextU = ev.find((e) => e.typ === 'ex' || e.typ === 'utbet');
  $('#kal-sum').innerHTML = `<div class="statbar card pf-stats">
    <div class="stat"><span class="small muted">Väntad utdelning per år</span><span class="num big">${port.length ? sekBig(plan.total) : '–'}</span><span class="small faint">${port.length ? 'för aktierna i Min portfölj' : 'lägg in köp i Min portfölj'}</span></div>
    <div class="stat"><span class="small muted">Nästa rapport</span><span class="num">${nextR ? esc(whenTxt(nextR.dag)) : '–'}</span><span class="small faint">${nextR ? esc(nameOf(nextR.k.sym)) : ''}</span></div>
    <div class="stat"><span class="small muted">Nästa utdelningsdag</span><span class="num">${nextU ? esc(whenTxt(nextU.dag)) : '–'}</span><span class="small faint">${nextU ? esc(nameOf(nextU.k.sym)) : ''}</span></div></div>`;
  const months = {};
  for (const e of ev) { const m = new Date(e.dag + 'T12:00:00').toLocaleDateString(L, { month: 'long', year: 'numeric' }); (months[m] = months[m] || []).push(e); }
  const own = (s) => port.includes(s);
  $('#kal-list').innerHTML = ev.length ? Object.entries(months).map(([m, list]) => `<div class="kal-month"><h3 class="koll-h">${esc(m.charAt(0).toUpperCase() + m.slice(1))}</h3>${list.map((e) => {
    const p = plan.rows.find((x) => x.k.sym === e.k.sym);
    const extra = e.typ !== 'rapport' && e.k.utdelningPerAktie ? `Ca ${kr(e.k.utdelningPerAktie)} ${cur(e.k.valuta)} per aktie och år${p?.perAr ? ` · för dina ${nfAntal(p.antal)} st ca ${sekBig(p.perAr)} per år` : ''}` : '';
    return `<a class="koll-row" href="/bolag/${encodeURIComponent(e.k.sym)}" data-link><span class="koll-date"><b>${esc(fmtDayShort(e.dag))}</b></span>${av(e.k.sym)}<span class="grow"><b>${esc(nameOf(e.k.sym))}</b><span class="small muted">${esc(evtLabel(e))}${extra ? ' · ' + esc(extra) : ''}</span></span>${own(e.k.sym) ? '<span class="pill outline">Äger</span>' : ''}</a>`;
  }).join('')}</div>`).join('') : '<div class="empty">Inga kända rapporter eller utdelningsdagar de närmaste tre månaderna.</div>';
  $('#kal-utd').innerHTML = !port.length ? '<p class="small muted" style="margin:0">Lägg in dina köp i Min portfölj, så räknar vi ut hur mycket utdelning du kan vänta dig.</p>'
    : `${plan.rows.length ? plan.rows.map((x) => `<a class="koll-row" href="/bolag/${encodeURIComponent(x.k.sym)}" data-link>${av(x.k.sym)}<span class="grow"><b>${esc(nameOf(x.k.sym))}</b><span class="small muted">${esc(nfAntal(x.antal))} st · ${esc(kr(x.k.utdelningPerAktie))} ${esc(cur(x.k.valuta))} per aktie${x.k.direktavkastning != null ? ` · ${nf(x.k.direktavkastning, 1)} %` : ''}</span></span><b class="num small">${x.perAr != null ? sek(x.perAr) : '–'}</b></a>`).join('') : ''}
      ${plan.utan.length ? `<p class="small muted" style="margin:6px 0 0">Ingen känd utdelning: ${esc(plan.utan.map(nameOf).join(', '))}.</p>` : ''}`;
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
  if (locked() && PRIVATE.some((x) => here === x || here.startsWith(x + '/'))) {
    writeLS('mk-efter-login', location.pathname + location.search);
    history.replaceState(null, '', '/konto');
  }
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(location.search);
  if (path === '/') return { active: 'oversikt', title: 'Översikt', html: viewOversikt(), mount: mountOversikt };
  if (path === '/sok' && params.get('s')) { history.replaceState(null, '', '/bolag/' + encodeURIComponent(params.get('s'))); return route(); }
  if (path === '/sok') return { active: 'sok', title: 'Sök och riskkoll', html: viewSok(params), mount: () => mountSok(params) };
  if (path === '/nyheter') return { active: 'nyheter', title: 'Nyheter', html: viewNyheter(), mount: mountNyheter };
  if (path === '/bevakning') return { active: 'bevakning', title: 'Bevakning', html: viewBevakning(), mount: mountBevakning };
  if (path === '/portfolj') return { active: 'portfolj', title: 'Min portfölj', html: viewPortfolj(), mount: mountPortfolj };
  if (path === '/idag') return { active: 'portfolj', title: 'Din dag', html: viewDinDag(), mount: mountDinDag };
  if (path === '/kalender') return { active: 'kalender', title: 'Kalender', html: viewKalender(), mount: mountKalender };
  if (path === '/ova') return { active: 'ova', title: 'Övningsportfölj', html: viewOva(), mount: mountOva };
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
  document.title = `${trS(r.title)} · Finanskollen`;
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
