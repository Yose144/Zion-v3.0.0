const hamburger = document.querySelector(".hamburger");
const navMenu = document.querySelector(".nav-menu");
const navBranding = document.querySelector(".nav-branding-2");

const documentLanguage = (document.documentElement?.lang || '').toLowerCase();
const isEnglishLocale = documentLanguage.startsWith('en');
const isGenesisV2 = window.location.pathname.includes('/G2/');

const pathParts = window.location.pathname.split('/').filter(Boolean);
const v2Index = pathParts.indexOf('V2');
const segmentsAfterV2 = v2Index >= 0 ? pathParts.slice(v2Index + 1) : [];

// Spočítáme hloubku adresářů za V2 (bez názvu souboru)
// Např. /V2/main.html -> 0 adresářů -> './'
// Např. /V2/G2/index.html -> 1 adresář (G2) -> '../'
// Např. /V2/G2/en/index.html -> 2 adresáře (G2, en) -> '../../'
const dirsAfterV2 = segmentsAfterV2.slice(0, -1); // odstraníme soubor z cesty
const depthAfterV2 = dirsAfterV2.length;
const basePath = v2Index >= 0 ? (depthAfterV2 > 0 ? '../'.repeat(depthAfterV2) : './') : './';
const localeSuffix = isEnglishLocale ? '-en' : '';
const navTargets = {
  home: `${basePath}main${localeSuffix}.html`,
  camps: `${basePath}camp${localeSuffix}.html`,
  arts: `${basePath}arts${localeSuffix}.html`,
  amenti: `${basePath}halls${localeSuffix}.html`,
  evoluzion: `${basePath}evoluzion${localeSuffix}.html`,
  blog: `${basePath}blog${localeSuffix}.html`,
  links: `${basePath}links${localeSuffix}.html`,
  about: `${basePath}about${localeSuffix}.html`,
  dev: `${basePath}dev${localeSuffix}.html`,
  woodart: `${basePath}woodart${localeSuffix}.html`,
  shop: `${basePath}shop${localeSuffix}.html`,
  miningStart: `${basePath}mining-start${localeSuffix}.html`,
  dashboard: `${basePath}dashboard${localeSuffix}.html`,
  cart: `${basePath}cart${localeSuffix}.html`,
  genesisPortal: `${basePath}G2/index.html`,
  genesisPartOne: `${basePath}G2/part-1.html`,
  genesisPartTwo: `${basePath}G2/part-2.html`,
  genesisNativePhilosophy: `${basePath}G2/native-philosophy.html`,
  genesisAiNative: `${basePath}G2/ai-native.html`,
  genesisRoadmap: `${basePath}G2/roadmap.html`,
};

function buildLangSwitchHTML() {
  const target = resolveLangSwitchTarget();
  if (isEnglishLocale) {
    return `<a href="${target}">CZ</a> | <span class="active-lang">EN</span>`;
  }
  return `<span class="active-lang">CZ</span> | <a href="${target}">EN</a>`;
}

