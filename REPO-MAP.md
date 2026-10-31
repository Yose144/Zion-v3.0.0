# REPO-MAP — Mapa workspace `~/2.9.6-main`

> **Kompletní přehled, co je kde.** Aktualizováno **2026-10-31** — po F2 git-reorganizaci (batche 1–8, viz [`docs/ECOSYSTEM-REBUILD-PLAN.md`](docs/ECOSYSTEM-REBUILD-PLAN.md)) a po repo-hygiene průchodu B9 (viz níže).
>
> Zásada: **runtime a ops obsah zůstává v repu** (deferral, §2). Co v repu záměrně **nezůstává**: mrtvé meta-workspace manifesty, stub adresáře a build artefakty, které nic nekonzumuje — ty se mažou, ne archivují (viz B9 níže).
>
> **B9 hygiene pass (2026-10-31, commit `d25e6714f`):** smazán root meta-workspace (`Cargo.toml` + `Cargo.lock` + `src/lib.rs` stub — V31 je jediný workspace), prázdné stub adresáře `update-server/` a `edge-deploy/` (reálné věci jsou v `infra/edge-deploy/`), `V31/vendor/`, a untracked stale snapshot `apps/website-v2.9/src-only.tar.gz`. `.pre-commit-config.yaml` přecílen na `V31/Cargo.toml`; `.gitignore` rozšířen o model weights (`*.safetensors`, `*.gguf`, `*.pt/pth/onnx`) a `src-only` snapshoty. Navíc smazán osiřelý root `target/` (build output zrušeného `zion_root` crate).

---

## 1. Kanonická osa (tracked, cílová struktura)

| Adresář | Obsah | Files | Poznámka |
|---|---|---:|---|
| `apps/` | Celý web+app ekosystem (12 aplikací) | 5180 | ← bývalé `APP&WEB/`. website-v2.9 (Next 16, app.zionterranova.com), IntroPage (apex static), OasisWeb, MarketPlace, pool-ui, identity (ZIS), desktop-agent, mobile-app, shared, zion-wallet-sdk, public_html |
| `canon/` | Kanonický obsah/korpus | 554 | `l2`–`l6` (DAO ústava, layer docs, artwork, Issobella), `brand/` (LOGO + build), `books/` (WP-Mainet knihy) |
| `docs/` | Dokumentace + reporty | 3007 | `3.2/` aktuální (REPORTS/, ops/), `3.1/`, `3.0.x/`, `marketing/`, `ops/` |
| `infra/` | Infrastruktura + deploy | 111 | `nginx/` (edge-current+edge2 vhosty), `dns/` (zóna+runbook), `edge-deploy/` (48 souborů), `vast/`, `config/`, `mining/`, `tools/` (vastctl) |
| `archive/` | Historické/mrtvý materiál | 4115 | `V3/` (stará V3 kopie), `WarpBeta/`, `config/`, `misc/`, `2.9.9/`, **`PUBLIC/`** (snapshot bývalého veřejného subsetu — tracked `public/` zanikl 2026-10, viz níže) |

> **Počty `Files` = measured** (`git ls-files`, 15 550 tracked souborů celkem, 2026-10-31). Nejsou to velikosti na disku.

> **Public repo sync (8.B7, 2026-10-28):** tracked `public/` subtree zanikl → nový model = curated export `scripts/ops/public-export.sh` + manifest (`PUBLIC/` = untracked clone z `init`). Workflow: [`docs/3.2/PUBLIC-SYNC-WORKFLOW.md`](docs/3.2/PUBLIC-SYNC-WORKFLOW.md).

## 2. Legacy / runtime-coupled (tracked, záměrně NEPŘESUNUTO — F5)

Tyto adresáře zůstávají v rootu, protože **jejich jméno je součást produkčního kontraktu** — servery je volají přes `/opt/zion/<dir>/` přímo (systemd, cron, rsync) nebo whole-root rsync kopíruje lokální jména na remote:

| Adresář | Files | Proč odloženo |
|---|---:|---|
| `V31/` | 1710 | **NEDĚLAT přesun (rozhodnutí 2026-10-22).** Aktivní mainnet workspace — cargo, `.github/workflows`, systemd units, ~tisíce odkazů, untracked `target/` 4.5G |
| `scripts/` | 380 | ~40 skriptů resolvuje root přes `$(dirname $0)/..` — na serverech = `/opt/zion` správně, v `infra/` by bylo špatně. Servery volají `/opt/zion/scripts/` přímo (watchdog/cron/systemd) |
| `ZION_OS/` | 292 | `deploy-edge.sh` rsyncuje `${REPO_ROOT}/` celý — remote by dostal `infra/ZION_OS/` místo `/opt/zion/ZION_OS/` → rozbil by binary paths |
| `archive/V3/` | 1131 | Root `V3/` byl archivován 2026-08-04 — existuje už jen jako `archive/V3/`. `.gitmodules` submodule `.../lib/openzeppelin-contracts` už ukazuje na archive path (živý V31 strom má vlastní kontrakty). Read-only reference, needitovat |
| `Hiran/` | 129 (325M) | AI vrstva — živé refs v `V31/L3/ai-native/src/*.rs`, `V31/cli`, `ZION_OS/dashboard/*.js`, `scripts/openclaw-coding.sh` |
| `BTCunlock/` | 21 (1.2G) | refs v `apps/desktop-agent/renderer.js`, `ZION_OS/dashboard/*` |

## 3. Untracked adresáře (nejsou v gitu — runtime/artefakty)

**Ponechané v repu záměrně** — žádný není git-trackovaný, všechny jsou filesystem artefakty:

