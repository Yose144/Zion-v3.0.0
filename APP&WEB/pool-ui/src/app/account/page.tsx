'use client';

// /account — authenticated ZIS profile + linked mining addresses.
// Each linked address maps to its pool-side miner dashboard (per coin),
// so a signed-in user sees their rigs without pasting addresses.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowRight, Cpu, Gem, Pickaxe, Wallet } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { zisAvatarUrl } from '@/lib/zis';
import { fetchMiner } from '@/lib/api';
import { fmtHashrate } from '@/lib/format';
import type { CoinId, MinerStats } from '@/lib/types';

// ZIS chainType → pool coin. zion-l1 → zion; other address types can
// still be probed against native payout coins by format.
const CHAIN_TO_COIN: Record<string, CoinId> = {
  'zion-l1': 'zion',
  evm: 'zion',
  qtc: 'qtc',
  prl: 'prl',
};

interface AddressStat {
  coin: CoinId;
  address: string;
  stats: MinerStats | null;
}

export default function AccountPage() {
  const { t } = useLang();
  const { user, loading, authenticated, logout } = useAuth();
  const router = useRouter();
  const [addrStats, setAddrStats] = useState<AddressStat[]>([]);
  const [probing, setProbing] = useState(false);

  // Build the probe set: primary address + every linked address, each
  // against its pool coin. zion1… addresses are also tried on the native
  // payout coins where ZIS-linked payout routing may exist.
  const probePairs = (() => {
    const pairs: Array<{ coin: CoinId; address: string }> = [];
    const seen = new Set<string>();
    const add = (address: string, chainType?: string) => {
      const coin = CHAIN_TO_COIN[chainType ?? 'zion-l1'] ?? 'zion';
      const key = `${coin}:${address}`;
      if (!seen.has(key)) {
        seen.add(key);
        pairs.push({ coin, address });
      }
    };
    if (user) {
      add(user.primaryAddress, 'zion-l1');
      user.linkedAddresses?.forEach((a) => add(a.address, a.chainType));
    }
    return pairs;
  })();

  useEffect(() => {
    if (!authenticated || probePairs.length === 0) return;
    let cancelled = false;
    setProbing(true);
    Promise.all(
      probePairs.map(async ({ coin, address }) => ({
        coin,
        address,
        stats: await fetchMiner(coin, address),
      })),
    ).then((rows) => {
      if (!cancelled) {
        setAddrStats(rows);
        setProbing(false);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, user?.id]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-white/40">
        {t('Načítám účet…', 'Loading account…')}
      </div>
    );
  }

  if (!authenticated || !user) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <div className="pool-card p-8">
          <Wallet className="mx-auto mb-4 text-rasta-gold" size={32} />
          <h1 className="mb-2 text-xl font-bold text-white">
            {t('Nepřihlášen', 'Not signed in')}
          </h1>
          <p className="mb-5 text-sm text-white/50">
            {t(
              'Pro zobrazení účtu a napojení těžby se přihlas přes ZIS tlačítkem v horní liště.',
              'Sign in with ZIS (top bar) to view your account and linked mining.',
            )}
          </p>
          <Link href="/" className="btn-gold inline-block px-5 py-2 text-sm">
            {t('Zpět na přehled', 'Back to overview')}
          </Link>
        </div>
      </div>
    );
  }

  const activeMiners = addrStats.filter((a) => a.stats && a.stats.workers.length > 0);
  const avatar = user.avatar || zisAvatarUrl(user.id, { sz: 128 });

  return (
    <div className="py-10">
      {/* Profile card */}
      <div className="pool-card mb-6 flex flex-wrap items-center gap-5 p-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatar}
          alt=""
          className="h-16 w-16 rounded-2xl border border-white/10"
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold text-white">
            {user.displayName ?? t('ZION účet', 'ZION account')}
          </h1>
          <p className="truncate font-mono text-xs text-white/45">
            {user.primaryAddress}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-2 text-[0.68rem]">
            {user.email && <span className="pill pill-sync">{user.email}</span>}
            {user.oasisPlayer && (
              <span className="pill pill-native">
                OASIS {user.oasisPlayer.level ?? ''} · {user.oasisPlayer.totalXp ?? 0} XP
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => {
            logout();
            router.push('/');
          }}
          className="btn-ghost px-4 py-2 text-xs"
        >
          {t('Odhlásit', 'Sign out')}
        </button>
      </div>

      {/* Linked addresses */}
      <div className="pool-card mb-6 p-6">
        <h2 className="kicker mb-4">
          {t('Napojené adresy', 'Linked addresses')}
        </h2>
        <div className="flex flex-col gap-2">
          {probePairs.map(({ coin, address }) => (
            <div
              key={`${coin}:${address}`}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3"
            >
              <span className="pill pill-native uppercase">{coin}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-white/70">
                {address}
              </span>
              <Link
                href={`/miner/${coin}/${address}`}
                className="flex items-center gap-1 text-xs font-semibold text-rasta-gold hover:underline"
              >
                {t('Dashboard', 'Dashboard')}
                <ArrowRight size={12} />
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[0.68rem] text-white/35">
          {t(
            'Další adresy (QTC, PRL) lze napojit v ZIS profilu na app.zionterranova.com.',
            'More addresses (QTC, PRL) can be linked in your ZIS profile at app.zionterranova.com.',
          )}
        </p>
      </div>

      {/* My mining */}
      <div className="pool-card p-6">
        <h2 className="kicker mb-4 flex items-center gap-2">
          <Pickaxe size={14} />
          {t('Moje těžba', 'My mining')}
        </h2>
        {probing ? (
          <p className="text-sm text-white/40">
            {t('Hledám aktivní workery…', 'Looking for active workers…')}
          </p>
        ) : activeMiners.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/12 px-4 py-6 text-center">
            <Cpu className="mx-auto mb-2 text-white/25" size={24} />
            <p className="text-sm text-white/45">
              {t(
                'Na tvých adresách zatím neběží žádný worker.',
                'No active workers found on your addresses.',
              )}
            </p>
            <Link
              href="/start/"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-rasta-gold hover:underline"
            >
              {t('Jak začít těžit', 'How to start mining')}
              <ArrowRight size={12} />
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {activeMiners.map(({ coin, address, stats }) => (
              <Link
                key={`${coin}:${address}`}
                href={`/miner/${coin}/${address}`}
                className="group rounded-xl border border-white/8 bg-white/[0.02] p-4 transition hover:border-rasta-gold/40"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="pill pill-native uppercase">{coin}</span>
                  <Gem size={14} className="text-rasta-gold" />
                </div>
                <p className="mb-1 truncate font-mono text-[0.68rem] text-white/40">
                  {address}
                </p>
                <p className="text-lg font-bold text-white">
                  {fmtHashrate(stats?.hashrate ?? 0)}
                </p>
                <p className="text-[0.68rem] text-white/40">
                  {stats?.workers.length ?? 0}{' '}
                  {t('workerů', 'workers')} ·{' '}
                  {t('pending', 'pending')}{' '}
                  <span className="text-rasta-gold">
                    {stats?.pending.toFixed(4)} {stats?.unit || coin.toUpperCase()}
                  </span>
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