function applyUnifiedGenesisNav() {
  if (!navMenu) return;
  const langSwitchHTML = buildLangSwitchHTML();
  navMenu.innerHTML = `
              <div class="nav-dropdown">
                <button class="nav-link nav-dropdown-toggle" type="button">
                  Genesis
                  <i class="fa-solid fa-chevron-down"></i>
                </button>
                <div class="nav-dropdown-panel">
                  <a href="${navTargets.genesisPortal}" class="nav-dropdown-link">📖 Portal</a>
                  <a href="${navTargets.genesisPartOne}" class="nav-dropdown-link">Part I • Awakening</a>
                  <a href="${navTargets.genesisPartTwo}" class="nav-dropdown-link">Part II • Ascension</a>
                  <a href="${navTargets.genesisAiNative}" class="nav-dropdown-link">🤖 AI Native</a>
                  <a href="${navTargets.genesisNativePhilosophy}" class="nav-dropdown-link">🌱 Native Philosophy</a>
                  <a href="${navTargets.genesisRoadmap}" class="nav-dropdown-link">🗺️ Roadmap</a>
                </div>
              </div>

              <div class="nav-dropdown">
                <button class="nav-link nav-dropdown-toggle" type="button">
                  Realms
                  <i class="fa-solid fa-chevron-down"></i>
                </button>
                <div class="nav-dropdown-panel">
                  <a href="${navTargets.home}" class="nav-dropdown-link">Home</a>
                  <a href="${navTargets.camps}" class="nav-dropdown-link">Camps</a>
                  <a href="${navTargets.arts}" class="nav-dropdown-link">Arts</a>
                  <a href="${navTargets.amenti}" class="nav-dropdown-link">Amenti</a>
                  <a href="${navTargets.evoluzion}" class="nav-dropdown-link">EvoluZion</a>
                </div>
              </div>

              <div class="nav-dropdown">
                <button class="nav-link nav-dropdown-toggle" type="button">
                  Portals
                  <i class="fa-solid fa-chevron-down"></i>
                </button>
                <div class="nav-dropdown-panel">
                  <a href="${navTargets.blog}" class="nav-dropdown-link">Blog</a>
                  <a href="${navTargets.links}" class="nav-dropdown-link">Links</a>
                  <a href="${navTargets.about}" class="nav-dropdown-link">About</a>
                  <a href="${navTargets.dev}" class="nav-dropdown-link">DeV</a>
                  <a href="${navTargets.woodart}" class="nav-dropdown-link">WoodArt</a>
                </div>
              </div>

              <a href="${navTargets.shop}" class="nav-link">Shop</a>
              <a href="${navTargets.miningStart}" class="nav-link mining-nav-link">
                <span class="mining-badge-nav">⛏️</span> Start Mining
              </a>
              <a href="${navTargets.dashboard}" class="nav-link">Dashboard</a>
              <span class="nav-link lang-switch">${langSwitchHTML}</span>

              <a href="${navTargets.cart}" class="nav-link cart-link">
                <span class="cart-icon-wrapper">
                  <i class="fa-solid fa-cart-shopping"></i>
                  <span id="cart-count" class="cart-badge">0</span>
                </span>
              </a>`;

  const brand = document.querySelector('.nav-branding-1');
  if (brand) brand.setAttribute('href', navTargets.home);
}

function getLocaleLabels() {
  if (isEnglishLocale) {
    return {
      realms: 'Realms',
      portals: 'Portals',
      home: 'Home',
      camps: 'Camps',
      arts: 'Arts',
      amenti: 'Amenti',
      evoluzion: 'EvoluZion',
      blog: 'Blog',
      links: 'Links',
      about: 'About',
      dev: 'DeV',
      woodart: 'WoodArt',
      shop: 'Shop',
      mining: 'Start Mining',
      dashboard: 'Dashboard',
    };
  }
  return {
    realms: 'Realms',
    portals: 'Portals',
    home: 'Home',
    camps: 'Camps',
    arts: 'Arts',
    amenti: 'Amenti',
    evoluzion: 'EvoluZion',
    blog: 'Blog',
    links: 'Links',
    about: 'About',
    dev: 'DeV',
    woodart: 'WoodArt',
    shop: 'Shop',
    mining: 'Start Mining',
    dashboard: 'Dashboard',
  };
}

function ensureDropdown(selectorText, entries) {
  const dropdowns = Array.from(document.querySelectorAll('.nav-dropdown'));
  const target = dropdowns.find((d) => d.querySelector('.nav-dropdown-toggle')?.textContent?.trim().includes(selectorText));
  const panelHtml = entries
    .map((e) => `<a href="${e.href}" class="nav-dropdown-link">${e.label}</a>`)
    .join('');
  if (target) {
    const panel = target.querySelector('.nav-dropdown-panel');
    if (panel) panel.innerHTML = panelHtml;
    return;
  }
  if (!navMenu) return;
  const html = `
    <div class="nav-dropdown">
      <button class="nav-link nav-dropdown-toggle" type="button">
        ${selectorText}
        <i class="fa-solid fa-chevron-down"></i>
      </button>
      <div class="nav-dropdown-panel">${panelHtml}</div>
    </div>`;
  const temp = document.createElement('div');
  temp.innerHTML = html;
  navMenu.insertBefore(temp.firstElementChild, navMenu.firstElementChild?.nextSibling || null);
}

