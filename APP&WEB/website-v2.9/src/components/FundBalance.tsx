'use client';

import { useEffect, useState } from 'react';
import { useLang } from '@/contexts/LanguageContext';

type BalanceState = {
  balance: number | null;
  error: boolean;
};

async function fetchAddressBalance(address: string): Promise<number> {
  const res = await fetch(`/api/blockchain/balance?addr=${encodeURIComponent(address)}`);
  if (!res.ok) throw new Error('balance fetch failed');
  const data = await res.json();
  return Number(data?.balance?.total ?? 0);
}

export function useZionBalance(address: string): BalanceState {
  const [state, setState] = useState<BalanceState>({ balance: null, error: false });

  useEffect(() => {
    if (!address) return;
    let cancelled = false;

    const load = async () => {
      try {
        const balance = await fetchAddressBalance(address);
        if (!cancelled) setState({ balance, error: false });
      } catch {
        if (!cancelled) setState((prev) => ({ ...prev, error: true }));
      }
    };

    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [address]);

  return state;
}

export function useZionBalanceSum(addresses: string[]): BalanceState {
  const [state, setState] = useState<BalanceState>({ balance: null, error: false });
  const key = addresses.join(',');

  useEffect(() => {
    if (addresses.length === 0) return;
    let cancelled = false;

    const load = async () => {
      try {
        const values = await Promise.all(addresses.map(fetchAddressBalance));
        const balance = values.reduce((sum, v) => sum + v, 0);
        if (!cancelled) setState({ balance, error: false });
      } catch {
        if (!cancelled) setState((prev) => ({ ...prev, error: true }));
      }
    };

    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}

function formatBalance(value: number, cs: boolean, compact = false) {
  return new Intl.NumberFormat(cs ? 'cs-CZ' : 'en-US', {
    maximumFractionDigits: 2,
    notation: compact ? 'compact' : 'standard',
  }).format(value);
}

export function BalanceText({
  address,
  compact = false,
  className,
}: {
  address: string;
  compact?: boolean;
  className?: string;
}) {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const { balance, error } = useZionBalance(address);

  if (balance === null) {
    return <span className={className}>{error ? '—' : cs ? 'Načítám…' : 'Loading…'}</span>;
  }
  return <span className={className}>{formatBalance(balance, cs, compact)}</span>;
}

export default function FundBalance({
  address,
  rc,
  label,
  className = '',
}: {
  address: string;
  rc: string;
  label?: string;
  className?: string;
}) {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const { balance, error } = useZionBalance(address);

  const display = balance === null
    ? (error ? '—' : cs ? 'Načítám…' : 'Loading…')
    : formatBalance(balance, cs, true);

  return (
    <div
      className={`zion-rainbow-sub p-4 text-center transition-colors hover:bg-white/5 ${className}`}
      style={{ '--rc': rc } as React.CSSProperties}
    >
      <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">
        {label ?? (cs ? 'Aktuální zůstatek' : 'Current balance')}
      </p>
      <p className="text-3xl font-bold text-white">{display}</p>
      <p className="text-xs text-gray-500 mt-1">
        {balance === null ? 'ZION' : `${formatBalance(balance, cs)} ZION`}
      </p>
    </div>
  );
}

export function FundBalanceSum({
  addresses,
  rc,
  label,
  className = '',
}: {
  addresses: string[];
  rc: string;
  label?: string;
  className?: string;
}) {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const { balance, error } = useZionBalanceSum(addresses);

  const display = balance === null
    ? (error ? '—' : cs ? 'Načítám…' : 'Loading…')
    : formatBalance(balance, cs, true);

  return (
    <div
      className={`zion-rainbow-sub p-4 text-center transition-colors hover:bg-white/5 ${className}`}
      style={{ '--rc': rc } as React.CSSProperties}
    >
      <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">
        {label ?? (cs ? 'Aktuální zůstatek' : 'Current balance')}
      </p>
      <p className="text-3xl font-bold text-white">{display}</p>
      <p className="text-xs text-gray-500 mt-1">
        {balance === null ? 'ZION' : `${formatBalance(balance, cs)} ZION`}
      </p>
    </div>
  );
}
