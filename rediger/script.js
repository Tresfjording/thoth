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
const POST_ID_KEY = "thoth-post-id";
const newPostId = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
};
const getPostId = () => {
  let id = localStorage.getItem(POST_ID_KEY);
  if (!id) {
    id = newPostId();
    localStorage.setItem(POST_ID_KEY, id);
  }
  return id;
};

const starterText = {
  title: "Skriv her",
  intro: "En tekst begynner ofte som en liten setning som nekter å forsvinne.",
  author: "",
  chapter: "Kapittel 1",
  body: "<p>Lim inn teksten din her.</p><p>Hvert tomrom mellom avsnitt blir bevart i visningen.</p>"
};

const allowedTags = new Set(["P", "BR", "STRONG", "B", "EM", "I", "U", "H3", "BLOCKQUOTE", "UL", "OL", "LI", "IMG", "FIGURE", "FIGCAPTION"]);
const uploadedImagePattern = /^(?:https?:\/\/[^/\s"'<>]+)?\/?[\w/.-]*innlegg\/bilder\/[\w-]+\.(?:jpg|jpeg|png|gif|webp)$/i;
const dataImagePattern = /^data:image\/(?:png|jpeg|gif|webp);base64,/i;
const figureClassPattern = /^img-(?:wrap|align-(?:left|center|right)|size-(?:25|50|75|100))$/;
let skippedWordImages = 0;

function createFigureElement(doc, src, alt) {
  const figure = doc.createElement("figure");
  figure.className = "img-align-center img-size-75";
  const image = doc.createElement("img");
  image.setAttribute("src", src);
  image.setAttribute("alt", alt || "");
  figure.append(image);
  return figure;
}

function normalizeSectionHeadings(html) {
  return html
    .replace(/<\s*h[1-6]\b/gi, "<h3")
    .replace(/<\s*\/\s*h[1-6]\s*>/gi, "</h3>");
}

function sanitizeHtml(html, keepDataImages = false) {
  const normalizedHtml = normalizeSectionHeadings(html);
  const documentFragment = new DOMParser().parseFromString(normalizedHtml, "text/html");
  documentFragment.body.querySelectorAll("*").forEach((element) => {
    if (element.tagName === "FIGURE") {
      const classes = [...element.classList].filter((name) => figureClassPattern.test(name));
      [...element.attributes].forEach((attribute) => element.removeAttribute(attribute.name));
      if (classes.length) element.className = classes.join(" ");
      return;
    }
    if (element.tagName === "IMG") {
      const src = element.getAttribute("src") || "";
      const alt = element.getAttribute("alt") || "";
      if (!uploadedImagePattern.test(src) && !(keepDataImages && dataImagePattern.test(src))) {
        element.remove();
        return;
      }
      [...element.attributes].forEach((attribute) => element.removeAttribute(attribute.name));
      element.setAttribute("src", src);
      element.setAttribute("alt", alt);
      return;
    }
    if (!allowedTags.has(element.tagName)) {
      element.replaceWith(...element.childNodes);
      return;
    }
    [...element.attributes].forEach((attribute) => element.removeAttribute(attribute.name));
  });

  if (!keepDataImages) {
    documentFragment.body.querySelectorAll("img").forEach((image) => {
      if (image.closest("figure")) return;
      const figure = createFigureElement(documentFragment, image.getAttribute("src"), image.getAttribute("alt"));
      const parent = image.parentElement;
      if (parent && parent.tagName === "P" && parent.childNodes.length === 1) {
        parent.replaceWith(figure);
      } else if (parent && parent.tagName === "P") {
        parent.after(figure);
        image.remove();
      } else {
        image.replaceWith(figure);
      }
    });
  }
  return documentFragment.body.innerHTML;
}

function convertWordHtml(html) {
  const parsedHtml = new DOMParser().parseFromString(html, "text/html");

  const convertNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent || "");
    }
    if (!(node instanceof Element)) return null;

    if (node.tagName === "IMG") {
      const src = node.getAttribute("src") || "";
      if (/^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(src)) {
        const image = document.createElement("img");
        image.setAttribute("src", src);
        return image;
      }
      skippedWordImages += 1;
      return null;
    }

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
  return sanitizeHtml([...fragment.childNodes].map((node) => node.outerHTML || escapeHtml(node.textContent || "")).join(""), true);
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
    if (onClick) {
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", onClick);
    }
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
        bodyEditor.focus({ preventScroll: true });
        const caret = document.createRange();
        caret.selectNodeContents(heading);
        caret.collapse(true);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(caret);
        // Egen rulling, med plass til den faste toppbaren
        const headerHeight = document.querySelector(".site-header")?.offsetHeight || 0;
        const top = heading.getBoundingClientRect().top + window.scrollY - headerHeight - 48;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
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

  const pastedImage = [...clipboard.files].find((file) => file.type.startsWith("image/"));
  if (pastedImage && !clipboard.getData("text/plain").trim()) {
    event.preventDefault();
    uploadAndInsertImage(pastedImage);
    return;
  }

  const html = clipboard.getData("text/html");
  skippedWordImages = 0;
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
  if (/<img\b/i.test(pastedHtml)) uploadPastedDataImages();
  if (skippedWordImages) {
    saveStatus.textContent = `${skippedWordImages} bilde(r) fra Word kunne ikke limes inn sammen med teksten. Kopier bildet alene i Word og lim det inn, eller bruk Bilde-knappen.`;
  }
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

function toggleHeadingAtSelection() {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !bodyEditor.contains(selection.anchorNode)) return;

  let block = selection.anchorNode;
  while (block && block.parentNode !== bodyEditor) block = block.parentNode;
  if (!block || block.nodeType !== Node.ELEMENT_NODE) return;

  const offset = selection.anchorOffset;
  const anchor = selection.anchorNode;
  const replacement = document.createElement(block.tagName === "H3" ? "p" : "h3");
  replacement.append(...block.childNodes);
  block.replaceWith(replacement);

  const range = document.createRange();
  if (replacement.contains(anchor)) {
    range.setStart(anchor, Math.min(offset, anchor.nodeType === Node.TEXT_NODE ? anchor.length : anchor.childNodes.length));
  } else {
    range.setStart(replacement, 0);
  }
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  bodyEditor.dispatchEvent(new Event("input", { bubbles: true }));
}

