# ZION Vega GPU Mining — Debug Report

**Datum:** 2026-04-09  
**Rig:** 518837 (ZionRig) — SimpleMining.net  
**GPU:** AMD Vega 56/64 (gfx900:xnack-, GCN 5.0, 8 GB HBM2)  
**OS:** SMOS kernel 6.9.12-sm6#088, image řada i088, osSeries=RX  
**Pool:** 91.98.122.165:3333 (ZION V3 Stratum)  
**Miner:** ZION V3 Miner (Rust, Ekam Deeksha PoW, OpenCL backend)  

---

## Shrnutí

První pokus o spuštění ZION Ekam Deeksha GPU mineru na AMD Vega HW přes SimpleMining OS. Vyřešeno několik softwarových blokujících problémů iterativním přestavením binárky. Miner inicializuje GPU, kompiluje OpenCL kernel, alokuje buffery, připojí se k poolu a přijímá mining joby.

**AKTUALIZACE 2026-04-10:** Původní hypotéza „Vega je prakticky mrtvá pro ZION mining“ se v lokálním Windows běhu nepotvrdila. Po opravě výběru binárky v desktop-agentu, po nasazení Vega-specifického OpenCL local size `64` a po zapnutí CPU re-verifikace GPU nálezů se live výkon zvedl z původních ~`5.4-5.9 KH/s` na ~`22-30 KH/s` při stavu `A:8 R:0 (100.0%)`. Skok tedy nevznikl změnou PoW algoritmu, ale tím, že se konečně spouští správná binárka se správným runtime nastavením.

**PRACOVNÍ NÁLEZ:** Na image i088 dochází k neúplné detekci AMD Vega ve SMOS stacku. GPU je viditelná přes PCI (`03:00.0 Vega 10`), má smysluplné teploty a VBIOS, ale SMOS současně hlásí `Failed detecting GPU`, `GPU type not recognized` a standardní minery ji nepřevezmou. Diagnostika v3.1.0–v3.1.4 ukázala reprodukovatelné OpenCL write/freezy v tehdejším SMOS stacku, ale pozdější lokální validace a live běh desktop-agentu ukázaly, že **nejde o univerzálně potvrzený HW dead state Vegy**. Aktuální problém je užší: korektnost části OpenCL pipeline na Vega/gfx900, nikoli totální neschopnost karty těžit.

---

## Přehodnocení po kontrole SMOS image

- Rig už běží na oficiálním stable image pro Vega: `SM-i088-6.9.12-6-a22.40.6r6.10.8-rf23.10.3-6.3.2-nv570.124.04open-c12.8-u22`
- To je přesně image, který SimpleMining uvádí jako current stable pro `AMD RX Vega / Radeon VII / RX 5000/6000/7000`
- Přímý upgrade na i088 tedy není další krok, protože byl fakticky už proveden
- Další smysluplný experiment je přepnutí na jiný AMD-compatible stable image, zejména `SM-i085-6.1.57-5-a22.40.6r6.0.3-rf23.10.3-6.1.10-nv570.86.16-u22` (SMOS command `72`)
- Cíl testu i085: ověřit, zda je problém v kombinaci kernelu/ROCm/detekce na i088, nebo zda se stejné chování přenese i na jiný image a tím posílí HW hypotézu
- Reflash na i085 byl spuštěn přes SMOS command `72`; rig přešel do `OS reflasher` režimu a začal stahovat image z oficiálního repozitáře
- Reflash doběhl úspěšně; rig následně naběhl na `kernel 6.1.57-sm5#085` a `driver amd22.40.6r6.1.10`
- Na i085 se podařilo spustit minimalistickou diagnostiku `gpu-sysinfo-v4` i standardní OpenCL miner test přes TeamRedMiner v0.10.21

### Oprava dřívější interpretace telemetrie

