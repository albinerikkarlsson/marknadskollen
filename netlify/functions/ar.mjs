import { cached, fail, ApiError } from '../lib/finnhub.mjs';
import { ySpark, yearAgoClose } from '../lib/yahoo.mjs';

// GET /api/ar?lista=se&del=0  →  kursen för ett år sedan för 500 värdepapper i taget ur en lista
// Sidan räknar "1 år" som senaste kurs delat med den här kursen, precis som på bolagssidan.
// lista: se, nord, us (aktier), fonder, etf-se, etf-us, etp, krypto
const SRC = { se: 'aktier?m=se', nord: 'aktier?m=nord', us: 'aktier?m=us', fonder: 'lista?typ=fonder', 'etf-se': 'lista?typ=etf&m=se', 'etf-us': 'lista?typ=etf&m=us', etp: 'lista?typ=etp', krypto: 'lista?typ=krypto' };
export const AR_DEL = 500;

export default async (req) => {
  try {
    const u = new URL(req.url); const lista = u.searchParams.get('lista'); const del = Math.max(0, Math.floor(Number(u.searchParams.get('del')) || 0));
    if (!SRC[lista]) throw new ApiError(400, 'okänd lista');
    const res = await fetch(`${u.origin}/api/${SRC[lista]}`, { signal: AbortSignal.timeout(9000) });
    if (!res.ok) throw new ApiError(502, 'listan kunde inte hämtas');
    const d = await res.json();
    const syms = (d.aktier || d.items || []).map((a) => a.sym).slice(del * AR_DEL, (del + 1) * AR_DEL);
    const chunks = []; for (let i = 0; i < syms.length; i += 20) chunks.push(syms.slice(i, i + 20));
    const ref = {}; let fel = 0;
    // Åtta anrop åt gången, så att Yahoo inte stryper oss
    for (let i = 0; i < chunks.length; i += 8) {
      const part = await Promise.allSettled(chunks.slice(i, i + 8).map((c) => ySpark(c)));
      for (const r of part) {
        if (r.status !== 'fulfilled') { fel++; continue; }
        for (const [s, pts] of Object.entries(r.value)) { const v = yearAgoClose(pts); if (v) ref[s] = Math.round(v * 10000) / 10000; }
      }
    }
    return cached({ lista, del, antal: syms.length, ref, komplett: !fel, hamtad: new Date().toISOString() }, fel ? 600 : 3 * 3600);
  } catch (e) { return fail(e); }
};

export const config = { path: '/api/ar' };
