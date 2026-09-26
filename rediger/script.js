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
const authStatus = document.querySelector("#auth-status");
const logoutLink = document.querySelector("#logout-link");
const readModeButton = document.querySelector("#read-mode-button");
const requestedChapter = new URLSearchParams(window.location.search).get("chapter") || window.location.hash.replace(/^#/, "");
const storageKey = "thoth-manuscript";
const SETTINGS_STORAGE_KEY = "thoth-book-settings";
const CHAPTER_STORAGE_KEY = "thoth-chapter-list";

const starterText = {
  title: "Skriv her",
  intro: "En tekst begynner ofte som en liten setning som nekter å forsvinne.",
  author: "",
  chapter: "Kapittel 1",
  body: "<p>Lim inn teksten din her.</p><p>Hvert tomrom mellom avsnitt blir bevart i bokvisningen.</p>"
};

const allowedTags = new Set(["P", "BR", "STRONG", "B", "EM", "I", "U", "H3", "BLOCKQUOTE", "UL", "OL", "LI"]);

function normalizeSectionHeadings(html) {
  return html
    .replace(/<\s*h2\b/gi, "<h3")
    .replace(/<\s*\/\s*h2\s*>/gi, "</h3>")
    .replace(/<\s*h2\s*\>/gi, "<h3>");
}

function sanitizeHtml(html) {
  const normalizedHtml = normalizeSectionHeadings(html);
  const documentFragment = new DOMParser().parseFromString(normalizedHtml, "text/html");
  documentFragment.body.querySelectorAll("*").forEach((element) => {
    if (!allowedTags.has(element.tagName)) {
      element.replaceWith(...element.childNodes);
      return;
    }
    [...element.attributes].forEach((attribute) => element.removeAttribute(attribute.name));
  });
  return documentFragment.body.innerHTML;
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "kapittel";
}

function buildTableOfContents(bodyHtml) {
  const documentFragment = new DOMParser().parseFromString(bodyHtml, "text/html");
  const headings = [...documentFragment.body.querySelectorAll("h3")];

  if (!headings.length) {
    return { toc: null, bodyHtml: documentFragment.body.innerHTML };
  }

  const seenIds = new Map();
  headings.forEach((heading, index) => {
    const rawTitle = heading.textContent.trim() || `Kapittel ${index + 1}`;
    let slug = slugify(rawTitle);
    const count = seenIds.get(slug) || 0;
    seenIds.set(slug, count + 1);
    heading.id = count === 0 ? slug : `${slug}-${count + 1}`;
  });

  const nav = document.createElement("nav");
  nav.className = "preview-toc";
  const list = document.createElement("ul");

  headings.forEach((heading) => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = `#${heading.id}`;
    link.textContent = heading.textContent.trim();
    item.append(link);
    list.append(item);
  });

  nav.append(list);
  return { toc: nav, bodyHtml: documentFragment.body.innerHTML };
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

function syncChapterJumpList() {
  const chapterJumpList = document.querySelector("#chapter-jump-list");
  if (!chapterJumpList) return;

  const headings = [...bodyEditor.querySelectorAll("h3")];
  chapterJumpList.replaceChildren();

  const addNavigationItem = ({ label, level, onClick }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chapter-jump-item";
    if (level === 1) button.classList.add("chapter-jump-item--chapter");
    if (level === 2) button.classList.add("chapter-jump-item--chapter");
    if (level === 3) button.classList.add("chapter-jump-item--section");
    button.textContent = label;
    button.title = label;
    if (onClick) button.addEventListener("click", onClick);
    return button;
  };

  const addListEntry = ({ label, level, onClick }) => {
    const item = document.createElement("div");
    item.className = "chapter-jump-item-wrap";

    const button = addNavigationItem({ label, level, onClick });
    item.append(button);
    chapterJumpList.append(item);
  };

  const bookTitle = (fields.title.value || "Boktittel").trim() || "Boktittel";
  addListEntry({
    label: bookTitle,
    level: 1,
    onClick: () => {
      fields.title.focus();
      fields.title.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });

  if (!headings.length) {
    const emptyState = document.createElement("span");
    emptyState.className = "chapter-jump-empty";
    emptyState.textContent = "Ingen underkapitler ennå";
    chapterJumpList.append(emptyState);
    return;
  }

  headings.forEach((heading) => {
    const label = (heading.textContent || "Avsnitt").trim() || "Avsnitt";
    addListEntry({
      label,
      level: heading.tagName === "H3" ? 3 : 2,
      onClick: () => {
        heading.scrollIntoView({ behavior: "smooth", block: "start" });
        bodyEditor.focus();
      }
    });
  });
}

async function loadBookSettings() {
  try {
    const response = await fetch("book-settings-api.php", { cache: "no-store" });
    if (!response.ok) return null;
    const payload = await response.json();
    const settings = payload.settings || {};
    const titleField = document.querySelector("#title");
    const chapterField = document.querySelector("#chapter");
    const isPlaceholderTitle = !titleField || !titleField.value.trim() || titleField.value.trim() === "Skriv her";
    const isPlaceholderChapter = !chapterField || !chapterField.value.trim() || chapterField.value.trim() === starterText.chapter;

    if (settings.book_title && isPlaceholderTitle) {
      if (titleField) titleField.value = settings.book_title;
      const storedManuscript = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (storedManuscript && (!storedManuscript.title || storedManuscript.title === "Skriv her")) {
        storedManuscript.title = settings.book_title;
        localStorage.setItem(storageKey, JSON.stringify(storedManuscript));
      }
    }

    if (settings.chapter_label && isPlaceholderChapter && chapterField) {
      chapterField.value = settings.chapter_label;
    }

    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    return settings;
  } catch (error) {
    return null;
  }
}

function buildChapterHtmlFromEntries(chapters) {
  const entries = Array.isArray(chapters) ? chapters : [];
  return entries
    .filter((chapter) => chapter && (typeof chapter.title === "string" || typeof chapter.body === "string"))
    .map((chapter) => {
      const title = (chapter.title || "").trim();
      const body = (chapter.body || "").trim();
      const headingHtml = title ? `<h3>${escapeHtml(title)}</h3>` : "";
      const bodyHtml = body ? `<p>${escapeHtml(body).replace(/\n/g, "<br>")}</p>` : "";
      return `${headingHtml}${bodyHtml}`;
    })
    .join("");
}

async function loadSavedChapters() {
  try {
    const response = await fetch("chapter-manager-api.php", { cache: "no-store" });
    if (!response.ok) return [];
    const payload = await response.json();
    const chapters = Array.isArray(payload.chapters) ? payload.chapters : [];
    localStorage.setItem(CHAPTER_STORAGE_KEY, JSON.stringify(chapters));

    const storedManuscript = JSON.parse(localStorage.getItem(storageKey) || "null");
    const currentBody = storedManuscript && typeof storedManuscript.body === "string" ? storedManuscript.body.trim() : "";
    if (chapters.length && !currentBody) {
      const chapterHtml = buildChapterHtmlFromEntries(chapters);
      if (chapterHtml.trim()) {
        setBodyHtml(chapterHtml);
        renderPreview();
      }
    }

    return chapters;
  } catch (error) {
    return [];
  }
}

function renderPreview() {
  const manuscript = getManuscript();
  const savedSettings = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || "null");
  if (savedSettings && savedSettings.book_title && (!manuscript.title || manuscript.title === "Skriv her")) {
    manuscript.title = savedSettings.book_title;
  }

  if (savedSettings && savedSettings.chapter_label && (!manuscript.chapter || manuscript.chapter === starterText.chapter)) {
    manuscript.chapter = savedSettings.chapter_label;
  }

  const cleanBody = sanitizeHtml(manuscript.body);
  const { toc, bodyHtml } = buildTableOfContents(cleanBody);
  bookPage.replaceChildren();

  const chapter = document.createElement("p");
  chapter.className = "preview-chapter";
  chapter.textContent = manuscript.chapter || savedSettings?.chapter_label || "Arbeidsnotat";
  bookPage.append(chapter);

  const title = document.createElement("h1");
  title.className = "preview-title";
  title.textContent = manuscript.title || "Uten tittel";
  bookPage.append(title);

  if (manuscript.intro.trim()) {
    const intro = document.createElement("p");
    intro.className = "preview-intro";
    intro.textContent = manuscript.intro;
    bookPage.append(intro);
  }

  if (toc) {
    bookPage.append(toc);
  }

  const body = document.createElement("div");
  body.className = "preview-body";
  body.innerHTML = bodyHtml;
  bookPage.append(body);

  if (manuscript.author.trim()) {
    const author = document.createElement("p");
    author.className = "preview-author";
    author.textContent = manuscript.author;
    bookPage.append(author);
  }

  syncChapterJumpList();

  if (requestedChapter) {
    const chapterTarget = bookPage.querySelector('[id="' + requestedChapter + '"]');
    if (chapterTarget) {
      requestAnimationFrame(() => {
        chapterTarget.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
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

readModeButton.addEventListener("click", () => {
  document.body.classList.toggle("reading-mode");
  const isReadingMode = document.body.classList.contains("reading-mode");
  readModeButton.textContent = isReadingMode ? "Tilbake til redigering" : "Lesemodus";
  readModeButton.classList.toggle("button-primary", isReadingMode);
  readModeButton.classList.toggle("button-secondary", !isReadingMode);
  saveStatus.textContent = isReadingMode ? "Lesemodus aktiv" : "Lagret lokalt";
});

document.querySelector("#clear-body-button").addEventListener("click", () => {
  setBodyHtml("");
  renderPreview();
  saveStatus.textContent = "Teksten er tømt";
});

document.querySelector("#delete-entry-button").addEventListener("click", () => {
  setBodyHtml("");
  renderPreview();
  saveStatus.textContent = "Innslaget er slettet";
});

document.querySelector("#book-settings-button").addEventListener("click", () => {
  window.location.href = "book-settings.php";
});

document.querySelector("#chapter-manager-button").addEventListener("click", () => {
  window.location.href = "chapter-manager.php";
});

document.querySelector("#publish-button").addEventListener("click", async () => {
  const publishButton = document.querySelector("#publish-button");

  try {
    const sessionResponse = await fetch("session-status.php", { cache: "no-store" });
    if (!sessionResponse.ok) {
      saveStatus.textContent = "Du må logge inn før du kan publisere.";
      window.location.href = "login.php?next=" + encodeURIComponent("index.php");
      return;
    }

    const status = await sessionResponse.json();
    if (!status.isAdmin) {
      saveStatus.textContent = "Bare administrator kan publisere. Lesere har kun lesetilgang.";
      return;
    }
  } catch (error) {
    saveStatus.textContent = "Kunne ikke verifisere innlogging. Logg inn og prøv igjen.";
    return;
  }

  publishButton.disabled = true;
  saveStatus.textContent = "Publiserer arbeidskopi ...";

  try {
    const response = await fetch("publish.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manuscript: getManuscript() })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Publisering mislyktes.");
    const publicUrl = "https://www.tresfjording.no/thoth/arbeidskopi.html?v=" + Date.now();
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

async function updateAuthStatus() {
  if (!authStatus) return;

  const publishButton = document.querySelector("#publish-button");

  try {
    const response = await fetch("session-status.php", { cache: "no-store" });
    const status = await response.json();
    if (!response.ok || !status.loggedIn) {
      authStatus.textContent = "Ikke innlogget";
      if (logoutLink) logoutLink.style.display = "none";
      if (publishButton) {
        publishButton.style.display = "none";
      }
      return;
    }

    const displayName = status.displayName || status.username || "Bruker";
    authStatus.textContent = `Innlogget som ${displayName}`;
    const canPublish = !!status.isAdmin;

    if (publishButton) {
      publishButton.style.display = canPublish ? "inline-flex" : "none";
      publishButton.disabled = false;
      publishButton.title = canPublish ? "Publiser arbeidskopi" : "Kun administrator kan publisere";
    }

    if (logoutLink) logoutLink.style.display = "inline";
  } catch (error) {
    authStatus.textContent = "Sikkerhetsstatus ukjent";
    if (logoutLink) logoutLink.style.display = "none";
    if (publishButton) {
      publishButton.style.display = "none";
    }
  }
}

const storedManuscript = JSON.parse(localStorage.getItem(storageKey) || "null");
setManuscript(storedManuscript || starterText);
updateAuthStatus();
loadBookSettings();
loadSavedChapters();
