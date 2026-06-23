# ZION Bridge — Mainnet Deployment Report

> Generated: 2026-06-22, updated 2026-06-23 finál (5/5 confirmací pro všech 6 locků, 24h timelock aktivní)
> Scope: Base Mainnet 5/5 multisig bridge deployment

## Executive Summary

✅ **Mainnet 5/5 bridge je deployed, live a plně potvrzen.**

- `ZIONBridge` nasazen na `0x89504D6eD6993d726438E1A9C18aaC79e8d0eF88` s `threshold = 5` a 5 validátory.
- `BridgeValidator` nasazen na `0x9C138dC6ebA8A883AB3802F6Dcb79C772a835627` s `threshold = 5` a 5 guardiany.
- wZION `BRIDGE_ROLE` migrován ze starého single-sig bridge na nový 5/5 bridge.
- Relay upraven pro multi-validator podpis — všech 5 klíčů na jedné instanci.
- **Všech 6 locků (~100M ZION) má 5/5 on-chain confirmací.**
- ⏳ 24h timelock vyprší **2026-06-24 16:52 UTC** → ~100M wZION mintováno automaticky.

---

## On-chain verifikace

| Contract | Address | Status |
|----------|---------|--------|
| wZION | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | ✅ Exists, totalSupply = 300 wZION (testnet) |
| ZIONBridge (new, 5/5) | `0x89504D6eD6993d726438E1A9C18aaC79e8d0eF88` | ✅ threshold = 5, validatorCount = 5 |
| BridgeValidator (new, 5/5) | `0x9C138dC6ebA8A883AB3802F6Dcb79C772a835627` | ✅ threshold = 5, guardianCount = 5 |
| ZIONBridge (old, single-sig) | `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` | ❌ BRIDGE_ROLE revoked |
| UniV3Pool | `0xa88C4C89EB4597Df2e29A8061895300FcDF44FBB` | ✅ Listed on website, seed liquidity pending |
| L1 bridge vault | `zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0` | ✅ ~100M ZION (6 UTXO locků s memo, bloky 11611–11612) |

---

## Deployment transactions

| Step | Tx Hash |
|------|---------|
| Deploy BridgeValidator (5/5) | `0xaf4df777b36598d5ce7d2c7640a019140f1dae3dbe9c622db333891a6b7168db` |
| Deploy ZIONBridge (5/5) | `0x885d8e582b2534eb744cec3b42e49a6ad4c05784d21aa4f1c529c8ea13fd886f` |
| Grant BRIDGE_ROLE to new bridge | `0x37629a36939449dc75e4f9c2a532cd44aced9df5c6049920c86720b7a1e3a122` |
| Revoke BRIDGE_ROLE from old bridge | `0x9375eda2c17565e6e89aabff38f04ca8910a76276cdd55f2294de414479afc9f` |
| Add guardian 2 | `0x96ea2b37a821f705eaef7ee6d0982c10b6b9c1418ef81cf1f5096a2072af2474` |
| Add guardian 3 | `0xc303d4e09853131236cb6392a2b5094e3f4e2a403d7514d576ca3446e2ff1756` |
| Add guardian 4 | `0xe149193a9b37881c52c8af596521e1c91e088fbfa5d341a52a8c27b8f26512be` |
| Add guardian 5 | `0x70b2f439f40933c4f8b94cd8d67bad79bdea9f8d39032a773f118b29bd71303f` |

---

## Validator adresy (Base Mainnet)

| # | Address | Balance | Role |
|---|---------|---------|------|
| 1 | `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186` | ~0.002 ETH | Deployer + Guardian + Validator |
| 2 | `0x24d986841E56e5571489B25951eE8C1Ae761FA82` | ~0.001 ETH | Guardian + Validator |
| 3 | `0x665c55eDCF25c2c5A1dfF1B20eE950cBDC58d3d0` | ~0.001 ETH | Guardian + Validator |
| 4 | `0x8E644b3E9FaBf52eE321DC5B3D5AA06d6e3E66C6` | ~0.001 ETH | Guardian + Validator |
| 5 | `0x7e0D2eD71d78B9CFB5034A83333e82e304bc4CB2` | ~0.001 ETH | Guardian + Validator |

> **Doporučení:** Top-up všech 5 validátorů na ≥ 0.01 ETH pro stabilní provoz při vyšším objemu.

---

## 100M ZION — Stav (2026-06-23 finál)

> **Žádných 100M ZION NEBYLO ztraceno.** Všech 100M z genesis slotu 14 bylo úspěšně odesláno jako 6 UTXO locků s memo na bridge vault a nyní má 5/5 on-chain confirmací.

### 6 UTXO Lock TX (bloky 11611–11612)

