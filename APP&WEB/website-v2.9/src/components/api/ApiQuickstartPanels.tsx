'use client';

import { useState } from 'react';
import { Check, Copy, Server, Terminal } from 'lucide-react';

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
      label: cs ? 'cURL rychly ping' : 'cURL quick ping',
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
      title: cs ? '1 · Autentizace' : '1 · Authenticate',
      detail: cs ? 'GET routy jsou otevrene. Pro POST/PUT pridejte do hlavicek x-zion-key; klice rotujte kazdych 30 dni.' : 'GET routes are open. For POST/PUT include x-zion-key in headers; rotate keys every 30 days.',
    },
    {
      title: cs ? '2 · Zvolte transport' : '2 · Choose transport',
      detail: cs ? 'HTTPS pro RPC/REST, WebSockets pro stratum a metriky. Vsechny servery podporuji HTTP/2.' : 'HTTPS for RPC/REST, WebSockets for stratum + metrics. All servers support HTTP/2.',
    },
    {
      title: cs ? '3 · Pripnete prostredi' : '3 · Pin environment',
      detail: cs ? 'Sandbox zrcadli produkci na https://api-sandbox.zionterranova.com s testnet daty.' : 'Sandbox mirrors production at https://api-sandbox.zionterranova.com with testnet data.',
    },
  ];
}

export default function ApiQuickstartPanels({ cs }: { cs: boolean }) {
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
      <div className="zion-rainbow-card p-6" style={{ '--rc': '99, 102, 241' } as React.CSSProperties}>
        <h3 className="text-2xl font-semibold text-white flex items-center gap-3">
          <Terminal className="h-6 w-6 text-zion-gold" /> {cs ? 'Quickstart ukazky' : 'Quickstart snippets'}
        </h3>
        <div className="mt-4 space-y-4">
          {codeSamples.map((sample) => (
            <div key={sample.id} className="zion-rainbow-sub p-4" style={{ '--rc': '99, 102, 241' } as React.CSSProperties}>
              <div className="mb-2 flex items-center justify-between text-sm text-gray-300">
                <span>{sample.label}</span>
                <button
                  onClick={() => handleCopy(sample.id, sample.snippet)}
                  className="inline-flex items-center gap-1 text-xs text-zion-gold"
                >
                  {copied === sample.id ? (
                    <>
                      <Check className="h-3 w-3" /> {cs ? 'Zkopirovano' : 'Copied'}
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" /> {cs ? 'Kopirovat' : 'Copy'}
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

      <div className="zion-rainbow-card p-6" style={{ '--rc': '99, 102, 241' } as React.CSSProperties}>
        <h3 className="text-2xl font-semibold text-white flex items-center gap-3">
          <Server className="h-6 w-6 text-zion-gold" /> {cs ? 'Checklist nasazeni' : 'Onboarding checklist'}
        </h3>
        <div className="mt-4 space-y-4">
          {onboardingSteps.map((step) => (
            <div key={step.title} className="zion-rainbow-sub p-4" style={{ '--rc': '99, 102, 241' } as React.CSSProperties}>
              <p className="text-sm uppercase tracking-[0.3em] text-gray-500">{step.title}</p>
              <p className="text-sm text-gray-300 mt-2">{step.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}