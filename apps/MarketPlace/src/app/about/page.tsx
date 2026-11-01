import InfoPage from '@/components/info/InfoPage';
import { T } from '@/components/info/T';
import { COMPANY } from '@/lib/invoice';

export const metadata = {
  title: 'O nás | ZION Market',
  description: 'Firemní údaje a kontakt ZION Market.',
};

export default function AboutPage() {
  return (
    <InfoPage
      titleKey="info.aboutTitle"
      subtitleKey="info.aboutSubtitle"
      icon="🌟"
    >
      <h2>ZION Market</h2>
      <p className="text-center text-gray-400 mb-8">
        <T
          cs="Technologie | Umění | Vědomá komunita"
          en="Technology | Art | Conscious Community"
        />
      </p>

      <h2>
        <T cs="Provozovatel" en="Operator" />
      </h2>

      <div className="pillar-grid">
        <div className="pillar-card">
          <div className="icon">🏢</div>
          <h4>
            <T cs="Společnost" en="Company" />
          </h4>
          <p><strong>{COMPANY.name}</strong></p>
          <p><T cs="IČ" en="Company ID" />: {COMPANY.ico}</p>
          <p><T cs="DIČ" en="VAT ID" />: {COMPANY.dic}</p>
        </div>

        <div className="pillar-card">
          <div className="icon">📍</div>
          <h4>
            <T cs="Sídlo" en="Registered office" />
          </h4>
          <p><strong>{COMPANY.address}</strong></p>
          <p>{COMPANY.city}, {COMPANY.country}</p>
          <p><T cs="Zápis" en="Registered" />: {COMPANY.court}</p>
          <p><T cs="Č. j." en="File no." />: {COMPANY.fileNo}</p>
        </div>

        <div className="pillar-card">
          <div className="icon">🏛️</div>
          <h4>
            <T cs="Transparentní účet" en="Transparent account" />
          </h4>
          <p><strong>{COMPANY.bankName}</strong></p>
          <p><T cs="Účet" en="Account" />: {COMPANY.bankAccount}</p>
          <p>IBAN: {COMPANY.iban}</p>
          <p>BIC/SWIFT: {COMPANY.swift}</p>
        </div>
      </div>

      <h2>
        <T cs="Kontakt" en="Contact" />
      </h2>
      <p className="text-center text-gray-400 mb-6">
        <T
          cs="Máte dotaz nebo nápad na spolupráci? Kontaktujte nás přímo emailem."
          en="Do you have a question or a partnership idea? Reach us directly by e-mail."
        />
      </p>
      <div className="highlight-box text-center">
        <p className="text-lg font-bold mb-2">
          <a href={`mailto:${COMPANY.email}`} className="text-rasta-gold hover:text-white transition-colors">{COMPANY.email}</a>
        </p>
        <p>
          <T cs="Web" en="Web" />:{' '}
          <a href={`https://${COMPANY.web}`} target="_blank" rel="noopener noreferrer">{COMPANY.web}</a>
        </p>
      </div>

      <h2>
        <T cs="Naše mise" en="Our mission" />
      </h2>
      <div className="highlight-box">
        <p className="text-center italic text-lg">
          <T
            cs="Společně tvoříme lepší budoucnost. One Love je cesta."
            en="Together we are building a better future. One Love is the way."
          />
        </p>
      </div>
    </InfoPage>
  );
}
