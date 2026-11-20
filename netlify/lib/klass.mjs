// Vad ett värdepapper på Stockholmsbörsen är, när Yahoo inte ger det någon bransch.
// Aktielistan rensar bort allt som inte är aktier, och listan med ETP:er och certifikat tar hand om det.
const HAVSTANG_SYM = /^(BULL|BEAR|MINI|TURBO|LONG|SHORT)[-\s]|-AVA-\d|\d[LCPS]-?\d{2,}/i;
const RATT_SYM = /-(BTU|BTA|BTB|TO\d*|TR|UR|IR)(\.|$)/i;
const ETP_NAME = /\b(ETP|ETN|ETC|Tracker|Virtune|21Shares|CoinShares|Valour|WisdomTree|Bitcoin|Ethereum|Solana|Crypto|Index ETP)\b/i;
const FOND_NAME = /\b(ETF|UCITS|Xtrackers|iShares)\b/i;
const HAVSTANG_NAME = /\b(Bull|Bear|Mini (Long|Short)|Turbo)\b/i;

// 'aktie' | 'etp' | 'havstang' | 'ratt' | 'fond'
export function kindOf(sym, namn) {
  const s = String(sym || ''); const n = String(namn || '');
  if (RATT_SYM.test(s)) return 'ratt';
  if (HAVSTANG_SYM.test(s) || HAVSTANG_NAME.test(n) || n.toUpperCase() === s.toUpperCase()) return 'havstang';
  if (FOND_NAME.test(n)) return 'fond';
  if (ETP_NAME.test(n)) return 'etp';
  return 'aktie';
}
export const isStock = (sym, namn) => kindOf(sym, namn) === 'aktie';

// Stablecoins följer en valuta, oftast dollarn. De märks så att ingen tror att de är vanliga kryptovalutor.
export const STABLE = new Set(['USDT', 'USDC', 'DAI', 'USDE', 'FDUSD', 'PYUSD', 'TUSD', 'USDS', 'USDD', 'USD1', 'BUSD', 'RLUSD', 'USDG', 'USDF', 'EURC', 'PAXG', 'XAUT']);
