import { cached, fail, ApiError } from '../lib/finnhub.mjs';
import { ySpark, yearAgoClose, fiveYearAgoClose, yearVol, sparkOf } from '../lib/yahoo.mjs';

// GET /api/ar?lista=se&del=0  →  för 250 värdepapper i taget ur en lista:
//   ref   kursen för ett år sedan     (sidan räknar "1 år" som senaste kurs delat med den, som på bolagssidan)
//   ref3  kursen för tre år sedan     ("3 år", fonder: Yahoo har ofta bara kurser sedan 2022)
//   ref5  kursen för fem år sedan     ("5 år", samma regel som diagrammets 5 år)
//   vol   svängning det senaste året, årlig standardavvikelse i procent
//   sp    en liten kurva över det senaste året
// Allt räknas från samma dagliga stängningskurser för fem år, så siffrorna hänger ihop.
// lista: se, nord, us (aktier), fonder, etf-se, etf-us, etp, krypto
const SRC = { se: 'aktier?m=se', nord: 'aktier?m=nord', us: 'aktier?m=us', fonder: 'lista?typ=fonder', 'etf-se': 'lista?typ=etf&m=se', 'etf-us': 'lista?typ=etf&m=us', etp: 'lista?typ=etp', krypto: 'lista?typ=krypto' };
export const AR_DEL = 250;

export default async (req) => {
  try {
    const u = new URL(req.url); const lista = u.searchParams.get('lista'); const del = Math.max(0, Math.floor(Number(u.searchParams.get('del')) || 0));
    if (!SRC[lista]) throw new ApiError(400, 'okänd lista');
    const res = await fetch(`${u.origin}/api/${SRC[lista]}`, { signal: AbortSignal.timeout(9000) });
    if (!res.ok) throw new ApiError(502, 'listan kunde inte hämtas');
    const d = await res.json();
    const syms = (d.aktier || d.items || []).map((a) => a.sym).slice(del * AR_DEL, (del + 1) * AR_DEL);
    const chunks = []; for (let i = 0; i < syms.length; i += 20) chunks.push(syms.slice(i, i + 20));
    // Kryptovalutor handlas alla dagar, annat bara vardagar
    const perYear = lista === 'krypto' ? 365 : 252;
    const ref = {}; const ref3 = {}; const ref5 = {}; const vol = {}; const sp = {}; let fel = 0;
    // Åtta anrop åt gången, så att Yahoo inte stryper oss
    for (let i = 0; i < chunks.length; i += 8) {
      const part = await Promise.allSettled(chunks.slice(i, i + 8).map((c) => ySpark(c, '5y', '1d')));
      for (const r of part) {
        if (r.status !== 'fulfilled') { fel++; continue; }
        for (const [s, pts] of Object.entries(r.value)) {
          const r4 = (v) => Math.round(v * 10000) / 10000;
          const a = yearAgoClose(pts); if (a) ref[s] = r4(a);
          const c = fiveYearAgoClose(pts, 1096); if (c) ref3[s] = r4(c);
          const b = fiveYearAgoClose(pts); if (b) ref5[s] = r4(b);
          const v = yearVol(pts, perYear); if (v != null) vol[s] = v;
          const k = sparkOf(pts); if (k) sp[s] = k;
        }
      }
    }
    return cached({ lista, del, antal: syms.length, ref, ref3, ref5, vol, sp, komplett: !fel, hamtad: new Date().toISOString() }, fel ? 600 : 3 * 3600);
  } catch (e) { return fail(e); }
};

export const config = { path: '/api/ar' };
