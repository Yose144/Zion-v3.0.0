# REPORT 2026-11-05 (session 2) — newearth most, flotila jako pocta, proto 32, 5 jazyků

> **Zadání 👤:** „1 - homage · 2 - doména jen aby přemosťovala na zionterranova.com · 3 nevíme ·
> 4 udelej pak report do root · 5 jasný čeština čistá, ale překlady pak do jiných jazyků taky,
> celý ekosystém by měl podporovat nativně přepínání 5 jazyků (cz, en, sp, ptg, fr) ·
> 6 zatím neřešíme · 7 a 8 spíš vždy sepsat report a pushnout".

---

## 1. newearth.cz — most na zionterranova.com (hotovo)

Původní vhost servíroval legacy archiv `/V2/` z `/var/www/newearth` a jen root přesměrovával.
Nově **celá doména 301 na `https://zionterranova.com<path>`** (path-preserving), ACME challenge
zůstává bez redirectu kvůli renewalu. Cert i TLS zůstaly.

| kontrola | výsledek |
|---|---|
| `https://newearth.cz/` | **301** → `https://zionterranova.com/` |
| `https://newearth.cz/V2/` | **301** → `https://zionterranova.com/V2/` (na cíli **200**, archiv tam existuje) |
| `https://www.newearth.cz/nekde?x=1` | **301** → `https://zionterranova.com/nekde?x=1` |
| `http://newearth.cz/` | 301 → HTTPS → 301 na cíl |

Záloha configu: `/etc/nginx/sites-available/newearth.cz.conf.bak-bridge-20261105T170307`.
⚠️ Past: `http2 on;` je až nginx ≥ 1.25 — EDGE má **1.24**, takže se používá legacy
`listen 443 ssl http2;` (jinak `nginx -t` spadne a reload neproběhne).

---

## 2. Flotila — zůstává jako **pocta** (hotovo)

Rozhodnutí 👤: flotila je **homage** (Star Wars tvary + cizí kit). Do HUD `/fleet` přidána
drobná poznámka (CS+EN, `.fleet-homage-note`): flotila je fanouškovská pocta, **ne** oficiální
produkt ani spojení s držiteli práv; modely jsou vlastní render z podkladů marketplace.
Ověřeno v nasazeném CSS chunku (`fleet-homage`).

---

## 3. Nirvana — protokol 30 → 32 (hotovo)

Net byl na 31, kód na 32 → appka by hlásila `proto_mismatch`. Podle pravidla „nejdřív net, pak
appka":

| krok | výsledek |
|---|---|
| `deploy-nirvana-net.sh` | **proto 32**, build `20261105T161653Z` |
| appka z **čistého worktree na HEAD** (`--artifact-dir`) | 47 rout, `/fleet/page`, smoke 6/6 |
| `/net/health` vs `HEAD` | **32 = 32** |

Artefakt se stavěl z worktree, protože v pracovním stromu byla rozdělaná práce jiné session.

---

## 4. 5 jazyků — fáze 1 hotová a nasazená

`Lang` je nově **5 kódů** (`cs/en/es/pt/fr`) z jednoho zdroje `LANGS`:

- `LanguageContext`: `LANGS` (kód, název, zkratka, vlajka), `isLang()` validace, `langMeta()`;
  `<html lang>` nese skutečný kód; `setLang` ignoruje neznámý kód.
- **Přepínač**: `LangSwitcher` v navigaci (desktop i mobil) — `<details>` se 5 jazyky, funguje
  klávesnicí i dotykem, aktivní jazyk zvýrazněný (`aria-current`), bez JS stavu.
- **Fallback**: `tr()` / `tx()` → `entry[lang] ?? entry.en ?? entry.cs`. `es/pt/fr` tedy čtou
  angličtinu — záměrně: čitelná angličtina místo prázdných bloků.
- Místa indexující dvoujazyčné slovníky mají lokální alias `L = lang === 'cs' ? 'cs' : 'en'`
  (whitepapers, BackgroundToggle, NavAuthButton) nebo prop typu `Lang` s fallbackem
  (HiranMiniChat, HiranyagarbhaChat, MarketplacePlaceholder).

**Ověřeno na produkci (deploy `20261105T162410Z`):**

| jazyk | `html-lang` | karet | text |
|---|---|---|---|
| cs | `cs` | 202 | „Avatáři ZION Oasis" / „Posvátné postavy OASIS…" |
| en | `en` | 202 | „ZION Oasis Avatars" / „The sacred figures…" |
| es | `es` | 202 | EN fallback |
| pt | `pt` | 202 | EN fallback |
| fr | `fr` | 202 | EN fallback |

Přepínač: **5 voleb**, kliknutí na „Français" → `html-lang=fr`, `localStorage=fr`, **0 pageerror**.

Plán dalších fází (obsah): `docs/plans/I18N-5-LANGUAGES.md` — F2 web UI (395 klíčů × 3),
F3 OASIS avataři (202 karet + 202 profilů + 714 questů), F4 Nirvana UI, F5 Archiv (189 kapitol),
F6 hreflang/sitemap.

---

## 5. Commity a stav

```
72be8f505 feat(fleet): poznámka o poctě (IP) v HUD flotily
52c5ebe98 feat(i18n): 5 jazyků v celém webu (cs/en/es/pt/fr) + přepínač v navigaci
```

Pushnuto na `main` (origin v synchronu). Web deploy `20261105T162410Z`, nirvana app
`20261105T161653Z` (net stejný build), `tsc --noEmit` v obou appkách **0 chyb**.

**Co zůstává na 👤:** payout backlog („nevím" — necháno), G8 („zatím neřešíme"), a jazykové
obsahy es/pt/fr (fáze F2–F5, můžu začít, až řekneš kterou vrstvou).