function unifyHeaderMenus() {
  if (!navMenu) return;
  const L = getLocaleLabels();
  // Realms dropdown
  ensureDropdown(L.realms, [
    { href: navTargets.home, label: L.home },
    { href: navTargets.camps, label: L.camps },
    { href: navTargets.arts, label: L.arts },
    { href: navTargets.amenti, label: L.amenti },
    { href: navTargets.evoluzion, label: L.evoluzion },
  ]);
  // Portals dropdown
  ensureDropdown(L.portals, [
    { href: navTargets.blog, label: L.blog },
    { href: navTargets.links, label: L.links },
    { href: navTargets.about, label: L.about },
    { href: navTargets.dev, label: L.dev },
    { href: navTargets.woodart, label: L.woodart },
  ]);
  // Utility links
  function ensureTopLink(href, text, className) {
    const existing = Array.from(navMenu.querySelectorAll('a.nav-link')).find((a) => a.textContent?.trim() === text);
    if (existing) {
      existing.setAttribute('href', href);
      if (className) existing.classList.add(className);
    } else {
      const a = document.createElement('a');
      a.className = 'nav-link' + (className ? ' ' + className : '');
      a.href = href;
      a.textContent = text;
      navMenu.appendChild(a);
    }
  }
  ensureTopLink(navTargets.shop, L.shop);
  ensureTopLink(navTargets.miningStart, L.mining, 'mining-nav-link');
  const miningBadge = navMenu.querySelector('.mining-badge-nav') || document.createElement('span');
  miningBadge.className = 'mining-badge-nav';
  miningBadge.textContent = '⛏️';
  const miningLink = Array.from(navMenu.querySelectorAll('a.nav-link')).find((a) => a.textContent?.trim() === L.mining);
  if (miningLink && !miningLink.querySelector('.mining-badge-nav')) {
    miningLink.insertBefore(miningBadge, miningLink.firstChild);
  }
  ensureTopLink(navTargets.dashboard, L.dashboard);
  // Brand link to home
  const brand = document.querySelector('.nav-branding-1');
  if (brand) brand.setAttribute('href', navTargets.home);
}

function resolveLangSwitchTarget() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const g2Index = parts.indexOf('G2');
  const fileName = parts[parts.length - 1] || 'index.html';

  // Genesis mapping: toggle between G2/... and G2/en/...
  if (g2Index !== -1) {
    const isEnFolder = parts[g2Index + 1] === 'en';
    const rest = parts.slice(g2Index + (isEnFolder ? 2 : 1));
    const restPath = rest.join('/') || 'index.html';
    // robust relative paths independent of '/V2' prefix presence
    return isEnFolder ? `../${restPath}` : `en/${restPath}`;
  }

  // Non-Genesis mapping within same directory
  if (isEnglishLocale) {
    return fileName.replace('-en', '');
  }
  if (fileName.includes('-en')) {
    return fileName;
  }
  return fileName.endsWith('.html') ? fileName.replace('.html', '-en.html') : `${fileName}-en.html`;
}

function normalizeLangSwitch() {
  const langSwitch = document.querySelector('.lang-switch');
  const target = resolveLangSwitchTarget();
  if (!target) return;

  // Pokud přepínač chybí, vytvořit
  let ls = langSwitch;
  if (!ls && navMenu) {
    ls = document.createElement('span');
    ls.className = 'nav-link lang-switch';
    navMenu.appendChild(ls);
  }
  if (!ls) return;

  // Vykreslit konzistentní obsah podle aktuálního jazyka
  if (isEnglishLocale) {
    ls.innerHTML = `<a href="${target}">CZ</a> | <span class="active-lang">EN</span>`;
  } else {
    ls.innerHTML = `<span class="active-lang">CZ</span> | <a href="${target}">EN</a>`;
  }
}

function normalizeNavLinks() {
  if (!navMenu) return;

  // Vynutí jednotnou navigaci napříč všemi stránkami
  // applyUnifiedGenesisNav() již vytváří kompletní navigaci včetně Genesis dropdownu
  applyUnifiedGenesisNav();
  normalizeLangSwitch();
  // ODSTRANĚNO: Duplicitní vytváření Genesis dropdownu - již je v applyUnifiedGenesisNav()
}

