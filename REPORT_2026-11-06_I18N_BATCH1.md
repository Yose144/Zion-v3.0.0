# REPORT 2026-11-06 — 5 jazyků: dávka 1 (navigace, patička, 404, docs, chyby)

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
