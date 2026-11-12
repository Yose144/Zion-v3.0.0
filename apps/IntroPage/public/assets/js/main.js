/*
   ZION Intro — page behaviour (vanilla, no jQuery).

   Replaces the HTML5UP "Dimension" panel engine (jquery + util + breakpoints +
   browser + the old main.js, ~110 KB). The page is a normal scrolling document
   now, so all this script does is progressive enhancement:

     1. mark the nav entry of the section that is currently on screen
     2. fade sections in as they enter the viewport
     3. keep the year in the footer fresh

   Everything works without this file: anchors, hash links and back/forward are
   native browser behaviour.
*/
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 1. Current section in the nav ─────────────────────────────────────── */
  var links = Array.prototype.slice.call(
    document.querySelectorAll('#header nav ul li a[href^="#"]')
  );
  var byId = {};
  links.forEach(function (a) {
    var id = a.getAttribute('href').slice(1);
    if (id) byId[id] = a;
  });

  var sections = Object.keys(byId)
    .map(function (id) { return document.getElementById(id); })
    .filter(Boolean);

  function setCurrent(id) {
    links.forEach(function (a) {
      var on = a.getAttribute('href') === '#' + id;
      a.classList.toggle('is-current', on);
      if (on) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }

  if (sections.length && 'IntersectionObserver' in window) {
    var seen = new Map();
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          seen.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0);
        });
        var best = '';
        var bestRatio = 0;
        seen.forEach(function (ratio, id) {
          if (ratio > bestRatio) { bestRatio = ratio; best = id; }
        });
        if (best) setCurrent(best);
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: [0, 0.25, 0.5, 1] }
    );
    sections.forEach(function (s) { io.observe(s); });
  }

  /* ── 2. Reveal on scroll ────────────────────────────────────────────────── */
  var articles = Array.prototype.slice.call(document.querySelectorAll('#main > article'));
  if (!reduceMotion && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('js-reveal');
    articles.forEach(function (el) { el.classList.add('reveal'); });

    var revealer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add('is-in');
          revealer.unobserve(e.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
    );
    articles.forEach(function (el) { revealer.observe(el); });
  }

  /* ── 3. Footer year ─────────────────────────────────────────────────────── */
  var copy = document.querySelector('.footer-copyright');
  if (copy) {
    var year = String(new Date().getFullYear());
    copy.innerHTML = copy.innerHTML.replace(/(\u00a9\s*)\d{4}/, '$1' + year);
  }
})();
