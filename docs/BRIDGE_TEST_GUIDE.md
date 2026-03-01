# ZION Bridge — Testovací průvodce + mainnet plán

_Aktualizováno: 2. března 2026 | Síť: TestNet_

---

## 1. KAM POSLAT ZION (L1 → wZION test)

### Bridge escrow adresa (L1 příjemce):
```
zion1wn5nv4snxzjjlqb48z5zatungtvr4ruz6yjd4c5
```

### Memo (povinné — říká bridge kam mintovat wZION):
```
BRIDGE:base:0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186
```

> Formát: `BRIDGE:<chain>:<evm_adresa_příjemce>`  
> `base` = Base Sepolia testnet  
> EVM adresa = kam přijde wZION (tu lze změnit na libovolnou EVM adresu)

### Doporučená testovací částka:
```
100 ZION
```

---

## 2. POSTUP TESTU (desktop agent)

### Krok 1 — Odeslání z desktop agenta

Otevři záložku **Send** a vyplň:

| Pole    | Hodnota                                                    |
|---------|------------------------------------------------------------|
| To      | `zion1wn5nv4snxzjjlqb48z5zatungtvr4ruz6yjd4c5`            |
| Amount  | `100`                                                      |
| Memo    | `BRIDGE:base:0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186`  |

Stiskni **Send** → potvrď dialog.

### Krok 2 — Sleduj bridge logy (na serveru)

```bash
ssh helsinki 'docker logs -f zion-bridge'
```

**Očekávaná sekvence logů:**

```
🔒 L1 UTXO Lock detected: 100 ZION via sendTransaction — waiting 3 blocks
📤 Processing L1→EVM lock: 100 ZION → 0xdde17506... on base (TX: abc123...)
   Validator address: 0x8cc6F931edDAf5F14D0071727Ed1640752B5c787
   Calldata: 228 bytes — bridge: 0xF4BF85443ad6c9b88f3a5314cC3Fb59C32Cedca1
   Gas estimate: 85000 → limit with margin: 110500
   ✅ submitLockProof TX submitted! hash: 0x...
   🟢 submitLockProof CONFIRMED on Base Sepolia (TestNet)
```

### Krok 3 — Ověř wZION balance

