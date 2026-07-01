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
| F1 | Account TX neověřuje sender adresu | CRITICAL | ✅ Opraveno (`5cee33c4`) + regresní test | hotovo |
| F1-test | Regresní test uzamykající F1 | — | ✅ Přidáno (`wallet.rs`) | hotovo |
| Pool-guard | Fail-fast při mismatch pool wallet/klíč | — | ✅ Přidáno (`server.rs`) | hotovo |
| F2 | Pool wallet custody (904K ZION) | CRITICAL | ⏳ **BLOKUJE — owner rozhodnutí (A/B/C)** | owner |
| F2-genesis | `MAINNET_CANONICAL_*` konstanty vs label | CRITICAL | ⚠️ **Ponecháno beze změny** (rozhodnutí ownera) | owner |
| F2-assert | `operator-env` debug_assert ↔ genesis.rs komentář | HIGH | ⚠️ Zdokumentováno, neopraveno | owner |
| Deploy | Nasazení F1 fixu na Edge | — | ⏸️ **Pozastaveno** dokud F2 vyřešeno | owner |
| H1 | Bridge adresy (3 nekonzistentní) | HIGH | ⏳ Otevřeno (viz audit) | owner |

**Zítřejší blokující rozhodnutí:** vybrat pool wallet strategii (§3.1 A/B/C). Bez toho nelze nasadit F1 fix na Edge (jinak se zablokují pool payouty).

---

## 1. Co je HOTOVO (v repu, bezpečné, netýká se konsenzu)

### 1.1 Finding 1 — from-address verification (commit `5cee33c4`)

`V3/L1/core/src/lib.rs` — `Transaction::verify_signature()` nyní ověřuje, že public key odvozuje `from` adresu:

```rust
let derived_from = crypto::derive_address(&pk_bytes);
if derived_from != self.from {
    return false;
}
```

Bez toho mohl kdokoli s validním Ed25519 klíčem utratit libovolný účet (stačilo nastavit `from = cizí adresa` a podepsat vlastním klíčem).

### 1.2 Regresní test (tato session)

`V3/L1/core/src/wallet.rs` — `verify_signature_rejects_public_key_not_matching_sender`:
- Postaví legitimní victim TX → `verify_signature()` == true
- Zfalšuje TX (from = victim, podpis + pubkey = attacker) → `verify_signature()` == **false**
- **Výsledek:** ✅ PASS. Uzamyká F1 fix proti regresi.

### 1.3 Pool startup guard (tato session)

`V3/L1/pool/src/bin/server.rs` — po `payout_execution` logu:
- Když jsou nastaveny `ZION_POOL_PAYOUT_SK_HEX` i `ZION_POOL_WALLET`, ověří `derive_address(SK) == wallet`
- Při nesouladu vypíše `CRITICAL: ... payouts will be REJECTED ...` na stderr
- **Účel:** operátor okamžitě vidí misconfiguraci místo tichého odmítání payoutů po nasazení F1
- **Výsledek:** ✅ kompiluje čistě, žádná změna konsenzu

---

## 2. Ověřené testy (živě spuštěno)

| Suite | Výsledek |
|-------|----------|
| `cargo test -p zion-warp` | ✅ 499 passed; 0 failed |
| `cargo test -p zion-core --lib` | ✅ 503 passed + nový regresní test |
| `cargo build -p zion-pool --bin server` | ✅ čistě |

---

## 3. BLOKUJÍCÍ — Finding 2 (owner rozhodnutí zítra)

### 3.1 Pool wallet custody mismatch

Živá pool wallet na Edge vs. kanonická label-derived adresa:

| Adresa | Původ | Balance | Custody |
|--------|-------|---------|---------|
| `zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604` | konstanta v genesis.rs (Edge config) | **904 235.652039 ZION** | ❓ SK neznámý (neodvozuje z labelu) |
| `zion1l56685k280p364g686j88644g3j4r375755e8p7` | label-derived (`...POOL_PPLNS_PAYOUT_SIGNER_v1`) | 0 ZION | ✅ SK reprodukovatelný z labelu |

**Po nasazení F1 fixu** node odmítne payouty z `zion16825...`, protože jeho nakonfigurovaný SK neodvozuje tuto adresu.

**Tři možnosti (vybrat zítra):**

- **A — Najít SK k `zion16825...`** a migrovat 904K ZION na kanonickou wallet. Zachová prostředky, ale vyžaduje dohledat privátní klíč (mnemonic backup `F:\ZION_V3_MAINNET_WALLETS.txt`?).
- **B — Použít kanonickou `zion1l566...`** (SK reprodukovatelný). Pool startuje s 0 ZION; 904K v `zion16825...` zůstane nedostupných, pokud se SK nenajde.
- **C — Nový pool wallet** se známou custody, funded z jiného zdroje / budoucích odměn.

**Doporučení auditora:** nejprve zkusit A (dohledat SK z backupu). Pokud selže → B nebo C dle toho, zda je 904K ZION kritických.

### 3.2 Kroky po rozhodnutí (deploy F1 na Edge)

1. Vyřešit pool wallet dle A/B/C.
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

**Zatím neopraveno** — vyžaduje owner rozhodnutí, které je „source of truth". Souvisí přímo s §3.1 (pokud platí Pohled B, pak `zion16825...` je legitimní offline wallet a stačí dohledat jeho mnemonic).

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

- [ ] **Rozhodnout pool wallet strategii** (§3.1 A/B/C)
- [ ] **Rozhodnout genesis.rs source-of-truth** (§4 Pohled A vs B)
- [ ] Pokud A/B změna konstant → připravit + odsouhlasit genesis.rs patch (L1 approval)
- [ ] Update Edge env + rebuild + restart (§3.2)
- [ ] Ověřit pool startup guard nehlásí CRITICAL
- [ ] Spustit account-memo E2E (`V3/scripts/ops/account-memo-e2e.sh`)
- [ ] (Samostatně) vyřešit H1 bridge adresy

---

## 7. Bezpečnostní poznámky

- F1 fix je **nutné nasadit co nejdřív** — mainnet je do té doby zranitelný (jakýkoli account lze utratit cizím klíčem). Ale nasazení blokuje pool wallet mismatch (jinak se zablokují legitimní payouty).
- F1 fix je centralizovaný v `verify_signature()` (volán v block validaci lib.rs:3037) — pokrývá všechny account TX cesty.
- Změna je additive vůči memo hardforku; height-gated memo aktivace už je live v kódu.
- genesis hash se změnou `MAINNET_CANONICAL_*` konstant **nemění** (nejsou v genesis bloku), ale mění se subsidy recipient adresy → stále konsenzus-kritické.

---

*Plán připraven autonomně. Bezpečné fixy (F1 regresní test, pool guard) jsou v repu a pushnuté. Konsenzus-kritické změny (genesis.rs, pool wallet custody) čekají na owner rozhodnutí.*
