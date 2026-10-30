'use client';

import { Megaphone, Wrench, Coins, Info, ArrowUpCircle } from 'lucide-react';
import { ANNOUNCEMENTS, type Announcement } from '@/lib/announcements';
import { fmtAgo } from '@/lib/format';
import { useLang } from '@/lib/i18n';

const TAG_STYLE: Record<Announcement['tag'], { icon: typeof Info; cls: string; cs: string; en: string }> = {
  upgrade: { icon: ArrowUpCircle, cls: 'pill-native', cs: 'upgrade', en: 'upgrade' },
  maintenance: { icon: Wrench, cls: 'pill-sync', cs: 'údržba', en: 'maintenance' },
  payout: { icon: Coins, cls: 'pill-bridged', cs: 'výplaty', en: 'payouts' },
  info: { icon: Info, cls: '', cs: 'info', en: 'info' },
};

export default function AnnouncementsPage() {
  const { t, lang } = useLang();
  const items = [...ANNOUNCEMENTS].sort((a, b) => b.ts - a.ts);

  return (
    <div className="pt-8">
      <header className="page-hero">
        <p className="rasta-hero-kicker">
          <Megaphone size={12} /> {t('Oznámení', 'Announcements')}
        </p>
        <h1>{t('Oznámení poolu', 'Pool announcements')}</h1>
        <p className="page-hero-sub">
          {t(
            'Upgrady, údržba a výplatní milníky — co se na poolu děje.',
            'Upgrades, maintenance and payout milestones — what is happening on the pool.',
          )}
        </p>
      </header>

      <div className="mx-auto mt-6 max-w-3xl">
        {items.map((a, i) => {
          const s = TAG_STYLE[a.tag];
          const Icon = s.icon;
          const copy = lang === 'cs' ? a.cs : a.en;
          return (
            <article key={i} className="pool-card card-glow mb-4 flex gap-4 p-5">
              <Icon size={18} className="mt-0.5 shrink-0 text-rasta-gold" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-bold text-white">{copy.title}</h2>
                  <span className={`pill ${s.cls}`}>{lang === 'cs' ? s.cs : s.en}</span>
                  <span className="text-[0.65rem] text-white/35">{fmtAgo(a.ts, lang)}</span>
                </div>
                <p className="mt-1.5 text-[0.8rem] leading-relaxed text-white/55">{copy.body}</p>
              </div>
            </article>
          );
        })}
        {items.length === 0 && (
          <p className="py-10 text-center text-xs text-white/30">
            {t('Zatím žádná oznámení.', 'No announcements yet.')}
          </p>
        )}
      </div>
    </div>
  );
}
