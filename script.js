function formatBody(body) {
  const lines = body.trim().split("\n");
  const indentation = lines
    .filter((line) => line.trim())
    .reduce((smallest, line) => {
      const current = line.match(/^\s*/)?.[0].length ?? 0;
      return smallest === null ? current : Math.min(smallest, current);
    }, null);

  return lines
    .map((line) => line.slice(indentation ?? 0).trimEnd())
    .join("\n")
    .split(/\n\s*\n/)
    .map((section) => section.trim())
    .filter(Boolean);
}

const texts = [
  {
    title: "Jag den gamle bort - Don't let the old man inn",
    type: "sangtekst",
    label: "Sangtekst",
    intro: "En intens sang om det å bli gammel.",
    meta: "Norsk tekst: Øyvind Granberg, april 2026",
    body: `
      Jag den gamle bort
      Jeg vil jo leve som før
      Slik jeg alltid har gjort
      Han banker på min dør

      Jeg har visst helt til slutt
      At én dag er det gjort
      Kom deg opp og gå ut
      Og jag den gamle bort

      Jeg har levd et langt liv
      Min kropp er sliten og vond
      Spør deg selv hvor gammel du er
      Om du ikke husker dagen du kom

      Nyt ditt livs kjærlighet
      Ha dine venner til bords
      Feir hver aften med vin
      Og jag den gamle bort

      Hmm hmmm hmmm...

      Jeg har levd et langt liv
      Min kropp er sliten og vond
      Spør deg selv hvor gammel du er
      Om du ikke husker dagen du kom

      Når han rir bort på sin hest
      Og du kjenner en iskald sno
      Se ut på verden og smil
      Og jag den gamle bort

      Se ut på verden og smil
      Og jag den gamle bort
    `
  },
  {
    title: "O' Heilage Natt",
    type: "julesang",
    label: "Sangtekst",
    intro: "En av Nordens mest elskede julesanger.",
    meta: "En nynorsk vesjon av den svenske julesangen 'O Helga Natt', oversatt av Øyvind Granberg, desember 2023",
    body: `
     Heilage natt, der stjerner lyser klåre
Ja, det er natta då Frelsaren vart født
Verda var dømd til mørketid og tårer
Heilt til Han kom og Han høyrde vår bøn
Eit håp av fryd og verda song hans ære
Og over stall ein heilag morgon rann
Fall ned på kne, og høyr englesongen
O’ Heilage natt, då Frelsaren vart født
O’ Heilage natt, då Frelsaren vart født

I tru og von vår klagen Han høyrde
Vår hjartas glød leia fram til krubbas barn
Stjerna ho lyste og klåre strålar førte
Dei vise menn ifrå Østens fjerne land
Og Kongen av kongar, sveipa i ei krubbe
I freisting og skugge vart han vegens lys
Han veit vår naud, og Han veit vår byrde
Så ære din Herre, og bøy deg i Hans glans
Så ære din Herre, og bøy deg i Hans glans

Hans bodskap er å elske sin neste
Kjærleiken er hans lov og testament
Han bryter lenker, og slavane vert frelste
Og i hans namn, all trældom er gløymt
I gledas hymner og takkens kor vi synger
Lat oss prise Hans heilage namn
% Pris Jesus Kristus, og pris Ham i gagn
Hans herlegdom og makt er her til evig tid
Hans herlegdom og makt er her til evig tid %

    `
  },
  {
    title: "Du gjev meg tru",
    type: "kjærlighetssang",
    label: "Sangtekst",
    intro: "En hylles til en kjær person som gir styrke og håp i vanskelige tider.",
    meta: "Org. tittel: You raise me up Melodi/tekst: Rolf Løvland / Brendan Joseph Graham / Øyvind A. F. Granberg",
    body: `
     Når eg er trist, og sjela mi er sliten
Når gråten kjem og hjarta mitt slår ned 
Då er eg taus, og ventar her i lengting
Heilt til du kjem og sit eit bel hjå meg

Du gjev meg tru, so eg kan stå på fjelltopp
Du gjev meg tru, so eg kan stå i storm
Eg er sterk, eg stend på dine skuldrar
Du gjev meg tru, på meir enn eg kan bli

Det er eit liv, eit liv i kamp og liding
Der varme hjarte missar nokre slag
Men når du kjem og eg er fylt med lengting
Då har eg sett eit glimt av evig dag

Du gjev meg tru, so eg kan stå på fjelltopp
Du gjev meg tru, so eg stend støtt i storm
Eg er sterk, eg stend på dine skuldrar
Du gjev meg tru, på meir enn eg kan bli

Du gjev meg tru, på meir enn eg kan bli

    `
  },
  {
    title: "Langfri og Dautid",
    type: "Jaktvise",
    label: "Sangtekst",
    intro: "Når man skal på jakt er lokalbutikken viktig",
    meta: "Det er en fordel å kjenne til litt historie fra Tresfjord. Fremført på Tresfjordrevyen",
    body: `
      Her tili om da’n
I va trøtt som ei kran
I skulle ut på fisketur
Det va då i fann ut, at
Her trengs sterkare lut
I må kjøpe både agn å øl
Å ei pakke mæ skot, hvess æn hjort kjæm attåt
No når sommar’n e på hæng
Ne’me butikken på kaia, 
hæng et skilt å svaia
Me he alt du treeææng

Vers:
For på skiltet står det Lang..fri og Dau…tid
Ja, me he alt du treng
Me he alt det æn jeger, å æn svenger av beger, langt oppi dala treng
Me he båndsagblad, 
Å gamle griseblad
Men det e ingen som væt kor hæn
På skiltet står det Lang---fri og Dau..tid
Spør du me so he dem alt

Ååå, når du kjæm inn
Gå i små korte trinn
For her e det fullt å trongt
Her e alle hylla sprengt
Golvet er stengt
Me alt fra syl te knipetong

Mæ æt lite skrått blikk
Å et intænst nikk
Spør’n om du vell ha æn fres
I sæ nei, nei, nei, takk du
Bærre ei pakke mæ sluk
For i e på fisketur

Værs 3g med skifte til A-dur

    `
  },
  {
    title: "Fanthammar'n",
    type: "Revyvise",
    label: "Sangtekst",
    intro: "En sang om en virkelig hendle i Tresfjord for mange mange år sia",
    meta: "Lagt til tone av Boby Bares Millers Cave",
    body: `
      Lengst ner’i sør, innst inn i fjora
Ova i huuuuus å heimegard
Der kor Klæva vææææks, rakt opp i være
Den dagjin dauin’ hadde fest på Fanthammar’n

Litt utpå daaaaa’n, der inn’i fjora
Dokka faaaaaaant’n, plutsle fram
Han sikta bæææænt, rett inn i aue
Men løkka krute det va vått, på Fanthammar’n

Så dasar’n heeeeeeeeeiv, opp si eia børse
Og mæ et smeeeeeeeeell, datt fant’n om
Mæ gull og pææææææng, i alle lomman
Den dagjin dauin’ hadde fæst på Fanthammar’n

Å lænsmann saaaaa om denna skatt’n
At du kan gjæææær mæ’n ka du vell
So’n ga’n te hooooo, Kari darsarn
Den dagjin dauin’ hadde fest på Fanthammar’n


No velle’n gjeeeeeeefte se mæ damå
Mæn ho Kari faaaaaannnnj se anna mannj
Dæ tok mæ skaaaatt’n te søre møre
Dær dæ levde lenge på æt skot frå Fanthammer’n

    `
  },
  {
    title: "Mannj i grønt",
    type: "Revyvise",
    label: "Sangtekst",
    intro: "En vise om bøndens streven og klagan",
    meta: "Basert på J. Cash - I walk the line. Fremført på Tresfjordrevyen",
    body: `
     Vell du vete koffor i allti gjæng i grønt
Du synes væl  andre fargå e so skjønt
Å koffer tur’du i gjeng i kjeldræss hæle dan
Well, det e æn grunn ta at i gjeng i sa kle’an

I gjeng i grønt for frua ut på gar’n
So må trakke rundt i silo’n hæle da’n
I gjeng i grønt fer bondinj so he obetarte lån
Mæn han e nøddj å ha dæm, det e et jævla hån

Grønt for dæm so alder he slått gras
Eller hoppa rundt i høye mæ Lill Babs
Det handla om alt grønt som gjer mat i alle fat
Og alle so gjeng svoltne uten mat

Du trur væl årets oppgjær, det gjeng bra
Men staten sæ no agrakadabra
Og dermed set’n fattig at å lure på ka’n he
Mens æ’n væt at det bankjin so he det

I gjeng i grønt for single farmera
Som må på tv’n for å skaffe seg damer’a
Når sjåvet so er over og kjærlighæta dør
Set’n att like ænsom so før

I gjeng i grønt for dæm so he knekt a
Ryggen under slit på åkera
Fer dem so he et yrke Vår Herre glemte a
Men som skattevesne kom å ødela

I væt at ting vell alder bli hælt rætt
Te lags åt alle det he jo vore fætt
Men innte det at det blir bellegare brø
Vell du aldre se me i æn kjeldress so e rø

I skulle gått i smoking hæle da’n
gått rundt der å rett og slett gjett fan
men inntil det blir bedre tider hær på jor’n
går i i kjeldress,  innerst inni fjor’n

    `
  }
].map((text) => ({
  ...text,
  body: formatBody(text.body)
}));

