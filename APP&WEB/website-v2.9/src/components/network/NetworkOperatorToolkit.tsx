'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Copy, Download, ExternalLink, Terminal } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const NetworkOperatorToolkitCopy = {
  operatorToolkit: { cs: `Operator toolkit`, en: `Operator Toolkit` },
  networkOpsPro: { cs: `Sitove operace Pro`, en: `Network Ops Pro` },
  failoverTemplatesHealthProbesA: { cs: `Failover sablony, health probe a strojove citelne endpointy pro operatory, kteri potrebuji pracovat pod vrstvou verejneho dashboardu.`, en: `Failover templates, health probes, and machine-readable endpoints for operators who need to work below the public dashboard layer.` },
  primaryMining: { cs: `Primarni tezba`, en: `Primary Mining` },
  currentPublicStratumEndpointOn: { cs: `Aktualni verejny stratum endpoint na Zion2. Historicky multi-host failover patri do archivovanych dokumentu o topologii.`, en: `Current public stratum endpoint on Zion2. Historical multi-host failover belongs to archived topology docs.` },
  copied: { cs: `Zkopirovano`, en: `Copied` },
  copyCommand: { cs: `Kopirovat prikaz`, en: `Copy command` },
  healthProbes: { cs: `Health probe`, en: `Health Probes` },
  copyHealth: { cs: `Kopirovat health`, en: `Copy health` },
  copyNetwork: { cs: `Kopirovat network`, en: `Copy network` },
  exportDocs: { cs: `Export a docs`, en: `Export & Docs` },
  monitoringDashboard: { cs: `Monitoring dashboard`, en: `Monitoring dashboard` },
  docsHub: { cs: `Centrum dokumentace`, en: `Docs hub` },
};

export default function NetworkOperatorToolkit({ primaryPool }: { primaryPool: string }) {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [copied, setCopied] = useState<string | null>(null);
  const xmrigConnect = `./xmrig -o stratum+tcp://${primaryPool} -u YOUR_ZION_ADDRESS -p x`;
  const healthCurl = 'curl -s https://www.zionterranova.com/api/health';
  const networkCurl = 'curl -s https://www.zionterranova.com/api/network';

  const copyText = async (id: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(id);
    window.setTimeout(() => setCopied(null), 1500);
  };

  return (
    <section className="zion-rainbow-card p-8" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
      <div className="flex flex-col gap-2 mb-8">
        <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{NetworkOperatorToolkitCopy.operatorToolkit[cs ? 'cs' : 'en']}</p>
        <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
          <Terminal className="h-7 w-7 text-zion-cyan" />
          {NetworkOperatorToolkitCopy.networkOpsPro[cs ? 'cs' : 'en']}
        </h2>
        <p className="text-sm text-gray-400">{NetworkOperatorToolkitCopy.failoverTemplatesHealthProbesA[cs ? 'cs' : 'en']}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="zion-rainbow-sub p-6" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{NetworkOperatorToolkitCopy.primaryMining[cs ? 'cs' : 'en']}</p>
          <p className="text-sm text-gray-300 mb-3">{NetworkOperatorToolkitCopy.currentPublicStratumEndpointOn[cs ? 'cs' : 'en']}</p>
          <code className="block zion-rainbow-sub p-3 text-xs text-zion-gold break-all" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>{xmrigConnect}</code>
          <button onClick={() => copyText('xmrig-connect', xmrigConnect)} className="mt-3 inline-flex items-center gap-2 text-xs text-zion-cyan hover:text-white transition">
            <Copy className="h-3.5 w-3.5" /> {copied === 'xmrig-connect' ? (NetworkOperatorToolkitCopy.copied[cs ? 'cs' : 'en']) : NetworkOperatorToolkitCopy.copyCommand[cs ? 'cs' : 'en']}
          </button>
        </div>

        <div className="zion-rainbow-sub p-6" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{NetworkOperatorToolkitCopy.healthProbes[cs ? 'cs' : 'en']}</p>
          <div className="space-y-2">
            <code className="block zion-rainbow-sub p-3 text-xs text-zion-gold break-all" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>{healthCurl}</code>
            <code className="block zion-rainbow-sub p-3 text-xs text-zion-gold break-all" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>{networkCurl}</code>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={() => copyText('health-curl', healthCurl)} className="inline-flex items-center gap-1.5 text-xs text-zion-cyan hover:text-white transition"><Copy className="h-3.5 w-3.5" />{copied === 'health-curl' ? (NetworkOperatorToolkitCopy.copied[cs ? 'cs' : 'en']) : NetworkOperatorToolkitCopy.copyHealth[cs ? 'cs' : 'en']}</button>
            <button onClick={() => copyText('network-curl', networkCurl)} className="inline-flex items-center gap-1.5 text-xs text-zion-cyan hover:text-white transition"><Copy className="h-3.5 w-3.5" />{copied === 'network-curl' ? (NetworkOperatorToolkitCopy.copied[cs ? 'cs' : 'en']) : NetworkOperatorToolkitCopy.copyNetwork[cs ? 'cs' : 'en']}</button>
          </div>
        </div>

        <div className="zion-rainbow-sub p-6" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{NetworkOperatorToolkitCopy.exportDocs[cs ? 'cs' : 'en']}</p>
          <div className="space-y-2.5 text-sm">
            <a href="/api/network" target="_blank" rel="noreferrer" className="zion-rainbow-sub p-3 flex items-center justify-between" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
              <span className="font-mono text-xs text-gray-200">/api/network</span>
              <Download className="h-3.5 w-3.5 text-zion-gold" />
            </a>
            <a href="/api/health" target="_blank" rel="noreferrer" className="zion-rainbow-sub p-3 flex items-center justify-between" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
              <span className="font-mono text-xs text-gray-200">/api/health</span>
              <Download className="h-3.5 w-3.5 text-zion-gold" />
            </a>
            <Link href="/monitoring" className="zion-rainbow-sub p-3 flex items-center justify-between" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
              <span className="text-gray-200">{NetworkOperatorToolkitCopy.monitoringDashboard[cs ? 'cs' : 'en']}</span>
              <ExternalLink className="h-3.5 w-3.5 text-zion-gold" />
            </Link>
            <Link href="/docs#live-index" className="zion-rainbow-sub p-3 flex items-center justify-between" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
              <span className="text-gray-200">{NetworkOperatorToolkitCopy.docsHub[cs ? 'cs' : 'en']}</span>
              <ExternalLink className="h-3.5 w-3.5 text-zion-gold" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}