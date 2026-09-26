# THOTH - Kravspesifikasjon og backlog

## 1. Mål og konsept
THOTH er et nettsted og en dataløsning for å skrive, redigere, publisere og lese boktekst på nettet. Tekst skal kunne importeres fra Microsoft Word med så mye bevart formatering som mulig. Løsningen har to hovedområder:

- offentlig frontend for lesing av publisert tekst
- beskyttet backend for redigering, metadata, publisering og sikkerhetskopiering

## 2. Overordnede krav
- Produktnavn: THOTH
- All tekst skal lagres og vises som UTF-8
- Layout skal så langt som mulig beholde dagens visuelle uttrykk, farger og fonter
- Design skal være responsivt, men hovedlayouten skal være sentrert med maksimal bredde på 960 px
- Filnavn og URL-er skal bruke små bokstaver
- Filnavn og URL-er skal unngå æ, ø, å, mellomrom og spesialtegn
- Backend må være beskyttet mot uautorisert tilgang

## 3. Roller og tilgang
### 3.1 Publikum
- Kan åpne frontend og lese publiserte kapitler
- Har ikke tilgang til backend

### 3.2 Pålogget bruker
- Kan åpne backend
- Kan redigere innhold
- Kan registrere og oppdatere metadata
- Kan publisere boktekst
- Kan logge ut

### 3.3 Sikkerhetskrav
- Backend skal kun være tilgjengelig etter innlogging
- Publisering skal kreve publiseringsnøkkel
- Brukeren skal sendes til innloggingssiden hvis backend åpnes uten gyldig sesjon
- Alle backend-sider skal validere gyldig PHP-sesjon før innhold vises

## 4. Brukeradministrasjon og autentisering
### Funksjonelle krav
- Innlogging og brukeradministrasjon skal bygges med PHP-sesjoner
- Flere brukere skal kunne registrere eget brukernavn og passord
- Brukerregistrering skal lagre:
  - fornavn
  - etternavn
  - e-postadresse
  - telefonnummer (valgfritt)
- Brukernavn skal være unikt
- Passord skal lagres som sikker hash og aldri i klartekst

### Datakrav
- Brukere lagres primært i SQLite hvis webhotellet støtter dette
- Alternativt kan brukerdata lagres i en beskyttet JSON-fil
- Brukerdata skal lagres utenfor offentlig tilgjengelig område
- Hvis data må ligge under /thoth/data/, skal direkte nettlesertilgang blokkeres

### Akseptkriterier
- En ny bruker kan registrere seg med gyldige felter
- Brukernavnet kan ikke være duplisert
- Passord lagres ikke som klartekst
- En innlogget bruker får tilgang til backend
- En ikke-innlogget bruker blir sendt til innloggingsside
- Utlogging avslutter sesjonen og tillater ikke videre tilgang uten pålogging

## 5. Redigeringsflyt
### Funksjonelle krav
- Redaktøren skal kunne skrive og redigere boktekst i editoren
- Redaktøren skal kunne strukturere tekst i kapitler
- Redaktøren skal kunne oppdatere bokmetadata
- Redaktøren skal kunne publisere innhold
- Redaktøren skal kunne navigere mellom kapitler i editoren
- Redaktøren skal kunne vise og slette eksisterende kapittelposter
- Redaktøren skal kunne opprette og administrere boktittel

### Innholdskrav
- Manuskriptet skal oppdateres med semantisk riktig HTML-struktur
- Kapitler skal presenteres i riktig rekkefølge i teksten
- Kapiteloverskrifter skal håndteres konsekvent i editor og publisert side
- Importert tekst fra Word skal kunne brukes med mest mulig bevart formatering
- Tekst og metadata skal oppdateres med UTF-8 som standard

### Akseptkriterier
- Det er mulig å opprette, vise og slette boktittel
- Kapittelmenyen matcher faktisk rekkefølge i teksten
- Kapitler kan opprettes, vises og slettes uten teknisk feil
- Overskrifter blir rendret i riktig semantisk nivå
- Publisert side viser samme rekkefølge som editoren

