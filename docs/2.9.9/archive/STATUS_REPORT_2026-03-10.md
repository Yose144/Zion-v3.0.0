# STATUS REPORT 2026-03-10

> Update 2026-03-11: live Ekam Deeksha rollout na 91.98.122.165 je dokončen a ověřen.

## Kontext dne

Tento dokument shrnuje aktuální stav repozitáře k 10. březnu 2026 a slouží jako root-level zdroj pravdy pro dnešní technickou práci.

Hlavní směr dnešních změn:

- konsolidace infrastruktury na nový primární host 91.98.122.165
- přepnutí testnet stacku a dokumentace do pure-ZION režimu
- odstranění aktivních revenue runtime větví tam, kde nemají být defaultem
- dotažení desktop-agentu pro Deeksha a kanonický pool flow
- aktualizace website vrstvy, aby už neukazovala starou multi-node topologii jako live realitu
- doplnění testů, podpůrných instrukcí a nových dokumentačních vstupů

## Addendum — 2026-03-11: Ekam desktop-agent GPU

Po tomto status reportu byla dokončena další důležitá vrstva 2.9.8 desktop-agent integrace: **nativní Ekam Deeksha GPU path přímo v agentu**.

Aktuální ověřený stav:

- `APP&WEB/desktop-agent/resources/mining/cosmic_harmony_v42_gpu.py` nyní preferuje Ekam shader a entrypointy místo legacy CHv4 symbolů.
- `APP&WEB/desktop-agent/scripts/prepare-rust-miner.js` synchronizuje canonical GPU assety z `L1/native-libs/all/` do desktop resources.
- Metal shader `cosmic_harmony_ekam_deeksha.metal` byl opraven tak, aby se na Apple Silicon korektně kompiloval i při runtime build path.
- Desktop-agent bench přes `resources/mining/cosmic_harmony_deeksha_gpu.py` úspěšně inicializoval backend Metal s entrypointem `cosmic_harmony_ekam_mine`.
- Ověřený výsledek na Apple M1 je přibližně **5575.5 H/s**.

To znamená, že desktop-agent už má lokálně potvrzenou funkční native GPU Ekam cestu. Otevřené zůstává pouze plné end-to-end ověření Electron orchestrace a následná CPU↔GPU/pool parita v reálném běhu.

## 1. Infrastruktura a provozní topologie

Aktuální veřejný source of truth byl přesunut na host 91.98.122.165.

To se propsalo do těchto oblastí:

- SERVERS.md
- docs/ops/runbook.md
- docker/docker-compose.testnet.yml
- APP&WEB/website-v2.9/src/lib/site.ts
- APP&WEB/website-v2.9/src/lib/network-config.ts
- APP&WEB/website-v2.9/src/app/api/health/route.ts
- APP&WEB/website-v2.9/src/app/api/mission-data/data/route.ts

Praktický dopad:

- staré veřejné IP adresy 77.42.31.72, 178.156.240.160 a 5.223.43.93 už nejsou brané jako aktivní produkční source of truth
- website i runtime metadata nově popisují single-primary-host topologii
- monitoring a mission-data API už neprezentují starý 3-node public mesh jako aktuální live stav
- seed role jsou teď řešené interně přes kontejnery zion-seed-1 a zion-seed-2

## 2. Docker a chain stack

Soubor docker/docker-compose.testnet.yml byl změněn tak, aby odpovídal nové realitě.

Hlavní změny:

- core používá interní seed peers 172.29.0.11:8334 a 172.29.0.12:8334 místo starých veřejných IP
- přidány služby seed1 a seed2 na statických interních adresách 172.29.0.11 a 172.29.0.12
- pool nově mountuje config/ch3_zion_only_settings.json místo ch3_revenue_settings.json
- vypnuté revenue/XMR parametry v miner command větvi
- ZION_ENABLE_STREAM_SWITCH je nastaven na 0
- přidána ipam konfigurace bridge sítě a nové volumes pro seedy