// Spustit sjednocení navigace po definici funkcí
normalizeNavLinks();


const dropdowns = document.querySelectorAll('.nav-dropdown');
const dropdownToggles = document.querySelectorAll('.nav-dropdown-toggle');
const dropdownLinks = document.querySelectorAll('.nav-dropdown-link');

function closeAllDropdowns(except) {
  dropdowns.forEach((dropdown) => {
    if (dropdown !== except) {
      dropdown.classList.remove('open');
    }
  });
}

function closeMobileNav() {
  if (!hamburger || !navMenu) return;
  hamburger.classList.remove("active");
  navMenu.classList.remove("active");
  document.body.classList.remove("menu-open");
  const overlay = document.querySelector(".nav-overlay");
  if (overlay) overlay.classList.remove("active");
  if (navBranding) {
    navBranding.classList.remove("active");
  }
  closeAllDropdowns();
}

// Create overlay element dynamically
(function createNavOverlay() {
  if (document.querySelector('.nav-overlay')) return;
  const overlay = document.createElement('div');
  overlay.className = 'nav-overlay';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', closeMobileNav);
})();

if (hamburger && navMenu) {
  hamburger.addEventListener("click", () => {
    const isOpening = !navMenu.classList.contains("active");
    hamburger.classList.toggle("active");
    navMenu.classList.toggle("active");
    document.body.classList.toggle("menu-open");
    const overlay = document.querySelector(".nav-overlay");
    if (overlay) overlay.classList.toggle("active");
    if (navBranding) {
      navBranding.classList.toggle("active");
    }
    // When closing, also close dropdowns
    if (!isOpening) closeAllDropdowns();
  });
}

document.querySelectorAll(".nav-link:not(.nav-dropdown-toggle)").forEach((n) =>
  n.addEventListener("click", () => {
    closeMobileNav();
  })
);

dropdownToggles.forEach((toggle) => {
  toggle.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const dropdown = toggle.closest('.nav-dropdown');
    if (!dropdown) return;
    const wasOpen = dropdown.classList.contains('open');
    closeAllDropdowns(dropdown);
    if (!wasOpen) {
      dropdown.classList.add('open');
    } else {
      dropdown.classList.remove('open');
    }
  });
});

dropdownLinks.forEach((link) => {
  link.addEventListener('click', () => {
    closeAllDropdowns();
    closeMobileNav();
  });
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.nav-dropdown')) {
    closeAllDropdowns();
  }
});

document.addEventListener('keyup', (event) => {
  if (event.key === 'Escape') {
    closeAllDropdowns();
    closeMobileNav();
  }
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 868) {
    closeAllDropdowns();
    closeMobileNav();
  }
});

