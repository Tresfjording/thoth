# thoth

En enkel, statisk nettside for å presentere egne tekster som prosa, sangtekster og andre formater.

## Filer

- `index.html` inneholder strukturen på siden.
- `styles.css` styrer utseendet.
- `script.js` inneholder eksempeltekster og filtrering.

## Slik bruker du siden

1. Åpne `index.html` direkte i nettleser for å se siden lokalt.
2. Rediger tekstene i `script.js` for å bytte ut eksempelinnhold med ditt eget.
3. Oppdater kontaktinformasjonen i `index.html`.

## Skjult publisering på tresfjording.no

Siden er nå forberedt med to grep som gjør den vanskeligere å finne:

- `index.html` har `meta name="robots"` satt til `noindex, nofollow` og relaterte verdier.
- `robots.txt` blokkerer alle søkemotorer fra å indeksere siden.

Dette er likevel ikke ekte beskyttelse. Hvis noen kjenner den nøyaktige URL-en, kan de fortsatt åpne siden. For faktisk skjerming bør du publisere den på en ikke-lenket undermappe og i tillegg bruke passordbeskyttelse på servernivå.

### Praktisk oppsett med ukjent URL

Denne løsningen bruker relative filbaner, så den kan lastes opp direkte i en valgfri undermappe, for eksempel `tresfjording.no/tekster-9h3k2/`.

Last opp disse filene til samme mappe på serveren:

- `index.html`
- `styles.css`
- `script.js`
- `robots.txt`

Så lenge du ikke lenker til mappen fra andre sider og URL-en ikke er kjent, vil siden i praksis være skjult for vanlige besøkende.

## Neste naturlige steg

- Lage egne undersider for hver tekst.
- Legge til flere kategorier eller et arkiv.
- Publisere siden med GitHub Pages eller Netlify.
