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
 * První start (nebo prázdná tabulka) naplní prodejní řádky z katalogu.
 * Dál už se ceny a sklad mění jen v administraci — seed nic nepřepisuje.
 */
export async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = seed().catch((error) => {
      seedPromise = null;
      throw error;
    });
  }
  return seedPromise;
}

async function seed(): Promise<void> {
  const count = await prisma.product.count();
  if (count > 0) return;
  for (const product of PRODUCTS) {
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
  }
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
