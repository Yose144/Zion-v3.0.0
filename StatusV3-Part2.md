# ZION V3 — Status Report **Part 2** (Independent Audit + Cleanup)

> **Datum:** 2026-05-07
> **Auditor + remediátor:** Devin (independent verification + autopilot cleanup)
> **Stav:** ✅ **CLEANUP DOKONČEN** (history rewrite + force-push + rotace klíčů)
> **Původní HEAD (před rewrite):** `27d9c9e0` ("gpu") na `origin/main`
> **Předchozí status:** [`StatusV3.md`](./StatusV3.md) (2026-05-03)
> **Účel:** nezávislé ověření tvrzení v `StatusV3.md`, identifikace driftů
> mezi dokumentací a realitou, **prioritizace blokátorů před Genesis #0**,
> a **remediace P0 nálezů** (F3b + F6) na autopilotu.
> Tento dokument **doplňuje**, neruší `StatusV3.md`. Kde se liší, platí
> Part 2 (zachycuje pozdější ověřený stav).

---

## 🟢 Cleanup completion log (2026-05-07 evening)

| Akce | Stav | Detail |
|---|---|---|
| OpenAI API key | ✅ **úplně zrušen** | Uživatelem; klíč už nebude používán, žádný replacement |
| Starý GitHub PAT (`ghp_7gxI3Y…`) | ✅ revoke | Uživatel; nový PAT vystaven mimo repo |
| Starý SSH klíč na 91.98.122.165 (Praha) | ✅ deprecated | Praha node se vyřazuje; Genesis #0 deploy poběží na **3 nových serverech** s čerstvým keysetem |
| `git filter-repo` history rewrite | ✅ proběhl | bare backup `2.9.6-backup-20260507-2229.git`; všechny leaked paths odstraněny ze všech commitů |
| Working-tree leftovers | ✅ smazáno | `docs/docs2.9/ZION_KEYS/`, `Zion-2.9.5-main/.../ZION_KEYS/`, `V3-src*.tar/.zip`, `V3_upload.zip`, `V3/local-stack-*.err` |
| Token strings v dokumentaci | ✅ redacted | `ghp_7gxI3Y…REDACTED` / `sk-proj-CsUPFB…REDACTED` |
| Force-push `origin/main` | ✅ provedeno | Repo je private, fork notifikace nepotřebná |

**Nálezy F3b a F6 jsou tímto reálně CLOSED** (nejen označením v `StatusV3.md`).

---

## TL;DR (pro laika)

- **Konsensusový kód je opravdu hotový** podle všech nároků `StatusV3.md`
  (F1 conservation-of-value, F2 BLAKE3 Merkle, TX_HASH_V2 + BODY_ROOT_V2 od
  výšky 0, synthetic-proof kill v relayeru). Independent verification ✅.
- **Bezpečnostně je situace HORŠÍ než `StatusV3.md` připouští.** Status tvrdí,
  že PR #25 (merged 2026-04-29) odstranil leaknuté klíče a archivy. **Realita:
  plaintext PAT, OpenAI klíč, SSH inventory I tři source-tree archivy jsou
  stále trackované v gitu na current `main` HEAD.** F3b a F6 ve statusu jsou
  označené ✅, ale kód říká, že jsou stále otevřené.
- **Repo je strukturálně rozklížený** — dvojitý Cargo workspace (root + V3),
  recent commit log na `main` je dominován ne-V3 šumem (Hiranyagarbha v2.1,
  UI experimenty), žádný release tag pro RC.
- **Drobné číselné drifty** ve `StatusV3.md` (lib.rs LoC, test counts, pre-commit
  status) — nic kritického, ale stojí za jednorázovou konsolidaci.

**Verdikt:** kódově **release-candidate** ✅ (potvrzeno). Operačně/securisticky
**NE READY** — leaknuté klíče v HEAD blokují cokoliv s nárokem na "mainnet
ready" silněji, než status sugeruje.

---

## 1. 🔴 CRITICAL — Bezpečnostní nálezy v rozporu s `StatusV3.md`

### 1.1 F-AUDIT-1: Plaintext credentials stále v tracked gitu na `main` HEAD

`StatusV3 §1.8` označuje **F3b** za ✅ vyřešené přes PR #25 (s poznámkou „rotace
klíčů na uživateli"). **To není pravda.** Soubory jsou stále ve working tree
**i v HEAD treeishi** `27d9c9e0`:

