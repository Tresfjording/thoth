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
  body: "<p>Lim inn teksten din her.</p><p>Hvert tomrom mellom avsnitt blir bevart i visningen.</p>"
};

const allowedTags = new Set(["P", "BR", "STRONG", "B", "EM", "I", "U", "H3", "BLOCKQUOTE", "UL", "OL", "LI"]);

function normalizeSectionHeadings(html) {
  return html
    .replace(/<\s*h[1-6]\b/gi, "<h3")
    .replace(/<\s*\/\s*h[1-6]\s*>/gi, "</h3>");
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

function convertWordHtml(html) {
  const parsedHtml = new DOMParser().parseFromString(html, "text/html");

  const convertNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent || "");
    }
    if (!(node instanceof Element)) return null;

    const sourceTag = node.tagName.toLowerCase();
    const classNames = node.getAttribute("class") || "";
    const style = node.getAttribute("style") || "";
    const headingParagraph = sourceTag === "p"
      && node.textContent.trim().length <= 200
      && (
        /(^|\s)(MsoHeading[1-6]|Heading[1-6])(\s|$)/i.test(classNames)
        || /mso-outline-level\s*:\s*[1-6]\b/i.test(style)
      );
    const wordListParagraph = sourceTag === "p" && (
      /\bMsoListParagraph/i.test(classNames) || /mso-list\s*:/i.test(style)
    );
    const heading = (/^h[1-6]$/.test(sourceTag) && node.textContent.trim().length <= 200) || headingParagraph;
    const tagName = heading ? "h3" : wordListParagraph ? "li" : ({
      div: "div",
      p: "p",
      br: "br",
      strong: "strong",
      b: "strong",
      em: "em",
      i: "em",
      u: "u",
      blockquote: "blockquote",
      ul: "ul",
      ol: "ol",
      li: "li"
    }[sourceTag] || (/^h[1-6]$/.test(sourceTag) ? "p" : "span"));
    const element = document.createElement(tagName);
    const marker = wordListParagraph
      ? node.querySelector('span[style*="mso-list:Ignore"], span[style*="mso-list: Ignore"]')
      : null;
    const markerText = marker?.textContent.trim() || "";
    const listType = /^\d+[\.)]$|^[a-z][\.)]$/i.test(markerText) ? "ol" : "ul";

    node.childNodes.forEach((child) => {
      if (child !== marker) {
        const converted = convertNode(child);
        if (converted) element.append(converted);
      }
    });

    if (wordListParagraph) {
      element.dataset.wordListType = listType;
    }

    const isBold = /^(bold|bolder)$/i.test(style.match(/font-weight\s*:\s*([^;]+)/i)?.[1]?.trim() || "")
      || Number(style.match(/font-weight\s*:\s*(\d+)/i)?.[1]) >= 600;
    const isItalic = /font-style\s*:\s*italic/i.test(style);
    const isUnderline = /text-decoration(?:-line)?\s*:[^;]*underline/i.test(style);
    const wrappers = [];
    if (isBold && !heading && !["strong", "b"].includes(sourceTag)) wrappers.push("strong");
    if (isItalic && !["em", "i"].includes(sourceTag)) wrappers.push("em");
    if (isUnderline && sourceTag !== "u") wrappers.push("u");

    let result = element;
    wrappers.forEach((wrapperTag) => {
      const wrapper = document.createElement(wrapperTag);
      wrapper.append(result);
      result = wrapper;
    });
    if (wrappers.length && ["p", "h3", "li", "div", "blockquote", "ul", "ol"].includes(tagName)) {
      const content = document.createDocumentFragment();
      while (element.firstChild) content.append(element.firstChild);
      let wrappedContent = content;
      wrappers.forEach((wrapperTag) => {
        const wrapper = document.createElement(wrapperTag);
        wrapper.append(wrappedContent);
        wrappedContent = wrapper;
      });
      element.append(wrappedContent);
      return element;
    }
    return result;
  };

  const fragment = document.createDocumentFragment();
  [...parsedHtml.body.childNodes].forEach((node) => {
    const converted = convertNode(node);
    if (converted) fragment.append(converted);
  });

  const groupWordLists = (parent) => {
    [...parent.children].forEach(groupWordLists);
    let node = parent.firstChild;
    while (node) {
      if (node.nodeType !== Node.ELEMENT_NODE || !node.matches("li[data-word-list-type]")) {
        node = node.nextSibling;
        continue;
      }

      const listType = node.dataset.wordListType;
      const list = document.createElement(listType);
      parent.insertBefore(list, node);
      while (node?.nodeType === Node.ELEMENT_NODE
        && node.matches(`li[data-word-list-type="${listType}"]`)) {
        const next = node.nextSibling;
        node.removeAttribute("data-word-list-type");
        list.append(node);
        node = next;
      }
    }
  };
  groupWordLists(fragment);
  return sanitizeHtml([...fragment.childNodes].map((node) => node.outerHTML || escapeHtml(node.textContent || "")).join(""));
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

  const bookTitle = (fields.title.value || "Tittel på innlegg").trim() || "Overskrift";
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
    emptyState.textContent = "Ingen avsnitt ennå";
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

bodyEditor.addEventListener("paste", (event) => {
  const clipboard = event.clipboardData;
  if (!clipboard) return;

  const html = clipboard.getData("text/html");
  const plainText = clipboard.getData("text/plain").replace(/\r\n?/g, "\n");
  const richText = html ? convertWordHtml(html) : "";
  const pastedText = plainText.trim();
  const pastedHtml = richText || (pastedText ? pastedText.split(/\n\s*\n/).map((paragraph) => (
      `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`
    )).join("") : "");
  if (!pastedHtml) return;

  event.preventDefault();
  bodyEditor.focus();
  insertBlocksAtSelection(pastedHtml);
  bodyEditor.dispatchEvent(new Event("input", { bubbles: true }));
});

function insertBlocksAtSelection(html) {
  const selection = window.getSelection();
  const selectedRange = selection?.rangeCount ? selection.getRangeAt(0) : null;
  const range = selectedRange && bodyEditor.contains(selectedRange.commonAncestorContainer)
    ? selectedRange
    : document.createRange();
  if (range !== selectedRange) {
    range.selectNodeContents(bodyEditor);
    range.collapse(false);
  } else {
    range.deleteContents();
  }

  const fragment = range.createContextualFragment(html);
  const lastNode = fragment.lastChild;

  // Overskrifter og lister må ligge direkte i editoren, ikke inni et avsnitt
  let block = range.startContainer;
  while (block && block.parentNode !== bodyEditor) block = block.parentNode;

  if (block && block !== bodyEditor) {
    if (!block.textContent.trim()) {
      block.replaceWith(fragment);
    } else {
      const tail = document.createRange();
      tail.setStart(range.startContainer, range.startOffset);
      tail.setEnd(block, block.childNodes.length);
      const rest = block.cloneNode(false);
      rest.append(tail.extractContents());
      block.after(rest);
      block.after(fragment);
      if (!rest.textContent.trim()) rest.remove();
      if (!block.textContent.trim()) block.remove();
    }
  } else {
    range.insertNode(fragment);
  }

  if (lastNode && selection) {
    const caret = document.createRange();
    caret.setStartAfter(lastNode);
    caret.collapse(true);
    selection.removeAllRanges();
    selection.addRange(caret);
  }
}

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
