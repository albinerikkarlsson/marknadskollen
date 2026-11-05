// Riskmodellen. Ren logik utan nätverk, så den går att testa lokalt.
// Bygger på Finnhubs nyckeltal (stock/metric). Varje del får 1 (Låg), 2 (Medel) eller 3 (Hög).
// Saknas data för en del hoppas den över.

const sv = (n, d = 1) => n.toLocaleString('sv-SE', { minimumFractionDigits: d, maximumFractionDigits: d });

export function money(n, cur = '') {
  if (n == null) return '–';
  const a = Math.abs(n);
  const unit = cur === 'SEK' ? 'kr' : cur;
  if (a >= 1e9) return `${sv(n / 1e9, 1)} mdr ${unit}`.trim();
  if (a >= 1e6) return `${sv(n / 1e6, 1)} mn ${unit}`.trim();
  return `${sv(n, 0)} ${unit}`.trim();
}

const val = (v) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);

// m = metric-objektet från Finnhub, price = senaste kurs, cur = valuta, mcapM = börsvärde i miljoner
export function buildFactors({ m = {}, price, cur, mcapM }) {
  const out = [];
  const beta = val(m.beta);
  const hi = val(m['52WeekHigh']); const lo = val(m['52WeekLow']);
  const spread = hi && lo ? (hi / lo - 1) * 100 : null;

  if (beta != null || spread != null) {
    let l = 2;
    if (beta != null) l = beta < 0.8 ? 1 : beta <= 1.3 ? 2 : 3;
    if (spread != null && spread > 100) l = 3; else if (spread != null && spread > 60) l = Math.max(l, 2);
    const parts = [];
    if (beta != null) parts.push(`Beta ${sv(beta, 2)}`);
    if (spread != null) parts.push(`${sv(lo, 2)}–${sv(hi, 2)} på ett år`);
    out.push(['Kurssvängningar', l, parts.join(' · '),
      l === 1 ? 'Kursen rör sig lugnare än börsen i stort.' : l === 2 ? 'Kursen rör sig ungefär som börsen, med perioder av större rörelser.' : 'Kursen rör sig kraftigt. Värdet kan ändras mycket på kort tid.']);
  }

  const de = val(m['totalDebt/totalEquityQuarterly']) ?? val(m['totalDebt/totalEquityAnnual']);
  if (de != null) {
    const l = de < 0 ? 3 : de < 0.5 ? 1 : de < 1.5 ? 2 : 3;
    out.push(['Skulder', l, de < 0 ? 'Negativt eget kapital' : `Skuld/eget kapital ${sv(de, 2)}`,
      l === 1 ? 'Skulderna är små jämfört med vad ägarna har satt in.' : l === 2 ? 'Bolaget har en del lån. Det är vanligt, men värt att följa om räntorna stiger.' : de < 0 ? 'Bolaget är skyldigt mer än det äger.' : 'Mycket lån jämfört med eget kapital. Stiger räntorna eller faller vinsten blir det tungt.']);
  }

  const pe = val(m.peTTM) ?? val(m.peBasicExclExtraTTM) ?? val(m.peExclExtraTTM);
  const eps = val(m.epsTTM) ?? val(m.epsBasicExclExtraItemsTTM);
  if (pe != null || eps != null) {
    if ((eps != null && eps <= 0) || (pe != null && pe <= 0)) out.push(['Värdering', 3, 'Ingen vinst just nu', 'Priset bygger på förhoppningar om framtida vinster.']);
    else if (pe != null) {
      const l = pe < 20 ? 1 : pe < 35 ? 2 : 3;
      out.push(['Värdering', l, `P/E ${sv(pe, 1)}`, l === 1 ? 'Priset är inte högt jämfört med vinsten.' : l === 2 ? 'Investerarna betalar en del för framtida tillväxt.' : 'Aktien är dyr jämfört med vinsten. Besvikelser kan ge stora fall.']);
    }
  }

  const pm = val(m.netProfitMarginTTM) ?? val(m.netProfitMarginAnnual);
  if (pm != null) {
    const l = pm < 0 ? 3 : pm < 8 ? 2 : 1;
    out.push(['Lönsamhet', l, `Vinstmarginal ${sv(pm, 1)} %`, l === 1 ? 'Bolaget behåller en bra del av intäkterna som vinst.' : l === 2 ? 'Bolaget går med vinst, men marginalen är liten.' : 'Bolaget går med förlust.']);
  }

  const volM = val(m['10DayAverageTradingVolume']) ?? val(m['3MonthAverageTradingVolume']);
  if (volM != null && price) {
    const t = volM * 1e6 * price; const l = t >= 50e6 ? 1 : t >= 5e6 ? 2 : 3;
    out.push(['Handel', l, `Omsätter ca ${money(t, cur)} per dag`, l === 1 ? 'Lätt att köpa och sälja.' : l === 2 ? 'Går att handla, men stora affärer kan påverka priset.' : 'Liten handel. Det kan vara svårt att sälja när man vill.']);
  }

  const mc = (val(mcapM) ?? val(m.marketCapitalization));
  if (mc != null && mc > 0) {
    const v = mc * 1e6; const l = v >= 10e9 ? 1 : v >= 1e9 ? 2 : 3;
    out.push(['Storlek', l, `Börsvärde ${money(v, cur)}`, l === 1 ? 'Stort bolag med många ägare och mycket granskning.' : l === 2 ? 'Medelstort bolag.' : 'Litet bolag. Små bolag svänger mer och granskas mindre.']);
  }
  return out;
}

