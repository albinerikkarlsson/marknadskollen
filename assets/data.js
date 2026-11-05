// Exempeldata hämtad från Bigdata.com torsdag 5 november 2026 kl 15:14.
// Ersätts av ett riktigt data-API senare (se README).

export const DATA_TID = 'torsdag 5 november 2026, kl 15:14';

export const ticker = [
  { name: 'OMXS30', val: '3 334,23', d1: 0.68 },
  { name: 'S&P 500', val: '7 688,62', d1: 1.58 },
  { name: 'Nasdaq', val: '25 736,51', d1: 1.44 },
  { name: 'DAX', val: '26 598,30', d1: -0.14 },
  { name: 'Brent', val: '97,32', d1: 2.85 },
  { name: 'Guld', val: '4 129,30', d1: 1.38 }
];

export const heroes = [
  { code: 'OMX', kind: 'Sverige', name: 'OMX Stockholm 30', val: '3 334,23', d1: 0.68, ytd: 15.65 },
  { code: 'SPX', kind: 'USA', name: 'S&P 500', val: '7 688,62', d1: 1.58, ytd: 12.32 },
  { code: 'BZ', kind: 'Råvara', name: 'Brent, USD', val: '97,32', d1: 2.85, ytd: 59.23 }
];

// Risknivå per faktor: 1 = låg, 2 = medel, 3 = hög
export const bolag = [
  {
    id: 'evo', kort: 'EVO', namn: 'Evolution', sok: 'evolution evo spel casino',
    lista: 'Large Cap · Spel', kurs: '859,00', valuta: 'kr', d1: 0.59,
    fakta: [
      ['Börsvärde', '164,5 mdr kr'], ['52 veckor', '515,40–911,00'], ['Snittvolym', '626 447'],
      ['Vd', 'Martin Carlesund'], ['Noterad', '2015']
    ],
    perf: [['1 dag', 0.59], ['5 dagar', 3.49], ['1 mån', 5.45], ['3 mån', 17.22], ['6 mån', 36.31], ['I år', 37.62], ['1 år', 36.05]],
    sammanfattning: 'Mycket lönsamt bolag utan skulder. Den största risken är regler för spel, som kan ändras snabbt i de länder där bolaget tjänar sina pengar.',
    faktorer: [
      ['Kurssvängningar', 2, 'Beta 0,69 · 515–911 kr på ett år', 'Rör sig mindre än börsen i snitt, men kursen har ändå varierat nästan 400 kronor på ett år.'],
      ['Skulder', 1, 'Mer kassa än skulder · skuld/eget kapital 0,03', 'Bolaget har mer pengar på kontot än det är skyldigt.'],
      ['Värdering', 1, 'P/E 14,5', 'Priset är inte högt jämfört med vinsten bolaget gör.'],
      ['Lönsamhet', 1, 'Vinstmarginal 49,6 %', 'Ungefär hälften av intäkterna blir vinst.'],
      ['Handel', 1, 'Snitt 626 447 aktier per dag · börsvärde 164 mdr kr', 'Lätt att köpa och sälja utan att påverka priset.'],
      ['Regler och omvärld', 3, 'Spelregler i många länder', 'Nya regler eller licensbeslut kan snabbt minska intäkterna.']
    ],
    tank: ['Kursen ligger nära toppen för året (87 % av spannet).', 'Följ nyheter om spelregler i Europa och USA.', 'Bolaget delar ut lite pengar, avkastningen kommer mest från kursen.']
  },
  {
    id: 'saab', kort: 'SAAB', namn: 'Saab B', sok: 'saab b saab.b försvar',
    lista: 'Large Cap · Försvar', kurs: '621,70', valuta: 'kr', d1: -3.19,
    fakta: [
      ['Börsvärde', '329,9 mdr kr'], ['52 veckor', '445,10–748,80'], ['Snittvolym', '1 393 483'],
      ['Vd', 'Micael Johansson'], ['Grundat', '1937']
    ],
    perf: [['1 dag', -3.19], ['5 dagar', -8.09], ['1 mån', -0.48], ['3 mån', -0.51], ['6 mån', 8.01], ['I år', 11.06], ['1 år', 20.77]],
    sammanfattning: 'Stabila affärer och små skulder, men aktien är dyr jämfört med vinsten och har fallit 8 procent på en vecka. Kursen styrs mycket av nyheter om krig och fred.',
    faktorer: [
      ['Kurssvängningar', 3, '−8,1 % på fem dagar · 445–749 kr på ett år', 'Försvarsaktier rör sig mycket när det kommer nyheter om konflikter eller fredssamtal.'],
      ['Skulder', 1, 'Skuld/eget kapital 0,35 · nettoskuld/EBITDA 0,75', 'Skulderna är små jämfört med vad bolaget tjänar.'],
      ['Värdering', 3, 'P/E 44,4', 'Investerarna betalar mycket för vinsten. Blir tillväxten sämre än väntat kan kursen falla mer.'],
      ['Lönsamhet', 2, 'Rörelsemarginal 10,1 %', 'Stabil men inte hög marginal, vanligt för industribolag.'],
      ['Handel', 1, 'Snitt 1,39 milj aktier per dag · börsvärde 330 mdr kr', 'Lätt att köpa och sälja.'],
      ['Regler och omvärld', 2, 'Beroende av försvarsbudgetar', 'Beställningarna styrs av politiska beslut i många länder.']
    ],
    tank: ['Sämst i OMXS30 i dag.', 'Hög värdering gör aktien känslig för besvikelser i rapporter.', 'Politiska beslut om försvar påverkar mer än vanliga konjunktursiffror.']
  },
  {
    id: 'volvo', kort: 'VOL', namn: 'Volvo B', sok: 'volvo b volv.b lastbilar',
    lista: 'Large Cap · Verkstad', kurs: '319,70', valuta: 'kr', d1: 2.63,
    fakta: [
      ['Börsvärde', '650,1 mdr kr'], ['52 veckor', '255,50–374,50'], ['Snittvolym', '2 985 511'],
      ['Vd', 'Martin Lundstedt'], ['Grundat', '1927']
    ],
    perf: [['1 dag', 2.63], ['5 dagar', 3.66], ['1 mån', 2.27], ['3 mån', -12.75], ['6 mån', 0.53], ['I år', 7.35], ['1 år', 21.33]],
    sammanfattning: 'Lönsamt och rimligt värderat bolag med hög utdelning. Mer skulder än de andra, delvis för att Volvo lånar ut pengar till kunder som köper lastbilar.',
    faktorer: [
      ['Kurssvängningar', 2, 'Beta 1,02 · −12,7 % på tre månader', 'Rör sig ungefär som börsen i stort.'],
      ['Skulder', 2, 'Skuld/eget kapital 1,41', 'En del av skulden hör till finansbolaget som lånar ut till kunder, men det är mer skuld än hos de flesta.'],
      ['Värdering', 1, 'P/E 16,7 · utdelning 4,0 %', 'Normalt pris jämfört med vinsten.'],
      ['Lönsamhet', 1, 'Rörelsemarginal 11,0 % · avkastning på eget kapital 21 %', 'Tjänar bra på de pengar ägarna har satt in.'],
      ['Handel', 1, 'Snitt 2,99 milj aktier per dag · börsvärde 650 mdr kr', 'En av de mest handlade aktierna i Stockholm.'],
      ['Konjunktur', 2, 'Lastbilar och anläggningsmaskiner', 'Försäljningen går ner när ekonomin bromsar in.']
    ],
    tank: ['Utdelningen kan sänkas om vinsten faller.', 'Följ orderingången i rapporterna, den visar vart försäljningen är på väg.', 'Kursen har gått sämre de senaste tre månaderna.']
  },
  {
    id: 'sma', kort: 'A', namn: 'Småbolag A', exempel: true, sok: 'småbolag a first north exempel',
    lista: 'First North · påhittat exempel', kurs: '–', valuta: '', d1: null,
    fakta: [], perf: [],
    sammanfattning: 'Påhittat exempel på hur ett riskabelt småbolag ser ut i riskkollen: förlust, liten handel och stora kursrörelser utan nyheter.',
    faktorer: [
      ['Kurssvängningar', 3, 'Exempel', 'Kursen rör sig kraftigt utan att bolaget har sagt något.'],
      ['Skulder', 2, 'Exempel', 'Bolaget kan behöva låna eller ta in nya pengar.'],
      ['Värdering', 3, 'Ingen vinst ännu', 'Priset bygger helt på förhoppningar om framtiden.'],
      ['Lönsamhet', 3, 'Förlust', 'Bolaget gör av med mer pengar än det tjänar.'],
      ['Handel', 3, 'Liten handel', 'Svårt att sälja när man vill.'],
      ['Varningssignaler', 3, 'Volym långt över snittet', 'Vanligt mönster vid så kallad pump och dump.']
    ],
    tank: ['Läs bolagets senaste pressmeddelanden innan du gör något.', 'Var extra försiktig med tips i chattar och sociala medier.', 'Se Riskradarn för fler småbolag med varningssignaler.']
  }
];

