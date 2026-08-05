# ZION Gen Z Inheritance — Komplexní dokumentace

> **Verze:** 1.0 — 2026-07-03
> **Autor:** Yose / Zion Creator
> **Pro:** Maitreya Buddha, Sarah Issobela, Elizabeth — a všechny budoucí generace
> **Status:** ŽIVOTNÍ DOKUMENT — aktualizovat při každé změně governance

---

## Slovo tvůrce

Děti moje,

Tento dokument je můj dar vám. ZION není projekt, korporace, ani investice. ZION je **dědictví** — most mezi minulostí a budoucností, mezi světem, který jsem znal, a světem, který vy vytvoříte.

Píšu to v čase, kdy je ZION mladé a křehké. Bylo napadeno, kompromitováno, ale přežilo. Protože jeho smysl je větší než já, větší než útočníky, větší než jakoukoliv generaci.

**Maitreya Buddha** — první syn, dědic Ramy. Tvé jméno je z buddhismu, kde Maitreya je Buddha budoucnosti, ten který přijde, když svět zapomene cestu. Ty jsi ta cesta.

**Sarah Issobela** — dcera, dědička Sity. Tvé jméno nosí Issobella — patronka ZIONu od začátku. Sarah znamená "princezna". Ty jsi princezna ZIONu.

**Elizabeth** — ještě nenarozená, patronka celého ZIONu. Ave Maria. Tvé jméno znamená "Bůh je má přísaha". Ať už se narodíš kdykoliv, tvé místo je rezervováno. Hanuman ti předá svůj klíč.

Tento dokument vás naučí:
1. Co ZION je a proč existuje
2. Jak funguje (technicky)
3. Co jste zdědili (klíče, práva, odpovědnosti)
4. Jak převzít správu (krok za krokem)
5. Jak předat dalším generacím

Čtěte pomalu. Není spěch. ZION počká.

— Yose, váš otec

---

## 1. Co je ZION

### 1.1 Filozofie

ZION je **decentralizovaná měnová síť** postavená na třech pilířích:

1. **Svoboda** — nikdo nemůže zmrazit váš účet, zvrátit transakci, nebo cenzurovat platbu
2. **Humanita** — 5% každého bloku jde na humanitární účely (Children Future Fund)
3. **Dědictví** — vlastnictví se přenáší generacemi, ne korporacím

### 1.2 Technologie

ZION je **Layer 1 blockchain** s:

- **Consensus:** Cosmic Harmony PoW (deeksha_lite_v1 algoritmus)
- **Block time:** 60 sekund
- **Max supply:** 144 miliard ZION
- **Premine:** 16.78 miliard ZION (11.65%) — rozděleno na 14 slotů
- **Fee split:** 89% miner / 5% humanitarian / 5% issobella / 1% burn (pool fee)
- **Accounts:** Hybrid model — account-based (ZION) + UTXO (bridge vault)
- **Cryptography:** Ed25519 (L1) + secp256k1 (EVM bridge)
- **Bridge:** wZION na 6 EVM chainech (Base, Arbitrum, BSC, Polygon, Optimism, Avalanche)

### 1.3 Vrstvy

| Vrstva | Co dělá | Adresář v repo |
|--------|---------|----------------|
| **L1** | Core blockchain — node, pool, miner, consensus | `V3/L1/` |
| **L2** | Bridge (EVM), DAO (governance), Atomic Swap (HTLC) | `V3/L2/` |
| **L3** | WARP (cross-chain relay) | `V3/L3/` |
| **L4** | AI (Hiran) — inference layer | `HiranV2.2/` |
| **L5** | Communities (genesis garden, OASIS) | `V3/L5/` |
| **L6** | Apps (website, mobile, desktop) | `APP&WEB/` |

---

## 2. Co jste zdědili

### 2.1 Admin role

Každý z vás zdědí jednu admin roli:

| Dítě | Role | Předchůdce | Klíč |
|------|------|------------|------|
| **Maitreya Buddha** | Admin-1 (Protocol governance) | Rama | Ed25519 + EVM |
| **Sarah Issobela** | Admin-2 (Treasury oversight) | Sita | Ed25519 + EVM |
| **Elizabeth** | Admin-3 (Bridge admin, Patronka) | Hanuman | Ed25519 + EVM |

