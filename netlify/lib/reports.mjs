// Rapportsiffror från Yahoo Finance (fundamentals-timeseries). Ger helår, kvartal och senaste 12 månaderna.
// Ren funktion så att den går att testa mot riktiga svar. Värden som saknas blir null, inget fylls i.
export const FIELDS = {
  oms: 'TotalRevenue', brutto: 'GrossProfit', rorelse: 'OperatingIncome', fore: 'PretaxIncome', netto: 'NetIncome',
  eps: 'DilutedEPS', ebitda: 'EBITDA', ranta: 'InterestExpense',
  tillg: 'TotalAssets', ek: 'StockholdersEquity', skuld: 'TotalDebt', kassa: 'CashAndCashEquivalents',
  omsTillg: 'CurrentAssets', kortSkuld: 'CurrentLiabilities',
  kassaflode: 'OperatingCashFlow', capex: 'CapitalExpenditure', fcf: 'FreeCashFlow', utd: 'CashDividendsPaid', aktier: 'DilutedAverageShares'
};
// Poster som är saldon (balansräkning). Övriga är flöden och kan summeras över fyra kvartal.
export const BALANCE = new Set(['tillg', 'ek', 'skuld', 'kassa', 'omsTillg', 'kortSkuld']);

export function typesParam() {
  const t = Object.values(FIELDS);
  return [...t.map((x) => 'annual' + x), ...t.map((x) => 'quarterly' + x), ...t.map((x) => 'trailing' + x)].join(',');
}

export function buildReports(json) {
  const res = json?.timeseries?.result || [];
  const by = { annual: {}, quarterly: {}, trailing: {} };
  let valuta = null;
  const key = Object.fromEntries(Object.entries(FIELDS).map(([k, v]) => [v, k]));
  for (const r of res) {
    const type = r?.meta?.type?.[0]; if (!type) continue;
    const m = type.match(/^(annual|quarterly|trailing)(.+)$/); if (!m || !key[m[2]]) continue;
    for (const x of r[type] || []) {
      if (!x || !x.asOfDate) continue;
      const v = x.reportedValue?.raw;
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      if (x.currencyCode && !valuta && m[2] !== 'DilutedAverageShares') valuta = x.currencyCode;
      (by[m[1]][x.asOfDate] ||= {})[key[m[2]]] = v;
    }
  }
  const rows = (o) => Object.keys(o).sort().map((d) => ({ datum: d, ...Object.fromEntries(Object.keys(FIELDS).map((k) => [k, o[d][k] ?? null])) }));
  // Perioder utan försäljning är ofullständiga i källan och visas inte
  const ar = rows(by.annual).filter((r) => r.oms != null).slice(-5);
  const kvartal = rows(by.quarterly).filter((r) => r.oms != null).slice(-8);
  // Senaste 12 månaderna: Yahoos egen siffra i första hand, annars summan av fyra kvartal i följd
  const tDates = Object.keys(by.trailing).sort();
  const tLast = tDates.length ? by.trailing[tDates[tDates.length - 1]] : {};
  const last4 = kvartal.slice(-4);
  const consecutive = last4.length === 4 && last4.every((q, i) => i === 0 || monthsBetween(last4[i - 1].datum, q.datum) === 3);
  const ttm = { datum: kvartal.length ? kvartal[kvartal.length - 1].datum : (tDates[tDates.length - 1] || null) };
  for (const k of Object.keys(FIELDS)) {
    if (BALANCE.has(k)) { ttm[k] = kvartal.length ? kvartal[kvartal.length - 1][k] : null; continue; }
    if (k === 'aktier') { ttm[k] = kvartal.length ? kvartal[kvartal.length - 1][k] : null; continue; }
    const sum = consecutive && last4.every((q) => q[k] != null) ? last4.reduce((a, q) => a + q[k], 0) : null;
    // Yahoos tolvmånaderssiffra gäller bara om den hör till samma kvartal som vårt senaste
    const y = tLast[k] != null && tDates[tDates.length - 1] === ttm.datum ? tLast[k] : null;
    ttm[k] = y ?? sum;
  }
  const harTtm = Object.keys(FIELDS).some((k) => !BALANCE.has(k) && k !== 'aktier' && ttm[k] != null);
  return { valuta, ar, kvartal, ttm: harTtm ? ttm : null };
}

function monthsBetween(a, b) {
  const [y1, m1] = a.split('-').map(Number); const [y2, m2] = b.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}