export const nyheter = {
  se: [
    { kat: 'Börsen', ikon: 'makro', tid: '12:05', kalla: 'Finwire', rubrik: 'Stockholmsbörsen upp 0,75 procent vid lunch', text: 'Breda uppgångar efter starka siffror från USA i går. Gruvbolag och verkstad drar upp, försvarsbolag går ner.', ton: 'Positiv', bolag: 'OMXS30' },
    { kat: 'Uppköp', ikon: 'uppkop', tid: '08:50', kalla: 'Finwire', rubrik: 'Egetis får bud på 11,25 kronor per aktie', text: 'Budet värderar bolaget till cirka 5,3 miljarder kronor, en premie på 12,6 procent mot gårdagens stängning.', ton: 'Positiv', bolag: 'Egetis Therapeutics' },
    { kat: 'Affär', ikon: 'handel', tid: '09:39', kalla: 'Finwire', rubrik: 'Kina stoppar ABB:s robotaffär med Softbank', text: 'Affären var värd 5,4 miljarder dollar. ABB får nu hitta en annan väg för robotdivisionen.', ton: 'Negativ', bolag: 'ABB' },
    { kat: 'Rapport', ikon: 'rapport', tid: '07:30', kalla: 'Bigdata.com', rubrik: 'Skanska tjänar mindre än väntat', text: 'Rörelseresultatet blev 2 072 miljoner kronor mot väntade 2 319. Orderboken är fortsatt stor, 328 miljarder kronor.', ton: 'Neutral', bolag: 'Skanska' },
    { kat: 'Insyn', ikon: 'insyn', tid: '4 nov', kalla: 'Finansinspektionen', rubrik: 'Styrelseledamot köper aktier i Berner för 3 miljoner', text: 'Johan Lannebo köpte 43 124 aktier i Berner Industrier den 3 och 4 november.', ton: 'Positiv', bolag: 'Berner Industrier' }
  ],
  world: [
    { kat: 'USA', ikon: 'makro', tid: '06:54', kalla: 'Benzinga', rubrik: 'Dow Jones steg 1 569 punkter', text: 'Den största uppgången på länge. Apple, Microsoft och Amazon steg alla.', ton: 'Positiv', bolag: 'Dow Jones, Apple, Microsoft, Amazon' },
    { kat: 'Rapport', ikon: 'rapport', tid: '05:10', kalla: 'Bigdata.com', rubrik: 'Arm faller trots att intäkterna växte 27 procent', text: 'Intäkterna blev 1,44 miljarder dollar. Investerarna hade hoppats på en ännu starkare prognos.', ton: 'Negativ', bolag: 'Arm Holdings' },
    { kat: 'Sektor', ikon: 'makro', tid: '04:40', kalla: 'Bigdata.com', rubrik: 'Chipaktier ner 3,1 procent', text: 'Halvledarbolagen gick emot resten av marknaden efter flera svaga prognoser.', ton: 'Negativ', bolag: 'Halvledare' },
    { kat: 'Råvaror', ikon: 'ravara', tid: '03:15', kalla: 'Bigdata.com', rubrik: 'Oljepriset har fallit 8 procent på en vecka', text: 'Större utbud och svagare efterfrågan pressar priset. Det påverkar oljebolag och flygbolag åt olika håll.', ton: 'Neutral', bolag: 'Brent' }
  ]
};