```
$ git show HEAD:docs/docs2.9/ZION_KEYS/GITHUB_TOKEN.txt
ghp_7gxI3Y…REDACTED-2026-05-07
Created: 2025-11-10
Repositories: Zion-2.9, Universal-Miner, and others

$ git show HEAD:docs/docs2.9/ZION_KEYS/OPENAI_API_KEY.txt
OPENAI_API_KEY=sk-proj-CsUPFB…REDACTED-2026-05-07
```

Plus `SSH_KEYS_INFO.txt` (cesty + IP `91.98.122.165` + user `root`) a screenshot.
Druhá kopie v `Zion-2.9.5-main/2.9-History/docs/ZION_KEYS/`.

**Closure status v dokumentu je tedy nepravdivý.** Buď PR #25 nikdy neredigoval
`docs/docs2.9/ZION_KEYS/`, nebo došlo k revertu. Existuje branch
`backup-before-filter-202605070152` — naznačuje, že někdo plánoval
`git filter-repo`, ale nedotáhl to.

**Severity: 🔴 P0.** Každá minuta navíc = další kompromitační okno.

**Akce:**
1. **Okamžitě** rotovat PAT, OpenAI key, SSH key (předpokládat kompromitaci).
2. Skutečný redact commit nebo `git filter-repo` na celé historii (viz 1.3).
3. Opravit `StatusV3.md §1.8` — F3b NENÍ closed.

### 1.2 F-AUDIT-2: Source-tree archivy stále v repu

`StatusV3 §1.8 F6: ✅ PR #18 + PR #25`. Realita HEAD:

| Soubor | HEAD velikost | Tracked? |
|---|---:|---|
| `V3-src.tar` | 1 024 B | ✅ ano |
| `V3-src.zip` | 428 156 B | ✅ ano |
| `V3-src-fresh.tar` | 1 759 232 B | ✅ ano |
| `V3_upload.zip` | 385 972 B | ✅ ano |

Tyto archivy jsou přesně to, co `SECURITY_NOTICE_2026-04-28.md` říkal že obsahuje
historické kopie `zion-wallet.json` (premine privkey + mnemonic). Audit nálezu
**F6 NENÍ closed**, navzdory tabulce v `StatusV3.md`.

**Severity: 🔴 P0.**

### 1.3 F-AUDIT-3: Žádný history scrub neproběhl

`git log main` HEAD (`27d9c9e0`) je commit "gpu" od jiného autora
(`estrelaisabellazion3@gmail.com`, 2026-05-07), který přidává `Hiran_v2.1.md`,
`gpuVast.md`, `gpurent.md` — nesouvisející s V3 mainnet auditem. Žádný
`filter-repo` commit, žádný force-push pattern.

Predikce z `SECURITY_NOTICE_2026-04-28.md` byla "scrub musí proběhnout jednou
a najednou". **Neproběhl.** Branch `backup-before-filter-202605070152` existuje,
ale samotný rewrite ne.

**Severity: 🔴 P0** (souvisí s 1.1/1.2).

### 1.4 F-AUDIT-4: `local-stack-*.err` residua

```
V3/local-stack-node.err  (340 B)
V3/local-stack-pool.err  (0 B)
```

Neškodný šum, ale ukazuje že někdo testoval lokálně a uklidil polovičatě.
Stojí za `*.err` v `.gitignore`.

**Severity: 🟢 P3.**

---

## 2. 🟢 Konsensusové changes — VERIFIED nezávisle

Tyto věci `StatusV3.md` tvrdí a Part 2 nezávisle ověřil v kódu:

### 2.1 TX_HASH_V2 + BODY_ROOT_V2 aktivace od výšky 0

`V3/L1/cosmic-harmony/src/deeksha.rs:44-100`:

```rust
pub const TX_HASH_V2_ACTIVATION_HEIGHT: u64 = 0;       // produkce
pub const BODY_ROOT_V2_ACTIVATION_HEIGHT: u64 = 0;     // produkce
// pod feature = "testnet_fork_rehearsal" → TESTNET_REHEARSAL_COORDINATED_HEIGHT
```

Pinning testy `production_fork_gates_at_genesis_in_core_build`,
`tx_hash_v2_active_from_genesis`, `body_root_v2_active_from_genesis` skutečně
existují (řádky 612-636). ✅

### 2.2 F1 — UTXO conservation u peer + lokálních bloků

Commit `89ba3730` na `main`, `V3/L1/core/src/lib.rs:3060-3099`:

```rust
// ── UTXO input existence + value conservation (F1) ─────────────────
validation::validate_value_conservation(...)
```

Voláno v `accept_candidate` cestě (lokální těžba) i `validate_peer_block`
(peer import). Test `value-conservation rejection` na řádce 5944. ✅

### 2.3 F2 — BLAKE3 Merkle dispatcher