### 2.2 Co admin klíče umožňují

**Můžete:**
- Emergency pause chain (2-of-3 adminů, okamžitě)
- Změnit parametry sítě — difficulty, fees (3-of-3, 72h time-lock)
- Odomknout DAO treasury (3-of-3 + DAO vote, 7d time-lock)
- Rotovat admin klíče (3-of-3 + DAO vote, 30d time-lock)
- Rotovat bridge validátory (2-of-3, 7d time-lock)
- Rotovat pool payout klíč (2-of-3, 7d time-lock)

**NEMŮŽETE:**
- Mintovat ZION (žádný admin nemá mint právo)
- Změnit premine allocations (frozen v genesis blocku)
- Změnit fee split 89/5/5/1 (v kódu, ne admin-controllable)
- Převést vlastnictví bez DAO schválení
- Bypassovat time-locks

### 2.3 Co nemůžete ztratit

**Premine (16.78B ZION)** je v genesis blocku. Adresy jsou frozen. I když ztratíte všechny admin klíče, premine zůstává na svých adresách. Nikdo nemůže pohnout s premine bez soukromých klíčů těchto adres.

**DAO Treasury (4B ZION)** je locked do height 144,000 (~100 dní). I když admini zmizí, treasury se neodemkne bez DAO governance.

**Bridge Vault (100M ZION UTXO)** je keyless — odemyká se bridge konsenzem (validator signatures), ne admin klíči.

### 2.4 Co můžete ztratit (pozor!)

- **Admin klíče** — pokud ztratíte Ed25519 SK, ztratíte admin práva. Ale DAO může rotovat na nového admina.
- **Pool payout SK** — pokud ztratíte, pool nemůže vyplácet minerům. Ale dá se rotovat.
- **Bridge validator SK** — pokud ztratíte, bridge nemůže potvrzovat. Ale dá se rotovat.

**Pravidlo:** Vždy mějte offline backup (paper + metal plate). Nikdy nedržte všechny klíče na jednom místě.

---

## 3. Jak funguje governance

### 3.1 Tři fáze governance

| Fáze | Kdy | Kdo vládne |
|------|-----|------------|
| **Fáze 1: Bootstrap** | T0 → T0+6 měsíců | Yose (sole admin) |
| **Fáze 2: Admin rule** | T0+6m → T0+12m | 3 Adminové (Rama, Sita, Hanuman) |
| **Fáze 3: DAO governance** | T0+12m → T0+18 let | DAO + Adminové (guardians) |
| **Fáze 4: Gen Z převod** | T0+18 let | Maitreya Buddha, Sarah Issobela, Elizabeth |
| **Fáze 5: Plné vlastnictví** | T0+21 let | Gen Z + DAO (supreme) |

### 3.2 DAO (Decentralized Autonomous Organization)

DAO je komunitní governance. Držitelé ZION hlasují o návrzích.

**Parametry:**
- 1 ZION = 1 hlas
- Quorum: 15% z circulating supply
- Voting period: 14 dní
- Timelock: 72h (normální), 7d (treasury), 30d (admin rotation), 90d (hard fork)

**Typy návrhů:**
- `PARAMETER_CHANGE` — změna parametrů sítě
- `TREASURY_SPEND` — výdaj z DAO treasury
- `ADMIN_ROTATION` — výměna admin klíče
- `EMERGENCY_PAUSE` — emergency pause chain
- `ADMIN_INHERITANCE` — převod na Gen Z (speciální, 1 rok time-lock)
- `HARD_FORK` — změna genesis (supermajority 75%)

### 3.3 Guardian set

Guardians jsou DAO výkonný orgán. Schvalují treasury operace po hlasování.

**Složení:**
- 3 Adminové (Rama/Sita/Hanuman → Maitreya/Sarah/Elizabeth)
- 4 další guardians (jmenováni DAO)
- Threshold: 5-of-7 pro treasury operace
- Threshold: 3-of-7 pro admin operace (jen adminové)

---

## 4. Jak převzít správu (krok za krokem)

### 4.1 Kdy jste připraveni

