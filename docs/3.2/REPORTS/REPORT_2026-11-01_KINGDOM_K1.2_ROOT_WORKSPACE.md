# K1.2 — root workspace (jeden lockfile pro 6 webů)

> **Datum:** 2026-11-01 · **Větev:** `k12-root-workspace` (nemergnuto) · **Stav:** buildy zelené, deploy čeká na rozhodnutí 👤
> **Vztah:** položka K1.2 v [`Kingdom/PLAN.md`](../../../Kingdom/PLAN.md) §8. K1.3 (jeden Turbopack root + sjednocený standalone layout) je částečně předjednaná, protože K1.2 ji vynutila.

## 1. Co je hotové

| Věc | Stav |
|---|---|
| `/package.json` s `workspaces` (6 webů + `shared` + `zion-wallet-sdk`) | ✅ |
| Jeden `package-lock.json` v rootu (1,2 MB, 2 031 balíčků) | ✅ `npm ci --dry-run` projde |
| 8 zrušených lockfilů (6 webů + shared + SDK) | ✅ |
| Zrušený osiřelý `apps/package.json` + `apps/package-lock.json` | ✅ (byl to stub s prisma; nutil Next inferovat workspace root `apps/`) |
| `postinstall` = `prisma generate` pro MarketPlace | ✅ (npm 11 blokuje install skripty, bez toho build marketu neprojde) |
| **6/6 buildů zelených** z jednoho `node_modules` | ✅ pool-ui, IntroPage, OasisWeb, nirvana, MarketPlace, website-v2.9 |

## 2. Co migrace odhalila (a co se nesmí přehlédnout)

**Jeden lockfile není „jen jiné místo pro lockfile" — je to nové rozřešení všech závislostí.** Čerstvý install posunul **48 balíčků** napříč appkami (vše v rámci deklarovaných `^` rozsahů, takže „legálně"), včetně:

| App | Posun | Proč to bolí |
|---|---|---|
| MarketPlace | `stripe` 22.4.0 → **22.6.2** | money path: typy API verze se rozešly (`'2026-07-29.dahlia'` vs `'2026-08-26.dahlia'`) a **build spadl** |
| OasisWeb | `@babylonjs/*` 9.19 → 9.33, `@react-three/fiber` 9.6.1 → 9.8.2 | render vrstva, jiné chování scén |
| website-v2.9 | `@lifi/*` 4.0/4.1 → 4.12/4.10 | DeFi widgety na živém povrchu |
| nirvana / OasisWeb / web | `@noble/ed25519` 2.3 → **3.2** (major), `@noble/hashes` 1.8 → 2.4 (major) | podpisy peněženek |

**Rozhodnutí:** migrace **nemění chování**. Všech 42 posunů (kromě `three`) je zamraženo na přesnou původní verzi v `package.json` dané appky. Upgrade je samostatné, vědomé rozhodnutí — ne副作用 migrace.

**Výjimka — `three` je záměrně sjednocený:** repo mělo `three` 0.169 (OasisWeb, website, MarketPlace) a 0.186 (nirvana, Kingdom). Ve workspace to nejde udržet: soubory v `apps/shared/scenes/**` leží mimo oba app stromy, takže je TypeScript kompiluje proti **jedné** sadě typů — a dva `@types/three` v jednom programu = `FogExp2` z 0.186 není `FogExp2` z 0.169 (přesně to shodilo build OasisWeb). Sjednoceno na **`three@0.186.1` + `@types/three@0.186.0`** přes `overrides` v rootu. Ověřeno: OasisWeb se po bumpu vykresluje (`canvas=1` na všech routách), website-v2.9 i MarketPlace se buildí.

## 3. Co si K1.2 vynutila (K1.3 napřed)

S root lockem Next dopočítá workspace root = repo, takže **`turbopack.root: apps/` přestal platit** (nirvana i MarketPlace padaly na „Could not find the Next.js package"). Změněno na `../..` (repo).

Tím se posunul i **standalone layout**:

| App | Před | Po |
|---|---|---|
| nirvana | `.next/standalone/nirvana/server.js` | `.next/standalone/apps/nirvana/server.js` |
| MarketPlace | `.next/standalone/MarketPlace/` (flatten) | `.next/standalone/apps/MarketPlace/` → flatten |
| website-v2.9 | `.next/standalone/website-v2.9/` | beze změny (skript už obě varianty uměl) |

Deploy skripty: `deploy-nirvana.sh` hledá `server.js` v hloubce (přežije další změnu layoutu), `flatten-standalone.mjs` je zobecněný (najde `server.js` v libovolné hloubce), `deploy-web2.9.sh` beze změny.

## 4. Co zbývá (rozhodnutí 👤 + práce)

1. **Merge větve `k12-root-workspace` do `main`** + `npm ci` v rootu na všech strojích, které z repa buildí (jinak jim zůstanou staré per-app `node_modules`).
2. **Ověřit deploy jednoho povrchu** (doporučuji `pool-ui` — nejmenší) a pak zbytek; deploy skripty jsou upravené, ale **nebyly spuštěné**.
3. **K1.3 dojet:** sjednotit standalone layout (jeden tvar pro všechny) a aktualizovat zbylé deploy skripty (KPI: 9 → 3 skripty).
4. **K1.4:** `@zion/session` jako workspace závislost (dnes tarball u website-v2.9) — tím zmizí i poslední commitnutý `.tgz` (KPI 1 → 0). Vyžaduje build SDK v pipeline (`npm run build -w zion-wallet-sdk` před buildem webu).

## 4b. K1.4 (předběžně) — poslední `.tgz` je pryč

`website-v2.9` závisel na `zion-wallet-sdk: file:zion-wallet-sdk-2.0.0.tgz` — commitnutý binární balík. Ve workspace je to zbytečné: závislost je `"*"` (symlink na `apps/zion-wallet-sdk`) a `prebuild` si SDK nejdřív zbuildí (`npm run build -w zion-wallet-sdk` → `tsc` → `dist/`). Ověřeno: `next build` projde, 343 stránek.

Smazány i dva osiřelé artefakty: `apps/website-v2.9/zion-wallet-sdk-2.0.0.tgz` (nahrazen linkem) a `apps/zion-wallet-sdk/zion-wallet-sdk-1.0.0.tgz` (stale 1.0.0 vedle zdroje 2.0.0, nic na něj neodkazovalo). **KPI „commitnutých `.tgz` 1 → 0" je splněno.**

**Turbopack na `website-v2.9` ale nejde:** s workspace linkem zmizel důvod „Turbopack neumí `.tgz`", takže jsem zkusil `next build` bez `--webpack`. Build se **zasekl na 30 minut** v „Creating an optimized production build" bez jediného řádku výstupu (webpack zvládne totéž za 40–50 s). Proto `--webpack` **zůstává** — ale už ne kvůli tarballu, nýbrž proto, že Turbopack tuhle appku neutáhne. Profilace = samostatný úkol (K1.3 poznámka).

## 5. Jak to zreprodukovat

```bash
git worktree add /tmp/k12 -b k12-root-workspace
cd /tmp/k12
npm ci                      # 1 lockfile, ~5 min
npm run build:all           # 6 buildů zelených
```

**Pozor na npm 11:** `install` skripty jsou defaultně blokované (`allow-scripts`). Prisma client proto generuje až root `postinstall`; `esbuild`/`puppeteer` postinstall zůstávají nedostupné a nic z buildů je nepotřebovalo.