const imageButton = document.querySelector("#image-button");
const imageInput = document.querySelector("#image-input");
let imageRange = null;
imageButton.addEventListener("mousedown", (event) => {
  event.preventDefault();
  const selection = window.getSelection();
  imageRange = selection?.rangeCount && bodyEditor.contains(selection.anchorNode) ? selection.getRangeAt(0).cloneRange() : null;
});
imageButton.addEventListener("click", () => imageInput.click());
imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  imageInput.value = "";
  if (file) uploadAndInsertImage(file);
});

async function uploadImageFile(file) {
  const formData = new FormData();
  formData.append("image", file, file.name || "bilde.png");
  const response = await fetch("upload-image.php", { method: "POST", body: formData });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Opplasting av bildet mislyktes.");
  return result.url;
}

async function uploadAndInsertImage(file) {
  if (!imageRange) {
    const selection = window.getSelection();
    imageRange = selection?.rangeCount && bodyEditor.contains(selection.anchorNode) ? selection.getRangeAt(0).cloneRange() : null;
  }
  saveStatus.textContent = "Laster opp bilde ...";
  try {
    const url = await uploadImageFile(file);
    if (imageRange) {
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(imageRange);
    }
    imageRange = null;
    const alt = (file.name || "bilde").replace(/\.[^.]+$/, "").replace(/["<>&]/g, "");
    insertBlocksAtSelection(`<figure class="img-align-center img-size-75"><img src="${url}" alt="${alt}"></figure><p><br></p>`);
    bodyEditor.dispatchEvent(new Event("input", { bubbles: true }));
    saveStatus.textContent = "Bildet er satt inn. Klikk på det for størrelse, plassering og bildetekst.";
  } catch (error) {
    saveStatus.textContent = error instanceof TypeError
      ? "Bildeopplasting krever at Thoth kjører på en server med PHP."
      : error.message;
  }
}

async function uploadPastedDataImages() {
  const images = [...bodyEditor.querySelectorAll('img[src^="data:image/"]')];
  let failed = 0;
  for (const image of images) {
    try {
      const blob = await (await fetch(image.src)).blob();
      const extension = (blob.type.split("/")[1] || "png").replace("jpeg", "jpg");
      const url = await uploadImageFile(new File([blob], `word-bilde.${extension}`, { type: blob.type }));
      const figure = createFigureElement(document, url, "");
      const parent = image.parentElement;
      if (parent && parent.tagName === "P" && parent.parentElement === bodyEditor && parent.childNodes.length === 1) {
        parent.replaceWith(figure);
      } else {
        let block = image;
        while (block.parentNode && block.parentNode !== bodyEditor) block = block.parentNode;
        image.remove();
        block.after(figure);
      }
    } catch (error) {
      failed += 1;
      image.remove();
    }
  }
  bodyEditor.dispatchEvent(new Event("input", { bubbles: true }));
  if (failed) saveStatus.textContent = `${failed} bilde(r) fra Word kunne ikke lastes opp.`;
}

const imageToolbar = document.createElement("div");
imageToolbar.className = "image-toolbar";
imageToolbar.hidden = true;
imageToolbar.innerHTML = `
  <div class="image-toolbar-row"><span>Størrelse</span>${[25, 50, 75, 100].map((size) => `<button type="button" data-size="${size}">${size} %</button>`).join("")}</div>
  <div class="image-toolbar-row"><span>Plassering</span>
    <button type="button" data-align="left">Venstre</button>
    <button type="button" data-align="center">Midt</button>
    <button type="button" data-align="right">Høyre</button>
  </div>
  <div class="image-toolbar-row"><span>Tekst</span><button type="button" data-wrap="toggle">Tekst rundt bildet</button></div>
  <input type="text" class="image-caption-input" placeholder="Bildetekst (valgfritt)" maxlength="300">
  <div class="image-toolbar-row"><button type="button" data-action="remove">Fjern bilde</button></div>`;
document.body.append(imageToolbar);
const captionInput = imageToolbar.querySelector(".image-caption-input");
let selectedFigure = null;

function positionImageToolbar() {
  if (!selectedFigure) return;
  const rect = selectedFigure.getBoundingClientRect();
  const width = imageToolbar.offsetWidth;
  const height = imageToolbar.offsetHeight;
  imageToolbar.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
  imageToolbar.style.top = `${Math.max(90, Math.min(rect.bottom + 8, window.innerHeight - height - 8))}px`;
}

function updateToolbarState() {
  const has = (prefix, value) => selectedFigure.classList.contains(prefix + value);
  imageToolbar.querySelectorAll("[data-size]").forEach((button) => button.classList.toggle("is-active", has("img-size-", button.dataset.size)));
  imageToolbar.querySelectorAll("[data-align]").forEach((button) => button.classList.toggle("is-active", has("img-align-", button.dataset.align)));
  const wrapButton = imageToolbar.querySelector("[data-wrap]");
  const canWrap = !selectedFigure.classList.contains("img-align-center") && !selectedFigure.classList.contains("img-size-100");
  wrapButton.disabled = !canWrap;
  wrapButton.title = canWrap ? "" : "Velg Venstre eller Høyre og en størrelse under 100 % for å bryte tekst rundt bildet";
  wrapButton.classList.toggle("is-active", canWrap && selectedFigure.classList.contains("img-wrap"));
}

function selectFigure(figure) {
  deselectFigure();
  selectedFigure = figure;
  figure.classList.add("img-selected");
  captionInput.value = figure.querySelector("figcaption")?.textContent || "";
  imageToolbar.hidden = false;
  updateToolbarState();
  positionImageToolbar();
}

function deselectFigure() {
  selectedFigure?.classList.remove("img-selected");
  selectedFigure = null;
  imageToolbar.hidden = true;
}

function notifyImageChange() {
  bodyEditor.dispatchEvent(new Event("input", { bubbles: true }));
  requestAnimationFrame(positionImageToolbar);
}

bodyEditor.addEventListener("click", (event) => {
  const image = event.target instanceof Element ? event.target.closest("img") : null;
  if (!image || !bodyEditor.contains(image)) return;
  let figure = image.closest("figure");
  if (!figure) {
    figure = createFigureElement(document, image.getAttribute("src"), image.getAttribute("alt"));
    const parent = image.parentElement;
    if (parent && parent.tagName === "P" && parent.childNodes.length === 1) parent.replaceWith(figure);
    else image.replaceWith(figure);
    notifyImageChange();
  }
  selectFigure(figure);
});

document.addEventListener("mousedown", (event) => {
  if (!selectedFigure || !(event.target instanceof Element)) return;
  if (imageToolbar.contains(event.target) || event.target.closest("#body-editor img")) return;
  deselectFigure();
});

imageToolbar.addEventListener("mousedown", (event) => {
  if (event.target.closest("button")) event.preventDefault();
});

imageToolbar.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || !selectedFigure) return;
  const setClass = (prefix, value) => {
    [...selectedFigure.classList].filter((name) => name.startsWith(prefix)).forEach((name) => selectedFigure.classList.remove(name));
    selectedFigure.classList.add(prefix + value);
  };
  if (button.dataset.size) setClass("img-size-", button.dataset.size);
  if (button.dataset.align) setClass("img-align-", button.dataset.align);
  if (button.dataset.wrap) selectedFigure.classList.toggle("img-wrap");
  if (button.dataset.action === "remove") {
    selectedFigure.remove();
    deselectFigure();
    notifyImageChange();
    return;
  }
  updateToolbarState();
  notifyImageChange();
});

