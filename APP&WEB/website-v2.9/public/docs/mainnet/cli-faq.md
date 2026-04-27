# ZION CLI FAQ (jednoduše)

## Je ZION CLI jen "obal" kolem node?

Ne.

`zion` je jednotná vstupní brána pro více vrstev najednou: L1, L2, L3 i operace (deploy, logy, monitoring).

## Musím mít GPU, aby CLI fungovalo?

Nemusíš.

Základní operace (`status`, `doctor`, `node`, `pool`, `deploy`) fungují i bez GPU.

## Co znamená, když je agent ve fallback režimu?

Služba běží, ale backend model není dostupný.

To je očekávané chování: systém je transparentní a nezamlčuje chybu.

## Jaké vrstvy platí v dokumentaci?

- L1 = blockchain, pool, miner
- L2 = bridge, DAO, DeFi
- L3 = AI Native, WARP, NCL
- L4 = OASIS
- L5 = Free World
- L6 = Issobella

## Jaký je úplně první příkaz po spuštění terminálu?

```bash
zion doctor
```

Když `zion` nemáš v PATH:

```bash
cargo run --manifest-path V3/Cargo.toml -p zion-cli -- doctor
```

## Proč některé příkazy pracují se jmény služeb a ne kontejnerů?

Protože CLI cílí na compose služby (source of truth), ne na náhodné názvy kontejnerů.

## Jak poznám, že je problém v node a ne ve webu?

Použij rychlý test:

```bash
zion node status
zion logs node
```

Když node neběží nebo padá, explorer/web obvykle nemá odkud číst data.

## Můžu používat CLI bez interaktivního menu?

Ano.

Menu je pohodlné pro začátečníka, ale všechny příkazy jdou spouštět klasicky:

```bash
zion status
zion node status
zion pool stats
```

## Jaký je rozdíl mezi `zion update` a `zion deploy update`?

- `zion update` = aktualizuje lokální CLI binárku.
- `zion deploy update` = řeší runtime na serveru.

## Jaká je nejbezpečnější rutina pro laika?

Před každou větší akcí:

1. `zion config validate`
2. `zion doctor`
3. `zion status`
