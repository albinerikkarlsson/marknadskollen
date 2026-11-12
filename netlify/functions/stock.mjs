import { finnhub, cached, fail, cleanSymbol, num, quoteOrNull, ApiError } from '../lib/finnhub.mjs';
import { ySummary, yChart, metricFromSummary, perfFromChart, raw } from '../lib/yahoo.mjs';
import { buildFactors, perfFromMetric, riskScore, summarize, thinkAbout, money, blankFactor } from '../lib/risk.mjs';
import { loadBlankning, findBlank } from '../lib/fi.mjs';

// GET /api/stock?s=VOLV-B.ST  →  kurs, bolagsfakta, utveckling och riskkoll för ett värdepapper
// Yahoo Finance först (har även svenska aktier). Svarar Yahoo inte används Finnhub.
export default async (req) => {
  try {
    const sym = cleanSymbol(new URL(req.url).searchParams.get('s'));
    if (!sym) throw new ApiError(400, 'ogiltig ticker');
    const y = await fromYahoo(sym).catch((e) => { console.warn('[stock] Yahoo:', e?.message); return null; });
    if (y) return cached(y, 900);
    return cached(await fromFinnhub(sym), 900);
  } catch (e) { return fail(e); }
};

/* ---------- Yahoo ---------- */
async function fromYahoo(sym) {
  const [sr, cr, pr, br] = await Promise.allSettled([
    ySummary(sym),
    yChart(sym, '1y', '1d'),
    // Finnhub har logga och noteringsår för amerikanska bolag. Bara ett tillägg.
    /[.^]/.test(sym) ? Promise.resolve(null) : finnhub('/stock/profile2', { symbol: sym }, 4000),
    // Blankning från Finansinspektionen, bara svenska aktier
    sym.endsWith('.ST') ? Promise.race([loadBlankning(), new Promise((_, no) => setTimeout(() => no(new Error('FI svarade inte i tid')), 3500))]) : Promise.resolve(null)
  ]);
  const s = sr.status === 'fulfilled' ? sr.value : null;
  const c = cr.status === 'fulfilled' ? cr.value : null;
  if (!s && !c) throw (sr.reason || cr.reason || new ApiError(404, 'ingen data'));
  const fp = pr.status === 'fulfilled' && pr.value && Object.keys(pr.value).length ? pr.value : null;

  const price = s?.price || {};
  const ap = s?.assetProfile || {};
  const m = s ? metricFromSummary(s) : {};
  const kurs = c?.quote?.kurs ?? raw(price.regularMarketPrice);
  const d1 = c?.quote?.d1 ?? (raw(price.regularMarketChangePercent) != null ? Math.round(raw(price.regularMarketChangePercent) * 10000) / 100 : null);
  const tidS = raw(price.regularMarketTime);
  const kursTid = c?.quote?.tid || (tidS ? new Date(tidS * 1000).toISOString() : null);
  const cur = price.currency || c?.meta?.currency || (sym.endsWith('.ST') ? 'SEK' : 'USD');
  const namn = cleanTitle(price.longName || price.shortName || c?.meta?.longName || c?.meta?.shortName || fp?.name || sym);
  const typ = price.quoteType || c?.meta?.instrumentType || '';
  const bors = shortExchange(price.exchangeName || c?.meta?.fullExchangeName || c?.meta?.exchangeName || fp?.exchange);
  const sektor = ap.sector ? (SECTOR_SV[ap.sector] || ap.sector) : fp?.finnhubIndustry ? (SECTOR_SV[fp.finnhubIndustry] || fp.finnhubIndustry) : null;
  const mcapM = num(m.marketCapitalization);
  const hi = num(m['52WeekHigh']) ?? (c?.points?.length ? Math.max(...c.points.map((p) => p[1])) : null);
  const lo = num(m['52WeekLow']) ?? (c?.points?.length ? Math.min(...c.points.map((p) => p[1])) : null);
  if (hi && lo && m['52WeekHigh'] == null) { m['52WeekHigh'] = hi; m['52WeekLow'] = lo; }

  const faktorer = buildFactors({ m, price: kurs, cur, mcapM });
  // Blankning blir en sjunde del när registret svarar och det gäller en aktie
  let blankning = null;
  if (br.status === 'fulfilled' && br.value && (price.quoteType || 'EQUITY') === 'EQUITY') {
    const b = findBlank(br.value, namn);
    blankning = b ? { summa: b.summa, antal: b.positioner.length } : { summa: null, antal: 0 };
    faktorer.push(blankFactor(blankning.summa));
  }
  const poang = faktorer.length >= 3 ? riskScore(faktorer) : null;
  const anst = raw(ap.fullTimeEmployees);
  const fakta = [
    ['Börsvärde', mcapM ? money(mcapM * 1e6, cur) : null],
    ['52 veckor', hi && lo ? `${fmt(lo)}–${fmt(hi)}` : null],
    ['Bransch', sektor],
    ['Börs', bors],
    ['Land', ap.country ? (COUNTRY_EN[ap.country] || ap.country) : fp?.country ? (COUNTRY_SV[fp.country] || fp.country) : null],
    ['Anställda', anst ? anst.toLocaleString('sv-SE') : null],
    ['Utdelning', raw(s?.summaryDetail?.dividendYield) ? `${(raw(s.summaryDetail.dividendYield) * 100).toFixed(1).replace('.', ',')} %` : null]
  ].filter((x) => x[1]);

  const nyckeltal = s && (price.quoteType || 'EQUITY') === 'EQUITY' ? keyFigures(s, cur) : [];
  return {
    sym, namn, kalla: 'Yahoo Finance', nyckeltal,
    typ: TYP[typ] || null,
    kort: sym.replace('^', '').split('.')[0].split('-')[0].slice(0, 4),
    lista: [bors, sektor].filter(Boolean).join(' · '),
    logo: fp?.logo || null,
    webb: ap.website || fp?.weburl || null,
    beskrivning: ap.longBusinessSummary || null,
    valuta: typ === 'INDEX' ? 'poäng' : cur, kurs, d1, kursTid,
    fakta,
    perf: perfFromChart(c?.points, kurs, d1),
    faktorer, poang, blankning,
    beta: num(m.beta) ?? null,
    aktieslag: shareClass(sym),
    sammanfattning: faktorer.length ? summarize(namn, faktorer) : 'Datakällan har inte tillräckligt med nyckeltal för att göra en riskkoll av det här värdepappret.',
    tank: faktorer.length ? thinkAbout(faktorer, { price: kurs, hi, lo }) : [],
    saknarKurs: !kurs,
    saknarNyckeltal: !s || !Object.keys(m).length,
    hamtad: new Date().toISOString()
  };
}

