# ZION TerraNova — Project Audit

**Datum:** 23. března 2026  
**Rozsah:** celý workspace `/Users/yeshuae/Projects/2.9.6` po posledním `git pull --ff-only origin main`  
**Metoda:** read-only audit aktuálních souborů, runtime konfigurací, compile/lint signálů a cross-check mezi website, desktop-agentem, L1/L2/L3 a Docker stackem

---

## 1. Executive Summary

Projekt je ve výrazně konzistentnějším stavu než při auditech z 12. března 2026.

Největší dřívější problémy byly z větší části odstraněny:

- website už mluví s V3 testnet stackem přes správný TCP RPC model na portu 8332
- public docs a infrastruktura jsou z velké části srovnané na single-host topologii `91.98.122.165`
- Ekam/Deeksha GPU backendy jsou přítomné napříč Metal/OpenCL/CUDA a nejsou zjevně rozpadlé mezi kopiemi
- git pracovní strom je čistý, audit probíhal nad aktuálním stavem `main`

Aktuální problémy jsou méně o rozbitém runtime a více o:

1. **secrets/config hygiene**
2. **release/version drift mezi 2.9.6 / 2.9.8 / 2.9.9**
3. **web network API abstrahovaném jako multi-node, ale fakticky single-source**
4. **vysokém warning šumu v L2/L3 a testech**

---

## 2. High-Confidence Findings

### 🔴 F-01 — Reálně vypadající Ankr API klíč je commitnutý v tracked configu

**Soubory:**

- `docker/.env.example`
- `config/bridge-testnet.toml`

**Konkrétně:**

- `docker/.env.example` obsahuje explicitní hodnotu `ANKR_API_KEY=...`
- `config/bridge-testnet.toml` obsahuje explicitní `api_key = "..."`

**Proč je to problém:**

- Pokud je klíč platný, jde o únik tajného údaje.
- Pokud už neplatí, repo přesto šíří špatný vzor: „example“ a testnet config vypadají jako source of truth pro nasazení.
- Operátoři pak mohou považovat commitnutou hodnotu za podporovaný default.

**Verdikt:** aktivní bezpečnostní a provozní problém.

**Doporučení:**

- nahradit hodnotu placeholderem
- přesunout skutečný klíč výhradně do `.env` / secret store
- zvážit rotaci klíče, pokud je nebo byl aktivní

---

### 🟠 F-02 — Release/version story je nekonzistentní napříč workspace

**Soubory:**

- `Cargo.toml`
- `APP&WEB/website-v2.9/package.json`
- `APP&WEB/website-v2.9/src/lib/site.ts`
- `APP&WEB/desktop-agent/package.json`
- `docker/docker-compose.website.yml`
- `APP&WEB/website-v2.9/public/docs/v2.9.6/README.md`

**Aktuální stav:**

- Cargo workspace: `2.9.6`
- website package/runtime: `2.9.9` / `Pure Code`
- desktop-agent: `2.9.9`
- website docker image: `zion-website:2.9.9`
- public docs ještě místy tvrdí „current v2.9.8"

**Proč je to problém:**

- bug reporty, release komunikace a deploy status mluví o jiných verzích
- není jasné, jestli `2.9.9` je release line, product label, nebo skutečný workspace baseline
- starší vysvětlení „workspace 2.9.6 / release 2.9.8" už neodpovídá novému web/desktop stavu

**Verdikt:** latentní release-management problém, ne aktivní runtime breakage.

**Doporučení:**

- explicitně definovat `workspace baseline`, `runtime release line`, `public product label`
- stejnou terminologii propsat do website, desktop-agentu a docs
- doplnit nový status dokument nebo update stávajícího `STATUS_CURRENT_2026-03-12.md`

---

### 🟠 F-03 — Website `network` API je navržené jako multi-node, ale data bere fakticky z jednoho zdroje

**Soubory:**

- `APP&WEB/website-v2.9/src/app/api/network/route.ts`
- `APP&WEB/website-v2.9/src/lib/network-config.ts`
- `APP&WEB/website-v2.9/src/lib/zion-rpc.ts`
- `APP&WEB/website-v2.9/src/lib/site.ts`

**Co se děje:**

- endpoint iteruje přes `SeedNodeConfig[]`
- pro každý node ale volá stejný `getZionRpc()` klient
- pool data se berou vždy přes `SITE_PRIMARY_POOL_API_URL`
- aktuálně to nevadí, protože `network-config.ts` definuje jen jeden veřejný host

**Proč je to problém:**

- jakmile přidáš další veřejný node přes env JSON nebo config, endpoint začne působit jako per-node telemetry API
- ve skutečnosti ale nebude číst data per-node, nýbrž přes shared failover klient a single primary pool API

**Verdikt:** latentní architektonický problém, zatím bezpečný díky single-host topologii.

**Doporučení:**

- buď endpoint poctivě definovat jako `single-host network status`
- nebo změnit `getNodeStatus()` tak, aby používal explicitní host/port z konkrétního nodu a ne sdílený klient bez per-node cílení

---

### 🟠 F-04 — Desktop-agent metadata a publish target nejsou ve stejné release linii

**Soubory:**

- `APP&WEB/desktop-agent/package.json`

**Aktuální stav:**

