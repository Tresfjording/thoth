# thoth

Et enkelt, statisk bokverksted for å skrive og strukturere egne tekster.

## Filer

- `index.html` inneholder strukturen på siden.
- `styles.css` styrer utseendet.
- `script.js` inneholder redigering, import, forhåndsvisning og lokal lagring.
- `publish.php` tar imot og lagrer bare arbeidskopien på serveren.

## Slik bruker du siden

1. Åpne `index.html` direkte i nettleseren.
2. Skriv inn tittel, ingress, forfatter og kapittel.
3. Lim inn manus i tekstfeltet. Det du skriver lagres automatisk lokalt i nettleseren.

## Publisere arbeidskopien på One.com

Publiseringsknappen sender bare manusdataene til `publish.php`. Den sender ikke
selve Thoth-siden eller innloggingsdataene dine.

1. Åpne `publish.php` og bytt ut `CHANGE_THIS_TO_A_LONG_RANDOM_KEY` med en lang, hemmelig nøkkel.
2. Last opp prosjektets hoved-`index.html` til mappen `thoth` på One.com. Den viser status dersom ingen bok er publisert ennå.
3. Last opp `rediger/index.html`, `rediger/styles.css`, `rediger/script.js` og `rediger/publish.php` til undermappen `thoth/rediger/`.
4. Åpne redigeringssiden via `https://www.tresfjording.no/thoth/rediger/`.
5. Trykk **Publiser arbeidskopi** og skriv inn den samme nøkkelen.
6. Åpne lenken **Åpne publisert arbeidskopi** som vises etterpå. Publikum bruker `https://www.tresfjording.no/thoth/`.

Det er ikke nok å laste opp filene og oppdatere nettleseren. `arbeidskopi.html` må
genereres på nytt ved å trykke publiseringsknappen.

En lesbar sluttproduktside opprettes som `arbeidskopi.html` i `thoth`-mappen.
Ingen JSON-kopi eller editorfiler lastes opp av publiseringsknappen. Mappen må ha skrivetilgang for PHP. Ikke del
publiseringsnøkkelen offentlig. Publisering må gjøres fra redigeringssiden på One.com, ikke fra
en lokal `file:///`-åpning.

Mellomtitler formatert som `h2` i manus blir automatisk til kapitler i venstremenyen
på sluttproduktsiden. Klikk på et kapittel for å hoppe til riktig sted i teksten.

### Rask import

Knappen **Importer fra tekst** tolker innlimt tekst slik:

- første linje blir tittel
- første avsnitt etter tittelen blir ingress
- resten blir manus

Tom linje mellom avsnitt blir bevart i bokvisningen.

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

- Legge til kapitler og navigering mellom manus.
- Eksportere manus til ren tekst eller PDF.
- Publisere siden med GitHub Pages eller Netlify.
