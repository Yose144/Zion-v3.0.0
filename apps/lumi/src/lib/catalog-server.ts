import { PRODUCTS } from '@/data/catalog';
import { prisma } from '@/lib/db';

export interface SaleRow {
  externalId: string;
  priceCzk: number;
  oldPriceCzk: number | null;
  stock: number;
  active: boolean;
  sortOrder: number;
}

let seedPromise: Promise<void> | null = null;

/**
 * Naplní prodejní řádky z katalogu.
 *
 * **Nikdy nepřepisuje existující řádek** (`update: {}`) — cena a sklad
 * patří administraci. Dřív se seedoval jen prázdný katalog, takže produkt
 * přidaný do `catalog.ts` později neměl v DB řádek a checkout ho odmítl
 * („Produkt není v nabídce“). Teď se doplní jen chybějící externalId.
 */
export async function seedMissing(): Promise<void> {
  for (const product of PRODUCTS) {
    try {
      await prisma.product.upsert({
        where: { externalId: product.externalId },
        update: {},
        create: {
          externalId: product.externalId,
          priceCzk: product.priceCzk,
          oldPriceCzk: product.oldPriceCzk ?? null,
          stock: product.stock,
          active: product.active,
          sortOrder: product.sortOrder,
        },
      });
    } catch (error) {
      // Dva souběžné requesty nad prázdnou tabulkou: druhý upsert narazí
      // na unikátní externalId. Řádek už existuje, takže je to v pořádku.
      if ((error as { code?: string }).code !== 'P2002') throw error;
    }
  }
}

/** Memoizovaný seed při prvním requestu (jeden na proces). */
export async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = seedMissing().catch((error) => {
      seedPromise = null;
      throw error;
    });
  }
  return seedPromise;
}

/**
 * Vynutí kontrolu katalogu i po startu — používá `POST /api/seed` po
 * přidání produktu nebo nového motivu. Existující řádky nemění.
 */
export async function reseed(): Promise<void> {
  seedPromise = seedMissing();
  return seedPromise;
}


export async function getSaleRows(): Promise<Map<string, SaleRow>> {
  await ensureSeeded();
  const rows = await prisma.product.findMany();
  return new Map(
    rows.map((row) => [
      row.externalId,
      {
        externalId: row.externalId,
        priceCzk: row.priceCzk,
        oldPriceCzk: row.oldPriceCzk,
        stock: row.stock,
        active: row.active,
        sortOrder: row.sortOrder,
      },
    ]),
  );
}

export interface ProductView {
  externalId: string;
  slug: string;
  priceCzk: number;
  oldPriceCzk?: number;
  stock: number;
  active: boolean;
  sortOrder: number;
}

/** Katalog + prodejní data pro klienta (jedno volání). */
export async function getProductViews(): Promise<ProductView[]> {
  const rows = await getSaleRows();
  return PRODUCTS.map((product) => {
    const row = rows.get(product.externalId);
    return {
      externalId: product.externalId,
      slug: product.slug,
      priceCzk: row?.priceCzk ?? product.priceCzk,
      oldPriceCzk: row?.oldPriceCzk ?? product.oldPriceCzk,
      stock: row?.stock ?? product.stock,
      active: row?.active ?? product.active,
      sortOrder: row?.sortOrder ?? product.sortOrder,
    };
  }).sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getProductView(externalId: string): Promise<ProductView | undefined> {
  const views = await getProductViews();
  return views.find((view) => view.externalId === externalId);
}
