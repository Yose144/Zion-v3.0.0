'use client';

import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import { MAITREYA_CHAPTERS, MAITREYA_PARTS } from '../chapters';
import { Panel, PanelHeader, type Lang } from './shared';

const Copy = {
  kicker: { cs: 'Kniha Pátá', en: 'Book Five' },
  title: { cs: 'Maitreya — celá kniha', en: 'Maitreya — the full book' },
  sub: {
    cs: 'Příběh o tom, jak padají věže Babylonu — a jak láska a pravda rodí Nový svět. Kompletní první draft, česky i anglicky; každá kapitola končí tabulkou ověřitelných faktů.',
    en: 'The story of how the towers of Babylon fall — and how love and truth give birth to the New World. Complete first draft, in Czech and English; every chapter ends with a table of verifiable facts.',
  },
  texts: { cs: 'textů', en: 'texts' },
  parts: { cs: 'částí', en: 'parts' },
  langs: { cs: 'CZ + EN', en: 'CZ + EN' },
  readAll: { cs: 'Číst celou knihu', en: 'Read the full book' },
  readAllNote: {
    cs: 'Jedna stránka čtečky s bočním obsahem — překlopitelná česky i anglicky.',
    en: 'A single reader page with a sidebar table of contents — switchable between Czech and English.',
  },
};

// Thematic part descriptions preserved from the original page copy.
const PART_DESC: { cs: string; en: string }[] = [
  {
    cs: 'Vejce, které se nerozbilo · Zárodek v každém bloku · Podpis, který otec napsal synovým jménem',
    en: 'The egg that did not break · The embryo in every block · The signature the father wrote in his son’s name',
  },
  {
    cs: 'Tři klíče, tři sedadla · Test odevzdání · Správce, ne majitel',
    en: 'Three keys, three seats · The test of surrender · Steward, not owner',
  },
  {
    cs: 'Peníze · Data · Energie · Význam · Trůn — pět věží, každá padá odchodem světla',
    en: 'Money · Data · Energy · Meaning · Throne — five towers, each falling by the withdrawal of light',
  },
  {
    cs: 'Pravda, kterou lze ověřit · Láska, která se neptá · Kvantový puls',
    en: 'The truth that can be verified · The love that does not ask · The quantum pulse',
  },
  {
    cs: 'Loď odplouvá · Dvanáct ohňů · Pohled z okna — a epilog: Kdo je Maitreya',
    en: 'The ship departs · Twelve fires · The view from the window — and an epilogue: Who is Maitreya',
  },
];

const PROLOGUE = MAITREYA_CHAPTERS.find((c) => c.part === 0);
const EPILOGUE = MAITREYA_CHAPTERS.find((c) => c.part === 6);
const TEXT_COUNT = MAITREYA_CHAPTERS.length;
const PART_COUNT = MAITREYA_PARTS.length - 2; // minus prologue & epilogue labels

function EdgeRow({
  href,
  num,
  title,
  lang,
}: {
  href: string;
  num: string;
  title: string;
  lang: Lang;
}) {
  return (
    <li>
      <Link
        href={href}
        className="group flex items-center gap-4 rounded-2xl border border-white/8 bg-white/[0.02] p-4 transition-colors hover:border-zion-gold/30 hover:bg-zion-gold/[0.04] sm:p-5"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zion-gold/25 bg-zion-gold/10 text-[10px] font-bold uppercase tracking-wider text-zion-gold">
          {num}
        </span>
        <span className="min-w-0 flex-1 font-bold text-white transition-colors group-hover:text-zion-gold">
          {title}
        </span>
        <BookOpen className="h-4 w-4 shrink-0 text-zion-gold/40 transition-colors group-hover:text-zion-gold" />
        <span className="sr-only">{lang === 'cs' ? 'číst' : 'read'}</span>
      </Link>
    </li>
  );
}

export default function KnihaPanel({ lang }: { lang: Lang }) {
  const l = lang;
  return (
    <Panel id="kniha">
      <div className="space-y-8">
        <PanelHeader
          id="kniha"
          rc="252, 209, 22"
          kicker={Copy.kicker[l]}
          title={Copy.title[l]}
          sub={Copy.sub[l]}
        />

        <div className="flex flex-wrap gap-2">
          {[
            `${TEXT_COUNT} ${Copy.texts[l]}`,
            `${PART_COUNT} ${Copy.parts[l]}`,
            Copy.langs[l],
          ].map((f) => (
            <span
              key={f}
              className="rounded-full border border-zion-gold/25 bg-zion-gold/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-zion-gold"
            >
              {f}
            </span>
          ))}
        </div>

        <ol className="space-y-3">
          {PROLOGUE && (
            <EdgeRow
              href={`/maitreya/cist#${PROLOGUE.slug}`}
              num={PROLOGUE.num[l]}
              title={PROLOGUE.title[l]}
              lang={l}
            />
          )}
          {MAITREYA_PARTS.slice(1, 6).map((part, i) => {
            const partNum = i + 1;
            const first = MAITREYA_CHAPTERS.find((c) => c.part === partNum);
            if (!first) return null;
            return (
              <li key={partNum}>
                <Link
                  href={`/maitreya/cist#${first.slug}`}
                  className="group flex items-start gap-4 rounded-2xl border border-white/8 bg-white/[0.02] p-4 transition-colors hover:border-zion-gold/30 hover:bg-zion-gold/[0.04] sm:p-5"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zion-gold/25 bg-zion-gold/10 text-sm font-bold text-zion-gold">
                    {['I', 'II', 'III', 'IV', 'V'][i]}
                  </span>
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="block font-bold text-white transition-colors group-hover:text-zion-gold">
                      {part[l]}
                    </span>
                    <span className="block text-sm leading-relaxed text-gray-500">
                      {PART_DESC[i][l]}
                    </span>
                  </span>
                  <BookOpen className="mt-1 h-4 w-4 shrink-0 text-zion-gold/40 transition-colors group-hover:text-zion-gold" />
                </Link>
              </li>
            );
          })}
          {EPILOGUE && (
            <EdgeRow
              href={`/maitreya/cist#${EPILOGUE.slug}`}
              num={EPILOGUE.num[l]}
              title={EPILOGUE.title[l]}
              lang={l}
            />
          )}
        </ol>

        <div className="flex flex-col items-start gap-2">
          <Link href="/maitreya/cist" className="zion-button-primary group">
            <BookOpen className="h-5 w-5" />
            {Copy.readAll[l]}
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <p className="text-xs text-gray-500">{Copy.readAllNote[l]}</p>
        </div>
      </div>
    </Panel>
  );
}
