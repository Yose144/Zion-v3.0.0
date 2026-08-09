/* ZION V2 archive — unified top navigation + archive banner
   Injected on every V2 HTML page. Matches the intro page nav links. */
(function () {
  'use strict';

  if (document.getElementById('zion-v2-archive-banner')) return;

  var isEn = (document.documentElement.lang || '').indexOf('en') === 0 ||
             /(\/en\/|main-en|_en\.)/i.test(location.pathname);

  var t = isEn ? {
    archive: 'ARCHIVE',
    archiveInfo: 'This is the archived ZION v2 site. The current version is at',
    navBrand: 'ZION TerraNova®',
    market: 'Market',
    onboard: 'Onboard',
    about: 'About',
    docs: 'Docs',
    mine: 'Mine',
    amenti: 'Amenti',
    home: 'Home'
  } : {
    archive: 'ARCHIV',
    archiveInfo: 'Toto je archivní verze ZION v2. Aktuální verze je na',
    navBrand: 'ZION TerraNova®',
    market: 'Market',
    onboard: 'Onboard',
    about: 'O nás',
    docs: 'Docs',
    mine: 'Těžba',
    amenti: 'Amenti',
    home: 'Domů'
  };

  var css = document.createElement('style');
  css.textContent = [
    '#zion-v2-archive-banner {',
    '  position: sticky; top: 0; z-index: 100000;',
    '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;',
    '  background: linear-gradient(90deg, rgba(0,0,0,0.92) 0%, rgba(20,10,30,0.95) 50%, rgba(0,0,0,0.92) 100%);',
    '  border-bottom: 1px solid rgba(252,209,22,0.35);',
    '  color: #fff;',
    '  box-shadow: 0 4px 20px rgba(0,0,0,0.5);',
    '}',
    '#zion-v2-archive-top {',
    '  text-align: center; padding: 0.35rem 1rem; font-size: 0.78rem; color: #d4d4d4;',
    '  background: repeating-linear-gradient(45deg, rgba(252,209,22,0.08), rgba(252,209,22,0.08) 10px, rgba(228,30,43,0.08) 10px, rgba(228,30,43,0.08) 20px, rgba(7,137,48,0.08) 20px, rgba(7,137,48,0.08) 30px);',
    '}',
    '#zion-v2-archive-top a { color: #fcd116; text-decoration: underline; font-weight: 600; }',
    '#zion-v2-archive-top strong { color: #fcd116; letter-spacing: 0.05em; }',
    '#zion-v2-archive-nav {',
    '  display: flex; align-items: center; justify-content: space-between;',
    '  gap: 0.75rem; padding: 0.55rem 1rem; max-width: 1400px; margin: 0 auto;',
    '}',
    '#zion-v2-archive-nav .nav-brand { color: #fff; font-weight: 700; letter-spacing: 0.04em; text-decoration: none; font-size: 1rem; white-space: nowrap; }',
    '#zion-v2-archive-nav .nav-brand:hover { color: #fcd116; }',
    '#zion-v2-archive-nav .archive-pill {',
    '  background: rgba(252,209,22,0.15); border: 1px solid rgba(252,209,22,0.5); color: #fcd116;',
    '  padding: 0.18rem 0.55rem; border-radius: 999px; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.06em; white-space: nowrap;',
    '}',
    '#zion-v2-archive-nav ul { list-style: none; display: flex; align-items: center; gap: 0.25rem; margin: 0; padding: 0; }',
    '#zion-v2-archive-nav li { margin: 0; padding: 0; }',
    '#zion-v2-archive-nav a.nav-link {',
    '  display: block; padding: 0.45rem 0.65rem; border-radius: 4px; color: #f3f4f6;',
    '  text-decoration: none; font-size: 0.86rem; font-weight: 500; white-space: nowrap; transition: background 0.15s, color 0.15s;',
    '}',
    '#zion-v2-archive-nav a.nav-link:hover { background: rgba(255,255,255,0.1); color: #fcd116; }',
    '@media (max-width: 736px) {',
    '  #zion-v2-archive-nav { flex-wrap: wrap; }',
    '  #zion-v2-archive-nav ul { order: 3; width: 100%; overflow-x: auto; gap: 0.1rem; padding-bottom: 0.3rem; }',
    '  #zion-v2-archive-nav a.nav-link { padding: 0.4rem 0.55rem; font-size: 0.8rem; }',
    '  #zion-v2-archive-top { font-size: 0.72rem; }',
    '}'
  ].join(' ');
  document.head.appendChild(css);

  var banner = document.createElement('div');
  banner.id = 'zion-v2-archive-banner';
  banner.innerHTML =
    '<div id="zion-v2-archive-top"><strong>' + t.archive + ' v2</strong> — ' + t.archiveInfo +
    ' <a href="https://zionterranova.com" target="_blank" rel="noopener">zionterranova.com</a></div>' +
    '<nav id="zion-v2-archive-nav" aria-label="ZION">' +
      '<a class="nav-brand" href="https://zionterranova.com">' + t.navBrand + '</a>' +
      '<ul>' +
        '<li><a class="nav-link" href="https://market.zionterranova.com">' + t.market + '</a></li>' +
        '<li><a class="nav-link" href="https://app.zionterranova.com/onboard">' + t.onboard + '</a></li>' +
        '<li><a class="nav-link" href="https://zionterranova.com/#about">' + t.about + '</a></li>' +
        '<li><a class="nav-link" href="https://app.zionterranova.com/docs">' + t.docs + '</a></li>' +
        '<li><a class="nav-link" href="https://zionterranova.com/#mine">' + t.mine + '</a></li>' +
        '<li><a class="nav-link" href="https://zionterranova.com/#amenti">' + t.amenti + '</a></li>' +
      '</ul>' +
      '<span class="archive-pill">' + t.archive + ' v2</span>' +
    '</nav>';

  document.body.insertBefore(banner, document.body.firstChild);
})();
