import { PrismaClient } from '@prisma/client';
import { shopProducts } from '../src/data/shopProducts';

const prisma = new PrismaClient();

async function main() {
  for (const product of shopProducts) {
    // filesUrl drží operátor v produkci; katalog ho nemusí mít. `undefined`
    // znamená "pole nechat být", `null` by odkaz smazalo.
    const update = { ...product, filesUrl: product.filesUrl ?? undefined };
    await prisma.shopProduct.upsert({
      where: { externalId: product.externalId },
      update,
      create: product,
    });
  }
  console.log(`Seeded ${shopProducts.length} shop products`);

  // Archive Pass grants — `archive-pass:<externalId>` = purchase unlocks the
  // ZION Archive / Nirvana portal. Create-only (`update: {}`): production rows
  // may carry `passExpiresAt`/`endsAt` and the seed must not erase them.
  // Presence of the row is what matters — see src/lib/archive-pass.ts.
  const archivePassGrants: { externalId: string; value: string }[] = [
    {
      externalId: 'book-001',
      value: JSON.stringify({
        note: 'Kniha Království srdce — vstup do ZION Archivu',
      }),
    },
    {
      externalId: 'zion-pass-001',
      value: JSON.stringify({
        note: 'ZION Pass — vstup do Nirvany a ZION Archivu',
      }),
    },
  ];
  for (const grant of archivePassGrants) {
    await prisma.shopSetting.upsert({
      where: { key: `archive-pass:${grant.externalId}` },
      update: {},
      create: { key: `archive-pass:${grant.externalId}`, value: grant.value },
    });
  }
  console.log(`Ensured ${archivePassGrants.length} archive-pass grants`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
