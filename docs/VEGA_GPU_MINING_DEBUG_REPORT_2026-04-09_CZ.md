# ZION Vega GPU Mining — Debug Report

**Datum:** 2026-04-09 — 2026-04-10  
**Rig:** 518837 (ZionRig) — SimpleMining.net  
**GPU:** AMD Vega 56/64 (gfx900:xnack-, GCN 5.0, 8 GB HBM2)  
**OS:** SMOS i066d (kernel `5.15.80-sm#066d`, driver `amd21.50.2r5.16.16`) — dříve i088, i085  
**Pool:** 91.98.122.165:3333 (ZION V3 Stratum) / fr.zano.herominers.com:1110 (ZANO validace)  
**Miner:** ZION V3 Miner (Rust, Ekam Deeksha PoW, OpenCL backend) / SRBMiner v3.2.5 (ZANO validace)  

---

## Shrnutí

První pokus o spuštění ZION Ekam Deeksha GPU mineru na AMD Vega HW přes SimpleMining OS. Vyřešeno několik softwarových blokujících problémů iterativním přestavením binárky. Miner inicializuje GPU, kompiluje OpenCL kernel, alokuje buffery, připojí se k poolu a přijímá mining joby.

**AKTUALIZACE 2026-04-10:** Původní hypotéza „Vega je prakticky mrtvá pro ZION mining“ se v lokálním Windows běhu nepotvrdila. Po opravě výběru binárky v desktop-agentu, po nasazení Vega-specifického OpenCL local size `64` a po zapnutí CPU re-verifikace GPU nálezů se live výkon zvedl z původních ~`5.4-5.9 KH/s` na ~`22-30 KH/s` při stavu `A:8 R:0 (100.0%)`. Skok tedy nevznikl změnou PoW algoritmu, ale tím, že se konečně spouští správná binárka se správným runtime nastavením.

**PRACOVNÍ NÁLEZ:** Na image i088 dochází k neúplné detekci AMD Vega ve SMOS stacku. GPU je viditelná přes PCI (`03:00.0 Vega 10`), má smysluplné teploty a VBIOS, ale SMOS současně hlásí `Failed detecting GPU`, `GPU type not recognized` a standardní minery ji nepřevezmou. Diagnostika v3.1.0–v3.1.4 ukázala reprodukovatelné OpenCL write/freezy v tehdejším SMOS stacku, ale pozdější lokální validace a live běh desktop-agentu ukázaly, že **nejde o univerzálně potvrzený HW dead state Vegy**. Aktuální problém je užší: korektnost části OpenCL pipeline na Vega/gfx900, nikoli totální neschopnost karty těžit.

**VYŘEŠENO 2026-04-10 (SMOS):** Klíčový průlom: reflash na image **i066d** (`SM-i066d-5.15.80-a21.50.2-rf22.20.3-5.16.16`) okamžitě vyřešil problém napájení Vegy na SMOS. Driver `amd21.50.2` (ROCm 5.16.16) správně ovládá Vega power management — odběr GPU skočil z uzamčených **19W na 186W** ihned po bootu. Oba předchozí image (i088 s `amd22.40.6r6.10.8` i i085 s `amd22.40.6r6.1.10`) používaly rodinu driverů `amd22.40.6`, která na Vega/GCN5 zcela ignoruje sysfs power management. Po OC tuningu rig stabilně těží ZANO progpow na **17.17 MH/s** při **198W** (v9 OC profil). Rig je připraven k nasazení Deeksha mineru.

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

### Přenositelnost na RX karty

Tenhle výsledek má smysl otestovat i na běžných AMD `RX` kartách, hlavně tam, kde desktop-agent nebo dev runtime může spouštět starší binárku nebo nevhodný OpenCL profil.

Co je pravděpodobně přenositelné i mimo Vegu:

- **oprava výběru správné binárky** v desktop-agentu,
- **sjednocení feature path na `gpu-opencl`** pro Windows/OpenCL build,
- **CPU re-verifikace GPU kandidátů** jako ochrana proti pool rejectům,
- a obecně **agresivnější audit OpenCL runtime parametrů** místo spoléhání na generický default.

Co naopak nemusí být univerzální:

- konkrétní `local_ws=64` je velmi pravděpodobně **Vega/GCN-specific** optimum,
- na `RX 500/5000/6000/7000` může být nejlepší jiná hodnota podle architektury, driveru a wavefront chování,
- proto je správné přenést hlavně **metodu**, ne slepě zkopírovat všechny Vega čísla.

Praktická hypotéza pro RX test: i když samotný RX kernel třeba nezrychlí o `4-5x`, může se i tam zlepšit **reálný pool throughput**, pokud se odstraní špatný runtime path, stará binárka nebo skryté local rejecty.

### Doporučený test přímo na rigu

Pro první RX validaci na rigu má smysl držet test co nejjednodušší:

1. nasadit stejnou runtime větev s opraveným `findRustMiner()` a aktuální OpenCL build binárkou,
2. nechat default RX local size beze změny nebo začít konzervativně na `256`,
3. sbírat současně:
	- reported hashrate,
	- `A/R` poměr,
	- výskyt `gpu_candidate_hash_mismatch`,
	- výskyt `gpu_candidate_rejected_locally`,
