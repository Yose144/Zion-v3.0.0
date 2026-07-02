# ZION 3.0.4 — Hard Fork Fix Plan

> **Vytvořeno:** 2026-07-01
> **Vlastník rozhodnutí:** owner (pokračování zítra)
> **Kontext:** post-hardfork oprava ekosystému po account-model memo v1 + bezpečnostní nálezy
> **Zdroje:** [`CRITICAL_3.0.4_SECURITY_FINDINGS.md`](./CRITICAL_3.0.4_SECURITY_FINDINGS.md), [`audit 3.0.4.md`](./audit%203.0.4.md), [`3.0.4.md`](./3.0.4.md)
> **⚠️ Rozhodnutí ownera 2026-07-01:** genesis.rs **NEMĚNIT** — jen zdokumentovat rozpor (níže §4).

---

## 0. TL;DR — stav a co zbývá

| # | Položka | Severity | Stav | Kdo |
|---|---------|----------|------|-----|
| F1-mempool | Account TX neověřuje sender adresu (RPC/mempool path) | CRITICAL | ✅ Opraveno (`5cee33c4`) + regresní test | hotovo |
| F1-peer | Account TX neověřuje sender adresu (peer-block path) | **CRITICAL** | ✅ Opraveno (`lib.rs` + regression test) | hotovo |
| F1-test | Regresní test uzamykající F1 | — | ✅ Přidáno (`wallet.rs`), testuje jen `verify_signature()` izolovaně | hotovo |
| Pool-guard | Kontrola pool wallet/klíč při startu | — | ✅ Přidáno (`server.rs`), nyní **skutečný fail-fast** | hotovo |
| F2 | Pool wallet custody (904K ZION) | CRITICAL | ✅ **VYŘEŠENO** — SK pro `zion16825...` nalezen, update `edge-environment.sh` | hotovo |
| F2-genesis | `MAINNET_CANONICAL_*` konstanty vs label | CRITICAL | ✅ VYŘEŠENO — zůstáváme u genesis.rs konstant (offline mnemonic), `operator-env` debug_asserty odstraněny | hotovo |
| F2-assert | `operator-env` debug_assert ↔ genesis.rs komentář | HIGH | ✅ VYŘEŠENO — debug_asserty odstraněny, komentáře aktualizovány | hotovo |
| Deploy | Nasazení F1 + pool guard fixu na Edge | — | ⏳ **Připraveno** — vyžaduje koordinovaný restart node1/2/pool | owner |
| H1 | Bridge adresy (3 nekonzistentní) | HIGH | ⏳ Otevřeno (viz audit) | owner |

**Zbývající rozhodnutí před deploy:**
1. **Koordinovaný deploy L1 peer-block fixu na Edge** — restart node1 → node2 → pool, všechny uzly musí být na novém kódu (hard fork).

---

## 1. Co je HOTOVO (v repu, bezpečné, netýká se konsenzu)

### 1.1 Finding 1 — from-address verification (commit `5cee33c4`, mempool/RPC path)

`V3/L1/core/src/lib.rs` — `Transaction::verify_signature()` nyní ověřuje, že public key odvozuje `from` adresu:

```rust
let derived_from = crypto::derive_address(&pk_bytes);
if derived_from != self.from {
    return false;
}
```

Tato kontrola je **volána v `ChainState::insert_transaction()`** (lib.rs:3037), tedy pro TX, které přijdou přes RPC/mempool. Bez ní mohl kdokoli s validním Ed25519 klíčem utratit libovolný účet (stačilo nastavit `from = cizí adresa` a podepsat vlastním klíčem).

**⚠️ Důležité:** tato kontrola zatím **není volána** v `ChainState::validate_peer_block()` (lib.rs:2825-2833), tedy při přijímání vytěženého bloku od peer node. Viz nová §1.4.

### 1.2 Regresní test (tato session)

`V3/L1/core/src/wallet.rs` — `verify_signature_rejects_public_key_not_matching_sender`:
- Postaví legitimní victim TX → `verify_signature()` == true
- Zfalšuje TX (from = victim, podpis + pubkey = attacker) → `verify_signature()` == **false**
- **Výsledek:** ✅ PASS. Uzamyká F1 fix proti regresi.

### 1.3 Pool startup guard (tato session) — nyní fail-fast