## 6. Publisering
### Funksjonelle krav
- Publisering skal skje via en tydelig, sikker prosess
- Publisert innhold skal være tilgjengelig i frontend
- Publiseringsnøkkel skal være nødvendig for å publisere
- Publisering skal oppdatere offentlig visning uten å eksponere backend

### Akseptkriterier
- Publisering uten nøkkel feiler og vises som uautoriserte handling
- Publisering med gyldig nøkkel oppdaterer frontend
- Publiserte kapitler er tilgjengelige for lesere uten innlogging
- Publiserte kapitler viser korrekt struktur og rekkefølge

## 7. Frontend og visning
### Funksjonelle krav
- Publikum skal kunne lese publiserte kapitler i nettsiden
- Frontend skal vise innhold i lesbar layout
- Frontend skal kunne vise bokoverskrift, kapitteloverskrifter og innhold
- Layout skal være konsistent med dagens visuelle profil

### Akseptkriterier
- Frontend viser publiserte kapitler uten feil i struktur
- Frontend er responsiv og fungerer i vanlig desktopbredde
- Bokoverskrift og kapitteloverskrifter vises riktig
- Leseren kan navigere gjennom innholdet uten tekniske feil

## 8. Sikkerhet og drift
### Krav
- Alt sensitive data skal være skjermet fra offentlig tilgang
- Direkte nettlesertilgang til dataområder skal være blokkert
- Backend skal ha tilgangskontroll på alle sider
- Det skal legges til rette for bot- og trafikkbeskyttelse i tråd med prosjektets sikkerhetshåndtering

### Akseptkriterier
- Sensitiv data er ikke tilgjengelig direkte fra web
- Uautorisert tilgang blir omdirigert eller blokkert
- Sikkerhetsregler er implementert i serverkonfigurasjon og backend

## 9. Prioritert backlog
### P0 - Kreves for grunnleggende drift
1. Oppsett av sikker innlogging med PHP-sesjoner
2. Brukerregistrering og brukeradministrasjon
3. Lagring av passord som hash
4. Sesjonskontroll på alle backend-sider
5. Beskyttet tilgang til datafiler
6. Publiseringsnøkkel og publiseringskontroll
7. Basert redigeringsflyt for kapittel og tekst
8. Frontend-visning av publisert innhold

### P1 - Viktig for brukbarhet og kvalitet
1. Kapittelmeny i venstre panel
2. Korrekt rekkefølge i kapittelvisning
3. Opprette, vise og slette kapittelposter
4. Opprette, vise og slette boktittel
5. Semantisk HTML-struktur for kapitler og overskrifter
6. UTF-8-konsekvent håndtering av tekst
7. Responsivt og visuell kompatibilitet med eksisterende design

### P2 - Forbedringer og videreutvikling
1. Import av Word-formattering med bedre kompatibilitet
2. Backup og sikkerhetskopiering
3. Utvidet brukeradministrasjon
4. Bot- og trafikkbeskyttelse på nivå med driftsstabilitet
5. Videre forbedring av publiseringsarbeidsflyt

## 10. Definition of done
En funksjon er ferdig når:
- den er implementert og testet i den relevante brukerflyten
- den oppfyller akseptkriteriene i dette dokumentet
- den fungerer med riktig tilgangskontroll
- den fungerer med UTF-8 og forventet innhold
- den er kompatibel med prosjektets eksisterende layout og struktur
- den er dokumentert nok til videre oppfølging i prosjektet

## 11. Kort oppsummert prioritet
1. Sikkerhet og innlogging
2. Backend- og sesjonskontroll
3. Redigering og kapittelstruktur
4. Publisering og frontend-visning
5. Driftssikkerhet og forbedring

Dette dokumentet er den operative kravbasen for videre utvikling av THOTH og skal brukes som referanse for alle fremtidige implementasjoner.
