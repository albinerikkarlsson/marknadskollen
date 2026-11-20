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

/* ---------- Fonder och ETF:er: typ och region ---------- */
// Datakällorna säger inte vilken sorts fond det är eller var den placerar. Det läses ur fondens namn och,
// när det finns, jämförelseindexet som fonden har rapporterat till Finansinspektionen.
// Står det inte tydligt blir det "övrig", hellre än en gissning.
const RANTA = /ränt|obligation|penningmarknad|likviditet|kassa\b|\bbond|credit|kredit|high yield|\bfrn\b|fixed income|money market|treasury|omrx|stibor|aggregate|govt|government|statsobl|företagsobl/i;
const BLAND = /\bmix\b|balanser|blandfond|stratega|transfer \d|generationsfond|generation \d|pension \d|active \d|aktiv \d|försiktig|offensiv|\bportfölj|komplett|multi.?asset|allocation|\bstrategi\b|strategifond|selection \d|förvaltningsfond/i;
const AKTIE = /aktie|equity|småbolag|small ?cap|mid ?cap|\bmsci\b|\bomx\b|omxs|\bsix\b|sixrx|stoxx|s&p|ftse|russell|nasdaq|nikkei|vinx|solactive.*(equity|sweden|global|world|usa|europe|nordic)|teknik|technology|tema|\bindex|indeks|indexnära|exponering|sverige|global|världen|europa|usa|asien|japan|kina|indien|tillväxt|emerging|nordamerika|norden|nordic|fastighet|hälsovård|healthcare|läkemedel|bioteknik|energi|infrastruktur/i;
const INDEX = /\bindex|indeks|indexnära|exponering|tracker|\bzero\b|access (sverige|global|europa|usa|asien|japan)|\betf\b|ucits etf/i;

// 'aktie' | 'ranta' | 'bland' | 'ovrig', och om det är en indexfond
export function fundKind(namn, index = '') {
  const n = String(namn || ''); const b = String(index || '').replace(/jämförelseindex saknas/i, '');
  const typ = RANTA.test(n) || (!AKTIE.test(n) && RANTA.test(b)) ? 'ranta' : BLAND.test(n) ? 'bland' : AKTIE.test(n) || AKTIE.test(b) ? 'aktie' : 'ovrig';
  return { typ, index: INDEX.test(n) };
}

// 'sverige' | 'norden' | 'europa' | 'usa' | 'global' | 'tillvaxt' | 'ovrig'. Namnet går före indexet.
const REG = [
  ['tillvaxt', /tillväxtmarknad|emerging|\bem\b|frontier|asien|asia|kina|china|indien|india|latinamerika|latin america|afrika|africa|östeuropa|eastern europe|ryssland|brasil|vietnam/i],
  ['sverige', /sverige|svensk|swedish|sweden|\bomxs|omx stockholm|sixrx|six return|six prx|stockholm/i],
  ['norden', /norden|nordisk|nordic|vinx|skandinav/i],
  ['usa', /\busa\b|amerika|nordamerika|north america|\bus\b|s&p 500|nasdaq.?100|russell/i],
  ['europa', /europa|europe|euro ?stoxx|stoxx europe|eurozone|tyskland|germany/i],
  ['global', /global|världen|world|acwi|international|internationell|globalfond/i]
];
export function fundRegion(namn, index = '') {
  const n = String(namn || ''); const b = String(index || '').replace(/jämförelseindex saknas/i, '');
  for (const [k, re] of REG) if (re.test(n)) return k;
  for (const [k, re] of REG) if (re.test(b)) return k;
  return 'ovrig';
}

// Samma fond finns ofta i flera andelsklasser ("A1 SEK", "B (SEK) Utd", "F-A"). Det här ger fondens namn utan klass,
// så att klasserna kan visas som en fond och matchas mot Finansinspektionens lista.
const KLASS_TOKEN = /^([a-z]\d{0,2}|[a-z]\d?-[a-z]{1,2}|[a-z]{1,2}-[a-z]\d?|utd|utdelande|dist|acc|inc|villkor|sek|eur|usd|nok|dkk|hedgad|hedged)$/;
export function fundBase(namn) {
  let s = String(namn || '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/\s+-\s+/g, ' ').replace(/[^\p{L}\p{N}&\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
  const w = s.split(' ');
  while (w.length > 2 && KLASS_TOKEN.test(w[w.length - 1])) w.pop();
  return w.join(' ');
}
export const isUtd = (namn) => /\butd\b|utdelande|\bdist\b|\binc\b/i.test(String(namn || ''));
