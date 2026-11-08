# Rollback produkčních služeb (8.S3)

> **Platí od:** 2026-11-08. Nástroj: [`scripts/ops/service-snapshot.sh`](../../scripts/ops/service-snapshot.sh).
> **Stav:** 16 služeb má ověřený rollback artefakt (14 binárek + 2 Next aplikace).
> **Self-test:** `bash scripts/ops/test-service-snapshot.sh` (běží bez produkce, se fake `systemctl`).

## Proč to existuje

Deploye na EDGE1/EDGE2 dělá několik různých cest (pool build na EDGE, rsync binárek,
artefaktový deploy webu, marketplace build). Zálohy vznikaly ad-hoc a **pool neměl binární
rollback vůbec** — „rebuild ze zálohovaných zdrojů" není rollback: trvá desítky minut, závisí
na síti a na tom, že zdroje odpovídají tehdejšímu commitu.

Nová pravidla:

1. **Před deployem** vznikne snapshot běžící verze (`snapshot`).
2. **Po deployi** se ověří, že k běžící binárce snapshot existuje (`verify`).
3. Když nová verze neprojde, vrátí se snapshot (`restore`), a když ani to neprojde,
   nástroj **sám vrátí předchozí stav**.

## Co je kryté (2026-11-08)

| Host | Služba | Druh | Artefakt |
|---|---|---|---|
| EDGE1 | `zion-v31-pool` | binary | 11,5 MB |
| EDGE1 | `zion-v31-node2`, `zion-v31-node3` | binary | 6,5 MB |
| EDGE1 | `zion-v31-miner`, `zion-fallback-miner` | binary | 7 MB |
| EDGE2 | `zion-v31-node` | binary | 6,5 MB |
| EDGE2 | `zion-v31-dao`, `-free-world`, `-issobella`, `-ncl`, `-oasis`, `-ai-native`, `-multichain` (warpd), `zion-hiran-gateway` | binary | 3,9–20 MB |
| EDGE2 | `zion-website` | nextapp | 128 MB (`.next/standalone` + `.next/static` + `package.json`) |
| EDGE2 | `zion-marketplace` | nextapp | 133 MB |

Uložení: `/opt/zion/backups/services/<unit>/<UTC>/{artefakt,unit.txt,manifest.json}`,
retence **5** posledních (nikdy nemaže nejnovější). Disk 2026-11-08: EDGE1 ~38 MB,
EDGE2 ~350 MB (volno 59 G / 78 G).

**Co záměrně kryté není:**

- **cizí software** — `bitcoind`, `quantus-node`, `pearld`, `oyster`, `llama-server`
  (jejich „rollback" není náš deploy; nástroj je přeskakuje),
- **`public/`** u Next aplikací — je to obsah z repa, ne build; vrací se rsyncem z gitu,
- **DB, env soubory, unit soubory** — snapshot je ukládá jen jako informaci (`unit.txt`,
  manifest), nemění je a neobnovuje,
- **`zion-kingdom`, `zion-zis`, `zion-nirvana(-net)`, `zion-l1-watcher`** — běží pod `node`,
  jejich rollback je app tree; snapshot jde udělat stejnou cestou jako web
  (`--kind nextapp --path …`), jen to zatím nikdo neudělal.

## Příkazy

```bash
# snapshot obou hostů (auto-detekce běžících binárek)
bash scripts/ops/service-snapshot.sh snapshot

# jen jeden host / jedna služba, jiná retence
bash scripts/ops/service-snapshot.sh snapshot --host edge1 --service zion-v31-pool --keep 3

# co je k dispozici
bash scripts/ops/service-snapshot.sh list

# ověření, že běžící verze má snapshot (exit 1 = díra)
bash scripts/ops/service-snapshot.sh verify

# Next aplikace (binárka je node, rollback je build artefakt)
bash scripts/ops/service-snapshot.sh snapshot --host edge2 --service zion-website \
  --kind nextapp --path '/opt/zion/APP&WEB/website-v2.9'

# rollback — defaultně DRY-RUN
bash scripts/ops/service-snapshot.sh restore --host edge1 --service zion-v31-pool
bash scripts/ops/service-snapshot.sh restore --host edge1 --service zion-v31-pool \
  --to 20261108T162658Z --confirm --health-url http://127.0.0.1:8080/health
```

`restore` bez `--to` bere **předchozí** snapshot (typicky verzi před posledním deployem).

## Co `restore --confirm` přesně dělá

1. **safety snapshot** běžící verze (aby existovala cesta zpět i pro rollback),
2. `systemctl stop <unit>`,
3. výměna artefaktu (binárka: `cp` + `chmod`/`chown` + `mv`; nextapp: `mv` starých
   `.next/standalone` a `.next/static` stranou + rozbalení),
4. `systemctl start <unit>`,
5. čekání na `is-active` (15 s) a volitelně `--health-url`,
6. při neúspěchu **automatický návrat safety snapshotu** + nenulový exit.

Nástroj nikdy nemění unit soubor, env ani databázi — jen artefakt a stav služby.

## Checklist pro každý produkční deploy

```
1. bash scripts/ops/service-snapshot.sh snapshot --host <edge1|edge2> --service <unit>
2. deploy (pool build / rsync / artefaktový deploy)
3. health check nové verze
4. bash scripts/ops/service-snapshot.sh verify --host <host>     # běžící == snapshot?
     DRIFT = od posledního snapshotu se binárka změnila → udělej snapshot nové verze
5. při problému: restore --confirm
```

Krok 4 je i dobrý denní cron kandidát (`verify` je read-only a vrací exit 1 při díře).
**Timer jsem záměrně nezakládal** — instalace systemd unitu je změna v produkci, patří 👤.

## Omezení, která je dobré znát

- `nextapp` snapshot **nezahrnuje `public/`** ani `node_modules`; po restore se bere
  standalone strom, který si nese vlastní `node_modules`.
- `restore` má krátký výpadek (stop → start). U poolu to znamená odpojení minerů
  a drain; dělej to, když je to potřeba, ne „pro jistotu".
- Snapshot binárky nezaručuje, že **konfigurace** (env, TOML) je stejná — env se needituje
  a v manifestu je jen hash unit souboru.
- `verify` u binárek porovnává sha256 běžícího souboru; u `nextapp` jen existenci
  a velikost artefaktu (tarball se nedá srovnat s živým stromem).
- Nástroj běží přes SSH z repa; na hostu funguje i lokálně (`ZION_REMOTE=1`).
