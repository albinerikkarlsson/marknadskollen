import { cached, fail, ApiError } from '../lib/finnhub.mjs';
import { yScreen, yQuotes, raw } from '../lib/yahoo.mjs';

// GET /api/aktier?m=se|nord|us  →  alla aktier på marknaden med bransch, kurs och nyckeltal, för listsidan.
// nord = Oslo, Helsingfors och Köpenhamn. Där räknas börsvärde och omsättning även om till kronor, så att listan går att jämföra.
// Hämtas med Yahoos aktiefilter, en gång per bransch så att varje aktie får rätt bransch.
const SECTORS = {
  'Technology': 'Teknik', 'Industrials': 'Industri', 'Financial Services': 'Finans', 'Healthcare': 'Hälsovård',
  'Consumer Cyclical': 'Sällanköpsvaror', 'Consumer Defensive': 'Dagligvaror', 'Communication Services': 'Kommunikation',
  'Basic Materials': 'Råvaror', 'Energy': 'Energi', 'Utilities': 'Kraftförsörjning', 'Real Estate': 'Fastigheter'
};
const MARKETS = {
  se: { regions: ['se'], pages: 2, rest: 5 },
  nord: { regions: ['no', 'fi', 'dk'], pages: 2, rest: 4, sek: true },
  us: { regions: ['us'], pages: 3, extra: [{ operator: 'gt', operands: ['intradaymarketcap', 2e9] }] }
};
// Certifikat, warranter, teckningsrätter, BTA och börshandlade produkter är inga aktier. Yahoo ger dem ingen bransch, så de rensas bara bland Övrigt.
const JUNK_SYM = /^(BULL|BEAR|MINI|TURBO|LONG|SHORT)[-\s]|-AVA-\d|\d[LCPS]-?\d{2,}|-(BTU|BTA|BTB|TO\d*|TR|UR|IR)(\.|$)/i;
const JUNK_NAME = /\b(ETP|ETF|ETN|ETC|UCITS|Tracker|Index|Xtrackers|iShares|21Shares|CoinShares|Virtune|Valour|WisdomTree|Bitcoin|Ethereum|Certifikat|Bull|Bear)\b/i;
const isJunk = (a) => JUNK_SYM.test(a.sym) || JUNK_NAME.test(a.namn) || a.namn.toUpperCase() === a.sym;
const OTC = ['PNK', 'OQB', 'OQX', 'OEM', 'OGM', 'OBB', 'XXX'];

export default async (req) => {
  try {
    const mq = new URL(req.url).searchParams.get('m');
    const m = MARKETS[mq] ? mq : 'se';
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
  const reg = cfg.regions.map((r) => ({ operator: 'eq', operands: ['region', r] }));
  const base = [reg.length === 1 ? reg[0] : { operator: 'or', operands: reg }, ...(cfg.extra || []), { operator: 'must_not', operands: OTC.map((x) => ({ operator: 'eq', operands: ['exchange', x] })) }];
  const jobs = Object.keys(SECTORS).map(async (sec) => {
    const out = [];
    for (let page = 0; page < cfg.pages; page++) {
      const r = await yScreen([...base, { operator: 'eq', operands: ['sector', sec] }], { offset: page * 250 });
      out.push(...r.quotes.map((q) => row(q, SECTORS[sec])));
      if ((page + 1) * 250 >= r.total) break;
    }
    return out;
  });
  // Aktier som Yahoo inte har gett någon bransch kommer annars inte med. I Norden hämtar vi alla och lägger resten under Övrigt.
  if (cfg.rest) jobs.push((async () => {
    const out = [];
    for (let page = 0; page < cfg.rest; page++) {
      const r = await yScreen(base, { offset: page * 250 });
      out.push(...r.quotes.map((q) => row(q, 'Övrigt')).filter((a) => a && !isJunk(a)));
      if ((page + 1) * 250 >= r.total) break;
    }
    return out;
  })());
  const res = await Promise.allSettled(jobs);
  const ok = res.filter((x) => x.status === 'fulfilled');
  if (!ok.length) throw res[0].reason;
  const seen = new Set();
  // Branschlistorna kommer först, så att Övrigt bara får de som saknar bransch
  const aktier = ok.flatMap((x) => x.value).filter((a) => a && a.kurs != null && !seen.has(a.sym) && seen.add(a.sym));
  if (cfg.sek) await toSek(aktier);
  const per = {}; for (const a of aktier) per[a.bransch] = (per[a.bransch] || 0) + 1;
  console.log(`[aktier] ${m}: ${aktier.length} aktier`, JSON.stringify(per), 'exempel', JSON.stringify(aktier.filter((a) => ['VOLV-B.ST', 'ERIC-B.ST', 'HEXA-B.ST', 'ABB.ST', 'AZN.ST', 'AAPL', 'MSFT'].includes(a.sym)).map((a) => [a.sym, a.kurs, a.d1, a.ar, a.pe, a.utd, a.mcap])));
  return { kalla: 'Yahoo Finance', komplett: ok.length === res.length, aktier };
}

// Börsvärde och omsättning i kronor för Norden, med dagens växelkurser
async function toSek(aktier) {
  const curs = [...new Set(aktier.map((a) => (a.valuta || '').toUpperCase()).filter((c) => c && c !== 'SEK'))];
  const q = curs.length ? await yQuotes(curs.map((c) => `${c}SEK=X`)).catch(() => ({})) : {};
  const rate = { SEK: 1 }; curs.forEach((c) => { const k = q[`${c}SEK=X`]?.kurs; if (k > 0) rate[c] = k; });
  for (const a of aktier) {
    const r = rate[(a.valuta || '').toUpperCase()];
    a.mcapSek = r && a.mcap != null ? Math.round(a.mcap * r) : null;
    a.omsSek = r && a.oms != null ? Math.round(a.oms * r) : null;
  }
}

function row(q, bransch) {
  if (!q?.symbol) return null;
  const kurs = raw(q.regularMarketPrice);
  const eps = raw(q.epsTrailingTwelveMonths);
  // Bolag som redovisar i en annan valuta än aktien handlas i (t.ex. Hexagon i euro, ABB i dollar):
  // då räknar vi inte själva, eftersom vinst och utdelning kan stå i fel valuta. Yahoos egna nyckeltal används.
  const sameCur = !q.financialCurrency || !q.currency || q.financialCurrency.toUpperCase() === q.currency.toUpperCase();
  const pe = raw(q.trailingPE) ?? (sameCur && kurs && eps && eps > 0 ? kurs / eps : null);
  // dividendYield är redan i procent och räknad i rätt valuta
  const dyPct = raw(q.dividendYield);
  const dy = dyPct != null ? dyPct / 100 : sameCur ? raw(q.trailingAnnualDividendYield) : null;
  return {
    sym: q.symbol.toUpperCase(),
    namn: String(q.longName || q.shortName || q.symbol).replace(/\s+/g, ' ').trim(),
    bransch,
    lista: q.fullExchangeName || q.exchange || '',
    valuta: q.currency || null,
    kurs,
    d1: r2(raw(q.regularMarketChangePercent)),
    ar: r2(raw(q.fiftyTwoWeekChangePercent)),
    pe: pe != null && pe > 0 && pe < 1000 ? r2(pe) : eps != null && eps < 0 ? -1 : null,
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
