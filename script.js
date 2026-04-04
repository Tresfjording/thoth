const texts = [
  {
    title: "Asfaltlys",
    type: "prosa",
    label: "Kortprosa",
    intro:
      "En nattlig bytekst om rytme, regn og alt som blir tydeligere når resten av byen sover.",
    meta: "Utkast, våren 2026",
    body: [
      "Regnet gjorde ikke byen mykere. Det gjorde den mer presis. Hver refleks kom tydeligere frem, som om mørket trengte vann for å vise hva det bar på.",
      "Jeg gikk uten mål, men ikke uten retning. Det finnes gater som vet mer om et menneske enn mennesket selv gjør. De lagrer steg. De svarer ikke, men de husker."
    ]
  },
  {
    title: "Når rommet synger",
    type: "sangtekst",
    label: "Sangtekst",
    intro:
      "En tekst bygget rundt refreng, pauser og den stille spenningen mellom to stemmer.",
    meta: "Demo med akustisk arrangement",
    body: [
      "Du sa rommet synger når vi tier stille nok, som om veggene bærer refrenger vi ikke våger å eie.",
      "Og jeg sto igjen i mellomtakten, med hendene fulle av ord som ville bli til lyd før de ble til mening."
    ]
  },
  {
    title: "Kart over fravær",
    type: "annet",
    label: "Essayistisk notat",
    intro:
      "Et mer reflekterende format om minnets geografi og språkets forsøk på å holde fast.",
    meta: "Arbeidsnotat",
    body: [
      "Fravær er ikke tomrom. Det er et kart uten tegnforklaring. Vi leser det likevel, med fingrene først og forstanden etterpå.",
      "Det som mangler, dytter oss ofte nærmere det som finnes. Derfor er også tap en måte å se på."
    ]
  },
  {
    title: "Blå time over elva",
    type: "prosa",
    label: "Lyrisk prosa",
    intro:
      "En tekst om overgang, kveld og hvordan landskapet kan låne bort språk når eget språk ikke strekker til.",
    meta: "Publiseringsklar",
    body: [
      "Elva bar kveldens siste farge som om den hadde fått ansvar for lyset alene. Alt annet trakk seg tilbake.",
      "Jeg tenkte at noen steder ikke ber om å bli forstått. De ber bare om at vi stanser lenge nok til å bli forandret."
    ]
  },
  {
    title: "Før refrenget",
    type: "sangtekst",
    label: "Sangtekst",
    intro:
      "Et tekstutkast med tydelig versstruktur og et mer direkte, muntlig språk.",
    meta: "Arbeidstittel",
    body: [
      "Jeg teller ikke dagene lenger, bare hvordan lyset flytter seg over kjøkkenbordet når du ikke er her.",
      "Hvis dette er stillhet, hvorfor høres den ut som noe som venter på et refreng?"
    ]
  },
  {
    title: "Marginer",
    type: "annet",
    label: "Fragment",
    intro:
      "Korte tekstfragmenter for tanker som ikke vil bli hele fortellinger, men likevel må få plass.",
    meta: "Serie under utvikling",
    body: [
      "Noen setninger skal ikke avsluttes. De skal stå åpne, som vinduer i et hus man fortsatt bor i.",
      "Det er i marginene stemmen ofte er mest sann. Der den ikke prøver å bli sitert."
    ]
  }
];

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