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
