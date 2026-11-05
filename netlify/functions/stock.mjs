import { finnhub, cached, fail, cleanSymbol, num, quoteOrNull, ApiError } from '../lib/finnhub.mjs';
import { buildFactors, perfFromMetric, riskScore, summarize, thinkAbout, money } from '../lib/risk.mjs';

// GET /api/stock?s=AAPL  →  kurs, bolagsfakta, utveckling och riskkoll för ett värdepapper
export default async (req) => {
  try {
    const sym = cleanSymbol(new URL(req.url).searchParams.get('s'));
    if (!sym) throw new ApiError(400, 'ogiltig ticker');

    // Tre oberoende anrop. Saknar planen något av dem visar vi det som finns.
    const [qr, pr, mr] = await Promise.allSettled([
      finnhub('/quote', { symbol: sym }),
      finnhub('/stock/profile2', { symbol: sym }),
      finnhub('/stock/metric', { symbol: sym, metric: 'all' })
    ]);
    const ok = (r) => (r.status === 'fulfilled' ? r.value : null);
    const q = quoteOrNull(ok(qr));
    const p = ok(pr) && Object.keys(ok(pr)).length ? ok(pr) : null;
    const m = ok(mr)?.metric && Object.keys(ok(mr).metric).length ? ok(mr).metric : null;
    if (!q && !p && !m) {
      const firstErr = [qr, pr, mr].find((r) => r.status === 'rejected')?.reason;
      throw firstErr || new ApiError(404, 'ingen data för ' + sym);
    }

    const bors = shortExchange(p?.exchange);
    const cur = p?.currency || (sym.endsWith('.ST') ? 'SEK' : 'USD');
    const kurs = q?.kurs ?? null;
    const namn = p?.name || sym;
    const mcapM = num(p?.marketCapitalization) ?? num(m?.marketCapitalization);
    const faktorer = buildFactors({ m: m || {}, price: kurs, cur, mcapM });
    // En total kräver minst tre delar, annars blir den missvisande
    const poang = faktorer.length >= 3 ? riskScore(faktorer) : null;
    const hi = num(m?.['52WeekHigh']); const lo = num(m?.['52WeekLow']);
    const fakta = [
      ['Börsvärde', mcapM ? money(mcapM * 1e6, cur) : null],
      ['52 veckor', hi && lo ? `${fmt(lo)}–${fmt(hi)}` : null],
      ['Bransch', p?.finnhubIndustry ? (SECTOR_SV[p.finnhubIndustry] || p.finnhubIndustry) : null],
      ['Börs', bors],
      ['Land', p?.country ? (COUNTRY_SV[p.country] || p.country) : null],
      ['Noterad', p?.ipo ? String(p.ipo).slice(0, 4) : null]
    ].filter((x) => x[1]);

    return cached({
      sym, namn,
      kort: sym.split('.')[0].split('-')[0].slice(0, 4),
      lista: [bors, p?.finnhubIndustry ? (SECTOR_SV[p.finnhubIndustry] || p.finnhubIndustry) : null].filter(Boolean).join(' · '),
      logo: p?.logo || null,
      webb: p?.weburl || null,
      valuta: cur, kurs, d1: q?.d1 ?? null, kursTid: q?.tid || null,
      fakta,
      perf: perfFromMetric(m || {}, q?.d1 ?? null),
      faktorer, poang,
      sammanfattning: faktorer.length ? summarize(namn, faktorer) : 'Datakällan har inte tillräckligt med nyckeltal för att göra en riskkoll av det här värdepappret.',
      tank: faktorer.length ? thinkAbout(faktorer, { price: kurs, hi, lo }) : [],
      saknarKurs: !q,
      saknarNyckeltal: !m,
      hamtad: new Date().toISOString()
    }, 900);
  } catch (e) { return fail(e); }
};

// Finnhub skriver t.ex. "NASDAQ NMS - GLOBAL MARKET". Vi visar kortare namn.
function shortExchange(x) {
  if (!x) return null;
  const u = x.toUpperCase();
  if (u.includes('STOCKHOLM')) return 'Nasdaq Stockholm';
  if (u.includes('NASDAQ')) return 'Nasdaq';
  if (u.includes('NEW YORK STOCK EXCHANGE') || u === 'NYSE') return 'NYSE';
  if (u.includes('OTC')) return 'OTC';
  if (u.includes('OSLO')) return 'Oslo Børs';
  if (u.includes('COPENHAGEN')) return 'Nasdaq Köpenhamn';
  if (u.includes('HELSINKI')) return 'Nasdaq Helsingfors';
  if (u.includes('LONDON')) return 'London';
  if (u.includes('XETRA') || u.includes('FRANKFURT')) return 'Frankfurt';
  return x.length > 22 ? x.split(' - ')[0] : x;
}
const fmt = (n) => n.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const SECTOR_SV = {
  'Technology': 'Teknik', 'Semiconductors': 'Halvledare', 'Software': 'Mjukvara', 'Machinery': 'Maskiner', 'Banking': 'Bank',
  'Financial Services': 'Finans', 'Pharmaceuticals': 'Läkemedel', 'Biotechnology': 'Bioteknik', 'Health Care': 'Hälsovård',
  'Aerospace & Defense': 'Försvar och flyg', 'Automobiles': 'Fordon', 'Retail': 'Detaljhandel', 'Media': 'Media',
  'Telecommunication': 'Telekom', 'Communications': 'Kommunikation', 'Energy': 'Energi', 'Utilities': 'Kraftförsörjning',
  'Real Estate': 'Fastigheter', 'Metals & Mining': 'Gruvor och metaller', 'Hotels, Restaurants & Leisure': 'Hotell, restaurang och nöje',
  'Insurance': 'Försäkring', 'Building': 'Bygg', 'Construction': 'Bygg', 'Chemicals': 'Kemi', 'Logistics & Transportation': 'Logistik och transport',
  'Beverages': 'Drycker', 'Food Products': 'Livsmedel', 'Consumer products': 'Konsumentprodukter', 'Electrical Equipment': 'Elutrustning',
  'Industrial Conglomerates': 'Industrikonglomerat', 'Airlines': 'Flyg', 'Textiles, Apparel & Luxury Goods': 'Kläder och lyx'
};
const COUNTRY_SV = { SE: 'Sverige', US: 'USA', NO: 'Norge', DK: 'Danmark', FI: 'Finland', DE: 'Tyskland', GB: 'Storbritannien', NL: 'Nederländerna', CH: 'Schweiz', FR: 'Frankrike', CN: 'Kina', JP: 'Japan', CA: 'Kanada', IE: 'Irland', TW: 'Taiwan' };

export const config = { path: '/api/stock' };
