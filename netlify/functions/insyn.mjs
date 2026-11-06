import { cached, fail, ApiError } from '../lib/finnhub.mjs';
import { fiFetch, decodeFiText, parseInsyn, normName, sameName, nameMatch } from '../lib/fi.mjs';

// GET /api/insyn            →  största och senaste insynsaffärerna den senaste veckan
// GET /api/insyn?namn=AB Volvo  →  insynsaffärer i ett bolag det senaste året
// Källa: Finansinspektionens insynsregister (öppna data).
const BASE = 'https://marknadssok.fi.se/Publiceringsklient/sv-SE';
const day = (ms) => new Date(ms).toISOString().slice(0, 10);

export default async (req) => {
  try {
    const namn = (new URL(req.url).searchParams.get('namn') || '').trim().slice(0, 80);
    if (namn) return cached(await forCompany(namn), 6 * 3600);
    return cached(await overview(), 3600);
  } catch (e) { return fail(e); }
};

async function exportRows(utgivare, days) {
  const p = new URLSearchParams({
    SearchFunctionType: 'Insyn', Utgivare: utgivare, 'PersonILedandeStällningNamn': '',
    'Transaktionsdatum.From': '', 'Transaktionsdatum.To': '',
    'Publiceringsdatum.From': day(Date.now() - days * 864e5), 'Publiceringsdatum.To': day(Date.now() + 864e5),
    button: 'export'
  });
  const buf = await fiFetch(`${BASE}/Search/Search?${p}`, 9500);
  return parseInsyn(decodeFiText(buf));
}

const trade = (a) => ({ datum: a.datum, bolag: a.bolag, person: a.person, roll: a.roll, narstaende: a.narstaende, typ: a.typ, instrument: a.instrument, volym: a.volym, pris: a.pris, valuta: a.valuta, varde: a.varde, program: a.program });
const isTrade = (a) => a.typ === 'Köp' || a.typ === 'Sälj';

async function overview() {
  const rows = (await exportRows('', 7)).filter(isTrade);
  const sek = rows.filter((a) => a.valuta === 'SEK' && a.varde);
  return {
    kalla: 'Finansinspektionen',
    period: '7 dagar',
    antal: rows.length,
    storsta: sek.slice().sort((a, z) => z.varde - a.varde).slice(0, 10).map(trade),
    senaste: rows.slice().sort((a, z) => String(z.datum).localeCompare(String(a.datum))).slice(0, 15).map(trade),
    hamtad: new Date().toISOString()
  };
}

async function forCompany(namn) {
  // Hitta bolagets exakta namn i registret via FI:s egen sökhjälp
  const want = normName(namn);
  if (!want) throw new ApiError(400, 'namn saknas');
  const term = want.split(' ').sort((a, z) => z.length - a.length)[0];
  const buf = await fiFetch(`${BASE}/AutoComplete/H%C3%A4mtaAutoCompleteListaFull?sokfunktion=Insyn&falt=Utgivare&sokterm=${encodeURIComponent(term)}`, 6000);
  const names = parseList(buf.toString('utf8'));
  const exact = names.find((n) => sameName(n, namn)) || names.find((n) => nameMatch(n, namn));
  if (!exact) return { saknas: true, kalla: 'Finansinspektionen', hamtad: new Date().toISOString() };

  const rows = (await exportRows(exact, 365)).filter((a) => sameName(a.bolag, exact) || nameMatch(a.bolag, exact));
  const trades = rows.filter(isTrade);
  const curs = {}; for (const a of trades) if (a.valuta) curs[a.valuta] = (curs[a.valuta] || 0) + 1;
  const valuta = Object.entries(curs).sort((a, z) => z[1] - a[1])[0]?.[0] || 'SEK';
  const sum = (typ) => { const x = trades.filter((a) => a.typ === typ); return { antal: x.length, varde: x.filter((a) => a.valuta === valuta).reduce((s, a) => s + (a.varde || 0), 0) }; };
  return {
    kalla: 'Finansinspektionen',
    bolag: exact,
    period: '12 månader',
    valuta,
    kop: sum('Köp'),
    salj: sum('Sälj'),
    ovrigt: rows.length - trades.length,
    affarer: rows.slice().sort((a, z) => String(z.datum).localeCompare(String(a.datum))).slice(0, 25).map(trade),
    lank: `${BASE}/Search/Search?SearchFunctionType=Insyn&Utgivare=${encodeURIComponent(exact)}&button=search`,
    hamtad: new Date().toISOString()
  };
}

// Sökhjälpen svarar med en lista med namn, oftast som JSON
function parseList(text) {
  try {
    const j = JSON.parse(text);
    const arr = Array.isArray(j) ? j : Object.values(j || {}).find(Array.isArray) || [];
    return arr.map((x) => (typeof x === 'string' ? x : x?.label || x?.value || x?.Namn || x?.namn || '')).map((s) => String(s).trim()).filter(Boolean);
  } catch {
    return [...text.matchAll(/"([^"]+)"/g)].map((m) => m[1].replace(/\\u0026/g, '&').trim()).filter(Boolean);
  }
}

export const config = { path: '/api/insyn' };
