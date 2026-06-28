# L2 — Co chybí, testovací plán a návod pro nové uživatele

> Stav k 1. dubnu 2026 — po deployi kontraktů na Base mainnet

---

## ČÁST 1: Co je HOTOVÉ

### Kontrakty na Base Mainnet (chain 8453)

| Kontrakt | Adresa | Stav | BaseScan |
|----------|--------|------|----------|
| wZION (ERC-20) | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | ✅ Live, supply=0, mintable=144B | ✅ Verified |
| ZIONBridge | `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` | ✅ Live, threshold=1, not paused | ✅ Verified |
| ZIONAtomicSwap | `0x3DE9Ad42716854083ab837706E3961d10B0e63Eb` | ✅ Live, fee=0bps, not paused | ✅ Verified |

### Služby na serveru (Edge)

| Služba | Kontejner | Stav |
|--------|-----------|------|
| Bridge relay | zion-v3-bridge | ✅ Běží (Base Sepolia testnet režim) |
| Atomic Swap | zion-v3-swap | ✅ Běží |
| DAO | zion-v3-dao | ✅ Běží |

### Testy (ověřeno 1. dubna 2026)

| Oblast | Počet testů | Stav |
|--------|-------------|------|
| Solidity kontrakty (wZION+Bridge+Swap+Farm+E2E) | 132 | ✅ Všechny prochází |
| Bridge (Rust — lib+integration+doctest) | 113+47+1 = 161 | ✅ Všechny prochází |
| Atomic Swap (Rust — lib+integration) | 18+16 = 34 | ✅ Všechny prochází |
| DAO (Rust — lib+integration) | 40+25 = 65 | ✅ Všechny prochází |
| **Celkem L2** | **392** | ✅ |

---

## ČÁST 2: Co ještě CHYBÍ

### 🔴 Blokéry — musí být hotové před ostrým provozem

| # | Co chybí | Proč to blokuje | Kde opravit | Stav |
|---|----------|-----------------|-------------|------|
| 1 | ~~L1 pool payout nefunguje~~ | ~~missing ZION_POOL_PAYOUT_SK_HEX~~ | ~~Nastavit payout klíč na serveru~~ | ✅ **VYŘEŠENO** Phase 18 — pool payout pipeline funguje, payout_execution=enabled |
| 2 | **Bridge vault adresa je placeholder** | `zion1bridge0...vault` — není reálná adresa na L1 | Vytvořit reálnou vault adresu v L1 core | 🔴 Blokuje |
| 3 | **Bridge relay jede proti testnetu** | Config ukazuje na Base Sepolia, ne mainnet | Přepnout `ZION_BRIDGE_CONFIG` na `bridge-mainnet.toml` | 🔴 Blokuje |
| 4 | **bridge-mainnet.toml má `enabled=false`** | Bridge mainnet chain je vypnutý | Zapnout až po testování | 🔴 Blokuje |
| 5 | **Žádný wallet/explorer pro L1** | Uživatel nemá jak poslat ZION na vault | Potřeba webový wallet nebo CLI nástroj | 🔴 Blokuje |
| 6 | ~~BaseScan verifikace kontraktů~~ | ~~Kód není veřejně čitelný~~ | ~~Potřeba BASESCAN_API_KEY~~ | ✅ **VYŘEŠENO** — všechny 3 kontrakty verified na BaseScan |

### 🟡 Důležité ale ne blokéry

| # | Co chybí | Dopad |
|---|----------|-------|
| 7 | Bridge threshold je 1-of-2 | Pro mainnet by měl být 3-of-5 |
| 8 | 172 `.unwrap()` volání v Rust kódu | Může crashnout v edge cases |
| 9 | Atomic Swap nemá Ankr fallback RPC | Méně spolehlivý při výpadku primárního RPC |
| 10 | DAO treasury adresy jsou placeholder | Governance nemůže spravovat reálné fondy |
| 11 | Žádný monitoring/alerting pro L2 služby | Bez varování při problémech |
| 12 | wZION není listován na DEXech | Nikdo ho nemůže obchodovat |

### 🟢 Nice-to-have (po spuštění)

| # | Co | Proč |
|---|-----|------|
| 13 | CoinGecko listing | Viditelnost tokenu |
| 14 | Bridge UI na webu | Samoobslužný bridge pro uživatele |
| 15 | Likvidita na Uniswap | wZION/ETH pool pro obchodování |
| 16 | Multi-chain (Arbitrum, BSC) | Hardhat config je připravený, kontrakty taky |