captionInput.addEventListener("input", () => {
  if (!selectedFigure) return;
  let caption = selectedFigure.querySelector("figcaption");
  if (!captionInput.value.trim()) {
    caption?.remove();
  } else {
    if (!caption) {
      caption = document.createElement("figcaption");
      selectedFigure.append(caption);
    }
    caption.textContent = captionInput.value;
  }
  notifyImageChange();
});

window.addEventListener("scroll", positionImageToolbar, { passive: true });
window.addEventListener("resize", positionImageToolbar);

const headingButton = document.querySelector("#heading-button");
headingButton.addEventListener("mousedown", (event) => event.preventDefault());
headingButton.addEventListener("click", toggleHeadingAtSelection);
bodyEditor.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.altKey && event.key === "3") {
    event.preventDefault();
    toggleHeadingAtSelection();
  }
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
  localStorage.setItem(POST_ID_KEY, newPostId());
  saveStatus.textContent = "Nytt innlegg startet";
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
      body: JSON.stringify({ manuscript: getManuscript(), post_id: getPostId() })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Publisering mislyktes.");
          if (result.post_id) localStorage.setItem(POST_ID_KEY, result.post_id);
          const publicUrl = "https://www.tresfjording.no/thoth/lese.html?innlegg=" + encodeURIComponent(result.post_id) + "&v=" + Date.now();
          saveStatus.innerHTML = `<a href="${publicUrl}" target="_blank" rel="noopener">Åpne publisert innlegg</a>`;
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
    const postsButton = document.querySelector("#posts-button");
    if (postsButton) postsButton.style.display = canPublish ? "inline-flex" : "none";

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

