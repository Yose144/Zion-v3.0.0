import InfoPage from '@/components/info/InfoPage';
import { tr } from '@/lib/translations';
import { COMPANY } from '@/lib/invoice';

export const metadata = {
  title: 'O nás | ZION Market',
  description: 'Firemní údaje a kontakt ZION Market.',
};

export default function AboutPage() {
  return (
    <InfoPage
      title={tr('info', 'aboutTitle', 'cs')}
      subtitle={tr('info', 'aboutSubtitle', 'cs')}
    >
      <h2>ZION Market</h2>
      <p>Technologie | Umění | Vědomá komunita</p>

      <h2>Provozovatel</h2>

      <h3>Společnost</h3>
      <ul>
        <li>{COMPANY.name}</li>
        <li>IČ: {COMPANY.ico}</li>
        <li>DIČ: {COMPANY.dic}</li>
      </ul>

      <h3>Sídlo</h3>
      <ul>
        <li>{COMPANY.address}</li>
        <li>{COMPANY.city}, {COMPANY.country}</li>
        <li>Zápis: {COMPANY.court}</li>
        <li>Č. j.: {COMPANY.fileNo}</li>
      </ul>

      <h3>Transparentní účet</h3>
      <ul>
        <li>{COMPANY.bankName}</li>
        <li>Účet: {COMPANY.bankAccount}</li>
        <li>IBAN: {COMPANY.iban}</li>
        <li>BIC/SWIFT: {COMPANY.swift}</li>
      </ul>

      <h2>Kontakt</h2>
      <p>Máte dotaz nebo nápad na spolupráci? Kontaktujte nás přímo emailem.</p>
      <ul>
        <li>E-mail: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a></li>
      </ul>

      <h2>Naše mise</h2>
      <div className="highlight-box">
        <p>Společně tvoříme lepší budoucnost. One Love je cesta.</p>
      </div>
    </InfoPage>
  );
}
