/* Finanskollen. All data hämtas live via våra API-funktioner (/api/*), som i sin tur hämtar från Yahoo Finance, Finnhub och Finansinspektionen.
   Ingen exempeldata: saknas något visas det som saknat. */

/* ================= Hjälpfunktioner ================= */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (n, d = 2) => (n == null ? '–' : (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toFixed(d).replace('.', ',') + ' %');
const tone = (n) => (n == null ? '' : n >= 0 ? 'up' : 'down');
const kr = (n) => (n == null ? '–' : Number(n).toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const cur = (c) => (c === 'SEK' ? 'kr' : c || '');
const LV = { 1: { t: 'Låg', c: 'up' }, 2: { t: 'Medel', c: 'warn' }, 3: { t: 'Hög', c: 'down' } };
const lvlOf = (p) => (p == null ? null : p <= 3 ? 1 : p <= 6 ? 2 : 3);
const $ = (sel, root = document) => root.querySelector(sel);
const short = (sym) => sym.replace('^', '').split('.')[0].split('-')[0].slice(0, 4);
const clock = (iso) => { try { return new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' }); } catch { return ''; } };
const when = (iso) => {
  const d = new Date(iso); if (!iso || isNaN(d)) return '';
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
  const day = d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
  return day === today ? clock(iso) : d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', timeZone: 'Europe/Stockholm' }) + ' ' + clock(iso);
};

const ICON = {
  home: 'M4 11l8-7 8 7v9H4z',
  search: 'M11 5a6 6 0 1 0 0.01 0M20 20l-4.5-4.5',
  news: 'M5 5h11v14H6a1 1 0 0 1-1-1zM16 9h3v9a1 1 0 0 1-2 0V9M8 9h5M8 12h5M8 15h3',
  star: 'M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.4 7.2 18.9l.9-5.4-3.9-3.8 5.4-.8z',
  logo: 'M4 17l5-6 4 3 7-9',
  ext: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  compare: 'M8 4v16M16 4v16M4 9h8M12 15h8',
  list: 'M4 6h16M4 12h16M4 18h10',
  check: 'M5 12l5 5 9-10',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.5',
  plus: 'M12 5v14M5 12h14',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0',
  bell: 'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0'
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
const nf = (n, d) => Number(n).toLocaleString('sv-SE', { minimumFractionDigits: d, maximumFractionDigits: d });
const mny = (n, c = 'SEK') => { if (n == null) return '–'; const a = Math.abs(n); const u = cur(c); return a >= 1e9 ? `${nf(n / 1e9, 1)} mdr ${u}` : a >= 1e6 ? `${nf(n / 1e6, 1)} mn ${u}` : `${nf(n, 0)} ${u}`; };
const pc = (n) => (n == null ? '–' : nf(n, 2) + ' %');
const dag = (d) => { try { return new Date(d + 'T12:00:00').toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', timeZone: 'Europe/Stockholm' }).replace('.', ''); } catch { return d || ''; } };
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

async function getQuotes(syms) {
  const out = {};
  const list = [...new Set(syms)];
  if (!list.length) return out;
  // Servern tar max 12 tickers per anrop, så längre listor delas upp
  const chunks = [];
  for (let i = 0; i < list.length; i += 12) chunks.push(list.slice(i, i + 12));
  const res = await Promise.all(chunks.map((c) => api('/api/quote?s=' + c.map(encodeURIComponent).join(','), 30e3)));
  for (const r of res) {
    if (r?.quotes) { out.__hamtad = out.__hamtad || r.hamtad; for (const q of r.quotes) out[q.sym] = q; }
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
const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* privat läge */ } if ((k === WKEY || k === LKEY) && !SYNCING) saveCloud(); };
let SYNCING = false;
const LKEY = 'mk-larm';
const getLarm = () => { const v = readLS(LKEY, {}); return v && typeof v === 'object' ? v : {}; };
const getWatch = () => { const v = readLS(WKEY, null); return Array.isArray(v) ? v : DEFAULT_WATCH.slice(); };
const nameOf = (sym) => readLS(NKEY, {})[sym] || DEFAULT_NAMES[sym] || sym;
function rememberName(sym, namn) { if (!sym || !namn || namn === sym) return; const m = readLS(NKEY, {}); m[sym] = namn; writeLS(NKEY, m); }
function toggleWatch(sym, namn) {
  const w = getWatch(); const i = w.indexOf(sym);
  if (i >= 0) w.splice(i, 1); else { w.push(sym); rememberName(sym, namn); }
  writeLS(WKEY, w);
  return w.includes(sym);
}

/* ================= Gemensamma delar ================= */
const NAV = [
  { group: 'Översikt', items: [{ id: 'oversikt', href: '/', label: 'Översikt', icon: 'home' }] },
  { group: 'Börsen', items: [
    { id: 'sok', href: '/sok', label: 'Sök och riskkoll', icon: 'search' },
    { id: 'nyheter', href: '/nyheter', label: 'Nyheter', icon: 'news' },
    { id: 'aktier', href: '/aktier', label: 'Alla aktier', icon: 'list' },
    { id: 'jamfor', href: '/jamfor', label: 'Jämför', icon: 'compare' },
    { id: 'bevakning', href: '/bevakning', label: 'Bevakning', icon: 'star', badge: true }
  ] },
  { group: 'Konto', items: [{ id: 'konto', href: '/konto', label: 'Logga in', icon: 'user' }, { id: 'om', href: '/om', label: 'Om oss', icon: 'info' }] }
];

function sidebar(active) {
  const watchCount = getWatch().length;
  const today = new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
  return `
  <nav class="nav" aria-label="Huvudmeny">
    <a class="brand" href="/" data-link>
      <span class="brand-mark">${svg('logo', 20, '#FFFFFF')}</span>
      <span class="brand-text"><span class="brand-name">Finanskollen</span><span class="brand-sub">Trygg börskoll</span></span>
    </a>
    <div class="welcome"><b>Välkommen tillbaka${firstName() ? `, ${esc(firstName())}` : ''}</b><span>${esc(today)}</span></div>
    ${NAV.map((g) => `
      <div class="nav-group">
        <span class="nav-label">${g.group}</span>
        ${g.items.map((it) => `
          <a class="nav-link" href="${it.href}" data-link ${it.id === active ? 'aria-current="page"' : ''}>
            ${svg(it.icon)}<span>${it.id === 'konto' && ACC.user ? 'Mitt konto' : it.label}</span>${it.badge && watchCount ? `<span class="nav-badge">${watchCount}</span>` : ''}
          </a>`).join('')}
      </div>`).join('')}
    <div class="nav-foot">Data från Yahoo Finance, Finnhub och Finansinspektionen. Ingen investeringsrådgivning.</div>
  </nav>`;
}

function topbar(crumbs, withSearch = true) {
  const parts = crumbs.map((c, i) => (i === crumbs.length - 1 ? `<span class="here">${esc(c[0])}</span>` : `<a href="${c[1]}" data-link>${esc(c[0])}</a><span>/</span>`)).join('');
  return `
  <div class="topbar">
    <div class="crumbs">${svg('home', 20)}${parts}</div>
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
  if (r?.items) return { ok: true, hamtad: r.hamtad, items: r.items.map(prepNews), ingenAtkomst: !!r.ingenAtkomst };
  return { ok: false, error: r, items: [] };
}
const prepNews = (n) => ({ ...n, tidTxt: when(n.datum), bolagTxt: (n.bolag || []).join(', ') });

function newsTitle(n) {
  const u = safeUrl(n.lank);
  return u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none">${esc(n.rubrik)} <span class="sr-only">(öppnas i ny flik)</span></a>` : esc(n.rubrik);
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
        <div class="meta" style="color:rgba(255,255,255,0.62)"><span class="pill inv">${esc(top.kalla)}</span><span class="num">${esc(top.tidTxt)}</span>${top.bolagTxt ? `<span>${esc(top.bolagTxt)}</span>` : ''}</div>
        <h3 style="margin:0;font-size:clamp(22px,3vw,30px);font-weight:400;letter-spacing:-0.01em;line-height:1.22">${newsTitle(top)}</h3>
        ${top.text ? `<p style="margin:0;color:rgba(255,255,255,0.75);font-size:15.5px;max-width:640px">${esc(top.text)}</p>` : ''}
      </div>
      <div class="meta" style="color:rgba(255,255,255,0.62)">${sourceLink(top)}</div>
    </article>
    <div class="narrow card" style="padding:10px 22px">
      ${rest.slice(0, 5).map((n) => `
        <div class="row-link" style="align-items:flex-start;gap:14px">
          <span class="grow"><span style="display:block;font-weight:500;line-height:1.35">${newsTitle(n)}</span><span class="small muted num">${esc(n.tidTxt)} · ${esc(n.kalla)}</span></span>
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
function viewOversikt() {
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
          <span class="avatar">${esc(m.kort || m.sym)}</span>
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

  <div class="grid g2">
    <div class="card dark rings stack" style="padding:24px;gap:14px;align-self:start">
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
    <section class="card" aria-labelledby="mina-h" style="padding:24px">
      <div class="section-head" style="margin-bottom:6px"><h2 class="section" id="mina-h" style="font-size:22px">Mina aktier</h2><a class="more" href="/bevakning" data-link>Bevakning →</a></div>
      <div id="mine">${loading('Hämtar kurser …')}</div>
    </section>
  </div>
  ${footer('OMX Stockholm 30 visas i indexpoäng. Övriga marknader visas med börsfonder (ETF:er) som följer respektive index, priser i USD.')}`;
}

async function mountOversikt() {
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
  const watch = getWatch().slice(0, 6);
  const quotes = await getQuotes([...MARKET.map((m) => m.sym), ...watch]);
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
    return `<a class="row-link" href="/bolag/${encodeURIComponent(s)}" data-link>
      <span class="avatar">${esc(short(s))}</span>
      <span class="grow" style="font-weight:500">${esc(nameOf(s))}</span>
      <span class="num small muted">${q?.kurs != null ? kr(q.kurs) : 'kurs saknas'}</span>
      <span class="pill ${tone(q?.d1)}">${q?.d1 != null ? pct(q.d1, 1) : '–'}</span>
    </a>`;
  }).join('') : '<p class="muted">Du bevakar inga aktier än. Sök på ett bolag och tryck på Bevaka.</p>';
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
      <span class="avatar">${esc(short(r.sym))}</span>
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
          <div class="meta"><span class="pill outline">${esc(n.kalla)}</span><span class="num">${esc(n.tidTxt)}</span>${n.bolagTxt ? `<span>${esc(n.bolagTxt)}</span>` : ''}</div>
          <h3>${newsTitle(n)}</h3>
          ${n.text ? `<p>${esc(n.text)}</p>` : ''}
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
    const alarms = rows.filter((r) => larm[r.sym] && r.q.d1 != null && Math.abs(r.q.d1) >= larm[r.sym]);
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
          <td><a class="co" href="/bolag/${encodeURIComponent(r.sym)}" data-link><span class="avatar">${esc(short(r.sym))}</span><span><span style="display:block;font-weight:500">${esc(r.namn)}</span><span class="small muted">${esc(r.sym)}</span></span></a></td>
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
    <span style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">${s.d1 != null ? `<span class="pill ${tone(s.d1)}">${pct(s.d1)} i dag</span>` : ''}<span class="pill outline" title="Tid för senaste affären enligt ${esc(s.kalla || 'datakällan')}">Senaste kurs ${esc(when(s.kursTid || s.hamtad))}</span></span>
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
        <span class="avatar" style="width:68px;height:68px;font-size:14px">${esc(s.kort)}</span>
        <div style="min-width:0">
          <span class="label-up">${esc(s.lista || s.sym)}</span>
          <h1 class="title" style="margin:2px 0 6px">${esc(s.namn)}</h1>
          <div class="chips"><span class="pill outline num">${esc(s.sym)}</span>${s.aktieslag ? `<span class="pill outline">${esc(s.aktieslag)}</span>` : ''}<a class="pill outline" href="/jamfor?a=${encodeURIComponent(s.sym)}" data-link style="text-decoration:none">${svg('compare', 13)} Jämför</a>${safeUrl(s.webb) ? `<a class="pill outline" href="${esc(safeUrl(s.webb))}" target="_blank" rel="noopener noreferrer" style="text-decoration:none">Webbplats ${svg('ext', 13)}</a>` : ''}
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

const yahooDesc = (s) => `<div class="stack" style="gap:12px"><p class="lead">${esc(clipText(s.beskrivning, 700))}</p><p class="small faint" style="margin:0">Texten finns bara på engelska. Källa: ${esc(s.kalla || 'Yahoo Finance')}.</p></div>`;
const clipText = (t, n) => (t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + ' …' : t);

function aboutHTML(a, s) {
  if (!a || a.error || a.saknas) {
    if (s?.beskrivning) return yahooDesc(s);
    return `<p class="muted" style="margin:0">${a?.error ? esc(errText(a)) : 'Vi hittade ingen beskrivning av det här värdepappret. För fonder och mindre bolag saknas den ofta.'}</p>`;
  }
  const facts = a.fakta || [];
  if (!a.affarside && !a.historia?.length && s?.beskrivning) return yahooDesc(s) + (facts.length ? `<dl class="facts" style="margin-top:20px">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : '');
  return `<div class="stack" style="gap:20px">
    ${a.affarside ? `<p class="lead">${esc(a.affarside)}</p>` : s?.beskrivning ? `<p class="lead">${esc(clipText(s.beskrivning, 520))}</p>` : ''}
    ${facts.length ? `<dl class="facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
    ${a.historia?.length ? `<div class="stack" style="gap:10px"><h3 class="sub">Historia</h3><div class="prose">${a.historia.map((p) => `<p>${esc(p)}</p>`).join('')}</div></div>` : ''}
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
  document.title = `${s.namn} · Finanskollen`;
  const crumb = $('.crumbs .here'); if (crumb) crumb.textContent = s.namn;
  el.innerHTML = bolagHTML(s);
  const sc = $('.score[data-count]', el); if (sc) countUp(sc, Number(sc.dataset.count), (v) => String(Math.round(v)), 700, 1);
  const big = $('.co-head .price-big', el); if (big && s.kurs != null) { const n = big.firstChild; if (n && n.nodeType === 3) { const span = document.createElement('span'); big.replaceChild(span, n); countUp(span, s.kurs, (v) => kr(v) + ' ', 800); } }
  el.addEventListener('click', (e) => {
    const w = e.target.closest('[data-watch]'); if (!w) return;
    const on = toggleWatch(w.dataset.watch, w.dataset.namn);
    w.textContent = on ? 'Bevakas ✓' : 'Bevaka'; w.setAttribute('aria-pressed', String(on)); w.classList.toggle('ghost', on);
    refreshNav('sok');
  });
  // Affärsidé/historia och nyheter hämtas parallellt
  api('/api/about?s=' + encodeURIComponent(sym), 60 * 60e3).then((a) => { const b = $('#about-body'); if (b) b.innerHTML = aboutHTML(a, s); });
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
  const items = (n?.items || []).map(prepNews);
  box.innerHTML = items.length ? `<div>${items.slice(0, 6).map((it) => `
    <div class="row-link" style="align-items:flex-start">
      <span class="small muted num" style="width:96px;flex:none;padding-top:2px">${esc(it.tidTxt)}</span>
      <span class="grow"><span style="display:block;font-weight:500">${newsTitle(it)}</span><span class="small muted">${esc(it.kalla)}</span></span>
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
    $('#ak-count').textContent = `${list.length.toLocaleString('sv-SE')} ${list.length === 1 ? 'aktie' : 'aktier'}`;
    $('[data-reset]').hidden = !filtered;
    if (!list.length) { $('#ak-list').innerHTML = '<div class="empty">Inga aktier matchar filtren. Prova att ta bort något filter.</div>'; return; }
    const watch = new Set(getWatch());
    const show = list.slice(0, st.n);
    $('#ak-list').innerHTML = `<div class="table-wrap"><table class="ak-table">
      <thead><tr>${th('namn', 'Bolag')}<th scope="col" class="hide-sm">Bransch</th>${th('d1', 'I dag', 'r')}${th('ar', '1 år', 'r hide-xs')}${th('pe', 'P/E', 'r hide-sm')}${th('utd', 'Utdelning', 'r hide-sm')}${th('mcap', 'Börsvärde', 'r hide-sm')}<th scope="col" class="r"><span class="sr-only">Bevaka</span></th></tr></thead>
      <tbody>${show.map((a) => `<tr>
        <td><a class="ak-name" href="/bolag/${encodeURIComponent(a.sym)}" data-link data-namn="${esc(a.namn)}"><span class="avatar">${esc(short(a.sym))}</span><span><b>${esc(a.namn)}</b><span class="small muted">${esc(a.sym)} · ${a.kurs != null ? esc(kr(a.kurs)) + ' ' + esc(cur(a.valuta)) : '–'}</span></span></a></td>
        <td class="hide-sm small muted">${esc(a.bransch)}</td>
        <td class="r"><span class="pill ${tone(a.d1)}">${a.d1 != null ? pct(a.d1, 1) : '–'}</span></td>
        <td class="r num hide-xs" style="color:var(--${tone(a.ar)})">${a.ar != null ? pct(a.ar, 0) : '–'}</td>
        <td class="r num hide-sm">${a.pe === -1 ? '<span class="small muted">Förlust</span>' : a.pe != null ? esc(nf(a.pe, 1)) : '–'}</td>
        <td class="r num hide-sm">${a.utd ? esc(nf(a.utd, 1)) + ' %' : a.utd === 0 ? '0 %' : '–'}</td>
        <td class="r num hide-sm">${a.mcap ? esc(mny(a.mcap, a.valuta)) : '–'}</td>
        <td class="r"><button type="button" class="star-btn" data-star="${esc(a.sym)}" data-namn="${esc(a.namn)}" aria-pressed="${watch.has(a.sym)}" aria-label="${watch.has(a.sym) ? 'Sluta bevaka' : 'Bevaka'} ${esc(a.namn)}">${svg('star', 18)}</button></td>
      </tr>`).join('')}</tbody></table></div>
      ${list.length > show.length ? `<div style="display:flex;justify-content:center;padding:14px"><button class="btn ghost" type="button" data-more>Visa fler (${(list.length - show.length).toLocaleString('sv-SE')} kvar)</button></div>` : ''}`;
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
    $('#ak-status').textContent = `${d.aktier.length.toLocaleString('sv-SE')} aktier${d.urval ? ' (urval av de största)' : ''} · ${d.kalla} · hämtat kl ${clock(d.hamtad)}`;
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
      ${OM.mejl ? `<a class="btn ghost" href="mailto:${esc(OM.mejl)}">Mejla ${p ? 'oss' : 'mig'}: ${esc(OM.mejl)}</a>` : ''}
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
  <div class="stack" style="gap:6px"><span class="eyebrow">Senast uppdaterad 7 november 2026</span><h1 class="title">Så hanterar vi dina uppgifter</h1></div>
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
      <li><b>Inställningar:</b> vilka aktier du bevakar, dina prislarm och om du har gått igenom startguiden.</li>
      <li><b>I din webbläsare:</b> din inloggning, din bevakning och dina val sparas lokalt (localStorage) så att sidan går snabbt. Det är inte spårningscookies och försvinner om du rensar webbläsaren.</li>
      <li><b>Tekniska loggar:</b> när du besöker sidan sparar vår webbhotell en kort logg med bland annat din IP-adress, för att kunna hitta fel och stoppa attacker. Loggarna rensas automatiskt.</li>
    </ul>

    <h2 class="section">Var sparas de?</h2>
    <ul class="om-list">
      <li><b>Konton</b> sparas hos Supabase${SUPA_REGION ? `, på servrar i ${esc(SUPA_REGION)}` : ''}.</li>
      <li><b>Sidan</b> körs hos Netlify. Deras servrar kan finnas utanför EU, och överföringen sker då med EU:s standardavtalsklausuler.</li>
    </ul>

    <h2 class="section">Delar vi något med andra?</h2>
    <ul class="om-list">
      <li>Kurser, nyheter och register hämtas av vår server från Yahoo Finance, Finnhub, Finansinspektionen och Wikipedia. Din IP-adress och dina uppgifter skickas inte till dem.</li>
      <li>AI-sammanfattningarna skapas av Anthropic (Claude). Bara nyhetsrubriker skickas dit, aldrig något om dig.</li>
      <li>Typsnittet ligger på vår egen server, så inget skickas till Google.</li>
    </ul>

    <h2 class="section">Notiser</h2>
    <p style="margin:0">Prislarmen räknas ut i din webbläsare. Notiserna skickas inte via någon annan tjänst, och du kan stänga av dem i webbläsarens inställningar.</p>

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
  for (const k of ['mk-session', 'mk-sync-user', WKEY, LKEY, 'mk-larm-skickat', 'mk-onboarded', NKEY]) { try { localStorage.removeItem(k); } catch { /* privat läge */ } }
  ACC.session = null; ACC.user = null;
}
function confirmDelete(onYes) {
  const d = document.createElement('div'); d.className = 'modal-back';
  d.innerHTML = `<div class="modal card" role="dialog" aria-modal="true" aria-labelledby="del-h">
    <h2 class="section" id="del-h" style="font-size:22px">Radera ditt konto?</h2>
    <p style="margin:0">Ditt konto, ditt namn, din bevakning och dina prislarm raderas för alltid. Det går inte att ångra.</p>
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
      <span class="avatar">${esc(short(sym))}</span><span class="grow" style="text-align:left;min-width:0"><b>${esc(namn)}</b><span class="small muted">${esc(sub)}</span></span>
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
      $('#on-results').innerHTML = `<div class="pick-results card" style="padding:6px 10px">${(r?.results || []).slice(0, 5).map((x) => `<button type="button" class="pick" data-addpick="${esc(x.sym)}" data-namn="${esc(x.klass ? `${x.namn}, ${x.typ}` : x.namn)}" data-sub="${esc([x.typ, x.sym].filter(Boolean).join(' · '))}"><span class="avatar">${esc(short(x.sym))}</span><span class="grow" style="text-align:left"><span style="display:block;font-weight:500">${esc(x.namn)}</span><span class="small muted">${esc([x.typ, x.sym].filter(Boolean).join(' · '))}</span></span>${svg('plus', 16)}</button>`).join('') || '<p class="small muted">Inga träffar.</p>'}</div>`;
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
    ACC.cfg = c?.supabase || false; ACC.ai = !!c?.ai;
  }
  return ACC.cfg;
}
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
async function token() {
  const s = ACC.session; if (!s) return null;
  if (Date.now() < s.exp - 60e3) return s.access;
  try { const j = await auth('/token?grant_type=refresh_token', { refresh_token: s.refresh }); setSession(j); return j.access_token; } catch { setSession(null); return null; }
}
// Kontot är facit. Första gången på en enhet slås den lokala listan ihop med kontots.
function applyCloud() {
  const d = ACC.user?.user_metadata || {};
  const cloud = Array.isArray(d.bevakning) ? d.bevakning.filter((x) => typeof x === 'string') : null;
  const first = readLS('mk-sync-user', null) !== ACC.user.id;
  SYNCING = true;
  try {
    if (d.namn && typeof d.namn === 'object') writeLS(NKEY, { ...d.namn, ...readLS(NKEY, {}) });
    // Bara aktier man själv har lagt till slås ihop, inte startlistan med exempel
    const own = readLS(WKEY, null);
    if (cloud) writeLS(WKEY, first && Array.isArray(own) ? [...new Set([...cloud, ...own])].slice(0, 60) : cloud);
    if (d.larm && typeof d.larm === 'object') writeLS(LKEY, first ? { ...d.larm, ...getLarm() } : d.larm);
  } finally { SYNCING = false; }
  writeLS('mk-sync-user', ACC.user.id);
  if (first || !cloud) saveCloud();
}
let saveTimer;
function saveCloud() {
  if (!ACC.user) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const t = await token(); if (!t) return;
    const watch = getWatch();
    try {
      const u = await auth('/user', { data: { bevakning: watch, larm: getLarm(), namn: Object.fromEntries(watch.map((x) => [x, nameOf(x)])) } }, 'PUT', t);
      ACC.user = u;
    } catch (e) { console.warn('Kunde inte spara till kontot', e.message); }
  }, 500);
}
async function bootAccount() {
  // Länkar från bekräftelse- och återställningsmejl kommer tillbaka med inloggningen i adressens #-del
  const h = new URLSearchParams(location.hash.slice(1));
  let recovery = false;
  if (h.get('access_token')) {
    setSession({ access_token: h.get('access_token'), refresh_token: h.get('refresh_token'), expires_in: h.get('expires_in') });
    recovery = h.get('type') === 'recovery';
    ACC.fromLink = !recovery;
    history.replaceState(null, '', location.pathname + location.search);
  }
  if (h.get('error_description')) { toast('Länken fungerade inte', h.get('error_description').replace(/\+/g, ' ')); history.replaceState(null, '', location.pathname + location.search); }
  if (!(await accCfg()) || !ACC.session) return;
  const t = await token(); if (!t) return;
  // Bekräftelselänken loggar in. Skicka vidare dit man var på väg.
  try { ACC.user = await auth('/user', null, 'GET', t); } catch { setSession(null); return; }
  applyCloud();
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
      <div class="auth-brand"><span class="brand-mark">${svg('logo', 22, '#FFFFFF')}</span><span><b>Finanskollen</b><span class="small muted">Trygg börskoll</span></span></div>
      <div class="auth-intro"><h1 class="title" style="font-size:clamp(30px,5vw,42px)">Börsen på enkel svenska</h1>
        <p class="muted" style="margin:0;font-size:16px">Riskkoll, kursdiagram, nyheter med AI-sammanfattning, insynshandel och blankning. Logga in eller skapa ett gratis konto för att fortsätta.</p></div>
      <div id="konto" class="auth-card">${loading('Hämtar …')}</div>
      <p class="small faint" style="margin:0;text-align:center">Ingen investeringsrådgivning. Data från Yahoo Finance, Finnhub och Finansinspektionen.</p>
      <p class="small" style="margin:0;text-align:center"><a href="/om" data-link>Om oss</a> · <a href="/integritet" data-link>Så hanterar vi dina uppgifter</a> · <a href="/ordlista" data-link>Ordlista</a></p>
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
    <div class="card stack" style="gap:10px;padding:22px 26px;margin-top:16px">
      <span class="label-up">Dina uppgifter</span>
      <p class="small muted" style="margin:0">Vi sparar din e-post, ditt namn, din bevakning och dina prislarm. <a href="/integritet" data-link>Läs mer</a></p>
      <button class="linkbtn small danger-link" type="button" data-delete>Radera mitt konto</button>
    </div>`;
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
      ${mode === 'signup' ? '<label class="field"><span>Namn</span><input name="name" type="text" required maxlength="60" autocomplete="name" placeholder="Till exempel Albin Karlsson"></label>' : ''}
      <label class="field"><span>E-post</span><input name="email" type="email" required autocomplete="email" inputmode="email"></label>
      ${mode !== 'forgot' ? `<label class="field"><span>Lösenord${mode === 'signup' ? ' (minst 8 tecken)' : ''}</span><input name="password" type="password" minlength="${mode === 'signup' ? 8 : 1}" required autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}"></label>` : ''}
      <p class="small" role="status" data-msg style="margin:0;min-height:1em"></p>
      <button class="btn" type="submit">${mode === 'signup' ? 'Skapa konto' : mode === 'forgot' ? 'Skicka återställningslänk' : 'Logga in'}</button>
      ${mode === 'login' ? '<button class="linkbtn small" type="button" data-mode="forgot">Glömt lösenordet?</button>' : mode === 'forgot' ? '<button class="linkbtn small" type="button" data-mode="login">Tillbaka till inloggning</button>' : '<p class="small faint" style="margin:0">Vi sparar bara din e-post, din bevakning och dina larm. Inga betaluppgifter.</p>'}
    </form>`;
    const f = box.querySelector('form');
    f.addEventListener('click', (e) => { const b = e.target.closest('[data-mode]'); if (b) { mode = b.dataset.mode; draw(); } });
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
          if (j.access_token) { setSession(j); ACC.user = j.user; applyCloud(); toast(`Välkommen, ${name.split(' ')[0]}!`, 'Ditt konto är skapat.'); goAfterLogin(); return; }
          f.innerHTML = `<div class="stack" style="gap:10px"><span class="label-up">Nästan klart</span><p style="margin:0;font-size:17px">Tack ${esc(name.split(' ')[0])}! Vi har skickat ett mejl till <b>${esc(email)}</b>.</p><p class="muted" style="margin:0">Klicka på länken i mejlet för att bekräfta din e-post. Då loggas du in automatiskt. Hittar du inte mejlet, titta i skräpposten.</p></div>`;
          return;
        } else {
          const j = await auth('/token?grant_type=password', { email, password });
          setSession(j); ACC.user = j.user; applyCloud();
          toast(`Välkommen tillbaka${firstName() ? ', ' + firstName() : ''}!`, ''); goAfterLogin(); return;
        }
      } catch (err) { msg.textContent = authErr(err); }
      btn.disabled = false;
    });
  };
  draw();
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
function notifyBar() {
  const st = notifyState(); const any = Object.keys(getLarm()).length;
  const txt = st === 'granted' ? 'Notiser är på. Du får en notis när en aktie rör sig mer än gränsen du valt, så länge sidan är öppen i en flik.'
    : st === 'denied' ? 'Notiser är blockerade i webbläsaren. Larmen visas ändå här på sidan. Du kan tillåta notiser i webbläsarens inställningar för sidan.'
    : st === 'unsupported' ? 'Din webbläsare stöder inte notiser. Larmen visas här på sidan. På iPhone fungerar notiser när sidan är tillagd på hemskärmen.'
    : 'Välj en gräns under Prislarm, så säger vi till när aktien rör sig mer än så under dagen.';
  return `<div class="notify-bar">${svg('bell', 18)}<span class="grow small">${txt}</span>${st === 'default' && any ? '<button class="btn small" type="button" data-notify>Slå på notiser</button>' : ''}</div>${any && isIOS() && !isStandalone() ? installHTML() : ''}`;
}
async function showNotice(title, body, href) {
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
      const d1 = q[x]?.d1; if (d1 == null || Math.abs(d1) < larm[x]) continue;
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
  const fmtD = (t) => new Date(t * 1000).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: range === '1m' || range === '6m' ? undefined : 'numeric', timeZone: 'Europe/Stockholm' });
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
  const d = await api(`/api/summary?s=${encodeURIComponent(sym)}&namn=${encodeURIComponent(namn)}`, 60 * 60e3);
  if (!$('#ai-sum')) return;
  if (!d?.punkter?.length) { box.innerHTML = ''; return; }
  box.innerHTML = `<div class="ai-box"><span class="label-up">AI-sammanfattning på svenska</span>
    <ul>${d.punkter.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
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
      c.innerHTML = sel[k] ? `<span class="avatar">${esc(short(sel[k]))}</span><span class="grow"><b style="display:block;font-weight:500">${esc(nameOf(sel[k]))}</b><span class="small muted">${esc(sel[k])}</span></span><button class="btn ghost small" type="button" data-clear="${k}">Byt</button>` : '<span class="muted">Inget valt än</span>';
    }
  };
  for (const k of ['a', 'b']) {
    const card = $(`[data-slot="${k}"]`); const input = card.querySelector('input'); const list = card.querySelector('[data-results]');
    let timer;
    const search = async () => {
      const term = input.value.trim(); if (term.length < 2) { list.innerHTML = ''; return; }
      const r = await api('/api/search?q=' + encodeURIComponent(term), 60 * 60e3);
      if (term !== input.value.trim()) return;
      list.innerHTML = (r?.results || []).slice(0, 6).map((x) => `<button type="button" class="pick" data-sym="${esc(x.sym)}" data-namn="${esc(x.klass ? `${x.namn}, ${x.typ}` : x.namn)}"><span class="avatar">${esc(short(x.sym))}</span><span class="grow" style="text-align:left"><span style="display:block;font-weight:500">${esc(x.namn)}</span><span class="small muted">${esc([x.typ, x.sym].filter(Boolean).join(' · '))}</span></span></button>`).join('') || (r?.results ? '<p class="small muted">Inga träffar.</p>' : `<p class="small muted">${esc(errText(r))}</p>`);
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
    const L = [A, B];
    const bad = L.find((x) => x.error);
    if (bad) { box.innerHTML = `<div class="empty">${esc(errText(bad.error))}</div>`; return; }
    const head = L.map((s) => `<div class="card stack cmp-head" style="gap:10px">
        <span class="label-up">${esc(s.lista || s.sym)}</span>
        <a href="/bolag/${encodeURIComponent(s.sym)}" data-link style="color:inherit;text-decoration:none;font-size:22px;font-weight:500;line-height:1.2">${esc(s.namn)}</a>
        <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><span class="num" style="font-size:28px">${s.kurs != null ? kr(s.kurs) : '–'} <span class="muted" style="font-size:14px">${esc(cur(s.valuta))}</span></span>${s.d1 != null ? `<span class="pill ${tone(s.d1)}">${pct(s.d1)} i dag</span>` : ''}</div>
        <div style="display:flex;align-items:center;gap:10px"><span class="small muted">Riskkoll</span>${s.poang != null ? `<b class="num" style="font-size:20px">${s.poang} / 10</b><span class="pill ${LV[lvlOf(s.poang)].c}">${LV[lvlOf(s.poang)].t}</span>` : '<span class="small muted">För lite data</span>'}</div>
      </div>`).join('');
    const names = [...new Set(L.flatMap((s) => (s.faktorer || []).map((f) => f[0])))];
    const factorRow = (n) => `<tr><th scope="row">${esc(n)}</th>${L.map((s) => { const f = (s.faktorer || []).find((x) => x[0] === n); return `<td>${f ? `<span class="pill ${LV[f[1]].c}">${LV[f[1]].t}</span><span class="small muted cmp-sub">${esc(f[2])}</span>` : '<span class="faint">–</span>'}</td>`; }).join('')}</tr>`;
    const factKeys = [...new Set(L.flatMap((s) => (s.fakta || []).map((f) => f[0])))];
    const factRow = (k) => `<tr><th scope="row">${esc(k)}</th>${L.map((s) => `<td class="num">${esc((s.fakta || []).find((f) => f[0] === k)?.[1] || '–')}</td>`).join('')}</tr>`;
    const perfKeys = [...new Set(L.flatMap((s) => (s.perf || []).map((p) => p[0])))];
    const perfRow = (k) => `<tr><th scope="row">${esc(k)}</th>${L.map((s) => { const v = (s.perf || []).find((p) => p[0] === k)?.[1]; return `<td class="num" style="color:var(--${tone(v)})">${v != null ? pct(v) : '–'}</td>`; }).join('')}</tr>`;
    const tbl = (title, rows) => rows.length ? `<section class="card" style="padding:8px 22px 14px"><div class="table-wrap"><table class="cmp"><caption class="label-up" style="text-align:left;padding:12px 0 4px">${title}</caption><thead><tr><th scope="col"><span class="sr-only">Mått</span></th>${L.map((s) => `<th scope="col">${esc(short(s.sym))}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div></section>` : '';
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
const cleanSym = (s) => { const v = String(s || '').trim().toUpperCase(); return /^\^?[A-Z0-9][A-Z0-9.\-_:]{0,24}$/.test(v) ? v : null; };

function route() {
  // Sidor som alla får se, även utan konto
  const PUBLIC = ['/om', '/integritet', '/ordlista'];
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
  // Inte inloggad: spara vart man var på väg och visa inloggningen
  if (locked() && !location.pathname.startsWith('/konto')) {
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
  if (path === '/aktier') return { active: 'aktier', title: 'Alla aktier', html: viewAktier(), mount: () => mountAktier(params) };
  if (path === '/jamfor') return { active: 'jamfor', title: 'Jämför', html: viewJamfor(), mount: () => mountJamfor(params) };
  if (path === '/konto') return { active: 'konto', title: ACC.user ? 'Mitt konto' : 'Logga in', html: viewKonto(), mount: mountKonto };
  const m = path.match(/^\/bolag\/([^/]+)$/);
  if (m) {
    let sym = decodeURIComponent(m[1]);
    if (LEGACY[sym.toLowerCase()]) sym = LEGACY[sym.toLowerCase()];
    sym = sym.toUpperCase();
    if (/^\^?[A-Z0-9][A-Z0-9.\-_:]{0,24}$/.test(sym)) return { active: 'sok', title: nameOf(sym), html: viewBolag(sym), mount: () => mountBolag(sym) };
  }
  return { active: '', title: 'Sidan finns inte', html: viewNotFound() };
}

function refreshNav(active) { $('#sidebar').innerHTML = sidebar(active); }

function render() {
  const r = route();
  const pub = ['om', 'integritet', 'ordlista'].includes(r.active);
  document.body.classList.toggle('locked', locked() && !pub);
  document.body.classList.toggle('nosidebar', locked() && pub);
  document.title = `${r.title} · Finanskollen`;
  refreshNav(r.active);
  const main = $('#main');
  const fresh = main.cloneNode(false); // tar bort gamla lyssnare
  fresh.innerHTML = r.html;
  main.replaceWith(fresh);
  r.mount?.();
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
window.addEventListener('popstate', render);
// Kolla inloggningen först så att ingenting av sidan syns innan
(async () => {
  document.body.classList.add('booting');
  $('#main').innerHTML = loading('Laddar …');
  await bootAccount().catch(() => {});
  await accCfg().catch(() => {});
  document.body.classList.remove('booting');
  render();
  // Kom man in via bekräftelselänken i mejlet: välkomna och gå vidare
  if (ACC.user && ACC.fromLink) { toast(`Välkommen${firstName() ? ', ' + firstName() : ''}!`, 'Din e-post är bekräftad och du är inloggad.'); goAfterLogin(); }
})();
setTimeout(checkAlarms, 5000);
setInterval(checkAlarms, 60e3);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
