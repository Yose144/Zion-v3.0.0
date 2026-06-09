'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

type FaqItem = {
  q: string;
  a: string;
};

function getFaqItems(cs: boolean): FaqItem[] {
  return [
    {
      q: tr('APP_WEB_website_v2_9_src_components_down', 'do_i_need_a_node_to_mine', lang),
      a: tr('APP_WEB_website_v2_9_src_components_down', 'no_connect_to_the_public_pool_zionterranova_com_po', lang),
    },
    {
      q: tr('APP_WEB_website_v2_9_src_components_down', 'how_do_i_create_a_wallet', lang),
      a: tr('APP_WEB_website_v2_9_src_components_down', 'download_zion_cli_and_run_zion_wallet_new_mnemonic', lang),
    },
    {
      q: tr('APP_WEB_website_v2_9_src_components_down', 'windows_defender_blocks_the_binary', lang),
      a: tr('APP_WEB_website_v2_9_src_components_down', 'click_more_info_run_anyway_the_binaries_are_open_s', lang),
    },
    {
      q: tr('APP_WEB_website_v2_9_src_components_down', 'macos_says_cannot_be_opened', lang),
      a: tr('APP_WEB_website_v2_9_src_components_down', 'run_xattr_d_com_apple_quarantine_zion_cli_macos_ar', lang),
    },
    {
      q: tr('APP_WEB_website_v2_9_src_components_down', 'what_is_consciousness_mining', lang),
      a: tr('APP_WEB_website_v2_9_src_components_down', 'your_consciousness_level_physical_cosmic_multiplie', lang),
    },
    {
      q: tr('APP_WEB_website_v2_9_src_components_down', 'can_i_mine_on_raspberry_pi', lang),
      a: tr('APP_WEB_website_v2_9_src_components_down', 'the_linux_arm64_build_is_in_progress_rpi_4_5_will_', lang),
    },
  ];
}

export default function DownloadFaq({ cs }: { cs: boolean }) {
  const { lang } = useLang();
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const faqItems = getFaqItems(cs);

  return (
    <section className="rounded-4xl border border-white/10 bg-black/40 p-8">
      <div className="flex flex-col gap-2 mb-6">
        <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('APP_WEB_website_v2_9_src_components_down', 'support', lang)}</p>
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