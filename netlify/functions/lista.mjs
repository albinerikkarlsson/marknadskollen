import { cached, fail, ApiError } from '../lib/finnhub.mjs';
import { yScreen, yQuotes, raw, dayChange } from '../lib/yahoo.mjs';
import { kindOf, STABLE, fundKind, fundRegion, fundBase, isUtd } from '../lib/klass.mjs';

// GET /api/lista?typ=fonder              →  alla svenska fonder
// GET /api/lista?typ=etf&m=se|us         →  ETF:er på Stockholmsbörsen, eller de största i USA
// GET /api/lista?typ=etp                 →  ETP:er och hävstångsprodukter på Stockholmsbörsen
// GET /api/lista?typ=krypto              →  de 100 största kryptovalutorna, kurs i dollar och kronor
// Källa: Yahoo Finance. "1 år" räknas inte här utan av /api/ar, med samma regel som bolagssidan.
const r2 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100);
const OTC = ['PNK', 'OQB', 'OQX', 'OEM', 'OGM', 'OBB', 'XXX'];
const notOtc = { operator: 'must_not', operands: OTC.map((x) => ({ operator: 'eq', operands: ['exchange', x] })) };
const region = (r) => ({ operator: 'eq', operands: ['region', r] });

// Första sidan säger hur många det finns, resten hämtas samtidigt
async function all(operands, opts, max) {
  const first = await yScreen(operands, { ...opts, offset: 0 });
  const total = Math.min(first.total || 0, max);
  const offs = []; for (let o = 250; o < total; o += 250) offs.push(o);
  const rest = await Promise.allSettled(offs.map((offset) => yScreen(operands, { ...opts, offset })));
  const failed = rest.filter((x) => x.status === 'rejected').length;
  return { quotes: [...first.quotes, ...rest.flatMap((x) => (x.status === 'fulfilled' ? x.value.quotes : []))], komplett: !failed, total: first.total };
}

const base = (q) => {
  const kurs = raw(q.regularMarketPrice);
  const prev = raw(q.regularMarketPreviousClose);
  const t = raw(q.regularMarketTime);
  return {
    sym: String(q.symbol).toUpperCase(),
    namn: String(q.longName || q.shortName || q.symbol).replace(/\s+/g, ' ').trim(),
    valuta: q.currency || null,
    kurs,
    // Dagens förändring mot föregående stängning, som på bolagssidan
    d1: dayChange(kurs, prev, raw(q.regularMarketChangePercent)),
    tid: t ? new Date(t * 1000).toISOString() : null,
    lista: q.fullExchangeName || q.exchange || ''
  };
};

// Avgifter och jämförelseindex för fonder registrerade i Sverige. Fondbolagen rapporterar dem till Finansinspektionen
// varje kvartal, och Fondinsyn publicerar dem som öppna data (CC BY 4.0). Utländska fonder som säljs i Sverige finns inte med.
async function fiFonder() {
  const idx = await fetch('https://www.fondinsyn.se/data/index.json', { signal: AbortSignal.timeout(5000) }).then((r) => (r.ok ? r.json() : null));
  const q = idx?.quarters?.[0]; if (!q?.id || !/^\d{4}Q[1-4]$/.test(q.id)) return null;
  const d = await fetch(`https://www.fondinsyn.se/data/${q.id}.json`, { signal: AbortSignal.timeout(7000) }).then((r) => (r.ok ? r.json() : null));
  const map = new Map();
  for (const f of d?.fundInfo || []) {
    if (!Array.isArray(f) || !f[1]) continue;
    const lo = Number(f[5]); const hi = Number(f[6]);
    const k = fundBase(f[1]); if (map.has(k)) continue;
    map.set(k, { index: typeof f[3] === 'string' ? f[3] : '', avgift: Number.isFinite(lo) && Number.isFinite(hi) && f[5] != null && f[6] != null ? [lo, hi] : null });
  }
  return { map, kvartal: q.id, slut: q.curr || null };
}

