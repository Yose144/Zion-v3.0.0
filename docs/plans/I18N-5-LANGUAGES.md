# PLAN — 5 jazyků v celém ekosystému (cs · en · es · pt · fr)

> **Zadání 👤 (2026-11-05):** „cely ecosystem by mel podporovat nativne prepinani 5 jazyku,
> cz, en, sp, ptg, fr". Čeština má být **čistá** (české přepisy), překlady pak i do ostatních
> jazyků.
> **Stav: fáze 1 hotová a nasazená** (přepínač + typ + fallback), obsah se doplňuje postupně.

---

## 1. Co je hotové (fáze 1, 2026-11-05)

| Vrstva | Stav |
|---|---|
| `Lang` typ | **5 kódů** (`cs/en/es/pt/fr`) odvozených z `LANGS` v `LanguageContext` |
| Přepínač | `LangSwitcher` v navigaci (desktop i mobil), `<details>` se 5 jazyky, klávesnice i dotyk |
| Perzistence | `localStorage.zion-lang` validovaný přes `isLang()` |
| `<html lang>` | skutečný kód (dřív jen `cs`/`en`) |
| Fallback textů | `tr()` / `tx()` → `entry[lang] ?? entry.en ?? entry.cs` (nikdy prázdno) |
| Ověření | 5× přepnutí na produkci: `html-lang` správně, **202 karet** ve všech, 0 pageerror; kliknutí na „Français" v přepínači nastaví jazyk i storage |

**Důsledek pro obsah:** `es`/`pt`/`fr` zatím čtou **angličtinu**. Je to záměr — lepší čitelná
angličtina než prázdné bloky nebo strojový překlad bez korektury.

---

## 2. Rozsah, který zbývá

| Povrch | Objem | Poznámka |
|---|---|---|
| Web `translations.ts` | **395 klíčů** × 3 jazyky = 1 185 řetězců | `tr()` má EN fallback, takže nic nepadá |
| OASIS profily avatarů | **202 × 3** = 606 dokumentů | generátor už umí libovolný jazyk: `i18n/<id>.<lang>.md` |
| OASIS karty (overlay) | 202 × 7 polí × 3 | `scripts/oasis-avatar-copy/*.json` (dnes `{cs,en}`) |
| Questy | 714 × 3 | overlay + `avatars.json` |
| ZION Archive knihy | 189 kapitol × 3 | největší objem; dnes CZ + EN (146/189 EN) |
| Nirvana / hra | UI texty v komponentách | `useI18n` v `apps/nirvana` (dnes cs/en) |
| MarketPlace | vlastní `translations.ts` | paralelní session už rozšiřuje `Lang` na 5 |
| Docs / whitepapers | statické markdowny | řešit až po knihách |

---

## 3. Doporučené fáze

**F2 — Web UI (1–2 dávky).** ~~Dávka 1 hotová (2026-11-06): `nav`, `footer`, `notFound`,
`docs`, `globalRouteError`, `countdown` — 76 klíčů × 3 jazyky v `translations-langs.ts`,
nasazeno a ověřeno živě.~~ Zbývá: `hero` (44), `goldenEgg` (56), `ekamPage` (81), `features` (31),
`docsRail` (17), `chv4` (15), `onboard` (12), `whitepapers` (9) = **265 klíčů × 3**.
Přeložit `translations.ts` do es/pt/fr. Priorita: navigace, homepage,
`/l4-oasis`, `/l4-oasis/avatars`, `/market`, `/pool`, `/docs` (kde lidé přistanou). Postup: přeložit
po sekcích, `tr()` fallback nechá zbytek v EN, `tsc` + build po každé dávce.