Na [https://sepolia.basescan.org](https://sepolia.basescan.org) hledej adresu:
```
0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186
```

Nebo ověř přímo přes RPC:
```bash
curl -s https://base-sepolia.publicnode.com \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0","method":"eth_call","id":1,
    "params":[{
      "to":"0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6",
      "data":"0x70a08231000000000000000000000000dde17506BC2D2dCE1d594bD1D85B0BAbb389D186"
    },"latest"]
  }' | python3 -c "import sys,json; r=json.load(sys.stdin)['result']; print(int(r,16)/1e18, 'wZION')"
```

### Krok 4 — Ověř ZIONBridge stav (optional)

```bash
# Kolikrát byl submitLockProof zavolán pro tento L1 TX
node -e "
const {ethers} = require('ethers');
const p = new ethers.JsonRpcProvider('https://base-sepolia.publicnode.com');
const bridge = new ethers.Contract(
  '0xF4BF85443ad6c9b88f3a5314cC3Fb59C32Cedca1',
  ['function getLockProof(bytes32) view returns (uint8 votes, bool executed)'],
  p
);
// L1_TX_HASH sem dej hash z bridge logu
bridge.getLockProof('0xL1_TX_HASH_SEM').then(r => console.log('votes:', r.votes, 'executed:', r.executed));
"
```

---

## 3. AKTUÁLNÍ STAV TESTNET BRIDGE

| Komponenta            | Stav     | Detail                                                   |
|-----------------------|----------|----------------------------------------------------------|
| L1 core node          | ✅ Běží  | `http://77.42.31.72:8444`                                |
| Bridge relay          | ✅ Běží  | `zion-bridge:2.9.6-tx` na serveru                        |
| L1 UTXO scanning      | ✅ Hotovo | detekuje BRIDGE: memo v UTXO                             |
| submitLockProof TX    | ✅ Hotovo | EIP-1559, ABI encode, k256 podepisování                  |
| ZIONBridge kontrakt   | ✅ Deploy | `0xF4BF85443ad6c9b88f3a5314cC3Fb59C32Cedca1` Base Sep.  |
| wZION kontrakt        | ✅ Deploy | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` Base Sep.   |
| Threshold             | 1-of-2   | validator-1 (server) nebo deployer (lokálně)             |
| Finality              | 3 bloky  | rychlý test (~45s po transakci)                          |
| EVM watcher (burn)    | ⚠️ Ankr 403 | wZION→ZION směr nefunguje zatím (viz sekce 4)         |

### Adresy:

| Co                      | Adresa                                         |
|-------------------------|------------------------------------------------|
| L1 Bridge escrow        | `zion1wn5nv4snxzjjlqb48z5zatungtvr4ruz6yjd4c5`|
| Server validator (EVM)  | `0x8cc6F931edDAf5F14D0071727Ed1640752B5c787`   |
| Deployer (EVM)          | `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186`   |
| ZIONBridge (Base Sep.)  | `0xF4BF85443ad6c9b88f3a5314cC3Fb59C32Cedca1`   |
| wZION (Base Sep.)       | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6`    |

---

## 4. CO JEŠTĚ CHYBÍ PRO TESTNET (wZION → ZION směr)

### 4.1 EVM Watcher — Ankr 403

Ankr free tier nepodporuje `base-sepolia` slug. EVM Watcher crashuje a nemonitoruje burn eventy.

**Řešení:** Nahradit Ankr přímým public RPC (již máme `https://base-sepolia.publicnode.com`).

```toml
# bridge.toml — nahradit wss:// na https://
rpc_url = "https://base-sepolia.publicnode.com"
```

Kód v `evm_watcher.rs` používá WebSocket klienta — potřebuje refactor na HTTP polling (stejně jako jsme udělali v `evm_rpc.rs`).

**Pracnost:** ~2-3h

### 4.2 `handle_evm_burn` — L1 unlock endpoint

Burn handler volá `POST /api/bridge/unlock` na L1 node, ale tento endpoint na L1 core neexistuje.

**Chybí implementovat:**
- `L1/core/src/api/bridge.rs` — endpoint `/api/bridge/unlock`
- Zpracování: ověřit podpis, odeslat ZION z vault escrow na `l1_recipient`
- Vrátit `{"tx_hash": "...", "status": "submitted"}`

**Pracnost:** ~4-6h

### 4.3 Stratum pool — `handle_submit` bulk přijmutí

Stávající pool zatím odpovídá na share submit ale `shares_accepted` se nepremiuje zpět do bridge kontextu (nesouvisí s bridge, ale s miner UI).

---

## 5. PLÁN PRO MAINNET BRIDGE

### Fáze 1 — TestNet dokončení (odhad: ~1 týden)

| Úkol | Priorita | Pracnost |
|------|----------|----------|
| EVM Watcher: náhrada Ankr za HTTP polling | 🔴 blocker | 2-3h |
| L1 `/api/bridge/unlock` endpoint | 🔴 blocker | 4-6h |
| `handle_evm_burn` — confirm TX on EVM | 🟡 potřeba | 2-3h |
| End-to-end test: wZION → ZION | 🟡 potřeba | test |
| Desktop agent: "Bridge" záložka s historií | 🟢 nice | 1-2 dny |
| Memo validace na L1 node (striktní formát) | 🟢 nice | 2-4h |

### Fáze 2 — Audit & Security (odhad: 2-4 týdny)

| Úkol | Detail |
|------|--------|
| ZIONBridge.sol smart contract audit | Double-spending, replay attacks, access control |
| Zvýšit threshold na 2-of-3 | Přidat 3. validátor node |
| Timelock na velké withdrawaly | >1000 ZION = 24h delay |
| Rate limiting v bridge relay | Max N txů za hodinu na adresu |
| Key management | HSM nebo vault pro validator keys |
| Monitoring + alerting | PagerDuty/Telegram alert při stuck bridge |

### Fáze 3 — Mainnet příprava (odhad: 1-2 měsíce)

| Úkol | Detail |
|------|--------|
| Deploy ZIONBridge na Base Mainnet | Nový kontrakt, revoke testnet role |
| Deploy wZION na Base Mainnet | Nový token adresa |
| Multivalidator setup | Minimálně 3 nezávislé validátor nody |
| Alchemy/Infura klíče pro mainnet RPC | Spolehlivý EVM RPC endpoint |
| Likvidita bootstrap | Seed pool na Uniswap v3 Base |
| Bridge fee | 0.1% fee do treasury (ZIONTreasury.sol) |
| Frontend UI | Bridge widget na webu |
| Dokumentace pro uživatele | "Jak bridge ZION → wZION" |
| Emergency pause | `pause()` funkce v kontraktu pro incident response |

### Fáze 4 — Multi-chain rozšíření (po mainnetu)

| Chain | Stav | Priorita |
|-------|------|----------|
| Base Mainnet | 🔴 Fáze 3 | 1. |
| Arbitrum One | deploy kontrakt | 2. |
| BNB Chain | deploy kontrakt | 3. |
| Polygon PoS | deploy kontrakt | 4. |

---

## 6. RYCHLÉ PŘÍKAZY

```bash
# Bridge logy
ssh helsinki 'docker logs -f zion-bridge'

# Bridge status
ssh helsinki 'docker ps | grep bridge && curl -s http://77.42.31.72:9101/metrics | grep -E "bridge_|wzion_" | head -20'

# Restart bridge
ssh helsinki 'docker restart zion-bridge'

# Nastaví finality zpět na 60 po testování
ssh helsinki 'sed -i "s/finality_blocks     = 3.*/finality_blocks     = 60       # ~60 minutes/" /root/zion-bridge-data/bridge.toml && docker restart zion-bridge'

# Ověř ZIONBridge validators
node -e "
const {ethers} = require('ethers');
const p = new ethers.JsonRpcProvider('https://base-sepolia.publicnode.com');
const b = new ethers.Contract('0xF4BF85443ad6c9b88f3a5314cC3Fb59C32Cedca1',
  ['function validatorCount() view returns (uint256)','function threshold() view returns (uint256)'],p);
Promise.all([b.validatorCount(),b.threshold()]).then(([vc,th])=>console.log('validators:',vc.toString(),'threshold:',th.toString()));
"

# Check wZION balance
curl -s https://base-sepolia.publicnode.com -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"eth_call","id":1,"params":[{"to":"0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6","data":"0x70a08231000000000000000000000000dde17506BC2D2dCE1d594bD1D85B0BAbb389D186"},"latest"]}' \
  | python3 -c "import sys,json; r=json.load(sys.stdin)['result']; print(int(r,16)/1e18, 'wZION')"
```

---

## 7. TROUBLESHOOTING

### "L1: failed to fetch block: missing field `block`"

L1 REST API vrací jiný formát než bridge čeká. Bridge zatím skenuje UTXO přes `/api/address/{addr}/utxos` (ne blokový endpoint) — upozornění je neblokující.

### "Ankr/base-sepolia HTTP 403"

EVM Watcher pro wZION→ZION směr. Neblokuje ZION→wZION. Opravit viz sekce 4.1.

### "submitLockProof TX submitted" ale wZION nedorazí

1. Zkontroluj TX na [sepolia.basescan.org](https://sepolia.basescan.org)
2. Pokud REVERTED — pravděpodobně: lock proof již existuje, špatný gas, nebo recipient = zero address
3. Zkontroluj ABI encode: log zobrazuje `Calldata: N bytes`

### Bridge relay nedetekuje UTXO

- Ověř memo formát: musí být přesně `BRIDGE:base:0x...`
- Ověř bridge adresu v `bridge.toml` i v transakci
- Ověř že L1 node vrací UTXO: `curl http://77.42.31.72:8444/api/address/zion1wn5nv4snxzjjlqb48z5zatungtvr4ruz6yjd4c5/utxos`
