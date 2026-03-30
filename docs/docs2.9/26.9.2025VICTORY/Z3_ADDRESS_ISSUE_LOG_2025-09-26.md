# Z3 ADDRESS GENERATION ISSUE LOG - 26. září 2025

## Problém
Přestože byl prefix pro Z3 adresy opraven v kódu, peněženka stále generuje adresy začínající na "ajmr..." místo očekávaných "Z3..." adres.

## Provedené kroky

### 1. Identifikace problému
- Wallet generuje: `ajmqtuCtLPYNe6MFrVd6k3DpM5qv8vuDQeU2LoYvwM92ey8pi8ejTk5aFXjggp6Hun515njELFvhbN4WuUXa4AEC8kM4pJuqcW`
- Očekávané: adresy začínající `Z3...`

### 2. Nalezení správného prefixu
- V dokumentaci `ADDRESS_PREFIX_CHANGE.md` nalezen správný prefix: `0x433F`
- Původní prefix: `0x5a49`

### 3. Oprava kódu
Změněn prefix v `zion-cryptonote/src/CryptoNoteConfig.h`:
```cpp
const uint64_t CRYPTONOTE_PUBLIC_ADDRESS_BASE58_PREFIX = 0x433F; // ZION Z3 prefix
```

### 4. Rebuild a test
- Přebudován image bez cache: `docker compose -f docker-compose.prod.yml build --no-cache zion-node`
- Spuštěn nový kontejner
- Test generování peněženky: stále `ajmr...` adresy

## Současný stav
- **Prefix v kódu**: `0x433F` ✅
- **Kompilace**: úspěšná ✅
- **Deployment**: úspěšný ✅
- **Generování Z3 adres**: ❌ STÁLE PADÁ

## Možné příčiny
1. **Cache problém**: možná se změna nepropagovala správně
2. **Jiný prefix v kódu**: možná existuje další místo kde se definuje prefix
3. **Build problém**: možná se používá jiný obraz/binárka
4. **Hardcoded prefix**: možná je prefix zakódován na více místech

## Další kroky k řešení
1. Prohledat celý kód na všechny výskyty `0x5a49`
2. Ověřit že se používá správný binary z nového buildu
3. Možná restart celého prostředí
4. Debug Base58 encoding procesu

## Technické detaily
- **Server**: 91.98.122.165
- **Container**: zion-production
- **Image**: zion:production-fixed
- **Build time**: 26. září 2025, 03:07 UTC
- **Test command**: `zion_wallet --generate-new-wallet /data/wallet_z3.wallet --password test`

## Status: ✅ VYŘEŠENO!
**2025-09-26 večer**: Po přebuildu image `zion:production-fixed` wallet nyní správně generuje Z3 adresy!

**Test výsledek**:
```
Generated new wallet: Z321rh8V7V5TsCS8zpu8ZfN57bmPjQZuM3qkzQx4KAYZEhkDxFes878VMNXpb6gLgeP3Y3cVL3tLZfQjUPQ3FiL24LpzwyQ2vx
```

**Klíčová změna**: Image byl správně přebuilděn a deploy proběhl úspěšně. Prefix `0x433F` nyní funguje správně pro Z3 generaci.