/* ZION Intro floating menu, i18n, and background mode.
   Bottom-right hamburger that expands into a glass panel with
   section links, CZ/EN language toggle, and background switcher. */

(function () {
  'use strict';

  const i18n = {
    cs: {
      'menu.sections': `Sekce`,
      'menu.language': `Jazyk`,
      'menu.background': `Pozadí`,
      'menu.intro': `Intro`,
      'menu.zion': `ZION`,
      'menu.support': `Support`,
      'menu.contact': `Contact`,
      'menu.paths': `Cesty`,
      'menu.cz': `CZ`,
      'menu.en': `EN`,
      'menu.toggle.open': `Otevřít menu`,
      'menu.toggle.close': `Zavřít menu`,
      'bg.maintenance': `Maintenance Starfield`,
      'bg.planet-orbit': `Turquoise Core`,
      'bg.galaxy-core': `Galaxy Core`,
      'bg.desktop-agent': `Desktop Agent`,
      'bg.warp-speed': `Warp`,
      'hero.subtitle': `Multichain Dharma Ekosystém`,
      'nav.archive': `Archiv V2`,
      'intro.title': `Intro`,
      'intro.p1': `ZION je multichain ekosystém, který se dá ověřit, ne jen slíbit. Nový blok každých ~60 sekund, nativní Rust Proof-of-Work, otevřený kód a fee split zapsaný přímo v pravidlech sítě.`,
      'intro.p2': `Každý blok automaticky dělí odměnu: <strong>89 % těžaři, 5 % humanitárnímu fondu, 5 % fondu budoucnosti, 1 % se spálí</strong>. Není to slib firmy — je to matematika ověřitelná v blockchainu.`,
      'intro.p3': `Žádné ICO, žádný předprodej, žádné tajné alokace. Kdo chce ZION, těží ho, provozuje uzel, nebo ho získá na marketplace a DeFi.`,
      'zion.title': `ZION TerraNova®`,
      'zion.stable': `ZION v3.2.0 MAINNET STABLE · Runtime 3.2.0 "One Love"`,
      'zion.launch': `Official public launch: 31 December 2026`,
      'zion.info.1': `<strong>v3.2.0 MAINNET STABLE</strong> · Runtime 3.2.0 "One Love"`,
      'zion.info.2': `Celková nabídka 144B ZION · Fee Split 89/5/5/1 · Pool: rpc.zionterranova.com:8443`,
      'zion.info.3': `Oficiální veřejný launch: 31. prosince 2026`,
      'zion.launch.button': `Launch dApp`,
      'zion.github.button': `Github Zion-TerraNova`,
      'support.title': `Podpořte náš projekt`,
      'support.p1': `Vaše příspěvky nám pomáhají udržet projekt naživu a v rozvoji. Oceňujeme každý dar, bez ohledu na velikost. Děkujeme za vaši podporu!`,
      'support.invest.title': `Investiční příležitosti`,
      'support.invest.p1': `Pokud máte zájem podpořit náš projekt dlouhodobě, nabízíme také možnosti investice.`,
      'support.invest.p2': `Kontaktujte nás pro více informací o partnerství a investičních možnostech.`,
      'support.financial.title': `Finanční podpora`,
      'support.account.title': `Náš transparentní účet :`,
      'support.bitcoin.title': `Bitcoin účet`,
      'support.namaste': `Namaste`,
      'contact.title': `Kontakt & Formulář`,
      'contact.form.title': `Formulář`,
      'form.name.label': `Jméno`,
      'form.name.placeholder': `Vaše jméno`,
      'form.email.label': `E-mail`,
      'form.email.placeholder': `vy@example.com`,
      'form.category.label': `Kategorie`,
      'form.category.empty': `-`,
      'form.category.info': `Info & Konzultace`,
      'form.category.it': `It & Web vývojové služby`,
      'form.category.wood': `Dřevo a umění`,
      'form.category.invest': `Investice & Partnerství`,
      'form.priority.low': `Nízká`,
      'form.priority.high': `Vysoká`,
      'form.copy': `Poslat mi kopii`,
      'form.human': `Nejsem robot`,
      'form.message.label': `Zpráva`,
      'form.message.placeholder': `Napište svou zprávu`,
      'form.send': `Odeslat zprávu`,
      'form.reset': `Smazat`,
      'paths.title': `Tři cesty na palubu`,
      'paths.p1': `U brány do Oasis stojí dvě kněžky: <strong>Rádha</strong> a <strong>Elizabeth</strong>. Jedna drží sůl a med — druhá lucernu budoucnosti. Celý ZION se teď přesouvá do Oasis. Pod zahradou běží <strong>3.2.0 Mainnet Stable "One Love"</strong>. První OASIS preview je live, trvalý genesis bude potvrzen po 5měsíčním testu do Silvestra.`,
      'paths.observer.title': `1. Pozorovatel`,
      'paths.observer.p1': `Nic neinstaluj. Podívej se na živou síť v <a href="https://app.zionterranova.com/explorer" target="_blank" rel="noopener">exploreru</a>, prolistuj kód na <a href="https://github.com/Zion-TerraNova/" target="_blank" rel="noopener">GitHubu</a> a přečti si <a href="https://app.zionterranova.com/whitepapers" target="_blank" rel="noopener">whitepaper</a>.`,
      'paths.player.title': `2. Hráč`,
      'paths.player.p1': `Vstup do prvního <a href="https://oasis.zionterranova.com" target="_blank" rel="noopener">OASIS preview</a>. Vyber si avatara, projdi questy, sbírej XP za skutečné činy a postupuj od CL1 až po CL9 <em>On The Star</em>.`,
      'paths.builder.title': `3. Stavitel`,
      'paths.builder.p1': `Tvůj počítač může nést kus mostu. Stáhni <a href="https://app.zionterranova.com/download" target="_blank" rel="noopener">miner</a>, vytvoř peněženku a spusť uzel nebo těžbu — jedna binárka, interaktivní menu, GPU + CPU Boost.`,
      'social.facebook': `Facebook`,
      'social.instagram': `Instagram`
    },
    en: {
      'menu.sections': `Sections`,
      'menu.language': `Language`,
      'menu.background': `Background`,
      'menu.intro': `Intro`,
      'menu.zion': `ZION`,
      'menu.support': `Support`,
      'menu.contact': `Contact`,
      'menu.paths': `Paths`,
      'menu.cz': `CZ`,
      'menu.en': `EN`,
      'menu.toggle.open': `Open menu`,
      'menu.toggle.close': `Close menu`,
      'bg.maintenance': `Maintenance Starfield`,
      'bg.planet-orbit': `Turquoise Core`,
      'bg.galaxy-core': `Galaxy Core`,
      'bg.desktop-agent': `Desktop Agent`,
      'bg.warp-speed': `Warp`,
      'hero.subtitle': `Multichain Dharma Ecosystem`,
      'nav.archive': `Archive V2`,
      'intro.title': `Intro`,
      'intro.p1': `ZION is a multichain ecosystem you can verify, not just promise. A new block every ~60 seconds, native Rust Proof-of-Work, open source code and a fee split written directly into the network rules.`,
      'intro.p2': `Every block automatically splits the reward: <strong>89 % to miners, 5 % to the humanitarian fund, 5 % to the future fund, 1 % is burned</strong>. It is not a company promise — it is mathematics verifiable on the blockchain.`,
      'intro.p3': `No ICO, no presale, no secret allocations. Whoever wants ZION mines it, runs a node, or gets it on the marketplace and DeFi.`,
      'zion.title': `ZION TerraNova®`,
      'zion.stable': `ZION v3.2.0 MAINNET STABLE · Runtime 3.2.0 "One Love"`,
      'zion.launch': `Official public launch: 31 December 2026`,
      'zion.info.1': `<strong>v3.2.0 MAINNET STABLE</strong> · Runtime 3.2.0 "One Love"`,
      'zion.info.2': `Total Supply 144B ZION · Fee Split 89/5/5/1 · Pool: rpc.zionterranova.com:8443`,
      'zion.info.3': `Official public launch: 31 December 2026`,
      'zion.launch.button': `Launch dApp`,
      'zion.github.button': `Github Zion-TerraNova`,
      'support.title': `Support Our Project`,
      'support.p1': `Your contributions help us keep the project alive and thriving. We appreciate every donation, no matter how small. Thank you for your support!`,
      'support.invest.title': `Investment Opportunities`,
      'support.invest.p1': `If you are interested in supporting our project in the long term, we also offer opportunities for investment.`,
      'support.invest.p2': `Please contact us for more information about partnership and investment possibilities.`,
      'support.financial.title': `Financial Support`,
      'support.account.title': `Our Transparent Account :`,
      'support.bitcoin.title': `Bitcoin Account`,
      'support.namaste': `Namaste`,
      'contact.title': `Contact & Form`,
      'contact.form.title': `Form`,
      'form.name.label': `Name`,
      'form.name.placeholder': `Your name`,
      'form.email.label': `Email`,
      'form.email.placeholder': `you@example.com`,
      'form.category.label': `Category`,
      'form.category.empty': `-`,
      'form.category.info': `Info & Consultation`,
      'form.category.it': `It & Web Development Services`,
      'form.category.wood': `Wood Working & Arts`,
      'form.category.invest': `Investment & Partnerships`,
      'form.priority.low': `Low`,
      'form.priority.high': `High`,
      'form.copy': `Email me a copy`,
      'form.human': `Not a robot`,
      'form.message.label': `Message`,
      'form.message.placeholder': `Enter your message`,
      'form.send': `Send Message`,
      'form.reset': `Reset`,
      'paths.title': `Three ways on board`,
      'paths.p1': `At the gate to Oasis stand two priestesses: <strong>Rádha</strong> and <strong>Elizabeth</strong>. One holds salt and honey — the other the lantern of the future. All of ZION is now moving into Oasis. Beneath the garden runs <strong>3.2.0 Mainnet Stable "One Love"</strong>. The first OASIS preview is live; the permanent genesis will be confirmed after a five-month test run until New Year's Eve.`,
      'paths.observer.title': `1. Observer`,
      'paths.observer.p1': `Install nothing. Look at the live network in the <a href="https://app.zionterranova.com/explorer" target="_blank" rel="noopener">explorer</a>, browse the code on <a href="https://github.com/Zion-TerraNova/" target="_blank" rel="noopener">GitHub</a> and read the <a href="https://app.zionterranova.com/whitepapers" target="_blank" rel="noopener">whitepaper</a>.`,
      'paths.player.title': `2. Player`,
      'paths.player.p1': `Enter the first <a href="https://oasis.zionterranova.com" target="_blank" rel="noopener">OASIS preview</a>. Choose an avatar, complete quests, collect XP for real actions and progress from CL1 all the way to CL9 <em>On The Star</em>.`,
      'paths.builder.title': `3. Builder`,
      'paths.builder.p1': `Your computer can carry a piece of the bridge. Download the <a href="https://app.zionterranova.com/download" target="_blank" rel="noopener">miner</a>, create a wallet and run a node or mining — one binary, interactive menu, GPU + CPU Boost.`,
      'social.facebook': `Facebook`,
      'social.instagram': `Instagram`
    }
  };

  function $$(sel, ctx) {
    return Array.from((ctx || document).querySelectorAll(sel));
  }
  function $(sel, ctx) {
    return (ctx || document).querySelector(sel);
  }

  // --- i18n ---
  function applyLang(lang) {
    if (!i18n[lang]) lang = 'cs';
    document.documentElement.lang = lang;
    try { localStorage.setItem('zion_lang', lang); } catch (e) {}

    $$('[data-i18n]').forEach(function (el) {
      const key = el.getAttribute('data-i18n');
      if (i18n[lang][key] === undefined) return;

      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        const type = (el.type || '').toLowerCase();
        if (type === 'submit' || type === 'reset' || type === 'button') {
          el.value = i18n[lang][key];
        } else {
          el.placeholder = i18n[lang][key];
        }
      } else if (tag === 'BUTTON') {
        el.textContent = i18n[lang][key];
      } else {
        el.textContent = i18n[lang][key];
      }
    });

    $$('[data-i18n-html]').forEach(function (el) {
      const key = el.getAttribute('data-i18n-html');
      if (i18n[lang][key] !== undefined) el.innerHTML = i18n[lang][key];
    });

    // Active language button
    $$('.floating-menu-lang').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });

    // Toggle aria-label reflects open/close state
    const t = $('.floating-menu-toggle');
    if (t) {
      const isOpen = t.getAttribute('aria-expanded') === 'true';
      t.setAttribute('aria-label', i18n[lang][isOpen ? 'menu.toggle.close' : 'menu.toggle.open']);
    }
  }

  // --- Background modes (match website-v2.9 Observatory modes) ---
  const bgModes = ['maintenance', 'planet-orbit', 'galaxy-core', 'desktop-agent', 'warp-speed'];
  function applyBg(mode) {
    if (!bgModes.includes(mode)) mode = 'maintenance';
    document.body.classList.remove('bg-maintenance', 'bg-planet-orbit', 'bg-galaxy-core', 'bg-desktop-agent', 'bg-warp-speed');
    document.body.classList.add('bg-' + mode);
    try { localStorage.setItem('zion_bg', mode); } catch (e) {}

    $$('.floating-menu-bg').forEach(function (btn) {
      const isActive = btn.getAttribute('data-bg') === mode;
      btn.classList.toggle('active', isActive);
    });

    if (typeof window.setStarfieldMode === 'function') {
      window.setStarfieldMode(mode);
    }
  }

  // --- Floating menu ---
  const menu = $('.floating-menu');
  const toggle = $('.floating-menu-toggle');
  const panel = $('.floating-menu-panel');
  let isOpen = false;

  function setMenu(open) {
    isOpen = open;
    if (menu) menu.classList.toggle('open', open);
    if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (panel) panel.setAttribute('aria-hidden', open ? 'false' : 'true');
  }

  function closeMenu() { setMenu(false); }

  if (toggle) {
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      setMenu(!isOpen);
    });
  }

  if (menu) {
    menu.addEventListener('click', function (e) {
      e.stopPropagation();
    });
  }

  document.addEventListener('click', function () {
    if (isOpen) closeMenu();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) closeMenu();
  });

  // --- Section links (keep in sync with hash) ---
  const sectionLinks = $$('.floating-menu-item');

  function updateActiveSection() {
    const hash = (location.hash || '').replace(/^#/, '').trim();
    sectionLinks.forEach(function (link) {
      const target = link.getAttribute('data-target') || '';
      link.classList.toggle('active', hash && target === hash);
    });
  }

  sectionLinks.forEach(function (link) {
    link.addEventListener('click', function () {
      closeMenu();
    });
  });

  window.addEventListener('hashchange', updateActiveSection);
  window.addEventListener('load', updateActiveSection);
  if (document.readyState !== 'loading') updateActiveSection();
  else document.addEventListener('DOMContentLoaded', updateActiveSection);

  // --- Language buttons ---
  $$('.floating-menu-lang').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      const lang = btn.getAttribute('data-lang');
      if (lang) applyLang(lang);
    });
  });

  // --- Background buttons ---
  $$('.floating-menu-bg').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      const mode = btn.getAttribute('data-bg');
      if (mode) applyBg(mode);
    });
  });

  // --- Init from localStorage or defaults ---
  const savedLang = (function () { try { return localStorage.getItem('zion_lang'); } catch (e) { return null; } })();
  const savedBg = (function () { try { return localStorage.getItem('zion_bg'); } catch (e) { return null; } })();

  if (savedLang) applyLang(savedLang);
  applyBg(savedBg || 'maintenance');
})();
