/**
 * Kanonická identita prodávajícího. Lumi je samostatná značka, ale prodává
 * ji Omnity.One s.r.o. — na fakturách, v patičce i v e-mailech musí být
 * firma, ne ZION.
 */
export const COMPANY = {
  name: 'Omnity.One s.r.o.',
  brand: 'Lumi',
  ico: '09120050',
  dic: 'CZ09120050',
  /** SQLite schéma MarketPlace komentuje „neplátce DPH“ — ceny jsou konečné. */
  vatPayer: false,
  address: 'Horní Čermná 229',
  city: '561 56 Horní Čermná',
  country: 'Česká republika',
  court: 'Krajský soud v Hradci Králové',
  fileNo: 'C 00215716',
  bankAccount: process.env.LUMI_BANK_ACCOUNT || '2901809148/2010',
  iban: process.env.LUMI_BANK_IBAN || 'CZ6320100000002901809148',
  bic: process.env.LUMI_BANK_BIC || 'FIOBCZPPXXX',
  bankName: process.env.LUMI_BANK_NAME || 'Fio banka, a.s.',
  bankOwner: process.env.LUMI_BANK_OWNER || 'Omnity.One s.r.o.',
  email: process.env.LUMI_EMAIL_REPLY_TO || 'ahoj@lumi.zionterranova.com',
  /** Volitelné — bez vyplnění se telefon v kontaktu vůbec nezobrazí. */
  phone: process.env.LUMI_PHONE || '',
  web: process.env.NEXT_PUBLIC_SITE_URL || 'https://lumi.zionterranova.com',
  instagram: 'https://instagram.com/lumi',
} as const;

/** Fakturační údaje pro dokumenty (jedno místo pravdy). */
export const SELLER = {
  name: COMPANY.name,
  ico: COMPANY.ico,
  dic: COMPANY.vatPayer ? COMPANY.dic : null,
  address: COMPANY.address,
  city: COMPANY.city,
  country: COMPANY.country,
  court: COMPANY.court,
  fileNo: COMPANY.fileNo,
  bankAccount: COMPANY.bankAccount,
  iban: COMPANY.iban,
  bic: COMPANY.bic,
  bankName: COMPANY.bankName,
} as const;

export function supportEmail(): string {
  return process.env.LUMI_ADMIN_EMAIL?.trim() || COMPANY.email;
}
