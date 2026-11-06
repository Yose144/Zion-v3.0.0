'use client';

import { LANG_MENU, type PublicLang } from '../i18n/persist';
import './lang-menu.css';

export function LanguageMenu({
  lang,
  setLang,
  summaryClassName = 'rasta-lang-switch',
}: {
  lang: PublicLang;
  setLang: (lang: PublicLang) => void;
  summaryClassName?: string;
}) {
  const current = LANG_MENU.find((item) => item.code === lang) ?? LANG_MENU[0];
  return (
    <details className="lang-menu">
      <summary className={summaryClassName} aria-label={current.label}>
        {current.short}
      </summary>
      <div className="lang-menu-pop" role="listbox" aria-label={current.label}>
        {LANG_MENU.map((item) => (
          <button
            key={item.code}
            type="button"
            role="option"
            aria-selected={item.code === lang}
            className={item.code === lang ? 'is-active' : ''}
            onClick={(event) => {
              setLang(item.code);
              const menu = event.currentTarget.closest('details');
              if (menu) menu.open = false;
            }}
          >
            <span>{item.short}</span>
            {item.label}
          </button>
        ))}
      </div>
    </details>
  );
}
