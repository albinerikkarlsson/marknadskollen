/* Marknadskollen. All data hämtas live via våra API-funktioner (/api/*), som i sin tur hämtar från Yahoo Finance, Finnhub och Finansinspektionen.
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
  ext: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'
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
const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* privat läge */ } };
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
    { id: 'bevakning', href: '/bevakning', label: 'Bevakning', icon: 'star', badge: true }
  ] }
];

function sidebar(active) {
  const watchCount = getWatch().length;
  const today = new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
  return `
  <nav class="nav" aria-label="Huvudmeny">
    <a class="brand" href="/" data-link>
      <span class="brand-mark">${svg('logo', 20, '#FFFFFF')}</span>
      <span class="brand-text"><span class="brand-name">Marknadskollen</span><span class="brand-sub">Trygg börskoll</span></span>
    </a>
    <div class="welcome"><b>Välkommen tillbaka</b><span>${esc(today)}</span></div>
    ${NAV.map((g) => `
      <div class="nav-group">
        <span class="nav-label">${g.group}</span>
        ${g.items.map((it) => `
          <a class="nav-link" href="${it.href}" data-link ${it.id === active ? 'aria-current="page"' : ''}>
            ${svg(it.icon)}<span>${it.label}</span>${it.badge && watchCount ? `<span class="nav-badge">${watchCount}</span>` : ''}
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
  `<footer class="foot">Ingen investeringsrådgivning. Kurser, nyckeltal och nyheter kommer från Yahoo Finance och Finnhub, insynshandel och blankning från Finansinspektionen. Riskkollen räknas fram med fasta regler som förklaras på varje bolagssida. ${extra}</footer>`;

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
    <article class="wide card dark rings stack" style="gap:12px;padding:26px;justify-content:space-between;min-height:260px">
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
    <a class="result tilt" href="/bolag/${encodeURIComponent(r.sym)}" data-link data-namn="${esc(r.namn)}" data-sym="${esc(r.sym)}">
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
  else rememberName(sym, s.namn);
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
    <span class="eyebrow">Sparas i din webbläsare tills vi har inloggning</span>
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
    const alarms = rows.filter((r) => r.q.d1 != null && Math.abs(r.q.d1) >= 3);
    $('#alarms').innerHTML = alarms.length ? `<div class="grid g3">${alarms.map((a, i) => `
      <div class="card ${i === 0 ? 'dark rings' : ''} stack" style="gap:8px">
        <span class="pill ${i === 0 ? 'inv' : tone(a.q.d1)}" style="align-self:flex-start">Larm · rörelse över 3 %</span>
        <span style="font-size:17px;font-weight:500">${esc(a.namn)} är ${a.q.d1 < 0 ? 'ner' : 'upp'} ${pct(Math.abs(a.q.d1), 1).replace('+', '')} i dag</span>
        <a class="small" href="/bolag/${encodeURIComponent(a.sym)}" data-link>Se riskkollen →</a>
      </div>`).join('')}</div>` : '';
    $('#watchtable').innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th scope="col">Värdepapper</th><th scope="col" class="r">Kurs</th><th scope="col" class="r">I dag</th><th scope="col">Riskkoll</th><th scope="col"><span class="sr-only">Ta bort</span></th></tr></thead>
      <tbody>${rows.map((r) => `
        <tr>
          <td><a class="co" href="/bolag/${encodeURIComponent(r.sym)}" data-link><span class="avatar">${esc(short(r.sym))}</span><span><span style="display:block;font-weight:500">${esc(r.namn)}</span><span class="small muted">${esc(r.sym)}</span></span></a></td>
          <td class="r num">${r.q.kurs != null ? kr(r.q.kurs) : '<span class="faint">saknas</span>'}</td>
          <td class="r"><span class="pill ${tone(r.q.d1)}">${r.q.d1 != null ? pct(r.q.d1, 1) : '–'}</span></td>
          <td><a href="/bolag/${encodeURIComponent(r.sym)}" data-link class="small">Visa →</a></td>
          <td class="r"><button class="btn ghost small" type="button" data-unwatch="${esc(r.sym)}" aria-label="Sluta bevaka ${esc(r.namn)}">Ta bort</button></td>
        </tr>`).join('')}</tbody>
    </table></div>
    <p class="small faint" style="margin:6px 14px 10px">${quotes.__hamtad ? `Kurser hämtade kl ${esc(clock(quotes.__hamtad))}. "Saknas" betyder att ingen datakälla har kursen just nu.` : esc(errText(quotes.__error))}</p>`;
  };
  $('.main').addEventListener('click', (e) => {
    const b = e.target.closest('[data-unwatch]'); if (!b) return;
    toggleWatch(b.dataset.unwatch); refreshNav('bevakning'); draw();
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
          <div class="chips"><span class="pill outline num">${esc(s.sym)}</span>${safeUrl(s.webb) ? `<a class="pill outline" href="${esc(safeUrl(s.webb))}" target="_blank" rel="noopener noreferrer" style="text-decoration:none">Webbplats ${svg('ext', 13)}</a>` : ''}
            <button class="btn small ${watched ? 'ghost' : ''}" type="button" data-watch="${esc(s.sym)}" data-namn="${esc(s.namn)}" aria-pressed="${watched}">${watched ? 'Bevakas ✓' : 'Bevaka'}</button></div>
        </div>
      </div>
      ${priceBlock(s)}
    </header>

    ${s.fakta?.length ? `<div class="statbar card">${s.fakta.map(([k, v]) => `<div class="stat"><span class="small muted">${esc(k)}</span><span class="num">${esc(v)}</span></div>`).join('')}</div>` : ''}

    <div class="co-grid">
      <div class="co-main stack" style="gap:24px">
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
          <h2 class="section" id="insyn-h">Insynshandel</h2>
          <p class="small muted" style="margin:0">Personer i bolagets ledning och styrelse måste anmäla sina affärer i aktien. Här är de senaste tolv månaderna.</p>
          <div id="insyn-body" class="stack" style="gap:16px">${loading('Hämtar insynsaffärer …')}</div>
        </section>

        <section class="card co-section" aria-labelledby="blank-h">
          <span class="label-up">Finansinspektionen</span>
          <h2 class="section" id="blank-h">Blankning</h2>
          <div id="blank-body" class="stack" style="gap:16px">${loading('Hämtar blankning …')}</div>
        </section>` : ''}

        <section class="card co-section" aria-labelledby="bnyh-h">
          <span class="label-up">Nyheter</span>
          <h2 class="section" id="bnyh-h">Senaste om ${esc(s.namn)}</h2>
          <div id="bolagnews">${loading('Hämtar nyheter …')}</div>
        </section>
      </div>

      <aside class="co-side" aria-label="Riskkoll">
        <section class="card dark rings stack tilt glare" style="gap:14px;padding:26px" aria-labelledby="risk-h"><span class="glare-layer" aria-hidden="true"></span>
          <span class="label-up" style="color:rgba(255,255,255,0.6)">Riskkoll</span>
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
              <span style="font-weight:500">${esc(namn)}</span>
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
  document.title = `${s.namn} · Marknadskollen`;
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
function route() {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(location.search);
  if (path === '/') return { active: 'oversikt', title: 'Översikt', html: viewOversikt(), mount: mountOversikt };
  if (path === '/sok' && params.get('s')) { history.replaceState(null, '', '/bolag/' + encodeURIComponent(params.get('s'))); return route(); }
  if (path === '/sok') return { active: 'sok', title: 'Sök och riskkoll', html: viewSok(params), mount: () => mountSok(params) };
  if (path === '/nyheter') return { active: 'nyheter', title: 'Nyheter', html: viewNyheter(), mount: mountNyheter };
  if (path === '/bevakning') return { active: 'bevakning', title: 'Bevakning', html: viewBevakning(), mount: mountBevakning };
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
  document.title = `${r.title} · Marknadskollen`;
  refreshNav(r.active);
  const main = $('#main');
  const fresh = main.cloneNode(false); // tar bort gamla lyssnare
  fresh.innerHTML = r.html;
  main.replaceWith(fresh);
  r.mount?.();
}

function navigate(href) {
  history.pushState(null, '', href);
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
render();
