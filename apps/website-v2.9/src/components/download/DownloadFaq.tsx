'use client';

import { tx5, t5 } from '@/lib/i18n-tx';
import type { Lang } from '@/contexts/LanguageContext';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const DownloadFaqCopy = {
  doINeedANodeToMine: { cs: `Potřebuji pro těžbu Node?`, en: `Do I need a Node to mine?` },
  noConnectToThePublicPoolZionte: { cs: `Ne. Připojte se k veřejnému poolu (app.zionterranova.com/pool). Pool řeší komunikaci s blockchainem. Node potřebujete jen pokud chcete sami ověřovat transakce nebo provozovat vlastní pool.`, en: `No. Connect to the public pool (app.zionterranova.com/pool). The pool handles blockchain communication. A node is only needed if you want to verify transactions yourself or run your own pool.` },
  howDoICreateAWallet: { cs: `Jak vytvořím peněženku?`, en: `How do I create a wallet?` },
  downloadZionCliAndRunZionWalle: { cs: `Stáhněte ZION CLI (v3.0.5-beta Community CLI níže) a spusťte: zion wallet new --mnemonic --out my-wallet.json --print. Zapište si 24 slov na papír — to je vaše záloha. Nikdy je nesdílejte online.`, en: `Download ZION CLI (v3.0.5-beta Community CLI below) and run: zion wallet new --mnemonic --out my-wallet.json --print. Write down the 24 words on paper — they are your backup. Never share them online.` },
  howDoIStartMining: { cs: `Jak spustím těžbu?`, en: `How do I start mining?` },
  extractArchiveAndRunZionMinerNoArgs: { cs: `Na Linuxu/macOS rozbalte .tar.gz, nastavte práva chmod +x zion-miner a spusťte ./zion-miner. Na Windows rozbalte .zip a dvakrát klikněte na zion-miner.exe. Interaktivní menu se zeptá na wallet, worker, GPU backend, threads, algoritmus a profil.`, en: `On Linux/macOS extract the .tar.gz, chmod +x zion-miner, and run ./zion-miner. On Windows extract the .zip and double-click zion-miner.exe. The interactive menu will ask for wallet, worker, GPU backend, threads, algorithm, and profile.` },
  whatIsTheInteractiveMenu: { cs: `Co dělá interaktivní menu?`, en: `What does the interactive menu do?` },
  theMenuCollectsPoolWalletWorkerGpuThreadsAlgoProfile: { cs: `Když spustíte zion-miner bez argumentů, zeptá se vás na pool (výchozí stratum.zionterranova.com:8444), adresu peněženky, jméno workeru, GPU backend, počet CPU vláken, algoritmus a profil. Pak miner nastartuje. Pro pokročilé nastavení použijte ./start.sh nebo ./start.bat.`, en: `When you run zion-miner with no arguments, it asks for pool (default stratum.zionterranova.com:8444), wallet address, worker name, GPU backend, CPU thread count, algorithm, and profile. Then it starts mining. For advanced settings use ./start.sh or ./start.bat.` },
  whichGpuBackendShouldIUse: { cs: `Jaký GPU backend mám zvolit?`, en: `Which GPU backend should I choose?` },
  chooseBackendBasedOnGpuAndOs: { cs: `Linux x86_64: auto / cuda (NVIDIA) / opencl (AMD/Intel). macOS: auto / metal (Apple Silicon) / opencl / cpu. Windows: auto / cuda (NVIDIA) / cpu. Linux ARM64: auto / cuda (Jetson). Při nejistotě zvolte auto — miner vybere nejlepší dostupný backend.`, en: `Linux x86_64: auto / cuda (NVIDIA) / opencl (AMD/Intel). macOS: auto / metal (Apple Silicon) / opencl / cpu. Windows: auto / cuda (NVIDIA) / cpu. Linux ARM64: auto / cuda (Jetson). When unsure, pick auto — the miner selects the best available backend.` },
  canIMineOnRaspberryPi: { cs: `Mohu těžit na Raspberry Pi?`, en: `Can I mine on Raspberry Pi?` },
  theLinuxArm64BuildSupportsRpi4And5: { cs: `Ano. Stáhněte zion-miner-linux-aarch64.tar.gz pro ARM64 (Raspberry Pi 4/5, Jetson, AWS Graviton a další). Na RPi očekávejte nižší hashrate — ideální pro testing nebo low-power těžbu.`, en: `Yes. Download zion-miner-linux-aarch64.tar.gz for ARM64 (Raspberry Pi 4/5, Jetson, AWS Graviton and others). On RPi expect lower hashrate — ideal for testing or low-power mining.` },
  windowsDefenderBlocksTheBinary: { cs: `Windows Defender blokuje binárku?`, en: `Windows Defender blocks the binary?` },
  clickMoreInfoRunAnywayTheBinar: { cs: `Klikněte na More info → Run anyway. Binárky jsou open-source (MIT licence), ale nepodepsané. Můžete také přidat adresář s minerem do výjimek ve Windows Security.`, en: `Click More info → Run anyway. The binaries are open-source (MIT license) but unsigned. You can also add the miner directory to exclusions in Windows Security.` },
  macosSaysCannotBeOpened: { cs: `macOS píše cannot be opened?`, en: `macOS says cannot be opened?` },
  runXattrDComAppleQuarantineZio: { cs: `Spusťte: xattr -d com.apple.quarantine zion-miner nebo přejděte do System Settings → Privacy & Security → Allow Anyway.`, en: `Run: xattr -d com.apple.quarantine zion-miner or go to System Settings → Privacy & Security → Allow Anyway.` },
  whyAreMySharesNotPaidImmediately: { cs: `Proč se mi okamžitě nepřičítají ZIONy?`, en: `Why aren't my ZION rewards showing immediately?` },
  poolCollectsSharesAndDistributesWhenBlockFound: { cs: `Těžba není okamžitý bankomat. Pool sbírá share a až najde blok, rozdělí odměnu mezi workery. Trvá to minuty až hodiny podle štěstí a výkonu poolu. Sledujte accepted shares v TUI.`, en: `Mining is not an instant ATM. The pool collects shares and, once it finds a block, distributes the reward among workers. This takes minutes to hours depending on pool luck and hashrate. Watch accepted shares in the TUI.` },
  canIMineSolo: { cs: `Mohu těžit solo?`, en: `Can I mine solo?` },
  yesButPoolRecommendedForRegularPayouts: { cs: `Ano — v interaktivním menu zvolte profil solo. Doporučujeme ale pool, protože solo vyplácí jen když sami najdete blok, což může trvat dlouho.`, en: `Yes — choose profile solo in the interactive menu. However, pool is recommended because solo only pays when you find a block yourself, which can take a long time.` },
  whatIsConsciousnessMining: { cs: `Co je Consciousness Mining?`, en: `What is Consciousness Mining?` },
  yourConsciousnessLevelPhysical: { cs: `Vaše úroveň vědomí (PHYSICAL → COSMIC) násobí blokové odměny až 15x. Levelujete konzistentní těžbou, nacházením bloků a příspěvkem ke zdraví sítě.`, en: `Your consciousness level (PHYSICAL → COSMIC) multiplies block rewards up to 15x. Level up by consistent mining, discovering blocks, and contributing to network health.` },
  smosHiveosSupport: { cs: `Funguje to na SMOS / HiveOS?`, en: `Does it work on SMOS / HiveOS?` },
  useLinuxX8664TarballWithZionInteractive0: { cs: `Ano. Použijte zion-miner-linux-x86_64.tar.gz a spusťte miner s proměnnou ZION_INTERACTIVE=0 a požadovanými argumenty --pool/--wallet/--worker/--gpu/--profile. Podrobný návod najdete v docs/SMOS_HIVEOS_GUIDE.md.`, en: `Yes. Use zion-miner-linux-x86_64.tar.gz and run the miner with ZION_INTERACTIVE=0 and the required --pool/--wallet/--worker/--gpu/--profile arguments. See docs/SMOS_HIVEOS_GUIDE.md for a detailed guide.` },
  support: { cs: `Podpora`, en: `Support` },
};

