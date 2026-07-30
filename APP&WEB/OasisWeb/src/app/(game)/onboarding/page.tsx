'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, BookOpen } from 'lucide-react';
import Link from 'next/link';

interface Chapter {
  title: string;
  paragraphs: string[];
  quote?: string;
}

const chapters: Chapter[] = [
  {
    title: 'Předmluva — Proč znovu Sůl této země',
    paragraphs: [
      'Sůl je malá. Není to zlato, není to ocel, není to palivo. A přesto bez ní chutná všechno mrtvě. Sůl nepřidává novou chuť — ona odhaluje tu, která tam už je.',
      'Tak je to i s příběhem: není to nové učení. Je to způsob, jak si každý může ověřit, kam vstupuje, a proč by tam vůbec chtěl jít.',
      'Tato kniha je nová verze starého záměru. Předchozí jedenáct epizod přineslo soli, vodu, kompas, loď a bránu. Teď se celá loď stěhuje do jednoho místa — do Oasis, do říše, kde se technologie, vědomí a neomezená fantazie setkávají.',
    ],
    quote: '„Zlatý věk nezačíná datem. Začíná rozhodnutím — a rozhodnutí začíná ve dveřích, které si člověk otevře sám."',
  },
  {
    title: '1. Sůl, která neztratila chuť',
    paragraphs: [
      'Bylo jednou jedno město, které zapomnělo na chuť. Lidé chodili po chodnících jako stíny. Každý nesl v ruce nějakou krabičku, která mu říkala, kolik ztratil a kolik může získat. Peníze se rozpouštěly rychleji, než je lidé stačili vydělat.',
      'Jedli, ale necítili chuť. Mluvili, ale neslyšeli se. Dívali se na obrazovky plné čísel, ale neviděli jeden druhého. A když večer zhasla světla, leželi v postelích a slyšeli, jak jim srdce bije, aniž by věděli, komu.',
      'A pak přišli poutníci. Ne jako vojsko. Ne jako politici. Ne jako noví bohové. Přinesli sůl, kompas, loď a čtyři knihy. Loď se jmenuje ZION. A každý, kdo chce, může vstoupit.',
      'Sůl, která neztratila chuť, je v této knize jednoduchá: nebudeme ti lhát o tom, co je hotové, a nebudeme ti brát radost z toho, co ještě stavíme.',
    ],
    quote: '„Bez téhle neucítíte nic. Ale když jí bude moc, spálí vás. Správné množství odhalí chuť, která tam už je."',
  },
  {
    title: '2. Rozpouštění starého světa',
    paragraphs: [
      'Než můžeš vstoupit do nového světa, musíš nechat starý rozpustit. To nás naučila Kvantová revoluce. Starý svět stojí na představě oddělenosti. Já proti tobě. Náš stát proti jejich. Moje peníze proti tvým. Tělo proti duši. Příroda proti člověku.',
      'Když se něco rozdělí, dá se to prodávat, zatěžovat, zbrojit, zavřít. Iluze oddělenosti je nejvýnosnější komodita na světě.',
      'Kvantová fyzika nám říká něco jiného. Fotony, které prošly dvěma štěrbinami, se chovají podle toho, zda se na ně díváme. Vesmír není lokální. Oddělenost je zkušenost, ne fakt.',
      'Proto musí starý svět rozpustit. Ne jako násilí. Jako sůl v misce vody. Rozpustit se znamená přestat se bránit vlastní proměně. A to je první krok k Oasis.',
    ],
    quote: '„Svět nedává smysl tvé mysli. Dává smysl vztahu mezi tebou a tím, co pozoruješ."',
  },
  {
    title: '3. Chuť vody a zlatého vejce',
    paragraphs: [
      'Když se sůl rozpustí, zůstane voda. Voda nemá svou vlastní chuť — a přesto dává chuť všemu. Tak je to s vědomím. Ono samo o sobě není nic. Ale bez něj není nic, co by mělo smysl.',
      'Třetí kniha, Ekam Deeksha, se ptá: co se musí stát uvnitř člověka? Odpověď není v novém telefonu, novém algoritmu ani nové vládě. Odpověď je v přestání věřit, že jsem oddělený bod, který musí neustále bojovat.',
      'V chrámu Ekam stojí Golden Orb — zlatá koule, symbol zlatého vejce, Hiranyagarbhy. Je to kosmologický klíč: na počátku je zárodek, který obsahuje celek. V ZIONu je tím zárodkem Genesis blok.',
      'Ekam znamená „Jedno" v sanskrtu. Ale ne jedno, které by všechny ostatní vymazalo. Je to jedno, které přijímá mnoho jmen. ZION není nárok na jednu tradici. Je to pozvánka ke kruhu, do kterého může přijít každý.',
    ],
    quote: '„Chuť vody je odpověď: slouží životu. Ne zisku. Ne chamtivosti. Ne kontrole. Životu."',
  },
  {
    title: '4. Cesta nevyšlapaná',
    paragraphs: [
      'Čtvrtá kniha, Terra Nova, se ptá: kam jít a co stavět? Odpověď není mapa. Je to kompas. Mapa předstírá, že terén už známe. Kompas říká jen: tudy je sever. A sever v ZIONu je vědomí.',
      'Terra Nova rozlišuje tři roviny pravdy: REALITA 2026 — co běží dnes, ROADMAP — co se staví, a HORIZONT — dlouhý směr. Tato kniha je poctivá, protože neříká, že horizont je už hotový.',
      'Cesta nevyšlapaná znamená, že nikdo jiný za tebe neprojde. Můžeme ti dát kompas. Můžeme ti dát společníky. Můžeme ti dát loď. Ale musíš jít ty.',
    ],
    quote: '„Mapa není terén. Ale dobrá mapa zachrání život."',
  },
  {
    title: '5. Archa, která nese všechny vrstvy',
    paragraphs: [
      'Genesis není jen první blok. Je to aricha — loď, která nese všechny vrstvy. Představ si ZION jako loď s šesti palubami. L1 je trup: Terra Nova blockchain v Rustu, Ekam Deeksha PoW, genesis blok. L2 jsou plachty: bridge, DeFi, DAO, wZION na Base. L3 je hvězdná navigace: AI Native, WARP, Hiranyagarbha.',
      'L4 je zahrada na palubě: OASIS. Hra, avataři, questy, Golden Egg, Consciousness Levels. L5 je skladiště a lékárna: Free World, humanitární tithe, komunity. L6 je koruna a kukaň: Issobella, orbitální stanice, SETI, pohled na Zemi z vesmíru.',
      'Každá paluba má svou funkci. Ale loď se řídí z kompasu vědomí. Když kompas ukazuje na chamtivost, loď narazí na útes. Když ukazuje na službu, projede i bouří.',
    ],
    quote: '„Lodi se neříká moje loď. Lodi se říká ZION — a ta patří všem dětem tohoto světa."',
  },
];