export function perfFromMetric(m = {}, d1 = null) {
  const rows = [
    ['1 dag', d1], ['5 dagar', val(m['5DayPriceReturnDaily'])], ['Månaden', val(m.monthToDatePriceReturnDaily)],
    ['3 mån', val(m['13WeekPriceReturnDaily'])], ['6 mån', val(m['26WeekPriceReturnDaily'])],
    ['I år', val(m.yearToDatePriceReturnDaily)], ['1 år', val(m['52WeekPriceReturnDaily'])]
  ];
  return rows.filter((r) => r[1] != null).map(([l, v]) => [l, Math.round(v * 100) / 100]);
}

export function riskScore(faktorer) {
  if (!faktorer.length) return null;
  const ls = faktorer.map((x) => x[1]);
  const mean = ls.reduce((a, c) => a + c, 0) / ls.length;
  let p = Math.round(((mean - 1) / 2) * 9 + 1);
  if (ls.includes(3)) p = Math.max(p, 4);
  return p;
}

export function summarize(namn, faktorer) {
  const hi = faktorer.filter((x) => x[1] === 3).map((x) => x[0].toLowerCase());
  const lo = faktorer.filter((x) => x[1] === 1).map((x) => x[0].toLowerCase());
  const parts = [];
  if (lo.length) parts.push(`Låg risk när det gäller ${list(lo)}.`);
  if (hi.length) parts.push(`Högst risk när det gäller ${list(hi)}.`);
  if (!hi.length && !lo.length) parts.push('Medelrisk i de flesta delar.');
  return `${namn}: ${parts.join(' ')}`;
}

export function thinkAbout(faktorer, { price, hi, lo } = {}) {
  const t = [];
  const get = (n) => faktorer.find((x) => x[0] === n);
  if (get('Kurssvängningar')?.[1] === 3) t.push('Investera bara pengar du klarar dig utan om kursen faller kraftigt.');
  if (get('Värdering')?.[1] === 3) t.push('Hög värdering gör aktien känslig för besvikelser i rapporter.');
  if (get('Skulder')?.[1] >= 2) t.push('Följ hur skulderna utvecklas i rapporterna, särskilt om räntorna stiger.');
  if (get('Handel')?.[1] === 3) t.push('Liten handel: lägg hellre en limitorder än att köpa till marknadspris.');
  if (get('Storlek')?.[1] === 3) t.push('Var extra försiktig med tips om små bolag i chattar och sociala medier.');
  if (price && hi && lo && hi > lo) {
    const pos = Math.min(1, Math.max(0, (price - lo) / (hi - lo)));
    t.push(`Kursen ligger på ${Math.round(pos * 100)} % av spannet mellan årets lägsta och högsta.`);
  }
  if (t.length < 3) t.push('Sprid dina pengar på flera bolag så att ett fall inte slår ut allt.');
  return t.slice(0, 4);
}

function list(a) { return a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' och ' + a[a.length - 1]; }