const postsDialog = document.createElement("div");
postsDialog.className = "posts-dialog";
postsDialog.hidden = true;
postsDialog.innerHTML = `
  <div class="posts-dialog-box" role="dialog" aria-modal="true" aria-label="Mine innlegg">
    <div class="posts-dialog-head"><strong>Publiserte innlegg</strong><button type="button" data-close>Lukk</button></div>
    <p class="posts-dialog-status"></p>
    <ul class="posts-dialog-list"></ul>
  </div>`;
document.body.append(postsDialog);
const postsList = postsDialog.querySelector(".posts-dialog-list");
const postsStatus = postsDialog.querySelector(".posts-dialog-status");

async function loadPostsDialog() {
  postsList.replaceChildren();
  postsStatus.textContent = "Laster ...";
  try {
    const response = await fetch(`../innlegg/index.json?v=${Date.now()}`, { cache: "no-store" });
    const posts = response.ok ? await response.json() : [];
    postsStatus.textContent = posts.length ? "" : "Ingen publiserte innlegg ennå.";
    posts.forEach((post) => {
      const item = document.createElement("li");
      const label = document.createElement("span");
      const date = post.published_at ? new Date(post.published_at).toLocaleDateString("nb-NO") : "";
      label.textContent = `${post.title || post.chapter || "Uten tittel"}${date ? ` (${date})` : ""}`;
      if (post.id === getPostId()) label.textContent += " – åpent nå";
      const open = document.createElement("button");
      open.type = "button";
      open.textContent = "Åpne";
      open.addEventListener("click", () => openPublishedPost(post));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Slett";
      remove.className = "danger";
      remove.addEventListener("click", () => deletePublishedPost(post));
      item.append(label, open, remove);
      postsList.append(item);
    });
  } catch (error) {
    postsStatus.textContent = "Kunne ikke hente innleggene.";
  }
}

