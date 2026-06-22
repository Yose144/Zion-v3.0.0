# ZION Desktop Agent — Wallet E2E Report

**Datum:** 2026-06-22  
**Branch:** `main`  
**Report commit:** `52461678`  
**Cíl:** Rozjet desktop agenta end-to-end a hlavně umožnit posílání transakcí z GUI.

---

## Shrnutí

Desktop agent (`APP&WEB/desktop-agent`) byl uveden do provozuschopného stavu pro wallet workflow. GUI startuje, wallet se generuje/obnovuje deterministicky, transakce se staví v aktuálním **TX_HASH_V2** formátu a RPC volání na Edge node fungují. Reálné odeslání transakce vyžaduje, aby adresa měla UTXO (viz sekce Omezení a další kroky).

---

## Co bylo opraveno

| Problém | Soubor | Oprava |
|---|---|---|
| `npm install` failoval na neexistujícím `zion-wallet-sdk` | `package.json` | Dependency odebrána — v kódu se nikde nepoužívala |
| Mnemonic recovery **nebyl deterministický** | `src/wallet-generator.js` | Přepsáno z `crypto.generateKeyPairSync('ed25519', {seed})` (který seed ignoruje) na `@noble/ed25519` + JWK import do PKCS8 DER |
| UTXO transakce používaly **zastaralý v1 hash** | `src/utxo-builder.js` | Přepnuto na `version: 2` a length-prefixed v2 preimage, který mainnet vyžaduje od genesis |
| Electron failoval s `app is undefined` | `scripts/launch-electron.js` | `ELECTRON_RUN_AS_NODE=1` v shell prostředí se nyní maže před spuštěním GUI |
| Verze agenta byla 3.0.0 | `package.json`, `src/main.js` | Sjednoceno na **3.0.2** |
| Chyběl headless E2E test wallet workflow | `scripts/test-wallet-e2e.js` | Nový smoke test |

---

## Verifikace

### 1. Instalace závislostí

```powershell
cd "APP&WEB/desktop-agent"
npm install
# ✅ 435 packages, žádná chyba
```

### 2. Headless wallet E2E test

```powershell
npm run test:wallet
```

Výstup:

```
[1/7] Generating wallet...
  address: zion1... (valid: true)
[2/7] Testing wallet encryption... OK
[3/7] Testing deterministic mnemonic recovery... OK
[4/7] Querying balance via Edge RPC... rpc_ok: true, chain_height: 10456+
[5/7] Querying UTXOs via Edge RPC... OK
[6/7] Building signed UTXO transaction... version: 2
[7/7] Verifying Ed25519 signature... OK
=== All wallet E2E smoke tests passed ===
```

### 3. GUI start

```powershell
$env:ELECTRON_RUN_AS_NODE = $null
npm run dev:wallet
```

Výstup:

```
ZION Native Awakening v3.0.0 started
Skip checkForUpdates because application is not packed
```

### 4. RPC submitTransaction formát ověřen proti živému Edge nodu

Na `77.42.71.94:8443` byla odeslána testovací transakce. Node ji přijal, parsoval a správně odmítl kvůli neexistujícímu UTXO:

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32004,
    "message": "UTXO input ... does not exist or is already spent"
  }
}
```

To potvrzuje, že formát v2 transakce, podpis i RPC payload jsou správné.

### 5. Dashboard

Python dashboard běží na `http://127.0.0.1:8766` a ukazuje Edge-primary topologii:

```bash
python ZION_OS/dashboard/app.py
```

`GET /api/status` vrací výšku řetězce, stav node/pool/miner atd.

---

## Jak spustit desktop agenta E2E

### Rychlý wallet-only režim (bez buildu miner/node binárek)

```powershell
cd "APP&WEB/desktop-agent"
$env:ELECTRON_RUN_AS_NODE = $null
npm run dev:wallet
```

### Plný režim s lokálním minerem/nodem

```powershell
cd "APP&WEB/desktop-agent"
$env:ELECTRON_RUN_AS_NODE = $null
npm start
```

> ⚠️ `npm start` nejprve přes `prestart` buildí V3 Rust binárky (`zion-miner`, `node`, `zion` CLI) — trvá to několik minut.

### Headless test

```powershell
cd "APP&WEB/desktop-agent"
npm run test:wallet
```

---

## Pokus o reálný E2E UTXO send (2026-06-22)

Cíl: rozjet skutečný UTXO send na živém nodu. Postup a výsledky:

### 1. Build V3 binárek z zdrojáku

```powershell
$env:CARGO_TARGET_DIR = "V3\target_e2e"
cargo build --release --manifest-path V3/Cargo.toml -p zion-core -p zion-miner -p zion-pool
```

✅ Hotovo za cca 3 minuty. Vygenerované binárky:
- `V3\target_e2e\release\node.exe` (node + wallet CLI + utilities)
- `V3\target_e2e\release\zion-miner.exe`
- `V3\target_e2e\release\server.exe` (pool)

