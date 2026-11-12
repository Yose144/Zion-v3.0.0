import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { LUMI_MOTIFS, MOTIF_PRODUCT_ID } from '@/data/lumiMotifs';
import type { ShopProductData } from '@/types/shop';
import LumiConfigurator from '@/components/lumi/LumiConfigurator';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Lumi — Království srdce | ZION Market',
  description:
    'Dřevěný lampion Lumi 2 z 3mm březové překližky. Šest motivových sad — příroda, svatba, květiny, oceán, vesmír a Vánoce — každou si prohlédnete ve 3D přesně podle výpalu.',
  alternates: { canonical: '/lumi' },
  openGraph: {
    title: 'Lumi — Království srdce',
    description:
      'Šest motivů, jeden lampion. Prohlédněte si každý ve 3D — model vychází z výpalových podkladů.',
    url: '/lumi',
    images: [{ url: LUMI_MOTIFS[0].image, width: 700, height: 700, alt: 'Lumi 2 — motiv Příroda' }],
  },
};

/**
 * Lumi v Marketu: šest motivů jednoho produktu.
 *
 * Cena a sklad jdou z DB (`lamp-001`) — stejné jako v e-shopu, žádná druhá
 * pravda. Motivy jsou prezentační data (`src/data/lumiMotifs.ts`) a vybraný
 * motiv se ukládá k řádku objednávky.
 */
export default async function LumiPage() {
  let product: ShopProductData | null = null;
  try {
    product = await prisma.shopProduct.findUnique({ where: { externalId: MOTIF_PRODUCT_ID } });
  } catch (error) {
    console.error('Lumi page: product lookup failed', error);
  }

  return (
    <main className="container mx-auto max-w-6xl px-4 py-10 md:py-14">
      {/* Příběhový banner Engine B v2 — společný úvod kolekcí. Na mobilu
          se zobrazuje celý (16:9), aby nezmizely postavy. */}
      <section className="mb-8 overflow-hidden rounded-3xl border border-white/10">
        <img
          src="/images/design-v1/kolekce-v2/kolekce-pribeh-960.webp"
          srcSet="/images/design-v1/kolekce-v2/kolekce-pribeh-960.webp 960w, /images/design-v1/kolekce-v2/kolekce-pribeh-1600.webp 1600w"
          sizes="(min-width: 1152px) 1120px, 100vw"
          alt="Tesař, Lumi a Malý princ s rozsvícenou lucernou v dílně u moře"
          width={1600}
          height={900}
          fetchPriority="high"
          decoding="async"
          className="h-auto w-full"
        />
      </section>

      <LumiConfigurator product={product} />

      <section className="mt-16 grid gap-6 md:grid-cols-3">
        <InfoCard
          title="Jak se složí"
          text="Přijde rozložený: osm dílů, půl hodiny a dřevěné lepidlo. Nasucho sestavíte, zkontrolujete vzory, pak lepíte jen spoje."
        />
        <InfoCard
          title="Co je v ceně"
          text="Vyřezané díly, tištěný návod a smirkový papír. Ke každému kusu kniha Království srdce a ZION Pass do Archivu a Nirvany."
        />
        <InfoCard
          title="Výběr motivu"
          text="Motiv, který si vyberete, jde s objednávkou do dílny. Když si nejste jistí, napište nám — pošleme vzorek řezu."
        />
      </section>
    </main>
  );
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="mb-2 font-display text-lg font-bold text-white">{title}</h2>
      <p className="text-sm leading-relaxed text-gray-400">{text}</p>
    </div>
  );
}
