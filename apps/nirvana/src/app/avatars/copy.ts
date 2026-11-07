/**
 * Texty výběru avatara (`/avatars`) — jeden slovník, tři jazyky (L-10).
 *
 * Roster (jména, tituly, paprsky) je generovaný katalog v `core/avatars`,
 * tady jsou jen popisky ovládání a hlášky.
 */
import type { Localized } from '@/core/i18n';

export const AVATARS_COPY = {
  roster: {
    cs: '· {n} postav z OASIS rosteru',
    en: '· {n} figures from the OASIS roster',
    es: '· {n} figuras del roster de OASIS',
  },
  title: { cs: 'VYBER SI AVATARA', en: 'CHOOSE YOUR AVATAR', es: 'ELIGE TU AVATAR' },
  signIn: { cs: 'Přihlásit', en: 'Sign in', es: 'Entrar' },
  backToFair: { cs: '← zpět na pouť', en: '← back to the fair', es: '← volver a la feria' },
  search: { cs: 'Hledat jméno…', en: 'Search name…', es: 'Buscar nombre…' },
  searchAria: { cs: 'Hledat avatara', en: 'Search avatar', es: 'Buscar avatar' },
  all: { cs: 'vše', en: 'all', es: 'todo' },
  empty: { cs: 'Nic takového tu není.', en: 'Nothing like that here.', es: 'Aquí no hay nada así.' },
  callsign: { cs: 'Volací jméno', en: 'Callsign', es: 'Indicativo' },
  callsignHint: { cs: 'jak ti mají říkat', en: 'what they call you', es: 'cómo te llaman' },
  body: { cs: 'Postava', en: 'Body', es: 'Cuerpo' },
  bodySlim: { cs: 'hubená', en: 'slim', es: 'delgado' },
  bodyHeavy: { cs: 'statná', en: 'heavy', es: 'robusto' },
  bodyStandard: { cs: 'střední', en: 'standard', es: 'medio' },
  colour: { cs: 'Barva', en: 'Colour', es: 'Color' },
  rayColour: { cs: 'barva paprsku', en: 'ray colour', es: 'color del rayo' },
  saving: { cs: 'Ukládám…', en: 'Saving…', es: 'Guardando…' },
  savedShort: { cs: 'Uloženo ✓', en: 'Saved ✓', es: 'Guardado ✓' },
  saved: { cs: 'Uloženo — ostatní tě uvidí takhle.', en: 'Saved — this is what others will see.', es: 'Guardado: así te verán los demás.' },
  save: { cs: 'Uložit avatara', en: 'Save avatar', es: 'Guardar avatar' },
  portraitLabel: {
    cs: 'portrét · OASIS',
    en: 'portrait · OASIS',
    es: 'retrato · OASIS',
  },
  stageLabel: {
    cs: 'herní 3D model',
    en: 'in-game 3D model',
    es: 'modelo 3D del juego',
  },
  guestNote: {
    cs: 'Host si může všechno prohlédnout, ale uložit avatara jde jen přihlášenému (ZIS).',
    en: 'Guests can browse everything, but saving an avatar needs a signed-in ZIS account.',
    es: 'Los invitados pueden verlo todo, pero guardar un avatar requiere una cuenta ZIS iniciada.',
  },
} as const satisfies Record<string, Localized>;

export type AvatarsCopyKey = keyof typeof AVATARS_COPY;
