import { cached, fail } from '../lib/finnhub.mjs';
import { loadBlankning, findBlank } from '../lib/fi.mjs';

// GET /api/blankning            →  de mest blankade bolagen just nu
// GET /api/blankning?namn=Volvo →  blankningen i ett bolag
// Källa: Finansinspektionens blankningsregister. Bara positioner från 0,5 % av aktierna publiceras.
export default async (req) => {
  try {
    const namn = (new URL(req.url).searchParams.get('namn') || '').trim().slice(0, 80);
    const bolag = await loadBlankning();
    const base = { kalla: 'Finansinspektionen', lank: 'https://www.fi.se/sv/vara-register/blankningsregistret/', hamtad: new Date().toISOString() };
    if (namn) return cached({ ...base, bolag: findBlank(bolag, namn) }, 3600);
    return cached({ ...base, antalBolag: bolag.length, topp: bolag.slice(0, 10).map((b) => ({ ...b, positioner: b.positioner.slice(0, 5) })) }, 3600);
  } catch (e) { return fail(e); }
};

export const config = { path: '/api/blankning' };
