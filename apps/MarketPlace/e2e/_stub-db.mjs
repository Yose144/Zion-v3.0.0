// Prázdný stub pro testy čistých funkcí — `order-stock.ts` importuje
// `@/lib/db`, ale `prisma` používá až ve funkcích, které test nevolá.
export const prisma = new Proxy(
  {},
  {
    get() {
      throw new Error('test nesmí sáhnout na databázi');
    },
  },
);
