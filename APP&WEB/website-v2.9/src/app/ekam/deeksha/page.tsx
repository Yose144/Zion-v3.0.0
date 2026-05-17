'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Book,
  Sparkles,
  Atom,
  Orbit,
  Sun,
  Layers,
  Menu,
  X,
  Cpu,
  Heart,
  Globe,
} from 'lucide-react';

/* ═══════════════════════════════════════
   CHAPTERS
═══════════════════════════════════════ */
const chapters = [
  { id: 'predmluva',  number: '',   title: 'Předmluva',               subtitle: 'Druhý dech Quantové Revoluce' },
  { id: 'kapitel-1', number: '1',  title: 'Konec odděleného člověka', subtitle: 'Krize odděleného self' },
  { id: 'kapitel-2', number: '2',  title: 'Proč staré mapy nestačí',  subtitle: 'Čtyři limity moderního hledání' },
  { id: 'kapitel-3', number: '3',  title: 'Historická linie',         subtitle: 'Jeevashram · Satyaloka · Oneness' },
  { id: 'kapitel-4', number: '4',  title: 'Amma a Bhagavan',          subtitle: 'Dvojjediny princip' },
  { id: 'kapitel-5', number: '5',  title: 'Deeksha',                  subtitle: 'Přenos jako technologie vědomí' },
  { id: 'kapitel-6', number: '6',  title: 'Ekam a Golden Orb',        subtitle: 'Chrám a zlaté centrum' },
  { id: 'kapitel-7', number: '7',  title: 'Hiranyagarbha',            subtitle: 'Zlatý zárodek a kosmologie' },
  { id: 'kapitel-8', number: '8',  title: 'Ekam Deeksha PoW',         subtitle: 'Algoritmus jako zlatý zárodek' },
  { id: 'kapitel-9', number: '9',  title: 'Algoritmus Zlatého věku',  subtitle: 'Deset kroků od separace k jednotě' },
  { id: 'zaver',     number: '',   title: 'Závěr',                    subtitle: 'Kdy začíná Zlatý věk' },
];

/* ═══════════════════════════════════════
   ALGO PIPELINE
═══════════════════════════════════════ */
const algoSteps = [
  { id: 0, name: 'Hiranyagarbha', color: 'text-amber-300',   border: 'border-amber-300/40',   bg: 'bg-amber-300/10',   desc: 'Inicializace zlatého zárodku — seed z hlavičky bloku se rozvíjí v primordial state.' },
  { id: 1, name: 'Brahma',        color: 'text-violet-300',  border: 'border-violet-300/40',  bg: 'bg-violet-300/10',  desc: 'Expanze stvoření — čtení z 256 KiB scratchpadu rozviřuje prostor stavů.' },
  { id: 2, name: 'Yantra',        color: 'text-sky-300',     border: 'border-sky-300/40',     bg: 'bg-sky-300/10',     desc: '4 průchody × 256 náhodných čtení — geometrie posvátného vzorce, doslova nelze parallelizovat.' },
  { id: 3, name: 'Karma',         color: 'text-emerald-300', border: 'border-emerald-300/40', bg: 'bg-emerald-300/10', desc: 'Zákon příčiny — epoch NPU váhy (rotace každých 2016 / 100 bloků) mění výsledek každou epochou.' },
  { id: 4, name: 'Chit',          color: 'text-rose-300',    border: 'border-rose-300/40',    bg: 'bg-rose-300/10',    desc: 'Čisté vědomí — finální mix vah s hash state.' },
  { id: 5, name: 'Samadhi',       color: 'text-amber-200',   border: 'border-amber-200/40',   bg: 'bg-amber-200/10',   desc: 'Sjednocení — 32bajtový výsledek srovnaný s target difficulty. PoW je dokončen.' },
];

const algoTiers = [
  { tier: 'Tier 1', title: '256 KiB Scratchpad', desc: 'Paměťově vázaná práce — každý průchod skenerem musí procházet celou 256 KiB oblastí. ASIC nemůže vynechat paměťový latency.' },
  { tier: 'Tier 2', title: 'Epoch NPU váhy',     desc: 'Každých 2016 bloků (nebo 100 bloků v testnet) se rotují NPU vahové matice. Speciální hardware zastarává každou epochu.' },
];

