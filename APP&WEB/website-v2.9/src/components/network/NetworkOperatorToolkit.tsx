'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Copy, Download, ExternalLink, Terminal } from 'lucide-react';

export default function NetworkOperatorToolkit({ cs, primaryPool }: { cs: boolean; primaryPool: string }) {
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
    <section className="zion-rainbow-card p-8" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
      <div className="flex flex-col gap-2 mb-8">
        <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Operator toolkit' : 'Operator Toolkit'}</p>
        <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
          <Terminal className="h-7 w-7 text-zion-cyan" />
          {cs ? 'Sitove operace Pro' : 'Network Ops Pro'}
        </h2>
        <p className="text-sm text-gray-400">{cs ? 'Failover sablony, health probe a strojove citelne endpointy pro operatory, kteri potrebuji pracovat pod vrstvou verejneho dashboardu.' : 'Failover templates, health probes, and machine-readable endpoints for operators who need to work below the public dashboard layer.'}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="zion-rainbow-sub p-6" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{cs ? 'Primarni tezba' : 'Primary Mining'}</p>
          <p className="text-sm text-gray-300 mb-3">{cs ? 'Aktualni verejny stratum endpoint na Zion2. Historicky multi-host failover patri do archivovanych dokumentu o topologii.' : 'Current public stratum endpoint on Zion2. Historical multi-host failover belongs to archived topology docs.'}</p>
          <code className="block rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-zion-gold break-all">{xmrigConnect}</code>
          <button onClick={() => copyText('xmrig-connect', xmrigConnect)} className="mt-3 inline-flex items-center gap-2 text-xs text-zion-cyan hover:text-white transition">
            <Copy className="h-3.5 w-3.5" /> {copied === 'xmrig-connect' ? (cs ? 'Zkopirovano' : 'Copied') : cs ? 'Kopirovat prikaz' : 'Copy command'}
          </button>
        </div>

        <div className="zion-rainbow-sub p-6" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{cs ? 'Health probe' : 'Health Probes'}</p>
          <div className="space-y-2">
            <code className="block rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-zion-gold break-all">{healthCurl}</code>
            <code className="block rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-zion-gold break-all">{networkCurl}</code>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={() => copyText('health-curl', healthCurl)} className="inline-flex items-center gap-1.5 text-xs text-zion-cyan hover:text-white transition"><Copy className="h-3.5 w-3.5" />{copied === 'health-curl' ? (cs ? 'Zkopirovano' : 'Copied') : cs ? 'Kopirovat health' : 'Copy health'}</button>
            <button onClick={() => copyText('network-curl', networkCurl)} className="inline-flex items-center gap-1.5 text-xs text-zion-cyan hover:text-white transition"><Copy className="h-3.5 w-3.5" />{copied === 'network-curl' ? (cs ? 'Zkopirovano' : 'Copied') : cs ? 'Kopirovat network' : 'Copy network'}</button>
          </div>
        </div>

        <div className="zion-rainbow-sub p-6" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{cs ? 'Export a docs' : 'Export & Docs'}</p>
          <div className="space-y-2.5 text-sm">
            <a href="/api/network" target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2 hover:bg-black/40 transition">
              <span className="font-mono text-xs text-gray-200">/api/network</span>
              <Download className="h-3.5 w-3.5 text-zion-gold" />
            </a>
            <a href="/api/health" target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2 hover:bg-black/40 transition">
              <span className="font-mono text-xs text-gray-200">/api/health</span>
              <Download className="h-3.5 w-3.5 text-zion-gold" />
            </a>
            <Link href="/monitoring" className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2 hover:bg-black/40 transition">
              <span className="text-gray-200">{cs ? 'Monitoring dashboard' : 'Monitoring dashboard'}</span>
              <ExternalLink className="h-3.5 w-3.5 text-zion-gold" />
            </Link>
            <Link href="/docs#live-index" className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2 hover:bg-black/40 transition">
              <span className="text-gray-200">{cs ? 'Centrum dokumentace' : 'Docs hub'}</span>
              <ExternalLink className="h-3.5 w-3.5 text-zion-gold" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}