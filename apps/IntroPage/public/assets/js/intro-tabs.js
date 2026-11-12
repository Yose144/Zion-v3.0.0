/* ZION Intro — floating menu, language switch and background mode.

   i18n model
   ──────────
   maintenance.html is authored in Czech, so the Czech page needs *no* extra
   bytes: the original markup is captured the first time a visitor switches
   away from Czech and restored when they switch back. Every other language is
   a ~3 KB JSON file fetched from /i18n/<lang>.json on demand, which replaced
   the ~33 KB of dictionaries that used to ship with this script on every load.

   Nothing here is required for the page to be readable: sections, anchors and
   content work without JavaScript. */
(function () {
  'use strict';

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };

  var LANGS = { cs: 1, en: 1, es: 1, pt: 1, fr: 1 };
  var I18N_VERSION = '2';
  var dicts = {};            // lang -> dictionary
  var originals = new Map(); // element -> authored innerHTML
  var pending = {};          // lang -> Promise

  /* ── Language ─────────────────────────────────────────────────────────── */

  function textFor(lang, key) {
    var d = dicts[lang];
    return d && d[key] !== undefined ? d[key] : undefined;
  }

  function loadDict(lang) {
    if (!pending[lang]) {
      pending[lang] = fetch('/i18n/' + lang + '.json?v=' + I18N_VERSION, {
        credentials: 'same-origin',
      })
        .then(function (r) {
          if (!r.ok) throw new Error('i18n ' + r.status);
          return r.json();
        })
        .then(function (json) { dicts[lang] = json; return json; })
        .catch(function () {
          dicts[lang] = null;
          return null;
        });
    }
    return pending[lang];
  }

  function writeLang(lang) {
    try {
      localStorage.setItem('zion_lang', lang);
      localStorage.setItem('zion-lang', lang);
    } catch (e) { /* private mode */ }
    var host = location.hostname;
    var domain =
      host === 'zionterranova.com' || host.endsWith('.zionterranova.com')
        ? '; domain=.zionterranova.com'
        : '';
    document.cookie =
      'zion_locale=' + lang + '; path=/; max-age=31536000; samesite=lax' + domain;
  }

  function applyDict(lang) {
    // [data-i18n] owns the text, [data-i18n-html] may contain markup. Both are
    // written as innerHTML from our own dictionaries so authored <strong>/<a>
    // survive — the old code used textContent and flattened them.
    $$('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var value = textFor(lang, key);
      if (value === undefined) return;
      if (!originals.has(el)) originals.set(el, el.innerHTML);
      var tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (/^(submit|reset|button)$/i.test(el.type)) el.value = value;
        else el.placeholder = value;
      } else {
        el.innerHTML = value;
      }
    });

    $$('[data-i18n-html]').forEach(function (el) {
      var value = textFor(lang, el.getAttribute('data-i18n-html'));
      if (value === undefined) return;
      if (!originals.has(el)) originals.set(el, el.innerHTML);
      el.innerHTML = value;
    });

    $$('.floating-menu-lang').forEach(function (btn) {
      var on = btn.getAttribute('data-lang') === lang;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    var toggle = $('.floating-menu-toggle');
    if (toggle) {
      var label = textFor(
        lang,
        toggle.getAttribute('aria-expanded') === 'true'
          ? 'menu.toggle.close'
          : 'menu.toggle.open'
      );
      if (label) toggle.setAttribute('aria-label', label);
    }
  }

  function restoreOriginals() {
    originals.forEach(function (html, el) { el.innerHTML = html; });
    $$('.floating-menu-lang').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === 'cs');
      btn.setAttribute('aria-pressed', btn.getAttribute('data-lang') === 'cs' ? 'true' : 'false');
    });
  }

  function applyLang(lang) {
    if (!LANGS[lang]) lang = 'cs';
    document.documentElement.lang = lang;
    writeLang(lang);

    if (lang === 'cs') {
      restoreOriginals();
      return;
    }

    loadDict(lang).then(function (dict) {
      if (!dict) return;
      if (document.documentElement.lang !== lang) return; // superseded
      applyDict(lang);
    });
  }

  /* ── Background modes (mirror of website-v2.9 Observatory modes) ──────── */

  var BG_MODES = ['maintenance', 'planet-orbit', 'galaxy-core', 'desktop-agent', 'warp-speed'];

  function applyBg(mode) {
    if (BG_MODES.indexOf(mode) === -1) mode = 'maintenance';
    BG_MODES.forEach(function (m) { document.body.classList.remove('bg-' + m); });
    document.body.classList.add('bg-' + mode);
    try { localStorage.setItem('zion_bg', mode); } catch (e) { /* ignore */ }

    $$('.floating-menu-bg').forEach(function (btn) {
      var on = btn.getAttribute('data-bg') === mode;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    if (typeof window.setStarfieldMode === 'function') window.setStarfieldMode(mode);
  }

  /* ── Floating menu ────────────────────────────────────────────────────── */

  var menu = $('.floating-menu');
  var toggle = $('.floating-menu-toggle');
  var panel = $('.floating-menu-panel');
  var isOpen = false;

  function setMenu(open) {
    isOpen = open;
    if (menu) menu.classList.toggle('open', open);
    if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (panel) panel.setAttribute('aria-hidden', open ? 'false' : 'true');
  }

  if (toggle) {
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      setMenu(!isOpen);
    });
  }
  if (menu) menu.addEventListener('click', function (e) { e.stopPropagation(); });
  document.addEventListener('click', function () { if (isOpen) setMenu(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) setMenu(false);
  });

  /* ── Section links get an active state from the scroll position ───────── */

  var sectionLinks = $$('.floating-menu-item');

  function updateActiveSection() {
    var hash = (location.hash || '').replace(/^#/, '').trim();
    sectionLinks.forEach(function (link) {
      var target = link.getAttribute('data-target') || '';
      link.classList.toggle('active', !!hash && target === hash);
    });
  }

  sectionLinks.forEach(function (link) {
    link.addEventListener('click', function () { setMenu(false); });
  });
  window.addEventListener('hashchange', updateActiveSection);
  updateActiveSection();

  /* ── Language + background buttons ────────────────────────────────────── */

  $$('.floating-menu-lang').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      var lang = btn.getAttribute('data-lang');
      if (lang) applyLang(lang);
    });
  });

  $$('.floating-menu-bg').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      var mode = btn.getAttribute('data-bg');
      if (mode) applyBg(mode);
    });
  });

  /* ── Nav dropdown (hover/focus is CSS; .open is for touch + keyboard) ─── */

  var dropItems = $$('.has-dropdown');

  function closeDropdowns(except) {
    dropItems.forEach(function (li) {
      if (li === except) return;
      li.classList.remove('open');
      var p = li.querySelector('.dropdown-parent');
      if (p) p.setAttribute('aria-expanded', 'false');
    });
  }

  dropItems.forEach(function (li) {
    var parent = li.querySelector('.dropdown-parent');
    if (!parent) return;

    parent.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var open = !li.classList.contains('open');
      closeDropdowns(li);
      li.classList.toggle('open', open);
      parent.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    li.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeDropdowns();
        parent.focus();
      }
    });
  });

  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('.nav-dropdown a')) {
      closeDropdowns();
      return;
    }
    if (e.target.closest && e.target.closest('.has-dropdown')) return;
    closeDropdowns();
  });

  /* ── Initial state ────────────────────────────────────────────────────── */

  var savedLang = (function () {
    var m = document.cookie.match(/(?:^|; )zion_locale=([^;]+)/);
    if (m && LANGS[decodeURIComponent(m[1])]) return decodeURIComponent(m[1]);
    try {
      var ls = localStorage.getItem('zion-lang') || localStorage.getItem('zion_lang');
      return LANGS[ls] ? ls : null;
    } catch (e) { return null; }
  })();

  var savedBg = (function () {
    try { return localStorage.getItem('zion_bg'); } catch (e) { return null; }
  })();

  if (savedLang && savedLang !== 'cs') applyLang(savedLang);
  applyBg(savedBg || 'maintenance');
})();