- Původní čtení `gpuPcieGen=0`, `gpuPcieWidth=0` v dashboardu bylo zavádějící
- Přímé sysfs čtení z `card1` (AMD) ukázalo reálný stav: `pcie_speed=8.0 GT/s PCIe`, `pcie_width=16`
- `card0` je Intel HD 610 (`0x8086`), `card1` je Vega (`0x1002`); dřívější diagnostika částečně četla špatný adaptér
- Vega tedy **není odpojená z PCIe** a samotná přítomnost `0W` v dashboardu nestačí jako důkaz mrtvého GPU
- Současná hypotéza: kombinace `Intel iGPU + AMD Vega + SMOS i088 detect/runtime stack` může být významná část problému

### Nové výsledky na image i085

- `clinfo`/OpenCL platform už není mrtvá: diagnostika na i085 ukazuje `Number of platforms: 1`
- OpenCL platforma je korektně rozpoznaná jako `AMD Accelerated Parallel Processing`
- Runtime hlásí `OpenCL 2.1 AMD-APP (3602.0)`
- Přímé sysfs čtení na i085 dává konzistentní telemetry: `speed=8.0 GT/s PCIe`, `width=16`, `power=20000000-24000000`, `temp=32000-34000`
- Dashboard nově ukazuje i nenulový odběr GPU (`gpuPwrCur` kolem 16-34 W), což je proti starému stavu další známka, že i085 image inicializuje AMD stack lépe než i088
- TeamRedMiner na i085 už došel minimálně do stavu `Auto-detected AMD OpenCL platform 0` a `Initializing GPU 0.`
- Po přesunu karty přímo do hlavního PCIe x16 slotu a po úpravách BIOSu desky se chování nezměnilo: TeamRedMiner na i085 po ~2 minutách skončil na `GPU initialization detected STUCK` a `GPU 0: detected DEAD (03:00.0)`

Praktický dopad: po přechodu z i088 na i085 už nelze hlavní problém přičítat primárně desce nebo PCIe lince. Image i085 obnovil funkční AMD OpenCL stack a validní telemetry. Pokud se další init přesto zasekne, půjde spíš o hlubší problém Vegy, VBIOSu, riseru nebo specifickou nestabilitu při skutečném GPU compute initu, ne o prosté "GPU type not recognized" jako na i088.

### Lokální validace ve Windows

- Karta byla následně osazena do tohoto lokálního Windows stroje a systém ji detekuje jako `Radeon RX Vega`
- Windows driver stav: `Status = OK`, driver `31.0.21924.61`
- `clinfo` na Windows ukazuje funkční AMD OpenCL runtime: `AMD Accelerated Parallel Processing`, `OpenCL 2.1 AMD-APP (3584.0)`
- Lokálně byl spuštěn vlastní Rust smoke test přes `ocl` crate nad touto Vega kartou
- Smoke test úspěšně prošel:
	- create/write/dispatch/read
	- druhý buffer write/read
	- přepis stejného bufferu
	- 16 opakovaných write→dispatch→read cyklů v jednom procesu
	- větší buffer test `len=8,388,608 u32` (~32 MiB) včetně `write`, `dispatch`, `read` a druhého `rewrite`
- Výsledek: `=== SMOKE PASS ===`
- Lokálně byl následně spuštěn i náš vlastní Rust miner benchmark `zion-miner --ekam-bench --gpu opencl`
- Výsledek benchmarku:
	- `device=gfx900`
	- `backend=opencl`
	- `hashes=32704 elapsed=5.94s`
	- `ekam_deeksha: 5.50 KH/s`
- Byl spuštěn i krátký reálný běh hlavního mineru `zion-miner --gpu opencl --profile benchmark --loops 2` v lokálním režimu bez poolu
- Hlavní path proběhla korektně:
	- `gpu_init backend=opencl device="gfx900"`
	- 2 lokální joby byly zpracované bez pádu
	- 2/2 iterací skončily `share_status=Accepted`
	- pozorovaná krátká 10s rychlost byla přibližně `5.4-6.5 KH/s`
