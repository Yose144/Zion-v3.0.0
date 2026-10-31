import type { Locale } from '@zion/contract';
import { t } from '@zion/i18n';

/**
 * Host světa.
 *
 * F0: jen místo, kde svět bude. Záměrně **žádný three.js v bundle** —
 * scéna se ve F2 načte lazy (dynamic, ssr:false), aby Místnost a okna
 * byly interaktivní dřív, než se stáhne graf. Tenhle soubor se pak
 * nezmění: změní se jen import uvnitř.
 */
export function SceneHost({ locale, height = 240 }: { locale: Locale; height?: number }) {
  return (
    <div className="k-scene" style={{ height }} role="img" aria-label={t(locale, 'room')}>
      <div className="k-scene-label">{t(locale, 'brand')} · F2</div>
    </div>
  );
}
