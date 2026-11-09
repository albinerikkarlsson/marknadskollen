import aktierHandler from './aktier.mjs';

// GET /sitemap.xml  →  lista över sidor för Google: de öppna sidorna och en bolagssida per aktie
const SITE = 'https://finanskollen.live';
const STATIC = ['/', '/aktier', '/nyheter', '/sok', '/jamfor', '/ordlista', '/om', '/integritet'];

export default async () => {
  const syms = [];
  for (const m of ['se', 'us']) {
    try {
      const r = await aktierHandler(new Request(`https://internal/api/aktier?m=${m}`));
      const d = r.ok ? await r.json() : null;
      for (const a of d?.aktier || []) if (a?.sym) syms.push(a.sym);
    } catch { /* listan blir kortare, men sidan fungerar */ }
  }
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const urls = [...STATIC.map((p) => `${SITE}${p}`), ...[...new Set(syms)].map((s) => `${SITE}/bolag/${encodeURIComponent(s)}`)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join('\n')}\n</urlset>\n`;
  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
      'netlify-cdn-cache-control': 'public, durable, s-maxage=86400, stale-while-revalidate=172800'
    }
  });
};

export const config = { path: '/sitemap.xml' };
