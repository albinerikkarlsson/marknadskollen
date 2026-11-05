# Marknadskollen

Aktiesök med riskkoll och börsnyheter på enkel svenska. All data är riktig och hämtas live. Ingen exempeldata.

## Sidor
- `/` Översikt: marknaden, senaste nyheterna och mina aktier
- `/sok` Sök (`?q=volvo`). Ett klick på en träff öppnar bolagssidan.
- `/nyheter` Nyheter, Världen och Sverige
- `/bevakning` Mina aktier (sparas i webbläsaren tills inloggning finns)
- `/bolag/:ticker` Bolagssida med allt samlat: kurs, nyckeltal, affärsidé, historia, kursutveckling, nyheter och full riskkoll. T.ex. `/bolag/AAPL`

## Teknik
- `public/` statisk sida i ren HTML, CSS och JavaScript, utan byggsteg.
- `netlify/functions/` serverfunktioner som hämtar data från Finnhub:
  - `/api/search?q=` sök värdepapper
  - `/api/quote?s=A,B` senaste kurser
  - `/api/stock?s=` kurs, bolagsfakta, nyckeltal och riskkoll
  - `/api/news?region=world|se` eller `?s=` nyheter
  - `/api/about?s=` affärsidé, historia och fakta från Wikipedia (CC BY-SA 4.0) och Wikidata, svenska i första hand
- Svaren mellanlagras i Netlifys CDN (kurser 1 min, bolag och nyheter 15 min, sök 1 dygn, bolagsbeskrivning 1 vecka) så att API-gränsen räcker.

## Datakälla
Finnhub (samma data som finsheet.io). Nyckeln ligger i Netlify som miljövariabeln `DATA_API_KEY`, aldrig i koden.
Gratisplanen har främst amerikanska aktier och fonder. Svenska kurser och nyheter kräver en betalplan hos Finnhub.
Saknas data visar sidan det som saknat, aldrig påhittade siffror.

Marknaden på översikten visas med börsfonder (ETF:er) som följer respektive index: EWD (Sverige), SPY (S&P 500), QQQ (Nasdaq 100), DIA (Dow Jones), GLD (guld) och USO (olja).

## Riskmodell
Sex delar, var och en Låg (1), Medel (2) eller Hög (3):
- Kurssvängningar: beta och årets spann
- Skulder: skuld/eget kapital
- Värdering: P/E
- Lönsamhet: vinstmarginal
- Handel: omsättning per dag
- Storlek: börsvärde

Medelvärdet räknas om till 1–10. Har bolaget minst en del med hög risk blir totalen minst 4. En total visas bara när minst tre delar finns.
Modellen är en egen förenkling, inte en vedertagen metod och inte ett råd.

Ingen investeringsrådgivning.