- Při pokusu o `zion-miner --gpu-bench` byl odhalen kódový bug: build s `--features gpu-opencl` vůbec nezapínal DCR GPU benchmark větev kvůli `#[cfg(feature = "gpu")]`
- Tento bug byl lokálně opraven v `V3/L1/miner/src/main.rs` a `V3/L1/miner/src/dcr_worker.rs` tak, aby OpenCL build skutečně kompiloval i DCR GPU path
- Po opravě `--gpu-bench` na stejné Veze korektně běží a vrátil:
	- `precompute_verify=OK`
	- `device=gfx900`
	- `gpu_blake3: 1170.36 MH/s`
- Ve Windows byly následně otestovány i cizí minery nad stejnou kartou:
	- `lolMiner 1.98a --benchmark ETCHASH --benchepoch 500`
	- `TeamRedMiner v0.10.21 -a etchash --benchmark --eth_epoch=500`
- `lolMiner` kartu normálně detekuje a benchmark proběhne:
	- light cache pro epoch 500 vygenerovaná za ~1.45 s
	- DAG `2.95-3.02 GB` vygenerovaný za ~2.53 s
	- pozorovaný hashrate přibližně `21.37 MH/s`
	- současně hlásí: `Error in getting sensor data from AMD ADL library. Sensoring will be disabled`
	- sloupce `Power`, `Core Temp`, `Fan` zůstaly `N/A` nebo `0`
- `TeamRedMiner` bez úpravy spadne přesně na monitorovací vrstvě:
	- `GPU 0 could not be mapped to ADL, will not have monitor`
	- `gpu monitor failed to initialize (-1)`
	- proces se poté korektně ukončí bez skutečného startu těžby
- `TeamRedMiner` po spuštění s `--no_gpu_monitor` už běží korektně:
	- GPU init proběhl úspěšně
	- DAG pro epoch 250 byl dokončen za ~2.74 s
	- etchash benchmark se rozběhl na ~`22.02 MH/s` (avg ~`21.89 MH/s`)
	- teploty/fan/power zůstaly `0C / 0% / 0 W`, ale samotný mining compute běží
- Doplňková Windows zjištění:
	- `Win32_VideoController.VideoBIOSVersion` je prázdné
	- registr ovladače ale vrací čitelný BIOS string `113-D0500100-103`
	- TRM současně varuje na chybějící Windows TDR patch (`windows_tdr_fix.reg`)
	- TDR patch byl následně importován do registry (`TdrDelay=20`, `TdrDdiDelay=10`)
	- po aplikaci TDR patch už TRM nehlásí Windows TDR warning, ale defaultní běh se zapnutým monitoringem stále končí na `GPU 0 could not be mapped to ADL` a `gpu monitor failed to initialize (-1)`
	- závěr z TDR testu: TDR byl vedlejší problém, hlavní blokace zůstává v ADL / sensor-monitor mapování
	- přes GPU-Z byl uložen BIOS dump `Vega 10.rom` (velikost `262,144 B`, tj. 256 KiB)
	- dump má validní VGA ROM signaturu `55 AA`
	- SHA256 dumpu: `5A94552F152B1AD18CBAECCBD5D2C699E8BC463D961F0B80AE7654828FC09A5F`
	- čitelné stringy z dumpu odpovídají očekávané Vega identitě:
		- `113-D0500100-103`
		- `D0500100.103`
		- `07/28/17 15:57`
		- `VEGA10`
		- `Vega10 A1 XT D05001 32Mx128 852e/945m 0.95V`
		- `ATOMBIOSBK-AMD VER016.001.001.000.008730`
	- praktický dopad BIOS dumpu: BIOS vypadá strukturálně zdravě a stringově konzistentně s kartou i registry; dump sám o sobě zatím nedává důvod pro slepý reflash

Praktický dopad: karta **není mrtvá jako obecné OpenCL compute zařízení** a na Windows projde nejen naším Rust minerem, ale i `lolMiner` a `TeamRedMiner` mining path, pokud se obejde rozbitá ADL/sensor monitor vrstva. Tím dál slábne hypotéza „GPU je zamčená“ nebo totálně mrtvá. Naopak výrazně sílí hypotéza, že problém je v monitor/sensor/driver vrstvě (ADL, telemetry, případně firmware interakce), která mate Afterburner i některé minery, zatímco samotný compute a DAG path fungují.