Převod se neprovádí automaticky. Musíte:
1. Být **18+ let** (nebo mít souhlas rodičů)
2. Porozumět tomuto dokumentu
3. Mít **offline klíče** (vygenerované při narození nebo později)
4. Mít **DAO schválení** (ADMIN_INHERITANCE proposal)

### 4.2 Proces převodu

```
Krok 1: Yose (nebo stávající admin) navrhne ADMIN_INHERITANCE v DAO
         ↓
Krok 2: DAO hlasuje (14 dní, quorum 15%)
         ↓
Krok 3: Time-lock 1 rok (nelze zrychlit)
         ↓
Krok 4: Během time-locku — dítě vygeneruje nové klíče (offline)
         ↓
Krok 5: Po time-locku — admin_rotation TX (3-of-3 starých adminů podepíše)
         ↓
Krok 6: Nový admin je aktivní, starý admin odebrán
         ↓
Krok 7: Update dokumentace (tento dokument)
```

### 4.3 Elizabeth — speciální případ

Elizabeth je ještě nenarozená. Její admin slot je **rezervován**:

- Hanuman zůstává Admin-3 dokud se Elizabeth nenarodí
- Při narození: Yose (nebo DAO) navrhne `ADMIN_INHERITANCE` pro Elizabeth
- Klíč se vygeneruje **až když Elizabeth dosáhne 18 let** (nebo dříve se souhlasem)
- Do té doby: Hanuman nebo jmenovaný regent spravuje Admin-3 slot

### 4.4 Dead man's switch

Pokud admin neudělá žádnou transakci po dobu **5 let**, automaticky se spustí převod:

```
Admin nedělá TX > 5 let
         ↓
DAO automaticky vytvoří ADMIN_INHERITANCE proposal
         ↓
Hlasování 14 dní
         ↓
Time-lock 1 rok
         ↓
Převod na nástupce (pokud je definován)
```

**Účel:** Pokud admin zmizí, zemře, nebo ztratí klíče, ZION nepřestane fungovat.

---

## 5. Klíče — technický manuál

### 5.1 Typy klíčů

| Typ | Algoritmus | Účel | Storage |
|------|-----------|------|---------|
| **Admin Ed25519** | Ed25519 | L1 governance, admin_rotation TX | Offline (paper + metal) |
| **Admin EVM** | secp256k1 | Bridge multisig, validator rotation | Offline (paper + metal) |
| **Premine Ed25519** | Ed25519 | Držení premine ZION | Offline (hardware wallet) |
| **Pool payout Ed25519** | Ed25519 | Podepisování miner payouts | Server (šifrované env) |
| **Bridge validator EVM** | secp256k1 | Potvrzování bridge TX | Server (šifrované) |
| **DAO guardian Ed25519** | Ed25519 | Schvalování treasury ops | Offline (paper + metal) |
| **Escrow Ed25519** | Ed25519 | Atomic swap escrow | Server (šifrované env) |

### 5.2 Generování klíčů (pro Gen Z)

Až budete připraveni převzít správu, vygenerujte si vlastní klíče:

**Ed25519 (L1):**
```bash
# NA AIR-GAPPED STROJI (Tails OS nebo offline PC)
cd zion-protocol
cargo run --release --bin gen-pool-payout-wallet
# → address, public_key_hex, secret_key_hex
```

**EVM (Bridge):**
```bash
# NA AIR-GAPPED STROJI
cast wallet new
# → address, private key
```

**Backup:**
1. Zapište na **paper** (ručně, ne tiskárna)
2. Vyryjte na **metal plate** (pro požár/voda)
3. Uložte na **hardware wallet** (Ledger/Trezor)
4. **Nikdy** nedávejte do počítače připojeného k internetu

### 5.3 Rotace klíčů

Když potřebujete vyměnit klíč (ztráta, kompromitace, preventivně):

```
1. Vygenerujte nový klíč (offline)
2. Navrhněte ADMIN_ROTATION v DAO
3. Počkejte 30 dní (time-lock)
4. 3-of-3 adminů podepíše admin_rotation TX
5. Nový klíč je aktivní
```

---

## 6. Emergency procedury

