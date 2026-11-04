'use client';

/**
 * Pruh „DÍVÁŠ SE" — jedno místo pro všechny hry.
 *
 * Divák musí na první pohled poznat, že nehraje: jinak mačká klávesy, diví se,
 * že se nic neděje, a myslí si, že je hra rozbitá. Pruh nese id místnosti
 * (aby šlo poznat, na co se dívá) a cestu zpět do lobby.
 */

import Link from 'next/link';
import { useI18n } from '@/core/i18n';

export function SpectatorBar({ room, className = '' }: { room: string; className?: string }) {
  const { lang } = useI18n();
  const cs = lang === 'cs';

  return (
    <div className={`arena-spectator ${className}`.trim()} role="status">
      <strong>👁 {cs ? 'DÍVÁŠ SE' : 'WATCHING'}</strong>
      <span>{room}</span>
      <Link href="/multiplayer" className="arena-link">
        {cs ? 'do lobby' : 'to lobby'}
      </Link>
    </div>
  );
}