### Aktualizace po čisté reinstalaci AMD driverů ve Windows

- Po čisté reinstalaci driverů zůstal identifikátor karty stejný: `Radeon RX Vega`, driver `31.0.21924.61`, registry dál vrací BIOS string `113-D0500100-103`
- `lolMiner 1.98a` po reinstalu už nehlásí chybu ADL monitoringu v zachyceném běhu a začal vracet reálné telemetry:
	- `Power 162.0 W`
	- `Core 78 C`
	- `Fan 48 %`
- `TeamRedMiner v0.10.21` už po reinstalu běží i **bez** `--no_gpu_monitor`:
	- `GPU 0 Passed compute mode and crossfire verification`
	- DAG pro epoch 250 dokončen za ~`2.754 s`
	- monitoring vrací reálná data `TEdge`, `TJct`, `TMem`, `FanPct`, `FanRpm`, `VDDC`, `Power`
	- během tuningu byl pozorován etchash výkon od ~`20.90 MH/s` až po ~`34.18 MH/s` (avg ~`27.08 MH/s` po 60 s)
	- konkrétní telemetrie z TRM po reinstalu:
		- `80C / 105C / 89C`, `49 %`, `2410 rpm`, `950 mV`, `187 W`
		- později `79-80C / 105-106C / 90-91C`, `48-49 %`, `2399-2407 rpm`, `169-171 W`
- Náš vlastní `zion-miner` zůstal po reinstalu stabilní a reprodukovatelný:
	- `--ekam-bench --gpu opencl`: `ekam_deeksha: 5.87 KH/s`
	- `--gpu opencl --profile benchmark --loops 2`: 2/2 iterací `Accepted`, krátká 10s rychlost ~`5.83 KH/s`
- Praktický závěr po reinstalu: hlavní problém ve Windows nebyl slepě „špatný BIOS“ ani definitivně mrtvá karta, ale rozbitá AMD monitor/ADL vrstva v předchozí instalaci driverů. Po čistém reinstallu se monitoring i běžný mining init zjevně vrátil do použitelného stavu, takže **pro VBIOS reflash teď není silný důvod**.

---

## Aktualizace 2026-04-10: výrazný skok hashrate

### Naměřený skok

| Fáze | Režim | Hashrate | Stav share flow |
|------|-------|----------|-----------------|
| Původní lokální bench | `--ekam-bench --gpu opencl` | ~`5.43-5.87 KH/s` | bench bez pool submitu |
| Krátký lokální loop | `--profile benchmark --loops 2` | ~`5.4-6.5 KH/s` | `2/2 Accepted` |
| Live desktop-agent po opravách | pool mining | ~`22-30 KH/s` | `A:8 R:0 (100.0%)` |

To odpovídá přibližně **4.0x až 5.1x** proti původnímu lokálnímu bench path na stejné Vega kartě.

### Co ten skok skutečně způsobilo

1. **Oprava výběru binárky v desktop-agentu**
	- `findRustMiner()` v `APP&WEB/desktop-agent/src/main.js` dříve v dev režimu preferoval starší build output před čerstvou bundlovanou binárkou.
	- Výsledek byl, že bench validoval nový miner, ale live session často startovala starší `zion-miner.exe` bez aktuálních oprav.
	- Po úpravě se nyní preferují `APP&WEB/desktop-agent/resources` a čerstvé build outputy; při shodě rozhoduje novější `mtime`.

2. **Vega tuning: OpenCL local size `64` místo `256`**
	- Pro GCN/Vega wave64 se ukázalo, že `local_ws=64` je stabilnější a výkonnější než generický default `256`.
	- Tuning byl propsán jak do Rust mineru, tak do desktop-agent runtime auto-detekce.

