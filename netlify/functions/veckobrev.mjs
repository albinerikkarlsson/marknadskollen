import { SUPA } from '../lib/supa.mjs';
import { yChart } from '../lib/yahoo.mjs';
import kalenderHandler from './kalender.mjs';

// Veckobrevet: varje måndag morgon får de som valt det ett mejl om hur deras aktier har gått.
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
  const subject = ok ? `Din vecka på börsen: ${diff >= 0 ? '+' : '−'}${kr(Math.abs(diff))} (${pctTxt(fore ? (diff / fore) * 100 : 0)})` : 'Din vecka på börsen';
  const color = (n) => (n >= 0 ? '#1E7A47' : '#C0392B');
  const row = (a, b, c = '') => `<tr><td style="padding:8px 0;border-top:1px solid #EEEFF1">${a}</td><td style="padding:8px 0;border-top:1px solid #EEEFF1;text-align:right;${c}">${b}</td></tr>`;
  const html = `<!doctype html><html><body style="margin:0;background:#ECEDEF;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111214">
  <div style="max-width:560px;margin:0 auto;padding:28px 16px">
    <p style="margin:0 0 18px;font-size:15px"><b>Finanskollen</b> · Veckobrev</p>
    <div style="background:#fff;border-radius:20px;padding:26px">
      <h1 style="margin:0 0 6px;font-size:24px;font-weight:500">Hej${fornamn ? ' ' + esc(fornamn) : ''}!</h1>
      <p style="margin:0 0 20px;color:#5A5E66">Så här har dina aktier gått den senaste veckan.</p>
      ${ok ? `<p style="margin:0;color:#5A5E66;font-size:14px">Din portfölj</p><p style="margin:2px 0 4px;font-size:30px">${kr(nu)}</p><p style="margin:0 0 20px;color:${color(diff)};font-size:16px">${diff >= 0 ? '+' : '−'}${kr(Math.abs(diff))} (${pctTxt(fore ? (diff / fore) * 100 : 0)}) på en vecka</p>` : ''}
      ${veckan.length ? `<p style="margin:0 0 4px;font-weight:500">Veckan för dina aktier</p><table style="width:100%;border-collapse:collapse;font-size:15px">${veckan.slice(0, 12).map((x) => row(esc(namn(x.s)), pctTxt(x.p), `color:${color(x.p)}`)).join('')}</table>` : ''}
      ${ev.length ? `<p style="margin:22px 0 4px;font-weight:500">Kommande vecka</p><table style="width:100%;border-collapse:collapse;font-size:15px">${ev.map((e) => row(`${esc(e[1])}<br><span style="color:#5A5E66;font-size:13px">${esc(e[2])}</span>`, esc(new Date(e[0] + 'T12:00:00Z').toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })))).join('')}</table>` : ''}
      <p style="margin:24px 0 0"><a href="${SITE}/" style="display:inline-block;background:#111214;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px">Öppna Finanskollen</a></p>
    </div>
    <p style="margin:18px 4px 0;color:#8A8E96;font-size:12px;line-height:1.5">Kurser från Yahoo Finance, utländska aktier räknade med dagens växelkurs. Historisk utveckling säger inget om framtiden, och det här är inget råd om att köpa eller sälja. Du får mejlet för att du har valt veckobrevet. Du stänger av det under <a href="${SITE}/konto" style="color:#8A8E96">Mitt konto</a>.</p>
  </div></body></html>`;
  const text = [`Hej${fornamn ? ' ' + fornamn : ''}!`, '', ok ? `Din portfölj: ${kr(nu)}, ${diff >= 0 ? '+' : '−'}${kr(Math.abs(diff))} på en vecka.` : '', ...veckan.slice(0, 12).map((x) => `${namn(x.s)}: ${pctTxt(x.p)}`), '', ev.length ? 'Kommande vecka:' : '', ...ev.map((e) => `${e[0]} ${e[1]}: ${e[2]}`), '', `Öppna Finanskollen: ${SITE}/`, `Stäng av veckobrevet under Mitt konto: ${SITE}/konto`].filter((x, i, a) => x !== '' || a[i - 1] !== '').join('\n');
  return { subject, html, text };
}

// Måndagar kl 07.00 UTC, alltså 08.00 svensk vintertid och 09.00 sommartid
export const config = { schedule: '0 7 * * 1' };
