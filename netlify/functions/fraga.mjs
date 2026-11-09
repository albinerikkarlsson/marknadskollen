import { cleanSymbol } from '../lib/finnhub.mjs';
import { userFromRequest } from '../lib/supa.mjs';
import stockHandler from './stock.mjs';
import newsHandler from './news.mjs';

// POST /api/fraga  →  AI-assistenten "Fråga Finanskollen". Svaret strömmas som ren text.
// Body: { meddelanden: [{ roll: 'user'|'assistant', text }], sym?: 'VOLV-B.ST', portfolj?: 'kort sammanfattning' }
// Kräver inloggning (Supabase-token i Authorization). Använder Netlifys AI Gateway.
const MODELS = ['claude-haiku-5-5', 'claude-haiku-4-5', 'claude-sonnet-4-5'];
const PER_DAG = 40; // frågor per användare och dag
const used = new Map(); // { 'id|datum': antal } så länge funktionen är varm

const SYSTEM = `Du är Finanskollens AI-assistent. Finanskollen är en svensk webbplats som hjälper alla att känna sig trygga med aktier, fonder och sparande.

Så svarar du:
- På enkel, vänlig svenska. Förklara svåra ord kort första gången.
- Kort och strukturerat: en mening som svarar direkt, sedan gärna punktlistor eller korta rubriker (### Rubrik). Högst cirka 220 ord om användaren inte ber om mer.
- Använd **fetstil** för det viktigaste. Inga tabeller.
- Bygg på fakta. Får du bolagsdata från Finanskollen nedan, använd den och säg att siffrorna kommer från Finanskollens riskkoll och vilken dag de hämtades. Hitta aldrig på siffror. Vet du inte, säg det.

Gränser du alltid håller:
- Du ger aldrig personliga köp- eller säljråd, och du säger aldrig att någon "ska" köpa eller sälja något. Ber någon om det, förklara vänligt att Finanskollen inte ger köptips, och lista i stället vad man kan tänka på för att bestämma själv.
- Du gör inga kursprognoser och lovar aldrig avkastning. Använd aldrig ordet "säkert" om investeringar.
- Handlar frågan om erbjudanden som låter för bra för att vara sanna, krypto-tips från okända eller påtryckningar att investera snabbt: varna tydligt för bedrägeri och tipsa om Finansinspektionens varningslista (fi.se).
- Frågor utanför ekonomi och finans: svara kort att du bara hjälper till med frågor om sparande, aktier, fonder, ekonomi och Finanskollen.
- Påminn vid behov om att riskkollen är en förenkling och att man kan prata med sin bank eller en rådgivare med tillstånd.

Avsluta alltid med en sista rad i exakt det här formatet, med tre korta följdfrågor som användaren kan vilja ställa:
FÖRSLAG: fråga 1 | fråga 2 | fråga 3`;

