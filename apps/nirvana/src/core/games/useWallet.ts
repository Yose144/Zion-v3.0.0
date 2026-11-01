'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/core/session/AuthProvider';

/**
 * ZION zůstatek pro HUD.
 *
 * Bere se z uzlu (`getUtxos` → `total_amount`), ne z `getBalance` — ten je
 * account-model a u UTXO peněženky vrací 0. Když RPC mlčí, HUD ukáže „—"
 * a zkusí to za minutu znovu; hra kvůli tomu nesmí spadnout.
 */

export type WalletState = 'idle' | 'loading' | 'ready' | 'unavailable';

export interface WalletInfo {
  state: WalletState;
  /** Zůstatek v ZION, nebo null když ho neznáme. */
  zion: number | null;
  address: string | null;
}

const REFRESH_MS = 60_000;

export function useWallet(): WalletInfo {
  const { user } = useAuth();
  const [state, setState] = useState<WalletState>('idle');
  const [zion, setZion] = useState<number | null>(null);

  const address =
    user?.linkedAddresses?.find((entry) => entry.chainType === 'zion-l1')?.address ??
    (user?.primaryAddress?.startsWith('zion1') ? user.primaryAddress : null);

  useEffect(() => {
    if (!address) {
      setState('idle');
      setZion(null);
      return;
    }
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      setState((previous) => (previous === 'ready' ? previous : 'loading'));
      try {
        const response = await fetch(
          `/api/wallet/balance?address=${encodeURIComponent(address)}`,
          { cache: 'no-store' },
        );
        const json = (await response.json()) as { ok?: boolean; zion?: number };
        if (!live) return;
        if (json.ok && typeof json.zion === 'number') {
          setZion(json.zion);
          setState('ready');
        } else {
          setState('unavailable');
        }
      } catch {
        if (live) setState('unavailable');
      }
      if (live) timer = setTimeout(load, REFRESH_MS);
    };

    void load();
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [address]);

  return { state, zion, address };
}
