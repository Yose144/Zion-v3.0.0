import { PrismaClient } from '@prisma/client';
import { shopProducts } from '../src/data/shopProducts';

const prisma = new PrismaClient();

async function main() {
  for (const product of shopProducts) {
    await prisma.shopProduct.upsert({
      where: { externalId: product.externalId },
      update: product,
      create: product,
    });
  }
  console.log(`Seeded ${shopProducts.length} shop products`);
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
