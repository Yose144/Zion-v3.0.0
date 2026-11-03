# NIRVANA — responsivita celého webu

**Datum:** 2026-11-03 · **Rozsah:** všech devět povrchů (`/`, `/park`, `/mars`,
`/venus`, `/mercury`, `/earth`, `/avatars`, `/saturn`, `/hiran`) · **Stav:**
opraveno a nasazeno.

## 1. Jak se to měřilo

Dva nové nástroje, oba bez produkčních zásahů:

- **`.artifacts/probe/responsive.mjs`** — projde devět rout na čtyřech
  viewportech (390×844, 844×390, 768×1024, 1440×900) a pro každou změří:
  přesah dokumentu (`scrollWidth − clientWidth`), prvky mimo viewport
  (kliknutelné i statické) a dotykové cíle menší než 30 px.
- **`.artifacts/probe/shots-responsive.mjs`** — screenshoty všech rout na
  výšku i na šířku (`deviceScaleFactor 2`), protože čísla neukážou, že se
  text překrývá.

Screenshoty odhalily víc než metriky: **horizontální přesah nebyl ani na jedné
stránce**, ale obsah se překrýval uvnitř. To je přesně ta třída chyb, kterou
`overflow` nevidí.

## 2. Co bylo rozbité (a proč to metriky nezachytily)

| Povrch | Problém | Příčina |
|---|---|---|
| `/` (brána) | žeton „přihlásit" nebyl vidět | bublina chatu (`fixed`, z 60) ležela na liště; dokument nepřetéká, protože lišta se vešla — jen pod chat |
| `/` na šířku | celá karta brány se ořezávala, „Vstoupit do Nirvany" za lištou | karta je vyšší než 390 px a `min-h-screen` + `items-center` obsah ořízne na obou stranách |
| `/park` na šířku | ZION za chatem | lišta je na šířku dole u okraje (na výšku zvednutá nad chat) |
| `/venus`, `/mars` na šířku | totéž | stejná příčina |
| `/earth` | start nebyl na jedné obrazovce | karty hrdinů `minmax(9,5rem)` = dvě na řádek, šest řádků scrollu |
| `/hiran` | nápověda „Táhni pro otočení" ležela na CTA „Zeptat se Hirana" | obojí `bottom: 4,6rem` |
| `/hiran` | poslední brány v pásu nešly dočíst | pás je `overflow-x: auto`, poslední pily končily pod chatem |
| `/hiran` | 3D popisky se překrývaly („Kailash" přes „Království srdce") | třináct `SceneLabel` v záběru 390 px |
| `/saturn` | poslední kapitoly pod chatem | panel končil u spodního okraje |
| `/avatars` | jméno postavy pod lištou, seznam oříznutý uprostřed řádku | `100dvh` bez rezervy na fixed lištu; `overflow-y: auto` bez fade |
| všechny | dotykové cíle 19–30 px | padding textu, ne tlačítka |

## 3. Co se změnilo

- **Bublina chatu vs lišta:** lišta má na ≤760 px a na `max-height: 480px`
  pravý inset `4,9rem`, takže končí před chatem (na výšku je zvednutá nad ním,
  tam se rezerva nedělá).
- **`/earth` výběr hrdiny:** na ≤560 px tři sloupce (`minmax(5,6rem)`), menší
  portrét (2,6rem), podtitul skrytý, text na střed. Výběr se zkrátil
  z ~1200 px scrollu na jednu obrazovku.
- **`/hiran`:** nápověda nad CTA (`8,6rem`), pás bran má pravý inset, takže
  i poslední brána jde odscrollovat. `HiranScene` dostal `gateLabels` — na
  ≤760 px se 3D jména nekreslí a nechává je pás dole (jména jsou tam i tak).
- **`/saturn`:** panel kapitol posunut nad chat (`4,4rem`), výška 34 vh.
- **`/avatars`:** spodní rezerva `5,4rem` v základním paddingu (platí i pro
  desktop layout) + `mask-image` fade na seznamu.
- **Brána ZAP pasu:** `.pass-gate` scrolluje, na `max-height: 620px` se karta
  zarovná nahoru a zmenší padding.
- **Dotykové cíle:** na `(hover: none) and (pointer: coarse)` mají lišta her,
  odkazy v chrome, přepínač režimu, pás bran a filtry avatara `min-height:
  2,5rem` (40 px).

## 4. Ověření

- `responsive.mjs` na produkci po opravě: **9/9 rout × 4 viewporty bez
  přesahu i bez prvků mimo viewport** (jediná výjimka je vodorovně scrollovatelný
  pás bran na `/hiran`, což je záměr — má inset, aby došel do konce).
- `node apps/nirvana/e2e/mobile-audit.mjs` (390×844): **PASSED**, včetně
  funkčního kouzla v MOBA (mana 482 → 455).
- `MOBILE_LANDSCAPE=1 node apps/nirvana-e2e/mobile-audit.mjs` (844×390): ověřeno
  zvlášť — na šířku je málo výšky, ovládání se zmenšuje.
- Screenshoty před/po v `.artifacts/render/responsive/`.

## 5. Bonus: hydration chyba, kterou audit našel

`mobile-audit` na `/park` spadl na **React #418** (hydration mismatch).
Příčina: `dailyChallenge()` počítá den z **lokálního** data, ale server
renderuje v UTC — kolem půlnoci se den rozešel (SSR „3. 11.", klient „4. 11.")
a React zahodil serverové HTML. Karta výzvy se teď počítá až po mountu
(stejna strategie jako profil), takže se nikdy nerozejde.

Bylo to ~1 hodinu denně a jen v pásmech před/za UTC; screenshot ani
`scrollWidth` to neukážou, jen konzole.

## 6. Meze

- Měřeno jen v headless Chromiu s emulací dotyku (**skutečný telefon chybí**),
  takže chování adresního řádku (dynamická výška `dvh`) a bezpečných insetů
  na iPhonu není ověřené.
- Safírové insety jsou v CSS použité, ale na Macu mají vždy 0.
- `/present/*` je gate-nutý ZAP pasem; audit pokrývá bránu, ne 15 prezentací
  (ty mají vlastní chrome a měří se zvlášť `audit-project-scenes.py`).
- Vesmír (`/`) za pasem se v produkci bez kódu nezobrazí; responzivita scény
  je ověřená jen lokálně s `ZION_RENDER_AUDIT=1`.
