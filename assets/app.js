import { DATA_TID, ticker, heroes, bolag, nyheter, insyn, ovrigaAktier, radar, signalforklaring } from './data.js';

/* ---------------- Hjälpfunktioner ---------------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (n, d = 2) => (n == null ? '–' : (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toFixed(d).replace('.', ',') + ' %');
const tone = (n) => (n == null ? '' : n >= 0 ? 'up' : 'down');
const LV = { 1: { t: 'Låg', c: 'up' }, 2: { t: 'Medel', c: 'warn' }, 3: { t: 'Hög', c: 'down' } };
const $ = (sel, root = document) => root.querySelector(sel);

const ICON = {
  home: 'M4 11l8-7 8 7v9H4z',
  search: 'M11 5a6 6 0 1 0 0.01 0M20 20l-4.5-4.5',
  news: 'M5 5h11v14H6a1 1 0 0 1-1-1zM16 9h3v9a1 1 0 0 1-2 0V9M8 9h5M8 12h5M8 15h3',
  star: 'M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.4 7.2 18.9l.9-5.4-3.9-3.8 5.4-.8z',
  radar: 'M4 12a8 8 0 1 0 16 0a8 8 0 1 0-16 0M8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0M12 12l5-5',
  logo: 'M4 17l5-6 4 3 7-9',
  rapport: 'M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 15h5M10 18h3',
  uppkop: 'M4 12h12M12 8l4 4-4 4M20 5v14',
  insyn: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0.01 0',
  makro: 'M4 19V9M10 19V5M16 19v-7M22 19H2',
  ravara: 'M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z',
  handel: 'M3 7h18M3 12h18M3 17h12',
  warn: 'M12 4l9 16H3zM12 10v4M12 17v.01'
};
const svg = (name, size = 20, stroke = 'currentColor') =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON[name]}"></path></svg>`;

/* ---------------- Riskmodell ---------------- */
// Medelvärdet av faktorerna (1–3) räknas om till 1–10.
// Har bolaget minst en faktor på Hög blir totalen minst 4.
function risk(b) {
  const ls = b.faktorer.map((f) => f[1]);
  const mean = ls.reduce((a, c) => a + c, 0) / ls.length;
  let p = Math.round(((mean - 1) / 2) * 9 + 1);
  if (ls.includes(3)) p = Math.max(p, 4);
  const lvl = p <= 3 ? 1 : p <= 6 ? 2 : 3;
  return { poang: p, lvl, text: LV[lvl].t + ' risk' };
}

/* ---------------- Bevakningslista (sparas i webbläsaren) ---------------- */
const WKEY = 'mk-bevakning';
const DEFAULT_WATCH = ['boliden', 'volvo', 'evo', 'ericsson', 'saab'];
function getWatch() {
  try { const v = JSON.parse(localStorage.getItem(WKEY)); return Array.isArray(v) ? v : DEFAULT_WATCH.slice(); } catch { return DEFAULT_WATCH.slice(); }
}
function setWatch(list) { try { localStorage.setItem(WKEY, JSON.stringify(list)); } catch { /* privat läge */ } }
function toggleWatch(id) {
  const w = getWatch();
  const i = w.indexOf(id);
  if (i >= 0) w.splice(i, 1); else w.push(id);
  setWatch(w);
  return w.includes(id);
}