| Adresář | Velikost | Co to je | Kdo ho používá |
|---|---:|---|---|
| `backups/` | 16G | chain/system backupy (`backup_YYYY-MM-DD_*.tar.gz`) | `scripts/backup-*.sh` + crontab `pull-edge-backups.sh` |
| `PUBLIC/` | 845M | lokální clone curated exportu (untracked; v repu jen `archive/PUBLIC/` snapshot) | `scripts/ops/public-export.sh` (workflow: [`docs/3.2/PUBLIC-SYNC-WORKFLOW.md`](docs/3.2/PUBLIC-SYNC-WORKFLOW.md)) |
| `logs/` | 466M | runtime logy (`node1.log`, `miner.*.log`, `backup-beacon.log`) | `_lib.sh LOG_DIR`, crontab redirecty, `watchdog.sh` |
| `venv-hiran/` | 36M | python venv pro Hiran tooling | `hiran-*.sh` skripty |
| `BACKUP/` | 112M | edge snapshot (`SHA256SUMS.edge-*`, `edge-2026-10-16/`) | manuální offsite kopie |
| `dashboard/` | 452K | starý standalone ops dashboard (models/services) | předchůdce `ZION_OS/dashboard` — referenční |
| `AuXpow/` | 688K | PoW/AuXpow research (`csrc`) | referenční — archived V3 ho má taky |
| `data/` | 616K | runtime DBs (`warp.db`, `dao.db`, `revenue_journal/`) | V31 services když běží lokálně |

## 4. Runtime vazby na filesystem (PROČ opatrnost)

| Cesta | Kdo ji používá |
|---|---|
| `~/2.9.6-main/scripts/*.sh` | **crontab** — `backup-beacon.sh` (4×/min), `pull-edge-backups.sh` (hodinově) |
| `~/2.9.6-main/logs/` | crontab log redirecty + `scripts/_lib.sh LOG_DIR` |
| `~/2.9.6-main/infra/tools/vast/` | systemd user: `vastctl-daemon` (status.json 60s + push edge), `vastctl-serve` :8088, `vastctl-tunnel*` |
| `~/2.9.6-main/infra/vast/xmrig-vast-cpu.json` | vastctl `--config` |
| `~/2.9.6-main/apps/desktop-agent/` | live **electron** proces + `zion-desktop-agent.service` + SRBMiner spawn |
| `~/2.9.6-main/apps/website-v2.9/` | `deploy-web2.9.sh` build → rsync na EDGE2 |
| `scripts/_lib.sh` | `REPO_ROOT=$_LIB_DIR/..` — všichni `start-*/stop-*` konzumenti |

**Kompletní systemd user units odkazující do repa** (`~/.config/systemd/user/`, 12 z ~40 celkem): `vastctl-{daemon,serve}` (`infra/tools/vast`), `zion-btcunlock` + `zion-btcunlock-ui` :8777 (`BTCunlock/`), `zion-dashboard` :8766 (`ZION_OS/dashboard`), `zion-desktop-agent` (`apps/desktop-agent` electron), `zion-backup-node` (V31), `zion-stack` (V31), `zion-ssh-tunnel` + `zion-hiran-{cuda,llm,proxy,tunnel}` + `zion-qwen-*` + `hiran-core` + `lm-studio` (lokální AI inference), `zion-watchdog`/`zion-miner-watchdog`/`zion-offsite-sync`/`zion-backup{,-beacon}` timery (`scripts/`, `logs/`). **Ověřeno 2026-10-22: žádný unit nemá stale cestu** — všechny ukazují na aktuální adresáře (scripts/ZION_OS/BTCunlock zůstaly = deferral správně). Ops pozn.: `zion-backup.service` je `failed` (pre-existing, /mnt/data cíl).

## 5. Remote layout (serverová strana — neměnit bez F5 koordinace)

| Remote | Slouží |
|---|---|
| `/opt/zion/APP&WEB/{website-v2.9,MarketPlace,identity}` | systemd WorkingDirectory, rsync targety, `.env` — **remote jméno zůstává `APP&WEB`** (lokálně = `apps/`) |
| `/opt/zion/scripts/` | watchdog/cron/systemd na EDGE+EDGE2 |
| `/opt/zion/ZION_OS/` | `zion-agent`, `zionos-dashboard` binary pathy |
| `/opt/zion/edge-deploy/` | **staré jméno** — systemd `zion-edge-watchdog` ExecStart; deployed wrapper sondou funguje na obou layoutech |
| `/opt/zion/V31/` | node/pool binary + `target/` |

## 6. Ukazatele dokumentace

| Dokument | Obsah |
|---|---|
| [`AGENTS.md`](AGENTS.md) | operativní pravidla (topologie, deploy, security, subtree) — ~130KB runbook |
| [`docs/ECOSYSTEM-INVENTORY.md`](docs/ECOSYSTEM-INVENTORY.md) | **měřená fakta** o boxech (služby, porty, /opt/zion, DNS) |
| [`docs/ECOSYSTEM-REBUILD-PLAN.md`](docs/ECOSYSTEM-REBUILD-PLAN.md) | plán fází F1–F6 + batch execution log + F5 deferral mapa |
| [`INFRA-SPLIT-PLAN.md`](docs/plans/INFRA-SPLIT-PLAN.md) | EDGE→EDGE2 split execution log + rollback |
| [`infra/dns/zionterranova.com.zone.md`](infra/dns/zionterranova.com.zone.md) | DNS zóna + verifikační runbook |
| [`zionterranova.com.zone`](infra/dns/zionterranova.com.zone) | raw WebGlobe zone file (import-ready) |

---
*Udržuj při každém strukturálním přesunu — poslední update: 2026-10-31 (B9 hygiene pass).*
