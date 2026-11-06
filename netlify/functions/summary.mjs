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
    const sym = cleanSymbol(p.get('s'));
    if (!sym) throw new ApiError(400, 'ogiltig ticker');
    const namn = (p.get('namn') || sym).slice(0, 80);
    const key = Netlify.env.get('ANTHROPIC_API_KEY');
    if (!key) return cached({ saknas: 'no_ai_key' }, 300);

    const nr = await newsHandler(new Request(`https://internal/api/news?s=${encodeURIComponent(sym)}`));
    const news = nr.ok ? await nr.json() : { items: [] };
    const items = (news.items || []).slice(0, 10);
    if (!items.length) return cached({ saknas: 'no_news' }, 3600);

    const lista = items.map((n, i) => `${i + 1}. ${n.datum ? n.datum.slice(0, 10) : ''} | ${n.kalla} | ${n.rubrik}${n.text ? ' – ' + n.text : ''}`).join('\n');
    const prompt = `Här är de senaste nyhetsrubrikerna om ${namn} (${sym}):\n\n${lista}\n\nSammanfatta på enkel svenska vad nyheterna säger om bolaget, i 2 till 4 korta punkter. Regler:\n- Bara det som står i rubrikerna, inga egna antaganden.\n- Hoppa över rubriker som inte handlar om ${namn}.\n- Neutral ton. Inga råd om att köpa eller sälja och inga kursprognoser.\n- Använd aldrig ordet "säkert".\nSvara endast med JSON: {"punkter": ["...", "..."]}`;

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
    const text = (body?.content || []).filter((c) => c.type === 'text').map((c) => c.text || '').join('').trim();
    const punkter = parsePoints(text);
    if (!punkter.length) console.warn('[summary] kunde inte läsa AI-svaret:', JSON.stringify(body).slice(0, 400));
    if (!punkter.length && p.get('debug') === '1') return new Response(JSON.stringify({ debug: JSON.stringify(body).slice(0, 1500) }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
    if (!punkter.length) return cached({ saknas: 'no_ai_answer' }, 600);
    return cached({ punkter, antalNyheter: items.length, modell: 'Claude', hamtad: new Date().toISOString() }, 6 * 3600);
  } catch (e) { return fail(e); }
};

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
