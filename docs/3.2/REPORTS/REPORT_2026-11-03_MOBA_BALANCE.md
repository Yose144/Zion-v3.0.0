# Report — MOBA: balance sehrávkou (2026-11-03)

> **Zadání:** „1" — **balance sehrávkou**. Sehrát se nedá ručně, tak jsem
> sehrávku udělal programově: harness odehraje desítky zápasů bot vs bot.
> **Kde:** `apps/nirvana/test/moba-balance.mjs` + `core/moba/{sim,map}.ts`
> **Deployed:** net + app (bez změny protokolu)

---

## 1. Metoda

`npx tsx apps/nirvana/test/moba-balance.mjs [počet]` odehraje N zápasů
**2v2 bot vs bot** v čisté simulaci (30 Hz, bez prohlížeče) a měří:

čas zápasu · padlé věže/inhibitory · zabití · zlato · itemy · levely ·
poškození · sebrané runy · zabití bosse · talenty.

Jeden zápas = ~1,5 s běhu, takže 24–32 zápasů dá smysluplný vzorek za půl minuty.

## 2. 🔴 První běh: hra bez hráče vůbec nefungovala

| # | Nález | Důsledek | Oprava |
|---|---|---|---|
| 1 | **Boti nikdy neopustili základnu** — `stepBot` bez cíle v dosahu jen `return` | 0 XP, 0 zlata, level 1, 0 itemů, 0 věží | linková chůze + zastavení u nepřátelské základny |
| 2 | **`hero.botCast` zůstal nastavený** po neúspěšném seslání (regrese z F6) | bot **zamrzl** v půlce mapy se zařazeným kouzlem | `botCast` se čistí po pokusu o seslání |
| 3 | **Chyběla regenerace v základně** | zraněný hrdina se nikdy nevyléčil → seděl u spawnu navěky | fontána: 12 % HP/mana za sekundu do 9 m |
| 4 | **Rozřazení do linek bylo asymetrické** (modrá top+mid, červená bottom+top) | modrá vyhrála 6/6 jen kvůli rozřazení | linky symetricky podle týmu |
| 5 | **Časový limit rozhodoval `blue >= red`** | **všech 12 timeoutů** vyhrála modrá | skóre = struktury + zabití |

## 3. Tuning podle dat

| Parametr | Před | Po | Proč |
|---|---|---|---|
| `WAVE_INTERVAL_MS` | 24 000 | **18 000** | 8minutový zápas potřebuje víc vln |
| `WAVE_SIZE` | 3 | **4** | farma a tlak na linku |
| `MINION_XP` | 26 | **55** | level 1–2 na konci zápasu byl málo |
| `MINION_GOLD` | 24 | **22** | kompenzace vyššího počtu minionů |
| autoútok hrdiny | 28 + 3×CL | **36 + 3×CL** | souboje se nedokončovaly (0,3 killu) |
| poškození struktur | 26 | **30** | Nexa nepadala v limitu |
| `TOWER_HP` | 1700 | **1500** | |
| `BASE_TOWER_HP` | 2200 | **1900** | |
| `INHIBITOR_HP` | 1800 | **1500** | |
| `NEXUS_HP` | 4000 | **2800** | |
| ústup botů (normal) | 55 % HP | **32 %** | boti utíkali z každé rány |
| dokončení soupeře | — | **pod 30 % HP** | jinak se duel nikdy nedokončil |

Navíc boti od této chvíle **berou runy** (do 22 m) a **chodí na bosse**
(od levelu 8) — do té doby byly objektivy pro boty neviditelné.

## 4. Výsledek (24 zápasů, 2v2 boti)

| Metrika | Před | Po |
|---|---|---|
| Průměrný čas | 480 s (limit) | **342 s** |
| Zápasy končící Nexou | 0 % | **58 %** |
| Výhry modrá / červená | 12 / 0 (bug) | **10 / 14** |
| Padlé věže | 0 | **11,1 z 18** |
| Padlé inhibitory | 0 | **1,8 z 6** |
| Zabití na zápas | 0 | **7,5** |
| Level na hrdinu | 1 | **8,8 z 15** |
| Itemy na hrdinu | 0 | **3,7 ze 6** |
| Sebrané runy | 0 | **2,6** |
| Zabití bosse | 0 | 0 |

## 5. Co zůstává (poctivě)

- **Boss Boti neberou** — chodí k němu, ale málokdy ho dokončí (priorita
  cíle přebije rotaci). Pro člověka boss funguje.
- **Boti nejsou dobří hráči** — čísla platí pro bot-vs-bot; lidská hra bude
  rychlejší (lepší last hit, rotace, schopnosti).
- **Nejsou asistence v KDA** a skóre nezohledňuje map control.
- **Vzorek 24–32 zápasů** je orientační; na jemné doladění chce 100+ a lidské
  sehrávky.
- **Balance je jedna iterace** — čísla jsou teď „hratelná", ne „vyladěná".

## 6. Jak sehrávku zopakovat

```bash
cd apps/nirvana
npx tsx test/moba-balance.mjs 32      # 32 zápasů + souhrn
npx tsx test/moba-sim.mjs             # regresní pravidla (177 kontrol)
```

---

**Souvisí:** [`MOBA-PRVNI-SVET-PLAN.md`](../../3.3/MOBA-PRVNI-SVET-PLAN.md) § 5 ·
`apps/nirvana/AGENTS.md` § PRVNÍ SVĚT — balance · commit `13645e451`
