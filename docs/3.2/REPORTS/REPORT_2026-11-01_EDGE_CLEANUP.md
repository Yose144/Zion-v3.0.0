# REPORT — Opatrný úklid EDGE1 + EDGE2 (2026-11-01)

> **TL;DR:** uvolněno **16 GB** (EDGE2 124 → 115 GB, EDGE1 100 → 93 GB), 0 failed unitů,
> všechny služby active, chain 105 575. Mazaly se jen caches, build artefakty a snapsh Environmentaly
> deployů — nic živého. Velké položky (bitcoin, tréninkový `hiran/`, zálohy) jsou níže jako
> **návrh k rozhodnutí**, nesaháno na ně.

## 1. Co se smazalo

### EDGE2 (124 → 115 GB, 69 → 78 GB volno)

| Položka | Velikost | Proč bezpečné |
|---|---:|---|
| `/root/.npm` | 2,7 G | npm cache (`npm cache clean --force`) |
| `/root/.cache/puppeteer` | 676 M | Chromium ke stažení znovu |
| `/root/.cache/go-build` | 289 M | Go build cache |
| `/var/cache/apt/archives` | 407 M | `apt-get clean` |
| `/opt/pearl/zk-pow/target` | 646 M | Rust build output (`bindings/`, `src/` zůstaly) |
| `website-v2.9/.next.bak-*` (4×) | 259 M | záložní buildy ze 30. 9. – 27. 10. |
| `/var/crash/*` | 29 M | kernel crash dumpy |

### EDGE1 (100 → 93 GB, 45 → 52 GB volno)

| Položka | Velikost | Proč bezpečné |
|---|---:|---|
| `APP&WEB/nirvana.before-*` — 40 z 42 | 3,4 G | snapshoty před deployi; **2 nejnovější zůstaly** |
| `/opt/zion-rel/target` | 2,2 G | build output čistého worktree (rebuild ~20 min) |
| `/opt/zion/.git` (`git gc`) | 1,1 G | 2,5 → 1,4 G, historie netknutá |
| `pool-deploy-backup-*` — 13 z 14 | ~1,05 G | rollback artefakty z 26.–30. 10.; **nejnovější zůstal** |
| `llama-rig-{cuda,vulkan,v2}.tar.gz`, `llama-musl.tar.gz` | 612 M | **0 odkazů** v repu i v dokumentaci |
| `/var/cache/apt` + `/var/crash` | ~180 M | cache |

Navíc **`Qwen3-4B-Q4_K_M.gguf` (2,5 G) přesunut** z veřejného `/var/www/zion-miner/` do
`/opt/zion/hiran-models/` — model nemá co dělat ve webrootu, odkud ho kdokoli stáhne. Disk se tím
neuvolnil, ale zavřela se expozice. Soubor je v `V31/AGENTS.md`, `docs/3.2/HiranDev.md` a
`Hiran/README.md` → **nesmazán**.

## 2. Co jsem záměrně NECHAL (a proč)

| Položka | Kde | Velikost | Důvod |
|---|---|---:|---|
| `/opt/zion/bitcoin` | EDGE2 | 31 G | `prune=20000` už aktivní; snížení je změna configu + restart |
| `/opt/quantus/data` | EDGE2 | 17 G | chain data, ne rebuildovatelné |
| `/opt/pearl/.venv` | EDGE2 | 4,7 G | `pearl-gateway` z něj startuje |
| `/opt/zion/backups` | EDGE1 | 12 G | zálohy; retention 42 daily je politika, ne junk |
| `/opt/zion/hiran` | EDGE1 | 23 G | tréninkové artefakty (fp16 base, gguf, adaptery) |
| `/opt/zion/canonical-main` | EDGE1 | 2,6 G | checkout z 29. 9., žádný odkaz — ale je to "canonical" strom |
| `/opt/zion/V31` | EDGE1 | 5,4 G | z něj se buildí pool/node binárky |
| `/root/web-backups` | EDGE2 | 1,2 G | dnešní zálohy (1. 11.) |
| `/var/www/zion-miner` (zbytek) | EDGE1 | 2,6 G | servíruje se minerům (SMOS/vast stahují) |

## 3. Návrh dalšího kola (potřebuje 👤)

| # | Co | Zisk | Cena |
|---|---|---:|---|
| 1 | `/opt/zion/hiran/base/fp16` (trénink ve fp16) | **15 G** | smazat = nutný re-download z HF před dalším tréninkem |
| 2 | `/opt/zion/bitcoin` — `prune=20000` → `prune=2000` | **~28 G** | restart bitcoind; BTC swap je stejně `enabled:false` (safety hold) |
| 3 | `/opt/zion/canonical-main` (checkout 29. 9., 0 odkazů) | 2,6 G | žádná — jen potvrzení, že to není "zdroj pravdy" |
| 4 | `backup-edge.sh` retention 42 → 21 daily | cap 20 → 10 G | kratší okno denních záloh (weekly zůstávají) |
| 5 | `/opt/zion/hiran/base/gguf` (5,4 G) | 5,4 G | pokud se konvertované gguf už jen distribuují z `hiran-models/` |

## 4. Ověření po úklidu

```text
EDGE2: 115 G used / 78 G free (60 %)   failed units 0
       node 105 575 · zis · marketplace · multichain · oasis · pearld · quantus · bitcoind · kingdom active
EDGE1:  93 G used / 52 G free (65 %)   failed units 0
       pool /health 200 · nirvana · nirvana-net /net/health 200 · dashboard · chain-tunnel · node2 · node3 active
```

## 5. Poznámka k rollbackům

U poolu zůstal jen **nejnovější** `pool-deploy-backup-*` (11 M, 30. 10.), starší sada z 29. 10.
(187 M binárka + DB) smazána. Aktuální binárka `d786449b0` běží od 31. 10. bez incidentu a zdroj
je v repu, takže rollback = rebuild (~20 min), ne ztráta. Kdyby měl být rollback rychlý, příští
deploy si drží `.deploy-backups` v aplikaci.
