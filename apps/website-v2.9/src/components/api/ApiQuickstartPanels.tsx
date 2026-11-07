'use client';

import { tx5, t5 } from '@/lib/i18n-tx';
import type { Lang } from '@/contexts/LanguageContext';

import { useState } from 'react';
import { Check, Copy, Server, Terminal } from 'lucide-react';

const ApiQuickstartPanelsCopy = {
  curlQuickPing: { cs: `cURL rychly ping`, en: `cURL quick ping` },
  k1Authenticate: { cs: `1 · Autentizace`, en: `1 · Authenticate` },
  getRoutesAreOpenForPostPutIncl: { cs: `GET routy jsou otevrene. Pro POST/PUT pridejte do hlavicek x-zion-key; klice rotujte kazdych 30 dni.`, en: `GET routes are open. For POST/PUT include x-zion-key in headers; rotate keys every 30 days.` },
  k2ChooseTransport: { cs: `2 · Zvolte transport`, en: `2 · Choose transport` },
  httpsForRpcRestWebsocketsForSt: { cs: `HTTPS pro RPC/REST, WebSockets pro stratum a metriky. Vsechny servery podporuji HTTP/2.`, en: `HTTPS for RPC/REST, WebSockets for stratum + metrics. All servers support HTTP/2.` },
  k3PinEnvironment: { cs: `3 · Pripnete prostredi`, en: `3 · Pin environment` },
  sandboxMirrorsProductionAtHttp: { cs: `Sandbox zrcadli produkci na https://api-sandbox.zionterranova.com s testnet daty.`, en: `Sandbox mirrors production at https://api-sandbox.zionterranova.com with testnet data.` },
  quickstartSnippets: { cs: `Quickstart ukazky`, en: `Quickstart snippets` },
  copied: { cs: `Zkopirovano`, en: `Copied` },
  copy: { cs: `Kopirovat`, en: `Copy` },
  onboardingChecklist: { cs: `Checklist nasazeni`, en: `Onboarding checklist` },
};

type CodeSample = {
  id: string;
  label: string;
  snippet: string;
};

type OnboardingStep = {
  title: string;
  detail: string;
};

function getCodeSamples(cs: boolean, lang: Lang): CodeSample[] {
  return [
    {
      id: 'curl',
      label: tx5(ApiQuickstartPanelsCopy.curlQuickPing, lang),
      snippet: `curl -X GET \\
  https://app.zionterranova.com/api/blockchain/stats \\
  -H 'Accept: application/json'`,
    },
    {
      id: 'ts',
      label: 'TypeScript fetch',
      snippet: `const res = await fetch('https://app.zionterranova.com/api/blockchain/stats', {
  headers: {
    'Accept': 'application/json',
  },
});
const data = await res.json();`,
    },
  ];
}

function getOnboardingSteps(cs: boolean, lang: Lang): OnboardingStep[] {
  return [
    {
      title: tx5(ApiQuickstartPanelsCopy.k1Authenticate, lang),
      detail: tx5(ApiQuickstartPanelsCopy.getRoutesAreOpenForPostPutIncl, lang),
    },
    {
      title: tx5(ApiQuickstartPanelsCopy.k2ChooseTransport, lang),
      detail: tx5(ApiQuickstartPanelsCopy.httpsForRpcRestWebsocketsForSt, lang),
    },
    {
      title: tx5(ApiQuickstartPanelsCopy.k3PinEnvironment, lang),
      detail: tx5(ApiQuickstartPanelsCopy.sandboxMirrorsProductionAtHttp, lang),
    },
  ];
}

export default function ApiQuickstartPanels({ cs, lang }: { cs: boolean; lang: Lang }) {
  const [copied, setCopied] = useState<string | null>(null);
  const codeSamples = getCodeSamples(cs, lang);
  const onboardingSteps = getOnboardingSteps(cs, lang);

  const handleCopy = async (id: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(id);
    window.setTimeout(() => setCopied(null), 1500);
  };

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <div className="zion-rainbow-card p-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
        <h3 className="text-2xl font-semibold text-white flex items-center gap-3">
          <Terminal className="h-6 w-6 text-zion-gold" /> {tx5(ApiQuickstartPanelsCopy.quickstartSnippets, lang)}
        </h3>
        <div className="mt-4 space-y-4">
          {codeSamples.map((sample) => (
            <div key={sample.id} className="zion-rainbow-sub p-4" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <div className="mb-2 flex items-center justify-between text-sm text-gray-300">
                <span>{sample.label}</span>
                <button
                  onClick={() => handleCopy(sample.id, sample.snippet)}
                  className="inline-flex items-center gap-1 text-xs text-zion-gold"
                >
                  {copied === sample.id ? (
                    <>
                      <Check className="h-3 w-3" /> {tx5(ApiQuickstartPanelsCopy.copied, lang)}
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" /> {tx5(ApiQuickstartPanelsCopy.copy, lang)}
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

      <div className="zion-rainbow-card p-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
        <h3 className="text-2xl font-semibold text-white flex items-center gap-3">
          <Server className="h-6 w-6 text-zion-gold" /> {tx5(ApiQuickstartPanelsCopy.onboardingChecklist, lang)}
        </h3>
        <div className="mt-4 space-y-4">
          {onboardingSteps.map((step) => (
            <div key={step.title} className="zion-rainbow-sub p-4" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <p className="text-sm uppercase tracking-[0.3em] text-gray-500">{step.title}</p>
              <p className="text-sm text-gray-300 mt-2">{step.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}