# ZION CLI Guide (pro úplného začátečníka)

## Co je ZION CLI

`zion` je hlavní příkazová brána pro správu ZION stacku.

Jedním nástrojem umíš řešit:

- L1: node, pool, miner, wallet,
- L2: bridge a DAO,
- L3: AI Native, WARP, NCL,
- operace: status, logy, deploy, monitoring.

Pokud jsi úplný laik: ber to jako "ovládací panel v terminálu".

---

## Co potřebuješ před prvním spuštěním

Minimum:

1. Otevřít Terminál (macOS) / PowerShell (Windows) / shell (Linux).
2. Mít repo projektu (složka `2.9.6`) na disku.
3. Mít nainstalovaný Rust (`cargo`) nebo připravený build server, kde CLI už je.

Rychlá kontrola:

```bash
cargo --version
```

Když se vypíše verze, můžeš pokračovat.

---

## Nejjednodušší první spuštění (bez instalace binárky)

Z kořene repa:

```bash
cargo run --manifest-path V3/Cargo.toml -p zion-cli -- --help
```

První praktické příkazy:

```bash
cargo run --manifest-path V3/Cargo.toml -p zion-cli -- status
cargo run --manifest-path V3/Cargo.toml -p zion-cli -- doctor
```

Tohle je nejlepší start pro laiky: nemusíš nic instalovat do PATH.

---

## Spuštění přes interaktivní menu

Po buildnutí CLI můžeš použít menu mód:

```bash
zion
```

Nebo explicitně:

```bash
zion menu
```

Ovládání:

- šipky = pohyb,
- Enter = potvrzení,
- menu tě po dokončení vrací zpět (nemusíš vše psát ručně).

---

## Absolutní první workflow (kopíruj a vlož)

Pokud nevíš, kde začít, jed tímto pořadím:

```bash
zion config validate
zion doctor
zion status
zion node status
zion pool stats
zion agent status
```

Co čekat:

- `config validate` ověří konfiguraci,
- `doctor` udělá rychlý preflight,
- `status` ukáže celkový stav služeb,
- `node/pool/agent status` zúží problém na konkrétní vrstvu.

---

## Když příkaz `zion` neexistuje

Používej bezpečný fallback přes `cargo run`:

```bash
cargo run --manifest-path V3/Cargo.toml -p zion-cli -- status
```

Stejně tak pro další příkazy:

```bash
cargo run --manifest-path V3/Cargo.toml -p zion-cli -- node status
cargo run --manifest-path V3/Cargo.toml -p zion-cli -- pool stats
```

---

## Nejčastější příkazy pro běžného uživatele

### Stav a zdraví

```bash
zion status
zion doctor
zion logs node
```

### Node / chain

```bash
zion node status
zion node peers
zion node block 6801
```

### Pool / mining

```bash
zion pool stats
zion mine status
zion mine bench
```

### Agent (L3)

```bash
zion agent status
zion agent config
zion agent ask "What is current L3 state?"
```

---

## Důležitá realita pro rok 2026

AI Native vrstva je dnes hlavně orchestrátor/control-plane.

To znamená:

- služba může být zdravá i když backend model běží ve fallback režimu,
- fallback je lepší než tichý pád,
- vždy nejdřív ověř služby (`status`, `doctor`, `logs`) a až pak řeš model.

---

## Bezpečný postup při problému

Použij přesně toto pořadí:

1. `zion status`
2. `zion node status`
3. `zion pool stats`
4. `zion agent status`
5. `zion logs <sluzba>`

Nikdy nezačínej náhodným restartem všeho bez diagnostiky.

---

## Co číst dál

- ZION CLI FAQ
- ZION CLI Reference
- ZION CLI Troubleshooting
- ZION CLI Deploy Playbook