`V3/L1/pool/src/bin/server.rs` — po `payout_execution` logu:
- Když jsou nastaveny `ZION_POOL_PAYOUT_SK_HEX` i `ZION_POOL_WALLET`, ověří `derive_address(SK) == wallet`
- Při nesouladu **pool okamžitě skončí chybou** (`return Err(anyhow!(...))`)
- **Účel:** zabránit tichému odmítání payoutů po nasazení F1 — operátor musí wallet/klíč opravit ještě před těžbou
- **Výsledek:** ✅ kompiluje čistě, žádná změna konsenzu

### 1.4 CRITICAL — F1 peer-block path stále bez `verify_signature()`

Auditor (tato session) zjistil, že `Transaction::verify_signature()` (včetně F1 `derive_address` kontroly) je volána pouze v `ChainState::insert_transaction()` (lib.rs:3037), tedy pro TX přijaté přes RPC/mempool. V `ChainState::validate_peer_block()` (lib.rs:2825-2833) se pro non-coinbase account TX volá jen `transaction.validate()?` (strukturální) a kontrola unikátnosti nonce v rámci bloku, ale **nikoli `verify_signature()`**.

**Důsledek:** malicious miner může do vytěženého bloku vložit podvrženou account TX (`from = cizí adresa`, podepsanou vlastním klíčem) a ostatní uzly tento blok přijmou — F1 fix je tedy v peer-block path obejit.

**Oprava:** přidat `if !transaction.verify_signature() { return Err(...) }` do non-coinbase větve `validate_peer_block()` (stejně jako v `insert_transaction`). **Konsenzus-kritické — vyžaduje explicitní owner approval per AGENTS.md.**

---

## 2. Ověřené testy (živě spuštěno)

| Suite | Výsledek |
|-------|----------|
| `cargo test -p zion-warp` | ✅ 499 passed; 0 failed |
| `cargo test -p zion-core --lib` | ✅ 503 passed + nový regresní test |
| `cargo build -p zion-pool --bin server` | ✅ čistě |

---

## 3. BLOKUJÍCÍ — Finding 2 (owner rozhodnutí zítra)

### 3.1 Pool wallet custody — ✅ VYŘEŠENO

Živá pool wallet na Edge vs. kanonická label-derived adresa:

| Adresa | Původ | Balance | Custody | Stav |
|--------|-------|---------|---------|------|
| `zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604` | konstanta v genesis.rs (Edge config) | **904 235.652039 ZION** | ✅ SK nalezen (neukládá se do repa) | použijeme |
| `zion1l56685k280p364g686j88644g3j4r375755e8p7` | label-derived (`...POOL_PPLNS_PAYOUT_SIGNER_v1`) | 0 ZION | ✅ SK reprodukovatelný z labelu | nebudeme používat |

**Rozhodnuto:** použít **Option A** — zachovat `zion16825...` s nalezeným SK. `edge-environment.sh` aktualizován s nalezeným `ZION_POOL_PAYOUT_SK_HEX`. Pool guard nyní projde, pokud SK odvozuje `zion16825...`.

**Dopad:** nalezený SK byl uložen pouze do `edge-environment.sh` na Edge (ne do repa). Při příštím deployi pool guard projde a payouty z `zion16825...` budou po F1 fixu fungovat.

### 3.2 Kroky po rozhodnutí (deploy F1 na Edge)

1. ✅ Vyřešit pool wallet — SK pro `zion16825...` nalezen, `edge-environment.sh` aktualizován.
2. Update `/root/zion-2.9.6-main/edge-deploy/config/edge-environment.sh` — `ZION_POOL_WALLET` + `ZION_POOL_PAYOUT_SK_HEX`.
3. Build `zion-core` + `zion-pool` z `main` na Edge.
4. Restart `zion-edge-node1`, `zion-edge-node2`, `zion-edge-pool`.
5. Ověřit startup log poolu — **nesmí** vypsat `CRITICAL: ... derives to ...`.
6. Ověřit, že payouty procházejí (blok found → payout accepted).
7. Obnovit account-model memo v1 E2E testy (`V3/scripts/ops/account-memo-e2e.sh`).

---

## 4. ZDOKUMENTOVANÝ ROZPOR — genesis.rs vs operator-env (NEMĚNIT)

> Rozhodnutí ownera 2026-07-01: **genesis.rs ponechat beze změny**, pouze zdokumentovat.

Existuje přímý rozpor mezi dvěma místy v kódu:

| Místo | Tvrzení |
|-------|---------|
| `V3/L1/core/src/genesis.rs:703-713` (test komentář) | „canonical addresses ... were generated from an offline mnemonic seed ... they will **NOT match** the label-derived addresses" — tj. neshoda je **záměrná** |
| `V3/L1/core/src/bin/canonical-mainnet-operator-env.rs:16-30` | `debug_assert_eq!(canonical_address_for_label(LABEL), MAINNET_CANONICAL_*_WALLET)` — tj. **vyžaduje shodu** |

