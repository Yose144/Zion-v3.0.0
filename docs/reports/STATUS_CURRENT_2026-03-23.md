# ZION TerraNova — Aktuální stav projektu

**Datum:** 23. března 2026  
**Repo baseline:** Cargo workspace 2.9.6  
**Public release line:** Website + desktop-agent 2.9.9 "Pure Code"  
**Canonical runtime path:** 2.9.8 Deeksha/Ekam  
**Infrastruktura:** jeden veřejný host 91.98.122.165 (Zion2) + interní seed kontejnery

---

## Souhrn

Projekt je po březnových úpravách výrazně konzistentnější než při stavu z 12. 3. 2026. Live website, Docker a síťová topologie jsou už převážně srovnané na single-host model a website mluví s aktuálním testnet stackem správným TCP JSON-RPC způsobem.

Největší aktuální rizika už nejsou primárně runtime breakage, ale provozní hygiena a release řízení:

1. tracked secrets / pseudo-secrets v konfiguračních souborech
2. nejednotné vysvětlování verzí 2.9.6 vs 2.9.8 vs 2.9.9
3. network API na webu, které vypadá multi-node, ale reálně je single-source
4. vysoký warning budget v L2/L3 a částech testů

---

## Co je teď potvrzené jako funkční

- Website používá správný raw TCP JSON-RPC model proti V3 testnet stacku na portu 8332.
- Veřejná topologie je konsolidovaná na host 91.98.122.165; interní seed kontejnery zůstávají za stejným hostem.
- Ekam/Deeksha GPU backendy jsou přítomné napříč Metal, OpenCL a CUDA cestami.
- Desktop packaging flow zůstává opřený o scripts/prepare-rust-miner.js a stále drží bundling mineru pohromadě.

---

## Verze a jejich význam

| Oblast | Aktuální hodnota | Význam |
|--------|------------------|--------|
| Cargo workspace | **2.9.6** | repo baseline a vývojová linie monorepa |
| Website package/runtime | **2.9.9** | veřejná release line a produktové označení webu |
| Desktop-agent package | **2.9.9** | veřejná release line desktop klienta |
| Canonical mining/runtime path | **2.9.8 Deeksha/Ekam** | provozní kompatibilitní a algoritmická linie používaná napříč mining cestami |
| V3 clean-room line | **separátní track** | čistá mainnet větev, ne přímé přeznačení root workspace |

### Praktická interpretace

- Když se mluví o repu a Cargo workspace, správná baseline je **2.9.6**.
- Když se mluví o veřejném webu a desktop buildu, aktuální public label je **2.9.9 "Pure Code"**.
- Když se mluví o kanonické mining/runtime cestě, stále se opírá o **2.9.8 Deeksha/Ekam** kompatibilní linii.

Tato trojice není sama o sobě bug, ale musí být vysvětlena jednotně, jinak vznikají falešné release rozpory.

---

## Infrastruktura

| Komponenta | Stav |
|------------|------|
| Website | produkce na Zion2 |
| Testnet core / pool | běží v single-host Docker topologii |
| Seed nodes | interní kontejnery za Zion2 |
| Monitoring | nasazen v Docker stacku |

Historická tříuzlová topologie Helsinki/USA/Asia už není aktivní provozní realita. Zůstává pouze v historických dokumentech a starších referencích.

---

## Opravy provedené k 23. 3. 2026

1. Z tracked template/config souborů byly odstraněny explicitní Ankr hodnoty a nahrazeny placeholdery.
2. Bridge testnet config už neobsahuje commitnutý L1 RPC token a očekává doplnění aktuální hodnoty mimo git.
3. Veřejné docs entrypointy byly zpřesněny tak, aby odlišovaly repo baseline 2.9.6, public line 2.9.9 a canonical runtime 2.9.8.

---

## Otevřené problémy

### P0

1. Ověřit, zda dříve commitnuté klíče nebyly aktivně používány; pokud ano, rotovat je mimo repo.

### P1

1. Rozhodnout, jestli network API na webu zůstane přiznaně single-host, nebo dostane skutečné per-node dotazování.
2. Sjednotit release komunikaci i v dalších UI textech, kde stále zůstává směs 2.9.8 a 2.9.9 popisů.

### P2

1. Snížit warning budget v L2/dao a L3/warp, aby nové regresní signály nezanikaly ve starém šumu.

---

## Doporučený další postup

1. Projít všechny veřejné website texty a dashboard copy, které stále míchají 2.9.8 a 2.9.9 bez vysvětlení.
2. Rozhodnout release story pro desktop-agent updater a publish target, protože package metadata je 2.9.9, ale distribuční repo zůstává 2.9.6.
3. Až po tomto rozhodnutí dělat širší rename nebo tag-cleanup v UI a release artefaktech.