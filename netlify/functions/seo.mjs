import { cleanSymbol } from '../lib/finnhub.mjs';
import { yQuotes } from '../lib/yahoo.mjs';

// GET /bolag/VOLV-B.ST  →  samma sida som vanligt, men med bolagets namn i titel och beskrivning redan i HTML:en.
// Då ser Google och länkförhandsvisningar rätt titel direkt, utan att vänta på JavaScript.
// Svaret sparas i Netlifys cache i ett dygn, så funktionen körs sällan.
const SITE = 'https://finanskollen.live';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const short = (n) => String(n || '').replace(/\s*\(publ\.?\)/i, '').replace(/,?\s+ser\.\s*([A-Z])$/i, ' $1').trim();

export default async (req) => {
  const url = new URL(req.url);
  const raw = decodeURIComponent(url.pathname.replace(/^\/bolag\//, '').split('/')[0] || '');
  const sym = cleanSymbol(raw);
  const page = await fetch(new URL('/index.html', url.origin)).then((r) => (r.ok ? r.text() : null)).catch(() => null);
  if (!page) return new Response('Sidan kunde inte laddas', { status: 502 });
  if (!sym) return new Response(page, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  // Namnet från Yahoo, men aldrig så att sidan blir långsam: efter 2,5 sekunder används tickern
  const q = await Promise.race([yQuotes([sym]).catch(() => ({})), new Promise((ok) => setTimeout(() => ok({}), 2500))]);
  const namn = short(q?.[sym]?.namn) || sym;
  const tick = sym.replace(/\.[A-Z]{1,3}$/, '');
  const title = `${namn} (${tick}) aktie: risk, insynshandel och blankning · Finanskollen`;
  const desc = `${namn}: riskkoll på enkel svenska, kursdiagram, ledningens köp och sälj, blankning och nyheter. Gratis och utan köptips.`;
  const canon = `${SITE}/bolag/${encodeURIComponent(sym)}`;
  const html = page
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(desc)}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(desc)}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${esc(canon)}$2`);
  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=0, must-revalidate',
      'netlify-cdn-cache-control': `public, durable, s-maxage=${q?.[sym]?.namn ? 86400 : 600}, stale-while-revalidate=86400`
    }
  });
};

export const config = { path: '/bolag/*' };