4. porovnat starý a nový běh aspoň na stejném poolu a podobném časovém okně,
5. teprve potom zkoušet architektura-specific tuning `ZION_OCL_LOCAL_SIZE` pro konkrétní RX generaci.

Pokud RX rig po stejné sadě oprav ukáže:

- méně rejectů při podobném hashrate, je to runtime/submit win,
- vyšší accepted throughput při stejné nebo nižší reject rate, je to reálný výkonový win,
- stejné mismatch logy jako Vega, je potřeba řešit společný OpenCL correctness problém i mimo gfx900.

### Co ještě zůstává otevřené

- V live logu se stále objevují `gpu_candidate_hash_mismatch` a `gpu_candidate_rejected_locally`.
- To znamená, že část OpenCL path na Vega/gfx900 stále občas vrátí kandidáta, jehož hash se neshoduje s CPU referencí.
- Prakticky je to teď pod kontrolou, protože CPU gate chrání pool před špatným submittem.
- Technicky ale zůstává otevřený hlubší correctness bug v `V3/L1/cosmic-harmony/src/gpu/kernels/cosmic_harmony_deeksha.cl` nebo v jeho host-side napojení.

### Dlouhý běh: interpretace po ~4 hodinách uptime

Pozdější dlouhý běh ukázal stav přibližně:

- uptime ~`4h 12m`,
- `accepted=8`, `rejected=0`,
- `attempted_hashes=150,248,648`,
- `gpu_hps≈9.98 kH/s`, `hps_overall≈9.93 kH/s`.

To znamená zhruba **1 accepted share na ~18.8 milionu hashů**, tedy asi **1 share za ~31 minut** při reálném sustained výkonu kolem `10 kH/s`.

Praktický závěr:

- `8 accepted` po ~4 hodinách při tomto výkonu **nevypadá jako zaseknutý miner**,
- je to zhruba konzistentní s low-hashrate minerem jedoucím na pool minimum difficulty,
- důležitější je, že stále zůstává `R:0`, takže CPU gate dál úspěšně filtruje špatné GPU kandidáty před submittem.

Současně tenhle běh ukazuje ještě jednu důležitou věc: skutečný dlouhodobý výkon se v tomto stavu jeví spíš kolem **`~10 kH/s sustained`** než kolem dříve pozorovaných krátkodobých `22-30 kH/s`. Vyšší čísla v desktop-agent `[METRICS]` je potřeba brát opatrně, protože mohou odrážet mix rolling oken a parser/state lag, zatímco `session_status ... gpu_hps=...` je v tomhle běhu konzistentnější zdroj pravdy.

---

## Nastavení OC (aktuální — v9, image i066d)

| Parametr | Nastavení SMOS | Reálná telemetrie |
|----------|----------------|-------------------|
| Core Clock | **1200 MHz** | CC=1197 MHz |
| Memory Clock | **950 MHz** | MC=950 MHz |
| PowerLimit | **100** (= 100% TDP) | P=198W |
| VDDC | **950 mV** | — |
| Hashrate (ZANO progpow) | — | **17.17 MH/s** |
| Efektivita | — | **86.70 kH/W** |

> **Důležité OC poznatky na i066d:**
> - `PL` hodnoty 1–7 = DPM power stage (shazuje MC na 800 MHz). `PL=100` = 100% TDP (správná interpretace).
> - `ocMemory ≥ 1000` → MC crash na 800 MHz. `ocMemory=950` udržuje MC stabilně na 950–1000 MHz.
> - Po každé OC změně nutný **reboot** (ne jen reload) — jinak se DPM tabulka neresetuje čistě.
> - Předchozí OC na starších image (i088, i085) bylo irelevantní — driver `amd22.40.6` Vega power management vůbec neovládal (19W lock).

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

## Vyřešení SMOS: reflash na i066d

### Root cause: rodina driverů amd22.40.6 neovládá Vega PM

Po extensive testování na třech SMOS image:

| Image | Kernel | Driver | Vega Power | Mining |
|-------|--------|--------|------------|--------|
| **i088** | 6.9.12-sm6#088 | amd22.40.6r6.10.8 | **0–19W lock** | GPU detected DEAD |
| **i085** | 6.1.57-sm5#085 | amd22.40.6r6.1.10 | **19–20W lock** | OpenCL init OK, TRM STUCK |
| **i066d** ✅ | 5.15.80-sm#066d | amd21.50.2r5.16.16 | **186–198W** | **Plně funkční** |

Root cause: celá driver rodina `amd22.40.6` (ROCm 6.x) na GCN 5.0 (gfx900/Vega) zcela ignoruje sysfs power management. Power zůstává na idle ~19W bez ohledu na OC nastavení. Driver `amd21.50.2` (ROCm 5.x, image i066d) Vega PM ovládá správně.

### Reflash postup