`V3/L1/core/src/lib.rs:3726-3820`:

```rust
fn derive_template_merkle_root(...) {
    if body_root_v2_active(height) {
        derive_template_merkle_root_v2_blake3(...)
    } else {
        derive_template_merkle_root_v1_xor(...)
    }
}
```

✅ se 7 dispatcher / avalanche / determinism testy v lib.rs (řádky 6537-6629).

### 2.4 Synthetic-proof kill (PR #27)

`V3/L2/bridge/src/relayer.rs:668-1094`. Test
`build_validator_proofs_checked_never_emits_synthetic_marker` ověřuje, že
0 signers → `Err`, ne 3 syntetické. Pinning `"synthetic": false` na všech
proof slotech. ✅

### 2.5 `cosmic_harmony_with_height` v genesis

`V3/L1/core/src/genesis.rs` (656 LoC) — height-aware dispatch ověřen. ✅

### 2.6 Commits na `main` ověřeny

- `c048f9aa` "feat: activate TX hash v2 and BLAKE3 Merkle body root from genesis"
  → na `main` ✅
- `89ba3730` "core: enforce UTXO value conservation in local mining" → na `main` ✅

**Závěr §2:** všechny kódové claims z `StatusV3.md` o konsensu jsou pravdivé
a v kódu skutečně přítomné.

---

## 3. 🟡 Drift mezi `StatusV3.md` a realitou (kosmetické)

| Tvrzení v `StatusV3.md` | Naměřená skutečnost | Severity |
|---|---|---|
| `lib.rs` má **6 508** LoC (§2.7, §11) | **6 707** LoC (`wc -l V3/L1/core/src/lib.rs`) | 🟡 |
| `zion-cosmic-harmony` **100** lib testů (§5) | 102 `#[test]` direktiv v src | 🟢 |
| `zion-core` **488** lib testů (§5) | 498 `#[test]` direktiv v src | 🟢 |
| Status §5: cosmic-harmony lib **100**, ale "Lokálně 2026-05-02 ověřeno: 95" | vnitřní nekonzistence v dokumentu | 🟡 |
| §2 P3.11: `.pre-commit-config.yaml` **„neexistuje"** | **EXISTUJE** (3 183 B, datum 2026-05-02 16:01) | 🟡 |
| §1.8 F3b: ✅ PR #25 | **NENÍ closed** — viz 1.1 | 🔴 |
| §1.8 F6: ✅ PR #18 + #25 | **NENÍ closed** — viz 1.2 | 🔴 |
| `cargo audit ✅ 0 vulnerabilities` (§5) | `Cargo.lock` má `rustls-webpki 0.103.13` ✅ ; full audit run mimo scope tohoto auditu (offline + dvojitý target adresář) | 🟢 lock match |

Žádný z těchto driftů (kromě F3b/F6 securityrelevant) není operačně závažný.
Stojí za jednorázovou refresh `StatusV3.md`.

---

## 4. 🟡 Code quality — pozorování, ne blokátor