3. **Lokální CPU re-verifikace GPU kandidátů před submit**
	- GPU nyní může najít kandidát, ale miner ho před odesláním znovu přepočítá přes CPU referenci.
	- Tím zmizel pool-visible reject storm typu `RejectedLowDifficulty`; špatné GPU kandidáty teď padnou lokálně.

4. **Srovnání feature path pro Windows/OpenCL build**
	- Packaging a runtime se srovnaly na `gpu-opencl`, aby Windows Vega build nepadal do starších nebo neúplných feature kombinací.

### Důležitá interpretace

Tento skok **není důkaz**, že se samotný OpenCL kernel náhle zrychlil o 5x jedním matematickým trikem. Je to hlavně důsledek toho, že se:

- spouští správná binárka,
- používá správné Vega nastavení,
- a pool už není zahlcen špatnými share submission pokusy.

Jinými slovy: jde o **provozní throughput uplift po opravě runtime cesty**, ne o čistý „kernel miracle patch“.

### Co ještě zůstává otevřené

- V live logu se stále objevují `gpu_candidate_hash_mismatch` a `gpu_candidate_rejected_locally`.
- To znamená, že část OpenCL path na Vega/gfx900 stále občas vrátí kandidáta, jehož hash se neshoduje s CPU referencí.
- Prakticky je to teď pod kontrolou, protože CPU gate chrání pool před špatným submittem.
- Technicky ale zůstává otevřený hlubší correctness bug v `V3/L1/cosmic-harmony/src/gpu/kernels/cosmic_harmony_deeksha.cl` nebo v jeho host-side napojení.

---

## Nastavení OC (aktuální)

| Parametr | Hodnota |
|----------|---------|
| PowerLimit | **60%** (~177W TDP) |
| Core Clock | **1050 MHz** |
| Memory Clock | **1050 MHz** |
| VDDC | **875 mV** |
| MVDD | **850 mV** |
| MVDDCI | 900 mV |

> ⚠️ Dříve byl PowerLimit na **6** (= ~18W = 6% z 295W TDP), což bylo zcela nedostatečné. Opraven na 60%, ale d20 chyba přetrvává i s korektním napájením.

---

## Nalezené a opravené problémy

### 1. Zamrznutí kompilace OpenCL kernelu (OPRAVENO — v3.0.2)

**Příznak:** Miner detekoval GPU (`gpu[0]=opencl:gfx900:xnack-`), ale po výpisu banneru nevyprodukoval žádný výstup.  
**Příčina:** Agresivní AMD optimalizační flagy (`-cl-fast-relaxed-math -cl-mad-enable -cl-no-signed-zeros -cl-denorms-are-zero`) způsobily, že gfx900 kompilátor vstoupil do extrémně dlouhé (možná nekonečné) optimalizační smyčky nad 1 154řádkovým Deeksha kernelem.  
**Oprava:** Odebrány všechny agresivní flagy, ponechán pouze `-cl-std=CL1.2`.  
**Soubor:** `V3/L1/miner/src/gpu_backend.rs` → funkce `amd_build_opts()`.

### 2. Bufferování stdout (OPRAVENO — v3.0.4)

**Příznak:** Konzole ukazovala částečný postup — nebylo jasné, jestli miner zamrzl nebo se jen výstup bufferuje.  
**Příčina:** Rust `println!` používá blokové bufferování když stdout je roura (SMOS zachytává výstup). 8 KB buffer se akumuluje před flushem.  
**Oprava:** Přidáno `std::io::stdout().flush()` po každém diagnostickém `println!`.

### 3. Zamrznutí alokace NPU bufferů — `copy_host_slice` (OPRAVENO — v3.0.7)

**Příznak:** Po kompilaci kernelu a alokaci scratchpadu (1 GB) miner zamrzl při vytváření NPU weight bufferů.  
**Časová osa diagnostiky:**
- v3.0.3: Přidáno logování alokace bufferů → zamrzl po `result_bufs ok`
- v3.0.4: Přidán stdout flush → odhalilo zamrznutí u `npu: weights_buf ok` (biases_buf zamrzá)
- v3.0.5: Nahrazeno `copy_host_slice` za create + `write().enq()` → všechny 4 buffery vytvořeny, ale `write().enq()` zamrzá
- v3.0.6: Oddělení vytvoření od zápisů → potvrzeno že všechny buffery se vytvoří ok, zápisy zamrzají
- v3.0.7: **Přeskočeny zápisy NPU dat** → miner projde přes NPU inicializaci

