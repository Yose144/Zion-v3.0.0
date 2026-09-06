# Tokenomika — ZION v2.9.5

> Matematická odvodnění základních ekonomických parametrů ZION.

---

## Pevné parametry (neměnné, zakódované v genesis)

| Parametr | Hodnota |
|-----------|--------|
| **Celková emise** | 144 000 000 000 ZION |
| **Čas bloku** | 60 sekund |
| **Bloky za rok** | 525 600 |
| **Roky těžby** (v2.9.5) | 45 (2026–2071) |
| **Celkem bloků** | 23 652 000 |

---

## Matematický důkaz: odměna za blok

```
TOTAL_SUPPLY     = 144 000 000 000 ZION
GENESIS_PREMINE  =  16 780 000 000 ZION
MINING_EMISSION  = 127 220 000 000 ZION

MINING_YEARS     = 45
BLOCKS_PER_YEAR  = 525 600
TOTAL_BLOCKS     = 23 652 000

BASE_BLOCK_REWARD = 127 720 000 000 / 23 652 000
                  = 5 400,067 ZION / blok

Ověření:
  5 400,067 × 23 652 000 = 127 720 384 400 ZION
+ Genesis premine:          16 780 000 000 ZION
                           ──────────────────────
  Celkem:                   144 000 384 400 ZION

Zaokrouhlovací delta: 384 400 ZION = 0,00027 % emise ✅
```

Hodnota 5 400,067 je matematicky odvozená — není libovolná.

> **Změna ve v2.9.6:** zaveden Decade Decay — odměna za blok klesá o 20 % každých 10 let s permanentní tail emisí 725 ZION/blok. Horizont těžby se prodloužil z 45 na 100+ let. Tvrdý strop 144B ZION zůstal.

---

## Genesis premine (16,78B ZION — 11,65 %)

Všechny genesis alokace jsou na řetězci ověřitelné z genesis bloku.

| Kategorie | Částka ZION | % emise | Účel |
|-----------|-------------|---------|------|
| ZION OASIS + Winners | 4 950 000 000 | 3,44 % | odměny OASIS, Golden Egg/Xp události |
| DAO Treasury | 4 000 000 000 | 2,78 % | governance komunity + granty |
| Infrastructure | 2 590 000 000 | 1,80 % | servery, vývoj, bezpečnostní audit |
| Humanitarian Reserve | 1 440 000 000 | 1,00 % | L5 — voda, vzdělání, zdravotnictví |
| **Celkem genesis** | **16 780 000 000** | **11,65 %** | — |

**Pozn.:** Ve specifikaci existovala počáteční alokace presale 500M ZION. Byla zrušena v lednu 2026 a tokeny přidány do DAO Treasury. Presale se nikdy neuskutečnila.

Zbývajících **88,35 %** (127,22B ZION) je emitováno výhradně prostřednictvím PoW těžby.

---

## Rozdělení odměny za blok

Každá odměna za blok je protokolem rozdělena:

| Příjemce | Podíl | Odměna v2.9.5 (5 400,067) |
|----------|-------|---------------------------|
| Těžař | 89 % | ~4 806 ZION |
| Humanitární fond | 5 % | ~270 ZION |
| Nadace Issobella | 5 % | ~270 ZION |
| Mining pool | 1 % | ~54 ZION |

Všechny transakční poplatky jsou spáleny (100 %). Bez developer fee, bez foundation „pre-tax“.

---

## Plán těžební emise (v2.9.5 — konstantní odměna)

| Rok | Bloky | Emise | Kumulativně | % zbývá |
|-----|-------|-------|-------------|---------|
| 2026 | 525 600 | ~2,84B | 2,84B | 97 % |
| 2030 | 525 600 | ~2,84B | 16,9B | 87 % |
| 2040 | 525 600 | ~2,84B | 44,9B | 65 % |
| 2050 | 525 600 | ~2,84B | 73,0B | 43 % |
| 2060 | 525 600 | ~2,84B | 101B | 21 % |
| 2071 | 525 600 | ~2,84B | 127,7B | 0 % (vyčerpáno) |

> v2.9.5 mělo tvrdý konec po 45 letech. v2.9.6 to nahradilo Decade Decay + perpetual tail emisí s neomezeným prodloužením těžby.

---

## Model poplatků

Všechny transakční poplatky jsou **trvale spáleny**. Není přerozdělení minerům ani žádné protokolové adrese. V průběhu životnosti sítě to vytváří deflační tlak na oběžné množství.

---

## Filosofie emise

ZION je záměrně navržen pro dlouhodobě udržitelnou těžební ekonomiku:

- žádná VC alokace
- žádný týmový vesting plán  
- žádná inflace nadace
- žádná governance inflace (DAO používá premine pokladnu, ne novou emisi)
- tvrdý strop — protokolem neměnný