Výsledek:

- testnet compose nyní reprezentuje pure-ZION default provoz na jednom hostu s interní seed topologií
- deploy model už nespoléhá na starou veřejnou multi-node infrastrukturu

## 3. Pool, miner a Rust runtime změny

V L1 vrstvách proběhla směs provozních a kompilátorově-čisticích změn.

### Pool runtime

Soubor L1/pool/src/main.rs nově zavádí runtime gating pro revenue subsystémy.

Konkrétně:

- revenue proxy, external miner, profit switcher, GPU revenue miner a buyback engine se spouští jen pokud je revenue runtime skutečně zapnutý v konfiguraci
- v pure-ZION konfiguraci se loguje explicitní zpráva o vypnutém revenue runtime

To je klíčové pro čistý ZION-only pool režim.

### Další L1 opravy

Tyto soubory obsahují menší, ale důležité úpravy:

- L1/core/src/bin/zion-wallet.rs
- L1/cosmic-harmony/src/engine.rs
- L1/miner/src/miner/cpu.rs
- L1/miner/src/miner/mod.rs
- L1/miner/src/miner/native_algos.rs
- L1/miner/src/ncl/mod.rs
- L1/pool/src/gpu_mining.rs
- L1/pool/src/merged_mining.rs
- L1/pool/src/profit_switcher.rs

Typ změn:

- nahrazení is_multiple_of kompatibilnějšími výrazy typu modulo nebo checked_rem
- aktivace dříve shadowed parametrů tam, kde jsou reálně potřeba
- oprava mutable deklarace seznamu algoritmů
- drobné bezpečnější kontrolní podmínky v target/hash logice

Smysl těchto změn:

- lepší kompatibilita buildů
- méně warningů a méně křehkého chování
- čistší základ pro 2.9.8 Deeksha běh

## 4. Pure-ZION konfigurační profil

Byl přidán nový soubor config/ch3_zion_only_settings.json.

Jeho účel:

- explicitně vypnout ETC, NXS, dynamic_gpu a NCL streamy
- ponechat aktivní pouze ZION stream
- mít auditovatelný a jednoduchý config pro pool pure-ZION nasazení

Tento soubor je dnes klíčovým konfiguračním bodem pro čistý pool runtime.

## 5. Desktop-agent: dnešní hlavní práce

Desktop klient v APP&WEB/desktop-agent byl výrazně srovnán s novým backendem.

### 5.1 Main process

Soubor APP&WEB/desktop-agent/src/main.js byl upraven tak, aby:

- používal kanonický host 91.98.122.165 jako výchozí pool, RPC a API backend
- rozpoznal pure-ZION desktop mode
- nespouštěl revenue CPU procesy v pure-ZION režimu
- nespouštěl GPU revenue procesy v pure-ZION režimu
- nespouštěl profit polling v pure-ZION režimu
- držel stejné chování nejen v hlavní CH3 větvi, ale i v CHv4.2 a Deeksha fallback cestách

Z pohledu runtime orchestrace to znamená, že desktop už defaultně nemigruje uživatele zpět do legacy revenue flow.

### 5.2 Renderer a UI

Soubory APP&WEB/desktop-agent/src/ui/renderer.js a APP&WEB/desktop-agent/src/ui/index.html byly upraveny tak, aby UI odpovídalo runtime chování.

Co se změnilo:

- renderer používá PRIMARY_TESTNET_HOST 91.98.122.165 a DEFAULT_RPC_URL odvozenou od tohoto hostu
- DEFAULT_REVENUE_PROFILE je nastaven jako pure-ZION default
- gpu-revenue mód se v pure-ZION režimu normalizuje zpět na dual
- při ukládání nastavení se revenue profil stáhne na 100 procent ZION
- revenue routing sekce se v pure-ZION režimu skrývá
- GPU Revenue card se v pure-ZION režimu skrývá
- multi-stream bar a revenue split badge se v pure-ZION režimu neukazují jako aktivní workflow
- CSP v UI nově povoluje canonical backend 91.98.122.165 místo starých pool hostů
- pool cards ve Settings byly zredukovány na canonical pool plus custom endpoint

