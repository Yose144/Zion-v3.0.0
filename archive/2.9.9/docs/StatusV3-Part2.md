# ZION V3 — Status Report **Part 2** (Independent Audit + Cleanup)

> **Datum:** 2026-05-07 (audit + cleanup); **2026-05-12** (sjednocení s
> [`StatusV3.md`](./StatusV3.md) — časová osa, TL;DR, §3 drift, §10–§11).
> **Auditor + remediátor:** Devin (independent verification + autopilot cleanup)
> **Stav:** ✅ **CLEANUP DOKONČEN** (history rewrite + force-push + rotace klíčů)
> **Původní HEAD (před rewrite):** `27d9c9e0` ("gpu") na `origin/main`
> **Předchozí status:** [`StatusV3.md`](./StatusV3.md) (2026-05-03)
> **Účel:** nezávislé ověření tvrzení v `StatusV3.md`, identifikace driftů
> mezi dokumentací a realitou, **prioritizace blokátorů před Genesis #0**,
> a **remediace P0 nálezů** (F3b + F6) na autopilotu.
> Tento dokument **doplňuje** `StatusV3.md`. **Časová osa:** ranní nezávislá
> kontrola zachytila rozpor na HEAD `27d9c9e0` (viz §1); večer 2026-05-07 byl
> proveden cleanup (`git filter-repo` + force-push). **Kanonický provozní
> stav po cleanupu** je v `StatusV3.md` (záhlaví + §2 P0/P1). §1 níže je
> zachovaný **audit trail** — nepopisuje současný `main` po přepsání historie.

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

- **Konsensusový kód** odpovídá nárokům `StatusV3.md` (F1, F2, TX_HASH_V2,
  BODY_ROOT_V2 od výšky 0, relayer fail-closed). Nezávislé ověření v §2 ✅.
- **Bezpečnost:** ranní stav **2026-05-07** na HEAD `27d9c9e0` měl stále v tree
  tracked `ZION_KEYS`, archivy `V3-src*` a další nálezy v §1 — **to byl důvod
  k večernímu `git filter-repo` + rotaci.** Na **aktuálním** `origin/main` po
  cleanupu jsou F3b/F6 **reálně uzavřené** (viz log výše + `StatusV3.md` záhlaví).
  *Výjimka:* kdokoli má **starý klon** s pre-scrub historií — zacházet jako s
  kompromitovaným médiem (smazat / znovu klonovat).
- **Repo struktura:** dvojitý Cargo workspace (root + V3) zůstává matoucí;
  stále chybí release tag `v3-mainnet-rc*` (doporučení §5.3 / §8 P1).
- **Drift čísel** v `StatusV3.md` (LoC `lib.rs`, počty `#[test]`) byl
  sjednocen v rámci průběžné údržby dokumentace.

**Verdikt (po večerním cleanupu):** kódově **release-candidate** ✅.
Bezpečnostně je **P0 u repo na `main` vyřešen**; před Genesis #0 zůstávají
**P1** (deploy nového řetězce, bridge 3/5, CI billing, externí audit).

---

## 1. 🔴 CRITICAL — Bezpečnostní nálezy (**historický stav `27d9c9e0`**, před `filter-repo`)

> **Důležité:** Tato sekce dokumentuje důkazy z **pre-scrub** stromu gitu
> (commit `27d9c9e0`, 2026-05-07 dopoledne). Po večerním **`git filter-repo`**
> + force-push na `origin/main` tyto soubory **nejsou** v aktuální historii
> `main`. Slouží jako audit trail a zdůvodnění cleanupu — ne jako popis
> současného HEAD.

### 1.1 F-AUDIT-1: Plaintext credentials v **historickém** `main` tree (`27d9c9e0`)

`StatusV3 §1.8` (stav před večerním scrubem) označovalo **F3b** za ✅ přes PR #25.
**Na HEAD `27d9c9e0` to neodpovídalo realitě** — soubory byly stále ve stromu:

```
$ git show 27d9c9e0:docs/docs2.9/ZION_KEYS/GITHUB_TOKEN.txt
ghp_7gxI3Y…REDACTED-2026-05-07
Created: 2025-11-10
Repositories: Zion-2.9, Universal-Miner, and others

$ git show 27d9c9e0:docs/docs2.9/ZION_KEYS/OPENAI_API_KEY.txt
OPENAI_API_KEY=sk-proj-CsUPFB…REDACTED-2026-05-07
```

Plus `SSH_KEYS_INFO.txt` (cesty + IP `91.98.122.165` + user `root`) a screenshot.
Druhá kopie v `Zion-2.9.5-main/2.9-History/docs/ZION_KEYS/`.

**Closure status v dokumentaci byl v tu chvíli nepravdivý** vůči git tree —
večer 2026-05-07 opraveno přes `git filter-repo` + rotaci (viz log nahoře).

**Severity (v době nálezu):** 🔴 P0.

**Akce (provedeno 2026-05-07):**
1. Rotace PAT / zrušení OpenAI klíče / deprecace SSH deploy.
2. `git filter-repo` na celé historii + force-push.
3. Aktualizace `StatusV3.md` — F3b **closed** po ověření čistého stromu.

### 1.2 F-AUDIT-2: Source-tree archivy na **`27d9c9e0`**

`StatusV3 §1.8 F6` (před scrubem) uvádělo ✅ přes PR #18 + #25. **Na `27d9c9e0`**
archivy stále existovaly:

| Soubor | HEAD velikost | Tracked? |
|---|---:|---|
| `V3-src.tar` | 1 024 B | ✅ ano |
| `V3-src.zip` | 428 156 B | ✅ ano |
| `V3-src-fresh.tar` | 1 759 232 B | ✅ ano |
| `V3_upload.zip` | 385 972 B | ✅ ano |

**Severity (v době nálezu):** 🔴 P0. **Stav po `filter-repo`:** odstraněno z historie
(viz cleanup log).

### 1.3 F-AUDIT-3: Na `27d9c9e0` nebyl vidět `filter-repo` commit

`git log` na **`27d9c9e0`** ukazoval např. commit „gpu“ s Hiran dokumentací —
**žádný** scrub commit v řetězci (odpovídá stavu *před* večerním zásahem).

**Severity (v době nálezu):** 🔴 P0. **Po večeru 2026-05-07:** scrub proveden
(detail v logu výše).

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
| Status §5: cosmic-harmony dříve „95 ověřeno“ vs sloupec 100 | sjednoceno v `StatusV3.md` §5 (2026-05-12) | 🟢 |
| Status §2 P3.11: `.pre-commit-config.yaml` **„neexistuje"** | **EXISTUJE** — `StatusV3.md` to k 2026-05-12 reflektuje | 🟢 |
| §1.8 F3b: ✅ PR #25 | **NESHODA na `27d9c9e0`** — viz §1.1; **po `filter-repo` closed** | 🟢 (po scrubu) |
| §1.8 F6: ✅ PR #18 + #25 | **NESHODA na `27d9c9e0`** — viz §1.2; **po `filter-repo` closed** | 🟢 (po scrubu) |
| `cargo audit ✅ 0 vulnerabilities` (§5) | `Cargo.lock` má `rustls-webpki 0.103.13` ✅ ; full audit run mimo scope tohoto auditu (offline + dvojitý target adresář) | 🟢 lock match |

Řádky F3b/F6 v tabulce výše popisují **stav před večerním scrubem**; číselné
drifty (`lib.rs` LoC, počty testů, pre-commit) byly **sjednoceny v `StatusV3.md`**
(údržba 2026-05-12).

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
- Pre-commit hook **existuje** (3 183 B). Dřívější návrh statusu „přidat
  pre-commit" je **stale** — `StatusV3.md` k 2026-05-12 sjednoceno.

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

8. **`StatusV3.md` refresh (čísla + TL;DR + roadmap)** — 🟢 **část hotová**
   (sjednocení 2026-05-12); při změně testů znovu přepočítat `#[test]` statistiky.
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

## 10. Závěr Part 2 (sjednoceno 2026-05-12)

> **Ranní verze tohoto dokumentu** tvrdila, že F3b/F6 jsou otevřené vůči
> `main` HEAD — to odpovídalo **důkazům na `27d9c9e0`**. Večerní **cleanup**
> (`git filter-repo`, rotace, force-push) tento rozpor **odstranil z
> `origin/main`**. Kanonický popis současného stavu je v **`StatusV3.md`**.

Kódový závěr **release-candidate** ✅ zůstává. Bezpečnostní závěr **„F3b/F6
false ✅"** platil jen pro **pre-scrub** tree a je zde **zachován jako audit
trail** v §1. Pro nový klon `main` po 2026-05-07 ověř existenci leaked cest přes
`git grep` / prázdný výsledek v aktuálním worktree — viz také `StatusV3.md` §2
P0.

---

## 11. Doporučené následné PR (Part 2 sekvence)

| # | PR (návrh) | Velikost | Závisí na | Stav |
|---:|---|---|---|---|
| **K** | `chore(security): redact docs/docs2.9/ZION_KEYS/ + remove V3-src*.tar/zip from working tree` | XS | — | 🟢 **superseded** — řešeno `filter-repo` 2026-05-07 |
| **L** | `chore(security): git filter-repo history rewrite (one-shot)` | XS code / L coord | K + rotace klíčů uživatelem | 🟢 **hotové** 2026-05-07 |
| **M** | `docs(status): refresh StatusV3.md drift (lib.rs LoC, test counts, F3b/F6, pre-commit)` | S | K, L | 🟢 **část hotová** (2026-05-12 sjednocení s Part 2) |
| **N** | `chore(repo): tag v3-mainnet-rc1 at 89ba3730` | XS | K, L, M | 🟡 plán — po rewrite hledat commit podle message |
| **O** | `chore(gitignore): add *.err and remove local-stack-*.err residue` | XS | — | 🟢 **hotové** (cleanup log) |
| **P** | `audit(core): unwrap/expect sweep — top-10 panic hot-paths` | M | — | 🟡 plán P2 |
| **Q** | `feat(bridge): enforce ANKR_API_KEY in startup; fail-fast on missing` | S | — | 🟡 plán P1 |
| **R** | `chore(workspace): isolate legacy root Cargo.toml under legacy/` | L | M | 🟡 P3 |

**Critical path k bezpečnému Genesis #0 (aktualizováno):**
**~~rotace + K → L → M~~** ✅ dokončeno 2026-05-07 → zbývá **tag N**, **bridge ops**
(validátory, threshold), **deploy** (viz §8 P1).

---

> *Part 2 audit: ranní nález dokončen 2026-05-07 21:51 +02:00 (HEAD `27d9c9e0`);
> cleanup téhož dne večer; dokument sjednocen s `StatusV3.md` 2026-05-12.*
