# 📋 PLÁN NA 8. ÚNORA 2026 — Sobotní Sprint

**Datum:** 8. února 2026  
**Zaměření:** Native knihovny + Emission Schedule + Stabilizace sítě  
**Odhadovaný čas:** 6–8 hodin

---

## 📊 Aktuální stav (večer 7.2.)

| Server | Core | Pool | Miner | Height | Image | Poznámka |
|--------|------|------|-------|--------|-------|----------|
| **Helsinki** (77.42.31.72) ARM64 | ✅ healthy | ✅ healthy | ✅ 10 kH/s, 1788 shares | ~13 | `2.9.5-ibd` | SEED NODE, 6 peers |
| **USA** (5.78.145.234) x86_64 | ✅ healthy | ✅ healthy | ✅ running | ~3 | `2.9.5-ibd` (pool), `2.9.5-native` připraven | ETC forwarding ✅ |
| **Singapore** (5.223.56.124) x86_64 | ✅ healthy | ✅ healthy | ✅ running | ~3 | `2.9.5-ibd` (pool), `2.9.5-native` připraven | ETC forwarding ✅ |

### Co máme hotové:
- ✅ P2P IBD sync implementován (commit `fc720ed`)
- ✅ Miner auto-reconnect (commit `c9bdf7c`)
- ✅ CH v3 StreamScheduler — ETC jobs forwarding na všech 3 poolech
- ✅ `Dockerfile.pool.native` — kompiluje C native knihovny v Dockeru
- ✅ `zion-pool:2.9.5-native` image sestaven na USA i SG (154 MB)
- ✅ `autolykos_v2_native.c` opraven (chybějící `#include <time.h>`)

### Co zbývá dokončit:
- ⚠️ Pool na USA/SG stále běží `2.9.5-ibd` (bez native) — potřeba přepnout na `2.9.5-native`
- ⚠️ Helsinki nemá `zion-pool:2.9.5-native` (ARM64 — jiný build)
- ⚠️ Block height jen ~13 — pool reportuje "Block candidate rejected"
- ⚠️ Block submit selhává — nutno vyšetřit

---

## 🎯 ÚKOLY NA ZÍTRA (prioritní pořadí)

### 🔴 PRIO 1: Opravit block submit (1-2h)
**Problém:** Pool najde blok ale `Block candidate rejected (or submit failed)`.

**Kroky:**
1. Přečíst pool log detailně — zjistit přesný error z core RPC
2. Zkontrolovat `submit_block` RPC endpoint v core — co vrací?
3. Ověřit hash validaci — pool počítá CH v3 hash, posílá do core
4. Ověřit difficulty match — pool job diff vs. core block diff
5. Fix + deploy + ověřit první úspěšný blok

**Soubory:**
- `zion-native/pool/src/blockchain/rpc_client.rs` — submit_block volání
- `zion-native/core/src/rpc/` — příjem submit_block
- `zion-native/core/src/validation/` — block validation pipeline

### 🔴 PRIO 2: Deploy native pool na všechny servery (1h)
**Co:**
- **USA/SG:** Přepnout z `zion-pool:2.9.5-ibd` na `zion-pool:2.9.5-native` (image už existuje)
- **Helsinki (ARM64):** Build `Dockerfile.pool.native` bez `-march=x86-64` → `-march=native`

**Příkazy:**
```bash
# USA + SG — jen swap image:
docker stop zion-pool && docker rm zion-pool
docker run -d --name zion-pool --network host \
  -e ZION_CORE_RPC=http://zion-core:8444/jsonrpc \
  -e RUST_LOG=info \
  zion-pool:2.9.5-native

# Helsinki — build ARM64 verze:
# Změnit -march=x86-64 → -march=native v Dockerfile
docker build -f Dockerfile.pool.native -t zion-pool:2.9.5-native .
```

**Výsledek:** Všechny 3 pooly s plnou validací ETC/RVN/ERG/KAS share.

### 🟡 PRIO 3: Emission Schedule implementace (2-3h)
**Co:** Implementovat halving do core reward systému.

**Navrhovaný model:**
```
Blok 0 – 210,000:      50 ZION  (4 roky při 1 min/block)
Blok 210,001 – 420,000: 25 ZION
Blok 420,001 – 630,000: 12.5 ZION
... (halving každých 210,000 bloků jako BTC)

Max supply: ~21,000,000 ZION (+ premine)
```