const cardsGrid = document.querySelector("#cards-grid");
const filterButtons = document.querySelectorAll(".filter-button");
const cardTemplate = document.querySelector("#text-card-template");
const textDialog = document.querySelector("#text-dialog");

function openDialog(text) {
  document.querySelector("#dialog-type").textContent = text.label;
  document.querySelector("#dialog-title").textContent = text.title;
  document.querySelector("#dialog-meta").textContent = text.meta;

  const dialogBody = document.querySelector("#dialog-body");
  dialogBody.replaceChildren(
    ...text.body.map((paragraph) => {
      const element = document.createElement("p");
      element.textContent = paragraph;
      element.style.whiteSpace = "pre-line";
      return element;
    })
  );

  textDialog.showModal();
}

function renderCards(filter = "all") {
  const filteredTexts = texts.filter((text) => filter === "all" || text.type === filter);

  cardsGrid.replaceChildren(
    ...filteredTexts.map((text) => {
      const fragment = cardTemplate.content.cloneNode(true);
      fragment.querySelector(".text-card-type").textContent = text.type;
      fragment.querySelector(".text-card-title").textContent = text.title;
      fragment.querySelector(".text-card-intro").textContent = text.intro;
      fragment.querySelector(".text-card-tag").textContent = text.label;
      fragment.querySelector(".text-card-button").addEventListener("click", () => openDialog(text));
      return fragment;
    })
  );
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterButtons.forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    renderCards(button.dataset.filter);
  });
});

renderCards();