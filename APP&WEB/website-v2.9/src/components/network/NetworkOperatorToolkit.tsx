'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Copy, Download, ExternalLink, Terminal } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { tr } from '@/lib/translations';

export default function NetworkOperatorToolkit({ cs, primaryPool }: { cs: boolean; primaryPool: string }) {
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
    <section className="rounded-4xl border border-white/10 bg-black/40 p-8">
      <div className="flex flex-col gap-2 mb-8">
        <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('APP_WEB_website_v2_9_src_components_netw', 'operator_toolkit', lang)}</p>
        <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
          <Terminal className="h-7 w-7 text-zion-cyan" />
          {tr('APP_WEB_website_v2_9_src_components_netw', 'network_ops_pro', lang)}
        </h2>
        <p className="text-sm text-gray-400">{tr('APP_WEB_website_v2_9_src_components_netw', 'failover_templates_health_probes_and_machine_reada', lang)}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{tr('APP_WEB_website_v2_9_src_components_netw', 'primary_mining', lang)}</p>
          <p className="text-sm text-gray-300 mb-3">{tr('APP_WEB_website_v2_9_src_components_netw', 'current_public_stratum_endpoint_on_zion2_historica', lang)}</p>
          <code className="block rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-zion-gold break-all">{xmrigConnect}</code>
          <button onClick={() => copyText('xmrig-connect', xmrigConnect)} className="mt-3 inline-flex items-center gap-2 text-xs text-zion-cyan hover:text-white transition">
            <Copy className="h-3.5 w-3.5" /> {copied === 'xmrig-connect' ? (tr('APP_WEB_website_v2_9_src_components_netw', 'copied', lang)) : tr('APP_WEB_website_v2_9_src_components_netw', 'copy_command', lang)}
          </button>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{tr('APP_WEB_website_v2_9_src_components_netw', 'health_probes', lang)}</p>
          <div className="space-y-2">
            <code className="block rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-zion-gold break-all">{healthCurl}</code>
            <code className="block rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-zion-gold break-all">{networkCurl}</code>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={() => copyText('health-curl', healthCurl)} className="inline-flex items-center gap-1.5 text-xs text-zion-cyan hover:text-white transition"><Copy className="h-3.5 w-3.5" />{copied === 'health-curl' ? (tr('APP_WEB_website_v2_9_src_components_netw', 'copied', lang)) : tr('APP_WEB_website_v2_9_src_components_netw', 'copy_health', lang)}</button>
            <button onClick={() => copyText('network-curl', networkCurl)} className="inline-flex items-center gap-1.5 text-xs text-zion-cyan hover:text-white transition"><Copy className="h-3.5 w-3.5" />{copied === 'network-curl' ? (tr('APP_WEB_website_v2_9_src_components_netw', 'copied', lang)) : tr('APP_WEB_website_v2_9_src_components_netw', 'copy_network', lang)}</button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{tr('APP_WEB_website_v2_9_src_components_netw', 'export_docs', lang)}</p>
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
              <span className="text-gray-200">{tr('APP_WEB_website_v2_9_src_components_netw', 'monitoring_dashboard', lang)}</span>
              <ExternalLink className="h-3.5 w-3.5 text-zion-gold" />
            </Link>
            <Link href="/docs#live-index" className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2 hover:bg-black/40 transition">
              <span className="text-gray-200">{tr('APP_WEB_website_v2_9_src_components_netw', 'docs_hub', lang)}</span>
              <ExternalLink className="h-3.5 w-3.5 text-zion-gold" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}