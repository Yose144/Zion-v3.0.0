# Neděle — plán pro pokračování z lokálního backup PC

> **Napsáno:** 2026-11-01 · **HEAD:** `b2e32d92b` · **Stav:** vše commitnuté a pushnuté (`origin/main` = HEAD, 0/0)
> **Kontext:** přesouváš se na lokální backup PC. Tenhle soubor je jediné, co potřebuješ — co běží, co si ověřit a co dělat dál, v pořadí.

---

## 0. Než vypneš tento stroj

Nic nedlužíš. Repo je v sync, žádný necommitnutý WIP z mojí práce. Zkontroluj jen:

```bash
cd ~/Projects/2.9.6
git status --short | head
git log --oneline -1        # musí být b2e32d92b nebo novější
git push origin main        # pro jistotu; mělo by říct "Everything up-to-date"
```

Pokud `git status` ukáže změny v `Hiran/`, `infra/tools/vast/`, `heros/Hiran/` nebo `VAST-HIRAN-TRAINING-PLAN.md` — **to není moje práce**, je to WIP paralelní session. Necommituj to, nech to být.

---

## 1. Na backup PC: rozjezd

```bash
git clone https://github.com/Yose144/Zion-v3.0.0.git
cd Zion-v3.0.0
git log --oneline -1        # musí sedět s HEAD výše
```

**Co potřebuješ mít:**
- Node **20.9+** (Kingdom buildí na 20.19.6; EDGE2 má 22.23.3)
- SSH klíč `~/.ssh/zion-edge-post-wipe-2026-07-29` + alias `zion-edge2` v `~/.ssh/config`
- `gh` CLI (pro reporty) — volitelné

**Ověření, že svět je v pořádku (nemusíš nic dělat, jen zkontrolovat):**

```bash
for u in https://kingdom.zionterranova.com/ https://pool.zionterranova.com/ https://auth.zionterranova.com/health; do
  printf "%-46s %s\n" "$u" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 12 $u)"
done
# očekáváno: 200 200 200

ssh zion-edge2 'systemctl is-active zion-kingdom zion-zis zion-website zion-marketplace'
# očekáváno: active active active active
```

Stav v době psaní: **vše 200 / vše active**.

---

## 2. Co je hotové (a co to znamená)

### Kingdom — nový klient, live
`https://kingdom.zionterranova.com` · `zion-kingdom.service` na EDGE2 (`127.0.0.1:3020`) · cert do 2027-01-30

- **Brána** — skutečný stargate (28 vrstev, 52 glyfů, 9+9 chevronů) + rasta design + živá čísla z uzlu
- **Místnost** — orbit svět (Nová Země, prstenec Issobelly, Brána) + 8 markerů z manifestů
- **9 portálů** — Řetěz, Kovárna, Tržiště, Přístav, Snem, Knihovna, Věž, Issobella, Účet. Všechny živé, žádný placeholder.
- **13 světů** — `/world/<id>` (Genesis Garden, Kailash, …)
- **1 zápis** — Hiran chat (Věž) přes serverový proxy, rate limit 20/min
- **1 handoff** — Tržiště → e-shop (deep-link na kategorii)
- Odezva **0,4 s** (vs 2,8 s starý web), paměť 62 MB

### ZIS — jeden klient
- **S1 ✅** `@zion/session` v `Kingdom/packages/session`, Účet v Kingdomu je živý (fráze → podpis v prohlížeči → cookie na `.zionterranova.com`)
- **S2 ✅** kontraktní test `Kingdom/scripts/check-zis-contract.mjs` — 14/14. Našel reálnou chybu (500 místo 401 na poškozený podpis), **opraveno a nasazeno**
- **S3 ⏸️** migrace konzumentů **blokována architekturou** — viz §5

### K1.1 — první appka na Next 16
- **pool-ui** ✅ Next 14.2.30 → **16.4.3**, React 18 → **19.2.0**, nasazeno, 5 stránek 200
- Zbytek (IntroPage, MarketPlace, nirvana, OasisWeb, website-v2.9) **ještě na starém**

---

## 3. Přesný plán — v tomto pořadí

### Krok 1 · IntroPage na Next 16 (≈30 min, nízké riziko)

```bash
cd apps/IntroPage
# 1. bump v package.json: next ^16.4.3, react 19.2.0, react-dom 19.2.0, @types/react ^19
# 2. npm install
# 3. npx tsc --noEmit
# 4. npm run build
# 5. bash deploy/deploy-intro.sh
```

