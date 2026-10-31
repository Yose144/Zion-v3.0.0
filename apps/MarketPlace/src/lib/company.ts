/**
 * Canonical seller identity for invoices + transactional email.
 * Brand shopfront = ZION Market; legal entity on documents = Omnity.One s.r.o.
 */
export const COMPANY = {
  name: 'Omnity.One s.r.o.',
  ico: '09120050',
  dic: 'CZ09120050',
  address: 'Horní Čermná 229',
  city: '56156 Horní Čermná',
  country: 'Česká republika',
  court: 'Krajský soud v Hradci Králové',
  /** OR / spisová značka — V2 invoice `court_id` */
  fileNo: '00215716',
  bankAccount: '2901809148 / 2010',
  iban: 'CZ63 2010 0000 0029 0180 9148',
  swift: 'FIOBCZPPXXX',
  bankName: 'Fio banka, a.s.',
  web: 'https://market.zionterranova.com',
  shopUrl: 'https://market.zionterranova.com',
  /** IntroPage footer org mark — also served from MarketPlace /images/logo144.png */
  logoUrl: 'https://market.zionterranova.com/images/logo144.png',
} as const;

export function companySupportEmail(): string {
  return (
    process.env.SHOP_EMAIL?.trim() ||
    process.env.ADMIN_EMAIL?.trim() ||
    'shop@newearth.cz'
  );
}