export default function OnboardingPage() {
  const [idx, setIdx] = useState(0);
  const chapter = chapters[idx];
  const progress = ((idx + 1) / chapters.length) * 100;

  return (
    <section className="mx-auto max-w-3xl">
      <motion.h1
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-oasis-cyan to-oasis-purple"
      >
        Sůl této země — Kniha brány
      </motion.h1>

      <div className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-1 backdrop-blur-sm">
        <div
          className="h-1.5 rounded-full bg-gradient-to-r from-oasis-cyan via-oasis-purple to-oasis-gold transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mb-4 flex items-center justify-between text-sm text-gray-400">
        <span className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-oasis-cyan" />
          Kapitola {idx + 1} z {chapters.length}
        </span>
        <span>{Math.round(progress)} %</span>
      </div>

      <div className="relative min-h-[420px] overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm sm:p-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.4 }}
          >
            <h2 className="mb-6 text-2xl font-bold text-oasis-cyan">{chapter.title}</h2>

            {chapter.quote && (
              <blockquote className="mb-6 border-l-4 border-oasis-gold/50 pl-4 italic text-oasis-gold">
                {chapter.quote}
              </blockquote>
            )}

            <div className="space-y-4 text-gray-300 leading-relaxed">
              {chapter.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="rounded-xl px-5 py-3 text-sm font-semibold text-gray-400 transition-colors hover:text-white disabled:opacity-30"
        >
          Zpět
        </button>

        {idx < chapters.length - 1 ? (
          <button
            onClick={() => setIdx((i) => Math.min(chapters.length - 1, i + 1))}
            className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-oasis-gold via-oasis-purple to-oasis-cyan px-8 py-4 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105"
          >
            Pokračovat
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
        ) : (
          <Link
            href="/dashboard"
            className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-oasis-cyan to-oasis-purple px-8 py-4 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105"
          >
            Vstoupit do Oasis
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        )}
      </div>
    </section>
  );
}
