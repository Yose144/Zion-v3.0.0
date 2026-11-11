# Merkur — ragdoll souboj a čtyři módy (2026-11-10)

## Zadání

> „Bojovku uděláme jako Ragdoll Masters! Takže kompletní přidání různých módů
> pro hru na Merkuru."

Merkur (`/mercury`) byl do téhle dávky klasický 2D fighting: pevné pozice,
pěst/kop s pevným dosahem, HP a best-of-3. Cílem bylo nahradit ho **fyzikální
loutkou** (Ragdoll Masters) a přidat módy, které z jedné arény udělají víc her.

## Co je hotové

### 1. Sdílený ragdoll engine — `apps/nirvana/src/core/fight/ragdoll.ts`

- Loutka je 11 bodů (hlava, hrudník, pánev, 2× loket/ruka, 2× koleno/chodidlo)
  spojených 10 distance constraints (PBD, 5 iterací na substep).
- Simulace běží v substeps (max 4× na krok), takže se chování nemění podle fps.
- Posturální stabilizace drží loutku na nohou; vypíná se při KO, stunu a
  knockbacku, takže zásah je vidět jako skutečné zavrávorání.
- Vstup: `A/D` tlačí tělo, `W` skok, `J` švih rukou, `K` kop, `S` kryt.
  Držený útok se opakuje v ochlazení (stejné chování jako starý duel).
- Poškození nevzniká z „držení tlačítka", ale z **rychlosti končetiny při
  kontaktu** (`hitDamage`); kryt násobí poškození 0,35.
- Nárazová rychlost se počítá **před** posturální opravou (`ivx`/`ivy`) —
  jinak by zvednutí loutky vyrobilo falešný zásah 20 m/s.

### 2. Čtyři módy

| Mód | Pravidla | Sólo | Online |
|---|---|---|---|
| `duel` | 1v1, best of 3, 60 s/kolo, HP | ✅ | ✅ |
| `ball` | ragdoll fotbal, 90 s, branky, výkop pro inkasujícího | ✅ | — |
| `survival` | nekonečné vlny, HP přežívá, soupeř sílí | ✅ | — |
| `practice` | nemrtvá figurína, HP se regeneruje, měří nejtvrdší zásah | ✅ | — |

- **Fotbal:** míč je samostatné těleso s gravitací, odrazem a přenosem
  hybnosti z končetin. Branky jsou na koncích klece; po gólu se míč vrací
  na stranu inkasujícího (výkop), aby jeden bot nevyhrával pořád.
- **Přežití:** po každé vlně +22 HP hráče, soupeř má víc HP a od 5. vlny
  obtížnost `champion` (i když hráč zvolil `gentle`).
- **Trénink:** figurína neútočí, HP se regeneruje, po „KO" se hned postaví.

### 3. Vykreslení

- `RagdollBody.tsx` kreslí segmenty z `RENDER_SEGMENTS` (válce mezi body),
  hlavu/klouby jako koule, kryt jako prstenec, zásah jako záblesk a kontaktní
  stín pod loutkou. Žádná druhá animace — čte se přímo póza.
- `DuelStage.tsx` dostal branky (`goals`), širší kameru pro fotbal (`wide`),
  prodlouženou podlahu (aby v záběru nebyl okraj) a slunce bez mlhy.

### 4. Online duel (protokol 33)

- Server (`apps/nirvana-net/src/fight.ts`) pouští **týž** `ragdoll.ts`.
- `FightPlayerState` nese `pose` = 22 čísel (11 bodů); klient pózy interpoluje
  (`SNAP_DISTANCE = 3`), nepredikuje — ragdoll je chaotický a predikce by
  poskakovala.
- `PROTO_VERSION` 32 → **33**; deploy **net první, pak appka**.

### 5. Testy

- `npx tsx apps/nirvana/test/ragdoll.mjs` — 35 kontrol: postoj, pohyb, skok,
  zásah, kryt, KO, čas, přežití, fotbal, trénink, póza, bot.
- `apps/nirvana-net/test/fight.mjs` — simulace i síť (póza v snapshotu,
  pohyb, zásah, meta-bot, úklid). PASSED.
- `apps/nirvana-net/test/{smoke,rooms,spectate,humans}.mjs` — regresní PASSED.
- `next build` v `apps/nirvana` EXIT 0.
- Headless probe `/mercury`: panel, 4 módy, výběr fotbalu, HUD, skóre, canvas,
  Menu, 0 JS chyb.

## Meze / co tu není

- **Online je jen duel.** Fotbal/přežití/trénink jsou sólo; síť by pro ně
  potřebovala vlastní snapshot (míč, vlny) a nebylo to součástí zadání.
- **VR** je beze změny (syntetické klávesy), netestováno na headsetu.
- **Bot v ragdoll fotbale** je jednoduchý (stůj za míčem, kopej, skákej přes
  míč, když je na špatné straně). Není to týmová AI.