const quotes = [
    "Já jsem světlo světa; kdo mě následuje, nebude chodit ve tmě, ale bude mít světlo života.",
    "Milujte se navzájem, jako jsem já miloval vás.",
    "Já jsem cesta, pravda i život. Nikdo nepřichází k Otci než skrze mne.",
    "Neboť kde jsou dva nebo tři shromážděni ve jménu mém, tam jsem já uprostřed nich.",
    "Proste, a bude vám dáno; hledejte, a naleznete; tlučte, a bude vám otevřeno.",
    "Blahoslavení milosrdní, neboť oni dojdou milosrdenství.",
    "Blahoslavení čistého srdce, neboť oni uzří Boha.",
    "Nechte děti přicházet ke mně, nebraňte jim, neboť takovým patří království Boží.",
    "Pojďte ke mně všichni, kdo se namáháte a jste obtíženi břemeny, a já vám dám odpočinout.",
    "Hledejte především Boží království a jeho spravedlnost, a všechno ostatní vám bude přidáno.",
    "Království nebeské je jako poklad ukrytý v poli, který někdo najde a skryje; z radosti nad tím jde, prodá všecko, co má, a koupí to pole.",
    "Království nebeské je jako hořčičné zrno, které člověk zasel na svém poli; je sice menší než všecka semena, ale když vyroste, je větší než ostatní byliny.",
    "Království nebeské je jako kvas, který žena vmísí do tří měřic mouky, až se všecko prokvasí.",
    "Království Boží nepřichází tak, aby se to dalo pozorovat; ani se nedá říci: ‚Hle, je tu' nebo ‚je tam'! Vždyť království Boží je mezi vámi!",
    "Kdo se nepřijme království Boží jako dítě, jistě do něho nevejde.",
    "Jak těžko vejdou do království Božího ti, kdo mají bohatství! Snáze projde velbloud uchem jehly, než aby bohatý vešel do království Božího.",
    "Ne každý, kdo mi říká ‚Pane, Pane', vejde do království nebeského; ale ten, kdo činí vůli mého Otce v nebesích.",
    "Blaze chudým v duchu, neboť jejich je království nebeské.",
    "Hledejte nejprve Boží království a jeho spravedlnost, a všechno ostatní vám bude přidáno.",
    "Království nebeské je podobné králi, který vystrojil svatbu svému synu.",
    
    // Nové citáty
    "Dávejte a bude vám dáno; dobrá míra, natlačená, natřesená, vrchovatá vám bude dána do klína.",
    "Neboť jsem hladověl, a dali jste mi jíst, žíznil jsem, a dali jste mi pít, byl jsem na cestách, a ujali jste se mne.",
    "Kdo chce být první, buď ze všech poslední a služebník všech.",
    "Co prospěje člověku, získá-li celý svět, ale ztratí svou duši?",
    "Jako Otec miloval mne, tak já jsem miloval vás. Zůstaňte v mé lásce.",
    "Nové přikázání vám dávám, abyste se navzájem milovali; jako já jsem miloval vás.",
    "Já jsem vinný kmen, vy jste ratolesti. Kdo zůstává ve mně a já v něm, ten nese hojné ovoce.",
    "Váš Otec ví, co potřebujete, dříve než ho prosíte.",
    "Kde je tvůj poklad, tam bude i tvé srdce.",
    "Vy jste sůl země; jestliže však sůl pozbude chuti, čím bude osolena?",
    "Vy jste světlo světa. Nemůže zůstat skryto město ležící na hoře.",
    "Buďte dokonalí, jako je dokonalý váš nebeský Otec.",
    "Podle jejich ovoce je poznáte. Což sklízejí z trní hrozny nebo z bodláčí fíky?",
    "Každý strom, který nenese dobré ovoce, bude vyťat a hozen do ohně.",
    "Bděte tedy, protože nevíte, v který den váš Pán přijde.",

    // Nové citáty o lásce
    "Miluj Hospodina, Boha svého, celým svým srdcem, celou svou duší a celou svou myslí.",
    "Miluj svého bližního jako sám sebe.",
    "Větší lásku nemá nikdo než ten, kdo položí život za své přátele.",
    "Láska je trpělivá, láska je laskavá. Nezávidí, láska se nevychloubá a není domýšlivá.",
    "A tak zůstává víra, naděje a láska, ale největší z té trojice je láska.",
    "Kdo nemiluje, nepoznal Boha, protože Bůh je láska.",
    "V lásce není strach, ale dokonalá láska strach zahání.",
    "My milujeme, protože Bůh napřed miloval nás.",
    "Milujte své nepřátele a modlete se za ty, kdo vás pronásledují.",
    "Všechno dělejte v lásce.",

    // Nová podobenství
    "Podobno jest království nebeské zrnu hořčičnému, kteréž vzav člověk, vsál na poli svém. Kteréžto nejmenší jest mezi všemi semeny, ale když vzroste, větší jest než jiné byliny.",
    "Podobno jest království nebeské kvasu, kterýž vzavši žena, zadělala ve třech měřicích mouky, až by zkysalo všecko.",
    "Podobno jest království nebeské pokladu skrytému v poli, kterýž nalezna člověk, skryl, a radostí nad ním jde a prodá všecko, což má, a koupí pole to.",
    "Opět podobno jest království nebeské člověku kupci, hledajícímu pěkných perel. Kterýž když nalezl jednu velmi drahou perlu, odšel a prodal všecko, což měl, a koupil ji.",
    "Podobno jest království nebeské síti puštěné do moře a ze všelikého plodu rybího shromažďující.",
    "Podobno jest království nebeské člověku hospodáři, kterýž vyšel na úsvitě, aby najal dělníky na vinici svou.",
    "Podobno jest království nebeské člověku králi, kterýž učinil svatbu synu svému.",
    "Podobno bude království nebeské desíti pannám, kteréžto vzavše lampy své, vyšly proti ženichovi.",
    "Podobno jest království nebeské člověku, kterýž odcházeje z domu, povolal služebníků svých a dal jim statky své.",
    "Jako pastýř odděluje ovce od kozlů, tak budou odděleni spravedliví od nespravedlivých při příchodu Syna člověka.",

    // Citáty velkých myslitelů
    "Vím, že nic nevím. - Sokrates",
    "Člověk je měřítkem všech věcí. - Protagoras",
    "Poznej sám sebe. - Nápis v Delfách",
    "Celek je víc než souhrn jeho částí. - Aristoteles",
    "Nemůžeš dvakrát vstoupit do téže řeky. - Herakleitos",
    "Myslím, tedy jsem. - René Descartes",
    "Člověk je odsouzen ke svobodě. - Jean-Paul Sartre",
    "Pravda vás osvobodí. - Tomáš Akvinský",
    "Víra hledající porozumění. - Anselm z Canterbury",
    "Co není vědecké, není skutečné. - Auguste Comte",
    "Existence předchází esenci. - Jean-Paul Sartre",
    "Jednej tak, aby se maxima tvé vůle mohla stát principem všeobecného zákonodárství. - Immanuel Kant",
    "Život nezkoušený není hoden žití. - Sokrates",
    "Člověk je politický živočich. - Aristoteles",
    "Vědomí určuje bytí. - Karl Marx",
    "Kdo bojuje s nestvůrami, ať se má na pozoru, aby se sám nestal nestvůrou. - Friedrich Nietzsche",
    "Skepticismus je začátek víry. - Oscar Wilde",
    "Krása zachrání svět. - Fjodor Michajlovič Dostojevskij",
    "Láska k moudrosti je počátkem všeho poznání. - Platón",

    // Citáty Mahátmy Gándhího
    "Buď změnou, kterou chceš vidět ve světě. - Mahátma Gándhí",
    "Oko za oko učiní celý svět slepým. - Mahátma Gándhí",
    "Nejprve tě ignorují, pak se ti smějí, pak s tebou bojují, pak zvítězíš. - Mahátma Gándhí",
    "Život je jako zrcadlo, usmějete se na něj a on se usměje na vás. - Mahátma Gándhí",
    "Síla není v fyzické kapacitě, ale v neochvějné vůli. - Mahátma Gándhí",
    "Láska je nejsilnější silou, kterou svět disponuje. - Mahátma Gándhí",
    "Kde je láska, tam je život. - Mahátma Gándhí",
    "Pravda a nenásilí jsou staré jako hory. - Mahátma Gándhí",
    "Štěstí je harmonie mezi tím, co myslíte, říkáte a děláte. - Mahátma Gándhí",
    "Naše schopnost dosáhnout jednoty v různosti bude krásou civilizace. - Mahátma Gándhí",
    "Živý příklad má větší hodnotu než tisíc argumentů. - Mahátma Gándhí",
    "Svoboda není hodna toho jména, není-li svobodou mýlit se. - Mahátma Gándhí",
    "Nejlepší způsob, jak najít sebe sama, je ztratit se ve službě druhým. - Mahátma Gándhí",
    "Skromnost je pro morálku tím, čím je stín pro obraz. - Mahátma Gándhí",
    "Síla nenásilí je stokrát větší než síla zbraní. - Mahátma Gándhí",

    // Buddhovy citáty
    "Nenechte se vést pouze tím, co slyšíte. - Buddha",
    "V zdravém těle zdravý duch, toť nejkratší cesta ke štěstí. - Buddha",
    "Tisíc vítězství nad tisíci lidmi v bitvě se nevyrovná vítězství nad sebou samým. - Buddha",
    "Všechny jevy pocházejí z mysli. - Buddha",
    "Žij v přítomnosti, pamatuj na minulost a neboj se budoucnosti. - Buddha",
    "Nelpění je největší dar. - Buddha",
    "Láska a soucit jsou nutnosti, ne luxus. Bez nich lidstvo nemůže přežít. - Buddha",
    "Zdraví je největší dar, spokojenost největší bohatství, věrnost nejlepší vztah. - Buddha",
    "Slova mají sílu ničit i léčit. - Buddha",
    "Každé ráno se rodíme znovu. To, co uděláme dnes, je to, na čem záleží nejvíce. - Buddha",

    // Krišnovy citáty
    "Lepší je konat vlastní povinnost, byť nedokonale, než dokonale plnit povinnost druhého. - Krišna",
    "Člověk by měl pozdvihnout sám sebe a neměl by se ponižovat. - Krišna",
    "Jsem počátek, střed i konec všeho stvoření. - Krišna",
    "Moudrý člověk vidí utrpení v samotném požitku. - Krišna",
    "Mysl je přítel toho, kdo ji ovládl, ale nepřítelem toho, kdo ji neovládl. - Krišna",
    "Pracuj pro práci samotnou, ne pro její plody. - Krišna",
    "Ten, kdo vidí činnost v nečinnosti a nečinnost v činnosti, je moudrý mezi lidmi. - Krišna",
    "Štěstí pochází z klidu mysli. - Krišna",
    "Ovládni své smysly, ovládni svou duši. - Krišna",
    "V nevědomosti žijí ti, kdo vidí různost v jednotě. - Krišna"
];

