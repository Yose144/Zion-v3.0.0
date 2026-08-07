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
      icon="🌟"
    >
      <h2>ZION Market</h2>
      <p className="text-center text-gray-400 mb-8">Technologie | Umění | Vědomá komunita</p>

      <h2>Provozovatel</h2>

      <div className="pillar-grid">
        <div className="pillar-card">
          <div className="icon">🏢</div>
          <h4>Společnost</h4>
          <p><strong>{COMPANY.name}</strong></p>
          <p>IČ: {COMPANY.ico}</p>
          <p>DIČ: {COMPANY.dic}</p>
        </div>

        <div className="pillar-card">
          <div className="icon">📍</div>
          <h4>Sídlo</h4>
          <p><strong>{COMPANY.address}</strong></p>
          <p>{COMPANY.city}, {COMPANY.country}</p>
          <p>Zápis: {COMPANY.court}</p>
          <p>Č. j.: {COMPANY.fileNo}</p>
        </div>

        <div className="pillar-card">
          <div className="icon">🏛️</div>
          <h4>Transparentní účet</h4>
          <p><strong>{COMPANY.bankName}</strong></p>
          <p>Účet: {COMPANY.bankAccount}</p>
          <p>IBAN: {COMPANY.iban}</p>
          <p>BIC/SWIFT: {COMPANY.swift}</p>
        </div>
      </div>

      <h2>Kontakt</h2>
      <p className="text-center text-gray-400 mb-6">Máte dotaz nebo nápad na spolupráci? Kontaktujte nás přímo emailem.</p>
      <div className="highlight-box text-center">
        <p className="text-lg font-bold mb-2">
          <a href={`mailto:${COMPANY.email}`} className="text-rasta-gold hover:text-white transition-colors">{COMPANY.email}</a>
        </p>
        <p>Web: <a href={`https://${COMPANY.web}`} target="_blank" rel="noopener noreferrer">{COMPANY.web}</a></p>
      </div>

      <h2>Naše mise</h2>
      <div className="highlight-box">
        <p className="text-center italic text-lg">Společně tvoříme lepší budoucnost. One Love je cesta.</p>
      </div>
    </InfoPage>
  );
}