/* ---------------- Gemensamma delar ---------------- */
const NAV = [
  { group: 'Översikt', items: [{ id: 'oversikt', href: '/', label: 'Översikt', icon: 'home' }] },
  { group: 'Börsen', items: [
    { id: 'sok', href: '/sok', label: 'Sök och riskkoll', icon: 'search' },
    { id: 'nyheter', href: '/nyheter', label: 'Nyheter', icon: 'news' },
    { id: 'bevakning', href: '/bevakning', label: 'Bevakning', icon: 'star', badge: true },
    { id: 'riskradar', href: '/riskradar', label: 'Riskradar', icon: 'radar' }
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
    <div class="nav-foot">Exempeldata från ${esc(DATA_TID)}. Ingen investeringsrådgivning.</div>
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
  `<footer class="foot">Ingen investeringsrådgivning. Exempeldata från Bigdata.com, ${esc(DATA_TID)}. Uppdateras inte automatiskt ännu. ${extra}</footer>`;

const getBolag = (id) => bolag.find((b) => b.id === id);

/* ---------------- Vyer ---------------- */
function viewOversikt() {
  const riskList = bolag.filter((b) => !b.exempel).map((b) => ({ b, r: risk(b) })).sort((a, z) => a.r.poang - z.r.poang);
  const watch = getWatch();
  const mine = watch.map((id) => getBolag(id) || ovrigaAktier.find((o) => o.id === id)).filter(Boolean).slice(0, 4);
  return `
  ${topbar([['Översikt', '/']])}
  <div class="ticker num" aria-label="Index och råvaror">
    ${ticker.map((t) => `<span><span class="muted">${esc(t.name)}</span><span>${esc(t.val)}</span><span class="small" style="color:var(--${tone(t.d1)})">${pct(t.d1)}</span></span>`).join('')}
  </div>
  <div class="stack" style="gap:6px">
    <span class="eyebrow" style="display:inline-flex;align-items:center;gap:8px"><span class="dot"></span>Senast uppdaterad: ${esc(DATA_TID)}</span>
    <h1 class="title">Börsen i dag</h1>
  </div>

  <section class="stack" style="gap:14px" aria-labelledby="nyh-h">
    <div class="section-head" style="align-items:center">
      <h2 class="section" id="nyh-h">Senaste nyheterna</h2>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div class="tabs" role="tablist" aria-label="Region">
          <button role="tab" data-oregion="se" aria-selected="true">Sverige</button>
          <button role="tab" data-oregion="world" aria-selected="false">Världen</button>
        </div>
        <a class="more" href="/nyheter" data-link>Alla nyheter →</a>
      </div>
    </div>
    <div id="frontnews">${frontNews('se')}</div>
  </section>

  <div class="grid g3">
    ${heroes.map((h, i) => `
      <div class="card hero ${i === 0 ? 'dark rings' : ''}">
        <div style="display:flex;align-items:center;gap:12px">
          <span class="avatar">${esc(h.code)}</span>
          <div><div class="small muted">${esc(h.kind)}</div><div style="font-size:17px;font-weight:500">${esc(h.name)}</div></div>
        </div>
        <div><div class="small muted">Senast</div><div class="big num">${esc(h.val)}</div></div>
        <div class="chips"><span class="pill ${tone(h.d1)}">${pct(h.d1)} i dag</span><span class="pill ${i === 0 ? 'inv' : ''}">i år ${pct(h.ytd)}</span></div>
      </div>`).join('')}
  </div>

  <div class="grid g2">
    <div class="card dark rings stack" style="padding:24px;gap:14px">
      <span class="small muted">Sök och riskkoll</span>
      <span style="font-size:28px;letter-spacing:-0.01em;line-height:1.2">Hur riskabel är aktien du funderar på?</span>
      <span class="muted" style="font-size:14.5px">Sök på ett bolag och se skulder, värdering, svängningar och lönsamhet förklarat på enkel svenska.</span>
      <form class="searchbar" role="search" data-topsearch style="flex:none;max-width:none">
        ${svg('search', 18, '#6B6F76')}
        <label class="sr-only" for="heroq">Sök bolag eller ticker</label>
        <input id="heroq" name="q" type="search" placeholder="Till exempel Volvo eller Saab" autocomplete="off">
        <button class="btn small" type="submit">Sök</button>
      </form>
    </div>
    <div class="card" style="padding:24px">
      <div class="section-head" style="margin-bottom:6px"><span style="font-size:20px">Riskkoll i dag</span><a class="more" href="/sok" data-link>Alla →</a></div>
      ${riskList.map(({ b, r }) => `
        <a class="row-link" href="/sok?id=${b.id}" data-link>
          <span class="grow" style="font-size:15px">${esc(b.namn)}</span>
          <span class="small muted num">${r.poang}/10</span>
          <span class="pill ${LV[r.lvl].c}">${r.text}</span>
        </a>`).join('')}
    </div>
  </div>

  <div class="grid g2">
    <section class="card" aria-labelledby="mina-h">
      <div class="section-head"><h2 class="section" id="mina-h" style="font-size:22px">Mina aktier</h2><a class="more" href="/bevakning" data-link>Bevakning →</a></div>
      ${mine.length ? mine.map((m) => `
        <a class="row-link" href="${getBolag(m.id) ? '/bolag/' + m.id : '/bevakning'}" data-link>
          <span class="avatar">${esc(m.kort)}</span>
          <span class="grow" style="font-weight:500">${esc(m.namn)}</span>
          <span class="pill ${tone(m.d1)}">${pct(m.d1, 1)}</span>
        </a>`).join('') : '<p class="muted">Du bevakar inga aktier än. Sök på ett bolag och tryck på Bevaka.</p>'}
    </section>
  </div>
  ${footer()}`;
}

// Nyhetsblocket högst upp på startsidan: största nyheten som svart kort, resten i en lista
function frontNews(region) {
  const [top, ...rest] = nyheter[region];
  const tonePill = (t) => `<span class="pill ${t === 'Positiv' ? 'up' : t === 'Negativ' ? 'down' : ''}">${esc(t)}</span>`;
  return `
  <div class="split" style="align-items:stretch">
    <article class="wide card dark rings stack" style="gap:12px;padding:26px;justify-content:space-between;min-height:260px">
      <div class="stack" style="gap:12px">
        <div class="meta" style="color:rgba(255,255,255,0.62)"><span class="pill inv">${esc(top.kat)}</span><span class="num">${esc(top.tid)}</span><span>${esc(top.kalla)}</span></div>
        <h3 style="margin:0;font-size:clamp(24px,3vw,32px);font-weight:400;letter-spacing:-0.01em;line-height:1.2">${esc(top.rubrik)}</h3>
        <p style="margin:0;color:rgba(255,255,255,0.75);font-size:15.5px;max-width:620px">${esc(top.text)}</p>
      </div>
      <div class="meta" style="color:rgba(255,255,255,0.62)">${tonePill(top.ton)}<span>${esc(top.bolag)}</span></div>
    </article>
    <div class="narrow card" style="padding:10px 22px">
      ${rest.slice(0, 4).map((n) => `
        <a class="row-link" href="/nyheter" data-link style="align-items:flex-start;gap:14px">
          <span class="news-icon" style="width:40px;height:40px;border-radius:14px">${svg(n.ikon, 18)}</span>
          <span class="grow"><span style="display:block;font-weight:500;line-height:1.35">${esc(n.rubrik)}</span><span class="small muted num">${esc(n.tid)} · ${esc(n.kalla)}</span></span>
        </a>`).join('')}
    </div>
  </div>`;
}

function mountOversikt() {
  const tabs = document.querySelector('[aria-labelledby="nyh-h"] .tabs');
  tabs.addEventListener('click', (e) => {
    const b = e.target.closest('[data-oregion]');
    if (!b) return;
    tabs.querySelectorAll('[data-oregion]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    $('#frontnews').innerHTML = frontNews(b.dataset.oregion);
  });
}

function viewSok(params) {
  const q = params.get('q') || '';
  const sel = params.get('id') || (q ? '' : 'evo');
  return `
  ${topbar([['Översikt', '/'], ['Sök och riskkoll', '/sok']], false)}
  <div class="stack" style="gap:6px">
    <span class="eyebrow">Sök på en aktie och se hela riskbilden på enkel svenska</span>
    <h1 class="title">Sök och riskkoll</h1>
  </div>
  <form class="big-search" role="search" data-sokform>
    ${svg('search', 22, '#6B6F76')}
    <label class="sr-only" for="sokq">Sök bolag eller ticker</label>
    <input id="sokq" name="q" type="search" value="${esc(q)}" placeholder="Skriv ett bolag eller en ticker, till exempel Volvo eller SAAB" autocomplete="off">
    <button class="btn" type="submit">Sök</button>
  </form>
  <div class="split">
    <section class="narrow stack" style="gap:10px" aria-label="Sökresultat" id="results"></section>
    <section class="wide stack" style="gap:18px" aria-live="polite" id="panel"></section>
  </div>
  ${footer('Riskkollen visar hur mycket risk vi ser i siffrorna, inte om du ska köpa eller sälja. Småbolag A är ett påhittat exempel.')}`;
}

function sokMatches(q) {
  const s = q.trim().toLowerCase();
  if (!s) return bolag.slice();
  // Träff när något ord i namn, ticker eller sökord börjar med det man skrivit
  return bolag.filter((b) => (b.namn + ' ' + b.kort + ' ' + b.sok).toLowerCase().split(/[\s.·]+/).some((w) => w.startsWith(s)) || b.namn.toLowerCase().startsWith(s));
}

function renderSokResults(q, selId) {
  const hits = sokMatches(q);
  const el = $('#results');
  if (!el) return hits;
  el.innerHTML = `
    <span class="small muted">${q.trim() ? `${hits.length} ${hits.length === 1 ? 'träff' : 'träffar'}` : 'Populära sökningar'}</span>
    ${hits.map((b) => {
      const r = risk(b);
      return `
      <button type="button" class="result" data-pick="${b.id}" aria-pressed="${b.id === selId}">
        <span class="avatar">${esc(b.kort)}</span>
        <span style="flex:1;min-width:0"><span style="display:block;font-weight:500">${esc(b.namn)}</span><span class="small muted">${esc(b.lista)}</span></span>
        <span class="pill ${LV[r.lvl].c}">${r.text}</span>
      </button>`;
    }).join('')}
    ${hits.length ? '' : '<div class="empty">Inga träffar. Just nu finns Evolution, Saab B och Volvo B. Fler bolag kommer när vi kopplar in ett data-API.</div>'}
    <div class="empty">Fonder och ETF:er kommer i nästa version.</div>`;
  return hits;
}

function renderSokPanel(b) {
  const el = $('#panel');
  if (!el) return;
  if (!b) { el.innerHTML = '<div class="empty">Välj ett bolag i listan för att se riskkollen.</div>'; return; }
  const r = risk(b);
  const watched = getWatch().includes(b.id);
  el.innerHTML = `
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
      <div class="card stack" style="padding:24px;grid-column:span 1">
        <div style="display:flex;align-items:center;gap:14px">
          <span class="avatar" style="width:52px;height:52px">${esc(b.kort)}</span>
          <div><div class="small muted">${esc(b.lista)}</div><h2 class="section" style="font-size:30px">${esc(b.namn)}</h2></div>
        </div>
        <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap">
          <span class="num" style="font-size:36px;letter-spacing:-0.02em">${esc(b.kurs)} ${esc(b.valuta)}</span>
          ${b.d1 != null ? `<span class="pill ${tone(b.d1)}">${pct(b.d1)} i dag</span>` : ''}
        </div>
        <p style="margin:0;color:#55595F">${esc(b.sammanfattning)}</p>
        ${b.exempel ? '' : `<div class="chips">
          <a class="btn ghost small" href="/bolag/${b.id}" data-link>Öppna bolagssidan →</a>
          <button class="btn small ${watched ? 'ghost' : ''}" type="button" data-watch="${b.id}" aria-pressed="${watched}">${watched ? 'Bevakas ✓' : 'Bevaka'}</button>
        </div>`}
      </div>
      <div class="card dark rings stack" style="padding:24px;gap:14px">
        <span class="small muted">Total risk</span>
        <div style="display:flex;align-items:baseline;gap:8px"><span class="score num">${r.poang}</span><span class="muted" style="font-size:18px">/ 10</span></div>
        <span class="pill inv" style="align-self:flex-start">${r.text}</span>
        <div class="meter" role="img" aria-label="Risk ${r.poang} av 10">${Array.from({ length: 10 }, (_, i) => `<span class="${i < r.poang ? 'on' : ''}"></span>`).join('')}</div>
        <span class="small faint">Ett högre tal betyder mer risk, inte att aktien är dålig.</span>
      </div>
    </div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px">
      ${b.faktorer.map(([namn, l, varde, text]) => `
        <div class="card factor">
          <div class="hd"><span>${esc(namn)}</span><span class="pill ${LV[l].c}">${LV[l].t}</span></div>
          <span class="small muted num">${esc(varde)}</span>
          <span style="font-size:14px;color:var(--ink-2)">${esc(text)}</span>
        </div>`).join('')}
    </div>
    <div class="card stack" style="gap:10px">
      <span style="font-weight:500">Tänk på det här</span>
      ${b.tank.map((t) => `<span style="display:flex;gap:10px;font-size:14px;color:var(--ink-2)"><span aria-hidden="true">→</span>${esc(t)}</span>`).join('')}
    </div>
    <p class="small faint" style="margin:0">Så räknar vi: varje faktor får Låg (1), Medel (2) eller Hög (3). Medelvärdet räknas om till 1–10, och har bolaget minst en faktor på Hög blir totalen minst 4.</p>`;
}

function mountSok(params) {
  let q = params.get('q') || '';
  let sel = params.get('id') || '';
  const pick = () => {
    const hits = sokMatches(q);
    if (!sel || !hits.some((h) => h.id === sel)) sel = hits[0]?.id || '';
    renderSokResults(q, sel);
    renderSokPanel(getBolag(sel));
  };
  pick();
  const input = $('#sokq');
  input.addEventListener('input', () => { q = input.value; sel = ''; pick(); syncUrl(); });
  $('[data-sokform]').addEventListener('submit', (e) => { e.preventDefault(); q = input.value; pick(); syncUrl(); });
  $('#results').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pick]');
    if (!b) return;
    sel = b.dataset.pick; pick(); syncUrl();
    if (window.innerWidth < 900) $('#panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('#panel').addEventListener('click', (e) => {
    const w = e.target.closest('[data-watch]');
    if (!w) return;
    toggleWatch(w.dataset.watch); renderSokPanel(getBolag(sel)); refreshNav('sok');
  });
  function syncUrl() {
    const p = new URLSearchParams();
    if (q.trim()) p.set('q', q.trim());
    if (sel) p.set('id', sel);
    history.replaceState(null, '', '/sok' + (p.toString() ? '?' + p : ''));
  }
}

function viewNyheter() {
  return `
  ${topbar([['Översikt', '/'], ['Nyheter', '/nyheter']])}
  <div class="section-head" style="align-items:flex-end">
    <div class="stack" style="gap:6px">
      <span class="eyebrow">Sammanfattat på enkel svenska</span>
      <h1 class="title">Nyheter</h1>
    </div>
    <div class="tabs" role="tablist" aria-label="Region">
      <button role="tab" data-region="se" aria-selected="true">Sverige</button>
      <button role="tab" data-region="world" aria-selected="false">Världen</button>
    </div>
  </div>
  <div class="split">
    <section class="wide stack" aria-label="Nyhetslista" id="newslist"></section>
    <aside class="narrow stack" style="gap:16px">
      <div class="card dark rings stack" style="gap:14px">
        <span class="small muted">Stämningen i dagens nyheter</span>
        <span style="font-size:26px;line-height:1.2" id="mood-title"></span>
        <div style="display:flex;height:10px;border-radius:999px;overflow:hidden;gap:3px" role="img" id="mood-bar"></div>
        <div style="display:flex;justify-content:space-between" class="small" id="mood-legend"></div>
        <span class="small faint">Räknat på nyheterna i listan. Säger inget om vart kursen går.</span>
      </div>
      <div class="card stack">
        <span class="small muted">Filtrera</span>
        <div class="chips" id="newsfilter"></div>
      </div>
      <div class="empty">Nyheterna är sammanfattningar. Läs alltid källan innan du gör något med dina pengar.</div>
    </aside>
  </div>
  ${footer()}`;
}

function mountNyheter() {
  let region = 'se';
  let filt = 'Alla';
  const draw = () => {
    const all = nyheter[region];
    const cats = ['Alla', ...new Set(all.map((n) => n.kat))];
    if (!cats.includes(filt)) filt = 'Alla';
    const list = filt === 'Alla' ? all : all.filter((n) => n.kat === filt);
    document.querySelectorAll('[data-region]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.region === region)));
    $('#newsfilter').innerHTML = cats.map((c) => `<button type="button" class="chip-btn" data-filt="${esc(c)}" aria-pressed="${c === filt}">${esc(c)}</button>`).join('');
    $('#newslist').innerHTML = list.map((n) => `
      <article class="card news-item">
        <span class="news-icon">${svg(n.ikon, 22)}</span>
        <div class="stack" style="gap:8px;flex:1;min-width:0">
          <div class="meta"><span class="pill outline">${esc(n.kat)}</span><span class="num">${esc(n.tid)}</span><span>${esc(n.kalla)}</span></div>
          <h3>${esc(n.rubrik)}</h3>
          <p>${esc(n.text)}</p>
          <div class="meta"><span class="pill ${n.ton === 'Positiv' ? 'up' : n.ton === 'Negativ' ? 'down' : ''}">${esc(n.ton)}</span><span>${esc(n.bolag)}</span></div>
        </div>
      </article>`).join('');
    const pos = all.filter((n) => n.ton === 'Positiv').length;
    const neu = all.filter((n) => n.ton === 'Neutral').length;
    const neg = all.filter((n) => n.ton === 'Negativ').length;
    $('#mood-title').textContent = pos > neg ? 'Mest positiv' : neg > pos ? 'Mest negativ' : 'Blandad';
    $('#mood-bar').setAttribute('aria-label', `${pos} positiva, ${neu} neutrala, ${neg} negativa`);
    $('#mood-bar').innerHTML = `<span style="flex:${pos};background:#7EE2A8"></span><span style="flex:${neu};background:rgba(255,255,255,0.35)"></span><span style="flex:${neg};background:#FF9A90"></span>`;
    $('#mood-legend').innerHTML = `<span><b class="num" style="font-weight:500;color:#7EE2A8">${pos}</b> positiva</span><span><b class="num" style="font-weight:500">${neu}</b> neutrala</span><span><b class="num" style="font-weight:500;color:#FF9A90">${neg}</b> negativa</span>`;
  };
  draw();
  document.querySelector('.tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-region]'); if (b) { region = b.dataset.region; filt = 'Alla'; draw(); } });
  $('#newsfilter').addEventListener('click', (e) => { const b = e.target.closest('[data-filt]'); if (b) { filt = b.dataset.filt; draw(); } });
}

function viewBevakning() {
  const watch = getWatch();
  const rows = watch.map((id) => {
    const b = getBolag(id);
    if (b) return { id, kort: b.kort, namn: b.namn, lista: b.lista.split(' · ')[0], kurs: b.kurs, d1: b.d1, senaste: b.tank[0], href: '/bolag/' + id, risk: risk(b) };
    const o = ovrigaAktier.find((x) => x.id === id);
    return o ? { ...o, href: null, risk: null } : null;
  }).filter(Boolean);
  const alarms = rows.filter((r) => r.d1 != null && Math.abs(r.d1) >= 3);
  return `
  ${topbar([['Översikt', '/'], ['Bevakning', '/bevakning']])}
  <div class="stack" style="gap:6px">
    <span class="eyebrow">Sparas i din webbläsare tills vi har inloggning</span>
    <h1 class="title">Mina aktier</h1>
  </div>
  ${alarms.length ? `<div class="grid g3">${alarms.map((a, i) => `
    <div class="card ${i === 0 ? 'dark rings' : ''} stack" style="gap:8px">
      <span class="pill ${i === 0 ? 'inv' : tone(a.d1)}" style="align-self:flex-start">Larm · rörelse över 3 %</span>
      <span style="font-size:17px;font-weight:500">${esc(a.namn)} är ${a.d1 < 0 ? 'ner' : 'upp'} ${pct(Math.abs(a.d1)).replace('+', '')} i dag</span>
      <span class="small muted">${esc(a.senaste)}</span>
    </div>`).join('')}</div>` : ''}
  <section class="card" style="padding:10px" aria-labelledby="lista-h">
    <h2 id="lista-h" class="sr-only">Bevakade bolag</h2>
    ${rows.length ? `<div class="table-wrap"><table>
      <thead><tr><th scope="col">Bolag</th><th scope="col" class="r">Kurs</th><th scope="col" class="r">I dag</th><th scope="col">Risk</th><th scope="col">Senaste</th><th scope="col"><span class="sr-only">Ta bort</span></th></tr></thead>
      <tbody>${rows.map((r) => `
        <tr>
          <td>${r.href ? `<a class="co" href="${r.href}" data-link>` : '<span class="co">'}<span class="avatar">${esc(r.kort)}</span><span><span style="display:block;font-weight:500">${esc(r.namn)}</span><span class="small muted">${esc(r.lista)}</span></span>${r.href ? '</a>' : '</span>'}</td>
          <td class="r num">${esc(r.kurs)}</td>
          <td class="r"><span class="pill ${tone(r.d1)}">${pct(r.d1, 1)}</span></td>
          <td>${r.risk ? `<a href="/sok?id=${r.id}" data-link class="pill ${LV[r.risk.lvl].c}" style="text-decoration:none">${r.risk.poang}/10</a>` : '<span class="small faint">Kommer</span>'}</td>
          <td class="small muted">${esc(r.senaste)}</td>
          <td class="r"><button class="btn ghost small" type="button" data-unwatch="${r.id}" aria-label="Sluta bevaka ${esc(r.namn)}">Ta bort</button></td>
        </tr>`).join('')}</tbody>
    </table></div>` : '<div class="empty" style="margin:12px">Du bevakar inga aktier. Gå till <a href="/sok" data-link>Sök och riskkoll</a> och tryck på Bevaka.</div>'}
  </section>
  <section class="stack" aria-labelledby="insyn-h">
    <div class="section-head"><h2 class="section" id="insyn-h">Insynshandel den senaste veckan</h2><span class="small muted">Källa: Finansinspektionens insynsregister</span></div>
    <div class="grid g3">${insyn.map((i) => `
      <div class="card stack" style="gap:8px">
        <div style="display:flex;justify-content:space-between;align-items:center"><span class="pill ${i.typ === 'Köp' ? 'up' : 'down'}">${esc(i.typ)}</span><span class="small muted num">${esc(i.datum)}</span></div>
        <span style="font-size:17px;font-weight:500">${esc(i.bolag)}</span>
        <span class="small muted">${esc(i.vem)}</span>
        <span class="num">${esc(i.antal)} · ${esc(i.belopp)}</span>
      </div>`).join('')}</div>
    <span class="small faint">När någon i ledningen köper eller säljer kan det vara värt att veta varför. Det är inte en signal att göra samma sak.</span>
  </section>
  ${footer()}`;
}

function mountBevakning() {
  $('.main').addEventListener('click', (e) => {
    const b = e.target.closest('[data-unwatch]');
    if (!b) return;
    toggleWatch(b.dataset.unwatch);
    render();
  });
}

function viewBolag(id) {
  const b = getBolag(id);
  if (!b || b.exempel) return viewNotFound();
  const r = risk(b);
  const watched = getWatch().includes(b.id);
  const max = Math.max(...b.perf.map((p) => Math.abs(p[1])), 1);
  const worst = b.faktorer.filter((f) => f[1] === 3).map((f) => f[0]);
  return `
  ${topbar([['Bevakning', '/bevakning'], [b.namn, '/bolag/' + b.id]])}
  <div class="section-head" style="align-items:flex-end;gap:20px">
    <div style="display:flex;align-items:center;gap:16px">
      <span class="avatar" style="width:64px;height:64px;font-size:14px">${esc(b.kort)}</span>
      <div><div class="eyebrow">${esc(b.lista)}</div><h1 class="title">${esc(b.namn)}</h1></div>
    </div>
    <div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap">
      <span class="num" style="font-size:40px;letter-spacing:-0.02em">${esc(b.kurs)} <span class="muted" style="font-size:18px">SEK</span></span>
      <span class="pill ${tone(b.d1)}">${pct(b.d1)} i dag</span>
      <button class="btn ${watched ? 'ghost' : ''}" type="button" data-watch="${b.id}" aria-pressed="${watched}">${watched ? 'Bevakas ✓' : 'Bevaka'}</button>
    </div>
  </div>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px">
    ${b.fakta.map(([k, v]) => `<div class="card" style="padding:14px 16px;border-radius:18px"><div class="small muted">${esc(k)}</div><div class="num" style="font-size:16px">${esc(v)}</div></div>`).join('')}
  </div>
  <div class="split" style="align-items:stretch">
    <section class="wide card stack" style="gap:16px" aria-labelledby="utv-h">
      <div class="section-head"><h2 class="section" id="utv-h" style="font-size:22px">Så har kursen gått</h2><span class="small muted">Förändring i procent</span></div>
      ${b.perf.map(([label, v]) => {
        const w = (Math.abs(v) / max) * 50;
        return `<div class="perf-row"><span class="muted">${esc(label)}</span>
          <div class="perf-track" role="img" aria-label="${esc(label)} ${pct(v)}"><span class="zero"></span><span class="perf-bar ${v < 0 ? 'neg' : ''}" style="${v < 0 ? `right:50%;width:${w}%` : `left:50%;width:${w}%`}"></span></div>
          <span class="num" style="text-align:right;color:var(--${tone(v)})">${pct(v)}</span></div>`;
      }).join('')}
      <span class="small faint">Historisk utveckling säger inget om framtiden.</span>
    </section>
    <section class="narrow card dark rings stack" style="gap:14px" aria-labelledby="risk-h">
      <div style="display:flex;justify-content:space-between;align-items:center"><h2 class="section" id="risk-h" style="font-size:22px">Riskkoll</h2><span class="pill inv">${r.poang}/10 · ${r.text}</span></div>
      <p style="margin:0;color:rgba(255,255,255,0.85)">${esc(b.sammanfattning)}</p>
      ${worst.length ? `<span class="small muted">Högst risk: ${esc(worst.join(', '))}</span>` : ''}
      <a class="btn white" href="/sok?id=${b.id}" data-link style="align-self:flex-start">Full riskkontroll →</a>
    </section>
  </div>
  <div class="grid g3">
    ${[['Insynshandel', 'Köp och sälj från ledning och styrelse visas här när de rapporteras.'], ['Blankning', 'Hur stor del av aktierna som är lånade och sålda, och om det ökar.'], ['Största ägare', 'Vem som äger mest och om det har ändrats nyligen.']].map(([t, d]) => `
      <section class="card stack" style="gap:8px"><h2 style="margin:0;font-size:17px;font-weight:500">${t}</h2><span class="small muted">${d}</span><span class="pill" style="align-self:flex-start">Kommer med data-API</span></section>`).join('')}
  </div>
  ${footer()}`;
}

function mountBolag() {
  $('.main').addEventListener('click', (e) => {
    const w = e.target.closest('[data-watch]');
    if (!w) return;
    toggleWatch(w.dataset.watch);
    render();
  });
}

function viewRiskradar() {
  return `
  ${topbar([['Översikt', '/'], ['Riskradar', '/riskradar']])}
  <div class="split" style="align-items:stretch">
    <div class="wide stack" style="gap:10px;justify-content:center">
      <span class="eyebrow">Småbolag där något ovanligt händer</span>
      <h1 class="title">Riskradar</h1>
      <p style="margin:0;color:#55595F;max-width:640px;font-size:16px">Vi letar efter mönster som ofta syns innan småsparare förlorar pengar: plötslig volym, stora kursrörelser utan nyhet, nya emissioner och ledning som säljer. Ett varningstecken betyder inte att något är fel, bara att det är värt att titta närmare.</p>
    </div>
    <div class="narrow card dark rings stack" style="gap:6px;justify-content:center">
      <span class="small muted">Flaggade i dag</span>
      <span class="num" style="font-size:48px;font-weight:300;line-height:1.1">${radar.length}</span>
      <span class="small muted">påhittade exempel tills radarn får riktig data</span>
    </div>
  </div>
  <section class="stack" aria-labelledby="flag-h">
    <h2 class="section" id="flag-h">Flaggade bolag <span class="small muted">· exempel</span></h2>
    ${radar.map((r) => `
      <article class="card" style="display:flex;flex-wrap:wrap;gap:16px 24px;align-items:center">
        <div style="flex:1 1 220px;display:flex;align-items:center;gap:14px">
          <span class="news-icon" style="background:var(--down-bg);color:var(--down)">${svg('warn', 22)}</span>
          <div><div style="font-size:17px;font-weight:500">${esc(r.namn)}</div><div class="small muted">${esc(r.lista)}</div></div>
        </div>
        <div class="chips" style="flex:2 1 320px">${r.signaler.map((s) => `<span class="pill down">${esc(s)}</span>`).join('')}</div>
        <span class="pill ${LV[r.niva].c}">${r.niva === 3 ? 'Titta närmare' : 'Var försiktig'}</span>
      </article>`).join('')}
  </section>
  <section class="stack" aria-labelledby="sig-h">
    <h2 class="section" id="sig-h">Vad signalerna betyder</h2>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px">
      ${signalforklaring.map(([n, t]) => `<div class="card stack" style="gap:6px;border-radius:22px"><span style="font-weight:500">${esc(n)}</span><span class="small muted" style="font-size:14px">${esc(t)}</span></div>`).join('')}
    </div>
  </section>
  ${footer('Riskradarn pekar ut mönster, den anklagar ingen.')}`;
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

/* ---------------- Router ---------------- */
function route() {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(location.search);
  if (path === '/') return { active: 'oversikt', title: 'Översikt', html: viewOversikt(), mount: mountOversikt };
  if (path === '/sok') return { active: 'sok', title: 'Sök och riskkoll', html: viewSok(params), mount: () => mountSok(params) };
  if (path === '/nyheter') return { active: 'nyheter', title: 'Nyheter', html: viewNyheter(), mount: mountNyheter };
  if (path === '/bevakning') return { active: 'bevakning', title: 'Bevakning', html: viewBevakning(), mount: mountBevakning };
  if (path === '/riskradar') return { active: 'riskradar', title: 'Riskradar', html: viewRiskradar() };
  const m = path.match(/^\/bolag\/([a-z0-9-]+)$/);
  if (m) { const b = getBolag(m[1]); return { active: 'bevakning', title: b ? b.namn : 'Sidan finns inte', html: viewBolag(m[1]), mount: mountBolag }; }
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
  render();
  window.scrollTo(0, 0);
  $('#main').focus({ preventScroll: true });
}

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
  const q = new FormData(f).get('q') || '';
  navigate('/sok' + (String(q).trim() ? '?q=' + encodeURIComponent(String(q).trim()) : ''));
});
window.addEventListener('popstate', render);
render();