**F2b — page-local copy (10+ dávek).** Každá stránka má vlastní objekty `{cs, en}` mimo
`translations.ts` (67 souborů, ~1 522 klíčů). **Dávka 1 hotová (2026-11-06): stránka avatarů**
(47 řetězců) — nový `src/lib/i18n-tx.ts` (`tx5(entry, lang)` a `t5(en, lang)`) + slovník
`src/lib/ui-strings/avatars.{es,pt,fr}.json` **klíčovaný anglickým zněním**, takže `Copy` objekty
zůstávají nedotčené a překlad jde doplňovat po stránkách. **Dávka 2 hotová (2026-11-06): NewsFeed (82) + L6 Issobella (143)** — `ui-strings/newsfeed.*`
a `ui-strings/issobella.*`, `i18n-tx.ts` slévá slovníky per jazyk (`merge`); issobella měla
10 pomocných funkcí `getX(cs)` mimo komponentu → dostaly druhý parametr `lang`.
**Dávka 3 hotová (2026-11-06): Strom života (219) + Maria del Camino (90) + Království srdce (81) + Nabukano (34) = 424 řetězců.** Codemod tu má dvě pasti (obojí chyceno `tsc`): pole v copy (`Copy.x` = `{cs:[...], en:[...]}`) nesmí jít přes `tx5` (vrací string) a `?.name[cs ? …]` rozbije optional chaining. **Dávka 4 hotová (2026-11-06): ArchiveLock (40) + zion-archive (33) + whitepapers (34) + te-piko-ora (73) = 180 řetězců.** Tři pasti codemodu: `X?.prop[l]` rozsekne optional chaining, pole v copy nesmí přes `tx5`, a stránky s aliasem `const l = lang === 'cs' ? 'cs' : 'en'` čtou `Copy.x[l]` (nutno `tx5(Copy.x, lang)`). Zbývá: ContractsPageClient 39, KnihovnaPanel 35, zion-archive 35, whitepapers 35, te-piko-ora 35, QvSection 34, team 32, golden-republic-bohemia 31… **Postup:** extrahovat EN řetězce stránky →
přeložit do 3 jazyků → `ui-strings/<page>.<lang>.json` → codemod `[cs ? 'cs' : 'en']` → `tx5`.

**F3 — OASIS avataři (10–14 dávek).** ~~Dávka 1 hotová (2026-11-06): `subtitle` + `role` ve všech
5 jazycích pro 202 avatarů (1 212 polí) — `scripts/oasis-avatar-copy/i18n-cards/{es,pt,fr}.json`,
`loc()` propouští jazyky, `LocalizedText` má volitelné `es/pt/fr`, stránka používá `tx(field, lang)`
s fallbackem `lang → en → cs`. Nasazeno a ověřeno.~~ Zbývá: `location`, `questLine`, `teaching`,
`ability`, `quote`, `essence` (202 × 6 × 3), questy (714 × 3) a profily (202 dokumentů × 3).

**F4 — Nirvana UI.** `useI18n` v `apps/nirvana` na 5 kódů + texty her (HUD, hangár, arény).

**F5 — ZION Archive.** 189 kapitol × 3 jazyky. Dělat po knihách, stejně jako EN session
(`TRANSLATION-PLAN.md`), s auditem `missingParts`/`duplicates`.

**F6 — Docs a metadata.** `hreflang` alternates, `sitemap`, `og:locale`, jazykové prefixy rout
(`/es/...`) nebo query (`?lang=es`) — rozhodnout, až bude obsah.

---

## 4. Pravidla (platí pro všechny fáze)

1. **Fallback nikdy nesmí být prázdný řetězec** — chybí `es` → `en` → `cs`.
2. **Kódy jsou `cs/en/es/pt/fr`**, ne `sp`/`ptg` (ty jsou jen v zadání jako zkratky jazyků).
3. **Vlastní jména a přepisy:** v CS české tvary (`Krišna`, `Ráma`, `Lakšmí`), v EN IAST
   (`Krishna`, `Rama`, `Lakshmi`), v ES/PT/FR **IAST** (jako EN). Podklad:
   `docs/docs2.9/ZION_OASIS/TRANSLITERACE.md`.
4. **Mantry, názvy děl, adresy, env klíče, čísla se nepřekládají.**
5. **Etické a právní poznámky** (`nft_policy`, „consultation gate", IP/homage) musí zůstat stejně
   kategorické ve všech jazycích.
6. Po každé dávce: `tsc --noEmit` (0), `node scripts/check-oasis-i18n.mjs` (0), build, a u
   publikovaných povrchů **SHA-256 kontrola local ↔ live**.

---

## 5. Jak ověřit fázi 1 (kdykoli)

```bash
# v prohlížeči: přepínač v navigaci → 5 položek; po výběru se změní <html lang> i texty
# headless:
node -e "…"   # viz REPORT_2026-11-05_SESSION_2.md §3 (skript ověřuje 5 jazyků a přepínač)
```

Kontrolní body: `document.documentElement.lang` == zvolený kód, `localStorage.zion-lang` == kód,
počet karet na `/l4-oasis/avatars` == 202, 0 `pageerror`.
