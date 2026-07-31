# Public subtree audit — 2026-07-30

> **Cíl:** 3.0.9 Go/No-Go `public/` subtree diff = 0 pro MIT-safe soubory.

## Metodika

```bash
cd /Users/yeshuae/Projects/2.9.6
find public/V3 -type f | sed 's#^public/##' | while read f; do
  [ -f "$f" ] && diff -q "$f" "public/$f"
done
```

## Souhrn

| Metrika | Hodnota |
|---------|---------|
| Souborů ve `V3/` celkem | 9 092 |
| Souborů i v `public/V3/` (sdílených) | 1 432 |
| Souborů pouze v private `V3/` | 7 660 |
| Sdílených souborů s rozdílem | **113** |

Poznámka: `public/V3/` je záměrně **curated subset** — private-only soubory (7 660)
jsou většinou test data, ops konfigurace, IP-čité záznamy a interní tooling,
které nesmí jít do MIT public release.

## Rozdílové soubory podle oblasti

| Oblast | Počet | Typické důvody rozdílů |
|--------|-------|------------------------|
| `V3/L1/miner/` | 13 | UI, GPU backend, CUDA, main, banner — private má novější verze a ops-only kód |
| `V3/L1/cosmic-harmony/` | 7 | `profit_router.rs`, `revenue.rs`, `lib.rs` — **private je podstatně novější** |
| `V3/L1/pool/` | 4 | PPLNS, server bin, lib — private pool obsahuje ops tunning |
| `V3/L1/core/` | 16 | Bridge, mempool, wallet, admin, bin/ — private obsahuje funding/escrow tooling |
| `V3/L1/native-ffi/` | 10 | Native hasher wrappery — private má platform-specific optimalizace |
| `V3/L2/bridge/` | 7 | Config TOML, EVM/L1 watcher, testnet/mainnet configy — **IP / RPC adresy / wallety** |
| `V3/L2/dao/` | 13 | Config, scanner, executor, docs — **sacred/governance obsah a interní RPC** |
| `V3/L2/atomic-swap/` | 4 | Config, executor — **wallety / RPC / swap parametry** |
| `V3/L2/contracts/hardhat/` | 8 | `deployed-*.json` — **obsahují reálné contract adresy a chain RPC** |
| `V3/L4/oasis/` + `V3/L5/free-world/` | 12 | Hra / superstruktura — private má UE5/Unity assety a interní konfiguraci |
| `V3/sdk/`, `V3/docs/`, `V3/Cargo.*` | 5 | Verze, CLI reference, konstanty |

## Zjištěné problémy

1. **`V3/L1/cosmic-harmony/src/profit_router.rs`** — private verze je **novější a větší**;
   public verze postrádá nové coiny (PRL, EPIC, ZANO, QUAI, BEAM, KLS, ZCL,
   QTC, VTC, IRON, NEXA, RTM, DNX, CKB, CFX, ZEC, PHX, KRX), NiceHash logiku,
   a nyní přidaný `disabled_reason`. Public subtree je zde zjevně pozadu.
2. **`V3/L1/miner/src/autonomous.rs`** — private verze má `AutonomousProfitRouter`;
   public verze není v seznamu diffujících, protože public `V3/L1/miner/src/`
   může tento soubor vůbec neobsahovat (není ve 113 diffech; autonomní logika
   je pravděpodobně private-only).
3. **Config / wallet / RPC soubory** — rozdíly jsou často **legitimní sanitizací**
   pro public release (adresy, IP, privátní klíče, endpointy).

## Doporučené kroky pro 3.0.9

1. **Vyčistit public `V3/` od IP / wallet / RPC secrets** — ruční audit
   `config/`, `deployed-*.json` a watcher zdrojů.
2. **Rozhodnout o verzi `profit_router.rs`:**
   - buď public subtree převzít private verzi (pokud je MIT-safe),
   - nebo ponechat starší public verzi a v ní **zavést `disabled_reason` pro
     coiny, které public zná** (PRL tam není, takže se jedná spíše o jiné coiny).
3. **Subtree sync:** `git subtree push --prefix=public public main` až bude
   diff = 0 pro MIT-safe soubory.
4. **Automatizovat diff report** do CI, aby se drift neopakoval.

## Výstupní formule

```bash
# Opakovatelné generování reportu
cd /Users/yeshuae/Projects/2.9.6
find public/V3 -type f | sed 's#^public/##' | while read f; do
  [ -f "$f" ] && diff -q "$f" "public/$f"
done > /tmp/public_v3_diff.txt
wc -l /tmp/public_v3_diff.txt
```

*Vygenerováno 2026-07-30.*