**Co bude bolet** (stejné jako u pool-ui): Next 16 s `output: export` vyžaduje `export const dynamic = 'force-static'` u `robots.ts` / `sitemap.ts`.

**Ověření:** `https://zionterranova.com/` 200 + obsah (h1 „ZION"), `/amenti/`, `/blog/` 200.

> ⚠️ IntroPage je **apex** — pokud build projde, ale něco se rozbije, rollback je `deploy/deploy-intro.sh` z předchozího commitu. Apex je nejviditelnější povrch, takže po deployi zkontroluj v prohlížeči, ne jen `curl`.

### Krok 2 · MarketPlace na Next 16 (≈2–4 h, **vysoké riziko — security gate 1b**)

Tohle je ta důležitá: `next` 14.2.5 má **critical CVE** (Image Optimization RCE, Server Actions SSRF). Mitigace jsou nasazené od 28. 10. (`unoptimized: true`, 0× Server Actions, middleware = jen pre-filter), ale major bump se musí udělat před veřejným launchem.

**Co bude bolet:**
- API routes + Prisma (async `cookies()` / `headers()`, `params` je `Promise`)
- Stripe / Coinbase webhooky — po buildu **otestuj `/api/health`** a jednu testovací objednávku
- `lib/csrf.ts` — ověřit, že po upgradu pořád sedí
- Deploy: `rsync` **nikdy** `.next/standalone/` do app rootu (incident 2026-10-30 smazal `src/` a přepsal produkční `.env`)

**Ověření:** `https://market.zionterranova.com/` 200, `/shop` 200, admin login, jedna testovací objedávka `TEST-K11-*` → cancelled.

### Krok 3 · Srovnat zbytek na 16.4.x (≈1 h)

`nirvana` (16.2.9), `OasisWeb` (16.2.9), `website-v2.9` (16.4.3). Formálně už na 16, ale sjednotit na `16.4.3` kvůli jednomu security patch levelu.

⚠️ **website-v2.9 buildí jen s `--webpack`** (Turbopack neumí resolve `fs`/`net` aliasy ze `zion-wallet-sdk`).

### Krok 4 · K1.2 root workspace (≈půl dne) — **tady se odblokuje S3**

Až je všech 6 webů na Next 16 + React 19:

```bash
# root /package.json
{ "private": true, "workspaces": ["apps/*", "packages/*"] }

# přesunout Kingdom/packages/* → /packages/*
git mv Kingdom/packages packages
```

Pak **jeden lockfile** a `@zion/session` jako workspace závislost (žádný tarball, žádná registry).

### Krok 5 · K1.3 jeden Turbopack root (≈půl dne)

Každá appka má `turbopack: { root: apps/ }`. Sdílené balíčky leží výš, takže root musí být **repo**.

⚠️ **Pozor, tohle mě dnes zastavilo:** změna rootu na repo **mění layout standalone výstupu** z `.next/standalone/<app>/` na `.next/standalone/apps/<app>/` a začne stopovat `canon/`. Musíš proto **upravit všech 9 deploy skriptů** (`apps/*/deploy/deploy-*.sh`) na nové cesty — jinak deploy spadne na `standalone build missing …/server.js`.

### Krok 6 · S3 — migrace konzumentů (≈2 h, po K1.2)

Pořadí: **nirvana** (73 řádků) → **MarketPlace** (dvě rozcházející se kopie, 344 řádků) → **pool-ui** (182) → **website-v2.9** (619).

Recept je v `docs/3.2/REPORTS/REPORT_2026-11-01_KINGDOM_F0-F2_OASIS.md` § „ZIS S3 — příprava migrace". Klíčové: `baseUrl: ''` = relativní cesta = jde přes stávající same-origin proxy konzumenta, **žádný CORS**.

---

## 4. Kde co je (ať nehledáš)

| Co | Kde |
|---|---|
| Kingdom dokumentace | `Kingdom/README.md`, `ARCHITECTURE.md`, `PLAN.md`, `AGENTS.md` |
| Kingdom plán K1 | `Kingdom/PLAN.md` §8 |
| Report celé práce | `docs/3.2/REPORTS/REPORT_2026-11-01_KINGDOM_F0-F2_OASIS.md` |
| Deploy Kingdomu | `bash Kingdom/infra/deploy/deploy-kingdom.sh` |
| ZIS kontraktní test | `node Kingdom/scripts/check-zis-contract.mjs` |
| ZIS plán | `docs/3.2/ZIS_INTEGRATION_PLAN.md` |
| Next migrace | `docs/3.2/NEXT14_TO_16_UNIFICATION_PLAN.md` |
| DNS mapa + fáze | `infra/dns/zionterranova.com.zone.md` |

---

## 5. Pasti, které už známe (nešlapat znovu)

1. **`file:` závislost na Kingdom nefunguje** — npm udělá symlink mimo Turbopack `root` → `Can't resolve`. Řešení = K1.2 workspace, ne tarball.
2. **`npm run build` za běhu serveru smaže stageovanou statiku** → textura 500, R3F `Suspense` se nikdy neresolvuje a **scéna je prázdná bez chyby v logu**. Po každém buildu restartovat.
3. **`next start` nefunguje s `output: standalone`** — použij `npm start` (stageuje statiku vedle `server.js`).
4. **Deploy skript vhost přepisuje** — `Kingdom/infra/nginx/kingdom.zionterranova.com.conf` musí obsahovat i certbotem spravované `listen 443` bloky, jinak redeploy shodí HTTPS. Po renew znovu zkopírovat ze serveru.
5. **`deploy-zis.sh` měl dvě chyby** (opraveno): `rsync --delete` u víc zdrojů → kód 23 → `set -e` zastaví deploy **před restartem**; a chybělo `--chown=zion:zion`.
6. **Fail2ban** — rychlé SSH na EDGE (port 2222) = ban. Batchovat, nebo použít `zion-v6` (IPv6 nebyl banován).
7. **`selectors` v cizím CSS neprefixuj naslepo** — `:root` → `.k-stargate :root` nematchuje nikdy, proměnná chybí, `calc()` je neplatné a prvek se posune o půl výšky. Po každém portu **měř `getBoundingClientRect()`**, ne jen koukej.

---

## 6. Co čeká na tebe (👤)

| # | Věc | Stav |
|---|---|---|
| 1 | **`g8_run.json`** — noční restart `zion-zis` (2,4 s) mohl ukousnout vzorek. Zkontroluj, jestli uptime nespadl; pokud ano, je to planned restart, ne anomálie | ⬜ |
| 2 | **Apex `zionterranova.com` → Kingdom?** Dnes tam je IntroPage s Amenti/blogem/seeds/Vzestupem. Kingdom tyhle sekce **nemá** — přepnutím bych je zabil. Rozhodni: (a) apex zůstane Intrem, Kingdom na `kingdom.`; (b) apex → Brána a IntroPage na `/intro` | ⬜ |
| 3 | **F5 (zúžení website)** — nedělat, dokud Kingdom nemá plnohodnotný explorer (vyhledávání hash/adresa/blok, richlist). `/pool` a `/market` v Kingdomu nejsou náhrada, jen okno | ⬜ |
| 4 | **QTC treasury** (`treasury_free=0`, stalled roste) — peníze | ⬜ |
| 5 | **Market wallet / SMTP / Resend** | ⬜ |

---

## 7. Rychlý checklist po příchodu k PC

```bash
# 1. repo v sync?
git log --oneline -1 && git rev-list --left-right --count origin/main...HEAD   # 0  0

# 2. svět běží?
curl -s -o /dev/null -w "kingdom %{http_code}\n" https://kingdom.zionterranova.com/
curl -s -o /dev/null -w "pool    %{http_code}\n" https://pool.zionterranova.com/
curl -s -o /dev/null -w "auth    %{http_code}\n" https://auth.zionterranova.com/health

# 3. ZIS kontrakt (musí být 14/14)
node Kingdom/scripts/check-zis-contract.mjs

# 4. můžu stavět?
cd Kingdom && npm install && npm run verify
```

Když tohle projde, jsi přesně tam, kde jsme skončili — a první věc v §3 (IntroPage) může začít.

---

## 8. Jedna věta na závěr

Za tenhle běh vzniklo: **live klient na vlastní doméně s 9 portály a 13 světy**, **jeden ZIS klient místo šesti**, **kontraktní test, který našel reálnou chybu**, a **první appka na Next 16**. To, co zůstalo, není „nedodělek" — je to **K1.1–K1.4 a S3**, tedy sloučení, které má smysl dělat až po upgradu všech webů. Pořadí v §3 je proto závazné: K1.1 → K1.2 → K1.3 → S3.
