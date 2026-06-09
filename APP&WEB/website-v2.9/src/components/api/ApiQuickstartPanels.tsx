'use client';

import { useState } from 'react';
import { Check, Copy, Server, Terminal } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { tr } from '@/lib/translations';

type CodeSample = {
  id: string;
  label: string;
  snippet: string;
};

type OnboardingStep = {
  title: string;
  detail: string;
};

function getCodeSamples(cs: boolean): CodeSample[] {
  return [
    {
      id: 'curl',
      label: tr('APP_WEB_website_v2_9_src_components_api_', 'curl_quick_ping', lang),
      snippet: `curl -X GET \\
  https://zionterranova.com/api/blockchain/stats \\
  -H 'Accept: application/json'`,
    },
    {
      id: 'ts',
      label: 'TypeScript fetch',
      snippet: `const res = await fetch('https://zionterranova.com/api/blockchain/stats', {
  headers: {
    'Accept': 'application/json',
  },
});
const data = await res.json();`,
    },
  ];
}

function getOnboardingSteps(cs: boolean): OnboardingStep[] {
  return [
    {
      title: tr('APP_WEB_website_v2_9_src_components_api_', '1_authenticate', lang),
      detail: tr('APP_WEB_website_v2_9_src_components_api_', 'get_routes_are_open_for_post_put_include_x_zion_ke', lang),
    },
    {
      title: tr('APP_WEB_website_v2_9_src_components_api_', '2_choose_transport', lang),
      detail: tr('APP_WEB_website_v2_9_src_components_api_', 'https_for_rpc_rest_websockets_for_stratum_metrics_', lang),
    },
    {
      title: tr('APP_WEB_website_v2_9_src_components_api_', '3_pin_environment', lang),
      detail: tr('APP_WEB_website_v2_9_src_components_api_', 'sandbox_mirrors_production_at_https_api_sandbox_zi', lang),
    },
  ];
}

export default function ApiQuickstartPanels({ cs }: { cs: boolean }) {
  const { lang } = useLang();
  const [copied, setCopied] = useState<string | null>(null);
  const codeSamples = getCodeSamples(cs);
  const onboardingSteps = getOnboardingSteps(cs);

  const handleCopy = async (id: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(id);
    window.setTimeout(() => setCopied(null), 1500);
  };

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-4xl border border-white/10 bg-black/50 p-6 backdrop-blur">
        <h3 className="text-2xl font-semibold text-white flex items-center gap-3">
          <Terminal className="h-6 w-6 text-zion-gold" /> {tr('APP_WEB_website_v2_9_src_components_api_', 'quickstart_snippets', lang)}
        </h3>
        <div className="mt-4 space-y-4">
          {codeSamples.map((sample) => (
            <div key={sample.id} className="rounded-2xl border border-white/10 bg-black/70 p-4">
              <div className="mb-2 flex items-center justify-between text-sm text-gray-300">
                <span>{sample.label}</span>
                <button
                  onClick={() => handleCopy(sample.id, sample.snippet)}
                  className="inline-flex items-center gap-1 text-xs text-zion-gold"
                >
                  {copied === sample.id ? (
                    <>
                      <Check className="h-3 w-3" /> {tr('APP_WEB_website_v2_9_src_components_api_', 'copied', lang)}
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" /> {tr('APP_WEB_website_v2_9_src_components_api_', 'copy', lang)}
                    </>
                  )}
                </button>
              </div>
              <pre className="overflow-x-auto text-sm text-zion-cyan">
                <code>{sample.snippet}</code>
              </pre>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-4xl border border-white/10 bg-black/50 p-6 backdrop-blur">
        <h3 className="text-2xl font-semibold text-white flex items-center gap-3">
          <Server className="h-6 w-6 text-zion-gold" /> {tr('APP_WEB_website_v2_9_src_components_api_', 'onboarding_checklist', lang)}
        </h3>
        <div className="mt-4 space-y-4">
          {onboardingSteps.map((step) => (
            <div key={step.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm uppercase tracking-[0.3em] text-gray-500">{step.title}</p>
              <p className="text-sm text-gray-300 mt-2">{step.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}