async function fonder() {
  const [r, fi] = await Promise.all([
    all([region('se')], { quoteType: 'MUTUALFUND', sortField: 'fundnetassets' }, 4000),
    fiFonder().catch((e) => { console.log('[lista] fondinsyn', String(e)); return null; })
  ]);
  // En rad per fond: andelsklasserna slås ihop. Klassen utan utdelning visas, annars den första.
  const grupper = new Map();
  for (const q of r.quotes) {
    const a = { ...base(q), storlek: raw(q.netAssets) }; if (!a.kurs) continue;
    const k = fundBase(a.namn); const g = grupper.get(k);
    if (!g) grupper.set(k, { a, n: 1 });
    else { g.n++; if (isUtd(g.a.namn) && !isUtd(a.namn)) g.a = a; }
  }
  const items = [...grupper.entries()].map(([k, { a, n }]) => {
    const f = fi?.map.get(k) || null;
    const { typ, index } = fundKind(a.namn, f?.index);
    return { ...a, klasser: n, avgift: f?.avgift || null, ftyp: typ, index, region: fundRegion(a.namn, f?.index) };
  });
  return { typ: 'fonder', items, komplett: r.komplett, avgiftKalla: fi ? { kvartal: fi.kvartal, slut: fi.slut, antal: items.filter((a) => a.avgift).length } : null };
}

async function etf(m) {
  const r = await all([region(m), ...(m === 'us' ? [notOtc] : [])], { quoteType: 'ETF', sortField: 'fundnetassets' }, m === 'us' ? 1000 : 1000);
  const seen = new Set();
  const items = r.quotes.map((q) => ({ ...base(q), storlek: raw(q.netAssets) })).filter((a) => a.kurs && !seen.has(a.sym) && seen.add(a.sym)).map((a) => ({ ...a, region: fundRegion(a.namn), ftyp: fundKind(a.namn).typ }));
  return { typ: 'etf', m, items, komplett: r.komplett };
}

// Det som Yahoo kallar aktier utan bransch på Stockholmsbörsen: ETP:er, certifikat och warranter
async function etp() {
  const r = await all([region('se'), notOtc], { quoteType: 'EQUITY' }, 1500);
  const seen = new Set(); const items = [];
  for (const q of r.quotes) {
    if (!q?.symbol) continue;
    const a = base(q); if (!a.kurs || seen.has(a.sym)) continue; seen.add(a.sym);
    const k = kindOf(a.sym, a.namn);
    if (k === 'etp' || k === 'havstang') items.push({ ...a, slag: k });
  }
  return { typ: 'etp', items, komplett: r.komplett };
}

async function krypto() {
  const r = await yScreen([{ operator: 'eq', operands: ['currency', 'USD'] }], { quoteType: 'CRYPTOCURRENCY', size: 100 });
  const fx = (await yQuotes(['USDSEK=X']).catch(() => ({})))['USDSEK=X']?.kurs || null;
  const items = r.quotes.filter((q) => q?.symbol && /-USD$/i.test(q.symbol)).map((q) => {
    const a = base(q); const kod = a.sym.replace(/-USD$/i, '');
    return {
      ...a,
      namn: a.namn.replace(/\s+USD$/i, ''),
      kod,
      stable: STABLE.has(kod.toUpperCase()),
      kursSek: fx && a.kurs ? a.kurs * fx : null,
      mcap: raw(q.marketCap),
      mcapSek: fx && raw(q.marketCap) ? Math.round(raw(q.marketCap) * fx) : null,
      lista: 'Krypto'
    };
  }).filter((a) => a.kurs);
  return { typ: 'krypto', items, usdsek: fx, komplett: true };
}

export default async (req) => {
  try {
    const p = new URL(req.url).searchParams; const typ = p.get('typ');
    let d;
    if (typ === 'fonder') d = await fonder();
    else if (typ === 'etf') d = await etf(p.get('m') === 'us' ? 'us' : 'se');
    else if (typ === 'etp') d = await etp();
    else if (typ === 'krypto') d = await krypto();
    else throw new ApiError(400, 'okänd typ');
    if (!d.items.length) throw new ApiError(502, 'listan kunde inte hämtas');
    console.log(`[lista] ${typ}${d.m ? '/' + d.m : ''}: ${d.items.length}`, JSON.stringify(d.items.slice(0, 2).map((a) => [a.sym, a.kurs, a.d1])));
    return cached({ ...d, kalla: 'Yahoo Finance', hamtad: new Date().toISOString() }, typ === 'krypto' ? 300 : 900);
  } catch (e) { return fail(e); }
};

export const config = { path: '/api/lista' };
