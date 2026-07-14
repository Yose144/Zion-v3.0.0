import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { Card } from '../components/ui/Card';
import { PaneHeader } from '../components/ui/PaneHeader';
import { TAB_ACCENTS, type TabId } from '../types';

const ENDPOINTS: Partial<Record<TabId, string>> = {
  nodes: '/api/nodes',
  topology: '/api/topology',
  orchestrator: '/api/orchestrator/status',
  'pool-miners': '/api/pool/miners-dashboard',
  payout: '/api/payout',
  revenue: '/api/revenue',
  'miner-live': '/api/miner/live',
  l1: '/api/layer-status?layer=l1',
  l2: '/api/layer-status?layer=l2',
  l3: '/api/layer-status?layer=l3',
  l4: '/api/layer-status?layer=l4',
  l5: '/api/layer-status?layer=l5',
  l6: '/api/layer-status?layer=l6',
  hiran: '/api/hiran/agents',
  'ai-agents': '/api/hiran/agents',
  services: '/api/services',
  alerts: '/api/alerts',
  logs: '/api/log-files',
  backups: '/api/backup/status',
  fleet: '/api/fleet/rigs',
  settings: '/api/settings/load',
  explorer: '/api/blocks?limit=20',
  wallets: '/api/wallets',
  dao: '/api/dao/proposals',
  bridge: '/api/layer-status?layer=l2',
  'bridge-validators': '/api/agent/status',
  'warp-swap': '/api/layer-status?layer=l3',
  cex: '/api/layer-status?layer=l2',
  charts: '/api/history',
  events: '/api/events',
  metrics: '/api/metrics/collector',
  database: '/api/layer-status?layer=l1',
  env: '/api/env',
  genesis: '/api/layer-status?layer=l1',
  blockers: '/api/security',
  ops: '/api/controls',
  'servers-setup': '/api/servers-setup',
  'launch-day': '/api/mainnet-status',
  wizard: '/api/settings/load',
  agent: '/api/agent/status',
  warp: '/api/layer-status?layer=l3',
  'ncl-jobs': '/api/hiran/agents',
  'poc-lab': '/api/settings/load',
};

const LABELS: Partial<Record<TabId, string>> = {
  nodes: 'Nodes',
  topology: 'Topology',
  orchestrator: 'Orchestrator',
  'pool-miners': 'Pool Miners',
  payout: 'Payouts',
  revenue: 'Revenue',
  'miner-live': 'Live Miner',
  l1: 'L1 Consensus',
  l2: 'L2 Bridge / DAO',
  l3: 'L3 Advanced',
  l4: 'L4 OASIS',
  l5: 'L5 Humanitarian',
  l6: 'L6 Space',
  hiran: 'Hiran AI',
  'ai-agents': 'AI Agents',
  'ncl-jobs': 'NCL Jobs',
  'poc-lab': 'PoC Lab',
  services: 'Services Health',
  alerts: 'Alerts',
  logs: 'Logs',
  backups: 'Backups',
  fleet: 'Fleet',
  settings: 'Settings',
  explorer: 'Explorer',
  wallets: 'Wallets',
  dao: 'DAO',
  bridge: 'Bridge',
  'bridge-validators': 'Bridge Validators',
  'warp-swap': 'Cross-Chain Swap',
  cex: 'CEX+DEX',
  charts: 'Charts',
  events: 'Events',
  metrics: 'Metrics',
  database: 'Database',
  env: 'Environment',
  genesis: 'Genesis',
  blockers: 'P0 Blockers',
  ops: 'Ops',
  'servers-setup': 'Servers Setup',
  'launch-day': 'Launch Day',
  wizard: 'Setup Wizard',
  agent: 'Agent',
  warp: 'WARP',
};

const ICONS: Partial<Record<TabId, string>> = {
  nodes: '🔗',
  topology: '🗺',
  orchestrator: '🎭',
  'pool-miners': '⛏',
  payout: '💰',
  revenue: '📈',
  'miner-live': '📡',
  l1: '🟢',
  l2: '🟣',
  l3: '🧠',
  l4: '🌸',
  l5: '🌍',
  l6: '⚡',
  hiran: '🧠',
  'ai-agents': '🤖',
  'ncl-jobs': '📋',
  'poc-lab': '🧪',
  services: '⚙',
  alerts: '🚨',
  logs: '📜',
  backups: '💾',
  fleet: '🚢',
  settings: '⚙',
  explorer: '🔍',
  wallets: '👛',
  dao: '🗳',
  bridge: '🌉',
  'bridge-validators': '🔐',
  'warp-swap': '🔄',
  cex: '🏦',
  charts: '📊',
  events: '📅',
  metrics: '📊',
  database: '🗄',
  env: '🔑',
  genesis: '🌱',
  blockers: '🚧',
  ops: '🛠',
  'servers-setup': '🖥',
  'launch-day': '🚀',
  wizard: '🧙',
  agent: '🤖',
  warp: '🌀',
};

export default function Placeholder({ tab }: { tab: TabId }) {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const endpoint = ENDPOINTS[tab];

  useEffect(() => {
    setLoading(true);
    setData(null);
    if (!endpoint) {
      setLoading(false);
      return;
    }
    apiFetch<unknown>(endpoint).then((d) => {
      setData(d);
      setLoading(false);
    });
  }, [tab, endpoint]);

  const accent = TAB_ACCENTS[tab];
  const label = LABELS[tab] ?? tab;
  const icon = ICONS[tab] ?? '📦';

  return (
    <Card className="pane-accent" accent={accent}>
      <PaneHeader icon={<span>{icon}</span>} title={label} sub="Live data from Python dashboard" />
      {loading ? (
        <div className="text-sm text-gray-400">Loading…</div>
      ) : !data ? (
        <div className="text-sm text-gray-400">No data available for this view.</div>
      ) : (
        <div className="overflow-x-auto">
          <pre className="text-[10px] font-mono text-gray-300 whitespace-pre-wrap break-all">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </Card>
  );
}