// Vylepšení funkce pro zobrazování citátů s kategorií a autorem
function updateQuote() {
    const quoteElement = document.getElementById('quote');
    if (!quoteElement) return; // Element neexistuje na této stránce
    
    const randomIndex = Math.floor(Math.random() * quotes.length);
    const quote = quotes[randomIndex];
    
    quoteElement.style.opacity = 0;
    quoteElement.style.transform = 'translateY(20px)';
    
    setTimeout(() => {
        quoteElement.textContent = quote;
        quoteElement.style.opacity = 1;
        quoteElement.style.transform = 'translateY(0)';

        // Rozpoznání typu citátu a aplikace stylu
        if (quote.includes("- Mahátma Gándhí")) {
            quoteElement.className = 'gandhi-quote';
        } else if (quote.includes("- Buddha")) {
            quoteElement.className = 'buddha-quote';
        } else if (quote.startsWith("Podobno jest království") || quote.includes("království") || quote.includes("Království")) {
            quoteElement.className = 'kingdom-quote';
        } else if (!quote.includes("-")) {
            quoteElement.className = 'jesus-quote';
        } else {
            quoteElement.className = 'philosopher-quote';
        }
    }, 500);
}

// Aktualizace citátu každých 10 sekund
document.addEventListener('DOMContentLoaded', () => {
    updateQuote();
    setInterval(updateQuote, 15000);
});

