# Marknadskollen

Aktiesök med riskkoll och börsnyheter på enkel svenska.

## Sidor
- `/` Översikt
- `/sok` Sök och riskkoll (`?q=volvo`, `?id=evo`)
- `/nyheter` Nyheter, Sverige och Världen
- `/bevakning` Mina aktier (sparas i webbläsaren tills inloggning finns)
- `/bolag/:id` Bolagssida (`evo`, `saab`, `volvo`)
- `/riskradar` Riskradar för småbolag

## Teknik
Ren HTML, CSS och JavaScript utan byggsteg. Netlify publicerar mappen som den är (`netlify.toml`).
Kör lokalt med valfri statisk server som skickar alla sökvägar till `index.html`.

## Data
`assets/data.js` innehåller exempeldata från Bigdata.com, 5 november 2026 kl 15:14.
Den uppdateras inte automatiskt. Nästa steg:
1. Välj ett data-API med rätt att visa kurser och nyheter offentligt.
2. Lägg API-nyckeln som hemlig miljövariabel i Netlify, aldrig i koden.
3. Hämta data via en Netlify Function och spara i Supabase.

## Riskmodell
Varje faktor får Låg (1), Medel (2) eller Hög (3). Medelvärdet räknas om till 1–10.
Har bolaget minst en faktor på Hög blir totalen minst 4. Modellen är en egen förenkling, inte en vedertagen metod.

Ingen investeringsrådgivning.
