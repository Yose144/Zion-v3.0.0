# ZION Miner — FAQ (Frequently Asked Questions)

**Version:** v3.0.6-beta
**Pool:** `62.171.141.136:8444`
**Website:** [zionterranova.com](https://zionterranova.com)

---

## General — pro úplné začátečníky

### Co je ZION?
ZION je **kryptoměna** (digitální peníze) zabezpečená těžbou, podobně jako Bitcoin. Můžeš ji těžit svým počítačem, posílat ji nebo později používat ve hře Oasis.

### Co potřebuju, abych mohl těžit?
- Počítač s **Windows 10/11**, **macOS** nebo **Linux**.
- Alespoň jedno CPU jádro; pro slušný výkon doporučujeme **GPU** (grafickou kartu).
- **ZION wallet** — adresa, kam budou chodit odměny (začíná na `zion1…`).

### Co je pool a proč ho použít?
**Pool** je skupina těžařů, kteří spojí výkon. Když pool najde blok, odměna se rozdělí mezi všechny podle toho, kolik "share" odeslali. Pro začátečníky je **pool vždy lepší** než sólo těžba.

### Co je share?
"Share" je malý důkaz práce, který odesíláš poolu. Pool podle počtu share vypočítá tvou odměnu. Nemusíš sám najít blok — stačí posílat share.

### Co je worker?
**Worker** je jméno tvého stroje. Můžeš mít například `rig-1`, `gaming-pc` nebo `smos-rig`. Užitečné, když těžíš na více počítačích a chceš je rozlišit na dashboardu poolu.

---

## Wallet a odměny

### Jak zjistím svou wallet adresu?
Stáhni si oficiální ZION CLI nebo použij `zion wallet new` (viz [README](../README.md)). Adresa začíná `zion1…` a je veřejná — můžeš ji bezpečně sdílet jako "číslo účtu".

### Musím mít vlastní uzel (node)?
Ne. Standalone miner se sám připojí k oficiálnímu poolu. Node je volitelný, pokud chceš pomoci decentralizaci nebo používat pokročilé funkce.

### Kdy uvidím odměny?
Pool obvykle vyplácí podle pravidel poolu. Odměny se objeví ve tvé wallet adrese. Konkrétní výplatu sleduj na webu poolu/dashboardu.

### Proč mi nerostou ZIONy ihned?
Těžba není okamžitá bankomatová transakce. Pool sbírá share, až když najde blok, rozdělí odměnu. Trvá to minuty až hodiny podle štěstí a výkonu poolu.

---

## Desktop — Windows, macOS, Linux

### Kde stáhnu miner?
Nejnovější v3.0.6-beta balíčky najdeš v release **[v3.0.6-beta](https://github.com/Zion-TerraNova/v3-Mainnet/releases/tag/v3.0.6-beta)**:

| Platform | Soubor |
|----------|--------|
| Linux x86_64 | `zion-miner-linux-x86_64.tar.gz` |
| Linux ARM64 | `zion-miner-linux-aarch64.tar.gz` |
| macOS Apple Silicon | `zion-miner-macos-aarch64.tar.gz` |
| macOS Intel | `zion-miner-macos-x86_64.tar.gz` |
| Windows x86_64 | `zion-miner-windows-x86_64.zip` |

### Jak rychle začít těžit? (Linux / macOS)
```bash
# 1. Stáhni a rozbal
wget https://github.com/Zion-TerraNova/v3-Mainnet/releases/download/v3.0.6-beta/zion-miner-linux-x86_64.tar.gz
tar xzf zion-miner-linux-x86_64.tar.gz
chmod +x zion-miner start.sh

# 2. Spusť interaktivní menu
./zion-miner
```

### Jak rychle začít těžit? (Windows)
1. Stáhni `zion-miner-windows-x86_64.zip`.
2. Rozbal zip (pravý klik → "Extract All").
3. Dvakrát klikni na `zion-miner.exe` a odpověz na otázky.

### Co dělá `start.sh` / `start.bat`?
Je to pokročilý wrapper, který se zeptá na stejné věci jako `./zion-miner`
navíc s možností předat vlastní argumenty. Zeptá se tě na:
- **pool** (výchozí `62.171.141.136:8444`)
- **wallet adresu** (povinná)
- **worker name**
- **GPU backend** (`auto`, `opencl`, `cuda`, `metal`, `cpu`)
- **počet CPU vláken**
- **algoritmus** (výchozí `deeksha_lite_v1`)
- **profil** (`pool`, `solo`, `benchmark`)

Pak spustí miner se správnými parametry. Nastav `ZION_EASY_MENU=0`
a argumenty se předají přímo binárce.

### Jak těžit bez menu (příkazová řádka)?
```bash
./zion-miner \
    --pool 62.171.141.136:8444 \
    --wallet zion1TVOJEADRESA \
    --worker desktop-rig \
    --gpu auto \
    --algorithm deeksha_lite_v1 \
    --profile pool
```

### Jaký GPU backend mám zvolit?
| GPU | Doporučený backend | Poznámka |
|-----|-------------------|----------|
| NVIDIA na Linux x86_64 | `auto` nebo `cuda` | CUDA je nejrychlejší |
| AMD/Intel na Linux x86_64 | `auto` nebo `opencl` | OpenCL |
| Apple Silicon (M1/M2/M3/M4) | `auto` nebo `metal` | Metal |
| starší Mac s AMD/Intel | `opencl` nebo `cpu` | OpenCL může být na macOS omezené |
| Windows NVIDIA | `auto` nebo `cuda` | Windows build má zatím CUDA |
| Windows AMD/Intel | `opencl` nebo `cpu` | OpenCL podpora přijde v dalším release |
| žádná/neznámá GPU | `cpu` | pomalejší, ale funguje všude |

### Proč `--gpu auto` nevybere správnou GPU?
`--gpu auto` zkompilovaný miner zkontroluje, jaké backendy máš k dispozici, a vybere ten nejlepší. Pokud máš více GPU nebo neobvyklou konfiguraci, nastav backend ručně (`cuda`, `opencl`, `metal`).

### Jak poznám, že to těží?
Miner zobrazí interaktivní TUI (tabulku) s hashrate, accepted/rejected shares a uptime. Pokud chceš log místo TUI, spusť s `--no-tui` nebo `ZION_INTERACTIVE=0`.

### Jak vypnu TUI?
```bash
./start.sh   # a na otázku "profile" dej třeba pool --no-tui se nepoužívá
# nebo ručně:
./zion-miner --pool 62.171.141.136:8444 --wallet zion1... --no-tui
```

---

## SMOS / HiveOS / SimpleMining

### Jak nainstalovat miner na SMOS?
Podrobný návod je v [SMOS_HIVEOS_GUIDE.md](./SMOS_HIVEOS_GUIDE.md). Stručně:
1. Stáhni `zion-miner-linux-x86_64.tar.gz`.
2. Vytvoř wrapper script `miner` s wallet, worker a `ZION_INTERACTIVE=0`.
3. Zabal do `zion-miner-smos.zip` a nahraj do SMOS jako Custom miner.

### Jaký backend pro SMOS?
Většinou `opencl` pro AMD a `cuda` pro NVIDIA. Pokud SMOS rig má více různých GPU, použij `auto` a miner se pokusí vybrat správně.

### Proč mi SMOS neukazuje hashrate?
SMOS čte `session_status` řádky na stdout. Ujisti se, že:
- `ZION_INTERACTIVE=1` není nastaveno (pro SMOS by mělo být `0`).
- Miner běží a posílá share.
- Tvůj wrapper nepřesměrovává stderr jinam.

### Jak nastavit HiveOS flight sheet?
| Pole | Hodnota |
|------|---------|
| Miner | `zion-miner` (custom) |
| Pool | `62.171.141.136:8444` |
| Wallet | `zion1TVOJEADRESA` |
| Worker | `my-rig` |
| Extra config | `--profile pool --gpu auto --algorithm deeksha_lite_v1` |

---

## GPU, výkon a ladění

### Proč je moje hashrate nízká?
Nejčastější příčiny:
1. **Zvolený backend** — CUDA na NVIDIA je rychlejší než OpenCL.
2. **Work size** — miner autotune nastavuje sám, ale můžeš přizpůsobit `ZION_GPU_WORK_SIZE`.
3. **Běží na CPU místo GPU** — zkontroluj `--gpu auto` nebo nastav ručně.
4. **GPU je limitovaná VRAM** — DAG/memory-hard algoritmy se na malé VRAM přeskočí.
5. **Nedostatek chlazení / thermal throttling** — GPU se zpomalí, pokud je příliš horká.

### Jak vyzkouším benchmark?
```bash
./zion-miner --profile benchmark --gpu auto --algorithm deeksha_lite_v1 --wallet zion1...
```

### Co znamená "accepted" a "rejected"?
- **Accepted** — share byl přijat poolem a započítán.
- **Rejected** — share byl odmítnut, obvykle kvůli zastaralé práci nebo špatnému targetu. Občasné rejected jsou normální, vyšší % rejected (>5%) může znamenat problém.

### Jak ušetřit VRAM?
```bash
export ZION_OCL_VRAM_PCT=50   # výchozí je 65; sniž pro slabší karty
```

### Můžu těžit na notebooku?
Ano, ale pozor na přehřívání. Notebooky mají horší chlazení než stolní PC. Doporučujeme snížit `ZION_OCL_VRAM_PCT` a počet CPU vláken.

---

## Chyby a řešení problémů

### "GPU not detected" / "no GPU device available"
Zkontroluj, jestli máš ovladače a OpenCL/CUDA/Metal runtime:
- **Linux OpenCL**: `apt install clinfo ocl-icd-opencl-dev && clinfo`
- **Linux CUDA**: nainstaluj NVIDIA drivery a CUDA toolkit.
- **macOS**: Metal podporuje Apple Silicon a některé Intel/AMD GPU. Na nových M1-M4 zkus `--gpu metal`.

### "cannot find -lOpenCL" při kompilaci zdroje
```bash
# Debian/Ubuntu
sudo apt install ocl-icd-opencl-dev opencl-headers
```

### Vega 64 se zasekne
```bash
export ZION_IGNORE_GPU_SELF_TEST_FAIL=1
export ZION_OCL_VRAM_PCT=50
```

### Pool se nepošle / Connection refused
1. Zkontroluj, že pool je `62.171.141.136:8444`.
2. Ujisti se, že firewall/router umožňuje odchozí spojení na port `8444`.
3. Zkus znovu — občasné výpadky poolu se mohou vyskytnout.

### Miner se okamžitě vypne
Zkontroluj:
- Máš zadanou **wallet adresu**?
- Máš správný `--profile` (`pool` nebo `solo`) a `--algorithm`?
- Používáš správný binární soubor pro svou platformu? (`zion-miner` pro Linux/macOS, `zion-miner.exe` pro Windows)

---

## Bezpečnost a soukromí

### Komu můžu ukázat svou wallet adresu?
Wallet adresu (`zion1…`) můžeš sdílet — je to jako číslo účtu. **Nikdy** nesdílej:
- 24-word mnemonic
- soubor s peněženkou (`my-wallet.json`) bez hesla
- soukromý klíč

### Je bezpečné stahovat binárky z GitHubu?
Ano, pokud používáš oficiální release. Vždy ověř SHA256 checksum v `SHA256SUMS.txt`.

### Může mě těžba poškodit počítač?
Při normálním použití ne. GPU se zahřeje, proto ujisti se o dobré ventilaci. Na notebooku těž na vlastní nebezpečí a sleduj teploty.

---

## Ještě něco?

- **Podrobný SMOS/HiveOS návod:** [SMOS_HIVEOS_GUIDE.md](./SMOS_HIVEOS_GUIDE.md)
- **Podpora:** [GitHub Issues](https://github.com/Zion-TerraNova/v3-Mainnet/issues)
