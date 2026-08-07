import InfoPage from '@/components/info/InfoPage';
import { tr } from '@/lib/translations';

export const metadata = {
  title: 'O nás | ZION Market',
  description: 'Firemní údaje a kontakt ZION Terra Nova.',
};

export default function AboutPage() {
  return (
    <InfoPage
      title={tr('info', 'aboutTitle', 'cs')}
      subtitle={tr('info', 'aboutSubtitle', 'cs')}
    >
      <h2>ZION TerraNova®</h2>
      <p>Technologie | Umění | Vědomá komunita</p>

      <h2>Firemní údaje</h2>

      <h3>Společnost</h3>
      <ul>
        <li>ZION TerraNova®</li>
        <li>IČ: 09120050</li>
        <li>DIČ: CZ09120050</li>
      </ul>

      <h3>Sídlo</h3>
      <ul>
        <li>Horní Čermná</li>
        <li>561 56, Česká republika</li>
        <li>Zápis: Krajský soud v Hradci Králové</li>
        <li>Č. j.: 00215716</li>
      </ul>

      <h3>Transparentní účet</h3>
      <ul>
        <li>Moneta Money Bank</li>
        <li>Účet: 259251079/0600</li>
        <li>IBAN: CZ68 0600 0000 0002 5925 1079</li>
        <li>BIC: AGBACZPP</li>
      </ul>

      <h2>Kontakt</h2>
      <p>Máte dotaz nebo nápad na spolupráci? Kontaktujte nás přímo emailem.</p>
      <ul>
        <li>E-mail: <a href="mailto:hello@zionterranova.com">hello@zionterranova.com</a></li>
        <li>Obchodní/dotazy: <a href="mailto:shop@zionterranova.com">shop@zionterranova.com</a></li>
        <li>GDPR: <a href="mailto:gdpr@zionterranova.com">gdpr@zionterranova.com</a></li>
      </ul>

      <h2>Naše mise</h2>
      <div className="highlight-box">
        <p>Společně tvoříme lepší budoucnost. One Love je cesta.</p>
      </div>
    </InfoPage>
  );
}