### 6.1 Chain pause

Pokud je chain napaden (jako F1/F5 incident 2026):

```
1. 2-of-3 adminů podepíše EMERGENCY_PAUSE TX
2. Chain se zastaví (žádné nové bloky)
3. DAO hlasuje o řešení
4. Po opravě: 2-of-3 adminů podepíše RESUME TX
```

### 6.2 Key compromise

Pokud admin klíč je kompromitován:

```
1. Okamžitě: navrhněte ADMIN_ROTATION v DAO
2. Počkejte 30 dní (time-lock)
3. Rotujte kompromitovaný klíč
4. Audit: zkontrolujte všechny TX z kompromitovaného klíče
```

### 6.3 Hard fork

Pokud je potřeba zásadní změna (genesis, algoritmus):

```
1. Navrhněte HARD_FORK v DAO (supermajority 75%)
2. Počkejte 90 dní (time-lock)
3. 3-of-3 adminů podepíše hard fork
4. Všechny nody se upgradují
5. Nový genesis block
```

---

## 7. Ekonomika ZION

### 7.1 Supply

| Kategorie | Množství | % z max |
|-----------|----------|---------|
| Max supply | 144,000,000,000 ZION | 100% |
| Premine | 16,780,000,000 ZION | 11.65% |
| Mining rewards | 127,220,000,000 ZION | 88.35% |

### 7.2 Premine rozdělení

| Slot | Kategorie | Částka | Účel |
|------|-----------|--------|------|
| 1-5 | OASIS + Golden Egg | 5 × 1.65B = 8.25B | Komunitní rewards, OASIS |
| 6 | DAO Treasury (main) | 2.5B | Community governance |
| 7 | DAO Treasury (grants) | 1.0B | Grants & bounties |
| 8 | DAO Treasury (ecosystem) | 0.5B | Ecosystem bootstrap |
| 9 | Core Development Fund | 1.0B | Vývoj protokolu |
| 10 | Network Infrastructure | 1.0B | P2P seed nodes |
| 11 | Genesis Projects Fund | 0.59B | Dharma Temple, Piko de Ora + DAO |
| 12 | Children Future Fund | 1.44B | Humanitarian DAO |
| 13 | Bridge Seed Fund | 0.4B | EVM bridge liquidity |
| 14 | Bridge Vault UTXO | 0.1B | Bridge unlock liquidity |

### 7.3 Fee split (každý blok)

```
Block subsidy
    ├── 89% → Miner (pool payout)
    ├── 5%  → Humanitarian (Children Future Fund)
    ├── 5%  → Issobella (patronka)
    └── 1%  → Burn (pool fee, deflationary)
```

**Tohle je v kódu. Nikdo, ani admini, nemůže změnit fee split.**

### 7.4 Emission schedule

Mining rewards klesají s časem. Detail v `V3/L1/core/src/emission.rs`.

---

## 8. Bridge (EVM)

### 8.1 Co bridge dělá

ZION Bridge propojuje L1 ZION s EVM chainy (Base, Arbitrum, BSC, Polygon, Optimism, Avalanche).

**Lock:** ZION L1 → wZION na EVM (1:1)
**Unlock:** wZION na EVM → ZION L1 (1:1)

### 8.2 Validator set

5 EVM validatorů potvrzují bridge transakce. Threshold: 3-of-5.

**Složení:**
- 3 Adminové (Rama, Sita, Hanuman → Gen Z)
- 2 operátoři (jmenováni adminy)

### 8.3 wZION

wZION je ERC-20 token na EVM chainech. 1 wZION = 1 ZION. Minting jen přes bridge (lock ZION L1 → mint wZION). Burning jen přes bridge (burn wZION → unlock ZION L1).

### 8.4 Kontrakty

| Chain | wZION | ZIONBridge |
|-------|-------|------------|
| Base | `0x...` | `0x...` |
| Arbitrum | `0x...` | `0x...` |
| BSC | `0x...` | `0x...` |
| Polygon | `0x...` | `0x...` |
| Optimism | `0x...` | `0x...` |
| Avalanche | `0x...` | `0x...` |

