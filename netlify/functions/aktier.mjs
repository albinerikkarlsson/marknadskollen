import { cached, fail, ApiError } from '../lib/finnhub.mjs';
import { yScreen, yQuotes, raw } from '../lib/yahoo.mjs';

// GET /api/aktier?m=se|us  →  alla aktier på marknaden med bransch, kurs och nyckeltal, för listsidan.
// Hämtas med Yahoos aktiefilter, en gång per bransch så att varje aktie får rätt bransch.
const SECTORS = {
  'Technology': 'Teknik', 'Industrials': 'Industri', 'Financial Services': 'Finans', 'Healthcare': 'Hälsovård',
  'Consumer Cyclical': 'Sällanköpsvaror', 'Consumer Defensive': 'Dagligvaror', 'Communication Services': 'Kommunikation',
  'Basic Materials': 'Råvaror', 'Energy': 'Energi', 'Utilities': 'Kraftförsörjning', 'Real Estate': 'Fastigheter'
};
const MARKETS = {
  se: { region: 'se', pages: 2, currency: 'SEK' },
  us: { region: 'us', pages: 3, currency: 'USD', extra: [{ operator: 'gt', operands: ['intradaymarketcap', 2e9] }] }
};
const OTC = ['PNK', 'OQB', 'OQX', 'OEM', 'OGM', 'OBB', 'XXX'];

export default async (req) => {
  try {
    const m = new URL(req.url).searchParams.get('m') === 'us' ? 'us' : 'se';
    let data = await fromScreener(m).catch((e) => { console.warn('[aktier] filter:', e?.message); return null; });
    if (!data || data.aktier.length < 20) {
      if (m !== 'se') throw new ApiError(502, 'listan kunde inte hämtas');
      data = await fromList();
    }
    return cached({ marknad: m, ...data, hamtad: new Date().toISOString() }, 900);
  } catch (e) { return fail(e); }
};

async function fromScreener(m) {
  const cfg = MARKETS[m];
  const base = [{ operator: 'eq', operands: ['region', cfg.region] }, ...(cfg.extra || []), { operator: 'must_not', operands: OTC.map((x) => ({ operator: 'eq', operands: ['exchange', x] })) }];
  const jobs = Object.keys(SECTORS).map(async (sec) => {
    const out = [];
    for (let page = 0; page < cfg.pages; page++) {
      const r = await yScreen([...base, { operator: 'eq', operands: ['sector', sec] }], { offset: page * 250 });
      out.push(...r.quotes.map((q) => row(q, SECTORS[sec])));
      if ((page + 1) * 250 >= r.total) break;
    }
    return out;
  });
  const res = await Promise.allSettled(jobs);
  const ok = res.filter((x) => x.status === 'fulfilled');
  if (!ok.length) throw res[0].reason;
  const seen = new Set();
  const aktier = ok.flatMap((x) => x.value).filter((a) => a && a.kurs != null && !seen.has(a.sym) && seen.add(a.sym));
  return { kalla: 'Yahoo Finance', komplett: ok.length === res.length, aktier };
}

function row(q, bransch) {
  if (!q?.symbol) return null;
  const kurs = raw(q.regularMarketPrice);
  const eps = raw(q.epsTrailingTwelveMonths);
  const pe = raw(q.trailingPE) ?? (kurs && eps && eps > 0 ? kurs / eps : null);
  const dy = raw(q.trailingAnnualDividendYield);
  return {
    sym: q.symbol.toUpperCase(),
    namn: String(q.longName || q.shortName || q.symbol).replace(/\s+/g, ' ').trim(),
    bransch,
    lista: q.fullExchangeName || q.exchange || '',
    valuta: q.currency || null,
    kurs,
    d1: r2(raw(q.regularMarketChangePercent)),
    ar: r2(raw(q.fiftyTwoWeekChangePercent)),
    pe: pe != null && pe > 0 && pe < 1000 ? r2(pe) : eps != null && eps <= 0 ? -1 : null,
    utd: dy != null && dy > 0 && dy < 0.5 ? r2(dy * 100) : dy === 0 ? 0 : null,
    mcap: raw(q.marketCap),
    oms: raw(q.averageDailyVolume3Month) && kurs ? Math.round(raw(q.averageDailyVolume3Month) * kurs) : null
  };
}
const r2 = (n) => (n == null || !Number.isFinite(n) ? null : Math.round(n * 100) / 100);