async function openPublishedPost(post) {
  if (!confirm("Åpne dette innlegget? Teksten i editoren nå erstattes (publiserte innlegg er upåvirket).")) return;
  postsStatus.textContent = "Åpner innlegget ...";
  try {
    const response = await fetch(`posts-api.php?id=${encodeURIComponent(post.id)}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Kunne ikke åpne innlegget.");
    let manuscript = result.manuscript;
    if (!manuscript) {
      const page = await fetch(`../innlegg/${encodeURIComponent(post.id)}.html?v=${Date.now()}`, { cache: "no-store" });
      if (!page.ok) throw new Error("Fant ikke det publiserte innlegget.");
      const doc = new DOMParser().parseFromString(await page.text(), "text/html");
      const smalls = doc.querySelectorAll("main small");
      manuscript = {
        title: doc.querySelector("main h1")?.textContent || post.title || "",
        intro: doc.querySelector("main > p > em")?.textContent || "",
        chapter: smalls[0]?.textContent || "",
        author: smalls.length > 1 ? smalls[smalls.length - 1].textContent : "",
        body: doc.querySelector("article")?.innerHTML || ""
      };
    }
    localStorage.setItem(POST_ID_KEY, post.id);
    setManuscript({
      title: manuscript.title || "",
      intro: manuscript.intro || "",
      author: manuscript.author || "",
      chapter: manuscript.chapter || "",
      body: manuscript.body || ""
    });
    postsDialog.hidden = true;
    saveStatus.textContent = "Innlegget er åpnet. Trykk Publiser for å oppdatere det.";
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    postsStatus.textContent = error.message;
  }
}

async function deletePublishedPost(post) {
  if (!confirm(`Slette «${post.title || "Uten tittel"}» fra nettstedet? Dette kan ikke angres.`)) return;
  try {
    const response = await fetch("posts-api.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id: post.id })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Kunne ikke slette innlegget.");
    await loadPostsDialog();
  } catch (error) {
    postsStatus.textContent = error.message;
  }
}

document.querySelector("#posts-button").addEventListener("click", () => {
  postsDialog.hidden = false;
  loadPostsDialog();
});
postsDialog.addEventListener("click", (event) => {
  if (event.target === postsDialog || event.target.closest("[data-close]")) postsDialog.hidden = true;
});
updateAuthStatus();
loadBookSettings();
loadSavedChapters();