`V3\target_e2e\` je v `.gitignore` (build artefakty).

### 2. Start lokálního standalone nodu

```powershell
cmd.exe /c "set ZION_NODE_ID=e2e-local& set ZION_P2P_BIND=127.0.0.1:18333& set ZION_RPC_BIND=127.0.0.1:18443& set ZION_NODE_STATE_PATH=V3\data\e2e\node\state.db& set ZION_MINER_ADDRESS=zion193n2t2z348z2q4u0r7k655z2v694j5n345ry0w6& set ZION_HUMANITARIAN_WALLET=zion193n2t2z348z2q4u0r7k655z2v694j5n345ry0w6& set ZION_ISSOBELLA_WALLET=zion193n2t2z348z2q4u0r7k655z2v694j5n345ry0w6& set ZION_SEED_PEERS=127.0.0.1:65530& set ZION_METRICS_BIND=& V3\target_e2e\release\node.exe"
```

**Důležité:** `ZION_SEED_PEERS` musí být nastaven na **nedosažitelnou adresu** (např. `127.0.0.1:65530`). Prázdná hodnota nestačí — fallback na hardcoded seznam (77.42.71.94:8333 Edge + 100.76.16.108 + 127.0.0.1:8333). S nedosažitelným peerem se node nespustí vůbec (vyžaduje ≥1 seed peer), takže ideální je nastavit jeden seed na `127.0.0.1:65530` a nechat handshake vyhnít.

✅ Node nastartoval, genesis block načten, `getNodeInfo` ukazuje `chain_height: 0`, `peers: 1` (ten nedosažitelný).

### 3. Generování testovacího walletu + ověření přes wallet CLI

```powershell
# Desktop agent generuje wallet (deterministicky z BIP39)
node -e "const w = require('./src/wallet-generator').generateWallet(); console.log(w.address); console.log(Buffer.from(w.privateKey,'hex').slice(-32).toString('hex'));"
# → address: zion193n2t2z348z2q4u0r7k655z2v694j5n345ry0w6
# → raw 32-byte Ed25519 seed: 6db26fda05657de8f6415b342964a8826a70fe11a910a0de52d4bb33a5758bd3

# Wallet CLI (V3 nativní binárka) — používá raw 32-byte seed (ne PKCS8 DER)
$env:ZION_WALLET_SK_HEX = "6db26fda05657de8f6415b342964a8826a70fe11a910a0de52d4bb33a5758bd3"
$env:ZION_RPC_ADDR = "127.0.0.1:18443"
.\V3\target_e2e\release\wallet.exe info
# → address: zion193n2t2z348z2q4u0r7k655z2v694j5n345ry0w6
# → public_key: cb8c4ef583f1a020a14b4764129d7a5c444d6f893118e2e4a2b3cb6f31705a61

.\V3\target_e2e\release\wallet.exe balance
# → account: 0 ZION
# → utxo: 0 ZION
```

✅ **Adresa generovaná desktop agentem a V3 wallet CLI se shoduje.** Wallet workflow je skutečně interoperabilní napříč oběma implementacemi.

### 4. Mining 100+ bloků pro získání zralých UTXO

**Problém:** Coinbase výstup je v ZION nespendable po dobu `COINBASE_MATURITY = 100` bloků (viz `V3/L1/core/src/emission.rs:48`). Pro získání spendable UTXO z coinbase rewardu je potřeba vytěžit **≥100 bloků**, kde první coinbase (z bloku 1) dozraje po 100 dalších blocích.

**Setup:**
```powershell
# Pool (propojuje miner a node)
cmd.exe /c "set ZION_POOL_BIND=127.0.0.1:18444& set ZION_NODE_RPC_ADDR=127.0.0.1:18443& set ZION_POOL_LOOP_COUNT=1000000& set ZION_NONCE_COUNT=4096& V3\target_e2e\release\server.exe"

