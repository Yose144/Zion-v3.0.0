import type { CoinInfo } from './types';

// Stratum lives on EDGE — pool.zionterranova.com is the EDGE2 web dashboard
// and does not forward stratum ports. All coins share one stratum endpoint:
// TCP :8444, TLS :8445, SOLO :8446. Coin selection happens via miner flags
// (--force-coin / --algorithm) or the v3 hello CoinPreference.
export const STRATUM_HOST = 'stratum.zionterranova.com';
export const STRATUM_PORT_TCP = 8444;
export const STRATUM_PORT_TLS = 8445;
export const STRATUM_PORT_SOLO = 8446;

export interface ConnectCmd {
  miner: string;
  label: string;
}

export function walletPlaceholder(coinId: string): string {
  switch (coinId) {
    case 'zion':
      return 'zion1…';
    case 'qtc':
      return 'qz…';
    case 'prl':
      return 'prl1…';
    default:
      return 'wallet';
  }
}

/**
 * Copy-ready connect commands per coin — single source of truth shared by
 * /start (full guide) and /coin/[id] (per-coin config cards).
 */
export function connectCmds(
  coin: CoinInfo,
  wallet: string,
  worker: string,
  tls: boolean,
  solo = false,
): ConnectCmd[] {
  const w = wallet || `<${walletPlaceholder(coin.id)}>`;
  const wrk = worker || 'rig-1';
  const addr = `${w}.${wrk}`;
  const port = solo ? STRATUM_PORT_SOLO : tls ? STRATUM_PORT_TLS : STRATUM_PORT_TCP;
  // SOLO :8446 is plain TCP (TLS layer only on :8445) — solo sessions just
  // skip PPLNS window weighting, winner-take-all payout.
  const scheme = tls ? 'stratum+ssl' : 'stratum+tcp';
  const srbTls = tls ? '--tls true' : '';

  switch (coin.id) {
    case 'zion':
      return [
        {
          miner: 'zion-miner (nativní)',
          label: `zion-miner --pool ${scheme}://${STRATUM_HOST}:${port} --wallet ${w} --worker ${wrk}`,
        },
        {
          miner: 'stratum v1',
          label: `-o ${scheme}://${STRATUM_HOST}:${port} -u ${addr} -p x`,
        },
      ];
    case 'qtc':
      return [
        {
          miner: 'zion-miner',
          label: `zion-miner --force-coin qtc --pool ${scheme}://${STRATUM_HOST}:${port} --wallet ${w} --worker ${wrk}`,
        },
        {
          miner: 'SRBMiner-MULTI',
          label: `SRBMiner-MULTI --algorithm quantus --pool ${STRATUM_HOST}:${port} --wallet ${addr} ${srbTls}`.trim(),
        },
        {
          miner: 'XMRig',
          label: `xmrig -o ${STRATUM_HOST}:${port} -u ${addr} -p x --coin quantus ${srbTls}`.trim(),
        },
      ];
    case 'prl':
      return [
        {
          miner: 'zion-miner',
          label: `zion-miner --force-coin prl --pool ${scheme}://${STRATUM_HOST}:${port} --wallet ${w} --worker ${wrk}`,
        },
        {
          miner: 'SRBMiner-MULTI ≥3.7.6',
          label: `SRBMiner-MULTI --algorithm pearlhash --pool ${STRATUM_HOST}:${port} --wallet ${addr} --gpu ${srbTls}`.trim(),
        },
      ];
    case 'multi':
      return [
        {
          miner: 'stratum v1',
          label: `-o ${scheme}://${STRATUM_HOST}:${port} -u ${addr} -p z=<coin>`,
        },
      ];
    default:
      // auxPoW upstream legs — routed by wallet address on the shared
      // stratum; any Stratum v1 client works.
      return [
        {
          miner: 'stratum v1',
          label: `-o ${scheme}://${STRATUM_HOST}:${port} -u ${addr} -p x`,
        },
      ];
  }
}
