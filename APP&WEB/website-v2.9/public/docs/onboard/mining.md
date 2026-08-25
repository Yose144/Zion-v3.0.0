# Těžba ZION

Těžba ZION běží na algoritmu **Cosmic Harmony Deeksha**.

> **Proč těžit už teď:** ZION je v první dekádě emise — odměna **5 400,067 ZION/blok** je nejvyšší, jakou kdy protokol vyplatí, a s každou další dekádou klesá o pětinu. Síť je zatím malá, takže o nalezené bloky se dělí míň strojů. Nikdo neslibuje cenu ani zisk — jen poctivou matematiku raného vstupu. Celý příběh (včetně Bitcoin Pizza Day) najdeš v kapitole [Hodina před deštěm](/onboard#why-now).

## Nejjednodušší cesta — ZION Public Miner

Pro většinu uživatelů je nejjednodušší těžit přes desktopovou aplikaci:

1. Nainstaluj **ZION Public Miner** (viz kategorie **Desktop App**).
2. Vytvoř peněženku a získej adresu.
3. Nastav **Pool** na `pool.zionterranova.com:8444`.
4. Zvol počet CPU vláken a případně zapni GPU.
5. Klikni na **Start Mining**.

Aplikace se postará o vše ostatní — připojení na pool, sledování hashrate a share.

## Parametry sítě

- **Block time:** 60 s
- **Block reward:** 5 400,067 ZION
- **DAA:** LWMA 60 bloků, ±25 %
- **Mining horizon:** 100+ let

## Block reward distribuce

| Příjemce | Podíl |
|----------|-------|
| Těžaři | 89 % |
| Humanitární tithe | 5 % |
| L5/L6 Issobella fond | 5 % |
| Pool fee / burn | 1 % |

## Pokročilá těžba z příkazové řádky

```bash
zion mine start --backend cpu --threads 4 --pool pool.zionterranova.com:8444
```

Alternativně s vlastním cílovým algoritmem a adresou (počkej na konkrétní releasovou dokumentaci pro `--miner.wallet` a `--miner.algorithm`):

```bash
zion mine start --backend cuda --threads 4 --pool pool.zionterranova.com:8444 \
  --miner.wallet zion1PRIKLADNA_ADRESA --miner.worker muj-rig
```

## Pool dashboard

Webový přehled poolu je zatím ve vývoji.

## Tipy

1. Pro CPU těžbu nastav `--threads` podle počtu fyzických jader.
2. Sleduj teplotu a spotřebu.
3. Ujisti se, že máš zálohovanou adresu peněženky.
