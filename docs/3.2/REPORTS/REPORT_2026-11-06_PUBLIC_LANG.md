# Veřejné jazyky cs / en / es / pt / fr a ZIP knihy u dárku

**Datum:** 2026-11-06
**Stav:** v gitu, **nenasazeno**.

Kódy jsou `cs`, `en`, `es`, `pt`, `fr`. Volba se ukládá do cookie `zion_locale` a do `localStorage` klíče `zion-lang`. Na localhostu ji vidí další port, na produkci doména `.zionterranova.com`. Když překlad chybí, text spadne na angličtinu a teprve potom na češtinu.

## Přepínač

Sdílené menu je `apps/shared/ui/LanguageMenu.tsx`, čtení a zápis `apps/shared/i18n/persist.ts`.

| Povrch | Co se přepíná |
|---|---|
| Web | stávající přepínač teď píše stejnou cookie (`LanguageContext`) |
| Market | menu a hero už měly pět jazyků v `translations.ts`; tenhle diff je nemění |
| Pool | odkazy v navigaci. Věty u statistik zůstávají anglicky, pokud nejsi na češtině |
| Nirvana | shell (brána, menu). Herní odstavce zůstávají anglicky. `pt`/`fr` drží `core/i18n/extra.ts` |
| Kingdom | tlačítka CZ EN ES PT FR, slovník `packages/i18n/src/extra.ts`. Scény s jen `cs`/`en` ukážou angličtinu |
| Intro a Free World | menu, hero, názvy sekcí. Těla stránek jsou česky, jinak anglicky |
| Oasis | úvodní karta a hlavní menu. Jména světů, loď a panely identity zůstávají anglicky |

Knihy, archiv a čtečka zůstávají jen `cs` a `en`. Dlouhé odstavce se nepřekládaly.

## Ověření v prohlížeči

- Kingdom španělsky, v textu je „Entrar“, cookie `zion_locale=es`.
- Market španělsky, v navigaci je Inicio.
- Intro portugalsky.
- Free World španělsky, je tam Proyectos.
- Oasis francouzsky, na úvodu je Passer.
- Pool portugalsky, v menu je Resumo. `404 /coins` je chybějící pool API, ne jazyk.
- Nirvana portugalsky na bráně: „O Primeiro Mundo“, „Entrar na Nirvana“.
- Web z aktuálního kódu (`next dev --webpack` na `:3126`): Español zapíše `zion_locale=es`. Turbopack tenhle web nesestaví (alias `fs`). Proces na `:3125` je starý build a cookie v něm není.

## Dárek v marketu

Admin `/admin/gifts` má zaškrtnutou knihu Království srdce. Objednávka `GIFT-…` dostane řádek s `filesUrl` na `Kralovstvi_srdce_kompletni_edice_5_jazyku.zip`. Potvrzení platby ten odkaz vypíše. Tokeny knihy (21 600) se k částce dárku nepřičítají. Když je pass vypnutý, řádek má id `gift-book`, aby `book-001` sám pass nevystavil. ZIP se neposílá jako příloha (asi 65 MB).

Formulář se v prohlížeči otevřel, dialog před odesláním knihu jmenuje. Skutečný dárek se neodesílal.