1. Zjištěno přes `GET /rig-commands`, že commandId=40 odpovídá image i066d
2. Předchozí pokusy s commandId=72 reflashovaly na **stejný** i085 image (nebylo zřejmé z SMOS UI)
3. Po prvním pokusu o i066d reflash hlásil rig „Detected running previous reflash" → vyžadoval reboot
4. Po rebootu a opakovaném reflash příkazu se i066d image stáhl (~1 GB) a zapsal na USB
5. Po bootu na i066d GPU okamžitě reportovala P=186W, CC=1097 MHz, MC=1000 MHz
6. SRBMiner v3.2.5 (ZANO progpow) okamžitě začal přijímat share (A:3 v prvních minutách)

### OC tuning série (v1–v10)

| Verze | Core | Mem | PL | VDDC | CC | MC | Power | Hashrate | Poznámka |
|-------|------|-----|-----|------|------|------|-------|----------|----------|
| stock | — | — | — | — | 1097 | 1000 | 186W | 15.89 MH/s | Baseline po reflash |
| v1 | 1400 | 1100 | 0 | 950 | 1224 | **800** | 214W | 14.10 | MC crash (Mem≥1000) |
| v3 | 1200 | 1000 | 3 | 950 | 1115 | **800** | 187W | 16.68 | MC crash (PL=3=DPM) |
| v4 | 1200 | 1100 | 5 | 1000 | 1001 | **167** | 149W | 11.66 | ocMode=true catastrophic |
| v5 | 1300 | 950 | 4 | 975 | 1086 | 800 | 197W | 15.62 | PL=4=DPM |
| v6 | 1250 | 950 | 100 | 975 | 1072 | 800 | 191W | 15.45 | DPM stale z v5 |
| v7 | 1150 | 950 | 100 | 950 | 1128 | 950 | 194W | 15.40 | Reboot, MC=950 ✅ |
| **v9** ★ | **1200** | **950** | **100** | **950** | **1197** | **950** | **198W** | **17.17** | **Optimum** |
| v10 | 1250 | 950 | 100 | 975 | — | — | — | stuck | GPU neinit, příliš agresivní |

### Aktuální stav rigu

- Image: i066d, kernel `5.15.80-sm#066d`, driver `amd21.50.2r5.16.16`
- OC: v9 (Core=1200, Mem=950, PL=100, VDDC=950)
- Mining: ZANO progpow_zano přes SRBMiner v3.2.5 → **17.17 MH/s, 198W, A:share flow OK**
- Skupina: ZANO (1765837) — validační group pro ověření GPU HW
- **Připraveno**: přepnutí na ZION-Deeksha-AMD group (1765707) s custom Deeksha minerem

---

## Další kroky

### Aktivní — nasazení Deeksha mineru
1. **Buildnout Linux zion-miner binárku** s `--features gpu-opencl` pro SMOS (x86_64-unknown-linux-gnu).
2. **Zabalit jako SMOS custom miner** (zip s binárkou + start skriptem + env vars `ZION_OCL_LOCAL_SIZE=64`, `ZION_OCL_VRAM_PCT=25`).
3. **Uploadnout na server** a aktualizovat minerOptions v ZION-Deeksha-AMD group (1765707).
4. **Přepnout rig na Deeksha group** přes `PATCH /rigs/change-rig-group` a monitorovat konzoli.
5. **Ověřit GPU init na i066d** — předchozí OpenCL problémy (compiler hang, buffer deadlock) byly na i085/i088; na i066d (ROCm 5.x) se mohou chovat jinak.

### Otevřené correctness problémy
6. **`gpu_candidate_hash_mismatch`** — občas GPU vrátí kandidáta, jehož hash se neshoduje s CPU referencí. CPU gate chrání pool, ale root cause v OpenCL kernelu zůstává.
7. **Stage-by-stage audit OpenCL pipeline** — hlavně `npu_mix_packed` a závěrečný fusion path.
8. **Zpřísnění GPU-side target checku** — aktuální `target_u32` prefilter místo plného 32B compare.

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
| `/rigs/change-rig-group` | PATCH | Přepnutí rigu do jiné skupiny |
| `/rig-commands` | GET | Seznam dostupných příkazů (reflash images atd.) |

Content-Type pro PATCH endpointy: `application/merge-patch+json`  
Content-Type pro PUT endpointy: `application/json`

### SMOS příkazy (commandId)

| commandId | Image | Vega kompatibilita |
|-----------|-------|---------------------|
| **40** | i066d (`amd21.50.2`, ROCm 5.x) | ✅ Funguje — správný Vega PM |
| 65 | i073 (`amd22.40.6`) | ❌ Vega 19W lock |
| 72 | i085 (`amd22.40.6`) | ❌ Vega 19W lock |
| 79 | i088 (`amd22.40.6`) | ❌ GPU detected DEAD |
| 90 | i089 beta (NV only) | N/A |

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
*Poslední aktualizace: 2026-04-10 — SMOS vyřešeno reflashem na i066d (driver amd21.50.2); Vega jede na 198W / 17.17 MH/s (ZANO). OC optimum nalezeno (v9). Připraveno k nasazení Deeksha mineru.*
