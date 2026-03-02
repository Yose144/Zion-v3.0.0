# ZION Bridge — Testovací průvodce + mainnet plán

_Aktualizováno: 2. března 2026 | Síť: TestNet_

> **✅ FIRST SUCCESSFUL E2E TEST: 2. března 2026**  
> 500 ZION → 500 wZION mintováno na Base Sepolia.  
> TX: [`0xc5b72ba9...a59e7f`](https://sepolia.basescan.org/tx/0xc5b72ba9afcf43f53488d8db8b3bf3e874cc12f3507e60fbc253777861a59e7f) · Block 38333860 · Status: **SUCCESS**
>
> **✅ BRIDGE AUTOMATION: 2. března 2026** (commit `d18906e`)  
> Desktop Agent „Bridge" záložka plně automatická — žádný ruční copy/paste.

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

> **⚡ Nyní plně automatické** — záložka **Bridge** v Desktop Agentu provede celý flow sám.

### ZION → wZION (automaticky)

1. Otevři záložku **Bridge** v Desktop Agentu
2. EVM adresa se načte automaticky z `evmAddress` uloženého v peněžence  
   _(při prvním otevření po aktualizaci vyžaduje heslo pro odvození EVM klíče)_
3. Zůstaň na směru **ZION → wZION**
4. Zadej částku (min. 100 ZION)
5. Klikni **Generate memo** — zobrazí se vault adresa + memo
6. Klikni **▶ Send Now** → potvrzovací dialog → TX odeslán automaticky
7. wZION dorazí do ~1 minuty

### wZION → ZION (automaticky — ⚠️ zatím blokováno vault klíčem)

1. Klikni na **wZION → ZION**
2. Zadej množství wZION + svou L1 adresu (`zion1...`)
3. Klikni **🔥 Burn wZION** → potvrzovací dialog → EVM TX podepsán + odeslán
4. ZION přijde na L1 po potvrzení relay

> ⚠️ Krok 4 selže dokud není opraven vault klíč mismatch (viz sekce 4.1).

---

### Manuální odeslání (záložka Send — fallback)

| Pole    | Hodnota                                                    |
|---------|------------------------------------------------------------|
| To      | `zion1wn5nv4snxzjjlqb48z5zatungtvr4ruz6yjd4c5`            |
| Amount  | `100`                                                      |
| Memo    | `BRIDGE:base:0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186`  |

### Krok 2 — Sleduj bridge logy (na serveru)

```bash
ssh helsinki 'docker logs -f zion-bridge'
```

**Očekávaná sekvence logů:**

```
🔒 L1 UTXO Lock detected: 100 ZION via sendTransaction — finalizing immediately
✅ L1 Lock finalized: 100 ZION from sendTransaction → 0xdde17506... (TX: utxo:...)
📤 Processing L1→EVM lock: 100 ZION → 0xdde17506... on base (TX: utxo:...)
   Validator address: 0x8cc6F931edDAf5F14D0071727Ed1640752B5c787
   Calldata: 228 bytes — bridge: 0xF4BF85443ad6c9b88f3a5314cC3Fb59C32Cedca1
   Gas estimate: 85000 → limit with margin: 110500
   ✅ submitLockProof TX submitted! hash: 0x...
```

> **Poznámka:** `sendTransaction` zapisuje UTXO přímo do LMDB bez těžby bloku.  
> Bridge proto finalizuje lock okamžitě (l1_block_height=0 ≤ libovolný finalized_height).

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
| L1 core node          | ✅ Běží  | `http://77.42.31.72:8444` (`zion-core:2.9.6-fix3`)       |
| Bridge relay          | ✅ Běží  | `zion-bridge:2.9.6-fix4` — HTTP polling, bez Ankr        |
| L1 UTXO scanning      | ✅ Hotovo | poll_cycle skenuje UTXO každý cyklus (i bez nových bloků)|
| submitLockProof TX    | ✅ **OVĚŘENO** | E2E test 2.3.2026 — 700 ZION → 700 wZION celkem  |
| ZIONBridge kontrakt   | ✅ Deploy | `0xF4BF85443ad6c9b88f3a5314cC3Fb59C32Cedca1` Base Sep.  |
| wZION kontrakt        | ✅ Deploy | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` Base Sep.   |
| EVM Watcher (burn)    | ✅ Opraveno | HTTP polling přes `publicnode.com` (fix4, commit `265a455`)|
| Desktop Agent Bridge  | ✅ **Automatické** | Send Now + Burn wZION (commit `d18906e`)         |
| Threshold             | 1-of-2   | validator-1 (server) nebo deployer (lokálně)             |
| Finality              | okamžitá | sendTransaction UTXOs: l1_block_height=0, finalizuje ihned|
| wZION→ZION unlock     | ⚠️ Vault klíč | `vault.key` derivuje jinou adresu než drží UTXOs — viz 4.1|

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

### 4.1 Vault klíč mismatch — BLOCKER pro wZION→ZION

`vault.key` na serveru (`272b825e...`) derivuje adresu `zion1s6y6h7k6l033f2n7e0y0r8t6a8h474t0x5398d0`  
Ale 700 ZION UTXOs leží na `zion1wn5nv4snxzjjlqb48z5zatungtvr4ruz6yjd4c5`.

Bridge proto při unlock fázi nemá klíč k UTXOs → vrátí `Insufficient vault balance: have 0`.

**Řešení A (doporučeno):** Najít původní private key peněženky `zion1wn5nv4snx...` a nastavit jej jako `ZION_BRIDGE_VAULT_KEY` v docker-compose.

**Řešení B:** Vygenerovat novou adresu z aktuálního `vault.key`, nastavit tuto adresu jako `bridge_address` v `bridge.toml`, a posílat ZION na ni.

**Pracnost:** ~30 min

### 4.2 EVM Watcher ✅ (opraveno v fix4, commit `265a455`)

HTTP polling přes `https://base-sepolia.publicnode.com` — Ankr 403 vyřešen.

### 4.3 L1 `/api/bridge/unlock` endpoint ✅ (implementováno v fix3)

### 4.3 Stratum pool — `handle_submit` bulk přijmutí

Stávající pool zatím odpovídá na share submit ale `shares_accepted` se nepremiuje zpět do bridge kontextu (nesouvisí s bridge, ale s miner UI).

---

## 5. PLÁN PRO MAINNET BRIDGE

### Fáze 1 — TestNet dokončení

| Úkol | Priorita | Stav |
|------|----------|------|
| EVM Watcher: náhrada Ankr za HTTP polling | 🔴 blocker | ✅ Hotovo (fix4) |
| L1 `/api/bridge/unlock` endpoint | 🔴 blocker | ✅ Hotovo (fix3) |
| Vault klíč mismatch — opravit key pro `zion1wn5nv4snx...` | 🔴 blocker | ⚠️ Zbývá |
| End-to-end test: wZION → ZION | 🟡 potřeba | ⏳ Blokováno vault klíčem |
| Desktop agent: „Bridge" záložka automatická | 🟢 done | ✅ Hotovo (d18906e) |
| web2.9: Bridge widget (Next.js) | 🟢 nice | ⏳ Zbývá |
| Memo validace na L1 node (striktní formát) | 🟢 nice | ⏳ 2-4h |

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

## 8. VÝSLEDKY PRVNÍHO E2E TESTU (2. března 2026)

### Transakce

| Pole | Hodnota |
|------|---------|
| L1 TX | `dfd0596c899498895dbf6c781d6026ad142e85985a98798bc41dd2f1a9c8c132` |
| Odesílatel | `zion1gfhhxm5hg87cflh6vuyazfklp3c6agx0gfhhxm5` |
| Bridge escrow | `zion1wn5nv4snxzjjlqb48z5zatungtvr4ruz6yjd4c5` |
| Memo | `BRIDGE:base:0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186` |
| Částka | 500 ZION (500,000,000 atomů) |

### submitLockProof na Base Sepolia

| Pole | Hodnota |
|------|---------|
| EVM TX | [`0xc5b72ba9...a59e7f`](https://sepolia.basescan.org/tx/0xc5b72ba9afcf43f53488d8db8b3bf3e874cc12f3507e60fbc253777861a59e7f) |
| Block | 38 333 860 |
| Status | ✅ SUCCESS |
| Gas použitý | 323 014 |
| Logs (events) | 4 |

### Výsledek

```
wZION balance 0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186 = 500.0 wZION ✅
```

### Opravené bugy v rámci testu

| Bug | Příčina | Fix (commit) |
|-----|---------|--------------|
| Memo pole mimo obrazovku | CSS layout — Purpose nad Memo | `ee37893` |
| Address validator odmítal `b` v zion1 adrese | Bech32 charset bez `b` | `baa3876` |
| Bridge nedetekoval UTXO bez nových bloků | `poll_cycle()` brzy vracel, přeskakoval scan | `a5f1bff` |
| sendTransaction UTXO nikdy nefinalizovalo | `l1_block_height=current` ≤ `current-3` = false | `a5f1bff` |
| chain_id neshoda (`base-sepolia` vs `base`) | Relayer matchuje přesně dle `chain_id` v config | `5eec8d6` |

---

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