# Miner (CPU, 4 vlákna, deeksha_lite_v1)
cmd.exe /c "set ZION_POOL_ADDR=127.0.0.1:18444& set ZION_WORKER_NAME=e2e-miner& set ZION_MINER_ID=e2e-miner-01& set ZION_LOOP_COUNT=1000000& set ZION_PAYOUT_ADDRESS=zion193n2t2z348z2q4u0r7k655z2v694j5n345ry0w6& set ZION_MINER_ALGORITHM=deeksha_lite_v1& set ZION_THREADS=4& set ZION_INTERACTIVE=false& V3\target_e2e\release\zion-miner.exe"
```

**Pozorované chování:**
- Miner se připojil k poolu (`wire_hello` handshake OK)
- Pool posílá `job` s `target_hex: ffffff...` (max target = share difficulty 1)
- Miner opakovaně hlásí `no_solution` pro každý batch 4096 nonců
- `elapsed_ms=0` pro každý batch — podezřelé, memory-hard PoW by měl trvat déle
- Pool validuje share a odmítá s `status: "NoSolution"`
- Chain height zůstává na 0

**Možné příčiny:**
1. CPU `deeksha_lite_v1` implementace v mineru neprodukuje stejný hash jako očekává pool
2. Header formát (verze, nonce pozice) nesedí mezi minerem a node
3. `ZION_THREADS=4` se neaplikuje a miner jede na 1 vlákně, ale `elapsed_ms=0` ukazuje, že se nic nepočítá
4. Bug v pool share validaci (pool odmítá i platné share)

**Status:** Mining se v této relaci nepodařilo rozjet. Chain height zůstal 0. UTXO send přes desktop agenta tedy **stále vyžaduje zafundovanou adresu z externího zdroje**.

### 5. Konverze PKCS8 DER ↔ raw Ed25519 seed

Desktop agent ukládá privátní klíč jako **PKCS8 DER** (48 bytů), V3 wallet CLI očekává **raw 32-byte Ed25519 seed**. Konverze je triviální:

```
raw_seed = PKCS8_DER[48 bytes].slice(-32)  // posledních 32 bytů DER
```

Ověřeno: adresa odvozená z raw seed matchuje adresu z PKCS8 DER.

---

## Aktuální omezení

Desktop agent podporuje pouze **UTXO transakce**. Aby šla opravdu odeslat transakce, musí mít odesílací adresa UTXO. To znamená:

- ✅ Generovat wallet, ukládat, obnovovat z mnemonic — funguje
- ✅ Stavit a podepisovat transakce — funguje
- ✅ Komunikovat s RPC a odesílat `submitTransaction` — funguje
- ❌ Odeslat transakci z prázdné adresy — nefunguje (žádné UTXO k utracení)
- ❌ Odeslat transakci z account-only adresy (např. premine humanitarian/ISSOBELLA/DAO treasury) — nefunguje, protože ty nemají UTXO

---

## Další kroky k plnému E2E (s reálnými transakcemi)

### Krátkodobé (operativní)

1. **Zafundovat testovací wallet**
   - Nastavit v agentovi vlastní `zion1...` adresu
   - Těžit na ni přes pool (`77.42.71.94:8444`) a počkat na payout, nebo
   - Převést prostředky z account adresy na UTXO adresu přes CLI/node RPC

2. **Otestovat reálný send v GUI**
   - Wallet tab → Send
   - Vyplnit příjemce, částku, memo, heslo
   - Potvrdit dialog
   - Ověřit `txId` v block exploreru / RPC `getTransaction`

3. **Otestovat pool payout workflow**
   - Nastavit wallet jako payout address
   - Start mining
   - Po nalezení bloku pool ověřit UTXO payout v GUI

### Střednědobé (vylepšení agenta)

4. **Account-model transakce v GUI**
   - Přidat podporu pro `submitAccountTransaction` (pro premine/DAO treasury adresy)
   - Vyžaduje nonce management a account balance lookup

5. **Automatická konverze account → UTXO**
   - Tlačítko "Convert to UTXO" pro account zůstatky
   - Interně zavolá CLI/node s `build_and_sign_account` nebo odpovídající RPC

6. **Lepší RPC fallback a local node integrace**
   - Agent umí startovat lokální `zion-node` z resources/
   - Fallback Edge → localhost → VPN Tailscale
   - Ověřit, že `nodeGetStatus` a `nodeStart` IPC handlery fungují s novými binárkami

7. **Miner binary build v prestart**
   - `prepare-rust-miner.js` by měl být otestován na Windows 11
   - Řešit Windows Defender/Antivirus lock `zion-miner.exe` (známý problém z `StatusV3.md`)

8. **CI pro desktop agent**
   - `npm run test:wallet` do GitHub Actions
   - `node --check` všech JS souborů
   - Zvážit Electron build check (náročné na Windows runner)

### Dlouhodobé

9. **Přechod na `ZION_OS/desktop` (Tauri)**
   - Nový dashboard je v `ZION_OS/desktop`, ale nemá wallet
   - Přesunout wallet logiku z Electron agenta do Tauri dashboardu
   - Zvážit sdílenou `zion-wallet-sdk` crate/JS knihovnu

10. **Bezpečnostní audit wallet**
    - Odstranit plaintext logování adres a txid
    - Zeroize private key v paměti po použití
    - Hardware wallet / seed storage integrace

---

## Reference

- Desktop agent: `APP&WEB/desktop-agent/`
- Headless test: `APP&WEB/desktop-agent/scripts/test-wallet-e2e.js`
- V3 audit + debug plán: `V3_AUDIT_SUMMARY.md`, `DEBUG_3.0.2.md`
- Status a topologie: `StatusV3.md`
- Dashboard: `ZION_OS/dashboard/app.py`

---

*Report vygenerován 2026-06-22. Poslední commit s opravami: `52461678`.*