| TxID | Částka | Blok | Memo | On-chain confirmations |
|------|--------|------|------|------------------------|
| `6bc2aa3e2879dfb3d98b35b1a09d7abee8fa9e5f3092a464c0679e84d6519ef4` | 16,666,666 ZION | 11611 | ✅ | **5/5** ✅ |
| `d9ddb3c7aaf2ad3a320c2878a1822298ec438240d9a9ffdbca95d256ec637cdb` | 16,666,666 ZION | 11611 | ✅ | **5/5** ✅ |
| `09fc9abb00c5b95e797709259731313afca5e0cc4a14f6687351e9295c1c6bc1` | 16,666,666 ZION | 11611 | ✅ | **5/5** ✅ |
| `2cd12d90b10b3ce7218a17dd804d36ad9c8d5870f42e27132c91c33e92f8458e` | 16,666,666 ZION | 11611 | ✅ | **5/5** ✅ |
| `4b43e7a3623ec3d4c007c134bd831a21d6628195643c1d6a33a889324fecfe59` | 16,666,666 ZION | 11612 | ✅ | **5/5** ✅ |
| `035c761db8a7e9d847ff56a8d8f8d7b37703631fac2b64453fb02fb20a1ef691` | 16,666,569 ZION | 11612 | ✅ | **5/5** ✅ |
| **Celkem** | **~100,000,000 ZION** | — | ✅ | ✅ 5/5 threshold met |

> Timelock expiry: **2026-06-24 16:52:53 UTC** — po expiry relay zavolá `executeTimelockedMint()`.

---

## Multi-Validator Relay — Architektura (2026-06-23)

Relay běžící na Edge serveru (`100.76.16.108`) nyní podporuje 5 privátních klíčů najednou:

```
ZION_VALIDATOR_PRIVATE_KEY    → validator-1 (0xdde17506...)
ZION_VALIDATOR_PRIVATE_KEY_2  → validator-2 (0x24d986...)
ZION_VALIDATOR_PRIVATE_KEY_3  → validator-3 (0x665c55...)
ZION_VALIDATOR_PRIVATE_KEY_4  → validator-4 (0x8E644b...)
ZION_VALIDATOR_PRIVATE_KEY_5  → validator-5 (0x7e0D2e...)
```

Pro každý L1 lock relay automaticky odešle `submitLockProof` od všech 5 validátorů (500ms delay mezi TX). Klíče jsou uloženy v `/root/zion-validator-key.env` (mode 600, mimo git).

### Commit

```
c4a4841  feat(bridge): multi-validator key support — relay submits all 5 keys per lock
```

---

## Konfigurace (aktuální)

### bridge-mainnet.toml

```toml
[l1]
rpc_url = "http://127.0.0.1:8443"
rpc_url_backup = "http://77.42.71.94:8443"
bridge_address = "zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0"
finality_blocks = 60
poll_interval_secs = 15
start_block_height = 11300
default_evm_recipient = "0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186"

[validator]
private_key_file = "keys/validator.key"
validator_id     = "validator-1"
threshold        = 5
total_validators = 5

[security]
max_single_amount = "20000000000000000000000000"  # 20M wZION wei
daily_limit       = "110000000000000000000000000" # 110M wZION wei
```

---

## Next steps — po mint (2026-06-24+)

| # | Krok | Detail | Popis |
|---|------|--------|-------|
| 1 | ⏳ executeTimelockedMint | 2026-06-24 16:52 UTC | Relay automaticky, ~100M wZION mintováno |
| 2 | ⏳ Top up validators ETH | 0.01 ETH × 5 = 0.05 ETH celkem | Gas pro budoucí bridge operace |
| 3 | ⏳ UniV3Pool seed liquidity | wZION + WETH na `0xa88C4C89EB...` | Viz `LIQUIDITY_PLAN.md` |
| 4 | ⏳ E2E burn→unlock test | Burn wZION na Base → unlock L1 ZION | Ověřit reverse směr bridge |
| 5 | ⏳ Bridge UI na webu | `/bridge` stránka s real wallet connect | MetaMask + zion-cli integrace |
| 6 | ⏳ Staking aktive | `ZIONStaking` kontrakt na Base | Seed wZION do staking poolu |
| 7 | ⏳ DAO treasury aktivace | Odemknout DAO treasury (cliff ~1 rok) | Viz `LIQUIDITY_PLAN.md` |

Viz [`LIQUIDITY_PLAN.md`](./LIQUIDITY_PLAN.md) pro kompletní DeFi + DAO roadmapu.

---

## Testnet status

- Base Sepolia 2/2 config je synchronizován a testován.
- `zion-bridge` načítá a startuje s `V3/config/bridge-testnet.toml`.
- EVM watcher block-range bug opraven (chunked na 1500 bloků pro Base RPC limity).
- ⚠️ Testnet ZIONBridge má `threshold() == 1` on-chain, ale config je 2/2 — zvážit redeployment nebo snížení configu.

---

```powershell
# Spustit relay lokálně (pro testování)
$env:ZION_BRIDGE_CONFIG = 'V3/config/bridge-mainnet.toml'
cargo run --manifest-path V3/Cargo.toml -p zion-bridge
```

*Generated with [Devin](https://devin.ai)*
