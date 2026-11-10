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
