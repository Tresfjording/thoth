const form = document.querySelector("#manuscript-form");
const fields = Object.fromEntries(
  [...form.elements]
    .filter((element) => element.name)
    .map((element) => [element.name, element])
);
const bodyEditor = document.querySelector("#body-editor");
const bookPage = document.querySelector("#book-page");
const wordCount = document.querySelector("#word-count");
const saveStatus = document.querySelector("#save-status");
const storageKey = "thoth-manuscript";

const starterText = {
  title: "Skriv her",
  intro: "En tekst begynner ofte som en liten setning som nekter å forsvinne.",
  author: "",
  chapter: "Kapittel 1",
  body: "<p>Lim inn teksten din her.</p><p>Hvert tomrom mellom avsnitt blir bevart i bokvisningen.</p>"
};

const allowedTags = new Set(["P", "BR", "STRONG", "B", "EM", "I", "U", "H2", "H3", "BLOCKQUOTE", "UL", "OL", "LI"]);

function sanitizeHtml(html) {
  const documentFragment = new DOMParser().parseFromString(html, "text/html");
  documentFragment.body.querySelectorAll("*").forEach((element) => {
    if (!allowedTags.has(element.tagName)) {
      element.replaceWith(...element.childNodes);
      return;
    }
    [...element.attributes].forEach((attribute) => element.removeAttribute(attribute.name));
  });
  return documentFragment.body.innerHTML;
}

function setBodyHtml(html) {
  const cleanHtml = sanitizeHtml(html);
  bodyEditor.innerHTML = cleanHtml;
  fields.body.value = cleanHtml;
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function getManuscript() {
  return Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, field.value]));
}

function setManuscript(manuscript) {
  Object.entries(fields).forEach(([name, field]) => {
    if (name !== "body") field.value = manuscript[name] ?? "";
  });
  setBodyHtml(manuscript.body || "");
  renderPreview();
}

function renderPreview() {
  const manuscript = getManuscript();
  const cleanBody = sanitizeHtml(manuscript.body);
  bookPage.replaceChildren();

  const chapter = document.createElement("p");
  chapter.className = "preview-chapter";
  chapter.textContent = manuscript.chapter || "Arbeidsnotat";
  bookPage.append(chapter);

  const title = document.createElement("h2");
  title.textContent = manuscript.title || "Uten tittel";
  bookPage.append(title);

  if (manuscript.intro.trim()) {
    const intro = document.createElement("p");
    intro.className = "preview-intro";
    intro.textContent = manuscript.intro;
    bookPage.append(intro);
  }

  const body = document.createElement("div");
  body.className = "preview-body";
  body.innerHTML = cleanBody;
  bookPage.append(body);

  if (manuscript.author.trim()) {
    const author = document.createElement("p");
    author.className = "preview-author";
    author.textContent = manuscript.author;
    bookPage.append(author);
  }

  const words = body.textContent.trim() ? body.textContent.trim().split(/\s+/).length : 0;
  wordCount.textContent = `${words} ord`;
  localStorage.setItem(storageKey, JSON.stringify(manuscript));
  saveStatus.textContent = "Lagret lokalt";
}

document.querySelectorAll("input, textarea").forEach((field) => {
  field.addEventListener("input", renderPreview);
});

bodyEditor.addEventListener("input", () => {
  fields.body.value = sanitizeHtml(bodyEditor.innerHTML);
  renderPreview();
});

document.querySelector("#import-button").addEventListener("click", () => {
  const lines = bodyEditor.innerText.trim().split("\n");
  if (lines[0]) fields.title.value = lines.shift().trim();
  while (lines[0] === "") lines.shift();
  if (lines.length) fields.intro.value = lines.shift().trim();
  while (lines[0] === "") lines.shift();
  setBodyHtml(lines.join("\n").trim().split(/\n\s*\n/).map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`).join(""));
  renderPreview();
});

document.querySelector("#clear-button").addEventListener("click", () => {
  setManuscript({ title: "", intro: "", author: "", chapter: "", body: "" });
  saveStatus.textContent = "Tomt manus";
});

document.querySelector("#clear-body-button").addEventListener("click", () => {
  setBodyHtml("");
  renderPreview();
  saveStatus.textContent = "Teksten er tømt";
});

document.querySelector("#publish-button").addEventListener("click", async () => {
  const publishButton = document.querySelector("#publish-button");
  const publishTokenField = document.querySelector("#publish-token");
  const publishToken = publishTokenField.value.trim();
  if (!publishToken) {
    publishTokenField.focus();
    saveStatus.textContent = "Skriv inn publiseringsnøkkelen først";
    return;
  }

  publishButton.disabled = true;
  saveStatus.textContent = "Publiserer arbeidskopi ...";

  try {
    const response = await fetch("publish.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: publishToken, manuscript: getManuscript() })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Publisering mislyktes.");
    const publicUrl = new URL("../arbeidskopi.html?v=" + Date.now(), window.location.href).href;
    saveStatus.innerHTML = `<a href="${publicUrl}" target="_blank" rel="noopener">Åpne publisert arbeidskopi</a>`;
  } catch (error) {
    const message = error instanceof TypeError
      ? "Publisering krever at Thoth er åpnet fra tresfjording.no, ikke som lokal fil."
      : error.message;
    saveStatus.textContent = message;
  } finally {
    publishButton.disabled = false;
  }
});

document.querySelector("#upload-text").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const fileText = await file.text();
  const isHtml = /\.html?$/i.test(file.name) || file.type === "text/html";
  setBodyHtml(isHtml ? fileText : fileText.split(/\n\s*\n/).map((paragraph) => (
    `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`
  )).join(""));
  renderPreview();
  saveStatus.textContent = `Lastet opp: ${file.name}`;
  event.target.value = "";
});

const storedManuscript = JSON.parse(localStorage.getItem(storageKey) || "null");
setManuscript(storedManuscript || starterText);
