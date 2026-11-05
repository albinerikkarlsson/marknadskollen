import { finnhub, cached, fail, cleanSymbol, dayIso } from '../lib/finnhub.mjs';

// GET /api/news?region=world|se  eller  /api/news?s=AAPL
// world: Finnhubs allmänna marknadsnyheter. se: nyheter om stora svenska bolag.
// s: nyheter om ett bolag. Vi visar rubrik, kort ingress och länk till källan.
const SE = ['VOLV-B.ST', 'ERIC-B.ST', 'SAAB-B.ST', 'EVO.ST', 'INVE-B.ST', 'ATCO-A.ST', 'HM-B.ST', 'SEB-A.ST'];

export default async (req) => {
  try {
    const p = new URL(req.url).searchParams;
    const one = cleanSymbol(p.get('s'));
    const region = p.get('region') === 'se' ? 'se' : 'world';
    const to = new Date(); const from = new Date(Date.now() - (one ? 14 : 5) * 864e5);
    let raw = [];
    let err = null;
    if (one || region === 'se') {
      const syms = one ? [one] : SE;
      const res = await Promise.allSettled(syms.map((s) => finnhub('/company-news', { symbol: s, from: dayIso(from), to: dayIso(to) })));
      for (const [i, r] of res.entries()) {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) raw.push(...r.value.slice(0, one ? 15 : 4).map((n) => ({ ...n, _sym: syms[i] })));
        else if (r.status === 'rejected') err = r.reason;
      }
    } else {
      raw = await finnhub('/news', { category: 'general' });
    }
    if (!raw.length && err) throw err;
    const seen = new Set();
    const items = [];
    for (const n of Array.isArray(raw) ? raw : []) {
      if (!n?.headline || !n?.url) continue;
      const key = n.url || n.id;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        rubrik: n.headline.trim(),
        text: clip(String(n.summary || '').replace(/\s+/g, ' ').trim(), 260),
        lank: n.url,
        kalla: n.source || hostOf(n.url),
        datum: n.datetime ? new Date(n.datetime * 1000).toISOString() : null,
        bolag: n._sym ? [n._sym.split('.')[0]] : String(n.related || '').split(',').filter(Boolean).slice(0, 3),
        kategori: n.category || ''
      });
    }
    items.sort((a, z) => String(z.datum).localeCompare(String(a.datum)));
    return cached({ region: one ? null : region, items: items.slice(0, 20), hamtad: new Date().toISOString() }, 900);
  } catch (e) { return fail(e); }
};

function clip(s, n) { return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + ' …' : s; }
function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'källa'; } }

export const config = { path: '/api/news' };