Praktický výsledek:

- uživatel v desktop app už nevidí staré pool IP jako doporučený default
- UI nevnucuje XMR nebo revenue split jako primární režim
- desktop konfigurace líp odpovídá serverové pure-ZION konfiguraci

### 5.3 Mining resources a packaging

Změny zasáhly také tyto soubory a artefakty:

- APP&WEB/desktop-agent/resources/mining/cosmic_harmony_deeksha_fallback.py
- APP&WEB/desktop-agent/resources/mining/cosmic_harmony_v42_gpu.py
- APP&WEB/desktop-agent/resources/mining/libcosmic_harmony.dylib
- APP&WEB/desktop-agent/resources/mining/libzion_cosmic_harmony_v3.dylib
- APP&WEB/desktop-agent/resources/mining/libcosmic_harmony_deeksha.dylib
- APP&WEB/desktop-agent/scripts/prepare-rust-miner.js

To znamená, že dnešní práce nebyla jen UI patch, ale i reálné zarovnání packaged miner resource vrstvy s Deeksha/pure-ZION směrem.

## 6. Desktop-agent testy a kontrolní utility

Byly přidány dva pomocné testy:

- APP&WEB/desktop-agent/test/test_deeksha_share_parsing.js
- APP&WEB/desktop-agent/test_deeksha_target.py

Účel:

- ověřit parsování accepted/rejected share výstupu
- ověřit parse_target, meets_target a submit_nonce_hex logiku pro Deeksha fallback

Tyto testy pomáhají chránit dvě citlivé vrstvy:

- správnou interpretaci těžařského outputu v desktopu
- správnou target/nonce logiku v Python fallbacku

## 7. Website vrstva

Website v APP&WEB/website-v2.9 byla současně posunuta do nového public směru.

### 7.1 Live status a topologie

Tyto soubory nově reflektují single-primary-host realitu:

- src/app/api/health/route.ts
- src/app/api/mission-data/data/route.ts
- src/app/dashboard/page.tsx
- src/components/LiveDashboard.tsx
- src/lib/network-config.ts
- src/lib/site.ts

To znamená:

- web health endpoints už defaultně používají kanonické URL z centrálních konstant
- dashboard texty už nepopisují starou 3-node public síť jako live stav
- mission-data odpověď nově pracuje s primary node a interními seed kontejnery

### 7.2 Homepage a vizuální směr

Upravené soubory:

- src/components/BackgroundOrchestrator.tsx
- src/components/ClientBackgrounds.tsx
- src/components/CosmicFlowers.tsx
- src/components/GoldenEggHaraniagharba.tsx
- src/components/Hero.tsx
- src/components/HomeTreePortal.tsx

Hlavní posun:

- homepage je odlehčenější a méně agresivně render-heavy
- background orchestration má home variantu
- CosmicFlowers je zjednodušené a méně zatěžující
- Hero a Tree portal texty byly přepsány tak, aby fungovaly víc jako veřejný vstup a méně jako interní release poznámka
- Golden Egg blok byl rozšířen o EKAM / museum narrative směr

### 7.3 EKAM route a nové docs vstupy

Přidané soubory:

- APP&WEB/website-v2.9/src/app/ekam/layout.tsx
- APP&WEB/website-v2.9/src/app/ekam/page.tsx
- APP&WEB/website-v2.9/src/components/EkamMuseumLanding.tsx
- APP&WEB/website-v2.9/public/docs/mainnet/genesis-book.md
- APP&WEB/website-v2.9/public/docs/v2.9.6/dns.md

Další navazující úpravy:

- src/app/docs/page.tsx přidává Genesis Book do docs přehledu
- src/app/sitemap.ts přidává route /ekam

Smysl:

- rozšířit web o veřejnou EKAM / Golden Egg vrstvu
- mít dohledatelný genesis-book dokument v docs systému
- uložit DNS přemapování na nový primary host i jako textový artefakt v repu

## 8. Dokumentace a repo instrukce

Přibyly nebo se změnily tyto soubory:

- .github/copilot-instructions.md
- .github/instructions/desktop-agent.instructions.md
- SERVERS.md
- docs/2.9.8/DEPLOY_REPORT_2.9.8.md
- docs/ops/runbook.md

Význam:

- repo má explicitnější pracovní instrukce pro Copilot a desktop-agent oblast
- historický deploy report 2.9.8 je označen jako historický snapshot
- aktuální serverový a ops runbook stav je přepsán na nový primary host model

## 9. Co je dnes hotové

- nový primary host 91.98.122.165 je zapsaný jako current source of truth napříč dokumentací a webem
- docker testnet stack odpovídá single-host pure-ZION topologii s interními seedy
- pool runtime nespouští revenue subsystémy, pokud nejsou v configu zapnuté
- desktop-agent je srovnaný s pure-ZION backendem v main procesu i v UI vrstvě
- website veřejně ukazuje novou topologii a kanonické endpointy
- doplněny Deeksha testy a pomocné dokumentační artefakty

## 10. Co je potřeba hlídat dál

- v repu jsou commitované binární miner artefakty a dylib soubory, takže build provenance je potřeba hlídat i mimo diff review
- desktop runtime je po UI změnách potřeba ještě projet v reálném Electron smoke testu CPU a dual flow proti 91.98.122.165
- website vrstva a desktop vrstva se dnes měnily souběžně, takže případné další commity je vhodné držet už víc separované podle oblasti
- staré IP adresy mohou dál existovat v archivech, historických reportech nebo migracích, ale nemají být brané jako aktivní defaults

## 11. Dnešní minimální validační stopa

U desktop-agent změn byly provedeny alespoň tyto kontroly:

- node --check APP&WEB/desktop-agent/src/main.js
- node --check APP&WEB/desktop-agent/src/ui/renderer.js

Renderer i main process syntax check prošly.

## 12. Shrnutí jednou větou

Repo je po dnešku přepnuté z historické multi-node a revenue-heavy prezentace do praktičtějšího stavu, kde je 91.98.122.165 kanonický host, pure-ZION je první volba a desktop-agent i website tomu konečně odpovídají.

## 13. Live rollout update 2026-03-11

Na primárním hostu 91.98.122.165 proběhl 11. 3. 2026 plný rebuild a clean restart testnet stacku pro Ekam Deeksha od genesis.

Co bylo ověřeno v živém provozu:

- `CHV_EKAM_FORK_HEIGHT = 0` je skutečně nasazen v serverové kopii zdrojáků
- `zion-core:2.9.8`, `zion-pool:2.9.8` a `zion-miner:2.9.8` byly znovu sestaveny na serveru
- chain volumes byly smazány a znovu vytvořeny pro čistý start od bloku 0
- stack musel být spuštěn přes `docker compose --env-file .env`, jinak Redis startoval s prázdným `requirepass`
- pool i miner po resetu přijímaly share bez rejectů a chain dál rostl

Živé výsledky po restartu:

- `get_info` v core: height 4 → 5 → 7 během validačního okna
- miner: cca `1.23 kH/s`, accepted `61`, rejected `0`
- pool API: connected `true`, difficulty `1209+`, blocks found `32+`
- pool log: `BLOCK FOUND` na height 5 a `Share ACCEPTED` pro `algo=cosmic_harmony`

Root cause bug nalezený až při server build testu:

- `L1/pool/src/gpu_mining.rs` mělo parametry `_stats` a `_write_half`, ale uvnitř feature-gated bloků se používaly jako `stats` a `write_half`
- lokální `cargo check -p zion-pool` bez feature flagů proto procházel, ale Docker build s `native-ethash,native-autolykos,native-kheavyhash` padal
- fix byl nasazen a následný server rebuild poolu prošel čistě