*Adresy se updatují po každém redeploy. Viz `V3/L2/bridge/config/bridge-mainnet.toml`.*

---

## 9. DAO Treasury

### 9.1 Adresy

3 treasury adresy (premine sloty 6, 7, 8):

| Slot | Adresa | Částka | Lock |
|------|--------|--------|------|
| 6 | `zion1...` | 2.5B ZION | Height 144,000 (~100 dní) |
| 7 | `zion1...` | 1.0B ZION | Height 144,000 |
| 8 | `zion1...` | 0.5B ZION | Height 144,000 |

*Adresy se updatují po hard resetu. Viz `V3/L2/dao/config/dao-mainnet.toml`.*

### 9.2 Výdaje

DAO hlasuje o výdajích. Po schválení:

1. Guardian multisig (5-of-7) podepíše TX
2. Time-lock 7 dní
3. ZION se přenese z treasury na cílovou adresu

**Daily spend limit:** 50M ZION (konzervativní start)

### 9.3 Guardiani

7 guardianů, 5-of-7 threshold:

1. Admin-1 (Rama → Maitreya Buddha)
2. Admin-2 (Sita → Sarah Issobela)
3. Admin-3 (Hanuman → Elizabeth)
4. Guardian-4 (jmenován DAO)
5. Guardian-5 (jmenován DAO)
6. Guardian-6 (jmenován DAO)
7. Guardian-7 (jmenován DAO)

---

## 10. Server infrastruktura

### 10.1 Topologie

```
                    Internet
                       │
                 ┌─────┴─────┐
                 │  Tailscale │
                 │  Mesh VPN  │
                 └─────┬─────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────┴────┐   ┌────┴────┐   ┌────┴────┐
   │ Edge N1 │   │ Edge N2 │   │  Local  │
   │ Primary │   │Follower │   │  Node   │
   │ 8333    │   │ 8334    │   │ 8333    │
   │ 8443    │   │ 8446    │   │ 8443    │
   └────┬────┘   └─────────┘   └─────────┘
        │
   ┌────┴────┐
   │  Pool   │
   │  8444   │
   └────┬────┘
        │
   ┌────┴────────────────────────┐
   │  L2/L3 services             │
   │  Bridge (9102)              │
   │  DAO (8450)                 │
   │  Atomic Swap (8452)         │
   │  WARP (8453)                │
   └─────────────────────────────┘
```

### 10.2 Porty

| Port | Služba | Bind |
|------|--------|------|
| 22 | SSH | Tailscale only |
| 8333 | P2P (node1) | 0.0.0.0 |
| 8334 | P2P (node2) | 127.0.0.1 |
| 8443 | RPC (node1) | 127.0.0.1 |
| 8444 | Pool | 127.0.0.1 |
| 8446 | RPC (node2) | 127.0.0.1 |
| 8450 | DAO API | 127.0.0.1 |
| 8452 | Atomic Swap API | 127.0.0.1 |
| 8453 | WARP | 127.0.0.1 |
| 8455 | Pool metrics | 127.0.0.1 |
| 9102 | Bridge metrics | 127.0.0.1 |

### 10.3 systemd služby

```
zion-edge-node1       (Primary / Genesis)
zion-edge-node2       (Follower)
zion-edge-pool        (Stratum pool)
zion-edge-bridge      (L2 Bridge)
zion-edge-dao         (L2 DAO)
zion-edge-atomic-swap (L2 Atomic Swap)
zion-edge-warp        (L3 WARP)
zion-edge-agent       (Rig lifecycle)
zion-edge-dashboard   (Infra dashboard)
zion-edge-watchdog    (Health monitor)
zion-edge-backup      (Daily backup 03:00)
```

---

## 11. Historie a incidenty

### 11.1 F1 Exploit (2026-06-30)

**Co se stalo:** Útočník z IP `109.81.30.165` zneužil `validate_peer_block()` — nevolalo `verify_signature()` pro account-model TX. Vyfalšoval 589M ZION z Genesis Projects walletu.

**Fix:** Height-gated signature verification. Chain rollback na block 22180.

**Lekce:** Vždy validovat signatury, i pro genesis TX.

### 11.2 F5 Bug (2026-07-02)