(function adjustBodyPadding(){
        const header = document.getElementById('header');
        if (!header) return;
        function update() {
          const h = header.offsetHeight;
          document.body.style.paddingTop = h + 'px';
        }
        window.addEventListener('resize', update);
        document.addEventListener('DOMContentLoaded', update);
        // okamžité nastavení pokud skript běží po načtení
        update();
      })();

// Genesis scroll-spy and reveal (only if chapter nav present)
(function genesisEnhancements(){
  const chapterNav = document.querySelector('.genesis-nav');
  if (!chapterNav) return; // run only on genesis chapter pages

  const sections = [];
  document.querySelectorAll('.chapter-section').forEach(sec => {
    if (sec.id) sections.push({ id: sec.id, link: `a[href="#${sec.id}"]`});
  });

  const links = sections.map(s => ({ linkEl: document.querySelector(s.link), id: s.id }));
  const quotes = Array.from(document.querySelectorAll('.chapter-quote'));
  const titles = Array.from(document.querySelectorAll('.chapter-title'));

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const id = entry.target.id;
      const link = links.find(l => l.id === id)?.linkEl;
      if (entry.isIntersecting) {
        if (link) link.classList.add('active');
      } else {
        if (link) link.classList.remove('active');
      }
    });
  }, { rootMargin: '0px 0px -70% 0px', threshold: 0.2 });

  sections.forEach(s => {
    const el = document.getElementById(s.id);
    if (el) observer.observe(el);
  });

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.15 });

  quotes.forEach(q => revealObserver.observe(q));
  titles.forEach(t => revealObserver.observe(t));
})();