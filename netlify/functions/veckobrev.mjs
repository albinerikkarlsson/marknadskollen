import { SUPA } from '../lib/supa.mjs';
import { yChart } from '../lib/yahoo.mjs';
import kalenderHandler from './kalender.mjs';

// Veckobrevet: varje fredag kväll får de som valt det ett mejl om hur deras aktier har gått.
// Kräver tre saker i Netlify (Project configuration → Environment variables):
//   VECKOBREV_NYCKEL  nyckeln som SQL-skriptet i supabase/anvandardata.sql visar
//   RESEND_API_KEY    nyckel från resend.com, som skickar mejlen
//   VECKOBREV_FRAN    (valfri) avsändare, t.ex. "Finanskollen <veckobrev@finanskollen.live>"
// Saknas något hoppar funktionen över utskicket och skriver det i loggen.
const SITE = 'https://finanskollen.live';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nf = (n, d = 0) => Number(n).toLocaleString('sv-SE', { minimumFractionDigits: d, maximumFractionDigits: d });
const kr = (n) => `${nf(Math.round(n))} kr`;
const pctTxt = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${nf(Math.abs(n), 1)} %`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default async () => {
  const nyckel = Netlify.env.get('VECKOBREV_NYCKEL'); const resend = Netlify.env.get('RESEND_API_KEY');
  if (!nyckel || !resend) { console.log('[veckobrev] avstängt: VECKOBREV_NYCKEL eller RESEND_API_KEY saknas'); return new Response('avstängt'); }
  const fran = Netlify.env.get('VECKOBREV_FRAN') || 'Finanskollen <veckobrev@finanskollen.live>';
  const res = await fetch(SUPA.url() + '/rest/v1/rpc/veckobrev_mottagare', { method: 'POST', headers: { apikey: SUPA.anon(), 'content-type': 'application/json' }, body: JSON.stringify({ nyckel }) });
  if (!res.ok) { console.warn('[veckobrev] kunde inte hämta mottagare', res.status, (await res.text()).slice(0, 200)); return new Response('fel', { status: 502 }); }
  const mottagare = await res.json();
  const cache = new Map();
  let skickade = 0;
  for (const m of mottagare) {
    try {
      const brev = await buildLetter(m, cache);
      if (!brev) continue;
      const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: 'Bearer ' + resend, 'content-type': 'application/json' }, body: JSON.stringify({ from: fran, to: [m.email], subject: brev.subject, html: brev.html, text: brev.text }) });
      if (r.ok) skickade++; else console.warn('[veckobrev] Resend', r.status, (await r.text()).slice(0, 200));
    } catch (e) { console.warn('[veckobrev] fel för en mottagare:', e?.message); }
    await sleep(600); // Resend tillåter ett par mejl per sekund
  }
  console.log(`[veckobrev] skickade ${skickade} av ${mottagare.length}`);
  return new Response(`skickade ${skickade}`);
};

// Kurs i dag och för en vecka sedan, i kronor per aktie. Delas mellan mottagarna.
async function weekOf(sym, cache) {
  if (!cache.has(sym)) cache.set(sym, (async () => {
    const c = await yChart(sym, '1mo', '1d');
    const pts = c.points; const now = c.quote?.kurs ?? pts[pts.length - 1]?.[1];
    const cut = Date.now() / 1000 - 7 * 86400;
    const before = [...pts].reverse().find((p) => p[0] <= cut)?.[1] ?? null;
    let fx = 1; const cur = c.quote?.valuta || 'SEK';
    if (cur !== 'SEK') { const base = cur === 'GBp' ? 'GBP' : cur; const f = await yChart(`${base}SEK=X`, '5d', '1d').catch(() => null); fx = f?.quote?.kurs ? f.quote.kurs / (cur === 'GBp' ? 100 : 1) : null; }
    return { now, before, fx, namn: c.quote?.namn || sym };
  })().catch(() => null));
  return cache.get(sym);
}

export async function buildLetter(m, cache = new Map()) {
  const d = m.data || {};
  const port = Array.isArray(d.portfolj) ? d.portfolj.filter((x) => x?.sym && x.antal > 0) : [];
  const watch = Array.isArray(d.bevakning) ? d.bevakning.filter((x) => typeof x === 'string') : [];
  const namn = (s) => d.namn?.[s] || s;
  const syms = [...new Set([...port.map((x) => x.sym), ...watch])].slice(0, 40);
  if (!syms.length) return null;
  const W = Object.fromEntries(await Promise.all(syms.map(async (s) => [s, await weekOf(s, cache)])));
  // Portföljens värde nu och för en vecka sedan (med dagens växelkurs)
  let nu = 0; let fore = 0; let ok = false;
  const per = {}; for (const p of port) per[p.sym] = (per[p.sym] || 0) + p.antal;
  for (const [s, antal] of Object.entries(per)) { const w = W[s]; if (!w?.now || !w.before || !w.fx) continue; nu += antal * w.now * w.fx; fore += antal * w.before * w.fx; ok = true; }
  const veckan = syms.map((s) => ({ s, w: W[s] })).filter((x) => x.w?.now && x.w.before).map((x) => ({ ...x, p: (x.w.now / x.w.before - 1) * 100 })).sort((a, b) => b.p - a.p);
  // Rapporter och utdelningsdagar den kommande veckan
  const kal = await Promise.all(syms.slice(0, 25).map((s) => kalenderHandler(new Request(`https://internal/api/kalender?s=${encodeURIComponent(s)}`)).then((r) => (r.ok ? r.json() : null)).catch(() => null)));
  const idag = new Date().toISOString().slice(0, 10); const om7 = new Date(Date.now() + 7 * 86400e3).toISOString().slice(0, 10);
  const ev = [];
  for (const k of kal.filter(Boolean)) {
    if (k.rapport && k.rapport >= idag && k.rapport <= om7) ev.push([k.rapport, namn(k.sym), 'Rapport']);
    if (k.exUtdelning && k.exUtdelning >= idag && k.exUtdelning <= om7) ev.push([k.exUtdelning, namn(k.sym), 'X-dag, handlas utan utdelning']);
    if (k.utbetalning && k.utbetalning >= idag && k.utbetalning <= om7) ev.push([k.utbetalning, namn(k.sym), 'Utdelning betalas ut']);
  }
  ev.sort((a, b) => a[0].localeCompare(b[0]));
  const fornamn = String(m.namn || '').split(' ')[0];
  const diff = nu - fore;
  const subject = ok ? `Din vecka: ${diff >= 0 ? '+' : '−'}${kr(Math.abs(diff))} (${pctTxt(fore ? (diff / fore) * 100 : 0)})` : 'Din vecka på Finanskollen';
  // Bidrag i kronor per aktie och OMXS30 samma vecka
  const bidrag = Object.entries(per).map(([s, antal]) => { const w = W[s]; return w?.now && w.before && w.fx ? { s, kr: antal * (w.now - w.before) * w.fx, p: (w.now / w.before - 1) * 100 } : null; }).filter(Boolean).sort((a, b) => Math.abs(b.kr) - Math.abs(a.kr));
  const omx = await weekOf('^OMX', cache); const omxP = omx?.now && omx.before ? (omx.now / omx.before - 1) * 100 : null;
  const pct = fore ? (diff / fore) * 100 : 0;
  const G = '#4CC38A', R = '#F07167', C = (n) => (n >= 0 ? G : R); const sgn = (n) => (n >= 0 ? '+' : '−');
  // Tre saker att veta
  const tre = [];
  if (ok && bidrag[0]) { const t = bidrag[0]; const share = diff ? Math.abs(t.kr / diff) * 100 : 0; tre.push([`${namn(t.s)} ${t.kr >= 0 ? 'drog upp' : 'drog ner'} mest`, `${pctTxt(t.p)} och ${sgn(t.kr)}${kr(Math.abs(t.kr))}${share >= 25 && Math.sign(t.kr) === Math.sign(diff) ? `, ungefär ${nf(Math.round(share / 5) * 5)} % av veckans resultat` : ''}.`]); }
  if (ev.length) { const e = ev[0]; const dag = new Date(e[0] + 'T12:00:00Z').toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Stockholm' }); tre.push([`${e[2] === 'Rapport' ? 'Rapport' : e[2].startsWith('X-dag') ? 'Utdelning' : 'Utbetalning'} ${dag}`, `${e[1]}: ${e[2].toLowerCase()}.${ev.length > 1 ? ` Och ${ev.length - 1} till nästa vecka.` : ''}`]); }
  if (ok && bidrag.length > 1) { const w = bidrag.slice().sort((a, b) => a.p - b.p)[0]; if (w.s !== bidrag[0].s) tre.push([`${namn(w.s)} ${w.p < 0 ? 'gick sämst' : 'steg minst'}`, `${pctTxt(w.p)} under veckan, ${sgn(w.kr)}${kr(Math.abs(w.kr))}.`]); }
  if (!ok && veckan[0]) tre.push([`${namn(veckan[0].s)} gick bäst av dina aktier`, `${pctTxt(veckan[0].p)} under veckan.`]);
  const box = (k, v, c = '#E8EAED') => `<td style="width:33%;padding:0 4px"><div style="background:#15171C;border:1px solid #23262D;border-radius:12px;padding:12px"><div style="font-size:11px;color:#8B919B">${k}</div><div style="font-size:16px;font-weight:700;color:${c};white-space:nowrap">${v}</div></div></td>`;
  const html = `<!doctype html><html><head><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head><body style="margin:0;background:#050608;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#E8EAED">
  <div style="max-width:600px;margin:0 auto;padding:24px 12px">
   <div style="background:#0B0C10;border:1px solid #1E2026;border-radius:22px;overflow:hidden">
    <div style="padding:22px 26px 26px;background:#0B0C10;background-image:radial-gradient(120% 140% at 100% 0%,rgba(255,90,0,.35),rgba(255,90,0,0) 60%)">
      <table style="width:100%;border-collapse:collapse"><tr><td style="font-size:15px;font-weight:800;letter-spacing:-.02em;color:#E8EAED">FINANSKOLLEN<span style="color:#FF5A00">.</span></td><td style="text-align:right;font-size:12px;color:#C9CDD4">${esc(new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Stockholm' }))}</td></tr></table>
      <p style="margin:22px 0 2px;font-size:15px;color:#C9CDD4">Din vecka${fornamn ? ', ' + esc(fornamn) : ''}</p>
      ${ok ? `<p style="margin:0;font-size:44px;font-weight:800;letter-spacing:-.03em;color:${C(diff)}">${pctTxt(pct)} <span style="font-size:18px;font-weight:600">${sgn(diff)}${kr(Math.abs(diff))}</span></p>` : `<p style="margin:0;font-size:22px;font-weight:700">Så gick dina aktier</p>`}
      ${omxP != null ? `<p style="margin:4px 0 0;font-size:13px;color:#C9CDD4">OMXS30 gick ${pctTxt(omxP)} samma vecka</p>` : ''}
    </div>
    ${tre.length ? `<div style="padding:18px 26px;border-top:1px solid #1E2026"><p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8B919B">${tre.length === 3 ? 'Tre saker att veta' : 'Att veta'}</p>
      <table style="width:100%;border-collapse:collapse">${tre.map(([t, s2], i) => `<tr><td style="width:44px;padding:12px 0;vertical-align:top;${i ? 'border-top:1px solid #1E2026' : ''}"><div style="width:32px;height:32px;line-height:32px;text-align:center;border-radius:10px;background:#2A1A10;color:#FF9A5C;font-weight:800">${i + 1}</div></td><td style="padding:12px 0;${i ? 'border-top:1px solid #1E2026' : ''}"><div style="font-size:15px;font-weight:700">${esc(t)}</div><div style="font-size:13px;color:#8B919B;margin-top:2px">${esc(s2)}</div></td></tr>`).join('')}</table></div>` : ''}
    ${ok ? `<div style="padding:18px 22px;border-top:1px solid #1E2026"><table style="width:100%;border-collapse:collapse"><tr>${box('Värde nu', kr(nu))}${box('Veckan', `${sgn(diff)}${kr(Math.abs(diff))}`, C(diff))}${box('OMXS30', omxP != null ? pctTxt(omxP) : '–', omxP != null ? C(omxP) : '#E8EAED')}</tr></table></div>` : ''}
    <div style="padding:24px 26px;border-top:1px solid #1E2026;text-align:center"><a href="${SITE}/portfolj" style="display:inline-block;background:#FF5A00;color:#fff;text-decoration:none;padding:13px 26px;border-radius:12px;font-weight:700;font-size:15px">Se hela veckan</a></div>
    <div style="padding:16px 26px 20px;border-top:1px solid #1E2026;font-size:12px;line-height:1.6;color:#6B717B">Varje fredag kl 18 · <a href="${SITE}/konto" style="color:#8B919B">Ändra eller avsluta</a><br>Kurser från Yahoo Finance, utländska aktier räknade med dagens växelkurs. Inget här är ett råd om att köpa eller sälja.</div>
   </div>
  </div></body></html>`;
  const text = [`Din vecka${fornamn ? ', ' + fornamn : ''}`, '', ok ? `Portföljen: ${sgn(diff)}${kr(Math.abs(diff))} (${pctTxt(pct)}), värde nu ${kr(nu)}.` : '', omxP != null ? `OMXS30: ${pctTxt(omxP)}.` : '', '', ...tre.map(([t, s2], i) => `${i + 1}. ${t}: ${s2}`), '', `Se hela veckan: ${SITE}/portfolj`, '', 'Inget här är ett råd om att köpa eller sälja. Ändra eller avsluta: ' + SITE + '/konto'].filter((x, i, arr) => x !== '' || arr[i - 1] !== '').join('\n');
  return { subject, html, text };
}

// Fredagar kl 17.00 UTC, alltså 18.00 svensk vintertid och 19.00 sommartid
export const config = { schedule: '0 17 * * 5' };
