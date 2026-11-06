# REPORT 2026-11-06 — 5 jazyků: F2 hotová (269 klíčů) + F3 dávka 1 (karty avatarů)

> **Zadání 👤 (2026-11-05):** „cely ecosystem by mel podporovat nativne prepinani 5 jazyku,
> cz, en, sp, ptg, fr" + „jasny cestni cista ale preklady pak do jinych jazyku take".
> **Plán:** [`docs/plans/I18N-5-LANGUAGES.md`](docs/plans/I18N-5-LANGUAGES.md).
> **Předchozí krok (infrastruktura):** `REPORT_2026-11-05_SESSION_2.md` §4.

---

## 1. Co je hotové

| Vrstva | Stav |
|---|---|
| `Lang` = `cs/en/es/pt/fr` + `LangSwitcher` v navigaci | ✅ (2026-11-05) |
| Fallback `override → EN → CS` | ✅ |
| **Dávka 1 překladů es/pt/fr** | ✅ **76 klíčů × 3 jazyky** |

**Přeložené sekce** (vše, co je vidět na každé stránce): `nav` (46 řetězců — menu, skupiny,
přepínač, aria labely), `footer` (9), `notFound` (12), `docs` (4), `globalRouteError` (3),
`countdown` (2).

**Architektura:** nový `src/lib/translations-langs.ts` drží částečné překlady **mimo** základní
dvojici cs/en, takže `translations.ts` zůstává čitelný a překládat jde po dávkách. `tr()` zkouší
override → EN → CS (nikdy prázdný řetězec).

**Nepřekládá se:** vlastní jména a zkratky (`WARP`, `DAO`, `DEX`, `API`, `CEX`, `L2`/`L3`,
`Terra Nova`, `Te Pīko Ora`, `Uluru`, `Ekam`, `Kailash`, `Bodhi Lanka`, `Boa Esperança`,
`María del Camino`, `LUMI`, `Nabukano`, `Dharma Temple`, `Genesis`, `Guardian`, `Whitepapers`,
`G8 Run`, `Monitoring`, `Multichain Hub`, `Meme Lab`, `Mission Control`).

---

## 2. Ověřeno živě (deploy `20261106T000910Z`)

Navigace na produkci (`app.zionterranova.com`):

| jazyk | navigace |
|---|---|
| cs | Průzkumník · Pool · Síť · DAO · Dokumentace · Peněženka · Přehled · SÍŤ & MINING · TRH |
| en | Explorer · Pool · Network · DAO · Docs · Wallet · Dashboard · NETWORK & MINING · MARKET |
| **es** | **Explorador · Pool · Red · DAO · Documentación · Cartera · Panel · RED Y MINERÍA · MERCADO** |
| **pt** | **Explorador · Pool · Rede · DAO · Documentação · Carteira · Painel · REDE E MINERAÇÃO · MERCADO** |
| **fr** | **Explorateur · Pool · Réseau · DAO · Documentation · Portefeuille · Tableau de bord · RÉSEAU…** |

`html-lang` nese skutečný kód, `localStorage.zion-lang` se drží, 0 pageerror.
Smoke: `/`, `/l4-oasis`, `/l4-oasis/avatars`, `/docs`, `/market`, `/pool`, `/whitepapers`,
`/roadmap`, `/api/health` → **200**, neexistující cesta → **404**.

---

## 3. Pasti, které to odhalilo

1. **Souběžné buildy mažou `.next` pod rsyncem.** `deploy-web2.9.sh` spadl na
   `file has vanished (code 24)` a **nenasadil nic** (build se udělal, ale artefakt se
   nezkopíroval). Dvakrát za sebou.
   **Řešení:** build → **zkopírovat hotový artefakt mimo `.next`** (`cp -a` + `cp -al
   node_modules` + `rsync public/ .next/static/`) → `deploy-next-artifact.sh <artefakt>`, který
   už nic nečte z `.next`. Tím závod mizí.
   `deploy-next-artifact.sh` navíc **vyžaduje `node_modules/next`** v artefaktu — v monorepu je
   hoisted v `.next/standalone/node_modules`, takže se musí do artefaktu dohardlinkovat.
