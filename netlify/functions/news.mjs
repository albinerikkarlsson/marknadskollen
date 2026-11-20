import { finnhub, cached, fail, cleanSymbol, dayIso } from '../lib/finnhub.mjs';
import { ySearch, newsFromSearch, yChart } from '../lib/yahoo.mjs';

// GET /api/news?region=world|se  eller  /api/news?s=AAPL
// world: Finnhubs allmänna marknadsnyheter. se: nyheter om stora svenska bolag.
// s: nyheter om ett bolag. Vi visar rubrik, kort ingress och länk till källan.
// Finnhubs gratisplan saknar svenska bolag, så då hämtas rubrikerna från Yahoo Finance i stället.
// De största bolagen på Stockholmsbörsen, så att Sverige-fliken får många nyheter
const SE = ['VOLV-B.ST', 'ERIC-B.ST', 'SAAB-B.ST', 'EVO.ST', 'INVE-B.ST', 'ATCO-A.ST', 'HM-B.ST', 'SEB-A.ST', 'AZN.ST', 'ABB.ST', 'NDA-SE.ST', 'SHB-A.ST', 'SWED-A.ST', 'SAND.ST', 'ASSA-B.ST', 'ESSITY-B.ST', 'EQT.ST', 'ALFA.ST', 'HEXA-B.ST', 'EPI-A.ST', 'TELIA.ST', 'SKF-B.ST', 'BOL.ST', 'SCA-B.ST', 'NIBE-B.ST', 'SINCH.ST', 'GETI-B.ST', 'KINV-B.ST', 'TEL2-B.ST', 'SBB-B.ST'];

const SE_NAMN = { 'VOLV-B.ST': 'Volvo', 'ERIC-B.ST': 'Ericsson', 'SAAB-B.ST': 'Saab', 'EVO.ST': 'Evolution Gaming', 'INVE-B.ST': 'Investor AB', 'ATCO-A.ST': 'Atlas Copco', 'HM-B.ST': 'H&M', 'SEB-A.ST': 'SEB' , 'AZN.ST': 'AstraZeneca', 'ABB.ST': 'ABB', 'NDA-SE.ST': 'Nordea', 'SHB-A.ST': 'Handelsbanken', 'SWED-A.ST': 'Swedbank', 'SAND.ST': 'Sandvik', 'ASSA-B.ST': 'Assa Abloy', 'ESSITY-B.ST': 'Essity', 'EQT.ST': 'EQT', 'ALFA.ST': 'Alfa Laval', 'HEXA-B.ST': 'Hexagon', 'EPI-A.ST': 'Epiroc', 'TELIA.ST': 'Telia', 'SKF-B.ST': 'SKF', 'BOL.ST': 'Boliden', 'SCA-B.ST': 'Svenska Cellulosa', 'NIBE-B.ST': 'Nibe', 'SINCH.ST': 'Sinch', 'GETI-B.ST': 'Getinge', 'KINV-B.ST': 'Kinnevik', 'TEL2-B.ST': 'Tele2', 'SBB-B.ST': 'Samhällsbyggnadsbolaget' };

// Bolag med liknande namn som lätt blandas ihop
const NOT = { 'VOLV-B.ST': /Volvo Cars?\b|Volvo Car's/i, 'VOLV-A.ST': /Volvo Cars?\b|Volvo Car's/i };