- package version: `2.9.9`
- description: `v2.9.9 Desktop Mining Agent`
- publish target: GitHub `Yose144/2.9.6`

**Proč je to problém:**

- artefakty a updater se budou tvářit jako `2.9.9`, ale distribuční kanál je pořád ukotvený ve staré repozitářové linii
- to je snadný zdroj záměny při release nebo rollbacku

**Verdikt:** latentní release/distribution problém.

**Doporučení:**

- sjednotit publish story s aktuální release linií
- pokud je `2.9.6` repo záměrný workspace baseline, zdokumentovat to přímo v package/release procesu

---

### 🟡 F-05 — `.env.example` už není čistý template, ale směs placeholderů a konkrétních nasazovacích hodnot

**Soubory:**

- `docker/.env.example`

**Konkrétně:**

- placeholder hesla jsou v pořádku
- ale `SEED_PEERS=91.98.122.165:8334` a explicitní `ANKR_API_KEY=...` posouvají template směrem k pseudo-produkčnímu configu

**Proč je to problém:**

- špatně se rozeznává, co je povinný placeholder a co je jen lokální operativní default
- zhoršuje to přenositelnost a bezpečnostní hygienu

**Verdikt:** provozní/config hygiene problém.

---

### 🟡 F-06 — Warning budget v L2/L3 a testech je stále vysoký

**Oblasti s nejvíce warningy:**

- `L2/dao/src/api.rs`
- `L2/dao/src/l1_scanner.rs`
- `L3/warp/src/adapter/*.rs`
- `L3/warp/src/xp_bridge.rs`
- několik test suite v `L1/core/tests` a `L1/pool/tests`

**Typy warningů:**

- `dead_code`
- `unused_imports`
- `unused_variables`
- `deprecated` použití ve starších testech
- `duplicate_macro_attributes`
- `non_snake_case` v JSON bridge/adaptérových strukturách

**Proč je to problém:**

- nové regresní signály se ztrácejí v existujícím warning šumu
- review a audit pak hůř rozlišují mezi „starý šum" a „nová chyba"

**Verdikt:** kvalita kódu / auditability problém, ne okamžitý runtime blocker.

---

## 3. Ověřené Pozitivní Nálezy

### ✅ P-01 — Website RPC port/protocol je aktuálně konzistentní s V3 testnet stackem

Původní podezření na port mismatch se **nepotvrdilo**.

- website používá `SITE_PRIMARY_RPC_PORT = 8332`
- `zion-rpc.ts` mluví raw TCP JSON-RPC, ne HTTP
- V3 testnet compose publikuje raw RPC právě na `8332`

To odpovídá současnému V3 testnet modelu.

---

### ✅ P-02 — Ekam GPU backendy jsou přítomné napříč hlavními platformami

Bylo ověřeno, že existují entrypointy:

- Metal: `cosmic_harmony_ekam_mine`
- OpenCL: `ekam_deeksha_mine`
- CUDA: `ekam_deeksha_mine`

Tím padá dřívější hypotéza, že Metal Ekam path v aktuálním stromu chybí.

---

### ✅ P-03 — Desktop packaging script stále drží důležitou sync logiku pohromadě

`APP&WEB/desktop-agent/scripts/prepare-rust-miner.js` pořád plní roli hlavního bundling gate pro Rust miner a resource sync. To zůstává správný směr i po nových změnách.

---

## 4. Co Tento Audit Nepotvrdil Jako Aktivní Breakage

Následující oblasti aktuálně nevypadají jako rozbitý runtime:

- website ↔ V3 RPC protokol
- přítomnost Ekam GPU kernelů napříč platformami
- čistota pracovního stromu po posledním pullu
- základní compile/lint kontrola website oblastí, které byly dříve problémové

To neznamená, že jsou perfektní, ale nejsou to teď nejtvrdší blokery.

---

## 5. Prioritizace Oprav

### P0 — Opravit ihned

1. odstranit commitnutý Ankr klíč z tracked configů a nahradit placeholderem
2. zrevidovat, zda klíč nebyl použit produkčně, a případně jej rotovat

### P1 — Další krok

3. sjednotit release/version vocabulary pro `2.9.6 / 2.9.8 / 2.9.9`
4. doplnit nový kanonický status dokument pro stav k 23. 3. 2026

### P2 — Architektura / čistota

5. rozhodnout, zda `api/network` zůstane single-host endpoint, nebo bude skutečně per-node
6. snížit warning budget v L2/L3, začít od `L2/dao` a `L3/warp`

---

## 6. Doporučené Další Kroky

Pokud bude navazovat implementační session, dává smysl tento pořadí:

1. **Security hygiene pass** — Ankr key + config cleanup
2. **Release naming pass** — website + desktop + docs + compose labels
3. **Network API refactor** — přiznat single-host nebo dopracovat per-node reads
4. **Warning reduction pass** — jen high-signal moduly, ne plošný beautify

---

## 7. Kontext k předchozím auditům

Tento report navazuje na:

- `docs/STATUS_CURRENT_2026-03-12.md`
- `docs/DOC_VS_CODE_ANALYSIS_2026-03-12.md`

Rozdíl proti 12. březnu:

- hlavní drift v docs/topologii už není dominantní problém
- novým hlavním tématem je release coherence, config hygiene a auditability