type FaqItem = {
  q: string;
  a: string;
};

function getFaqItems(cs: boolean, lang: Lang): FaqItem[] {
  return [
    {
      q: tx5(DownloadFaqCopy.doINeedANodeToMine, lang),
      a: tx5(DownloadFaqCopy.noConnectToThePublicPoolZionte, lang),
    },
    {
      q: tx5(DownloadFaqCopy.howDoICreateAWallet, lang),
      a: tx5(DownloadFaqCopy.downloadZionCliAndRunZionWalle, lang),
    },
    {
      q: tx5(DownloadFaqCopy.howDoIStartMining, lang),
      a: tx5(DownloadFaqCopy.extractArchiveAndRunZionMinerNoArgs, lang),
    },
    {
      q: tx5(DownloadFaqCopy.whatIsTheInteractiveMenu, lang),
      a: tx5(DownloadFaqCopy.theMenuCollectsPoolWalletWorkerGpuThreadsAlgoProfile, lang),
    },
    {
      q: tx5(DownloadFaqCopy.whichGpuBackendShouldIUse, lang),
      a: tx5(DownloadFaqCopy.chooseBackendBasedOnGpuAndOs, lang),
    },
    {
      q: tx5(DownloadFaqCopy.canIMineOnRaspberryPi, lang),
      a: tx5(DownloadFaqCopy.theLinuxArm64BuildSupportsRpi4And5, lang),
    },
    {
      q: tx5(DownloadFaqCopy.windowsDefenderBlocksTheBinary, lang),
      a: tx5(DownloadFaqCopy.clickMoreInfoRunAnywayTheBinar, lang),
    },
    {
      q: tx5(DownloadFaqCopy.macosSaysCannotBeOpened, lang),
      a: tx5(DownloadFaqCopy.runXattrDComAppleQuarantineZio, lang),
    },
    {
      q: tx5(DownloadFaqCopy.whyAreMySharesNotPaidImmediately, lang),
      a: tx5(DownloadFaqCopy.poolCollectsSharesAndDistributesWhenBlockFound, lang),
    },
    {
      q: tx5(DownloadFaqCopy.canIMineSolo, lang),
      a: tx5(DownloadFaqCopy.yesButPoolRecommendedForRegularPayouts, lang),
    },
    {
      q: tx5(DownloadFaqCopy.smosHiveosSupport, lang),
      a: tx5(DownloadFaqCopy.useLinuxX8664TarballWithZionInteractive0, lang),
    },
    {
      q: tx5(DownloadFaqCopy.whatIsConsciousnessMining, lang),
      a: tx5(DownloadFaqCopy.yourConsciousnessLevelPhysical, lang),
    },
  ];
}

export default function DownloadFaq({ cs, lang }: { cs: boolean; lang: Lang }) {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const faqItems = getFaqItems(cs, lang);

  return (
    <section className="zion-rainbow-card p-8" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
      <div className="flex flex-col gap-2 mb-6">
        <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(DownloadFaqCopy.support, lang)}</p>
        <h2 className="text-3xl font-semibold text-white">FAQ</h2>
      </div>
      <div className="space-y-3">
        {faqItems.map((faq, index) => (
          <div key={faq.q} className="zion-rainbow-sub overflow-hidden" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
            <button
              onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5 transition-colors"
            >
              <span className="text-lg font-semibold text-white pr-4">{faq.q}</span>
              <ChevronDown className={`h-5 w-5 shrink-0 text-zion-gold transition-transform ${openFaqIndex === index ? 'rotate-180' : ''}`} />
            </button>
            {openFaqIndex === index && (
              <div className="px-5 pb-5">
                <p className="text-gray-300 leading-relaxed">{faq.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