---

## ČÁST 3: TESTOVACÍ PLÁN

### Test 1: wZION kontrakt na Base mainnet

```
Cíl: Ověřit že wZION funguje správně

Kroky:
1. V MetaMasku přepni na Base mainnet
2. Import Token → 0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6
3. Ověř: zobrazuje se "wZION", balance = 0
4. Na BaseScan ověř: https://basescan.org/token/0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6

Očekávaný výsledek:
- Token se zobrazí v MetaMasku
- BaseScan ukazuje Wrapped ZION, 18 decimals, supply = 0
```

### Test 2: Bridge kontrakt — mint test (admin only)

```
Cíl: Ověřit že bridge může mintovat wZION

Kroky (CLI):
cd L2/contracts
npx hardhat console --network base

> const wzion = await ethers.getContractAt("WZION", "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6")
> const bridge = await ethers.getContractAt("ZIONBridge", "0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721")
> // Test: bridge mint 1 wZION to deployer (requires valid proof)
> // Pro plný test potřebujeme simulovat lock na L1

Očekávaný výsledek:
- Bridge má BRIDGE_ROLE ✅ (ověřeno)
- Mint proběhne pouze s validním proof od validátoru
```

### Test 3: Bridge relay — testnet end-to-end (DOPORUČENO JAKO PRVNÍ)

```
Cíl: Ověřit celý bridge flow na testnetu

Předpoklady:
- Bridge relay běží na Edge (✅ ano)
- wZION na Base Sepolia existuje (✅ ano)

Kroky:
1. Pošli ZION na vault adresu na L1 s memo "BRIDGE:base_sepolia:0xTVOJE_ADRESA"
2. Sleduj logy: ssh root@100.76.16.108 docker logs -f zion-v3-bridge
3. Počkej na "lock detected" → "proof submitted" → "mint confirmed"
4. Zkontroluj wZION balance v MetaMasku (Base Sepolia)

⚠️ PROBLÉM: L1 nemá funkční transakce, takže tento test zatím nelze provést
→ Alternativa: Test 3b (lokální simulace)
```

### Test 3b: Bridge lokální simulace

```
Cíl: Ověřit bridge logiku bez živé sítě

Kroky:
cd V3
cargo test -p zion-bridge --test mainnet_readiness -- --nocapture
cargo test -p zion-bridge --test bridge_integration -- --nocapture

Očekávaný výsledek:
- Všechny testy projdou (✅ ověřeno — 161 testů prochází)
```

### Test 4: Atomic Swap kontrakt

```
Cíl: Ověřit HTLC lock/claim/refund na Base mainnet

Kroky (CLI):
cd L2/contracts
npx hardhat console --network base

> const swap = await ethers.getContractAt("ZIONAtomicSwap", "0x3DE9Ad42716854083ab837706E3961d10B0e63Eb")
> // Ověř základní parametry
> await swap.paused()       // false
> await swap.feeBps()       // 0
> // Pro full test: lock ETH/wZION s hash → claim s preimage → verify

Očekávaný výsledek:
- Kontrakt odpovídá
- Lock/claim/refund funguje podle HTLC pravidel
```

### Test 5: DAO služba

```
Cíl: Ověřit DAO health a proposal flow

Kroky:
curl http://100.76.16.108:8450/api/dao/health

Očekávaný výsledek:
{"data":{"service":"zion-dao","status":"ok",...}}   ✅ (ověřeno)
```

### Test 6: Celý Solidity test suite

```
Cíl: Regresní testy všech kontraktů

Kroky:
cd L2/contracts
npx hardhat test

Očekávaný výsledek:
132 passing   ✅ (ověřeno)
```

### Test 7: Verifikace kontraktů na BaseScan — ✅ HOTOVO

```
Stav: DOKONČENO 1. dubna 2026

Všechny 3 kontrakty úspěšně ověřeny na BaseScan (Etherscan V2 API):
- wZION:          https://basescan.org/address/0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6#code
- ZIONBridge:     https://basescan.org/address/0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721#code
- ZIONAtomicSwap: https://basescan.org/address/0x3DE9Ad42716854083ab837706E3961d10B0e63Eb#code

Skript: L2/contracts/scripts/verify-base-mainnet-basescan.ts
Config: hardhat.config.ts (Etherscan V2 single apiKey)
```

