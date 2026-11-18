import { cached, fail } from '../lib/finnhub.mjs';
import { yScreen, yChart, raw } from '../lib/yahoo.mjs';

// GET /api/borsen  →  läget på Stockholmsbörsen just nu: trend, svängningar och bredd.
// Beskriver läget, säger inget om vad som händer härnäst. Räknas om en gång i timmen.

// Reserv om Yahoos aktiefilter inte svarar: de mest omsatta aktierna 18 nov 2026
const RESERV = ['INVE-B.ST', 'VOLV-B.ST', 'AZN.ST', 'ATCO-A.ST', 'ERIC-B.ST', 'SAAB-B.ST', 'SWED-A.ST', 'SHB-A.ST', 'SAND.ST', 'ASSA-B.ST',
  'SEB-A.ST', 'ABB.ST', 'BOL.ST', 'EQT.ST', 'EVO.ST', 'NDA-SE.ST', 'ESSITY-B.ST', 'HEXA-B.ST', 'EPI-A.ST', 'HM-B.ST',
  'TEL2-B.ST', 'TELIA.ST', 'SKF-B.ST', 'ALFA.ST', 'ATCO-B.ST', 'NIBE-B.ST', 'SKA-B.ST', 'SSAB-B.ST', 'SCA-B.ST', 'SECU-B.ST'];
const N = 30;

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
// Årstakt för svängningarna: standardavvikelsen för dagliga log-avkastningar gånger roten ur 252
const vol = (r) => { const m = mean(r); return Math.sqrt(mean(r.map((x) => (x - m) ** 2))) * Math.sqrt(252) * 100; };

async function mostTraded() {
  const r = await yScreen([{ operator: 'eq', operands: ['region', 'se'] }], { size: 120 });
  const list = r.quotes
    .filter((q) => /\.ST$/i.test(q.symbol || ''))
    .map((q) => ({ sym: q.symbol.toUpperCase(), oms: (raw(q.averageDailyVolume3Month) || 0) * (raw(q.regularMarketPrice) || 0) }))
    .filter((x) => x.oms > 0).sort((a, z) => z.oms - a.oms).slice(0, N).map((x) => x.sym);
  return list.length >= 20 ? list : null;
}

export default async () => {
  try {
    const syms = (await mostTraded().catch((e) => { console.warn('[borsen] filter:', e?.message); return null; })) || RESERV;
    const [idx, ...charts] = await Promise.all([
      yChart('^OMX', '5y', '1d'),
      ...syms.map((s) => yChart(s, '1y', '1d').catch(() => null))
    ]);
    const P = idx.points;
    if (P.length < 260) throw new Error('för kort indexhistorik');
    // Trend: senaste stängning mot snittet för 200 börsdagar
    const kurs = P[P.length - 1][1];
    const ma200 = mean(P.slice(-200).map((p) => p[1]));
    // Svängningar: senaste 20 dagarna mot hur det brukar vara de senaste fem åren
    const lr = P.slice(1).map((p, i) => Math.log(p[1] / P[i][1]));
    const nu = vol(lr.slice(-20));
    const roll = []; for (let i = 20; i <= lr.length; i++) roll.push(vol(lr.slice(i - 20, i)));
    roll.sort((a, z) => a - z);
    const normal = roll[Math.floor(roll.length / 2)];
    const percentil = (roll.filter((x) => x < nu).length / roll.length) * 100;
    const niva = percentil < 25 ? 'lugn' : percentil > 75 ? 'orolig' : 'normal';
    // Bredd: hur många av de mest omsatta som ligger över sitt eget 200-dagarssnitt
    let over = 0; let antal = 0;
    charts.forEach((c) => {
      const pts = c?.points || []; if (pts.length < 200) return;
      antal++; if (pts[pts.length - 1][1] > mean(pts.slice(-200).map((p) => p[1]))) over++;
    });
    const r1 = (x) => Math.round(x * 10) / 10;
    return cached({
      index: { namn: 'OMXS30', kurs: Math.round(kurs * 100) / 100, ma200: Math.round(ma200 * 100) / 100, diff: r1((kurs / ma200 - 1) * 100) },
      svang: { nu: r1(nu), normal: r1(normal), percentil: Math.round(percentil), niva },
      bredd: { over, antal },
      kalla: 'Yahoo Finance',
      tid: new Date(P[P.length - 1][0] * 1000).toISOString(),
      hamtad: new Date().toISOString()
    }, 3600);
  } catch (e) { return fail(e); }
};

export const config = { path: '/api/borsen' };