/* ---------- Finnhub (reserv) ---------- */
async function fromFinnhub(sym) {
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
  const poang = faktorer.length >= 3 ? riskScore(faktorer) : null;
  const hi = num(m?.['52WeekHigh']); const lo = num(m?.['52WeekLow']);
  const sektor = p?.finnhubIndustry ? (SECTOR_SV[p.finnhubIndustry] || p.finnhubIndustry) : null;
  const fakta = [
    ['Börsvärde', mcapM ? money(mcapM * 1e6, cur) : null],
    ['52 veckor', hi && lo ? `${fmt(lo)}–${fmt(hi)}` : null],
    ['Bransch', sektor],
    ['Börs', bors],
    ['Land', p?.country ? (COUNTRY_SV[p.country] || p.country) : null],
    ['Noterad', p?.ipo ? String(p.ipo).slice(0, 4) : null]
  ].filter((x) => x[1]);
  return {
    sym, namn, kalla: 'Finnhub',
    kort: sym.replace('^', '').split('.')[0].split('-')[0].slice(0, 4),
    lista: [bors, sektor].filter(Boolean).join(' · '),
    logo: p?.logo || null,
    webb: p?.weburl || null,
    beskrivning: null,
    valuta: cur, kurs, d1: q?.d1 ?? null, kursTid: q?.tid || null,
    fakta,
    perf: perfFromMetric(m || {}, q?.d1 ?? null),
    faktorer, poang,
    beta: num(m?.beta) ?? null,
    sammanfattning: faktorer.length ? summarize(namn, faktorer) : 'Datakällan har inte tillräckligt med nyckeltal för att göra en riskkoll av det här värdepappret.',
    tank: faktorer.length ? thinkAbout(faktorer, { price: kurs, hi, lo }) : [],
    saknarKurs: !q,
    saknarNyckeltal: !m,
    hamtad: new Date().toISOString()
  };
}

