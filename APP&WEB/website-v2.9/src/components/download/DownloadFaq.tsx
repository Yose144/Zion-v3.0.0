'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const DownloadFaqCopy = {
  doINeedANodeToMine: { cs: `Potrebuji pro tezbu Node?`, en: `Do I need a Node to mine?` },
  noConnectToThePublicPoolZionte: { cs: `Ne. Pripojte se k verejnemu poolu (zionterranova.com/pool). Pool resi komunikaci s blockchainem. Node potrebujete jen pokud chcete sami overovat transakce nebo provozovat vlastni pool.`, en: `No. Connect to the public pool (zionterranova.com/pool). The pool handles blockchain communication. A node is only needed if you want to verify transactions yourself or run your own pool.` },
  howDoICreateAWallet: { cs: `Jak vytvorim penezenku?`, en: `How do I create a wallet?` },
  downloadZionCliAndRunZionWalle: { cs: `Stahnete ZION CLI a spustte: zion wallet new --mnemonic --out my-wallet.json --print. Zapisete si 24 slov na papir — to je vase zaloha. Nikdy je nesdilejte online.`, en: `Download ZION CLI and run: zion wallet new --mnemonic --out my-wallet.json --print. Write down the 24 words on paper — they are your backup. Never share them online.` },
  windowsDefenderBlocksTheBinary: { cs: `Windows Defender blokuje binarku?`, en: `Windows Defender blocks the binary?` },
  clickMoreInfoRunAnywayTheBinar: { cs: `Kliknete na More info -> Run anyway. Binarky jsou open-source (MIT licence), ale nepodepsane. Muzete take pridat C:\\ZION\\ do vyjimek ve Windows Security.`, en: `Click More info -> Run anyway. The binaries are open-source (MIT license) but unsigned. You can also add C:\\ZION\\ to exclusions in Windows Security.` },
  macosSaysCannotBeOpened: { cs: `macOS pise cannot be opened?`, en: `macOS says cannot be opened?` },
  runXattrDComAppleQuarantineZio: { cs: `Spustte: xattr -d com.apple.quarantine zion-cli-macos-arm64 nebo jdete do System Settings -> Privacy & Security -> Allow Anyway.`, en: `Run: xattr -d com.apple.quarantine zion-cli-macos-arm64 or go to System Settings -> Privacy & Security -> Allow Anyway.` },
  whatIsConsciousnessMining: { cs: `Co je Consciousness Mining?`, en: `What is Consciousness Mining?` },
  yourConsciousnessLevelPhysical: { cs: `Vase uroven vedomi (PHYSICAL -> COSMIC) nasobi blokove odmeny az 15x. Levelujete konzistentni tezbou, nachazenim bloku a prispevkem ke zdravi site.`, en: `Your consciousness level (PHYSICAL -> COSMIC) multiplies block rewards up to 15x. Level up by consistent mining, discovering blocks, and contributing to network health.` },
  canIMineOnRaspberryPi: { cs: `Mohu tezit na Raspberry Pi?`, en: `Can I mine on Raspberry Pi?` },
  theLinuxArm64BuildIsInProgress: { cs: `Linux ARM64 build je ve vyvoji. RPi 4/5 bude podporovano — sledujte releases na zionterranova.com/download.`, en: `The Linux ARM64 build is in progress. RPi 4/5 will be supported — watch releases at zionterranova.com/download.` },
  support: { cs: `Podpora`, en: `Support` },
};

type FaqItem = {
  q: string;
  a: string;
};

function getFaqItems(cs: boolean): FaqItem[] {
  return [
    {
      q: DownloadFaqCopy.doINeedANodeToMine[cs ? 'cs' : 'en'],
      a: DownloadFaqCopy.noConnectToThePublicPoolZionte[cs ? 'cs' : 'en'],
    },
    {
      q: DownloadFaqCopy.howDoICreateAWallet[cs ? 'cs' : 'en'],
      a: DownloadFaqCopy.downloadZionCliAndRunZionWalle[cs ? 'cs' : 'en'],
    },
    {
      q: DownloadFaqCopy.windowsDefenderBlocksTheBinary[cs ? 'cs' : 'en'],
      a: DownloadFaqCopy.clickMoreInfoRunAnywayTheBinar[cs ? 'cs' : 'en'],
    },
    {
      q: DownloadFaqCopy.macosSaysCannotBeOpened[cs ? 'cs' : 'en'],
      a: DownloadFaqCopy.runXattrDComAppleQuarantineZio[cs ? 'cs' : 'en'],
    },
    {
      q: DownloadFaqCopy.whatIsConsciousnessMining[cs ? 'cs' : 'en'],
      a: DownloadFaqCopy.yourConsciousnessLevelPhysical[cs ? 'cs' : 'en'],
    },
    {
      q: DownloadFaqCopy.canIMineOnRaspberryPi[cs ? 'cs' : 'en'],
      a: DownloadFaqCopy.theLinuxArm64BuildIsInProgress[cs ? 'cs' : 'en'],
    },
  ];
}

export default function DownloadFaq({ cs }: { cs: boolean }) {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const faqItems = getFaqItems(cs);

  return (
    <section className="zion-rainbow-card p-8" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
      <div className="flex flex-col gap-2 mb-6">
        <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{DownloadFaqCopy.support[cs ? 'cs' : 'en']}</p>
        <h2 className="text-3xl font-semibold text-white">FAQ</h2>
      </div>
      <div className="space-y-3">
        {faqItems.map((faq, index) => (
          <div key={faq.q} className="zion-rainbow-sub overflow-hidden" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
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