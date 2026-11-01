import InfoPage from '@/components/info/InfoPage';
import { T } from '@/components/info/T';
import { COMPANY } from '@/lib/invoice';

export const metadata = {
  title: 'Právní informace | ZION Market',
  description: 'Právní informace a upozornění k projektu ZION Terra Nova.',
};

export default function LegalPage() {
  return (
    <InfoPage
      titleKey="info.legalTitle"
      subtitleKey="info.legalSubtitle"
      icon="⚖️"
    >
      <p className="update-date">
        <T cs="Poslední aktualizace: Leden 2026" en="Last updated: January 2026" />
      </p>

      <h2>
        <T cs="1. Úvod" en="1. Introduction" />
      </h2>
      <p>
        <T
          cs="ZION Terra Nova (dále jen „ZION“ nebo „projekt“) je experimentální open-source iniciativa, která kombinuje decentralizované technologie s filozofickými a duchovními principy. Projekt slouží jako prostor pro výzkum, tvorbu a sdílení vědomých technologií."
          en="ZION Terra Nova (hereinafter “ZION” or “the project”) is an experimental open-source initiative that combines decentralised technology with philosophical and spiritual principles. The project serves as a space for research, creation and sharing of conscious technology."
        />
      </p>

      <div className="seller-info">
        <p>
          <strong><T cs="Provozovatel webu:" en="Website operator:" /></strong> {COMPANY.name}
        </p>
        <p>
          <strong><T cs="IČ:" en="Company ID:" /></strong> {COMPANY.ico}
        </p>
        <p>
          <strong><T cs="Sídlo:" en="Registered office:" /></strong> {COMPANY.address}, {COMPANY.city}, {COMPANY.country}
        </p>
        <p>
          <strong><T cs="Kontakt:" en="Contact:" /></strong>{' '}
          <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
        </p>
      </div>

      <div className="highlight-box">
        <p>
          <T
            cs="ZION není klasická kryptoměna ani investiční produkt. Je to technologický experiment zaměřený na podporu vědomého rozvoje jednotlivců i komunit."
            en="ZION is not a conventional cryptocurrency or an investment product. It is a technological experiment aimed at supporting the conscious development of individuals and communities."
          />
        </p>
      </div>

      <h2>
        <T cs="2. Povaha projektu" en="2. Nature of the project" />
      </h2>
      <p>
        <T cs="Projekt ZION je:" en="The ZION project is:" />
      </p>
      <ul>
        <li>
          <strong><T cs="Experimentální" en="Experimental" /></strong>
          <T
            cs=" – Ve fázi aktivního vývoje, testování a iterací"
            en=" – in a phase of active development, testing and iteration"
          />
        </li>
        <li>
          <strong><T cs="Open-source" en="Open source" /></strong>
          <T
            cs=" – Veškerý kód je veřejně dostupný k nahlédnutí a úpravám"
            en=" – all code is publicly available to inspect and modify"
          />
        </li>
        <li>
          <strong><T cs="Komunitní" en="Community-driven" /></strong>
          <T
            cs=" – Rozvíjen a spravován decentralizovanou komunitou"
            en=" – developed and governed by a decentralised community"
          />
        </li>
        <li>
          <strong><T cs="Neziskový v duchu" en="Non-profit in spirit" /></strong>
          <T
            cs=" – Primárním cílem není zisk, ale pozitivní dopad"
            en=" – the primary goal is positive impact, not profit"
          />
        </li>
      </ul>

      <div className="warning-box">
        <p>
          <T
            cs="Důležité upozornění: Veškerá účast v projektu je na vlastní odpovědnost. Projekt neposkytuje žádné záruky ohledně funkčnosti, stability nebo budoucího vývoje."
            en="Important notice: all participation in the project is at your own responsibility. The project provides no guarantees regarding functionality, stability or future development."
          />
        </p>
      </div>

      <h2>
        <T cs="3. Žádná investice" en="3. Not an investment" />
      </h2>
      <p>
        <T
          cs="ZION Terra Nova výslovně odmítá jakékoliv vnímání jako investiční příležitost:"
          en="ZION Terra Nova expressly rejects any perception of it as an investment opportunity:"
        />
      </p>
      <ul>
        <li><T cs="Digitální jednotky ZION nejsou cenné papíry ani investiční nástroje" en="ZION digital units are not securities or investment instruments" /></li>
        <li><T cs="Projekt neslibuje žádné finanční výnosy ani zhodnocení" en="The project promises no financial returns or appreciation" /></li>
        <li><T cs="Účast v projektu by neměla být motivována finančním ziskem" en="Participation should not be motivated by financial gain" /></li>
        <li><T cs="Hodnota digitálních jednotek může být kdykoliv nulová" en="The value of the digital units may be zero at any time" /></li>
      </ul>
      <p>
        <T
          cs="Pokud hledáte investiční příležitost, ZION není pro vás. Projekt je určen pro ty, kdo chtějí aktivně přispívat k rozvoji vědomých technologií a komunity."
          en="If you are looking for an investment opportunity, ZION is not for you. The project is intended for those who want to actively contribute to the development of conscious technology and community."
        />
      </p>

      <h2>
        <T cs="4. Blockchain a digitální jednotky" en="4. Blockchain and digital units" />
      </h2>
      <p>
        <T
          cs="ZION využívá vlastní blockchain postavený na principu Proof-of-Work s následujícími charakteristikami:"
          en="ZION runs its own blockchain built on Proof-of-Work with the following characteristics:"
        />
      </p>
      <ul>
        <li><T cs="Cosmic Harmony – Vlastní mining algoritmus podporující decentralizaci" en="Cosmic Harmony – a proprietary mining algorithm supporting decentralisation" /></li>
        <li><T cs="Consciousness Mining – Gamifikovaný systém odměňující pozitivní účast" en="Consciousness Mining – a gamified system rewarding positive participation" /></li>
        <li><T cs="Humanitární fond – 10% z každého bloku putuje na dobročinné účely" en="Humanitarian fund – 10% of every block goes to charitable purposes" /></li>
      </ul>
      <p>
        <T cs="Digitální jednotky ZION slouží primárně jako:" en="ZION digital units serve primarily as:" />
      </p>
      <ul>
        <li><T cs="Prostředek pro účast v DAO governance" en="a means of participation in DAO governance" /></li>
        <li><T cs="Odměna za přispění do komunity" en="a reward for contributing to the community" /></li>
        <li><T cs="Experimentální médium pro výzkum tokenomiky" en="an experimental medium for tokenomics research" /></li>
      </ul>

      <h2>
        <T cs="5. Open-source licence" en="5. Open-source licence" />
      </h2>
      <p>
        <T
          cs="Veškerý kód projektu ZION je dostupný pod open-source licencí na GitHubu. To znamená, že:"
          en="All ZION project code is available under an open-source licence on GitHub. That means:"
        />
      </p>
      <ul>
        <li><T cs="Každý může kód prohlížet, studovat a auditovat" en="anyone can view, study and audit the code" /></li>
        <li><T cs="Každý může kód forkovat a upravovat pro vlastní účely" en="anyone can fork and modify the code for their own purposes" /></li>
        <li><T cs="Každý může přispívat do oficiálního repozitáře" en="anyone can contribute to the official repository" /></li>
        <li><T cs="Kód je dodáván „tak jak je“, bez záruk jakéhokoliv druhu" en="the code is provided “as is”, without warranties of any kind" /></li>
      </ul>
      <p>
        GitHub: <a href="https://github.com/Zion-TerraNova" target="_blank" rel="noopener noreferrer">github.com/Zion-TerraNova</a>
      </p>

      <h2>
        <T cs="6. Vědomé používání" en="6. Conscious use" />
      </h2>
      <p>
        <T
          cs="Účastníci projektu ZION se zavazují k vědomému a odpovědnému přístupu:"
          en="Participants in the ZION project commit to a conscious and responsible approach:"
        />
      </p>
      <ul>
        <li><T cs="Vzdělávejte se – Pochopte technologii před její používáním" en="Educate yourself – understand the technology before using it" /></li>
        <li><T cs="Neriskujte víc, než si můžete dovolit – Experimentální projekty nesou rizika" en="Never risk more than you can afford – experimental projects carry risk" /></li>
        <li><T cs="Přispívejte pozitivně – Komunita roste díky konstruktivním příspěvkům" en="Contribute positively – the community grows through constructive input" /></li>
        <li><T cs="Respektujte ostatní – Různorodost názorů obohacuje projekt" en="Respect others – diversity of opinion enriches the project" /></li>
      </ul>

      <h2>
        <T cs="7. Filozofie projektu" en="7. Philosophy of the project" />
      </h2>
      <p className="text-center italic text-lg my-6">
        <T
          cs="„Technologie bez lásky je jen strojírenství. Technologie s láskou je magie.“"
          en="“Technology without love is just engineering. Technology with love is magic.”"
        />
      </p>
      <p>
        <T cs="ZION Terra Nova stojí na následujících pilířích:" en="ZION Terra Nova stands on the following pillars:" />
      </p>
      <ul>
        <li>
          <strong><T cs="Vědomí nad ziskem" en="Consciousness over profit" /></strong>
          <T
            cs=" – Duchovní a osobní rozvoj je důležitější než finanční metriky"
            en=" – spiritual and personal growth matters more than financial metrics"
          />
        </li>
        <li>
          <strong><T cs="Transparentnost" en="Transparency" /></strong>
          <T cs=" – Otevřená komunikace a veřejný kód" en=" – open communication and public code" />
        </li>
        <li>
          <strong><T cs="Decentralizace" en="Decentralisation" /></strong>
          <T cs=" – Žádná centrální autorita, komunita rozhoduje" en=" – no central authority, the community decides" />
        </li>
        <li>
          <strong><T cs="Harmonie" en="Harmony" /></strong>
          <T cs=" – Technologie by měla sloužit přírodě, ne proti ní" en=" – technology should serve nature, not work against it" />
        </li>
      </ul>

      <h2>
        <T cs="8. Soukromí" en="8. Privacy" />
      </h2>
      <p>
        <T cs="Projekt ZION respektuje soukromí všech účastníků:" en="The ZION project respects the privacy of all participants:" />
      </p>
      <ul>
        <li><T cs="Mining a používání blockchainu nevyžaduje identifikaci" en="mining and using the blockchain requires no identification" /></li>
        <li><T cs="Webové stránky používají minimální tracking pouze pro technické účely" en="the website uses minimal tracking for technical purposes only" /></li>
        <li><T cs="Žádná osobní data nejsou prodávána třetím stranám" en="no personal data is sold to third parties" /></li>
        <li><T cs="Účast v komunitě může být anonymní" en="participation in the community can be anonymous" /></li>
      </ul>

      <h2>
        <T cs="9. Závěrečné slovo" en="9. Closing word" />
      </h2>
      <p>
        <T
          cs="ZION Terra Nova je víc než projekt – je to experiment ve vědomém vytváření technologií. Negarantujeme nic kromě upřímného úsilí o vytvoření něčeho pozitivního pro svět."
          en="ZION Terra Nova is more than a project – it is an experiment in conscious technology creation. We guarantee nothing except an honest effort to build something positive for the world."
        />
      </p>
      <p>
        <T
          cs="Děkujeme, že jste součástí této cesty. Ať už jako těžař, vývojář, nebo prostě někdo, kdo věří v lepší budoucnost – vaše účast má význam."
          en="Thank you for being part of this journey. Whether as a miner, a developer, or simply someone who believes in a better future – your participation matters."
        />
      </p>
    </InfoPage>
  );
}
