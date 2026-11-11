# REPORT — autonomní fronta 2026-11-11 (večer): git sjednocení, 9.B4 sada, Miner↔NCL, hygiena

> **Zadání 👤:** „projeď projekt edge1,2 a autonomní plány… udělej git pull a push, ať vše sjednotíme"
> → „rozjeď autonomní frontu" → „vše" → „report a pushni vše".
>
> **Rozsah:** read-only sondy EDGE1/EDGE2, git konsolidace, release artefakty,
> jeden nový kód (NCL spike), hygiena. **Žádný produkční deploy** — G8 okno
> do 6. 12. běží, takže se nesahalo na required služby (pool, nody, multichain,
> dao, zis).

---

## 1. Git — sjednocení linií

`main` a `feat/engine-b-visual-upgrade` se rozešly (21 vs 18 commitů) a nebyl
to artefakt rebase: **větev nesla práci, která už běžela na produkci**
(Engine B `3e82f7499`, aréna mapy proto 38, Lumi motiv), ale v `main` chyběla.
Přesně past popsaná v `AGENTS.md` („commit, který žije jen na vedlejší linii
a přitom je na produkci").

| Krok | Výsledek |
|---|---|
| Lumi WIP (30 souborů, světlý/tmavý motiv + nginx) | `71668a992` — `tsc` 0, `npm run build` OK |
| merge `origin/main` → větev | `76c4a4aa1`, **8 konfliktů** vyřešeno |
| `main` fast-forward + push | `main` = větev = `origin` |
| vzdálená větev fast-forwardnuta na `main` | divergence nemůže vzniknout znovu |

**Jak se konflikty řešily (ne „vezmi jednu stranu"):**

- `protocol.ts` → `PROTO_VERSION = 38` (mapy z větve i powerupy z 37 zůstávají).
- `map.ts` → výšky powerupů `3.1` (z nav commitu), registry map z větve
  + `ARENA_SOLO_PICKUPS`/`ARENA_SOLIDS` z main.
- `arena-bots.mjs` → pozice LOS testu na `x=-10` (nový půdorys mapy).
- `nirvana/AGENTS.md`, `mars/page.tsx` → nové sekce z větve (main tam nic neměl).
- `MarketPlace/HeroSection.tsx` → **z main** (novější Lumi hero).
- `website-v2.9/Hero.module.css`, `HeroSlider.tsx` → **z větve** (zmenšený hero,
  Kingdom slide pryč; main je od základu nezměnil).

---

## 2. Release artefakty 9.B4 — ✅ celá sada

Podrobně [`REPORT_2026-11-11_RELEASE_MACOS.md`](REPORT_2026-11-11_RELEASE_MACOS.md).

**6 artefaktů, všechny `--verify` PASS**, `tree_state: clean`, `--isolate`
z commitu `df4dc3296` (linux o jeden commit později `a97071e45`, ale
`git diff … -- V31` je prázdné → V31 kód totožný):

| Adresář | Artefakty |
|---|---|
| `dist/v3.2.0-rc-w1.5-macos/` | `x86_64-apple-darwin` (+gpu-metal), `aarch64-apple-darwin` (+gpu-metal) |
| `dist/v3.2.0-rc-w1.5-linux/` | `x86_64-unknown-linux-gnu` — **max `GLIBC_2.29`** |
| `dist/v3.2.0-rc-w1.5-win/` | `x86_64-pc-windows-gnu` — 4× `PE32+` |

Každý tarball ~16–18 MB: `zion-miner`, `zion-node`, `zion-migrate`, `zion`
+ `BUILD-INFO.txt` (commit, `tree_state`, `locked`, rustc/cargo, SHA256 binárek).
Adresáře mají `RELEASE-MATRIX.json` + `SHA256SUMS`. `dist/` je gitignored.

### Dvě chyby builderu, které to odhalilo

1. **`5a9e41a40` — varianta se shodným jménem tiše ztrácela features.**
   `[ "$variant" = "$features" ] && features=""` mělo pokrýt jen `--variant
   default`, ale spustilo se i pro `gpu-metal:gpu-metal` → GPU varianta se
   **zkompilovala bez feature flagu** a jen přejmenovala (dva identické CPU
   balíčky). Odhalil verifier (`BUILD-INFO features mismatch`); důkaz v logu:
   0 zmínek o „metal".
2. **`--zig` + `AR` override.** Docker na Macu není, takže linux šel přes
   `cargo zigbuild` s pevnou glibc baseline. `cargo-zigbuild` 0.23 ale padá
   na `ring`/`aws-lc-sys` (`ar: unable to open …libring_core….a`) — nutné
   `AR_x86_64_unknown_linux_gnu=/usr/bin/ar` a `RANLIB_…=/usr/bin/ranlib`.

**Zbývá:** finální rebuild všech targetů z RC commitu (tag `v3.2.0` = 👤 9.S1).

---

## 3. Miner ↔ NCL — opt-in spike (mezera N3 z `V33_GAP_ANALYSIS.md`)

Do teď platilo: „`V31/L1/miner` nemá žádnou referenci na NCL — mineři AI práci
neprovádějí". Teď existuje celý řetěz `job → worker → complete` a je otestovaný
end-to-end. Je to **spojení, ne nová schopnost** — skutečné inferenční backendy
(ONNX/WASM/TFLite) jsou další krok.

**Server (`V31/L3/ncl`):**

- `GET /jobs/next/:worker_id` — pull: `200` + job, `204` prázdná fronta,
  `404` jen neznámý worker (miner polluje každé 3 s, prázdný poll není chyba).
- `JobScheduler::claim_next_for()` — stejný výběr jako `try_assign_next`
  (priorita → stáří), ale workera určuje volající; respektuje backend,
  `min_consciousness` i kapacitu.
- `POST /workers` bere volitelné `id` (dřív server id vždy přegeneroval →
  pull worker se po restartu nepoznal); re-registrace zachová čítače.
- `ComputeBackend` má `serde(alias)` na malá jména — E2E odhalil, že
  case-sensitive enum shazoval registraci na 422.

**Miner (`V31/L1/miner/src/ncl.rs`):**

- env kontrakt `ZION_NCL_*`, **default OFF** (`ZION_NCL_ENABLED=1`) — bez
  zapnutí miner neposílá ani jeden požadavek navíc a PoW jede beze změny
- `maybe_spawn()` idempotentní (`Once`), volá se z `run()` i `run_v3_trinity()`
- **žádná odměna na mainnetu:** `reward_flowers` se jen loguje, modul nedrží
  klíč ani nepodepisuje tx → „reward jen regtest" je splněno tím, že payout
  cesta neexistuje
- výpočet záměrně triviální (`blake3(input_hash)`), aby spike nekonkuroval těžbě

**Testy:** NCL **50/50** (bylo 44), miner modul **6/6**, **E2E** `tests/ncl_e2e.rs`
proti reálnému axum serveru (registrace pod vlastním id → claim → complete →
`output_hash` sedí → další poll 204) — 0,27 s.

---

## 4. Kvalita kódu

- **`cargo fmt`:** drift 144 hunků ve 41 souborech (docs vedly „25" — kumulovalo
  se) → `a254a1bd9` čistý. Po `clippy --fix` vznikl nový drobný drift, dorovnáno
  `7ec328929` (transparentně: první commit to tvrdil předčasně).
- **`clippy`:** ~110 → **46** varování. Zbytek je strukturální
  (`too_many_arguments`, `field_reassign_with_default`), ne mechanika.
  Z `--fix` jsem **vrátil jednu věc**: v `derive_addr.rs` (SLIP-0010 cesty
  Solany) přepsal `0 | HARD` na `HARD` — číselně totéž, ale v auditu derivační
  cesty chci explicitní index (`#[allow(clippy::identity_op)]` + komentář).
- **Dva pre-existující červené testy** (ověřeno `git stash`): intent lifecycle
  volal `execute_intent`, které odmítá in-memory AMM hop; `dex.inmemory_amm`
  je produkční default `false` a testy si ho nikdy nezaply — chybová zpráva to
  sama radí. Opraveno v `tests/server.rs`, `tests/service.rs` (5×) a
  `tests/solver_network_http.rs` → multichain **838/838**.

---

## 5. Živé sondy (read-only, 11. 11. ~19:00)

| | EDGE1 `vmi3425821` | EDGE2 `vmi3684458` |
|---|---|---|
| `zion-*` běží / failed | 15 / **0** | 24 / **0** |
| Disk | 64 % (93/145 G) | 58 % (112/193 G) |
| Chain tip | **119 483** (3/3 RPC porty shodné) | dtto |
| Pool | `ece8b6965`, 4 274 accepted / 0 rejected | standby parita |

- **G8 run #7:** 99,918 %, evidence 100 %, `pending`, do 6. 12. 14:51Z,
  **6 incidentů 60 s** (5× `chain_live` 8.–9. 11. + `pool_stratum` 11. 11.
  14:27Z). 0 firing alertů, `payouts_api_ok=1`, `last_payout_age=14 s`.
- Public HTTPS 9/10 200 (`auth.` root = 404 je normální, `/health` + JWKS 200).
- Nirvana **proto 38** = repo=live (`proto_match:true`).
- **Mac disk** se uvolnil z 100 % na 15–22 GB → odblokovalo to release buildy.

---

## 6. Nalezené a opravené chyby (mimo hlavní proud)

| Chyba | Dopad | Fix |
|---|---|---|
| Flaky test arény (1/10) — tři chyby v mozku bota: `Math.random`, skok do zdi vyšší než dosah, mrtvá zóna waypointu + strafe během přesunu | bot občas nevyšel na plošinu | `ab9aca900`, `arena-maps` 10/10; pravidla v `apps/nirvana/AGENTS.md` |
| Builder tiše zahodil features u `gpu-metal:gpu-metal` | dva identické CPU balíčky, jeden vydávaný jako GPU | `5a9e41a40` |
| `intro-tabs.js` načtený dvakrát (`next/script` + raw `<script defer>`) | taby se přepínaly dvakrát („nic") | `318d103c8` |
| NCL `POST /workers` ignoroval klientské `id` | pull worker se po restartu nepoznal | `9b7eace82` |
| NCL backend case-sensitive (`Custom` vs `custom`) | registrace 422, miner tiše nic neodebral | aliasy + kanonický název |
| Intent testy bez `dex.inmemory_amm` | 4 červené testy v multichain | součást `df4dc3296` |

---

## 7. Co zůstává otevřené

**👤 operátor:**

- **Tag `v3.2.0` (gate 9.S1)** → finální rebuild všech targetů z RC commitu.
- Zvážit, zda Intel `gpu-metal` varianta má smysl (matice v AGENTS uvádí pro
  macOS x86_64 `gpu-opencl`).

**🤖 autonomní (další kolo):**

- 46 zbylých clippy varování — strukturální refaktor (argumenty, Default).
- `zion-pool stratum::tests::pearl_stratum_end_to_end` je červený **i bez
  mých změn** (čeká 5 s na `mining.notify`, nedostane ho) — samostatná
  investigace.
- Skutečné NCL inferenční backendy (ONNX/WASM/TFLite) nad hotovým řetězem;
  dnes je „compute" jen `blake3(input_hash)`.

---

## 8. Reprodukce

```bash
# release artefakty (Mac, bez Dockeru)
AR_x86_64_unknown_linux_gnu=/usr/bin/ar \
RANLIB_x86_64_unknown_linux_gnu=/usr/bin/ranlib \
  scripts/ops/build-release-artifacts.sh --version v3.2.0-rc-w1.5-linux \
  --from-commit HEAD --target x86_64-unknown-linux-gnu --zig 2.31 --isolate

CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER=x86_64-w64-mingw32-gcc \
  scripts/ops/build-release-artifacts.sh --target x86_64-pc-windows-gnu --isolate

# ověření sady
scripts/ops/build-release-artifacts.sh --verify dist/v3.2.0-rc-w1.5-linux

# NCL spike
cd V31 && cargo test -p zion-ncl --lib && cargo test -p zion-miner --lib ncl \
  && cargo test -p zion-miner --test ncl_e2e

# aréna (deterministické)
cd apps/nirvana && npx tsx test/arena-maps.mjs
```

---

## 9. Commity této session

`71668a992` Lumi motiv · `76c4a4aa1` merge linií · `ab9aca900` bot navigace ·
`48a7fc65e` pravidla bota · `43534c4fc` truth-sync · `a254a1bd9` cargo fmt ·
`9cd5e0400` 30 motivů A3 · `5a9e41a40` builder features · `2d8bc9abd` macOS
artefakty · `ad6d3bac8` StatusV3 · `9b7eace82` NCL spike · `19df71e78` builder
`--zig` · `df4dc3296` clippy + testy · `a31946f75` 9.B4 kompletní ·
`7ec328929` fmt po clippy · `d458ecfa1` upřesnění reportu · `5c908ae2b`
vánoční filigrán · `318d103c8` intro double-load fix.

**Produkce nebyla nasazena ani restartována.** `/memories` netřeba: vše je
v tomto reportu a v `PLAN.md` / `StatusV3.md` / `DOC_VS_CODE_ANALYSIS_2026-11-10.md`.
