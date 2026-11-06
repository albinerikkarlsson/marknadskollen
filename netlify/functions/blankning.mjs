import { cached, fail } from '../lib/finnhub.mjs';
import { fiFetch, sheetRows, parseBlankning, sameName, nameMatch } from '../lib/fi.mjs';

// GET /api/blankning            →  de mest blankade bolagen just nu
// GET /api/blankning?namn=Volvo →  blankningen i ett bolag
// Källa: Finansinspektionens blankningsregister. Bara positioner från 0,5 % av aktierna publiceras.
const URL_NU = 'https://www.fi.se/sv/vara-register/blankningsregistret/GetAktuellFile/';
let memo = null; // { t, bolag }

async function load() {
  if (memo && Date.now() - memo.t < 15 * 60e3) return memo.bolag;
  const buf = await fiFetch(`${URL_NU}?_=${Date.now()}`, 9500);
  const bolag = parseBlankning(sheetRows(buf));
  memo = { t: Date.now(), bolag };
  return bolag;
}

export default async (req) => {
  try {
    const namn = (new URL(req.url).searchParams.get('namn') || '').trim().slice(0, 80);
    const bolag = await load();
    const base = { kalla: 'Finansinspektionen', lank: 'https://www.fi.se/sv/vara-register/blankningsregistret/', hamtad: new Date().toISOString() };
    if (namn) {
      const hit = bolag.find((b) => sameName(b.emittent, namn)) || bolag.find((b) => nameMatch(b.emittent, namn));
      return cached({ ...base, bolag: hit || null }, 3600);
    }
    return cached({ ...base, antalBolag: bolag.length, topp: bolag.slice(0, 10).map((b) => ({ ...b, positioner: b.positioner.slice(0, 5) })) }, 3600);
  } catch (e) { return fail(e); }
};

export const config = { path: '/api/blankning' };
