# Public repo sync workflow (8.B7)

> Stav od 2026-10-28. Nahrazuje mrtvý subtree workflow.

## Proč nový model

Tracked `public/` subtree zanikl — obsah přesunut do `archive/PUBLIC`
(commit `4bec80f76`, unikáty zachovány v `ad7e2105f`). Lokalní working clone
`PUBLIC/` taky neexistuje. `git subtree push --prefix=public` už nelze použít.

Veřejný remote: `public` → `github.com/Zion-TerraNova/v3-Mainnet.git`.

## Nový model: curated export

`scripts/ops/public-export.sh` + manifest `scripts/ops/public-manifest.txt`:

1. `init` — naklonuje public remote do `./PUBLIC` (untracked working clone)
2. `export` — rsync cest z manifestu do `./PUBLIC` (dir = `rsync -a --delete`,
   automaticky vylučuje `.env*`, `*.key`, `*.pem`, `node_modules`, `target`)
3. `scan` — fail-closed grep secret scan (priv. klíče, seed/API token patterns,
   64-hex EVM sk) + velikostní guard (>5 MB); **FAIL = stop**
4. `push` — export + scan + commit + push (jediná cesta ven)

## Pravidla

- Manifest rozšiřovat jen po review — obsah jde veřejně a trvale.
- V31 zdroje: odkomentovat až po RC code gates (clippy/audit) + licence check.
- `archive/PUBLIC` = historický snapshot, už není sync source.
- Push je 🤖 preparable, ale každý push = reviewnutý commit (gate = scan + diff).
- Secrets nikdy: `/etc/zion/*`, `shared/.env`, klíče — manifest je whitelist.

## Náhrada za staré řádky

| Staré | Nové |
|---|---|
| `git subtree push --prefix=public public main` | `scripts/ops/public-export.sh push "msg"` |
| tracked `public/` v repu | `archive/PUBLIC` (snapshot) + `PUBLIC/` (untracked clone, `init`) |
