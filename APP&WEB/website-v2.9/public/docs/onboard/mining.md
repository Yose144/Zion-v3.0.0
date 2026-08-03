# Těžba ZION

Těžba ZION běží na algoritmu **Cosmic Harmony Deeksha**.

## Parametry sítě

- **Block time:** 60 s
- **Block reward:** 5 400,067 ZION
- **DAA:** LWMA 60 bloků, ±25 %
- **Mining horizon:** 100+ let

## Block reward distribuce

| Příjemce | Podíl |
|----------|-------|
| ⛏️ Miners | 89 % |
| 🕊️ Humanitarian Tithe | 5 % |
| 🔭 L5/L6 Issobella Fund | 5 % |
| 🏊 Pool Fee | 1 % |

## Připojení na veřejný pool

```bash
./target/release/zion-miner \
  --pool seed.zionterranova.com:3333 \
  --wallet "zion1qTVOJE_ADRESA" \
  --worker muj-rig \
  --algo cosmic_harmony \
  --threads 4
```

## Pool dashboard

Webový přehled poolu najdeš na:

- `https://pool.zionterranova.com`

## Tipy

1. Pro CPU těžbu nastav `--threads` podle počtu fyzických jader.
2. Sleduj teplotu a spotřebu.
3. Ujisti se, že máš zálohovanou adresu peněženky.