export default async (req) => {
  if (req.method !== 'POST') return text('Använd POST.', 405);
  const key = Netlify.env.get('ANTHROPIC_API_KEY');
  if (!key) return text('AI-assistenten är inte påslagen just nu.', 503);
  const user = await userFromRequest(req);
  if (!user) return text('Du behöver vara inloggad för att fråga AI-assistenten.', 401);

  const day = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
  const k = user.id + '|' + day;
  const n = used.get(k) || 0;
  if (n >= PER_DAG) return text(`Du har ställt ${PER_DAG} frågor i dag, vilket är maxgränsen. Välkommen tillbaka i morgon!`, 429);

  let body;
  try { body = await req.json(); } catch { return text('Fel format.', 400); }
  const msgs = (Array.isArray(body?.meddelanden) ? body.meddelanden : [])
    .filter((m) => m && (m.roll === 'user' || m.roll === 'assistant') && typeof m.text === 'string' && m.text.trim())
    .slice(-10)
    .map((m) => ({ role: m.roll, content: m.text.slice(0, m.roll === 'user' ? 1500 : 3000) }));
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return text('Skriv en fråga.', 400);
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();

  // Underlag: bolagsdata och rubriker om användaren frågar om ett visst bolag, och en sammanfattning av portföljen
  let context = '';
  const sym = cleanSymbol(body?.sym);
  if (sym) context += await companyContext(sym);
  if (typeof body?.portfolj === 'string' && body.portfolj.trim()) context += `\n\nAnvändarens portfölj enligt Finanskollen (användaren har själv skrivit in den):\n${body.portfolj.slice(0, 2500)}`;
  const system = SYSTEM + `\n\nDagens datum: ${day}.` + (user.user_metadata?.full_name ? ` Användaren heter ${String(user.user_metadata.full_name).split(' ')[0]}.` : '') + (context ? `\n\n--- Underlag från Finanskollen ---${context}` : '');

  const base = (Netlify.env.get('ANTHROPIC_BASE_URL') || 'https://api.anthropic.com').replace(/\/+$/, '');
  let upstream = null; let lastErr = '';
  for (const model of MODELS) {
    const res = await fetch(`${base}/v1/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 3000, stream: true, system, messages: msgs }),
      signal: AbortSignal.timeout(60000)
    }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }));
    if (res.ok) { upstream = res; break; }
    lastErr = `${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`;
    if (!/model|not.?found|not.?supported|not.?allowed/i.test(lastErr)) break;
  }
  if (!upstream) { console.warn('[fraga] AI:', lastErr); return text('AI-assistenten svarar inte just nu. Prova igen om en stund.', 502); }
  used.set(k, n + 1);

  // Skicka bara textdelarna vidare, i den takt de kommer
  const enc = new TextEncoder(); const dec = new TextDecoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const reader = upstream.body.getReader(); let buf = ''; let any = false;
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
            if (!line.startsWith('data:')) continue;
            let ev; try { ev = JSON.parse(line.slice(5)); } catch { continue; }
            if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && ev.delta.text) { any = true; ctrl.enqueue(enc.encode(ev.delta.text)); }
            if (ev.type === 'error') throw new Error(ev.error?.message || 'AI-fel');
          }
        }
        if (!any) ctrl.enqueue(enc.encode('Jag kunde inte formulera ett svar just nu. Prova att ställa frågan på ett annat sätt.'));
      } catch (e) {
        console.warn('[fraga] ström:', e?.message);
        ctrl.enqueue(enc.encode(any ? '\n\n(Svaret avbröts. Prova igen.)' : 'AI-assistenten svarar inte just nu. Prova igen om en stund.'));
      }
      ctrl.close();
    }
  });
  return new Response(stream, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
};

async function companyContext(sym) {
  try {
    const [sr, nr] = await Promise.all([
      stockHandler(new Request(`https://internal/api/stock?s=${encodeURIComponent(sym)}`)),
      newsHandler(new Request(`https://internal/api/news?s=${encodeURIComponent(sym)}`))
    ]);
    const s = sr.ok ? await sr.json() : null;
    if (!s || s.error) return `\n\nAnvändaren frågar om ${sym}, men Finanskollen har ingen data om det just nu.`;
    const n = nr.ok ? await nr.json().catch(() => null) : null;
    const lines = [
      `\n\nBolag: ${s.namn} (${s.sym}), ${s.lista || ''}. Data hämtad ${String(s.hamtad || '').slice(0, 16).replace('T', ' ')} från ${s.kalla || 'datakällan'}.`,
      s.kurs != null ? `Senaste kurs: ${s.kurs} ${s.valuta || ''}${s.d1 != null ? `, ${s.d1 > 0 ? '+' : ''}${s.d1} % i dag` : ''}.` : 'Kurs saknas.',
      s.fakta?.length ? 'Fakta: ' + s.fakta.map(([a, b]) => `${a} ${b}`).join('; ') + '.' : '',
      s.perf?.length ? 'Kursutveckling: ' + s.perf.map(([a, b]) => `${a} ${b > 0 ? '+' : ''}${b} %`).join(', ') + '.' : '',
      s.poang != null ? `Finanskollens riskkoll: ${s.poang} av 10 (1 = låg risk, 10 = hög).` : 'Riskkoll: för lite data för en total.',
      s.faktorer?.length ? 'Riskkollens delar: ' + s.faktorer.map((f) => `${f[0]}: ${['', 'låg', 'medel', 'hög'][f[1]]} (${f[2]})`).join('; ') + '.' : '',
      s.beskrivning ? `Verksamhet: ${String(s.beskrivning).slice(0, 600)}` : '',
      n?.items?.length ? 'Senaste rubriker: ' + n.items.slice(0, 5).map((x) => `"${x.rubrik}" (${x.kalla}, ${String(x.datum || '').slice(0, 10)})`).join('; ') + '.' : ''
    ];
    return lines.filter(Boolean).join('\n');
  } catch { return ''; }
}

const text = (t, status = 200) => new Response(t, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });

export const config = { path: '/api/fraga' };
