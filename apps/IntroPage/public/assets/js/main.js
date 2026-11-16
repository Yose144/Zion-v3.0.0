/* ZION Intro — tab navigation for the Dimension-style landing page.
 *
 * Vanilla JS replacement for the old HTML5UP `main.js` (which required jQuery +
 * util.js + browser.min.js + breakpoints.min.js — none of those files ship with
 * this project any more). Behaviour kept intentionally identical:
 *   - `#main`/articles stay hidden until a hash matches an article id
 *   - nav links open panels, hashchange / back / forward keep working
 *   - close button, Escape and a click outside the panel close it
 *   - `is-preload` is removed once the page has loaded
 */

(function () {
  'use strict';

  var body = document.body;
  var main = document.getElementById('main');
  var header = document.getElementById('header');
  var footer = document.getElementById('footer');

  // Even when the landing markup is missing, never leave the page in the
  // "preload" state (it hides the whole header).
  function finishPreload() {
    body.classList.remove('is-preload');
  }

  if (!main) {
    finishPreload();
    return;
  }

  var articles = Array.prototype.slice.call(main.querySelectorAll(':scope > article'));
  var navLinks = Array.prototype.slice.call(
    document.querySelectorAll('#header nav a[href^="#"]')
  );

  function articleFor(id) {
    if (!id) return null;
    for (var i = 0; i < articles.length; i++) {
      if (articles[i].id === id) return articles[i];
    }
    return null;
  }

  function setActiveLink(id) {
    navLinks.forEach(function (link) {
      if (id && link.getAttribute('href') === '#' + id) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  function show(id, initial) {
    var article = articleFor(id);
    if (!article) return false;

    articles.forEach(function (item) {
      item.classList.toggle('active', item === article);
    });
    body.classList.add('is-article-visible');
    setActiveLink(id);

    if (!initial) {
      // Let the browser lay the panel out before restoring the scroll position.
      window.requestAnimationFrame(function () {
        window.scrollTo(0, 0);
      });
    } else {
      window.scrollTo(0, 0);
    }
    return true;
  }

  function hide(pushState) {
    if (!body.classList.contains('is-article-visible')) return;

    articles.forEach(function (item) {
      item.classList.remove('active');
    });
    body.classList.remove('is-article-visible');
    setActiveLink(null);

    if (pushState) {
      history.pushState(null, '', location.pathname + location.search);
    }
    window.scrollTo(0, 0);
  }

  function syncFromHash(initial) {
    var id = '';
    try {
      id = decodeURIComponent((location.hash || '').replace(/^#/, ''));
    } catch (e) {
      id = '';
    }
    if (!id || !show(id, initial)) hide(false);
  }

  // ── Close buttons inside every panel ─────────────────────────────────────
  articles.forEach(function (article) {
    if (article.querySelector(':scope > .close')) return;
    var close = document.createElement('div');
    close.className = 'close';
    close.setAttribute('role', 'button');
    close.setAttribute('tabindex', '0');
    close.setAttribute('aria-label', 'Zavřít panel');
    close.textContent = 'Close';
    close.addEventListener('click', function (event) {
      event.stopPropagation();
      hide(true);
    });
    close.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        hide(true);
      }
    });
    article.appendChild(close);

    // Clicks inside a panel must not bubble to the "click outside" handler.
    article.addEventListener('click', function (event) {
      event.stopPropagation();
    });
  });

  // ── Top navigation ───────────────────────────────────────────────────────
  if (navLinks.length % 2 === 0) {
    var nav = header && header.querySelector('nav');
    if (nav) {
      nav.classList.add('use-middle');
      var middle = nav.querySelectorAll('li')[navLinks.length / 2];
      if (middle) middle.classList.add('is-middle');
    }
  }

  navLinks.forEach(function (link) {
    link.addEventListener('click', function (event) {
      var id = (link.getAttribute('href') || '').replace(/^#/, '');
      if (!articleFor(id)) return; // dropdown parent etc. — handled by intro-tabs.js
      event.preventDefault();
      event.stopPropagation();
      history.pushState(null, '', '#' + id);
      show(id);
    });
  });

  // ── Close on Escape or click outside the panel ───────────────────────────
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' || event.keyCode === 27) {
      if (body.classList.contains('is-article-visible')) hide(true);
    }
  });

  document.addEventListener('click', function (event) {
    if (!body.classList.contains('is-article-visible')) return;
    var target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('#main')) return; // inside the panel
    if (target.closest('.floating-menu')) return; // language / background menu
    if (target.closest('a[href^="#"]')) return; // nav link handles itself
    hide(true);
  });

  // ── History / anchors ────────────────────────────────────────────────────
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.addEventListener('hashchange', function () { syncFromHash(false); });
  window.addEventListener('popstate', function () { syncFromHash(false); });

  // ── Initial state ────────────────────────────────────────────────────────
  articles.forEach(function (article) {
    article.classList.remove('active');
  });
  body.classList.remove('is-article-visible');

  if (location.hash && location.hash !== '#') {
    syncFromHash(true);
  }

  if (document.readyState === 'complete') {
    setTimeout(finishPreload, 100);
  } else {
    window.addEventListener('load', function () {
      setTimeout(finishPreload, 100);
    });
  }

  // Safety net: if `load` never fires (blocked asset), still reveal the page.
  setTimeout(finishPreload, 2500);
})();