- **Vizuál** je z primitiv (žádné GLB), stejně jako zbytek Nirvany.

## Nasazení

1. `bash apps/nirvana-net/deploy/deploy-nirvana-net.sh` (proto 33).
2. `bash apps/nirvana/deploy/deploy-nirvana.sh`.
3. Po deployi zkontrolovat `curl https://nirvana.zionterranova.com/net/health`
   → `proto: 33`.

## Soubory

- nové: `core/fight/ragdoll.ts`, `core/fight/RagdollBody.tsx`,
  `test/ragdoll.mjs`
- přepsané: `core/fight/DuelStage.tsx`, `MercurySolo.tsx`, `MercuryDuel.tsx`,
  `core/fight/audio.ts`, `app/mercury/page.tsx`, `app/mercury/copy.ts`,
  `apps/nirvana-net/src/fight.ts`, `apps/nirvana-net/test/fight.mjs`,
  `core/net/protocol.ts` (proto 33)
- smazané: `core/fight/duel.ts`, `core/fight/Fighter3D.tsx` (nahrazeno
  ragdollem)

---

# Pro vrstva (2026-11-10, druhá dávka)

Zadání: „rozšiřuj kód na profi." Cílem bylo dostat Merkur z funkčního základu
na úroveň, která má hloubku, čitelné HUD a dramaturgii.

## 1. Kombo

- `COMBO_WINDOW` = 2,6 s; `comboMultiplier(combo)` = 1 + min(0,5; combo × 0,1).
- Série se počítá po zásahu, inkasovaný úder ji vynuluje. HUD ukazuje `×N`
  od 2; od 3 se nad loutkou objeví plovoucí text.
- Ochrana proti „drženému tlačítku": stále platí `strikeCooldown`, takže
  kombo nejde nafouknout držením J/K.

## 2. Výdrž krytu a zlomení

- `GUARD_DRAIN` 0,3/s, `GUARD_REGEN` 0,28/s, `GUARD_HIT_COST` 0,12.
- Při nule `breakGuard`: stun 0,85 s, kryt se odemkne až po dobití na 0,4.
- **Chyba, kterou odhalil test:** `wantsGuard` měl podmínku
  `guardMeter > 0.02`, takže se výdrž zastavila na ~0,022 a nikdy se
  nezlomila. Práh je pryč; láme se až na nule.
- HUD: tenká cyan lišta pod HP; při zlomu červená.

## 3. Král kopce (`koth`)

- Zóna `|x| ≤ HILL_HALF` (2,6 m); drží ji jen ten, kdo tam stojí sám.
- Cíl 12 s, zápas 99 s. KO dá vítězi +2,5 s a poražený se po 2,5 s vrátí.
- Bot: mimo zónu jde k ní, uvnitř brání střed a útočí na vetřelce.
- Scéna kreslí světelnou zónu + prstenec; HUD má zelený pruh držení.

## 4. Dramaturgie a čísla zásahů

- `DuelFxOverlay` (2D canvas nad plátnem): čísla poškození, jiskry, `K.O.`,
  `GUARD BREAK`, `×N` kombo.
- Sólo bere přesné `hit` eventy; online odvozuje čísla z poklesu HP mezi
  snapshoty (stejný trik jako MOBA) — beze změny přenosu zásahů.
- Sólo po KO zpomalí na 0,34× na 0,85 s. Online ne (server je autorita).

## 5. Protokol 34

`FightPlayerState` nově nese `guard` (0..1) a `combo`. Starý klient by
neviděl výdrž ani sérii. Deploy **net první, pak appka**.

## 6. Ověření

- `npx tsx apps/nirvana/test/ragdoll.mjs` — **PASSED** (postoj, pohyb, skok,
  zásah, kryt, kombo, zlom krytu, koth včetně KO bonusu/respawnu, fotbal,
  trénink, póza, bot).
- `apps/nirvana-net/test/fight.mjs` — **PASSED** (simulace + síť, snapshot
  nese `pose`, `guard`, `combo`).
- `smoke`, `rooms`, `spectate`, `humans` — **PASSED** (proto 34).
- Mercury-specific `tsc` — **0 chyb**.
- Dev probe `/mercury`: 5 módů, výběr kothu, dvě výdrže krytu, dva pruhy
  kopce, HUD `Kopec 95s · 0.0 : 3.9`, **0 JS chyb**. Screenshot:
  `.artifacts/render/mercury-ragdoll/koth.png`.
- **Plný `next build` je blokovaný prací paralelní session** (`piko/page.tsx`
  je rozpracovaný a typecheck tam padá); kompilace samotná proběhla
  (`Compiled successfully`), chyby jsou výhradně v piku, ne v Merkuru.

