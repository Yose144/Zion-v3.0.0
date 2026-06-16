'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

type FaqItem = {
  q: string;
  a: string;
};

function getFaqItems(cs: boolean): FaqItem[] {
  return [
    {
      q: cs ? 'Potrebuji pro tezbu Node?' : 'Do I need a Node to mine?',
      a: cs ? 'Ne. Pripojte se k verejnemu poolu (zionterranova.com/pool). Pool resi komunikaci s blockchainem. Node potrebujete jen pokud chcete sami overovat transakce nebo provozovat vlastni pool.' : 'No. Connect to the public pool (zionterranova.com/pool). The pool handles blockchain communication. A node is only needed if you want to verify transactions yourself or run your own pool.',
    },
    {
      q: cs ? 'Jak vytvorim penezenku?' : 'How do I create a wallet?',
      a: cs ? 'Stahnete ZION CLI a spustte: zion wallet new --mnemonic --out my-wallet.json --print. Zapisete si 24 slov na papir — to je vase zaloha. Nikdy je nesdilejte online.' : 'Download ZION CLI and run: zion wallet new --mnemonic --out my-wallet.json --print. Write down the 24 words on paper — they are your backup. Never share them online.',
    },
    {
      q: cs ? 'Windows Defender blokuje binarku?' : 'Windows Defender blocks the binary?',
      a: cs ? 'Kliknete na More info -> Run anyway. Binarky jsou open-source (MIT licence), ale nepodepsane. Muzete take pridat C:\\ZION\\ do vyjimek ve Windows Security.' : 'Click More info -> Run anyway. The binaries are open-source (MIT license) but unsigned. You can also add C:\\ZION\\ to exclusions in Windows Security.',
    },
    {
      q: cs ? 'macOS pise cannot be opened?' : 'macOS says cannot be opened?',
      a: cs ? 'Spustte: xattr -d com.apple.quarantine zion-cli-macos-arm64 nebo jdete do System Settings -> Privacy & Security -> Allow Anyway.' : 'Run: xattr -d com.apple.quarantine zion-cli-macos-arm64 or go to System Settings -> Privacy & Security -> Allow Anyway.',
    },
    {
      q: cs ? 'Co je Consciousness Mining?' : 'What is Consciousness Mining?',
      a: cs ? 'Vase uroven vedomi (PHYSICAL -> COSMIC) nasobi blokove odmeny az 15x. Levelujete konzistentni tezbou, nachazenim bloku a prispevkem ke zdravi site.' : 'Your consciousness level (PHYSICAL -> COSMIC) multiplies block rewards up to 15x. Level up by consistent mining, discovering blocks, and contributing to network health.',
    },
    {
      q: cs ? 'Mohu tezit na Raspberry Pi?' : 'Can I mine on Raspberry Pi?',
      a: cs ? 'Linux ARM64 build je ve vyvoji. RPi 4/5 bude podporovano — sledujte releases na zionterranova.com/download.' : 'The Linux ARM64 build is in progress. RPi 4/5 will be supported — watch releases at zionterranova.com/download.',
    },
  ];
}

export default function DownloadFaq({ cs }: { cs: boolean }) {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const faqItems = getFaqItems(cs);

  return (
    <section className="rounded-4xl border border-white/10 bg-black/40 p-8">
      <div className="flex flex-col gap-2 mb-6">
        <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Podpora' : 'Support'}</p>
        <h2 className="text-3xl font-semibold text-white">FAQ</h2>
      </div>
      <div className="space-y-3">
        {faqItems.map((faq, index) => (
          <div key={faq.q} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
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