import InfoPage from '@/components/info/InfoPage';
import { tr } from '@/lib/translations';
import { COMPANY } from '@/lib/invoice';

export const metadata = {
  title: 'Právní informace | ZION Market',
  description: 'Právní informace a upozornění k projektu ZION Terra Nova.',
};

export default function LegalPage() {
  return (
    <InfoPage
      title={tr('info', 'legalTitle', 'cs')}
      subtitle={tr('info', 'legalSubtitle', 'cs')}
      icon="⚖️"
    >
      <p className="update-date">Poslední aktualizace: Leden 2026</p>

      <h2>1. Úvod</h2>
      <p>ZION Terra Nova (dále jen „ZION" nebo „projekt") je experimentální open-source iniciativa, která kombinuje decentralizované technologie s filozofickými a duchovními principy. Projekt slouží jako prostor pro výzkum, tvorbu a sdílení vědomých technologií.</p>

      <div className="seller-info">
        <p><strong>Provozovatel webu:</strong> {COMPANY.name}</p>
        <p><strong>IČ:</strong> {COMPANY.ico}</p>
        <p><strong>Sídlo:</strong> {COMPANY.address}, {COMPANY.city}, {COMPANY.country}</p>
        <p><strong>Kontakt:</strong> <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a></p>
      </div>

      <div className="highlight-box">
        <p>ZION není klasická kryptoměna ani investiční produkt. Je to technologický experiment zaměřený na podporu vědomého rozvoje jednotlivců i komunit.</p>
      </div>

      <h2>2. Povaha projektu</h2>
      <p>Projekt ZION je:</p>
      <ul>
        <li><strong>Experimentální</strong> – Ve fázi aktivního vývoje, testování a iterací</li>
        <li><strong>Open-source</strong> – Veškerý kód je veřejně dostupný k nahlédnutí a úpravám</li>
        <li><strong>Komunitní</strong> – Rozvíjen a spravován decentralizovanou komunitou</li>
        <li><strong>Neziskový v duchu</strong> – Primárním cílem není zisk, ale pozitivní dopad</li>
      </ul>

      <div className="warning-box">
        <p>Důležité upozornění: Veškerá účast v projektu je na vlastní odpovědnost. Projekt neposkytuje žádné záruky ohledně funkčnosti, stability nebo budoucího vývoje.</p>
      </div>

      <h2>3. Žádná investice</h2>
      <p>ZION Terra Nova výslovně odmítá jakékoliv vnímání jako investiční příležitost:</p>
      <ul>
        <li>Digitální jednotky ZION nejsou cenné papíry ani investiční nástroje</li>
        <li>Projekt neslibuje žádné finanční výnosy ani zhodnocení</li>
        <li>Účast v projektu by neměla být motivována finančním ziskem</li>
        <li>Hodnota digitálních jednotek může být kdykoliv nulová</li>
      </ul>
      <p>Pokud hledáte investiční příležitost, ZION není pro vás. Projekt je určen pro ty, kdo chtějí aktivně přispívat k rozvoji vědomých technologií a komunity.</p>

      <h2>4. Blockchain a digitální jednotky</h2>
      <p>ZION využívá vlastní blockchain postavený na principu Proof-of-Work s následujícími charakteristikami:</p>
      <ul>
        <li>Cosmic Harmony – Vlastní mining algoritmus podporující decentralizaci</li>
        <li>Consciousness Mining – Gamifikovaný systém odměňující pozitivní účast</li>
        <li>Humanitární fond – 10% z každého bloku putuje na dobročinné účely</li>
      </ul>
      <p>Digitální jednotky ZION slouží primárně jako:</p>
      <ul>
        <li>Prostředek pro účast v DAO governance</li>
        <li>Odměna za přispění do komunity</li>
        <li>Experimentální médium pro výzkum tokenomiky</li>
      </ul>

      <h2>5. Open-source licence</h2>
      <p>Veškerý kód projektu ZION je dostupný pod open-source licencí na GitHubu. To znamená, že:</p>
      <ul>
        <li>Každý může kód prohlížet, studovat a auditovat</li>
        <li>Každý může kód forkovat a upravovat pro vlastní účely</li>
        <li>Každý může přispívat do oficiálního repozitáře</li>
        <li>Kód je dodáván „tak jak je", bez záruk jakéhokoliv druhu</li>
      </ul>
      <p>GitHub: <a href="https://github.com/Zion-TerraNova" target="_blank" rel="noopener noreferrer">github.com/Zion-TerraNova</a></p>

      <h2>6. Vědomé používání</h2>
      <p>Účastníci projektu ZION se zavazují k vědomému a odpovědnému přístupu:</p>
      <ul>
        <li>Vzdělávejte se – Pochopte technologii před její používáním</li>
        <li>Neriskujte víc, než si můžete dovolit – Experimentální projekty nesou rizika</li>
        <li>Přispívejte pozitivně – Komunita roste díky konstruktivním příspěvkům</li>
        <li>Respektujte ostatní – Různorodost názorů obohacuje projekt</li>
      </ul>

      <h2>7. Filozofie projektu</h2>
      <p className="text-center italic text-lg my-6">„Technologie bez lásky je jen strojírenství. Technologie s láskou je magie."</p>
      <p>ZION Terra Nova stojí na následujících pilířích:</p>
      <ul>
        <li><strong>Vědomí nad ziskem</strong> – Duchovní a osobní rozvoj je důležitější než finanční metriky</li>
        <li><strong>Transparentnost</strong> – Otevřená komunikace a veřejný kód</li>
        <li><strong>Decentralizace</strong> – Žádná centrální autorita, komunita rozhoduje</li>
        <li><strong>Harmonie</strong> – Technologie by měla sloužit přírodě, ne proti ní</li>
      </ul>

      <h2>8. Soukromí</h2>
      <p>Projekt ZION respektuje soukromí všech účastníků:</p>
      <ul>
        <li>Mining a používání blockchainu nevyžaduje identifikaci</li>
        <li>Webové stránky používají minimální tracking pouze pro technické účely</li>
        <li>Žádná osobní data nejsou prodávána třetím stranám</li>
        <li>Účast v komunitě může být anonymní</li>
      </ul>

      <h2>9. Závěrečné slovo</h2>
      <p>ZION Terra Nova je víc než projekt – je to experiment ve vědomém vytváření technologií. Negarantujeme nic kromě upřímného úsilí o vytvoření něčeho pozitivního pro svět.</p>
      <p>Děkujeme, že jste součástí této cesty. Ať už jako těžař, vývojář, nebo prostě někdo, kdo věří v lepší budoucnost – vaše účast má význam.</p>
    </InfoPage>
  );
}
