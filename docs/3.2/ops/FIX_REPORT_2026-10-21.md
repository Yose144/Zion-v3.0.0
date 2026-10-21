# Opravný report — ZION TerraNova (2026-10-21)

## Souhrn

Opraveny 7 chyb napříč Rust workspace (V31) a TypeScript frontendy (website-v2.9, MarketPlace). Všechny změny projít `cargo check --workspace`, `cargo test` (dotčené crates), `cargo clippy` (žádné nové chyby, pouze pre-existing varování) a `tsc --noEmit` (0 chyb v obou projektech).

---

## 1. Rust — V31 workspace (`V31/`)

### 1.1 `qpow_probe` binárka bez `required-features` — `V31/L1/miner/Cargo.toml`

**Problém:** Binárka `qpow_probe` je auto-discovered bez `required-features`, ale importuje feat-gated typ `zion_miner::gpu::QpowGpuMiner` (dostupný jen s `gpu-cuda`/`gpu-opencl`/`gpu-metal`). Kompilace bez GPU feature padala s `E0432: unresolved import`.

**Oprava:** Přidán `required-features = ["gpu-opencl"]` u definice `[[bin]]` pro `qpow_probe`, vzorem dle existujícího `pearl_pool_probe` (`gpu-cuda`).

**Soubor:** `V31/L1/miner/Cargo.toml`

### 1.2 Chybějící pole `store` v `NclAppState` — `V31/L3/ai-native/src/bin/zion-ai-native-api.rs:268`

**Problém:** `NclAppState` (definováno v `V31/L3/ncl/src/api.rs:51`) má povinné pole `store: Option<JobStore>`, které chybělo v inicializačním literálu v `zion-ai-native-api.rs`. Kompilace padala s `E0063: missing field store`.

**Oprava:** Přidáno `store: None` do inicializačního literálu.

**Soubor:** `V31/L3/ai-native/src/bin/zion-ai-native-api.rs`

### 1.3 Stejný problém v doctestu — `V31/L3/ncl/src/api.rs:26`

**Problém:** Doctest v `api.rs` vytvářel `NclAppState { scheduler, reputation }` bez pole `store`, což způsobovalo chybu při spouštění doctestů.

**Oprava:** Upraveno na `NclAppState { scheduler, reputation, store: None }`.

**Soubor:** `V31/L3/ncl/src/api.rs`

---

## 2. TypeScript — `website-v2.9` (`APP&WEB/website-v2.9/`)

### 2.1 `src/app/api/prl/route.ts:140` — redundantní `_error` check na narrowed typu

**Problém:** `typeof blocks === 'number' && !blocks?._error` — po narrowingu na `number` typ nemá pole `_error`, TS hlásil `TS2339: Property '_error' does not exist on type 'number'`.

**Oprava:** `const rpcOk = typeof blocks === 'number'`.

**Soubor:** `APP&WEB/website-v2.9/src/app/api/prl/route.ts`

### 2.2 `src/app/maitreya/library.ts:144` — neexistující vlastnost `desc`

**Problém:** Objekt literal používal `desc:` místo `description:` dle typu `CompanionDoc` (definováno v řádku 99–109). TS hlásil `TS2353: Object literal may only specify known properties, and 'desc' does not exist in type 'CompanionDoc'`.

**Oprava:** Přejmenováno na `description`.

**Soubor:** `APP&WEB/website-v2.9/src/app/maitreya/library.ts`

### 2.3 `src/components/StarfieldBackground.tsx:219` — redundantní podmínka po early return

**Problém:** Na řádku 214 je `if (document.visibilityState === 'hidden') return;`, takže na řádku 219 podmínka `document.visibilityState !== 'hidden'` je vždy true. TS hlásil `TS2367: This comparison appears to be unintentional because the types '"visible"' and '"hidden"' have no overlap`.

**Oprava:** Odstraněna redundantní podmínka `&& document.visibilityState !== 'hidden'`.

**Soubor:** `APP&WEB/website-v2.9/src/components/StarfieldBackground.tsx`

### 2.4 `e2e/passkey.spec.ts:170` — `as` cast z potenciálně `null`

**Problém:** `verifyPayload` může být `null` (dle typu), ale přímý `as` cast bez `unknown` mezilehlého typu. TS hlásil `TS2352: Conversion of type 'null' to type '{ ... }' may be a mistake`.

**Oprava:** `as unknown as { ... }`.

**Soubor:** `APP&WEB/website-v2.9/e2e/passkey.spec.ts`

---

## 3. Validace

| Příkaz | Výsledek |
|--------|----------|
| `cargo check --manifest-path V31/Cargo.toml --workspace` | ✓ Žádné chyby |
| `cargo test -p zion-miner -p zion-ai-native -p zion-ncl` | ✓ 0 selhání |
| `cargo clippy --manifest-path V31/Cargo.toml --workspace --all-targets` | ✓ Pouze pre-existing varování |
| `cargo fmt --check` | ✓ Žádné rozdíly v změněných souborech |
| `npx tsc --noEmit` (website-v2.9) | ✓ 0 chyb |
| `npx tsc --noEmit` (MarketPlace) | ✓ 0 chyb |
| `npx eslint` (změněné TS soubory) | ✓ 0 chyb |

---

## 4. Nasazení

### Web (website-v2.9)
- Změněné soubory nasazeny na Edge (`62.171.141.136`) do `/opt/zion/APP&WEB/website-v2.9/`
- Restart služby `zion-website.service`
- Ověřeno: `curl https://app.zionterranova.com/` → 200

### Rust (V31)
- Změny vyžadují rebuild binárek na Edge (viz `V31/AGENTS.md` §12 Edge V31 manual deploy)
- `cargo build --release -p zion-core -p zion-pool -p zion-miner -p zion-dao -p zion-multichain` na Edge
- `systemctl restart zion-v31-node zion-v31-pool zion-v31-multichain zion-v31-dao`

---

## 5. Seznam změněných souborů

1. `V31/L1/miner/Cargo.toml` — `required-features` pro `qpow_probe`
2. `V31/L3/ai-native/src/bin/zion-ai-native-api.rs` — `store: None` v `NclAppState`
3. `V31/L3/ncl/src/api.rs` — `store: None` v doctestu
4. `APP&WEB/website-v2.9/src/app/api/prl/route.ts` — odstraněn `blocks?._error`
5. `APP&WEB/website-v2.9/src/app/maitreya/library.ts` — `desc` → `description`
6. `APP&WEB/website-v2.9/src/components/StarfieldBackground.tsx` — odstraněna redundantní podmínka
7. `APP&WEB/website-v2.9/e2e/passkey.spec.ts` — `as unknown as` cast