---

# Tuning (2026-11-11)

Ladění proběhlo podle měření, ne podle pocitu. Nový harness
`apps/nirvana/test/ragdoll-balance.mjs` odehraje N zápasů bot vs bot
v každém módu a vypíše délku, timeouty, zásahy, KO, komba, zlomy krytu,
góly, vlny a držení kopce.

## Před / po (96 zápasů na mód, bot `standard`)

| Mód | Před | Po |
|---|---|---|
| duel | 25,3 s · 41,6 zásahů · 2,5 KO · 8:16 (48 runů) | **43,9 s · 100,2 zásahů · 2,7 KO · 50:46** |
| survival | 15,2 s · vlna 2,2 | **30,7 s · vlna 3,2** |
| ball | 135 s · 15:15 gólů (30 gólů!) | **110 s · 6,8:5,4 gólů, 62:23/11 remíz** |
| koth | 24,9 s · 59 zásahů · 4,0 KO · 50:46 | **35,6 s · 94,3 zásahů · 3,2 KO · 47:49** |

## Co se změnilo a proč

- **`MAX_HP` 100 → 160.** Runda byla 10 s; teď je ~17 s a zápas best-of-3 ~43 s.
- **`HIT_DAMAGE` 3,2 → 2,0, `HIT_MAX` 28 → 20, strop nárazové rychlosti 20 m/s.**
  Zásah už nedává 28 z 100; silný kop bere ~10–20 z 160.
- **Kombo:** strop +40 % (bylo +50 %), krok 0,08, okno 2,6 s.
- **Tempa úderů:** pěst 0,36 s, kop 0,54 s, hit cooldown 0,26 s. Snížilo
  počet zásahů na ~2,3/s, ale udrželo flurry pocit.
- **Kryt:** drain 0,34/s, regen 0,24/s, zásah bere 0,1. Držený blok se zlomí za ~2,9 s;
  boti kryjí krátce, proto je zlomů v botí sehrávce málo (0,01–0,02) —
  lidský hráč, který drží S, ho uvidí. Test zlom pokrývá deterministicky.
- **Současné zásahy:** `resolveCombat` nejdřív najde oba kandidáty a teprve
  pak je aplikuje. Dřív A vždy zasáhla první a při výměně K.O.-la B dřív,
  než B stihl zasáhnout — systematická výhoda A. Po opravě je koth 46:50
  (bylo 59:37) a duel 50:46.
- **Fotbal:** hřiště `BALL_HALF = 13` (26 m), branka 2,1 m, pomalejší míč,
  **výkop na středu + střelec zmrazený 1,6 s**. Dřív se míč dával na
  polovinu inkasujícího, který pak musel přes celé hřiště a střelec
  bránící vlastní branku vyhrával souboj (9:4 pořád dokola).
- **Nejsilnější kontakt místo pořadí:** impuls míče se bere z nejsilnější
  srážky v kroku, ne z poslední v cyklu. Pořadí už nerozhoduje.
- **Jitter ball bota:** malý deterministický rozptyl podle seedu rozbije
  zrcadlově totožné boty; ball přestal být 9:4 attractor a je 6,8:5,4.
- **Survival:** base 55 HP, +20 HP za vlnu, heal +26. Bot se dostane na
  vlnu 3,2 (bylo 2,2); člověk míří výš.

## Pozdější polish

- `stepFighter` používá sdílené `PREV_X`/`PREV_Y` buffery místo alokace
  dvou polí na každý substep (60 fps × 4 × 2 loutky = 480 polí/s).
- `DuelFx` nekreslí čísla za 1 HP — škrábnutí by jen zaplnilo obraz.
- Bot při HP < 35 % kryje častěji a déle; zlom krytu je v sehrávce vidět
  (0,06–0,13 na zápas), aniž by se změnila doba duelů (42,8 s, 24:24).

## Protokol 35

Tuning mění **význam** HP (MAX_HP 160) a poškození, i když formát zpráv
zůstává. `PROTO_VERSION` proto 34 → **35**; deploy **net první, pak appka**.
Bez bumpu by starý server posílal HP ze 100 a klient by kreslil bary
přes 160 — tichý rozpor, který `proto_check` nechytí.

## Ověření

- `npx tsx apps/nirvana/test/ragdoll.mjs` — **47 kontrol, PASSED**.
- `apps/nirvana-net/test/fight.mjs` — **31 kontrol, PASSED** (cílený build
  `tsconfig.fight.json`, protože plný `tsc` v `nirvana-net` blokuje
  paralelní session v `src/arena.ts` — `shard` pickup typ).
- `apps/nirvana` → `npx tsc --noEmit` **0 chyb**, `next build` **EXIT 0**.
- Harness: `npx tsx apps/nirvana/test/ragdoll-balance.mjs 96`.