// Reserv om Yahoos filter inte svarar: de största bolagen på Stockholmsbörsen med kurser från Yahoo
const LISTA = {
  'Industri': ['ABB.ST', 'ALFA.ST', 'ASSA-B.ST', 'ATCO-A.ST', 'ATCO-B.ST', 'EPI-A.ST', 'SAND.ST', 'SKF-B.ST', 'VOLV-B.ST', 'VOLV-A.ST', 'SAAB-B.ST', 'NIBE-B.ST', 'TREL-B.ST', 'SECU-B.ST', 'LIFCO-B.ST', 'INDT.ST', 'ADDT-B.ST', 'BEIJ-B.ST', 'SKA-B.ST', 'NCC-B.ST', 'PEAB-B.ST', 'SWEC-B.ST', 'AFRY.ST', 'HUSQ-B.ST', 'MTRS.ST', 'HEXA-B.ST'],
  'Finans': ['INVE-B.ST', 'INVE-A.ST', 'SEB-A.ST', 'SHB-A.ST', 'SWED-A.ST', 'NDA-SE.ST', 'EQT.ST', 'INDU-C.ST', 'KINV-B.ST', 'LATO-B.ST', 'AVANZ.ST', 'NYF.ST', 'INTRUM.ST'],
  'Teknik': ['ERIC-B.ST', 'SINCH.ST', 'MYCR.ST', 'LAGR-B.ST'],
  'Hälsovård': ['AZN.ST', 'GETI-B.ST', 'ELEKTA-B.ST', 'SOBI.ST', 'VITR.ST', 'BIOT.ST', 'CAMX.ST'],
  'Sällanköpsvaror': ['HM-B.ST', 'EVO.ST', 'ELUX-B.ST', 'THULE.ST', 'DOM.ST', 'CLAS-B.ST', 'BETS-B.ST', 'EMBRAC-B.ST'],
  'Dagligvaror': ['ESSITY-B.ST', 'AAK.ST', 'AXFO.ST'],
  'Kommunikation': ['TEL2-B.ST', 'TELIA.ST'],
  'Råvaror': ['BOL.ST', 'SSAB-A.ST', 'SSAB-B.ST', 'SCA-B.ST', 'HOLM-B.ST', 'BILL.ST', 'LUND-B.ST', 'HUFV-A.ST'],
  'Fastigheter': ['CAST.ST', 'BALD-B.ST', 'FABG.ST', 'WALL-B.ST', 'SBB-B.ST', 'WIHL.ST', 'SAGA-B.ST'],
  'Energi': ['LUMI.ST']
};
async function fromList() {
  const all = Object.entries(LISTA).flatMap(([b, syms]) => syms.map((s) => [s, b]));
  const chunks = []; for (let i = 0; i < all.length; i += 40) chunks.push(all.slice(i, i + 40));
  const res = await Promise.all(chunks.map((c) => yQuotes(c.map((x) => x[0])).catch(() => ({}))));
  const q = Object.assign({}, ...res);
  const aktier = all.filter(([s]) => q[s]?.kurs).map(([s, b]) => ({ sym: s, namn: q[s].namn || s, bransch: b, lista: 'Stockholm', valuta: q[s].valuta || 'SEK', kurs: q[s].kurs, d1: r2(q[s].d1), ar: null, pe: null, utd: null, mcap: null, oms: null }));
  if (!aktier.length) throw new ApiError(502, 'listan kunde inte hämtas');
  return { kalla: 'Yahoo Finance', komplett: false, urval: true, aktier };
}

export const config = { path: '/api/aktier' };
