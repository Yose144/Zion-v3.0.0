'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Copy, Download, ExternalLink, Terminal } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { tx5, t5 } from '@/lib/i18n-tx';

const NetworkOperatorToolkitCopy = {
  operatorToolkit: { cs: `Operator toolkit`, en: `Operator Toolkit` },
  networkOpsPro: { cs: `Síťové nástroje`, en: `Network Tools` },
  failoverTemplatesHealthProbesA: { cs: `Mining commands, health probes a strojově čitelné endpointy pro uživatele a operátory.`, en: `Mining commands, health probes, and machine-readable endpoints for users and operators.` },
  primaryMining: { cs: `Primární těžba`, en: `Primary Mining` },
  currentPublicStratumEndpointOn: { cs: `Aktuální veřejný stratum endpoint na ZION One Love. Historický kontext sítě je archivován v dokumentaci.`, en: `Current public stratum endpoint on ZION One Love. Historical network context is archived in docs.` },
  copied: { cs: `Zkopírováno`, en: `Copied` },
  copyCommand: { cs: `Kopírovat příkaz`, en: `Copy command` },
  healthProbes: { cs: `Health probe`, en: `Health Probes` },
  copyHealth: { cs: `Kopírovat health`, en: `Copy health` },
  copyNetwork: { cs: `Kopírovat network`, en: `Copy network` },
  exportDocs: { cs: `Export a docs`, en: `Export & Docs` },
  monitoringDashboard: { cs: `Monitoring dashboard`, en: `Monitoring dashboard` },
  docsHub: { cs: `Centrum dokumentace`, en: `Docs hub` },
};

export default function NetworkOperatorToolkit({ primaryPool }: { primaryPool: string }) {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [copied, setCopied] = useState<string | null>(null);
  const xmrigConnect = `./xmrig -o stratum+tcp://${primaryPool} -u YOUR_ZION_ADDRESS -p x`;
  const healthCurl = 'curl -s https://app.zionterranova.com/api/health';
  const networkCurl = 'curl -s https://app.zionterranova.com/api/network';

  const copyText = async (id: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(id);
    window.setTimeout(() => setCopied(null), 1500);
  };

  return (
    <section className="zion-rainbow-card p-8" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
      <div className="flex flex-col gap-2 mb-8">
        <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(NetworkOperatorToolkitCopy.operatorToolkit, lang)}</p>
        <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
          <Terminal className="h-7 w-7 text-zion-cyan" />
          {tx5(NetworkOperatorToolkitCopy.networkOpsPro, lang)}
        </h2>
        <p className="text-sm text-gray-400">{tx5(NetworkOperatorToolkitCopy.failoverTemplatesHealthProbesA, lang)}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="zion-rainbow-sub p-6" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{tx5(NetworkOperatorToolkitCopy.primaryMining, lang)}</p>
          <p className="text-sm text-gray-300 mb-3">{tx5(NetworkOperatorToolkitCopy.currentPublicStratumEndpointOn, lang)}</p>
          <code className="block zion-rainbow-sub p-3 text-xs text-zion-gold break-all" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>{xmrigConnect}</code>
          <button onClick={() => copyText('xmrig-connect', xmrigConnect)} className="mt-3 inline-flex items-center gap-2 text-xs text-zion-cyan hover:text-white transition">
            <Copy className="h-3.5 w-3.5" /> {copied === 'xmrig-connect' ? (tx5(NetworkOperatorToolkitCopy.copied, lang)) : tx5(NetworkOperatorToolkitCopy.copyCommand, lang)}
          </button>
        </div>

        <div className="zion-rainbow-sub p-6" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{tx5(NetworkOperatorToolkitCopy.healthProbes, lang)}</p>
          <div className="space-y-2">
            <code className="block zion-rainbow-sub p-3 text-xs text-zion-gold break-all" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>{healthCurl}</code>
            <code className="block zion-rainbow-sub p-3 text-xs text-zion-gold break-all" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>{networkCurl}</code>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={() => copyText('health-curl', healthCurl)} className="inline-flex items-center gap-1.5 text-xs text-zion-cyan hover:text-white transition"><Copy className="h-3.5 w-3.5" />{copied === 'health-curl' ? (tx5(NetworkOperatorToolkitCopy.copied, lang)) : tx5(NetworkOperatorToolkitCopy.copyHealth, lang)}</button>
            <button onClick={() => copyText('network-curl', networkCurl)} className="inline-flex items-center gap-1.5 text-xs text-zion-cyan hover:text-white transition"><Copy className="h-3.5 w-3.5" />{copied === 'network-curl' ? (tx5(NetworkOperatorToolkitCopy.copied, lang)) : tx5(NetworkOperatorToolkitCopy.copyNetwork, lang)}</button>
          </div>
        </div>

        <div className="zion-rainbow-sub p-6" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{tx5(NetworkOperatorToolkitCopy.exportDocs, lang)}</p>
          <div className="space-y-2.5 text-sm">
            <a href="/api/network" target="_blank" rel="noreferrer" className="zion-rainbow-sub p-3 flex items-center justify-between" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
              <span className="font-mono text-xs text-gray-200">/api/network</span>
              <Download className="h-3.5 w-3.5 text-zion-gold" />
            </a>
            <a href="/api/health" target="_blank" rel="noreferrer" className="zion-rainbow-sub p-3 flex items-center justify-between" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
              <span className="font-mono text-xs text-gray-200">/api/health</span>
              <Download className="h-3.5 w-3.5 text-zion-gold" />
            </a>
            <Link href="/monitoring" className="zion-rainbow-sub p-3 flex items-center justify-between" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
              <span className="text-gray-200">{tx5(NetworkOperatorToolkitCopy.monitoringDashboard, lang)}</span>
              <ExternalLink className="h-3.5 w-3.5 text-zion-gold" />
            </Link>
            <Link href="/docs#live-index" className="zion-rainbow-sub p-3 flex items-center justify-between" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
              <span className="text-gray-200">{tx5(NetworkOperatorToolkitCopy.docsHub, lang)}</span>
              <ExternalLink className="h-3.5 w-3.5 text-zion-gold" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}