// Aktieslag ur tickern: VOLV-B.ST → B-aktie
export const shareClass = (sym) => { const m = String(sym).match(/-([A-D])\.ST$/i); return m ? `${m[1].toUpperCase()}-aktie` : null; };

// "Volvo, AB ser. B" → "Volvo AB ser. B". Bara små städningar.
function cleanTitle(s) { return String(s).replace(/\s+/g, ' ').replace(/, AB\b/, ' AB').trim(); }

// Visa kortare börsnamn
export function shortExchange(x) {
  if (!x) return null;
  const u = x.toUpperCase();
  if (u.includes('STOCKHOLM') || u === 'STO') return 'Nasdaq Stockholm';
  if (u.includes('FIRST NORTH')) return 'First North';
  if (u.includes('NYSEARCA') || u.includes('NYSE ARCA') || u === 'PCX') return 'NYSE Arca';
  if (u.includes('NASDAQ') || u === 'NMS' || u === 'NGM' || u === 'NCM') return 'Nasdaq';
  if (u.includes('NEW YORK STOCK EXCHANGE') || u === 'NYSE' || u === 'NYQ') return 'NYSE';
  if (u.includes('OTC') || u === 'PNK') return 'OTC';
  if (u.includes('OSLO')) return 'Oslo Børs';
  if (u.includes('COPENHAGEN')) return 'Nasdaq Köpenhamn';
  if (u.includes('HELSINKI')) return 'Nasdaq Helsingfors';
  if (u.includes('LONDON') || u === 'LSE') return 'London';
  if (u.includes('XETRA') || u.includes('FRANKFURT') || u === 'GER') return 'Frankfurt';
  return x.length > 22 ? x.split(' - ')[0] : x;
}
// Nyckeltal för bolagssidan. Värden som saknas skickas som null och visas som "Saknas".
function keyFigures(s, cur) {
  const sd = s.summaryDetail || {}; const fd = s.financialData || {}; const ks = s.defaultKeyStatistics || {};
  const unit = cur === 'SEK' ? 'kr' : cur;
  // Vinst och försäljning redovisas i bolagets rapportvaluta, som kan skilja sig från kursens valuta
  const fcur = fd.financialCurrency || cur; const funit = fcur === 'SEK' ? 'kr' : fcur;
  const n2 = (v) => (v == null || !Number.isFinite(v) ? null : v.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const n1 = (v) => (v == null || !Number.isFinite(v) ? null : v.toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  const pc = (v) => (v == null || !Number.isFinite(v) ? null : `${n1(v * 100)} %`);
  const pos = (v) => (v != null && v > 0 ? v : null);
  const pe = pos(raw(sd.trailingPE)); const fpe = pos(raw(sd.forwardPE)); const eps = raw(ks.trailingEps);
  const pb = pos(raw(ks.priceToBook)); const ps = pos(raw(sd.priceToSalesTrailing12Months));
  const dy = raw(sd.dividendYield); const dr = raw(sd.dividendRate) ?? raw(sd.trailingAnnualDividendRate);
  const pm = raw(fd.profitMargins); const om = raw(fd.operatingMargins); const roe = raw(fd.returnOnEquity);
  const rg = raw(fd.revenueGrowth); const rev = raw(fd.totalRevenue); const de = raw(fd.debtToEquity);
  return [
    ['P/E', n1(pe), 'Priset delat med vinsten de senaste 12 månaderna. Saknas när bolaget går med förlust.'],
    ['Vinst per aktie (EPS)', eps == null ? null : `${n2(eps)} ${funit}`, 'Bolagets vinst de senaste 12 månaderna delat på antalet aktier.'],
    ['P/E framåt', n1(fpe), 'Priset delat med den vinst analytiker räknar med det kommande året.'],
    ['P/B', n1(pb), 'Priset jämfört med bolagets bokförda värde (eget kapital).'],
    ['P/S', n1(ps), 'Priset jämfört med bolagets försäljning de senaste 12 månaderna.'],
    ['Direktavkastning', dy == null ? null : pc(dy), 'Utdelningen per år i procent av aktiekursen.'],
    ['Utdelning per aktie', dr != null && dr > 0 ? `${n2(dr)} ${unit}` : (dy === 0 ? `0 ${unit}` : null), 'Senast kända utdelning per aktie och år.'],
    ['Vinstmarginal', pc(pm), 'Hur stor del av försäljningen som blir vinst efter alla kostnader.'],
    ['Rörelsemarginal', pc(om), 'Vinst från den vanliga verksamheten, före räntor och skatt, i procent av försäljningen.'],
    ['Avkastning på eget kapital', pc(roe), 'Vinsten i procent av det kapital ägarna har i bolaget.'],
    ['Försäljning 12 mån', rev ? money(rev, fcur) : null, 'Bolagets intäkter de senaste 12 månaderna.'],
    ['Försäljningstillväxt', pc(rg), 'Hur mycket försäljningen ändrats jämfört med samma kvartal året innan.'],
    ['Skuld / eget kapital', de == null ? null : n2(de / 100), 'Lånen jämfört med ägarnas kapital. Högre betyder mer lån.']
  ];
}
const fmt = (n) => n.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const TYP = { EQUITY: 'Aktie', ETF: 'ETF', MUTUALFUND: 'Fond', INDEX: 'Index' };
const SECTOR_SV = {
  // Yahoo
  'Technology': 'Teknik', 'Industrials': 'Industri', 'Financial Services': 'Finans', 'Healthcare': 'Hälsovård',
  'Consumer Cyclical': 'Sällanköpsvaror', 'Consumer Defensive': 'Dagligvaror', 'Communication Services': 'Kommunikation',
  'Basic Materials': 'Råvaror', 'Energy': 'Energi', 'Utilities': 'Kraftförsörjning', 'Real Estate': 'Fastigheter',
  // Finnhub
  'Semiconductors': 'Halvledare', 'Software': 'Mjukvara', 'Machinery': 'Maskiner', 'Banking': 'Bank',
  'Pharmaceuticals': 'Läkemedel', 'Biotechnology': 'Bioteknik', 'Health Care': 'Hälsovård',
  'Aerospace & Defense': 'Försvar och flyg', 'Automobiles': 'Fordon', 'Retail': 'Detaljhandel', 'Media': 'Media',
  'Telecommunication': 'Telekom', 'Communications': 'Kommunikation', 'Metals & Mining': 'Gruvor och metaller', 'Hotels, Restaurants & Leisure': 'Hotell, restaurang och nöje',
  'Insurance': 'Försäkring', 'Building': 'Bygg', 'Construction': 'Bygg', 'Chemicals': 'Kemi', 'Logistics & Transportation': 'Logistik och transport',
  'Beverages': 'Drycker', 'Food Products': 'Livsmedel', 'Consumer products': 'Konsumentprodukter', 'Electrical Equipment': 'Elutrustning',
  'Industrial Conglomerates': 'Industrikonglomerat', 'Airlines': 'Flyg', 'Textiles, Apparel & Luxury Goods': 'Kläder och lyx'
};
const COUNTRY_SV = { SE: 'Sverige', US: 'USA', NO: 'Norge', DK: 'Danmark', FI: 'Finland', DE: 'Tyskland', GB: 'Storbritannien', NL: 'Nederländerna', CH: 'Schweiz', FR: 'Frankrike', CN: 'Kina', JP: 'Japan', CA: 'Kanada', IE: 'Irland', TW: 'Taiwan' };
const COUNTRY_EN = { Sweden: 'Sverige', 'United States': 'USA', Norway: 'Norge', Denmark: 'Danmark', Finland: 'Finland', Germany: 'Tyskland', 'United Kingdom': 'Storbritannien', Netherlands: 'Nederländerna', Switzerland: 'Schweiz', France: 'Frankrike', China: 'Kina', Japan: 'Japan', Canada: 'Kanada', Ireland: 'Irland', Taiwan: 'Taiwan', Luxembourg: 'Luxemburg', Israel: 'Israel' };

export const config = { path: '/api/stock' };