---

## ČÁST 4: NÁVOD PRO NOVÉ UŽIVATELE

### Jak přidat wZION do MetaMasku

1. **Otevři MetaMask** v prohlížeči nebo na mobilu

2. **Přidej Base síť** (pokud nemáš):
   - Nahoře klikni na název sítě → "Add network"
   - Network Name: `Base`
   - RPC URL: `https://mainnet.base.org`
   - Chain ID: `8453`
   - Symbol: `ETH`
   - Explorer: `https://basescan.org`

3. **Přidej wZION token**:
   - V MetaMasku klikni "Import tokens"
   - Token Contract Address: `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6`
   - Token Symbol: `wZION` (vyplní se automaticky)
   - Decimals: `18` (vyplní se automaticky)
   - "Add Custom Token" → "Import Tokens"

4. **Hotovo** — wZION se zobrazí v seznamu tokenů (balance = 0, protože bridge ještě není aktivní)

### Jak získat ETH na Base (pro gas)

Potřebuješ ETH na Base síti pro poplatky za transakce. Stačí zlomky centu.

**Způsob 1 — Z Coinbase:**
- Coinbase → Send → vyber ETH → Network: Base → tvoje adresa

**Způsob 2 — Z Etherea přes bridge:**
- Jdi na https://bridge.base.org
- Připoj MetaMask (Ethereum mainnet)
- Pošli ETH → Base
- Počkej ~10 minut

**Způsob 3 — Z exchange přes Base:**
- Binance, Kraken atd. podporují výběr přímo na Base

### Jak bude fungovat bridge (po aktivaci)

> ⚠️ Bridge ZATÍM NENÍ AKTIVNÍ — čeká na dokončení L1.

1. Otevřeš bridge webovou stránku (připravujeme)
2. Připojíš MetaMask
3. Zadáš kolik ZION chceš převést
4. Pošleš ZION na vault adresu na L1
5. Bridge automaticky vytvoří wZION na Base
6. wZION se objeví v MetaMasku

### Jak bude fungovat swap (po aktivaci)

1. Otevřeš swap stránku
2. Vyběreš: ZION ↔ ETH (nebo jiná měna)
3. Systém zamkne obě strany v escrow
4. Buď proběhne výměna celá, nebo se vrátí oběma

---

## ČÁST 5: PRIORITNÍ POŘADÍ DALŠÍCH KROKŮ

```
HOTOVO ✅:
├── [1] BaseScan verifikace kontraktů ✅ (všechny 3 verified)
├── [2] Přidat wZION do MetaMasku a ověřit zobrazení ✅
├── [3] Spustit verify-base-mainnet.ts ✅
├── [4] Pool payout pipeline ✅ (Phase 18 — payout_execution=enabled)
└── [5] Humanitarian tithe ✅ (89/5/5/1 verified on-chain)

DALŠÍ KROK (blokéry bridge):
├── [6] Vytvořit reálnou bridge vault adresu na L1
├── [7] Kryptografická validace validator proofů v submitBridgeUnlock
├── [8] Test: poslat první ZION transakci na L1 (wallet/CLI)
└── [9] Přepnout bridge relay na mainnet config (bridge-mainnet.toml enabled=true)

PO AKTIVACI BRIDGE:
├── [10] E2E test: ZION → wZION → zpět
├── [11] Bridge UI na webu
└── [12] Uniswap likvidita (wZION/ETH pool)

PRODUKČNÍ HARDENING:
├── [13] Zvýšit bridge threshold na 3-of-5
├── [14] Opravit kritické .unwrap() v prod kódu
├── [15] Monitoring a alerting pro L2 služby
└── [16] Multi-chain deploy (Arbitrum)
```

---

## Kontrolní příkaz — ověř vše najednou

```bash
# Ze svého počítače (lokálně):
cd L2/contracts && npx hardhat run scripts/check-live-contracts.js --network base

# Rust testy (260 testů):
cd V3 && cargo test -p zion-bridge -p zion-atomic-swap -p zion-dao

# Solidity testy (132 testů):
cd L2/contracts && npx hardhat test

# L1 core + pool testy:
cd V3/L1 && cargo test -p zion-core -p zion-pool

# Server L2 health:
curl -s http://100.76.16.108:8081/api/dao/health | python3 -m json.tool
```
