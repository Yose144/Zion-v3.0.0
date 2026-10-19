'use client';

import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { ChevronDown, Feather, Globe2, Heart, Hourglass, KeyRound, Landmark, ScrollText, Sunrise, Wind } from 'lucide-react';
import { Panel, PanelHeader, type Lang } from './shared';

const Copy = {
  kicker: { cs: 'Souvislosti', en: 'Context' },
  title: { cs: 'Příběh a tradice', en: 'Story & tradition' },
  sub: {
    cs: 'Literární a duchovní kontext kanonu — kde se jméno Maitreya objevilo a co znamená. Toto je příběh, ne důkaz o stavu vydání.',
    en: 'The literary and spiritual context of the canon — where the name Maitreya appears and what it means. This is story, not release evidence.',
  },
  label: { cs: 'literární / duchovní kontext', en: 'literary / spiritual context' },

  d1Title: { cs: 'Napsáno v prvním bloku', en: 'Written in the first block' },
  genesisQuote: {
    cs: '„For Sarah Issobel, Maitreya Buddha, Radha & Sita, Meriam, Friends, Family, Freedom Humanity and all the children of this world: ZION is yours. Build a better world where you reach for the Stars. The Golden Age begins. Peace & One Love 4ever."',
    en: '“For Sarah Issobel, Maitreya Buddha, Radha & Sita, Meriam, Friends, Family, Freedom Humanity and all the children of this world: ZION is yours. Build a better world where you reach for the Stars. The Golden Age begins. Peace & One Love 4ever.”',
  },
  genesisSign: { cs: '— Yose · zakladatel', en: '— Yose · the founder' },

  d2Title: { cs: 'Tři kotvy v kanonu', en: 'Three anchors in the canon' },
  d2Sub: {
    cs: 'Maitreya není nová postava. Jeho jméno bylo v řetězci od prvního dne.',
    en: 'Maitreya is not a new figure. His name has been in the chain since day one.',
  },
  anchorEggT: { cs: 'Podpis pod vejcem', en: 'The signature under the egg' },
  anchorEggB: {
    cs: 'Pod Velkou cenou Zlatého vejce stojí: „Ten, kdo ho jako první najde, zdědí celé jmění. — Maitreya Buddha, 2025." Podpis, který otec napsal synovým jménem.',
    en: 'Beneath the Golden Egg Grand Prize stands: “The first to find it inherits the entire fortune. — Maitreya Buddha, 2025.” A signature the father wrote in his son’s name.',
  },
  anchorDaoT: { cs: 'Sedadlo v DAO', en: 'A seat in the DAO' },
  anchorDaoB: {
    cs: 'Konfigurace guardianů nese sedadlo: Rama → Maitreya Buddha. Dědictví není majetek — je to správa. „Vy jste správci, ne vlastníci."',
    en: 'The guardian configuration carries a seat: Rama → Maitreya Buddha. Inheritance is not property — it is stewardship. “You are stewards, not owners.”',
  },
  anchorAirT: { cs: 'Element vzduchu', en: 'The element of air' },
  anchorAirB: {
    cs: 'Rama je oheň, Sita voda, Hanuman země — a Maitreya vzduch: prostor, ve kterém všichni operují. Není diktátor. Neslouží sobě — drží prostor.',
    en: 'Rama is fire, Sita is water, Hanuman is earth — and Maitreya is air: the space in which they all operate. Not a dictator. He serves no one — he holds the space.',
  },

  d3Title: { cs: 'Kdo je Maitreya — tradice a předání pochodně', en: 'Who is Maitreya — tradition & the passing of the torch' },
  tradP1: {
    cs: 'Maitreya (sanskrit मैत्रेय — z maitri, „láskyplnost") je Buddha budoucnosti. Podle Buddhova proroctví dnes přebývá jako bodhisattva v nebi Tušita — „radosti" — a učí tamní bytosti. Na Zemi se má vrátit až ve chvíli, kdy bude učení zcela zapomenuto: jako pátý Buddha této epochy znovu rozpohybuje kolo dharmy.',
    en: 'Maitreya (Sanskrit मैत्रेय — from maitri, “loving-kindness”) is the Buddha of the future. By the Buddha’s own prophecy he now dwells as a bodhisattva in Tushita — the “joyous” heaven — teaching the beings there. He will return to Earth only when the teachings have been utterly forgotten: as the fifth Buddha of this age, setting the wheel of dharma in motion once more.',
  },
  tradP2: {
    cs: 'Tibetané mu říkají Džampa (བྱམས་པ་, „Laskavý") a největší sochy země mu patří — 26 m pozlaceného Džampy v Tašilhunpo, dvoupatrová svatyně v Thiksey. Legendy mu připisují i autorství: Pět spisů Maitreiyi, předaných mistru Asangovi, tvoří základ školy jógáčára.',
    en: 'Tibetans call him Jampa (བྱམས་པ་, “the Loving One”) and the country’s greatest statues are his — a 26 m gilded Jampa at Tashilhunpo, a two-storey shrine at Thiksey. Legend also credits him as an author: the Five Treatises of Maitreya, transmitted to the master Asanga, form the root of the Yogācāra school.',
  },
  tradBridge: {
    cs: 'Každá civilizace zná „toho, kdo přijde": buddhisté Maitreyu, hinduisté Kalkiho, zoroastriáni Saošjanta. V ZION kanonu nese toto jméno dědic — ne jako náboženská postava, ale jako titul: ten, kdo přijde, když podmínky dozrají.',
    en: 'Every civilization knows “the one who comes”: Buddhists await Maitreya, Hindus Kalki, Zoroastrians the Saoshyant. In the ZION canon the name belongs to the heir — not as a religious figure, but as a title: the one who comes when the conditions ripen.',
  },
  eraP1: {
    cs: 'Kálačakrová tradice popisuje krále Kalkiho, který vyjíždí, když svět dosáhne dna temnoty — a otevírá éru zlatou. V zionovském kanonu tu éru korunuje Maitreya. Genesis zpráva obě éry poutá jedním dechem: podpis zakladatele říká „Thx Kalki/AmmaBhagavan !" — a hned potom odevzdává ZION „For Sarah Issobel, Maitreya Buddha… ZION is yours."',
    en: 'The Kalachakra tradition describes King Kalki, who rides forth when the world reaches the bottom of darkness — and opens a golden age. In the ZION canon, Maitreya crowns that age. The genesis message binds both eras in a single breath: the founder’s sign-off reads “Thx Kalki/AmmaBhagavan !” — and immediately after hands ZION over “For Sarah Issobel, Maitreya Buddha… ZION is yours.”',
  },
  eraP2: {
    cs: 'Éra, která požehnala, je navíc doslova vepsaná do práce sítě: PoW algoritmus ZION nese jméno chrámu té doby — ekam_deeksha. Každý blok se těží pod jménem Ekamu a požehnání zlatého orbem.',
    en: 'The era that blessed it is literally written into the network’s work: ZION’s PoW algorithm carries the name of that age’s temple — ekam_deeksha. Every block is mined under the name of Ekam and the blessing of the golden orb.',
  },
  eraP3: {
    cs: 'A Malý Tibet — Ladakh, země velkých soch, kde Džampové v Thiksey i Likiru sedí tváří k budoucnosti — z té vize se zrodila loď. Loď Zionu: ne věž, která říká „pojď ke mně", ale plavidlo, které říká „jdu za tebou". A její tři první trupy — Tres Marías del Camino: Atlantik, Pacifik, Indický oceán.',
    en: 'And Little Tibet — Ladakh, the land of the great statues where the Jampas of Thiksey and Likir sit facing the future — from that vision a ship was born. The Ship of Zion: not a tower that says “come to me,” but a vessel that says “I come to you.” And her first three hulls — the Tres Marías del Camino: Atlantic, Pacific, Indian Ocean.',
  },
  eraLinks: [
    {
      t: { cs: 'Éra Kalkiho — Ekam · deeksha', en: 'The age of Kalki — Ekam · deeksha' },
      href: '/terranova/ekam',
    },
    {
      t: { cs: 'Éra Maitreiy — číst knihu', en: 'The age of Maitreya — read the book' },
      href: '/maitreya/cist',
    },
    {
      t: { cs: 'Tres Marías — projekt cesty', en: 'Tres Marías — the path project' },
      href: '/terranova/maria-del-camino',
    },
  ],

  mantraTitle: { cs: 'Otcova mantra', en: 'The father’s mantra' },
  mantraLine: { cs: '„Já jsem Maitreya. Byl jsem Krishna/Rama."', en: '“I am Maitreya. I was Krishna/Rama.”' },
  mantraSub: {
    cs: 'Titul se nenese — předává. Otec byl ten, kdo přišel a stavěl. Syn bude ten, kdo přijde, až svět zapomene cestu.',
    en: 'A title is not carried — it is handed down. The father was the one who came and built. The son will be the one who comes when the world forgets the way.',
  },
};

