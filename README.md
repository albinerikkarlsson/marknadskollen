# Marknadskollen

Aktiesök med riskkoll och börsnyheter på enkel svenska. All data är riktig och hämtas live. Ingen exempeldata.

## Sidor
- `/` Översikt: marknaden, senaste nyheterna och mina aktier
- `/sok` Sök (`?q=volvo`). Ett klick på en träff öppnar bolagssidan.
- `/nyheter` Nyheter, Världen och Sverige
- `/bevakning` Mina aktier (sparas i webbläsaren tills inloggning finns)
- `/bolag/:ticker` Bolagssida med allt samlat: kursdiagram (1 mån–5 år), nyckeltal, affärsidé, historia, insynshandel, blankning, nyheter med AI-sammanfattning och full riskkoll. T.ex. `/bolag/VOLV-B.ST`
- `/aktier` Alla aktier i Sverige eller USA med filter för kategori, bransch och storlek, sortering och sök. Filtren sparas i adressen så att man kan dela en vy, t.ex. `/aktier?b=Teknik&k=utdelare`
- `/jamfor?a=VOLV-B.ST&b=AAPL` Jämför två bolag sida vid sida
- `/konto` Logga in eller skapa konto (Supabase). Bevakning och prislarm följer då med mellan enheter

## Teknik
- `public/` statisk sida i ren HTML, CSS och JavaScript, utan byggsteg.
- `netlify/functions/` serverfunktioner som hämtar data från Yahoo Finance (först), Finnhub (reserv) och Finansinspektionen:
  - `/api/search?q=` sök värdepapper
  - `/api/quote?s=A,B` senaste kurser
  - `/api/stock?s=` kurs, bolagsfakta, nyckeltal och riskkoll
  - `/api/news?region=world|se` eller `?s=` nyheter
  - `/api/insyn` eller `?namn=` insynshandel från Finansinspektionens insynsregister
  - `/api/blankning` eller `?namn=` blankning från Finansinspektionens blankningsregister
  - `/api/aktier?m=se|us` alla aktier med bransch och nyckeltal (Yahoos aktiefilter, en gång per bransch)
  - `/api/chart?s=&r=1m|6m|1y|5y` kursdiagram
  - `/api/summary?s=&namn=` AI-sammanfattning på svenska av nyheterna (kräver `ANTHROPIC_API_KEY`)
  - `/api/config` offentliga inställningar (Supabase-adress och publik nyckel)
  - `/api/about?s=` affärsidé, historia och fakta från Wikipedia (CC BY-SA 4.0) och Wikidata, svenska i första hand
- Svaren mellanlagras i Netlifys CDN (kurser 1 min, bolag och nyheter 15 min, sök 1 dygn, bolagsbeskrivning 1 vecka) så att API-gränsen räcker.

## Datakällor
- Yahoo Finance: kurser, nyckeltal, bolagsbeskrivning, sök och nyheter, även för svenska aktier. Inofficiellt gränssnitt som bara får användas privat. Byt till en licensierad källa (t.ex. EODHD) innan sidan lanseras publikt.
- Finnhub (samma data som finsheet.io): reserv om Yahoo inte svarar. Nyckeln ligger i Netlify som `DATA_API_KEY`, aldrig i koden.
- Finansinspektionen: insynshandel och blankning (öppna data).
- Wikipedia och Wikidata: affärsidé, historia och fakta.
Saknas data visar sidan det som saknat, aldrig påhittade siffror.

Marknaden på översikten visas med börsfonder (ETF:er) som följer respektive index: EWD (Sverige), SPY (S&P 500), QQQ (Nasdaq 100), DIA (Dow Jones), GLD (guld) och USO (olja).

## Inställningar i Netlify (miljövariabler)
- `DATA_API_KEY` Finnhub-nyckel (reserv för kurser)
- `SUPABASE_URL` och `SUPABASE_ANON_KEY` slår på inloggning. Bevakning, larm och namn sparas i användarens metadata, ingen tabell behövs. Lägg in sidans adress som Site URL och Redirect URL i Supabase (Authentication → URL Configuration).
- `ANTHROPIC_API_KEY` slår på AI-sammanfattningen.

## Prislarm
Välj en gräns per aktie under Bevakning. Sidan kollar kurserna varje minut och visar en notis när en aktie rör sig mer än gränsen under dagen. Notiser fungerar när sidan är öppen i en flik (även i bakgrunden).

## Riskmodell
Sju delar (blankning bara för svenska aktier), var och en Låg (1), Medel (2) eller Hög (3):
- Kurssvängningar: beta och årets spann
- Skulder: skuld/eget kapital
- Värdering: P/E
- Lönsamhet: vinstmarginal
- Handel: omsättning per dag
- Storlek: börsvärde
- Blankning: andel blankade aktier enligt Finansinspektionen

Medelvärdet räknas om till 1–10. Har bolaget minst en del med hög risk blir totalen minst 4. En total visas bara när minst tre delar finns.
Modellen är en egen förenkling, inte en vedertagen metod och inte ett råd.

Ingen investeringsrådgivning.