**Soubory k editaci:**
- `zion-native/core/src/blockchain/reward.rs` — `get_block_reward(height)` funkce
- `zion-native/core/src/validation/mod.rs` — reward validace
- Testy: unit testy pro emission schedule

### 🟡 PRIO 4: Wallet Send příkaz (2-3h)
**Co:** CLI příkaz pro odeslání ZION transakce.

**Kroky:**
1. Implementovat `wallet send <adresa> <částka>` v CLI
2. UTXO selekce (coin selection)
3. Podpis transakce (Ed25519)
4. Broadcast přes RPC do core
5. Core přijme do mempoolu → zařadí do bloku

**Soubory:**
- `zion-native/wallet/` — nový modul nebo rozšíření existujícího
- `zion-native/core/src/rpc/` — `send_transaction` endpoint
- `zion-native/core/src/mempool/` — přijetí TX

### 🟢 PRIO 5: IBD stress test (30 min)
**Co:** Ověřit že IBD funguje při velkém výškovém rozdílu.

**Kroky:**
1. Počkat až Helsinki vytěží 50+ bloků
2. Smazat data volume na USA: `docker volume rm zion-core-data-2.9.5`
3. Restart USA core — musí stáhnout všechny bloky přes IBD
4. Ověřit v logu: `[IBD] Starting IBD sync...`, `[IBD] Progress: 50/50`

---

## 🔍 Investigace / poznámky

### Block submit rejection — hypotézy:
1. **Hash mismatch**: Pool počítá hash jinak než core validation
2. **Nonce format**: Pool posílá nonce v jiném formátu
3. **Difficulty**: Pool job difficulty ≠ core block difficulty
4. **Timestamp**: Block template timeout (>60s stale)
5. **Missing coinbase**: Pool neposílá správný coinbase TX

### Native lib dopad (verifikace):
- Pool `2.9.5-ibd` (bez native) **funguje** pro ZION share validaci (pure Rust)
- Pool `2.9.5-native` (s native) přidá **reálnou validaci** ETC/RVN/ERG/KAS share
- Pro ZION samotný: **žádný výkonový rozdíl** — Rust impl je stejně rychlá
- Native libs jsou **nutné** pro budoucí multi-chain revenue ověření

---

## 📌 Doporučený rozvrh dne

| Čas | Úkol | Prio |
|-----|------|------|
| **9:00 – 10:30** | 🔴 Debug block submit rejection | PRIO 1 |
| **10:30 – 11:30** | 🔴 Deploy native pool (USA, SG, Helsinki) | PRIO 2 |
| **11:30 – 12:00** | 🟢 IBD stress test (smazat volume, sync) | PRIO 5 |
| **12:00 – 13:00** | 🍕 Pauza | — |
| **13:00 – 15:30** | 🟡 Emission Schedule implementace | PRIO 3 |
| **15:30 – 17:30** | 🟡 Wallet Send (start, nemusí být hotovo) | PRIO 4 |
| **17:30 – 18:00** | 📋 Commit + push + work report | — |

---

## 🏁 Definition of Done — co musí být na konci dne

- [ ] ✅ Mining produkuje platné bloky (block submit úspěšný)
- [ ] ✅ Všechny 3 pooly běží s `2.9.5-native` image
- [ ] ✅ Emission schedule implementován (get_block_reward s halvingem)
- [ ] ✅ IBD sync otestován (1 node catch-up)
- [ ] 🎁 Bonus: Wallet send funkční (pokud zbude čas)

---

## 🔗 Reference

- **Mainnet Launch Plan:** `MAINNET_LAUNCH_PLAN_v2.9.5.md`
- **P2P Deploy Report:** `WORK_REPORT_07_FEB_2026_P2P_DEPLOY.md`
- **Servery SSH:**
  ```
  Helsinki:  ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72
  USA:       ssh -i ~/.ssh/zion_hetzner_key root@5.78.145.234
  Singapore: ssh -i ~/.ssh/zion_hetzner_key root@5.223.56.124
  ```
- **Git:** Poslední commit `fc720ed` — IBD sync system

---

*🌟 "Simple, correct, deployed." 🌟*
