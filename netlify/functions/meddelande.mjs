import { cached, fail, ApiError } from '../lib/finnhub.mjs';

// GET /api/meddelande?u=<länk till view.news.eu.nasdaq.com>
// Hela texten i ett bolagsmeddelande, som bolaget publicerade det via Nasdaq Nordic.
// Bolagsmeddelanden skrivs för att spridas, så texten kan visas på sidan med källa och länk till originalet.
// Bara Nasdaqs egen sida godtas, så att funktionen inte kan användas för att hämta annat.
const HOST = 'view.news.eu.nasdaq.com';
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', euro: '€', aring: 'å', auml: 'ä', ouml: 'ö', Aring: 'Å', Auml: 'Ä', Ouml: 'Ö', eacute: 'é', uuml: 'ü', aelig: 'æ', oslash: 'ø', AElig: 'Æ', Oslash: 'Ø' };
const decode = (s) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e] ?? m));
const MAX = 9000;

export default async (req) => {
  try {
    const raw = new URL(req.url).searchParams.get('u') || '';
    let u; try { u = new URL(raw); } catch { throw new ApiError(400, 'ogiltig länk'); }
    if (u.protocol !== 'https:' || u.hostname !== HOST || u.pathname !== '/view') throw new ApiError(400, 'bara Nasdaqs meddelanden');
    const res = await fetch(u.toString(), { headers: { 'user-agent': 'Mozilla/5.0 Finanskollen', accept: 'text/html' }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new ApiError(502, 'meddelandet kunde inte hämtas');
    const html = await res.text();
    const i = html.indexOf('id="view-body"'); if (i < 0) throw new ApiError(502, 'texten hittades inte');
    let end = html.indexOf('class="attachments"', i); if (end < 0) end = html.indexOf('class="view-hr"', i); if (end < 0) end = html.indexOf('view-footer', i); if (end < 0) end = i + 200000;
    end = html.lastIndexOf('<', end);
    const body = html.slice(html.indexOf('>', i) + 1, end)
      .replace(/<(script|style|head|title)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|tr|h[1-6]|table)>/gi, '\n\n').replace(/<li[^>]*>/gi, '• ').replace(/<\/t[dh]>/gi, '  ')
      .replace(/<[^>]+>/g, ' ');
    let text = decode(body).replace(/[ \t ]+/g, ' ').split('\n').map((l) => l.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    const helt = text.length <= MAX;
    if (!helt) text = text.slice(0, MAX).replace(/\s+\S*$/, '') + ' …';
    const stycken = text.split(/\n\n+/).map((x) => x.trim()).filter(Boolean);
    // Bilagor: länkar till Nasdaqs bilagor (pdf och bilder)
    const bilagor = [...html.slice(end, end + 20000).matchAll(/href="(https:\/\/attachment\.news\.eu\.nasdaq\.com\/[a-z0-9]+)"[^>]*>([^<]{1,120})</gi)].map((m) => ({ lank: m[1], namn: decode(m[2]).trim() })).slice(0, 8);
    if (!stycken.length) throw new ApiError(502, 'texten var tom');
    return cached({ stycken, helt, bilagor, kalla: 'Nasdaq Nordic', lank: u.toString(), hamtad: new Date().toISOString() }, 24 * 3600);
  } catch (e) { return fail(e); }
};

export const config = { path: '/api/meddelande' };
