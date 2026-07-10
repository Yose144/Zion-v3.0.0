# ZION CLI FAQ (jednoduše)

## Co je ZION CLI?

`zion` je jeden binary, který umí všechno: wallet, node, miner, pool, status, doctor, monitor.
Žádné 8 oddělených binárek — jeden soubor, interaktivní menu, hotovo.

## Kde stáhnu binary?

Na GitHub Releases:

https://github.com/Zion-TerraNova/v3-Mainnet/releases/tag/v3.0.5-beta

4 platformy: Linux x86_64, macOS Apple Silicon, macOS Intel, Windows x86_64.
Pro ARM64 (Raspberry Pi) build ze zdrojů.

## Musím mít GPU, aby CLI fungovalo?

Nemusíš.

Základní operace (`status`, `doctor`, `wallet`, `node`) fungují i bez GPU.
Těžba běží na CPU výchozím backendem.

## Jaký je úplně první příkaz po spuštění terminálu?

```bash
zion
```

Bez argumentů se otevře interaktivní menu.
Nebo klasicky:

```bash
zion doctor
zion status
```

## Můžu používat CLI bez interaktivního menu?

Ano.

Menu je pohodlné pro začátečníka, ale všechny příkazy jdou spouštět klasicky:

```bash
zion wallet new --mnemonic --out my-wallet.json
zion node status
zion mine start --pool stratum+tcp://62.171.141.136:8444 --wallet YOUR_ADDRESS
```

## Jaké vrstvy platí v dokumentaci?

- L1 = blockchain, pool, miner
- L2 = bridge, DAO, DeFi
- L3 = AI Native, WARP, NCL
- L4 = OASIS
- L5 = Free World
- L6 = Issobella

Komunitní CLI (`zion`) pokrývá L1 (wallet, node, mine, pool).
L2/L3 služby jsou operátorské — běží na serveru.

## Jak poznám, že je problém v node a ne ve webu?

Použij rychlý test:

```bash
zion node status
```

Když node neběží nebo padá, explorer/web obvykle nemá odkud číst data.

## Jaké algoritmy těžby jsou k dispozici?

**Ekam Deeksha** — dual-algo PoW: BLAKE3 + RandomNPU.

Backendy:

- `cpu` — výchozí, funguje všude
- `opencl` — Linux/Windows GPU (AMD, NVIDIA)
- `cuda` — NVIDIA GPU (Linux/Windows)
- `metal` — macOS Apple Silicon GPU

## Jaká je nejbezpečnější rutina pro laika?

Před každou větší akcí:

1. `zion doctor`
2. `zion status`
3. `zion wallet balance --address YOUR_ADDRESS`

## Je ZION v produkci?

ZION je v **Mainnet Beta** — síť běží a produkuje bloky, ale může obsahovat chyby.
Těž a transakuj na vlastní riziko. Oficiální veřejný launch: **31. prosince 2026**.

Genesis chain je **permanentní** — nebude resetována.

## Jak ověřím SHA256 checksum?

```bash
# Linux / macOS
shasum -a 256 zion-cli-linux-x86_64.tar.gz
# Porovnej s SHA256SUMS.txt

# Windows
Get-FileHash zion-cli-windows-x86_64.zip -Algorithm SHA256
```