**Příčina:** AMD gfx900 OpenCL ovladač deadlockuje na `clEnqueueWriteBuffer` po `clBuildProgram` na stejné command queue. Kompilace kernelu poškodí interní stav ovladače pro transfer path queue.  
**Workaround:** Nulově vyplněné NPU buffery (přeskočen `copy_host_slice` a `write().enq()`). NPU mix fáze bude počítat s nulovými vahami — nesprávné hashe, ale dokazuje průchodnost pipeline.

### 4. Zamrznutí mining smyčky při zápisu (OTEVŘENO — v3.0.9)

**Příznak:** Miner se plně inicializuje, připojí k poolu, přijme job, ale nikdy nevytvoří mining výstup (žádné `no_solution` ani hashrate řádky).  
**Diagnostika:**
- v3.0.8: Blocking zápis/čtení (`unsafe { .block(true).enq() }`) → stále zamrzá
- v3.0.9: Vytvořena separátní `ocl::Queue` pro datové přenosy → stále zamrzá

**Příčina (potvrzeno diagnostikou v3.1.0–v3.1.4):** Viz sekce → **Hardwarový nález: d20 "Atombios stuck"** níže.

### 5. GPU hlášena jako mrtvá i jinými minery (POTVRZENO)

**TeamRedMiner v0.10.21 (ETC test):**
```
[20:05:28] Auto-detected AMD OpenCL platform 0
[20:05:30] Initializing GPU 0.
[20:07:27] GPU 0: detected DEAD (07:00.0)
```
TRM se inicializoval 2 minuty, pak GPU označil jako DEAD. To potvrzuje, že problém **není specifický pro ZION/Deeksha** — jakýkoliv OpenCL miner na této GPU selhává.

---

## Hardwarový nález: d20 "Atombios stuck"

### Diagnostická série v3.1.x

Pro izolaci příčiny zamrzání byla vytvořena série autonomních diagnostických binárních souborů:

| Verze | Test | Výsledek |
|-------|------|----------|
| **v3.1.0** | Multi-context (2 ProQue) | 1. ProQue: steps 1–8 OK (kernel compile, buffer, dispatch, readback). 2. ProQue: zamrzne na buffer write |
| **v3.1.2** | Single-context (1 ProQue, kombinovaný kernel) | A2 (add_one: write+dispatch+read) OK ✓, A3 (blake3_stub: write cv_buf) **ZAMRZNE** |
| **v3.1.3** | Sequential cykly (create→write→dispatch→read→drop, opakuj) | A1 OK ✓, A2 (create→write) **ZAMRZNE** |
| **v3.1.4** | **Čistý write test BEZ dispatch** (create→write→drop, opakuj) | A1 OK ✓, A2 (create→write) **ZAMRZNE** |

### Klíčový závěr

Na image i088 GPU zvládne **přesně JEDEN úspěšný buffer zápis** (host→device DMA transfer), poté další OpenCL write zamrzne. Nezáleží na:
- počtu kontextů (single vs multi ProQue)
- zda se spouští kernel dispatch nebo ne
- zda se buffer před dalším zápisem uvolní (drop)
- typu bufferu (u32, u8, jakákoliv velikost)
- OC nastavení (testováno stock, 1000/800/1000, 1050/1050/875)

Toto chování **odpovídá** chybě `Atombios stuck (d20)` nebo poškozenému runtime stacku, ale po novějších zjištěních už není korektní ho uzavírat jako čistě HW příčinu bez srovnávacího testu na jiném SMOS image.

