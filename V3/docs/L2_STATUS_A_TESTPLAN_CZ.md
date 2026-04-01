# L2 — Co chybí, testovací plán a návod pro nové uživatele

> Stav k 1. dubnu 2026 — po deployi kontraktů na Base mainnet

---

## ČÁST 1: Co je HOTOVÉ

### Kontrakty na Base Mainnet (chain 8453)

| Kontrakt | Adresa | Stav |
|----------|--------|------|
| wZION (ERC-20) | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | ✅ Live, supply=0, mintable=144B |
| ZIONBridge | `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` | ✅ Live, threshold=1, not paused |
| ZIONAtomicSwap | `0x3DE9Ad42716854083ab837706E3961d10B0e63Eb` | ✅ Live, fee=0bps, not paused |

### Služby na serveru (Prague)

| Služba | Kontejner | Stav |
|--------|-----------|------|
| Bridge relay | zion-v3-bridge | ✅ Běží (Base Sepolia testnet režim) |
| Atomic Swap | zion-v3-swap | ✅ Běží |
| DAO | zion-v3-dao | ✅ Běží |

### Testy

| Oblast | Počet testů | Stav |
|--------|-------------|------|
| Solidity kontrakty | 132 | ✅ Všechny prochází |
| Bridge (Rust) | 47+16=63 | ✅ Všechny prochází |
| Atomic Swap (Rust) | 18 | ✅ Všechny prochází |
| DAO (Rust) | 25 | ✅ Všechny prochází |

---

## ČÁST 2: Co ještě CHYBÍ

### 🔴 Blokéry — musí být hotové před ostrým provozem

| # | Co chybí | Proč to blokuje | Kde opravit |
|---|----------|-----------------|-------------|
| 1 | **L1 pool payout nefunguje** | `missing ZION_POOL_PAYOUT_SK_HEX` — nikdo nedostává ZION z těžby | Nastavit payout klíč na serveru |
| 2 | **Bridge vault adresa je placeholder** | `zion1bridge0...vault` — není reálná adresa na L1 | Vytvořit reálnou vault adresu v L1 core |
| 3 | **Bridge relay jede proti testnetu** | Config ukazuje na Base Sepolia, ne mainnet | Přepnout `ZION_BRIDGE_CONFIG` na `bridge-mainnet.toml` |
| 4 | **bridge-mainnet.toml má `enabled=false`** | Bridge mainnet chain je vypnutý | Zapnout až po testování |
| 5 | **Žádný wallet/explorer pro L1** | Uživatel nemá jak poslat ZION na vault | Potřeba webový wallet nebo CLI nástroj |
| 6 | **BaseScan verifikace kontraktů** | Kód není veřejně čitelný | Potřeba `BASESCAN_API_KEY` |

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
- Bridge relay běží na Prague (✅ ano)
- wZION na Base Sepolia existuje (✅ ano)

Kroky:
1. Pošli ZION na vault adresu na L1 s memo "BRIDGE:base_sepolia:0xTVOJE_ADRESA"
2. Sleduj logy: ssh root@91.98.122.165 docker logs -f zion-v3-bridge
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
- Všechny testy projdou (✅ ověřeno — 63 testů prochází)
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
curl http://91.98.122.165:8081/api/dao/health

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

### Test 7: Verifikace kontraktů na BaseScan

```
Cíl: Kontrakty budou veřejně čitelné

Kroky:
1. Zaregistruj se na basescan.org → API Keys → Create
2. Nastav: export BASESCAN_API_KEY=tvuj_key
3. Spusť:
   cd L2/contracts
   npx hardhat verify --network base 0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6 \
     "0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186" \
     "0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186" \
     "0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186"
   
   # Bridge (5 args):
   npx hardhat verify --network base 0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721 \
     "0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186" \
     "0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186" \
     "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6" \
     '["0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186","0x8cc6F931edDAf5F14D0071727Ed1640752B5c787"]' \
     1
   
   # Swap (2 args):
   npx hardhat verify --network base 0x3DE9Ad42716854083ab837706E3961d10B0e63Eb \
     "0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186" \
     "0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186"

Očekávaný výsledek:
- "Successfully verified" pro každý kontrakt
- Na BaseScan je vidět zdrojový kód se zelenou fajfkou ✅
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
OKAMŽITĚ (dnes):
├── [1] BaseScan verifikace kontraktů (potřeba API key)
├── [2] Přidat wZION do MetaMasku a ověřit zobrazení
└── [3] Spustit verify-base-mainnet.ts ✅ (hotovo)

TENTO TÝDEN:
├── [4] Nastavit ZION_POOL_PAYOUT_SK_HEX na serveru → mining payouty fungují
├── [5] Vytvořit reálnou bridge vault adresu na L1
├── [6] Test: poslat první ZION transakci na L1
└── [7] BaseScan verification (po získání API key)

PO FUNKČNÍM L1:
├── [8] Přepnout bridge relay na mainnet config
├── [9] E2E test: ZION → wZION → zpět
├── [10] Bridge UI na webu
└── [11] Uniswap likvidita (wZION/ETH pool)

PRODUKČNÍ HARDENING:
├── [12] Zvýšit bridge threshold na 3-of-5
├── [13] Opravit kritické .unwrap() v prod kódu
├── [14] Monitoring a alerting pro L2 služby
└── [15] Multi-chain deploy (Arbitrum)
```

---

## Kontrolní příkaz — ověř vše najednou

```bash
# Ze svého počítače (lokálně):
cd L2/contracts && npx hardhat run scripts/verify-base-mainnet.ts --network base

# Rust testy:
cd V3 && cargo test -p zion-bridge -p zion-atomic-swap -p zion-dao

# Solidity testy:
cd L2/contracts && npx hardhat test

# Server L2 health:
curl -s http://91.98.122.165:8081/api/dao/health | python3 -m json.tool
```