/* ═══════════════════════════════════════
   PAGE
═══════════════════════════════════════ */
export default function EkamDeekshaPage() {
  const [activeChapter, setActiveChapter] = useState('predmluva');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveChapter(entry.target.id);
        });
      },
      { rootMargin: '-100px 0px -70% 0px' }
    );
    chapters.forEach((ch) => {
      const el = document.getElementById(ch.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="">

      {/* ── HERO ── */}
      <div className="relative overflow-hidden border-b border-white/10 bg-linear-to-b from-amber-900/10 via-transparent to-transparent">
        <div className="zion-container py-20 relative">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-300/30 bg-amber-300/10 mb-6">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span className="text-sm text-amber-200 font-semibold">Navazuje na Quantovou Revoluci</span>
            </div>
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold mb-6 text-gradient">
              Ekam Deeksha
            </h1>
            <p className="text-xl text-gray-400 mb-4">
              Algoritmus jednoty — filozofie, kosmologie a praxe Zlatého věku
            </p>
            <p className="text-base text-gray-500 max-w-2xl mx-auto leading-relaxed">
              Druhá kniha po Quantové Revoluci. Nepokračuje tím, že by přidala novou teorii.
              Obrací pohled dovnitř: co se musí stát ve vědomí člověka, aby se oddělený svět opravdu přestal reprodukovat.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 justify-center">
              <Link href="/ekam" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/15 bg-white/8 text-sm font-semibold text-white hover:border-amber-300/30 transition-colors">
                Projít Ekam
              </Link>
              <Link href="/genesis" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-sky-300/20 bg-sky-300/8 text-sm font-semibold text-sky-100 hover:border-sky-200/30 transition-colors">
                ZION Genesis Book
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="zion-container py-12">

        {/* Mobile nav toggle */}
        <div className="lg:hidden mb-6">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-white/10 bg-black/60 backdrop-blur-xl text-white hover:border-amber-300/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Book className="w-5 h-5 text-amber-300" />
              <span className="font-semibold">Kapitoly</span>
            </div>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          {mobileMenuOpen && (
            <div className="mt-4 border border-white/10 rounded-2xl p-4 bg-black/80 backdrop-blur-xl space-y-1">
              {chapters.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => { scrollTo(ch.id); setMobileMenuOpen(false); }}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${
                    activeChapter === ch.id
                      ? 'bg-amber-300/10 text-amber-200 border-l-2 border-amber-300'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {ch.number && <span className="text-xs opacity-60">Kap. {ch.number}: </span>}
                  {ch.title}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-8">

          {/* Sidebar */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-24 border border-white/10 rounded-2xl p-5 bg-black/60 backdrop-blur-xl">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Book className="w-3.5 h-3.5" />
                Kapitoly
              </h3>
              <nav className="space-y-1">
                {chapters.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => scrollTo(ch.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm leading-snug ${
                      activeChapter === ch.id
                        ? 'bg-amber-300/10 text-amber-200 border-l-2 border-amber-300'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {ch.number && <span className="text-xs opacity-50 block">Kap. {ch.number}</span>}
                    {ch.title}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* ══ CONTENT ══ */}
          <div className="flex-1 max-w-3xl">

            {/* PŘEDMLUVA */}
            <section id="predmluva" className="mb-24 scroll-mt-24">
              <div className="mb-8 text-center">
                <h2 className="text-4xl md:text-5xl font-bold text-amber-300 mb-3">Předmluva</h2>
                <p className="text-gray-400 text-lg italic">Druhý dech Quantové Revoluce</p>
              </div>
              <div className="space-y-6 text-center">
                <p className="text-xl leading-relaxed text-gray-300">
                  Quantová Revoluce pojmenovala civilizační práh.<br />
                  Ukázala, že starý svět se nevyčerpává náhodou —<br />
                  ale proto, že dosáhl mezí vlastního odděleného vědomí.
                </p>
                <p className="text-base leading-8 text-gray-400">
                  Tato kniha na tu mapu navazuje. Ale nerozšiřuje ji přidáním nové vrstvy teorie.<br />
                  Obrací pohled <strong className="text-amber-300">dovnitř</strong>.
                </p>
                <p className="text-base leading-8 text-gray-400">
                  Ptá se přesněji: co se musí stát v člověku, aby oddělený svět opravdu skončil?<br />
                  Nestačí lepší systémy. Nestačí kvantový slovník. Nestačí motivační spiritualita.<br />
                  Je třeba konec jedné struktury vnímání — a zrození jiné.
                </p>
                <div className="my-10 p-8 rounded-2xl border border-amber-300/20 bg-amber-300/5 backdrop-blur-xl">
                  <p className="text-lg italic text-gray-300 leading-relaxed">
                    Ekam znamená „jedno“.<br />
                    Deeksha znamená „přenos, zasvěcení, milost“.<br />
                    Tato kniha je o tom, jak se toto jedno přenáší v čase,<br />
                    prostoru, filozofii — a v algoritmech blockchainu.
                  </p>
                </div>
                <p className="text-gray-400 text-sm leading-7">
                  Za touto knihou stojí linie Jeevashram → Satyaloka → Oneness → Ekam.<br />
                  Za touto linií stojí Amma a Bhagavan Sri Kalki.<br />
                  A za tím vším stojí nejstarší kosmologický obraz Véd:<br />
                  <strong className="text-amber-300">Hiranyagarbha</strong> — zlatý zárodek, z něhož se rodí vesmír.
                </p>
              </div>
            </section>

            {/* KAP 1 */}
            <section id="kapitel-1" className="mb-24 scroll-mt-24">
              <div className="mb-8 text-center">
                <div className="text-sm text-amber-300 uppercase tracking-wider mb-2">Kapitola 1</div>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-3">Konec odděleného člověka</h2>
                <p className="text-gray-400 text-lg italic">Krize odděleného self</p>
              </div>
              <div className="space-y-5 text-base leading-8 text-gray-300">
                <p>
                  Existují epochy, kdy se civilizace hroutí pod tlakem vnějších sil. A pak existují epochy, kdy se hroutí proto, že už neudrží vlastní vnitřní tvar. Naše doba patří do té druhé kategorie. Na povrchu vidíme konflikty, ekonomické otřesy, rozpad vztahů, epidemii úzkosti, technologickou závislost i duchovní zmatek. Pod tím vším však leží hlubší příčina. Člověk se sám pro sebe stal oddělenou jednotkou, která přestala prožívat svou souvislost se životem.
                </p>
                <p>
                  Základní problém není morální. Problém je ontologický. Člověk vnímá sebe sama jako izolované centrum, které se musí neustále bránit, potvrzovat a zachraňovat. Z tohoto pocitu oddělení se rodí strach. Ze strachu se rodí kontrola. Z kontroly se rodí násilí, přetvářka, únava a odcizení.
                </p>
                <p>
                  Proto je dnes tolik technologií, ale málo klidu. Tolik komunikace, ale málo skutečného setkání. Tolik spirituality, ale málo skutečné proměny. Oddělené self umí recyklovat i to, co mělo být cestou ven. Umí z meditace udělat výkon. Umí z lásky udělat vlastnictví. Umí z osvobození udělat další projekt ega.
                </p>
                <div className="rounded-2xl border border-sky-300/20 bg-sky-300/5 p-6 my-6">
                  <p className="text-sky-200 font-semibold mb-2 flex items-center gap-2"><Layers className="w-4 h-4" /> Základní teze</p>
                  <p className="text-gray-300 text-sm leading-7">
                    Utrpení nevzniká proto, že je svět nedokonalý, ale proto, že prožíváme sebe sama jako oddělené od života. Probuzení nezačíná ve správné doktríně, nýbrž v prasknutí tohoto omylu.
                  </p>
                </div>
                <p>
                  V tom je síla linie Amma, Bhagavan, Oneness a Ekam. Nevychází primárně z toho, co si člověk má myslet, ale z toho, co má zakusit. V okamžiku, kdy se já přestává jevit jako uzavřený ostrov, mění se vše. Způsob, jakým vnímáme druhé. Způsob, jakým držíme bolest. Způsob, jakým zacházíme s technologií, mocí i smyslem.
                </p>
                <p>
                  Ekam Deeksha proto není knihou o další víře. Je knihou o konci jedné struktury vnímání. Tento konec však není katastrofa. Je to porod. Žádný Zlatý věk nevznikne bez této vnitřní revoluce.
                </p>
              </div>
            </section>

            {/* KAP 2 */}
            <section id="kapitel-2" className="mb-24 scroll-mt-24">
              <div className="mb-8 text-center">
                <div className="text-sm text-amber-300 uppercase tracking-wider mb-2">Kapitola 2</div>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-3">Proč staré mapy nestačí</h2>
                <p className="text-gray-400 text-lg italic">Čtyři limity moderního hledání</p>
              </div>
              <div className="space-y-5 text-base leading-8 text-gray-300">
                <p>
                  Nestačí už vědět, co je špatně. Je třeba rozpoznat, proč nám dosavadní mapy nedokázaly otevřít cestu ven. Proč i po desetiletích psychologie, sebepomoci, managementu vědomí a motivační spirituality zůstává člověk uvnitř sebe stejně rozdělený.
                </p>
                <div className="grid sm:grid-cols-2 gap-4 my-6">
                  {([
                    { n: '01', title: 'Limit racionality',       body: 'Rozum umí analyzovat obsah vědomí, ale neumí s jistotou rozpustit strukturu, z níž analýza vychází. Umí zkoumat ego, ale ego se snaží opravit pomocí ega.', Icon: Atom },
                    { n: '02', title: 'Motivační spiritualita',  body: 'Oddělené já se umí velmi rychle naučit duchovní jazyk. Umí z afirmace udělat obranu, z meditace výkon, z pojmů jako hojnost a poslání kultivovanější sebestřednost.', Icon: Sparkles },
                    { n: '03', title: 'Sen o technické spáse',   body: 'Technologie bez vědomí nevede ke zrození nové civilizace, ale k urychlení starých mechanismů. Co je uvnitř nezralé, dostává pouze větší dosah.', Icon: Cpu },
                    { n: '04', title: 'Sebe-interpretace',       body: 'Porozumění mechanismu neznamená automaticky vystoupení z mechanismu. Sebepopis bez průlomu zkušenosti se může stát sofistikovanou formou stagnace.', Icon: Layers },
                  ] as const).map(({ n, title, body, Icon }) => (
                    <div key={n} className="rounded-2xl border border-white/10 bg-black/40 p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-xs font-bold text-gray-500">{n}</span>
                        <Icon className="w-4 h-4 text-amber-300" />
                        <h3 className="text-base font-semibold text-white">{title}</h3>
                      </div>
                      <p className="text-sm leading-7 text-gray-400">{body}</p>
                    </div>
                  ))}
                </div>
                <p>
                  Právě zde začíná význam linie Deekshy. Nepřichází proto, aby znehodnotila rozum, terapii ani techniku. Přichází proto, aby ukázala jejich hranici. Jejím jádrem je přiznání, že člověk potřebuje víc než další obsah. Potřebuje změnu samotného modu vnímání.
                </p>
              </div>
            </section>

            {/* KAP 3 */}
            <section id="kapitel-3" className="mb-24 scroll-mt-24">
              <div className="mb-8 text-center">
                <div className="text-sm text-amber-300 uppercase tracking-wider mb-2">Kapitola 3</div>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-3">Historická linie</h2>
                <p className="text-gray-400 text-lg italic">Jeevashram · Satyaloka · Oneness University</p>
              </div>
              <div className="space-y-5 text-base leading-8 text-gray-300">
                <p>
                  To, co se později ukázalo světu jako Oneness nebo Ekam, nezačínalo jako hotová ideologie. Rodilo se postupně jako experiment s lidskou bolestí, vztahy, výchovou, vnímáním a možností skutečné transformace.
                </p>
                <div className="space-y-4 my-6">
                  {([
                    { name: 'Jeevashram',        era: 'Počátek',        text: 'Pedagogický a formativní impuls — snaha pracovat s lidským potenciálem u kořene dříve, než se plně zafixuje do dospělé identity.' },
                    { name: 'Satyaloka',          era: 'Druhá fáze',     text: 'Posun od instituce ke stavu. Důležitý přestává být pouze obsah výuky a stále více vystupuje otázka, co se s člověkem děje v přítomnosti, v rituálu, v poli sdílené energie.' },
                    { name: 'Oneness University', era: 'Globalizace',    text: 'Místní experiment se proměňuje v mezinárodně sdílenou cestu, která má vlastní jazyk, strukturu procesu i rituální infrastrukturu. Škola i nešola. Instituce i anti-instituce.' },
                    { name: 'Ekam',               era: 'Živé pole dnes', text: 'Za dnešní symbolikou chrámu, Golden Orb a planetárního pole nestojí marketingová improvizace, ale desítky let hledání adekvátního tvaru pro sdílení toho, co nelze redukovat na informaci.' },
                  ] as const).map(({ name, era, text }) => (
                    <div key={name} className="flex gap-4 rounded-2xl border border-white/8 bg-black/30 p-5">
                      <div className="shrink-0 mt-3">
                        <div className="w-2 h-2 rounded-full bg-amber-300" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{era}</p>
                        <h3 className="text-lg font-semibold text-amber-200 mb-1">{name}</h3>
                        <p className="text-sm leading-7 text-gray-400">{text}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p>
                  Tato historická trajektorie nám umožňuje pochopit Ekam střízlivěji a hlouběji. Linie jednoty se nikdy nechtěla zastavit u soukromého zážitku. Vždy nesla civilizační ambici: bez proměny vědomí nevzniká ani nová kultura, ani nová ekonomika, ani nová technologie.
                </p>
              </div>
            </section>

            {/* KAP 4 */}
            <section id="kapitel-4" className="mb-24 scroll-mt-24">
              <div className="mb-8 text-center">
                <div className="text-sm text-amber-300 uppercase tracking-wider mb-2">Kapitola 4</div>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-3">Amma a Bhagavan</h2>
                <p className="text-gray-400 text-lg italic">Dvojjediny princip lásky a vhledu</p>
              </div>
              <div className="space-y-5 text-base leading-8 text-gray-300">
                <p>
                  Amma a Bhagavan nejsou v linii Ekam pouze zakladateli v organizačním smyslu. Reprezentují funkční princip, který tuto linii drží pohromadě — ne organizačně, ale symbolicky a ontologicky.
                </p>
                <div className="grid sm:grid-cols-2 gap-4 my-6">
                  <div className="rounded-2xl border border-rose-300/20 bg-rose-300/5 p-6">
                    <Heart className="w-6 h-6 text-rose-300 mb-3" />
                    <h3 className="text-xl font-bold text-white mb-2">Amma — princip lásky</h3>
                    <p className="text-sm leading-7 text-gray-300">
                      Amma ztělesňuje bezpodmínečné přijetí. Láskyplnou přítomnost, která nehodnotí a neodmítá. V linii Ekam je tato energie popsána jako sídlo soucitu — schopnost přijmout člověka přesně tam, kde je, bez požadavku, že nejprve uspěje.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-violet-300/20 bg-violet-300/5 p-6">
                    <Sun className="w-6 h-6 text-violet-300 mb-3" />
                    <h3 className="text-xl font-bold text-white mb-2">Bhagavan — princip vhledu</h3>
                    <p className="text-sm leading-7 text-gray-300">
                      Bhagavan Sri Kalki reprezentuje pronikající jasnost, která vidí skrz iluze. Kde Amma zahřeje, Bhagavan osvítí. Dohromady tvoří pole, v němž může proměna vejít do obou svých pohybů: přijetí a osvobození.
                    </p>
                  </div>
                </div>
                <p>
                  Pro mnoho následovníků ztělesňovali Amma a Bhagavan možnost, že probuzení není mýtus a že lidské vědomí lze vést jinak, než jak to dělá civilizace výkonu, traumatu a obrany.
                </p>
                <p>
                  Přenos linie na Sri Krishnaji a Sri Preethaji — jejich děti a nástupce vedení Ekam — není přerušením tohoto principu. Je pokračováním téže polarizace v nové generaci. Pole zůstává. Forma se přizpůsobuje.
                </p>
              </div>
            </section>

            {/* KAP 5 */}
            <section id="kapitel-5" className="mb-24 scroll-mt-24">
              <div className="mb-8 text-center">
                <div className="text-sm text-amber-300 uppercase tracking-wider mb-2">Kapitola 5</div>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-3">Deeksha</h2>
                <p className="text-gray-400 text-lg italic">Přenos jako technologie vědomí</p>
              </div>
              <div className="space-y-5 text-base leading-8 text-gray-300">
                <p>
                  Deeksha — sanskrtské slovo pro zasvěcení, přenos nebo milost — je v linii Ekam klíčovým operativním pojmem. Nelze ji plně redukovat ani na rituál, ani na psychologický zásah, ani na placebo. Je to popis specifické kvality přítomnosti a přenosu, která se snaží působit na samotnou strukturu vnímání.
                </p>
                <p>
                  V praxi Oneness a Ekam existuje Deeksha v několika formách. Sparsha Deeksha — přenos dotykem, kdy facilitátor jemně přiloží dlaně na hlavu příjemce. Smarana Deeksha — přenos záměrem a přítomností bez fyzického kontaktu. Oneness Meditation — skupinové pole s vedením. A přenos skrze samotnou architekturu a atmosféru chrámu Ekam.
                </p>
                <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-6 my-6">
                  <p className="text-amber-200 font-semibold mb-3">Co Deeksha tvrdí, že dělá</p>
                  <ul className="space-y-2 text-sm text-gray-300">
                    {[
                      'Ztišuje neustálý mentální hluk odděleného já',
                      'Otevírá prostor pro přímou zkušenost jednoty',
                      'Uvolňuje emocionální uzly vázané na oddělené vnímání',
                      'Usnadňuje přechod od identifikace s myslí k prožívání přítomnosti',
                      'Nevytváří nový duchovní výkon — rozpouští potřebu ho vytvářet',
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <ChevronRight className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <p>
                  Přímé zkušenosti patří nenahraditelné místo, protože pouze ona může zpochybnit suverenitu mentálního centra. Když člověk na chvíli zakusí stav, v němž není ovládán neustálou obranou — otvírá se mu možnost, že je skutečně možné žít jinak.
                </p>
              </div>
            </section>

            {/* KAP 6 */}
            <section id="kapitel-6" className="mb-24 scroll-mt-24">
              <div className="mb-8 text-center">
                <div className="text-sm text-amber-300 uppercase tracking-wider mb-2">Kapitola 6</div>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-3">Ekam a Golden Orb</h2>
                <p className="text-gray-400 text-lg italic">Chrám a zlaté centrum</p>
              </div>
              <div className="space-y-5 text-base leading-8 text-gray-300">
                <p>
                  Chrám Ekam v Andhra Pradesh je fyzickým tělem tohoto pole. Bílý mramor, mohutná střecha, geometrie inspirovaná védskou architekturou a posvátnými vzorci Sri Chakry. Ale chrám není cílem. Je nástrojem — prostorem, který byl záměrně zkonstruován tak, aby v přítomném člověku probouzel ozvěnu toho, co je na proměnu připraveno.
                </p>
                <div className="text-center py-6">
                  <p className="text-2xl text-amber-300 font-bold mb-3">Zlatý zárodek vědomí je v centru každého člověka.</p>
                  <p className="text-gray-400">Zlatý věk není budoucnost, která přijde sama od sebe.<br />Je to stav vědomí, který musí být probuzen.</p>
                </div>
                <p>
                  Golden Orb — zlatá koule uprostřed chrámového pole — není dekorativní prvek. Je to kondenzovaný symbol klíčové teze: jako je semeno v jádru plodu, tak je zárodek jednoty v jádru odděleného já. Nezničitelný. Čekající.
                </p>
                <div className="rounded-2xl border border-white/10 bg-black/40 p-6 my-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Ekam jako planetární pole</p>
                  <p className="text-sm leading-7 text-gray-300">
                    Fyzický chrám je jedním uzlem. Ekam pracuje s myšlenkou, že skupinová meditace v synchronizaci přes vzdálenost buduje globální pole vědomí — podobně, jak lokální sítě tvoří internet. Kritická masa probuzených vědomí se v této logice mění z osobního osvobození ve civilizační sílu.
                  </p>
                </div>
              </div>
            </section>

            {/* KAP 7 */}
            <section id="kapitel-7" className="mb-24 scroll-mt-24">
              <div className="mb-8 text-center">
                <div className="text-sm text-amber-300 uppercase tracking-wider mb-2">Kapitola 7</div>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-3">Hiranyagarbha</h2>
                <p className="text-gray-400 text-lg italic">Zlatý zárodek — kosmologie stvoření</p>
              </div>
              <div className="space-y-5 text-base leading-8 text-gray-300">
                <p>
                  Hiranyagarbha — zlaté lůno, zlaté vejce — je jedním z nejstarších kosmologických obrazů védské tradice. V Rgvédu se zjevuje jako prvotní zárodek plovoucí v primordálních vodách. Nese Brahmu, duši vesmíru, první světlo, které se rozvinulo v existenci.
                </p>
                <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-6 my-6 text-center">
                  <Orbit className="w-8 h-8 text-amber-300 mx-auto mb-3" />
                  <p className="text-amber-200 italic text-lg">
                    „Na počátku bylo zlaté vejce, zárodek vesmíru.<br />
                    Z něho se zrodil veškerý svět — nebe, země, světlo, tma.“
                  </p>
                  <p className="text-gray-500 text-sm mt-2">— Rigvéda, hymnus na Hiranyagarbhu</p>
                </div>
                <p>
                  V kontextu linie Ekam dostává Hiranyagarbha novou vrstvu čtení. Není to pouze kosmologický archetyp. Je to popis stavu, do nějž může vědomí vstoupit: primordální ticho před první myšlenkou. Neutrálnost zárodku. Plnost, která ještě není rozdělena na já a jiné.
                </p>
                <div className="grid sm:grid-cols-3 gap-4 my-4">
                  {([
                    { dim: 'Védská kosmologie', t: 'Zlaté vejce pluje v primordálních vodách. Nese zárodek celého stvořeného světa.' },
                    { dim: 'Linie Ekam',        t: 'Golden Orb jako centrum chrámu — kondenzovaný symbol zárodku nového vědomí.' },
                    { dim: 'ZION PoW',          t: 'Ekam Deeksha hash pipeline začíná fází Hiranyagarbha — inicializací zlatého zárodku z hlavičky bloku.' },
                  ] as const).map(({ dim, t }) => (
                    <div key={dim} className="rounded-xl border border-white/8 bg-black/30 p-4 text-center">
                      <p className="text-xs text-amber-300 font-semibold uppercase tracking-wider mb-2">{dim}</p>
                      <p className="text-sm text-gray-400 leading-6">{t}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* KAP 8 */}
            <section id="kapitel-8" className="mb-24 scroll-mt-24">
              <div className="mb-8 text-center">
                <div className="text-sm text-amber-300 uppercase tracking-wider mb-2">Kapitola 8</div>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-3">Ekam Deeksha PoW</h2>
                <p className="text-gray-400 text-lg italic">Algoritmus jako zlatý zárodek — Cosmic Harmony v3</p>
              </div>
              <div className="space-y-5 text-base leading-8 text-gray-300">
                <p>
                  ZION TerraNova nese jméno Ekam Deeksha v samotném jádru svého proof-of-work algoritmu — Cosmic Harmony v3. Nejde o náhodné pojmenování. Struktura algoritmu záměrně zrcadlí cestu vědomí od zárodku k celku.
                </p>
                <p>
                  Každý blok, který miner vytěží, prochází šestistupňovým pipeline. Každý stupeň nese jméno védského kosmologického principu. A každý stupeň má technický důvod, který koresponduje s jeho symbolickým názvem.
                </p>
                <div className="my-6 space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">6-stupňový pipeline Ekam Deeksha</p>
                  {algoSteps.map((step, i) => (
                    <div key={step.id} className={`flex gap-4 rounded-xl border ${step.border} ${step.bg} p-4`}>
                      <div className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-full border ${step.border} text-xs font-bold ${step.color}`}>
                        {i}
                      </div>
                      <div>
                        <p className={`font-bold text-base ${step.color} mb-1`}>{step.name}</p>
                        <p className="text-sm text-gray-400 leading-6">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-base font-semibold text-white mt-6 mb-3">ASIC rezistence — dvouvrstvá ochrana</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {algoTiers.map(({ tier, title, desc }) => (
                    <div key={tier} className="rounded-2xl border border-sky-300/20 bg-sky-300/5 p-5">
                      <p className="text-xs font-bold text-sky-300 uppercase tracking-wider mb-1">{tier}</p>
                      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
                      <p className="text-sm text-gray-400 leading-6">{desc}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-6 mt-6">
                  <Atom className="w-6 h-6 text-amber-300 mb-3" />
                  <p className="text-amber-200 font-semibold mb-2">Proč toto pojmenování není jen dekorace</p>
                  <p className="text-sm leading-7 text-gray-300">
                    Hiranyagarbha inicializuje zárodek výpočtu z primordálního chaosu vstupních dat. Brahma rozvíjí stavový prostor do plné 256 KiB oblasti. Yantra vnáší geometriku posvátného vzorce. Karma aplikuje epochálně proměnné váhy — žádný výpočet není totožný s minulou epochou. Chit integruje vše do čistého stavu vědomí. Samadhi dosahuje finálního sjednocení — platného PoW.
                  </p>
                  <p className="text-sm leading-7 text-gray-300 mt-3">
                    Blockchain tak nese filozofii, která ho pojmenovala, přesně v technické struktuře svého důkazu práce. To je konvergence Quantové Revoluce a Ekam Deeksha: jedno v blocích, druhé ve vědomí.
                  </p>
                </div>
              </div>
            </section>

            {/* KAP 9 */}
            <section id="kapitel-9" className="mb-24 scroll-mt-24">
              <div className="mb-8 text-center">
                <div className="text-sm text-amber-300 uppercase tracking-wider mb-2">Kapitola 9</div>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-3">Algoritmus Zlatého věku</h2>
                <p className="text-gray-400 text-lg italic">Deset kroků od separace k jednotě</p>
              </div>
              <div className="space-y-5 text-base leading-8 text-gray-300">
                <p>
                  Zlatý věk není utopie, není apokalyptický zlom ani propagandistické heslo. Je to posun vnímání, vztahů a institucí. Klíčové slovo je posun — ne revoluce shora, ne záchrana zvenčí. Proměna zevnitř.
                </p>
                <div className="space-y-3 my-6">
                  {([
                    { n: 1,  step: 'Zastavení hluku',          desc: 'Vědomá pauza — přerušení automatického proudu myšlenek, notifikací a reakcí. Bez ticha nelze nic rozpoznat.' },
                    { n: 2,  step: 'Rozpoznání separace',       desc: 'Vidět, kdy jednáme z oddělenosti — ze strachu, obrany, potřeby potvrzení. Samotné rozpoznání začíná měnit vzorec.' },
                    { n: 3,  step: 'Otevření srdce',            desc: 'Pohyb od hlavy jako jediného centra k celému tělu jako poli vnímání. Srdce jako druhý mozek.' },
                    { n: 4,  step: 'Aktivace citlivosti',       desc: 'Schopnost být skutečně přítomen — s druhým člověkem, s přírodou, s vlastním tělem. Bez hodnocení.' },
                    { n: 5,  step: 'Přenos a Deeksha',          desc: 'Prolomení izolace sebe-interpretace přijetím impulzu z pole vědomí, které je hlubší než individuální mysl.' },
                    { n: 6,  step: 'Stabilizace',               desc: 'Integrace nového stavu do každodenního života. Bez stabilizace je každé probuzení jen dočasná výjimka.' },
                    { n: 7,  step: 'Služba',                    desc: 'Obrat od sebestřednosti k péči. Probuzení, které neslouží druhým, se uzavírá zpět do rafinovanějšího ega.' },
                    { n: 8,  step: 'Vytváření lokálních polí',  desc: 'Tvoření prostorů a komunit, kde jsou podmínky pro proměnu vědomí přítomny. Každý takový uzel je buňkou nové civilizace.' },
                    { n: 9,  step: 'Síťování',                  desc: 'Propojení lokálních polí do vzájemně podporující se sítě. Od izolovaných ostrovů k archipelagu vědomí.' },
                    { n: 10, step: 'Civilizační manifestace',   desc: 'Nové vzdělávání, nová ekonomika, nová politika — ne jako ideologický program, ale jako přirozený výsledek dostatečně mnoha proměněných lidí.' },
                  ] as const).map(({ n, step, desc }) => (
                    <div key={n} className="flex gap-4 rounded-xl border border-white/8 bg-black/30 p-4">
                      <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-amber-300/10 border border-amber-300/30 text-amber-300 text-xs font-bold">
                        {n}
                      </div>
                      <div>
                        <p className="font-semibold text-white text-sm mb-1">{step}</p>
                        <p className="text-xs leading-6 text-gray-400">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p>
                  Tento algoritmus není lineární v tom smyslu, že by se kroky přecházelo jednou a navždy. Je to spirála. Vracíme se k tichu znovu a znovu. A každý obrat zvětšuje dosah civilizační změny.
                </p>
              </div>
            </section>

            {/* ZÁVĚR */}
            <section id="zaver" className="mb-24 scroll-mt-24">
              <div className="mb-8 text-center">
                <h2 className="text-4xl md:text-5xl font-bold text-amber-300 mb-3">Závěr</h2>
                <p className="text-gray-400 text-lg italic">Kdy začíná Zlatý věk</p>
              </div>
              <div className="space-y-6 text-center">
                <p className="text-xl leading-relaxed text-gray-300">
                  Zlatý věk nezačíná, když se změní vláda.<br />
                  Nezačíná, když se vymyslí dostatečně dobrý systém.<br />
                  Nezačíná ani tehdy, když technologie dosáhne dostatečné složitosti.
                </p>
                <p className="text-base leading-8 text-gray-400">
                  Zlatý věk začíná vždy, když se jeden konkrétní člověk<br />
                  přestane prožívat jako uzavřený ostrov.<br />
                  A toto je přesně to, co linie Ekam Deeksha hledá<br />
                  od prvních dnů Jeevashram až po dnešní pole chrámu Ekam.
                </p>
                <div className="my-10 p-8 rounded-2xl border border-amber-300/30 bg-amber-300/5 backdrop-blur-xl">
                  <Globe className="w-8 h-8 text-amber-300 mx-auto mb-4" />
                  <p className="text-lg italic text-gray-300 leading-relaxed">
                    Quantová Revoluce ukázala, že civilizace z vnějšku nemůže být zachráněna bez vnitřní proměny člověka.<br /><br />
                    Ekam Deeksha ukazuje, jak tato vnitřní proměna vypadá —<br />
                    v historii, v filozofii, v prostoru chrámu, v Deeksha přenosu,<br />
                    v zlatém zárodku Hiranyagarbhy<br />
                    a v každém bloku ZION blockchainu pojmenovaném po tomto přechodu.
                  </p>
                </div>
                <p className="text-gray-400 text-sm">
                  Obě knihy jsou jednou knihou.<br />
                  Jedna mluví o světě. Druhá mluví o člověku, který ho tvoří.<br />
                  Bez obou polí žádná mapa nestačí.
                </p>
                <p className="text-center text-amber-300 font-semibold text-2xl mt-10">
                  Ekam. Jedno. Tady. Teď. Ty.
                </p>
              </div>
            </section>

            {/* CTA */}
            <div className="mb-20 border-t border-white/10 pt-28 text-center space-y-4">
              <p className="text-gray-400 text-sm">Prozkoumej dál</p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link href="/ekam" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/15 bg-white/8 text-sm font-semibold text-white hover:border-amber-300/30 transition-colors">
                  Ekam — virtuální prohlídka
                </Link>
                <Link href="/roadmap" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-sky-300/20 bg-sky-300/8 text-sm font-semibold text-sky-100 hover:border-sky-200/30 transition-colors">
                  Roadmap ZION
                </Link>
                <Link href="/docs" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-amber-300/20 bg-amber-300/8 text-sm font-semibold text-amber-100 hover:border-amber-200/30 transition-colors">
                  Dokumentace
                </Link>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

