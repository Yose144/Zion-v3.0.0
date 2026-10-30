'use client';

import { useI18n } from '@/core/i18n';
import type { WorldPoint } from '@/lib/worlds';

export function WorldPortal({
  worlds,
  selectedId,
  failed,
  onSelect,
  onClose,
}: {
  worlds: WorldPoint[];
  selectedId: string | null;
  failed: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const selected = worlds.find((world) => world.id === selectedId) ?? null;
  const title = lang === 'cs' ? 'Svět' : 'World';

  return (
    <aside className="portal" role="dialog" aria-label={title}>
      <header className="portal-head">
        <h2>{selected ? selected.name : title}</h2>
        <button type="button" onClick={onClose}>
          {t('close')}
        </button>
      </header>
      {failed && <p>{t('worldsEmpty')}</p>}
      {selected && (
        <p>
          {t('layer')} {selected.layer}
          {selected.location ? ` · ${selected.location}` : ''}
          {selected.vibe ? ` · ${selected.vibe}` : ''}
        </p>
      )}
      {selected?.summary && <p>{selected.summary}</p>}
      {worlds.length > 0 && (
        <ul>
          {worlds.map((world) => (
            <li key={world.id}>
              <button
                type="button"
                className={world.id === selectedId ? 'world-current' : undefined}
                onClick={() => onSelect(world.id)}
              >
                {world.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
