'use client';

import { useEffect, useState } from 'react';

/**
 * Respektuje `prefers-reduced-motion` (WCAG 2.3.3).
 *
 * Ve flotile se dřív na nastavení neptal **nikdo**: kamera diváka obletovala,
 * značky doků pulzovaly a náhled v marketu se otáčel sám. Pro člověka, kterému
 * pohyb dělá zle, to je nepoužitelné a je to jeho volba v systému, ne naše.
 *
 * Vrací `true` = omezit pohyb. Na serveru vždy `false` (aby se HTML nerozešlo
 * s hydratací); po mountu se hodnota dorovná.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return reduced;
}
