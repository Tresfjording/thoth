/**
 * works.js — Loads works.json and populates the index and individual work pages.
 *
 * On index.html:  renders a list of all works.
 * On les.html:    reads ?id=<work-id> from the URL and renders that work.
 */

(function () {
  'use strict';

  var INDEX_LIST  = document.getElementById('works-list');
  var WORK_CONTENT = document.getElementById('work-content');

  /**
   * Format a work type + year into a short meta string.
   */
  function formatMeta(work) {
    return work.type + (work.year ? ', ' + work.year : '');
  }

  /**
   * Escape HTML to prevent XSS when inserting user-controlled strings.
   */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Render body text: treat double newlines as paragraph breaks and
   * single newlines as <br> (poetry line breaks).
   */
  function renderBody(text) {
    var paragraphs = text.split(/\n\n+/);
    return paragraphs.map(function (para) {
      return '<p>' + escapeHtml(para).replace(/\n/g, '<br>') + '</p>';
    }).join('\n');
  }

  /**
   * Populate the works list on index.html.
   */
  function renderIndex(works) {
    if (!INDEX_LIST) return;
    INDEX_LIST.innerHTML = works.map(function (work) {
      return '<li>' +
        '<a class="work-link" href="les.html?id=' + encodeURIComponent(work.id) + '">' +
          '<span class="work-title">' + escapeHtml(work.title) + '</span>' +
          '<span class="work-meta">' + escapeHtml(formatMeta(work)) + '</span>' +
        '</a>' +
        '</li>';
    }).join('');
  }

  /**
   * Render a single work on les.html.
   */
  function renderWork(work) {
    if (!WORK_CONTENT) return;

    document.title = 'Thoth – ' + work.title;

    var metaHtml =
      '<span>' + escapeHtml(work.type) + '</span>' +
      (work.year ? '<span>' + escapeHtml(String(work.year)) + '</span>' : '');

    WORK_CONTENT.innerHTML =
      '<header>' +
        '<h1>' + escapeHtml(work.title) + '</h1>' +
        '<p class="work-info">' + metaHtml + '</p>' +
      '</header>' +
      '<div class="work-body">' + renderBody(work.body) + '</div>';
  }

  /**
   * Show a simple error message inside the work content area.
   */
  function renderError(message) {
    if (WORK_CONTENT) {
      WORK_CONTENT.innerHTML = '<p style="color:var(--muted)">' + escapeHtml(message) + '</p>';
    }
  }

  /**
   * Return the value of a query-string parameter by name.
   */
  function getParam(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  /**
   * Fetch works.json and hand off to the appropriate renderer.
   */
  fetch('works.json')
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Klarte ikke å laste inn tekster.');
      }
      return response.json();
    })
    .then(function (works) {
      if (INDEX_LIST) {
        renderIndex(works);
      } else if (WORK_CONTENT) {
        var id = getParam('id');
        var work = works.find(function (w) { return w.id === id; });
        if (work) {
          renderWork(work);
        } else {
          renderError('Teksten ble ikke funnet.');
        }
      }
    })
    .catch(function (err) {
      renderError(err.message || 'En feil oppstod.');
    });
}());
