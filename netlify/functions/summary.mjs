import { cached, fail, cleanSymbol, ApiError } from '../lib/finnhub.mjs';
import newsHandler from './news.mjs';

// GET /api/summary?s=VOLV-B.ST&namn=AB Volvo  →  kort AI-sammanfattning på svenska av de senaste nyheterna
// Kräver miljövariabeln ANTHROPIC_API_KEY i Netlify. Utan nyckel svarar funktionen { saknas: 'no_ai_key' }.
// Netlifys AI Gateway lägger själv in ANTHROPIC_API_KEY och ANTHROPIC_BASE_URL. Finns ingen gateway går anropet direkt till Anthropic.
// Flera modeller provas i tur och ordning om gatewayen inte har den första.
const MODELS = ['claude-haiku-5-5', 'claude-haiku-4-5', 'claude-sonnet-4-5', 'claude-3-5-haiku-latest'];

export default async (req) => {
  try {
    const p = new URL(req.url).searchParams;
    if (p.get('syms')) return await weekSummary(p);
    const sym = cleanSymbol(p.get('s'));
    if (!sym) throw new ApiError(400, 'ogiltig ticker');
    const namn = (p.get('namn') || sym).slice(0, 80);
    const en = p.get('lang') === 'en';
    const key = Netlify.env.get('ANTHROPIC_API_KEY');
    if (!key) return cached({ saknas: 'no_ai_key' }, 300);

    const nr = await newsHandler(new Request(`https://internal/api/news?s=${encodeURIComponent(sym)}`));
    const news = nr.ok ? await nr.json() : { items: [] };
    const items = (news.items || []).slice(0, 10);
    if (!items.length) return cached({ saknas: 'no_news' }, 3600);

    const lista = items.map((n, i) => `${i + 1}. ${n.datum ? n.datum.slice(0, 10) : ''} | ${n.kalla} | ${n.rubrik}${n.text ? ' – ' + n.text : ''}`).join('\n');
    const prompt = `Här är de senaste nyhetsrubrikerna om ${namn} (${sym}):\n\n${lista}\n\n${en ? 'Sammanfatta på enkel ENGELSKA (svara på engelska)' : 'Sammanfatta på enkel svenska'} vad nyheterna säger om bolaget, i 2 till 4 korta punkter. Regler:\n- Bara det som står i rubrikerna, inga egna antaganden.\n- Hoppa över rubriker som inte handlar om ${namn}.\n- Neutral ton. Inga råd om att köpa eller sälja och inga kursprognoser.\n- Använd aldrig ordet "säkert".\nSvara endast med JSON: {"punkter": ["...", "..."]}`;

    const body = await askAI(key, prompt);
    const text = (body?.content || []).filter((c) => c.type === 'text').map((c) => c.text || '').join('').trim();
    const punkter = parsePoints(text);
    if (!punkter.length) console.warn('[summary] kunde inte läsa AI-svaret:', JSON.stringify(body).slice(0, 400));
    if (!punkter.length) return cached({ saknas: 'no_ai_answer' }, 600);
    return cached({ punkter, antalNyheter: items.length, modell: 'Claude', hamtad: new Date().toISOString() }, 6 * 3600);
  } catch (e) { return fail(e); }
};

async function askAI(key, prompt) {
    const base = (Netlify.env.get('ANTHROPIC_BASE_URL') || 'https://api.anthropic.com').replace(/\/+$/, '');
    let body = null; let lastErr = null;
    for (const model of MODELS) {
      const res = await fetch(`${base}/v1/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(20000)
      });
      const b = await res.json().catch(() => null);
      if (res.ok) { body = b; break; }
      lastErr = new ApiError(res.status === 429 ? 429 : 502, `AI ${res.status} (${model}): ${JSON.stringify(b?.error || b).slice(0, 200)}`);
      // Fel modell eller modell som saknas: prova nästa. Annat fel: avbryt.
      if (!(res.status === 400 || res.status === 404 || res.status === 403) || !/model|not.?found|not.?supported|not.?allowed/i.test(JSON.stringify(b || ''))) break;
    }
  if (!body) throw lastErr || new ApiError(502, 'AI svarade inte');
  return body;
}

// GET /api/summary?syms=VOLV-B.ST,AAPL&namn=Volvo B,Apple  →  veckan i dina aktier, 3 till 4 punkter
async function weekSummary(p) {
  const syms = p.get('syms').split(',').map(cleanSymbol).filter(Boolean).slice(0, 8);
  const namn = (p.get('namn') || '').split(',').map((x) => x.slice(0, 40));
  const en = p.get('lang') === 'en';
  if (!syms.length) throw new ApiError(400, 'ogiltig ticker');
  const key = Netlify.env.get('ANTHROPIC_API_KEY');
  if (!key) return cached({ saknas: 'no_ai_key' }, 300);
  const since = Date.now() - 7 * 864e5;
  const res = await Promise.all(syms.map((s) => newsHandler(new Request(`https://internal/api/news?s=${encodeURIComponent(s)}`)).then((r) => (r.ok ? r.json() : { items: [] })).catch(() => ({ items: [] }))));
  const rows = res.flatMap((n, i) => (n.items || []).filter((x) => x.datum && new Date(x.datum).getTime() >= since).slice(0, 5).map((x) => `${namn[i] || syms[i]} | ${x.datum.slice(0, 10)} | ${x.kalla} | ${x.rubrik}${x.text ? ' – ' + String(x.text).slice(0, 160) : ''}`));
  if (!rows.length) return cached({ saknas: 'no_news' }, 3600);
  const prompt = `Här är rubrikerna från den senaste veckan om aktierna i en privatpersons portfölj:\n\n${rows.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n\n${en ? 'Svara på enkel ENGELSKA.' : 'Svara på enkel svenska.'} Sammanfatta veckan i 3 till 4 korta punkter, en mening var, och börja varje punkt med bolagets namn. Regler:\n- Bara det som står i rubrikerna, inga egna antaganden.\n- Neutral ton. Inga råd om att köpa eller sälja och inga kursprognoser.\n- Använd aldrig ordet "säkert".\nSvara endast med JSON: {"punkter": ["...", "..."]}`;
  const body = await askAI(key, prompt);
  const text = (body?.content || []).filter((c) => c.type === 'text').map((c) => c.text || '').join('').trim();
  const punkter = parsePoints(text);
  if (!punkter.length) return cached({ saknas: 'no_ai_answer' }, 600);
  return cached({ punkter, antalNyheter: rows.length, hamtad: new Date().toISOString() }, 6 * 3600);
}

// Svaret ska vara JSON, men om modellen skriver en vanlig punktlista tar vi den i stället
export function parsePoints(text) {
  const t = String(text || '').replace(/```(?:json)?/gi, '').trim();
  const a = t.indexOf('{'); const z = t.lastIndexOf('}');
  if (a >= 0 && z > a) {
    try { const j = JSON.parse(t.slice(a, z + 1)); const arr = Array.isArray(j.punkter) ? j.punkter : Object.values(j).find(Array.isArray) || []; const out = arr.map((x) => String(x).trim()).filter(Boolean); if (out.length) return out.slice(0, 4); } catch { /* prova punktlista */ }
  }
  const lines = t.split(/\n+/).map((l) => l.replace(/^\s*(?:[-•*]|\d+[.)])\s+/, '').trim()).filter((l) => l.length > 15 && !/:$/.test(l) && !/^\{|\}$|^\[|\]$/.test(l));
  return lines.slice(0, 4);
}

export const config = { path: '/api/summary' };