export default async (req) => {
  try {
    const p = new URL(req.url).searchParams;
    const one = cleanSymbol(p.get('s'));
    const region = p.get('region') === 'se' ? 'se' : 'world';
    const to = new Date(); const from = new Date(Date.now() - (one ? 14 : 5) * 864e5);
    let raw = [];
    let err = null;
    // Finnhubs gratisplan har inga svenska bolag, så Sverige-fliken går direkt till Yahoo
    if (one) {
      const syms = [one];
      const res = await Promise.allSettled(syms.map((s) => finnhub('/company-news', { symbol: s, from: dayIso(from), to: dayIso(to) })));
      for (const [i, r] of res.entries()) {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) raw.push(...r.value.slice(0, one ? 15 : 4).map((n) => ({ ...n, _sym: syms[i] })));
        else if (r.status === 'rejected') err = r.reason;
      }
    } else if (region === 'world') {
      raw = await finnhub('/news', { category: 'general' });
    }
    if (!raw.length && (one || region === 'se')) {
      const syms = one ? [one] : SE;
      // Sök på både ticker och bolagsnamn, Yahoo hittar olika artiklar
      const terms = [];
      for (const s of syms) {
        const kw = (SE_NAMN[s] || '').split(' ')[0];
        terms.push([s, s, kw]);
        const nm = SE_NAMN[s] || (one ? await yChart(s, '5d', '1d').then((c) => cleanCo(c.meta?.longName || c.meta?.shortName)).catch(() => '') : '');
        if (nm) terms.push([nm, s, kwOf(nm)]);
        if (!kw && nm) terms[terms.length - 2][2] = kwOf(nm);
        if (!one && terms.length >= 60) break;
      }
      // Femton sökningar åt gången, så att Yahoo inte stryper oss
      const res = [];
      for (let i = 0; i < terms.length; i += 15) res.push(...(await Promise.allSettled(terms.slice(i, i + 15).map(([q]) => ySearch(q, { quotes: 1, news: one ? 10 : 8 })))));
      const oldest = from.getTime() - (one ? 45 : 9) * 864e5;
      for (const [i, r] of res.entries()) {
        if (r.status === 'fulfilled') raw.push(...newsFromSearch(r.value, terms[i][1], terms[i][2]).filter((n) => (!n.datetime || n.datetime * 1000 >= oldest) && !(NOT[terms[i][1]]?.test(n.headline))));
        else if (!err) err = r.reason;
      }
      if (!raw.length) console.warn('[news] Yahoo gav inga nyheter för', syms.join(','));
    }
    // Gratisplanen nekar nyheter om utländska bolag (403). Det är inget fel, bara tomt.
    if (!raw.length && err?.status === 403) {
      return cached({ region: one ? null : region, items: [], ingenAtkomst: true, hamtad: new Date().toISOString() }, 3600);
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
        text: clip(String(n.summary || '').replace(/\s+/g, ' ').trim(), 600),
        lank: n.url,
        // Bilden som källan skickar med nyheten. Visas med länk till källan.
        bild: /^https:\/\/\S+$/.test(String(n.image || '')) ? String(n.image) : null,
        kalla: n.source || hostOf(n.url),
        datum: n.datetime ? new Date(n.datetime * 1000).toISOString() : null,
        bolag: n._sym ? [n._sym.split('.')[0]] : String(n.related || '').split(',').filter(Boolean).slice(0, 3),
        sym: n._sym || null,
        kategori: n.category || ''
      });
    }
    // Källornas loggor och standardbilder ska inte visas som bild till nyheten. De känns igen på namnet,
    // eller på att samma bild används till flera nyheter.
    const n = {}; for (const x of items) if (x.bild) n[x.bild] = (n[x.bild] || 0) + 1;
    for (const x of items) if (x.bild && (n[x.bild] >= 2 || /logo|yahoo_finance_|placeholder|default|\/rz\/stage\//i.test(x.bild))) x.bild = null;
    items.sort((a, z) => String(z.datum).localeCompare(String(a.datum)));
    return cached({ region: one ? null : region, items: items.slice(0, one ? 30 : 80), hamtad: new Date().toISOString() }, 900);
  } catch (e) { return fail(e); }
};

// Det mest utmärkande ordet i namnet, t.ex. "Ericsson" ur "Telefonaktiebolaget LM Ericsson"
const kwOf = (n) => String(n).split(' ').filter((w) => w.length >= 3 && !/aktiebolag|^the$|^group$|^holding/i.test(w))[0] || '';
const cleanCo = (n) => String(n || '').replace(/\(publ\.?\)/gi, '').replace(/\b(AB|Aktiebolag|ser\.? [AB])\b/g, '').replace(/[,]/g, ' ').replace(/\s+/g, ' ').trim();
function clip(s, n) { return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + ' …' : s; }
function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'källa'; } }

export const config = { path: '/api/news' };
