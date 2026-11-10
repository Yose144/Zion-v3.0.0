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
