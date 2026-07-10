# ZION CLI Guide (pro úplného začátečníka)

## Co je ZION CLI

`zion` je jeden binary, který umí všechno:

- **Wallet** — vytvoř, spravuj, posílej ZION
- **Node** — spusť full L1 node, synchronizuj s sítí
- **Miner** — těž CPU nebo GPU (Ekam Deeksha BLAKE3 + RandomNPU)
- **Pool** — připoj se ke poolu, sleduj statistiky
- **Status** — celkový stav sítě a tvého uzlu
- **Doctor** — rychlá zdravotní kontrola
- **Monitor** — live dashboard s hashrate a zůstatkem

Pokud jsi úplný laik: ber to jako "ovládací panel v terminálu".

---

## Co potřebuješ před prvním spuštěním

Minimum:

1. Otevřít Terminál (macOS) / PowerShell (Windows) / shell (Linux).
2. Stáhnout `zion` binary z [GitHub Releases](https://github.com/Zion-TerraNova/v3-Mainnet/releases).
3. Žádný Rust kompilátor není potřeba — binary je hotový.

Pro ARM64 (Raspberry Pi, AWS Graviton) je potřeba build ze zdrojů:

```bash
git clone https://github.com/Zion-TerraNova/v3-Mainnet.git
cd v3-Mainnet/V3
cargo build --release -p zion-public
# Binary → target/release/zion
```

---

## Nejjednodušší první spuštění

Po rozbalení archive:

```bash
./zion
```

Bez argumentů se otevře interaktivní menu se šipkami.

---

## Interaktivní menu

Spuštění `zion` bez argumentů otevře menu:

```bash
zion
```

Nebo explicitně:

```bash
zion menu
```

Ovládání:

- šipky ↑↓ = pohyb,
- Enter = potvrzení,
- Esc = zpět,
- menu tě po dokončení vrací zpět.

Menu tě provede: wallet → node → pool → miner, krok za krokem.

---

## Absolutní první workflow (kopíruj a vlož)

Pokud nevíš, kde začít, jed tímto pořadím:

```bash
zion doctor
zion status
zion wallet new --mnemonic --out my-wallet.json --print
zion node status
zion pool stats
zion mine start --pool stratum+tcp://62.171.141.136:8444 --wallet YOUR_ADDRESS
```

Co čekat:

- `doctor` udělá rychlý preflight (config, endpointy, připravenost),
- `status` ukáže celkový stav sítě,
- `wallet new` vytvoří peněženku s 24 slovy,
- `node status` ukáže stav tvého uzlu,
- `pool stats` ukáže stav poolu,
- `mine start` začne těžit.

---

## Nejčastější příkazy pro běžného uživatele

### Stav a zdraví

```bash
zion status
zion doctor
zion monitor
```

### Node / chain

```bash
zion node status
zion node peers
zion node sync
```

### Pool / mining

```bash
zion pool stats
zion mine status
zion mine bench
zion mine start --pool stratum+tcp://62.171.141.136:8444 --wallet YOUR_ADDRESS
zion mine stop
```

### Wallet

```bash
zion wallet new --mnemonic --out my-wallet.json
zion wallet balance --address YOUR_ADDRESS
zion wallet send --to RECIPIENT --amount 1.5
zion wallet import --file my-wallet.json
```

---

## Důležitá realita pro rok 2026

ZION je v **Mainnet Beta** — síť běží a produkuje bloky, ale může obsahovat chyby.
Těž a transakuj na vlastní riziko. Oficiální veřejný launch: **31. prosince 2026**.

Genesis chain je **permanentní** — nebude resetována.

---

## Bezpečný postup při problému

Použij přesně toto pořadí:

1. `zion status`
2. `zion doctor`
3. `zion node status`
4. `zion pool stats`
5. `zion mine status`

Nikdy nezačínej náhodným restartem všeho bez diagnostiky.

---

## Co číst dál

- [ZION CLI Reference](cli-reference.md) — všechny příkazy
- [ZION CLI Troubleshooting](cli-troubleshooting.md) — řešení problémů
- [ZION CLI FAQ](cli-faq.md) — časté otázky
