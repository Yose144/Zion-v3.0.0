# REPORT 2026-11-02 — PRVNÍ SVĚT: ŠKOLY KOUZEL A OCHRANA STRUKTUR

> **Co to je:** první krok rozšiřování MOBA `/earth`. Dvě věci, které z „každý
> hrdina je stejný" dělají hru: **11 škol kouzel s vlastní mechanikou**
> a **ochrana věží a Nexy**.
>
> **Výchozí stav:** 3 linky, 2 věže na linku, 2 Nexy (4000 HP), 3 uzly L5,
> 8 jungle táborů, levely 1–15, 3 itemy, Q/W/E/R z kánonu, 2v2/3v3.
> Ale: všech 11 škol se chovalo **stejně** (dmg + shield + heal + slow)
> a Nexu nechránilo nic — dalo se obejít mapa a položit ji za 40 s.

**Deployed:** net `20261102T130227Z` · app `20261102T130304Z` · commit `36896c1e8`
(+ testy `a278711c3`). Protokol **zůstává 6** — mění se chování sim, ne formát.

---

## 1. Školy kouzel: mechanika, ne jen číslo

Zdroj je jediná tabulka `SCHOOL_TRAITS` v `core/moba/spells.ts`. Sim ji čte
v `applyOnHit` — žádná druhá větev v jednotlivých kouzlech.

| Škola | Co dělá navíc |
|---|---|
| **ward** | W kryje štítem i nejbližšího spojence do 8 m (60 % síly) |
| **fire** | zásah pálí další 3 s (DoT = 40 % poškození) |
| **arrow** | projektil prolétne skrz cíl a letí dál |
| **blade** | doráží cíle pod 35 % HP (+45 %) |
| **cosmic** | W vrací 25 % many |
| **mind** | zásah strhne 70 % nepřátelského štítu |
| **nature** | léčení běží 4 s (nedá se tím utéct z boje) |
| **storm** | 50 % poškození přeteče na druhý cíl do 6 m |
| **song** | léčí postupně **a** část štítu dá spojenci |
| **shadow** | popravuje cíle pod 40 % HP (+60 %) |
| **beast** | skok má 1,7× širší dopad |

**Implementačně:** hoření a regenerace jsou nové typy `Buff`
(`'burn'`/`'regen'`), takže sim je počítá každý snímek a `Buff.source` nese
id sesilatele (zabití se připočte správnému hrdinovi). Klient buffy nečte,
takže se formát snapshotu nemění — jen přibyly hodnoty v už existujícím unionu.

**HUD** dostal `SCHOOL_LABEL` — hráč nemá číst zdroják, aby zjistil, že jeho
oheň pálí a ward kryje spojence.

## 2. Ochrana struktur

Pravidlo je **jedna funkce** `isStructureProtected()` v `core/moba/map.ts`
a používají ji sim, 3D scéna i minimapa:

```
vnější věž  ──kryje──▶  vnitřní věž  ──kryje──▶  Nexa
```

Nexa je nedobytná, dokud nepadne **celá jedna lajna** (vnější + vnitřní věž).
Kdyby pravidlo existovalo dvakrát, hráč by mlátil do věže, která je podle
klienta zničitelná a podle serveru ne — přesně ta třída chyby „trefil jsem ho
a nic".

**Vizuálně:** nedobytné struktury svítí šedě (`#64748b`) ve 3D i na minimapě.

## 3. Co se ověřilo

| Test | Výsledek |
|---|---|
| `npx tsx apps/nirvana/test/moba-sim.mjs` | **47/47** (bylo 32; +15 nových) |
| `npx tsx apps/nirvana-net/test/moba.mjs` | **15/15** (bylo 12 + 3 padající) |
| `npm run smoke` / `arena` / `fight` (net) | OK |
| `node apps/nirvana/e2e/first-world.mjs` proti **produkci** | **11/11** (byly 4 chyby) |
| `npx tsc --noEmit` (nirvana) | 0 chyb |
| Živě | `/earth` 200 · `/api/health` 200 · `/net/health` proto 6 |

Nové kontroly v sim testu: školy se liší (11/6 druhů), oheň hoří po zásahu,
šíp projde skrz dva cíle, bouře řetězí na druhý cíl, stín udělí zraněnému víc,
ward dá štít spojenci, příroda nasadí regeneraci, vnější věž kryje vnitřní,
Nexa je nedobytná dokud stojí lajna, po prolomení lajny padne.

## 4. Co bylo rozbité už předtím (a opravilo se)

1. **`test/moba-sim.mjs` padal na 3 kontrolách** ještě před touhle změnou:
   hrdina v testu věže umřel a testy 7–8 s ním hýbaly jako s živým. Ověřeno
   `git stash` — stejné 3 chyby na původním kódu. Řešení: `revive(hero)`.
2. **`nirvana-net/test/moba.mjs` byl napsaný na 3v3**, ale server je od
   commitu `f9d971f94` **5v5** (`MOBA_ROOM_SIZE = 10`, `TEAM_SIZE = 5`).
   Test teď čte `room.maxPlayers` — přežije další změnu velikosti týmu.
   ⚠️ **Dokumentace zaostává:** `AGENTS.md` i report z 2. 11. mluví o 3v3.
3. **E2E měl tři chyby nezávislé na pravidlech:** kouzlo se sesílalo na soupeře
   60 m daleko (Q má dostřel 12), `damageNexus(3400)` nechá Nexe 600 HP
   z 4000, a pevné `sleep` místo čekání na podmínku. Test byl zelený jen na
   Macu — na swiftshaderu je simulace pomalejší než skutečné hodiny.
4. **E2E měly hardcoded cestu k Playwrightu a Chromiu** (`/Users/yeshuae/…`),
   takže jinde spadly na `MODULE_NOT_FOUND`. Nový `e2e/_browser.mjs` to řeší
   na jednom místě (Playwright → Puppeteer → systémový Chrome).

## 5. Co je dál (odsouhlasené pořadí)

1. ✅ **Bojová identita** — školy + ochrana věží *(tento report)*
2. ⏭ **Mlha války** — samostatný krok: mění snapshot → **protokol 7**
   a deploy **net první**. Bez ní nemá jungling ani gank smysl.
3. **Ekonomika** — víc itemů, recepty, sloty
4. **Mapa** — silnější Prastaré stvoření, bushe, řeka
5. **Meta** — obtížnosti botů, statistiky, leaderboard

## 6. Meze

- **Ochranu věží v prohlížeči nevidí test** — `damageNexus` v debug háčku
  sahá přímo na HP, takže obchází pravidla. Pravidlo hlídá sim test; klient
  jen barví. Kdo chce E2E i na pravidlo, musí přidat `damageTower(id, amount)`.
- **Školy jsou vyvážené od oka**, ne měřením. Čísla (`burn 0.4`, `chain 0.5`,
  `execute +60 %`) jsou první odhad; po sehrání bude potřeba je doladit.
- **5v5 vs 3v3** v dokumentaci je neuklizený stav, ne rozhodnutí — srovnat
  v `AGENTS.md` při dalším kroku.

---

**Souvisí:** [`REPORT_2026-11-02_FIRST_WORLD_ONLINE.md`](REPORT_2026-11-02_FIRST_WORLD_ONLINE.md) ·
[`REPORT_2026-11-02_APPS_WORKFLOW.md`](REPORT_2026-11-02_APPS_WORKFLOW.md) ·
`apps/nirvana/AGENTS.md` § PRVNÍ SVĚT
