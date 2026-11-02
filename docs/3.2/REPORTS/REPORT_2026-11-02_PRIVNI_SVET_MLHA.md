# REPORT 2026-11-02 — PRVNÍ SVĚT: MLHA VÁLKY (PROTOKOL 7)

> **Co to je:** druhý krok rozšiřování MOBA `/earth`. Do teď byla celá mapa
> průhledná — jungling neměl smysl (soupeř tě vidí u tábora), gank neexistoval
> (nikdo se neplížil) a past byla jen dekorace.
>
> **Výchozí stav:** školy kouzel a ochrana věží hotové (`36896c1e8`),
> ale snapshot se posílal všem stejný a obsahoval celou mapu.

**Deployed:** net `20261102T184752Z` · app `20261102T185622Z` · commity
`d2297a70f` (mlha) + `a37268ff0` (oprava debug háčku). **Protokol 6 → 7.**

---

## 1. Vidění drží jednotky, ne mapa

| jednotka | vidí |
|---|---|
| hrdina | 14 m |
| minion | 8 m |
| věž / Nexa | 12 m |
| **vlastněný** uzel L5 | 10 m |

Uzel L5 je odměna za převzetí: kdo ho drží, vidí okolí. To propojuje
stávající mechaniku (2,6 s stání = převzetí, +5 % dmg) s novou — najednou
má smysl ho bránit, ne jen zabrat.

## 2. Co se filtruje a co ne

**Posílá se vždy:**
- vlastní tým, **i mrtvý** (hráč musí vidět respawn timer)
- struktury (věže a Nexy) — bez nich by mapa přestala být mapou
- uzly L5

**Filtruje se:**
- nepřátelští hrdinové — jen **živí a vidění**; mrtvý v mlze nemá prozradit,
  kde se za 20 s objeví
- minioni a monstra
- projektily — projektil letící mlhou prozradí střelce

**Bez `viewerTeam`** (divák, debug) se posílá všechno. Debug háček v sólu to
používá schválně, aby E2E vidělo soupeře.

## 3. Server posílá jiný snapshot každému týmu

`mobaSnapshot(state, viewerTeam)` je jediné místo filtrování. Server skládá
snapshot **jednou na tým**, ne na hráče — 5v5 × 15 Hz by jinak stavělo
10 snapshotů za tick.

Simulace se **nefiltruje**: počítá celou mapu (monstra, boti, zásahy). Kdyby
se filtrovala sim, AI by hrála naslepo a hra by se rozpadla.

Sólo má mlhu taky (`MobaGame` posílá `you.team`) — jinak by sólo a multiplayer
byly dvě různé hry.

## 4. Protokol 6 → 7

Formát zpráv se nezměnil, ale **semantika ano**: starý klient by na novém
serveru viděl celou mapu (cheat) a nový klient na starém serveru by nedostal
filtrované snapshoty. Verze se musí potkat → **deploy net první**.

## 5. Co se ověřilo

| Test | Výsledek |
|---|---|
| `apps/nirvana/test/moba-sim.mjs` | **57/57** (+10 kontrol mlhy) |
| `nirvana-net` smoke / arena / arena-bots / race / fight / **moba** | vše OK |
| `e2e/first-world.mjs` (proti produkci) | **11/11** |
| `e2e/moba-online.mjs` (proti produkci) | **18/18** |
| `apps/nirvana/test/links.mjs` | 62/62 |
| `tsc` | 0 chyb |
| živě | `/api/health` → `proto 7`, `proto_match: true` |

**Přímý WS test proti produkci** (dva klienti, bez prohlížeče):

```
A you=c_f521… snapshots=129 state=running time=2.6 heroes=5 towers=14 teams=blue
B you=c_3116… snapshots=130 state=running time=2.7 heroes=5 towers=14 teams=red
```

Každý vidí **svých pět** hrdinů a čtrnáct struktur — mlha funguje.

## 6. Dvě pasti, které to odhalily

1. **`proto: 6` bylo jako literál v sedmi testech.** Bump shodil
   smoke/arena/fight. Testy teď importují `PROTO_VERSION` z protokolu —
   další bump je nerozbije.
2. **`__mobaDebug` v `MobaOnline` se plnil v `useFrame`.** Když prohlížeč
   uspí kartu na pozadí, `requestAnimationFrame` přestane běžet a háček
   navěky vrací starý snapshot (`time: 0`, prázdná pole). V E2E to vypadalo,
   že hráč nic nevidí — a já hledal chybu na serveru, který byl správný.
   Háček teď čte **refy**. Stejná past, jakou `AGENTS.md` popisuje u Merkuru
   („`hud.current` musí nést čerstvá stats").
3. **Dva prohlížeče v E2E: klávesy jdou jen do stránky vpředu.** Hra správně
   pouští vstup při `blur`, takže `page.keyboard.down()` na pozadí nic
   neudělá — `bringToFront()` před vstupem.

## 7. Co je dál

1. ✅ Bojová identita (školy + ochrana věží)
2. ✅ **Mlha války** *(tento report)*
3. ⏭ **Ekonomika** — víc itemů, recepty, sloty
4. **Mapa** — silnější Prastaré stvoření, bushe, řeka
5. **Meta** — obtížnosti botů, statistiky, leaderboard

## 8. Meze

- **Vizuální mlha (tmavé území) není.** Jednotky v mlze se prostě neposílají;
  hráč nevidí „černo". Kdo chce mlžný overlay, musí do `MobaStage` přidat
  shader nebo tmavý plán s děrovanou maskou — samostatná práce.
- **Boti mlhu respektují jen tím, že ji nepotřebují** — server počítá vše,
  takže AI „vidí" i to, co hráč ne. Není to exploit (bot neumí cílit přes
  mlhu líp než hráč), ale férové by bylo omezit i `stepBot`.
- **Efekty se nefiltrují** — jsou krátké (≤1,4 s) a nesou odezvu na zásah;
  prozrazení je minimální. Kdyby to vadilo, patří sem `team` u `Effect`.
- **Vyvážení vidění je odhad.** 14 m na mapě 46×34 znamená, že hrdina vidí
  zhruba třetinu šířky; po sehrání se čísla možná posunou.

---

**Souvisí:** [`REPORT_2026-11-02_PRIVNI_SVET_SKOLY.md`](REPORT_2026-11-02_PRIVNI_SVET_SKOLY.md) ·
[`REPORT_2026-11-02_FIRST_WORLD_ONLINE.md`](REPORT_2026-11-02_FIRST_WORLD_ONLINE.md) ·
`apps/nirvana/AGENTS.md` § PRVNÍ SVĚT — mlha války