export const insyn = [
  { typ: 'Köp', datum: '3–4 nov', bolag: 'Berner Industrier', vem: 'Johan Lannebo, styrelseledamot', antal: '43 124 aktier', belopp: '3,0 mkr' },
  { typ: 'Sälj', datum: '4 nov', bolag: 'Noba Bank', vem: 'Olof Mankert, riskchef', antal: '10 000 aktier', belopp: '0,96 mkr' },
  { typ: 'Sälj', datum: '4 nov', bolag: 'Noba Bank', vem: 'Malin Frick, HR-chef', antal: '5 000 aktier', belopp: '0,48 mkr' }
];

// Övriga aktier i exempel-bevakningen (utan egen bolagssida än)
export const ovrigaAktier = [
  { id: 'boliden', kort: 'BOL', namn: 'Boliden', lista: 'Large Cap', kurs: '–', d1: 2.6, senaste: 'Gruvbolag drar upp börsen' },
  { id: 'ericsson', kort: 'ERI', namn: 'Ericsson B', lista: 'Large Cap', kurs: '–', d1: -2.7, senaste: 'Chipaktier föll i USA' }
];

export const radar = [
  { namn: 'Småbolag A', lista: 'First North', signaler: ['Volym långt över snittet', 'Stor kursrörelse utan nyhet'], niva: 3 },
  { namn: 'Småbolag B', lista: 'Spotlight', signaler: ['Ny riktad emission', 'Ledning säljer'], niva: 2 }
];

export const signalforklaring = [
  ['Volym långt över snittet', 'Många fler aktier byter ägare än vanligt. Kan vara en nyhet, kan vara någon som pumpar.'],
  ['Stor kursrörelse utan nyhet', 'Kursen rör sig kraftigt men bolaget har inte sagt något. Ofta ett tecken på rykten.'],
  ['Ny riktad emission', 'Bolaget säljer nya aktier till vissa köpare. Det kan späda ut dina aktier.'],
  ['Ledning säljer', 'Personer i ledningen säljer egna aktier. Värt att veta varför.'],
  ['Tips i sociala medier', 'Bolaget nämns plötsligt mycket i chattar och grupper. Vanligt vid pump och dump.'],
  ['Byte av revisor', 'Revisorn slutar eller byts ut kort före en rapport.']
];