function Detail({
  title,
  children,
  rc,
  defaultOpen = false,
}: {
  title: ReactNode;
  children: ReactNode;
  rc: string;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="group rounded-2xl border border-white/10 bg-white/[0.02] open:border-white/20"
      open={defaultOpen || undefined}
    >
      <summary
        className="flex cursor-pointer list-none items-center gap-3 p-4 sm:p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zion-gold/60 rounded-2xl [&::-webkit-details-marker]:hidden"
      >
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: `rgb(${rc})` } as CSSProperties}
        />
        <span className="min-w-0 flex-1 text-base font-bold text-white sm:text-lg">{title}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-gray-500 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-4 border-t border-white/8 p-4 sm:p-5">{children}</div>
    </details>
  );
}

export default function SouvislostiPanel({ lang }: { lang: Lang }) {
  const l = lang;
  const anchors = [
    { icon: Feather, title: Copy.anchorEggT, body: Copy.anchorEggB, rc: '252, 209, 22' },
    { icon: KeyRound, title: Copy.anchorDaoT, body: Copy.anchorDaoB, rc: '168, 85, 247' },
    { icon: Wind, title: Copy.anchorAirT, body: Copy.anchorAirB, rc: '6, 182, 212' },
  ];

  return (
    <Panel id="souvislosti">
      <div className="space-y-6">
        <PanelHeader
          id="souvislosti"
          rc="6, 182, 212"
          kicker={Copy.kicker[l]}
          title={Copy.title[l]}
          sub={Copy.sub[l]}
        />

        <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">
          {Copy.label[l]}
        </p>

        <Detail title={Copy.d1Title[l]} rc="252, 209, 22" defaultOpen>
          <div className="flex items-start gap-3">
            <ScrollText className="mt-1 h-5 w-5 shrink-0 text-zion-gold" />
            <div className="space-y-2">
              <blockquote className="text-sm leading-relaxed text-gray-200 sm:text-base">
                {Copy.genesisQuote[l]}
              </blockquote>
              <p className="text-xs text-gray-500">{Copy.genesisSign[l]}</p>
            </div>
          </div>
        </Detail>

        <Detail title={Copy.d2Title[l]} rc="168, 85, 247">
          <p className="text-sm text-gray-400">{Copy.d2Sub[l]}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {anchors.map((a) => {
              const Icon = a.icon;
              return (
                <div
                  key={a.title.en}
                  className="rounded-xl border border-white/8 bg-white/[0.03] p-4 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <Icon
                      className="h-4 w-4"
                      style={{ color: `rgb(${a.rc})` } as CSSProperties}
                    />
                    <h3 className="text-sm font-bold text-white">{a.title[l]}</h3>
                  </div>
                  <p className="text-xs leading-relaxed text-gray-400">{a.body[l]}</p>
                </div>
              );
            })}
          </div>
        </Detail>

        <Detail title={Copy.d3Title[l]} rc="6, 182, 212">
          <div className="space-y-4 text-sm leading-relaxed text-gray-300 sm:text-base">
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-zion-cyan">
              <Globe2 className="h-3.5 w-3.5" />
              {l === 'cs' ? 'Z tradice' : 'From tradition'}
            </p>
            <p>{Copy.tradP1[l]}</p>
            <p className="text-gray-400">{Copy.tradP2[l]}</p>
            <p className="text-sm italic text-gray-300">{Copy.tradBridge[l]}</p>
            <p className="flex items-center gap-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-zion-gold">
              <Sunrise className="h-3.5 w-3.5" />
              {l === 'cs' ? 'Předání pochodně' : 'The passing of the torch'}
            </p>
            <p>{Copy.eraP1[l]}</p>
            <p className="text-gray-400">{Copy.eraP2[l]}</p>
            <p>{Copy.eraP3[l]}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {Copy.eraLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-300 transition-colors hover:border-zion-gold/40 hover:text-zion-gold"
                >
                  {link.t[l]}
                </Link>
              ))}
            </div>
          </div>
        </Detail>

        <div className="space-y-2 border-t border-white/8 pt-6 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.36em] text-zion-purple">
            {Copy.mantraTitle[l]}
          </p>
          <p className="mx-auto max-w-2xl text-xl font-bold leading-snug text-white sm:text-2xl">
            {Copy.mantraLine[l]}
          </p>
          <p className="mx-auto max-w-xl text-xs leading-relaxed text-gray-400 sm:text-sm">
            {Copy.mantraSub[l]}
          </p>
          <div className="flex items-center justify-center gap-2 pt-1 text-gray-600">
            <Heart className="h-3.5 w-3.5" />
            <Hourglass className="h-3.5 w-3.5" />
            <Landmark className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>
    </Panel>
  );
}