### Pozorované HW parametry
- **Napájení:** `power1_average` nebyl v sysfs dostupný; dashboard dál ukazuje 0W, ale to už není spolehlivý závěr o stavu GPU
- **Teplota:** 34–36°C (GPU je přítomná a hlásí senzory)
- **VBIOS:** 113-D0500100-103 (AMD reference)
- **PCIe:** přímé sysfs čtení z AMD ukazuje `8.0 GT/s`, `x16`
- **HBM2:** Samsung, 8 GB

### Pravděpodobná příčina
1. **SMOS/Linux AMD runtime nebo miner-specific init problém** — nyní hlavní pracovní hypotéza; Windows OpenCL smoke test prošel, zatímco TRM na SMOS i085 zamrzá při `Initializing GPU 0`
2. **VBIOS / firmware interakce specifická pro Linux runtime** — stále možná; nemusí znamenat totálně mrtvou kartu, ale může rozbíjet konkrétní init sekvenci na SMOS/TRM
3. **Degradované HBM2 nebo VRM jen pod vyšší mining zátěží** — stále možné, ale základní OpenCL compute test na Windows prošel
4. **Napájecí problém na samotné kartě** — méně pravděpodobné než dřív; modré LED na referenční kartě samy o sobě nic nedokazují

### Možné nastavení desky / BIOSu

Na této sestavě je deska `ASRock H110 Pro BTC+` s BIOSem `P1.60 (2018-03-23)`. Vedle samotné GPU a SMOS image je reálná možnost, že inicializaci komplikuje konfigurace BIOSu desky, hlavně protože v rigu současně běží Intel iGPU a AMD Vega.

Doporučený checklist po dokončení reflashe:

1. **Primary Graphics Adapter = PCI Express / PEG**
2. **Intel iGPU / Onboard VGA vypnout**, pokud to BIOS dovolí; minimálně vypnout `iGPU Multi-Monitor`
3. **Above 4G Decoding = Enabled**
4. **PCIe Link Speed ručně na Gen2**; pokud by to stále zlobilo, zkusit nouzově i `Gen1` místo `Auto`
5. **CSM vypnout a bootovat čistě v UEFI**, pokud image bootuje korektně; pokud by po tom rig nenabíhal, zkusit opačný test
6. **Load UEFI Defaults**, pak aplikovat jen minimum potřebných voleb místo starého mining profilu s neznámými změnami
7. **BIOS update desky**, pokud je pro H110 Pro BTC+ dostupná novější stabilní verze než `P1.60`
8. **Test bez riseru v hlavním x16 slotu**, pokud i085 nepomůže; to je nejčistší oddělení desky/riseru od software stacku

---

## Další kroky

### Prioritní další kroky
1. **Udržet CPU re-verifikaci v live path** — je to aktuální bezpečnostní pojistka proti Vega false-positive share nálezům.
2. **Udělát stage-by-stage audit OpenCL pipeline proti CPU referenci** — hlavně kolem `npu_mix_packed` a závěrečného hash/fusion path.
3. **Zvážit zpřísnění GPU-side target checku** — současný OpenCL path stále používá zjednodušený `target_u32` prefilter místo plného 32-byte porovnání.
4. **Ověřit, zda lze srovnat Rust OpenCL path s kanonickým Python/OpenCL backendem** bez regresí ve V3 runtime.
5. **SMOS považovat dál za separátní runtime problém** — aktuální Windows/live desktop-agent výsledek už nepotvrzuje tezi o obecně mrtvé Vega kartě.

---

## Nasazené verze