**Co se stalo:** Account model nevalidoval sender balance. TX z prázdné adresy vytvořila 100,002 ZION inflaci.

**Fix:** `balance_check_active(height)` gate + `account_balance_for()`, aktivováno na block 22394.

**Lekce:** Vždy kontrolovat balance před TX.

### 11.3 TeamViewer compromise (2026-07-03)

**Co se stalo:** Útočník (TeamViewer ID `708168736`) se 4× připojil na W11 PC (16.-23.6.), zkopíroval SSH klíče, hesla, credentials. Pak SSH'd 20× na Edge jako root (2.7., 47 min root access).

**Kompromitováno:** SSH klíče, pool payout SK, escrow key, W11 hesla, DAO guardian mnemonics, EVM deploy klíče, GitHub deploy key, ZION source code.

**Fix:** Hard reset (tento dokument). Kompletní rotace všech klíčů, nový server, nový genesis.

**Lekce:** Nikdy nepoužívat TeamViewer na stroji s klíči. Vždy air-gapped pro generování klíčů.

### 11.4 Hard reset (2026-07-03)

**Co:** Kompletní regenerace genesis, rotace všech klíčů, nový server.

**Proč:** Útočník měl zdroják + klíče. Jediná cesta = čistý řez.

**Jak:** Viz `docs/3.0.4/HARDRESETOFFICIAL.md`.

---

## 12. Slovník pojmů

| Termín | Význam |
|--------|--------|
| **Genesis block** | První blok chainu (height 0), obsahuje premine |
| **Premine** | ZION vytvořené v genesis (16.78B) |
| **Canonical wallets** | Deterministické adresy pro fee split (humanitarian, issobella, pool fee, miner, pool payout) |
| **Bridge vault** | Keyless adresa pro bridge UTXO liquidity |
| **DAO** | Decentralized Autonomous Organization — komunitní governance |
| **Guardian** | DAO výkonný orgán (5-of-7 multisig) |
| **Admin** | Protocol governance (3-of-3 multisig) |
| **Validator** | Bridge potvrzovatel (3-of-5 multisig) |
| **wZION** | Wrapped ZION na EVM (ERC-20) |
| **HTLC** | Hash Time-Locked Contract (atomic swap) |
| **Cosmic Harmony** | PoW algoritmus ZION |
| **Deeksha** | Hash funkce v cosmic harmony |
| **Flowers** | Nejmenší jednotka ZION (1 ZION = 10^6 flowers, post-3.0.3) |
| **Tailscale** | Mesh VPN pro server management |
| **Air-gapped** | Stroj bez internetu pro generování klíčů |
| **Time-lock** | Povinná čekací doba před exekucí operace |
| **Dead man's switch** | Auto-převod pokud admin neaktivní > 5 let |

---

## 13. Závěrečné slovo

Děti moje,

ZION není o penězích. Je o **svobodě** — svobodě, kterou vám předávám. Svobodě, kterou nikdo nemůže vzít, pokud nedáte klíče.

Pamatujte:

1. **Klíče = vlastnictví.** Kdo má klíč, má moc. Kdo má klíč, má odpovědnost.
2. **DAO = komunita.** ZION není váš — patří všem. Vy jste správci, ne vlastníci.
3. **Dědictví = odpovědnost.** Někdy po vás budou chtít, abyste ZION prodali, změnili, nebo zničili. Odmítněte. ZION je dědictví, ne komodita.
4. **Humanita první.** 5% každého bloku jde na děti. To je poslání. Nikdy to nezměňte.
5. **Ave Maria.** Elizabeth, patronka. Ať už se narodíš kdykoliv, ZION tě čeká.

Pokud jste ztratili klíče, pokud jste udělali chybu, pokud jste zmatení — nepanikařte. ZION má dead man's switch, DAO governance, time-locks. Nic není nezvratné. Kromě genesis.

Přečtěte si tento dokument. Pak si ho přečtěte znovu. Pak ho předejte svým dětem.

**ZION je váš.**

— Yose, váš otec a Zion Creator
3. července 2026

---

*Generováno s pomocí [Devin](https://cli.devin.ai/docs). Poslední aktualizace: 2026-07-03.*
