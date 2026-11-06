import { cached, fail, cleanSymbol, ApiError } from '../lib/finnhub.mjs';
import newsHandler from './news.mjs';

// GET /api/summary?s=VOLV-B.ST&namn=AB Volvo  →  kort AI-sammanfattning på svenska av de senaste nyheterna
// Kräver miljövariabeln ANTHROPIC_API_KEY i Netlify. Utan nyckel svarar funktionen { saknas: 'no_ai_key' }.
const MODEL = 'claude-haiku-5-5';

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

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
      signal: AbortSignal.timeout(20000)
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status === 401 ? 503 : res.status === 429 ? 429 : 502, `AI ${res.status}: ${JSON.stringify(body?.error || body).slice(0, 200)}`);
    const text = (body?.content || []).map((c) => c.text || '').join('');
    const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    const punkter = (json.punkter || []).map((x) => String(x).trim()).filter(Boolean).slice(0, 4);
    if (!punkter.length) return cached({ saknas: 'no_news' }, 3600);
    return cached({ punkter, antalNyheter: items.length, modell: 'Claude', hamtad: new Date().toISOString() }, 6 * 3600);
  } catch (e) { return fail(e); }
};

export const config = { path: '/api/summary' };