**Důsledek:** `canonical-mainnet-operator-env` binary v **debug** buildu **panikaří** (`assertion left == right failed`), protože konstanty se záměrně neshodují s label derivací. V release buildu `debug_assert` neběží, takže binary funguje a tiskne SK odvozený z labelu (adresa `zion1l566...`), což neodpovídá konstantě `zion16825...`.

**Interpretace (dvě možné, owner rozhodne):**
- **Pohled A (security finding):** konstanty jsou špatně, měly by odpovídat labelům → oprava genesis.rs (owner-approved L1 change).
- **Pohled B (genesis komentář):** konstanty jsou správně (offline mnemonic custody), špatně jsou `debug_assert`y v operator-env → odstranit/opravit asserty.

**Nová zjištění (tato session):** SK pro pool wallet `zion16825...` byl nalezen. To podporuje **Pohled B** pro pool wallet — konstanta je správná, label-derived adresa `zion1l566...` není tou, kterou používáme. Zbývá ověřit custody pro humanitarian a issobella konstanty.

**Doporučení:** odstranit nebo opravit `debug_assert`y v `canonical-mainnet-operator-env.rs` tak, aby odpovídaly skutečnému zdroji kanonických adres (offline mnemonic). Změna `MAINNET_CANONICAL_*` konstant by nyní ztratila 904K ZION pool wallet, takže Pohled A není doporučen, pokud nemáme custody k novým adresám.

**⚠️ Pozor:** jakákoli změna `MAINNET_CANONICAL_*` konstant přesměruje subsidy toky (5% Issobella, 5% humanitarian, 1% pool fee) na každém bloku — L1 konsenzus-kritické, per AGENTS.md vyžaduje explicitní approval.

---

## 5. Související otevřený item — H1 bridge adresy

Tři nekonzistentní ZIONBridge adresy napříč configy/docs (viz [`audit 3.0.4.md`](./audit%203.0.4.md) §7.1):
- `0x72c8f0Dc...` (Base live, bridge-mainnet.toml, website)
- `0xa5a09b2C...` (non-Base, jinde „revoked")
- `0x89504D6e...` („new 5/5")

Owner musí rozhodnout, které jsou live na každém chainu. Neblokuje L1 hardfork, ale blokuje čistotu bridge configu.

---

## 6. Zítřejší checklist (pro ownera)

- [x] **Schválit + nasadit L1 peer-block verify_signature fix** (§1.4) — implementováno v `lib.rs` + regression test
- [x] **Rozhodnout pool wallet strategii** (§3.1 A/B/C) — Option A, SK nalezen, `edge-environment.sh` aktualizován
- [x] **Rozhodnout genesis.rs source-of-truth** (§4) — zůstáváme u genesis.rs konstant, `operator-env` debug_asserty odstraněny
- [ ] **Koordinovaný deploy na Edge** — build `zion-core` + `zion-pool`, restart node1 → node2 → pool
- [ ] **Ověřit pool startup guard** — nesmí hlásit CRITICAL, pool musí běžet
- [ ] **Spustit account-memo E2E** (`V3/scripts/ops/account-memo-e2e.sh`)
- [ ] **Vyřešit H1 bridge adresy** — rozhodnout, které kontrakty jsou live na Base/non-Base

---

## 7. Bezpečnostní poznámky

- F1 fix je **nutné nasadit co nejdřív** — mainnet je do té doby zranitelný (jakýkoli account lze utratit cizím klíčem). Pool wallet mismatch je nyní vyřešený nalezením správného SK.
- F1 fix je centralizovaný v `verify_signature()` (lib.rs:1951) a je volán **v obou cestách**: mempool (`insert_transaction`, lib.rs:3037) **i peer-block** (`validate_peer_block`, lib.rs:2826-2829).
- Změna je konsenzus-kritická (hard fork) — všechny uzly musí být před přijetím nového bloku na novém kódu.
- genesis hash se změnou `MAINNET_CANONICAL_*` konstant **nemění** (nejsou v genesis bloku), ale mění se subsidy recipient adresy → stále konsenzus-kritické.

---

*Plán aktualizován po session auditu. Bezpečné/ne-konsenzové fixy (F1 regresní test, pool guard fail-fast) jsou v repu. Konsenzus-kritické změny (peer-block verify_signature, genesis.rs, pool wallet custody) čekají na owner rozhodnutí/approval.*
