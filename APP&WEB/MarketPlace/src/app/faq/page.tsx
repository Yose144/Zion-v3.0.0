import InfoPage from '@/components/info/InfoPage';
import { tr } from '@/lib/translations';

export const metadata = {
  title: 'FAQ | ZION Market',
  description: 'Časté dotazy o ZION Terra Nova, OASIS Marketplace a ZION tokenech.',
};

export default function FaqPage() {
  return (
    <InfoPage
      title={tr('info', 'faqTitle', 'cs')}
      subtitle={tr('info', 'faqSubtitle', 'cs')}
      icon="❓"
    >
      <h2>Obecné otázky</h2>

      <h3>Co je ZION TerraNova?</h3>
      <p>ZION je consciousness-based blockchain ecosystem, který kombinuje technickou excelenci s etickou misí. Používáme vlastní Proof-of-Work algoritmus Cosmic Harmony a unikátní Consciousness Mining systém, který odměňuje nejen výpočetní výkon, ale i duchovní rozvoj těžařů.</p>

      <h3>Co znamená Fair Launch?</h3>
      <p>Fair Launch znamená, že ZION nemá presale, ICO ani KYC. Inspirováno Bitcoinem a Satoshi Nakamoto – každý má možnost těžit od prvního bloku za stejných podmínek.</p>

      <h3>Jaký je celkový počet ZION tokenů?</h3>
      <p>Maximální nabídka je 144 miliard ZION (12×12×1B), inspirováno posvátnou geometrií a kosmickými cykly.</p>

      <h3>Kdy je naplánován MainNet launch?</h3>
      <p>Mainnet je aktivní od ledna 2026. Veřejný launch je naplánován na 31. prosince 2026. Sledujte náš <a href="https://app.zionterranova.com/roadmap" target="_blank" rel="noopener noreferrer">roadmap</a>.</p>

      <h2>Těžba a odměny</h2>

      <h3>Jak začít těžit ZION?</h3>
      <ol>
        <li>Stáhněte si miner z <a href="https://app.zionterranova.com/download" target="_blank" rel="noopener noreferrer">app.zionterranova.com/download</a></li>
        <li>Připojte se k poolu: <code>62.171.141.136:8444</code></li>
        <li>Zadejte vaši ZION wallet adresu a začněte těžit</li>
      </ol>

      <h3>Jaký hardware potřebuji pro těžbu?</h3>
      <p>ZION používá ASIC-resistant algoritmy, takže můžete těžit na běžném hardware:</p>
      <ul>
        <li>CPU: Jakýkoliv moderní procesor</li>
        <li>GPU: AMD nebo NVIDIA grafická karta pro vyšší hashrate</li>
        <li>RAM: Minimálně 4GB, doporučeno 8GB+</li>
      </ul>

      <h3>Co je Consciousness Mining?</h3>
      <p>Consciousness Mining je unikátní odměňovací systém, který rozpoznává 9 úrovní vědomí. Čím vyšší úroveň, tím větší bonus k těžebním odměnám.</p>

      <h2>Peněženky a tokeny</h2>

      <h3>Jak získám ZION peněženku?</h3>
      <p>Můžete vytvořit ZION peněženku několika způsoby:</p>
      <ul>
        <li>Web wallet na <a href="https://dashboard.zionterranova.com" target="_blank" rel="noopener noreferrer">dashboard.zionterranova.com</a></li>
        <li>CLI wallet součástí mining software</li>
        <li>Paper wallet pro cold storage</li>
      </ul>

      <h3>Kde mohu kupovat/prodávat ZION?</h3>
      <p>ZION je aktuálně v Mainnet fázi. Oficiální listing na DEX je naplánován po MainNet launchi. Sledujte naše kanály.</p>

      <h2>Komunita a podpora</h2>

      <h3>Kde najdu komunitu?</h3>
      <ul>
        <li>Discord: <a href="https://discord.gg/eatGYDbd" target="_blank" rel="noopener noreferrer">discord.gg/eatGYDbd</a> — hlavní hub, 24/7 podpora</li>
        <li>Twitter/X: @ZionTerraNova</li>
        <li>GitHub: <a href="https://github.com/Zion-TerraNova" target="_blank" rel="noopener noreferrer">github.com/Zion-TerraNova</a></li>
      </ul>

      <h3>Jak mohu přispět projektu?</h3>
      <ul>
        <li>Těžba — Staňte se těžařem a posilte síť</li>
        <li>Vývoj — Přispívejte kódem na GitHub</li>
        <li>Komunita — Pomáhejte novým členům na Discord</li>
        <li>Obsah — Vytvářejte tutoriály, články, videa</li>
      </ul>
    </InfoPage>
  );
}
