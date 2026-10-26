# Komplexní audit ekosystému + v3.2 → BETA gate

> Datum: 2026-10-25 · Stav: audit proveden na živé produkci + repu
> Rozsah: infra, repo, weby, chain, deploy — ověřeno proti dokumentům i runtime

## 1. Audit — výsledky po doménách

### 1.1 Git / repo — ✅ PASS
- `main` = `origin/main`, working tree čistý (jen untracked `L4data/` = nový asset)
- 14 commitů unifikace pushed (`f061b00e4`→`4bec80f76`)
- Rezidua vyčištěna ověřeně: `APP&WEB/` 8.8G, `docs/WP-Mainet/` 50M, `V3/` stale kopie; unikáty zachovány (miner binárky 79M → `apps/desktop-agent/resources/`, `.env*`, `api-contabo.md`)
- `public/` → `archive/PUBLIC/` (case-FS korekce; index dostagován — rename kompletní)
- Struktura: `apps/`, `canon/`, `infra/`, `archive/`, `docs/`, `V31/` (excluded — live chain workspace), server-runtime roots (`scripts/`, `ZION_OS/`, `BTCunlock/`, `Hiran/`) = kanonické, rozhodnuto zůstat

### 1.2 Live povrchy — ✅ PASS (12/12 = 200)
`zionterranova.com`, `app.` (+`/market` `/world` `/network` `/monitoring` `/ai-native`), `pool.`, `market.`, `oasis.`, `freeworld.`, `auth./health`, `rpc.`
- `dashboard.` = 401 (ops allowlist — správně)

### 1.3 IA / F3 — ✅ PASS
- 7 kanonických sekcí live; redirecty fáze-1 OK (`/multichain`→`/market`, `/dex`→`/market#dex`, `/wiki`→`/docs`…)
- Nav: `/network` += monitoring/g8/miner-stats; layers += ai-native — nasazeno
- Žádné další redirecty (obsahové stránky = precedent `/l*`)

### 1.4 Duplicity / F4 — ✅ PASS
- `/market` → `market.zionterranova.com` canonical card live
- pool portal + in-app `/pool` = oba záměrně; `/l4-oasis` landing→portál; `/ekam` × `/terranova/ekam` odlišný obsah

### 1.5 Deploy / F5 — ✅ PASS
- Všechny deploy skripty → `zion-edge2` (před: Edge fallback!); `deploy-marketplace.sh` nový; `infra/RUNBOOK.md` + `infra/deploy/README.md`; 2× plný deploy live (201 stránek, smoke all-200)
- CI pipeline: vynecháno (rozhodnutí)

### 1.6 Servery / F6 — ✅ PASS
- EDGE (`62.171.141.136`) = chain/mining/ops: pool, follower nody, g8, tunely, backups — cleanup done (stale web dirs→archive, worktrees, nginx bak ze sites-enabled, catch-all utažen: `_`→444 + IP explicitní)
- EDGE2 (`207.180.217.100`) = web/app ingress: nginx, všechny weby, ZIS, L1, OASIS/FW, postgres — cleanup done (`.next.bak` 11→2, `public_html`+`newearth`→archive, CORS fix)
- Archivy `/opt/zion/archive/cleanup-20261024/` (381M + 601M)
- Fix pod cestou: `zion-edge-backup` perms `g8_run.json`, VAST-RIGS status sync na EDGE2 (uživatel)
- `backups/` 36G = legit rolling retention; 18 tunel legs = všichni konzumenti aktivní

### 1.7 V3.2 / chain — ✅ PASS
- `V31/Cargo.toml` = `3.2.0`, `website-v2.9` = `3.2.0` (`zion-web-v3.2.0`)
- Pool live (stratum+TLS 8444/8445, `/public/v1` 200), L1 RPC failover (9445/9446/9447), G8 run aktivní
- Inference: ai-native→hiran-core (PC Vega64) + EDGE2 CPU fallback; Maestro v2.4 live
- ZIS/SSO na všech portálech (`.zionterranova.com` cookie)

### 1.8 Zbylé nálezy (neblokující)
- Dead links 383->370: ~200 interních refs (muted = správně) + ~170 content gaps → editorial pass (vynecháno záměrně)
- `L4data/img/OasisMaitreya.png` untracked — čeká umístění
- i18n ×3 impl + Footer unifikace = nice-to-have
- Root `Cargo.toml` = `3.2.0-beta.1` (meta-package stub) — alpha marker již odstraněn; 2026-10-26 doplněno: lifecycle labely napříč weby/portály/klientskými povrchy sjednoceny na **Mainnet Beta** (lokálně, nasazení zvlášť)

## 2. Beta gate — checklist

| Kriterium | Stav |
|---|---|
| Ekosystém sjednocený F0–F6 | ✅ |
| Live povrchy 200 / canonical IA | ✅ |
| Deploy kanonizace + runbook | ✅ |
| Chain/pool/ZIS/inference funkční | ✅ |
| Repo čisté, archivy místo deletů | ✅ |
| CI | vynecháno (rozhodnutí) |
| Dead links | graceful (muted), editorial pass později |

## 3. Alpha → Beta změna

**Scope:** root `Cargo.toml` `version = "3.1.0-alpha.2"` → `version = "3.2.0-beta.1"` (zarovnání na v3.2 ekosystém; `zion-root` = meta-package stub, žádné runtime závislosti na verzi).

**Scope note (2026-10-26):** následné sjednocení lifecycle labelů (Mainnet Alpha → Mainnet Beta) je čistě stage/copy alignment — žádná změna konsenzu, genesis, emise, ekonomiky, sítě, bezpečnosti ani auth; protokol handshake `zion-v3-node/3.1.0-alpha` zůstává; otevřené položky (P0-3 rotace credentials, PRL dry-run, QTC deficit, G8/G9/DR) beze změny.

**Ověřit po změně:** `cargo metadata` root projde (meta-package, žádné membry na verzi nezávislé), `git grep alpha` = 0 výskytů v manifests.

**Riziko:** žádné — meta-package, neprodukuje artefakty; V31 workspace má vlastní `3.2.0` (beze změny).

## 4. Post-beta backlog (vědomé, ne blokery)

- Editorial dead-link pass (383 → per-file)
- `L4data/` PNG → `canon/l4/`
- i18n/Footer unifikace
- Edge web vhosty: plné vypnutí fallbacku (až F6+ stabilizace)