| Verze | Změny | Výsledek |
|-------|-------|----------|
| v3.0.1 | Wrapper: `ZION_GPU_WORK_SIZE=4096`, `ZION_OCL_LOCAL_SIZE=256` | Zamrznutí kompilace kernelu |
| v3.0.2 | Odstraněny agresivní AMD compiler flagy | Kernel se kompiluje. Zamrzl po banneru |
| v3.0.3 | Přidáno logování alokace bufferů | Zamrzl po `result_bufs ok` |
| v3.0.4 | Přidáno `stdout().flush()` + detailní NPU výpisy | Odhaleno zamrznutí u biases_buf |
| v3.0.5 | `copy_host_slice` → create + `write().enq()` | Zamrzl na `write().enq()` |
| v3.0.6 | Oddělení vytvoření bufferů od zápisů | Buffery ok, zápisy zamrzají |
| v3.0.7 | **Přeskočeny NPU data zápisy** | Plná init! Pool připojen, job přijat |
| v3.0.8 | Blocking zápisy (`unsafe { .block(true).enq() }`) | Job přijat, mine_batch zamrzá |
| v3.0.9 | Separátní transfer queue | Job přijat, mine_batch stále zamrzá |
| **v3.1.0** | Diagnostika: multi-context test (2 ProQue) | 1. ProQue OK (8 kroků), 2. ProQue zamrzne na write |
| **v3.1.2** | Diagnostika: single-context, kombinovaný kernel | add_one OK, blake3_stub write zamrzne |
| **v3.1.3** | Diagnostika: sequential cykly (create→write→dispatch→read→drop) | 1. cyklus OK, 2. cyklus zamrzne na write |
| **v3.1.4** | Diagnostika: **čistý write test BEZ dispatch** | 1. write OK, 2. write **ZAMRZNE** na tehdejším SMOS stacku |

### Pomocné balíčky na serveru

| Balíček | Popis |
|---------|-------|
| `trm-etc-test.zip` | TeamRedMiner v0.10.21 (ETC, SMOS) — GPU detected DEAD |
| `lolminer-etc-test.zip` | lolMiner v1.91 (ETC, SMOS) — připraveno, nenasazeno |
| `zion-miner-v3.1.{0-4}.zip` | Diagnostické binárky |

---

## Modifikované soubory (na serveru: 91.98.122.165)

- `/root/zion-2.9.6/V3/L1/miner/src/gpu_backend.rs` — Všechny OpenCL opravy
- `/opt/zion/downloads/zion-miner-v3.0.{1-9}/` — Nasazené balíčky
- Záloha: `/root/zion-2.9.6/V3/L1/miner/src/gpu_backend.rs.bak` — Původní kód

---

## SimpleMining API reference

| Endpoint | Metoda | Účel |
|----------|--------|------|
| `/rig-groups/1765707` | PUT | Aktualizace minerOptions URL |
| `/rigs/execute-reload` | PATCH | Reload mineru na rigu |
| `/rigs/execute-reboot` | PATCH | Reboot rigu |
| `/rigs/execute-command` | PATCH | Spuštění shell příkazu (cmdId=7) |
| `/rigs/518837/console` | GET | Miner stdout (base64) |
| `/rigs/518837/console?type=dmesg` | GET | Kernel dmesg (base64) |
| `/rigs/518837` | GET | Stav rigu |

Content-Type pro execute-* endpointy: `application/merge-patch+json`

---

## Specifikace OpenCL kernelu

- **Soubor:** `V3/L1/cosmic-harmony/src/gpu/kernels/cosmic_harmony_deeksha.cl`
- **Řádků:** 1 154 (1 315 s debug úpravami)
- **Název kernelu:** `ekam_deeksha_mine`
- **6fázový pipeline:** Keccak-256 → SHA3-512 → Golden Matrix → Memory-Hard (Blake3 XOF, 256 KiB scratchpad) → NPU Mix (INT8 MLP, variabilní topologie) → Cosmic Fusion (8kolový Keccak+AES)
- **Compile-time definice:** `NPU_MAX_DIM=128`, `WGS=64`
- **Argumenty:** 12 (header, header_len, nonce_base, nonce_count, scratchpad, target_u32, result_nonce, result_hash, npu_weights, npu_biases, npu_scales, npu_meta)

---

*Report vygenerován a průběžně aktualizován během autonomní debugovací session 2026-04-09 až 2026-04-10.*
*Poslední aktualizace: 2026-04-10 — potvrzen výrazný live hashrate skok po opravě runtime cesty, stale-binary bugfixu a Vega OpenCL tuningu; otevřený zůstává už jen correctness bug části OpenCL pipeline na gfx900.*
