# REPORT — EVM Key Canonization (2026-10-27)

## Audit: co kontroluje EVM vrstvu na Base

On-chain stav (`eth_call`, Base mainnet, base-rpc.publicnode.com):

| Kontrakt | Adresa | Admin/Owner |
|---|---|---|
| wZION | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | `DEFAULT_ADMIN`=0xdde17…, `BRIDGE_ROLE`=0xdde17…+ZIONBridge |
| ZIONBridge | `0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467` | `DEFAULT_ADMIN`=0xdde17… |
| BridgeValidator | `0x9C138dC6ebA8A883AB3802F6Dcb79C772a835627` | 5-of-5 guardianů (starý set) — **immutable** |
| ZIONStaking | `0xbd5cEe7878337d22188BFBaF9aa9F39A850Be78B` | `DEFAULT_ADMIN`=0xdde17… |
| ZIONFarm | `0x167B2753F5D8D9F8e62875cc9e379d7804308B08` | `DEFAULT_ADMIN`=0xdde17… |
| ZIONGovernance | `0xB77eB4ab9468Ce03FBd7eCec70e976EFCfa623E8` | `owner()`=0xdde17… |
| ZIONTreasury | `0x455f465ac7e14fdA97dC46fdd74bCa78bfC0aEeD` | `owner()`=0xdde17… |
| ZIONAtomicSwap | `0x3DE9Ad42716854083ab837706E3961d10B0e63Eb` | `DEFAULT_ADMIN`=0xdde17… |
| ArtifactNFT | `0x70f1f4442a939468f66342e587f4bce09e8fd676` | `DEFAULT_ADMIN`+`MINTER`=0xdde17… |
| Marketplace | `0x59651e1Fb5cDe96Adee5A08d3F5CA99607afF754` | `DEFAULT_ADMIN`=0xdde17… |

**Starý deployer `0xdde17506…` = `/etc/zion/keys/validator.key` na EDGE2** (generace 6. 7., není ve V2).
Balance: 0.000267 ETH — na Base postačuje (gas ~µETH/tx).

Provozní klíče mimo V2: `MINTER_PRIVATE_KEY`→`0xbF82f801…`, `WALLET_SEED_KEY`→`0x9469C926…`.

## Oprava V2 keys souboru

- `evm_address` opraven na reálné `keccak256(pk)[-20:]` (EIP-55); původní sha256-placeholdery
  přesunuty do `evm_address_legacy_sha256` (shoda s `v3_compat` konstantami = L1 metadata).
- `evm_validators.validator_1` označen `role: "evm_contract_admin"` — **nový kanonický
  contract admin**: `0x13D06bEfcd28A06616C3CE2C6C7F5cdE5f02BB2b`.
- Mnemonic 24 slov + `evm_secret_key_hex` = kompletní backup v souboru.
- Re-verify: 39/39 PASS. Backup: `V31_PREMINE_V2_KEYS_2026-08-06.json.bak-pre-keccak`.

## Rotační plán (exekuce starým deployerem 0xdde17…)

Fáze 1 — grant novému adminovi (žádný revoke, dokud není ověřeno):
- `grantRole(0x0, 0x13D06bEf…)`: wZION, ZIONBridge, Staking, Farm, AtomicSwap, NFT, Marketplace (7 tx)
- `grantRole(MINTER_ROLE, 0x13D06bEf…)`: ArtifactNFT
- `transferOwnership(0x13D06bEf…)`: Governance, Treasury (2 tx)

Fáze 2 — BridgeValidator redeploy (immutable → nový kontrakt):
- 5 V2 validátorů keccak: `0x13D06bEf…`, `0xf46437eC…`, `0xF6fa1E36…`, `0x3Aa2b354…`, `0x4C032870…`
- doporučení: **threshold 3-of-5** (současný 5-of-5 = žádná tolerance výpadku)
- repoint `bridge_validator_address` + `validator_addresses` v `/etc/zion/bridge-mainnet.toml`
- `validator.key` → V2 validator_1 sk

Fáze 3 — revoke starého (až po ověření):
- `revokeRole`/`renounceRole` 0xdde17… + `0xbF82f801…` z MINTER/BRIDGE/DEF_ADMIN
- market env: `MINTER_PRIVATE_KEY`, `WALLET_SEED_KEY` → V2-derivované nebo rotované

## Stav kanonizace po dnešku

| Vrstva | Stav |
|---|---|
| L1 premine/admin/canonical | ✅ V2 = kanonické |
| DAO guardians (5z7) | ✅ live = V2 (toml + restart + API verified) |
| L1 bridge allowlist (`VALIDATOR_PUBKEYS`) | ✅ V2 compressed pks (node restartnut) |
| Swap escrow | ✅ env = V2 |
| V2 soubor EVM adresy | ✅ opraveno na keccak |
| On-chain Base admin | ⏳ čeká na rotaci (plán výše) |
