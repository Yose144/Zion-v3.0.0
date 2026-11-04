'use client';

/**
 * Tlačítko „VR" — jedno pro všechny hry.
 *
 * Prohlížeč bez WebXR ho nechá viditelné (klik jen nic neudělá a vrátí se),
 * protože schovávat ovládání podle schopností zařízení mate: hráč na tabletu
 * nepozná, jestli VR chybí, nebo je jen jinde. `enterVR()` sám selže tiše.
 */

import { useState } from 'react';
import type { Xr } from './index';

export function VrButton({
  xr,
  label = 'VR',
  className = 'arena-vr',
  title,
}: {
  xr: Xr;
  label?: string;
  className?: string;
  title?: string;
}) {
  const [busy, setBusy] = useState(false);
  if (xr.presenting) return null;

  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      title={title ?? 'Vstoupit do VR (WebXR)'}
      onClick={() => {
        setBusy(true);
        void xr.store
          .enterVR()
          .catch(() => undefined)
          .finally(() => setBusy(false));
      }}
    >
      {busy ? '…' : label}
    </button>
  );
}