| Metrika | Hodnota | Komentář |
|---|---:|---|
| `unwrap()` / `expect(` v `V3/L1/core+pool` + `V3/L2/bridge` | **495** | F5 (mutex poison resilience) je něco jiného než redukce panics. Status §15.1 přiznává `active_tip().expect` jako known target; reálně je problém širší. Pre-Genesis stress-test 10 000+ TX (P3) by mohl odhalit panic-and-die scénáře. |
| `unsafe` blocks v `V3` | **556** | Většina v `V3/L1/native-ffi` (GPU dispatchers, dokumentováno PR #28 ✅). Ale 556 je překvapivě velké číslo — stojí za sample-audit i mimo native-ffi. |
| `TODO/FIXME/XXX/HACK` v `V3` | **36** | Nízké, OK. |
| `.pre-commit-config.yaml` | ✅ existuje | Status §2 P3.11 říká „neexistuje" — drift. |
| `V3/Cargo.lock` tracked | ✅ ano (per `V3/.gitignore` `!Cargo.lock`) | Reproducibilita ✅ |

---

## 5. 🟡 Repo hygiena & struktura

### 5.1 Velikosti adresářů

```
26  GB   V3/         (s target/ — bez něj odhad ~250 MB src)
8.9 GB   HiranV2.1/  (AI/RAG corpus, ne-mainnet)
4.6 GB   APP&WEB/    (Electron + RN + Next.js)
1.8 GB   .git/
454 MB   L2/ (legacy)
43  MB   docs/
6   MB   L1/ (legacy)
808 KB   L3/ (legacy)
```

### 5.2 Dvojitý workspace

Legacy root `Cargo.toml` a `V3/Cargo.toml` koexistují — oba mají member jménem
`L1/core`, ale směřují na různé adresáře. To je matoucí pro nové vývojáře a
CI/cargo workspaces nejsou izolované (dvě nezávislé workspace inkluze).
`AGENTS.md` to disclaime ("treat root as legacy"), ale strukturně to není
separované.

### 5.3 Recent commit log na `main`

Posledních 14 commitů obsahuje **0 V3-mainnet-relevantních** commitů; všechno
je Hiranyagarbha v2.1, Holographic Earth UI a "gpu" datový dump. Audit-závěrečné
commity (`c048f9aa`, `89ba3730`) jsou hlouběji v historii, ale ne v žádném
tagu/release.

**Doporučení:** vytvořit tag `v3-mainnet-rc1` na `89ba3730` aby code freeze pro
Genesis #0 měl pevný anchor a další ne-V3 commity ho neodtáhly.

---

## 6. 🟡 Bridge — staging, nepřipravený na unlock (souhlas se statusem)

`V3/L2/bridge/config/bridge-mainnet.toml`:

```toml
threshold        = 1
total_validators = 2
```

`StatusV3.md` to přiznává jako P1 blokátor — souhlas. **Ankr API key**
komentář (`api_key = ""`) potvrzuje, že `ANKR_API_KEY` env var je requirement,
ale není nikde enforcován v boot path (out of scope tohoto auditu — stojí za
follow-up).

Pozitivní: PR #22 (L1 enforcement) + PR #27 (relayer fail-closed) jsou v kódu
reálně přítomné. Operační zbytek (5 klíčů, threshold bump) je čistá ops práce.

---

## 7. CI / DevEx

- 6 workflow souborů: `audit.yml`, `ci.yml`, `release.yml`, `v3-ci.yml`,
  `v3-cli-binaries.yml`, `v3-release.yml`. `StatusV3 §2 P2.5` tvrdí, že CI
  běží červená kvůli GitHub Actions billing → tj. tyto workflowy *existují,
  ale neběží*. Bez veřejného `gh run list` to neověřím, ale absence zelených
  badges + konzistentní zpráva napříč PR #18-#28 dává tomu věrohodnost.
- Pre-commit hook **existuje** (3 183 B). Doporučení statusu „přidat
  pre-commit" je **stale**. Aktualizovat.

---

## 8. Souhrn priorit (po nezávislém auditu)

### ✅ P0 — leaknuté klíče (HOTOVO 2026-05-07)

> **Historie této sekce:** původní audit (2026-05-07 morning) označil P0 jako
> open ("doc tvrdí closed, kód říká open") s návodem co rotovat. Odpoledne
> téhož dne uživatel autorizoval autopilot cleanup; vše níže je **dokončeno**.

1. ✅ **Rotace credentials:**
   - GitHub PAT `ghp_7gxI3Y…` → revoke (uživatel); nový PAT vystaven mimo repo
   - OpenAI `sk-proj-CsUPFB…` → **kompletně zrušen** (žádný replacement, AI cesta odložena)
   - SSH klíč na `91.98.122.165` (Praha) → deprecated; **Praha node se vyřazuje**, mainnet poběží na 3 nových serverech

2. ✅ **`git filter-repo` history rewrite proveden** — všechny leaked paths
   (ZION_KEYS, V3-src*.tar/.zip, V3_upload.zip) jsou odstraněny ze všech
   commitů na `main`. Bare backup uložen v `2.9.6-backup-20260507-2229.git`
   (+ druhý backup `2.9.6-backup2-20260508-1947.git` po re-scrub na
   user-introduced `01e67107 rescrub` commitu).

3. ✅ **Force-push na `origin/main` proveden.** Repo je private, fork
   notifikace nebyla potřeba.

4. ✅ **Working-tree cleanup:** smazány `docs/docs2.9/ZION_KEYS/`,
   `Zion-2.9.5-main/2.9-History/docs/ZION_KEYS/`, čtyři source archivy,
   `V3/local-stack-*.err` residua.

5. ✅ **Token strings v audit dokumentaci redacted** (Part 2 cituje jen
   prefixy `ghp_7gxI3Y…REDACTED` / `sk-proj-CsUPFB…REDACTED`).

### 🔴 P1 — Operace pro Genesis

6. **Tag `v3-mainnet-rc1`** na rewritten ekvivalentu commitu `89ba3730`
   (po rewrite mají commity nové SHA — najít odpovídající commit
   `core: enforce UTXO value conservation in local mining` v novém logu).
7. **3 nové mainnet servery** (zastupují vyřazený Praha node):
   - Provision SSH keys čerstvě (žádný carry-over z `zion_deployment_key`).
   - Geo-distribuce (doporučení: ne všechny u stejného providera, ne všechny
     v jedné zemi — mainnet odolnost vůči infrastructure outage).
   - Stejná verze stacku z release tag, čistý datadir.
8. **Bridge:** provisioning 5 validator klíčů, `threshold=3, total=5`,
   `ANKR_API_KEY` enforcement v boot path, ≥ 1 týden testnet zelená.
9. **Mainnet deploy:** čistý datadir, release binárky z tagu, smoke test
   z laptopu na všechny 3 nodes (P2P sync, RPC ping, pool template, miner
   submit).

### 🟡 P2 — Status hygiena & deep cleanup

8. **Refresh `StatusV3.md`:**
   - lib.rs LoC drift (6 508 → 6 707)
   - test counts (cosmic-harmony 95 vs 100 inkonzistence; core 488 vs 498)
   - pre-commit existence (status říká neexistuje, existuje)
   - F3b a F6 closure status (po P0 #2/#3)
9. **Audit `unwrap()` / `expect(` density** (495 occurrences) — vyhradit P2
   sweep PR; identifikovat hot-paths kde panic = node down.
10. **Externí audit** (Trail of Bits / Halborn / OtterSec) — Q3 2026, jak
    `StatusV3.md` plánuje.

### 🟢 P3 — Pohodlí

11. `*.err` do `.gitignore`, smazat `V3/local-stack-*.err`.
12. Repo bloat: zvážit, jestli `HiranV2.1/` (8.9 GB) má být v hlavním repu
    nebo v separátu.
13. **Dvojitý workspace:** buď definitivně archivovat root `Cargo.toml`, nebo
    ho izolovat v `legacy/` subtree.

---

## 9. Co tento audit NEpokryl

- Reálný `cargo test --workspace --release` end-to-end běh (počítá s desítkami
  minut + GPU; ověřil jsem strukturálně + commits + pinning testy).
- Dynamic analysis / fuzzing Cosmic Harmony Ekam Deeksha v2 (status sám
  doporučuje 3rd party).
- Bezpečnostní review L3/warp per-chain signer cest (status §2 P2.8 přiznává
  odložení).
- Live CI běh (GitHub Actions billing).
- Reálný stav produkčního Praha-nodu (ssh).

---

## 10. Závěr Part 2

> **„Hot, ale ne na panikařit"** — citováno ze `StatusV3.md` — **platí,
> ale s upřesněním:** klíče **stále hoří v gitu**, ne jen v paměti útočníka.
> `StatusV3.md` to neodráží.

Kódový claim **release-candidate je opodstatněný** ✅ ; bezpečnostní claim
`F3b/F6 ✅` je **falešný** vůči `main` HEAD. Před Genesis #0 je nutné
**opravit dokumentaci nebo opravit realitu** (preferenčně to druhé, přes
`filter-repo` + rotaci klíčů).

---

## 11. Doporučené následné PR (Part 2 sekvence)

| # | PR (návrh) | Velikost | Závisí na | Stav |
|---:|---|---|---|---|
| **K** | `chore(security): redact docs/docs2.9/ZION_KEYS/ + remove V3-src*.tar/zip from working tree` | XS | — | 🟡 plán |
| **L** | `chore(security): git filter-repo history rewrite (one-shot)` | XS code / L coord | K + rotace klíčů uživatelem | 🟡 plán |
| **M** | `docs(status): refresh StatusV3.md drift (lib.rs LoC, test counts, F3b/F6, pre-commit)` | S | K, L | 🟡 plán |
| **N** | `chore(repo): tag v3-mainnet-rc1 at 89ba3730` | XS | K, L, M | 🟡 plán |
| **O** | `chore(gitignore): add *.err and remove local-stack-*.err residue` | XS | — | 🟢 trivial |
| **P** | `audit(core): unwrap/expect sweep — top-10 panic hot-paths` | M | — | 🟡 plán P2 |
| **Q** | `feat(bridge): enforce ANKR_API_KEY in startup; fail-fast on missing` | S | — | 🟡 plán P1 |
| **R** | `chore(workspace): isolate legacy root Cargo.toml under legacy/` | L | M | 🟡 P3 |

**Critical path k bezpečnému Genesis #0:**
**rotace klíčů (uživatel) → K → L → M → N → bridge ops (validator keys, threshold bump) → deploy.**

---

> *Part 2 audit dokončen 2026-05-07 21:51 +02:00. Pokrývá `origin/main` HEAD
> `27d9c9e0`. Při dalším Part 3 zaktualizovat HEAD anchor.*
