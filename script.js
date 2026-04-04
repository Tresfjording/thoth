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
    label: "Toby Keith",
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
    title: "Når rommet synger",
    type: "sangtekst",
    label: "Sangtekst",
    intro: "En tekst bygget rundt refreng, pauser og den stille spenningen mellom to stemmer.",
    meta: "Demo med akustisk arrangement",
    body: `
      Du sa rommet synger når vi tier stille nok, som om veggene bærer refrenger vi ikke våger å eie.

      Og jeg sto igjen i mellomtakten, med hendene fulle av ord som ville bli til lyd før de ble til mening.
    `
  },
  {
    title: "Kart over fravær",
    type: "annet",
    label: "Essayistisk notat",
    intro: "Et mer reflekterende format om minnets geografi og språkets forsøk på å holde fast.",
    meta: "Arbeidsnotat",
    body: `
      Fravær er ikke tomrom. Det er et kart uten tegnforklaring. Vi leser det likevel, med fingrene først og forstanden etterpå.

      Det som mangler, dytter oss ofte nærmere det som finnes. Derfor er også tap en måte å se på.
    `
  },
  {
    title: "Blå time over elva",
    type: "prosa",
    label: "Lyrisk prosa",
    intro: "En tekst om overgang, kveld og hvordan landskapet kan låne bort språk når eget språk ikke strekker til.",
    meta: "Publiseringsklar",
    body: `
      Elva bar kveldens siste farge som om den hadde fått ansvar for lyset alene. Alt annet trakk seg tilbake.

      Jeg tenkte at noen steder ikke ber om å bli forstått. De ber bare om at vi stanser lenge nok til å bli forandret.
    `
  },
  {
    title: "Før refrenget",
    type: "sangtekst",
    label: "Sangtekst",
    intro: "Et tekstutkast med tydelig versstruktur og et mer direkte, muntlig språk.",
    meta: "Arbeidstittel",
    body: `
      Jeg teller ikke dagene lenger, bare hvordan lyset flytter seg over kjøkkenbordet når du ikke er her.

      Hvis dette er stillhet, hvorfor høres den ut som noe som venter på et refreng?
    `
  },
  {
    title: "Marginer",
    type: "annet",
    label: "Fragment",
    intro: "Korte tekstfragmenter for tanker som ikke vil bli hele fortellinger, men likevel må få plass.",
    meta: "Serie under utvikling",
    body: `
      Noen setninger skal ikke avsluttes. De skal stå åpne, som vinduer i et hus man fortsatt bor i.

      Det er i marginene stemmen ofte er mest sann. Der den ikke prøver å bli sitert.
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