import InfoPage from '@/components/info/InfoPage';
import { T } from '@/components/info/T';

export const metadata = {
  title: 'FAQ | ZION Market',
  description: 'Časté dotazy o ZION Terra Nova, OASIS Marketplace a ZION tokenech.',
};

export default function FaqPage() {
  return (
    <InfoPage
      titleKey="info.faqTitle"
      subtitleKey="info.faqSubtitle"
      icon="❓"
    >
      <h2>
        <T cs="Obecné otázky" en="General questions" />
      </h2>

      <h3>
        <T cs="Co je ZION TerraNova?" en="What is ZION TerraNova?" />
      </h3>
      <p>
        <T
          cs="ZION je consciousness-based blockchain ecosystem, který kombinuje technickou excelenci s etickou misí. Používáme vlastní Proof-of-Work algoritmus Cosmic Harmony a unikátní Consciousness Mining systém, který odměňuje nejen výpočetní výkon, ale i duchovní rozvoj těžařů."
          en="ZION is a consciousness-based blockchain ecosystem that combines technical excellence with an ethical mission. We use our own Proof-of-Work algorithm, Cosmic Harmony, and a unique Consciousness Mining system that rewards not only computing power but also the inner development of miners."
        />
      </p>

      <h3>
        <T cs="Co znamená Fair Launch?" en="What does Fair Launch mean?" />
      </h3>
      <p>
        <T
          cs="Fair Launch znamená, že ZION nemá presale, ICO ani KYC. Inspirováno Bitcoinem a Satoshi Nakamoto – každý má možnost těžit od prvního bloku za stejných podmínek."
          en="Fair Launch means ZION has no presale, no ICO and no KYC. Inspired by Bitcoin and Satoshi Nakamoto — everyone can mine from the very first block under the same conditions."
        />
      </p>

      <h3>
        <T cs="Jaký je celkový počet ZION tokenů?" en="What is the total supply of ZION tokens?" />
      </h3>
      <p>
        <T
          cs="Maximální nabídka je 144 miliard ZION (12×12×1B), inspirováno posvátnou geometrií a kosmickými cykly."
          en="The maximum supply is 144 billion ZION (12×12×1B), inspired by sacred geometry and cosmic cycles."
        />
      </p>

      <h3>
        <T cs="Kdy je naplánován MainNet launch?" en="When is the MainNet launch planned?" />
      </h3>
      <p>
        <T
          cs="Mainnet je aktivní od ledna 2026. Veřejný launch byl odložen (TBD). Sledujte náš "
          en="The mainnet has been live since January 2026. The public launch has been postponed (TBD). Follow our "
        />
        <a href="https://app.zionterranova.com/roadmap" target="_blank" rel="noopener noreferrer">
          <T cs="roadmap" en="roadmap" />
        </a>
        .
      </p>

      <h2>
        <T cs="Těžba a odměny" en="Mining and rewards" />
      </h2>

      <h3>
        <T cs="Jak začít těžit ZION?" en="How do I start mining ZION?" />
      </h3>
      <ol>
        <li>
          <T cs="Stáhněte si miner z " en="Download the miner from " />
          <a href="https://app.zionterranova.com/download" target="_blank" rel="noopener noreferrer">app.zionterranova.com/download</a>
        </li>
        <li>
          <T cs="Připojte se k poolu: " en="Connect to the pool: " />
          <code>62.171.141.136:8444</code>
        </li>
        <li>
          <T
            cs="Zadejte vaši ZION wallet adresu a začněte těžit"
            en="Enter your ZION wallet address and start mining"
          />
        </li>
      </ol>

      <h3>
        <T cs="Jaký hardware potřebuji pro těžbu?" en="What hardware do I need for mining?" />
      </h3>
      <p>
        <T
          cs="ZION používá ASIC-resistant algoritmy, takže můžete těžit na běžném hardware:"
          en="ZION uses ASIC-resistant algorithms, so you can mine on ordinary hardware:"
        />
      </p>
      <ul>
        <li><T cs="CPU: Jakýkoliv moderní procesor" en="CPU: Any modern processor" /></li>
        <li><T cs="GPU: AMD nebo NVIDIA grafická karta pro vyšší hashrate" en="GPU: an AMD or NVIDIA graphics card for a higher hashrate" /></li>
        <li><T cs="RAM: Minimálně 4GB, doporučeno 8GB+" en="RAM: at least 4 GB, 8 GB+ recommended" /></li>
      </ul>

      <h3>
        <T cs="Co je Consciousness Mining?" en="What is Consciousness Mining?" />
      </h3>
      <p>
        <T
          cs="Consciousness Mining je unikátní odměňovací systém, který rozpoznává 9 úrovní vědomí. Čím vyšší úroveň, tím větší bonus k těžebním odměnám."
          en="Consciousness Mining is a unique reward system that recognises nine levels of consciousness. The higher the level, the bigger the bonus on mining rewards."
        />
      </p>

      <h2>
        <T cs="Peněženky a tokeny" en="Wallets and tokens" />
      </h2>

      <h3>
        <T cs="Jak získám ZION peněženku?" en="How do I get a ZION wallet?" />
      </h3>
      <p>
        <T cs="Můžete vytvořit ZION peněženku několika způsoby:" en="You can create a ZION wallet in several ways:" />
      </p>
      <ul>
        <li>
          <T cs="Web wallet na " en="Web wallet at " />
          <a href="https://dashboard.zionterranova.com" target="_blank" rel="noopener noreferrer">dashboard.zionterranova.com</a>
        </li>
        <li><T cs="CLI wallet součástí mining software" en="CLI wallet included in the mining software" /></li>
        <li><T cs="Paper wallet pro cold storage" en="Paper wallet for cold storage" /></li>
      </ul>

      <h3>
        <T cs="Kde mohu kupovat/prodávat ZION?" en="Where can I buy or sell ZION?" />
      </h3>
      <p>
        <T
          cs="ZION je aktuálně v Mainnet fázi. Oficiální listing na DEX je naplánován po MainNet launchi. Sledujte naše kanály."
          en="ZION is currently in the Mainnet phase. An official DEX listing is planned after the MainNet launch. Follow our channels."
        />
      </p>

      <h2>
        <T cs="Komunita a podpora" en="Community and support" />
      </h2>

      <h3>
        <T cs="Kde najdu komunitu?" en="Where do I find the community?" />
      </h3>
      <ul>
        <li>
          Discord: <a href="https://discord.gg/wvxJ7DhZ8" target="_blank" rel="noopener noreferrer">discord.gg/wvxJ7DhZ8</a>{' '}
          <T cs="— hlavní hub, 24/7 podpora" en="— main hub, 24/7 support" />
        </li>
        <li>Twitter/X: @ZionTerraNova</li>
        <li>
          GitHub: <a href="https://github.com/Zion-TerraNova" target="_blank" rel="noopener noreferrer">github.com/Zion-TerraNova</a>
        </li>
      </ul>

      <h3>
        <T cs="Jak mohu přispět projektu?" en="How can I contribute to the project?" />
      </h3>
      <ul>
        <li><T cs="Těžba — Staňte se těžařem a posilte síť" en="Mining — become a miner and strengthen the network" /></li>
        <li><T cs="Vývoj — Přispívejte kódem na GitHub" en="Development — contribute code on GitHub" /></li>
        <li><T cs="Komunita — Pomáhejte novým členům na Discord" en="Community — help new members on Discord" /></li>
        <li><T cs="Obsah — Vytvářejte tutoriály, články, videa" en="Content — create tutorials, articles and videos" /></li>
      </ul>
    </InfoPage>
  );
}