2. **Stale `.next/lock`** (0 B) po přerušeném buildu blokuje další build
   („Another next build process is already running"), i když nic neběží → `rm -f .next/lock`.
3. **`http2 on;`** v nginx konfiguraci je až od 1.25; EDGE má **1.24** → legacy
   `listen 443 ssl http2;` (jinak `nginx -t` spadne a reload neproběhne).

---

## 4. Co zbývá (F2 zbytek)

`hero` (44), `goldenEgg` (56), `ekamPage` (81), `features` (31), `docsRail` (17), `chv4` (15),
`onboard` (12), `whitepapers` (9) = **265 klíčů × 3 jazyky** ≈ 2–3 dávky.

Pak F3 OASIS (202 karet + 202 profilů + 714 questů), F4 Nirvana UI, F5 Archiv (189 kapitol),
F6 hreflang/sitemap.

---

## 5. Commity

```
52c5ebe98 feat(i18n): 5 jazyků v celém webu (cs/en/es/pt/fr) + přepínač v navigaci
00596703b     feat(i18n): první dávka překladů es/pt/fr (navigace, patička, 404, docs, chyby)
```

---

## 6. Navazující dávky (stejný den)

### F2 — dávka 2: zbytek `translations.ts` (193 klíčů × 3)

`hero` (42), `goldenEgg` (41), `ekamPage` (72), `features` (19), `chv4` (13), `docsRail` (9),
`onboard` (6), `whitepapers` (5). Překlady vloženy jako JSON spread do `translations-langs.ts`
(escaping bezpečně přes `JSON.stringify`). **Tím je `translations.ts` pokrytý celý: 269 klíčů ×
3 jazyky.** Ověřeno živě: homepage tagline i `/ekam` h1 v es/pt/fr přeložené, 11 stránek 200.

### F3 — dávka 1: karty avatarů (1 212 polí)

`subtitle` + `role` pro **všech 202 avatarů** v es/pt/fr (`scripts/oasis-avatar-copy/i18n-cards/`).
Generátor propouští jazyky, `LocalizedText` má volitelné `es/pt/fr`, stránka používá
`tx(field, lang)` s fallbackem `lang → en → cs`.

Ověřeno živě (deploy `20261106T111123Z`): 202 karet ve všech jazycích, subtitle karty i modalu
přeložený — Krishna „Integración Cósmica" / „Integração Cósmica" / „Intégration cosmique",
203 „Trinidad de la Madre Divina" / „Trindade da Mãe Divina" / „Trinité de la Mère divine".

### Co zůstává

- **F2b — page-local copy**: každá stránka má vlastní `{cs,en}` objekt (tree-of-life 127 klíčů,
  l6-issobella 76, avataři 63, maria-del-camino 58, kralovstvi-srdce 45, nabukano 44…). Není to
  součást `translations.ts`; chce samostatnou dávku.
- **F3 zbytek**: `location`, `questLine`, `teaching`, `ability`, `quote`, `essence` (202 × 6 × 3),
  714 questů, 202 profilů.
- F4 Nirvana UI, F5 Archiv, F6 hreflang/sitemap.

---

## 7. F2b — dávka 1: stránka avatarů (page-local copy)

Page-local texty nežijí v `translations.ts`, ale v objektech `{cs, en}` přímo ve stránkách
(67 souborů, ~1 522 klíčů). Místo přepisu každého objektu na 5 jazyků se překládá **anglický
řetězec**:

- `src/lib/i18n-tx.ts` — `tx5(entry, lang)` (entry → slovník → en → cs) a `t5(en, lang)`;
- `src/lib/ui-strings/avatars.{es,pt,fr}.json` — 47 řetězců stránky avatarů;
- stránka: 50 indexací `[cs ? 'cs' : 'en']` → `tx5(...)`, komponenty dostávají `lang`.

**Ověřeno živě** (deploy `20261106T113931Z`): placeholder hledání a filtry v 5 jazycích
(„Todos los rayos" / „Todos os raios" / „Tous les rayons"), 202 karet, 0 pageerror.

**Chyba z codemodu (chycena `tsc`):** inline náhrada rozbila načítání profilu
(`const lang = cs ? 'cs' : t5('en', lang)` — sebe-reference). Opraveno na
`profileLang = lang === 'cs' ? 'cs' : 'en'` (profily existují jen cs/en).

**Zbývá F2b:** 66 souborů / ~1 450 klíčů (tree-of-life 150, NewsFeed 115, l6-issobella 76,
maria-del-camino 58, kralovstvi-srdce 45, nabukano 44, ArchiveLock 42, …).
