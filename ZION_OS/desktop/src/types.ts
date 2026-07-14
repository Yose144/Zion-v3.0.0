export type TabId =
  | 'overview'
  | 'mining'
  | 'network'
  | 'ecosystem'
  | 'ops'
  | 'nodes'
  | 'topology'
  | 'orchestrator'
  | 'pool-miners'
  | 'payout'
  | 'revenue'
  | 'miner-live'
  | 'l1'
  | 'l2'
  | 'l3'
  | 'warp'
  | 'l4'
  | 'l5'
  | 'l6'
  | 'hiran'
  | 'ai-agents'
  | 'ncl-jobs'
  | 'poc-lab'
  | 'services'
  | 'alerts'
  | 'logs'
  | 'backups'
  | 'fleet'
  | 'settings'
  | 'explorer'
  | 'wallets'
  | 'dao'
  | 'bridge'
  | 'bridge-validators'
  | 'warp-swap'
  | 'cex'
  | 'charts'
  | 'events'
  | 'metrics'
  | 'database'
  | 'env'
  | 'genesis'
  | 'blockers'
  | 'ops'
  | 'servers-setup'
  | 'launch-day'
  | 'wizard'
  | 'agent';

export const TAB_ACCENTS: Record<TabId, string> = {
  overview: '255 215 0',
  mining: '251 191 36',
  network: '6 182 212',
  ecosystem: '147 51 234',
  ops: '249 115 22',
  nodes: '16 185 129',
  topology: '6 182 212',
  orchestrator: '6 182 212',
  'pool-miners': '147 51 234',
  payout: '251 191 36',
  revenue: '251 191 36',
  'miner-live': '251 191 36',
  l1: '16 185 129',
  l2: '147 51 234',
  l3: '139 92 246',
  warp: '147 51 234',
  l4: '249 115 22',
  l5: '245 158 11',
  l6: '244 63 94',
  hiran: '139 92 246',
  'ai-agents': '217 70 239',
  'ncl-jobs': '147 51 234',
  'poc-lab': '217 70 239',
  services: '99 102 241',
  alerts: '244 63 94',
  logs: '156 163 175',
  backups: '59 130 246',
  fleet: '6 182 212',
  settings: '100 116 139',
  explorer: '6 182 212',
  wallets: '251 191 36',
  dao: '147 51 234',
  bridge: '251 191 36',
  'bridge-validators': '59 130 246',
  'warp-swap': '217 70 239',
  cex: '245 158 11',
  charts: '6 182 212',
  events: '56 189 248',
  metrics: '99 102 241',
  database: '59 130 246',
  env: '100 116 139',
  genesis: '255 215 0',
  blockers: '239 68 68',
  'servers-setup': '249 115 22',
  'launch-day': '255 215 0',
  wizard: '147 51 234',
  agent: '16 185 129',
};
