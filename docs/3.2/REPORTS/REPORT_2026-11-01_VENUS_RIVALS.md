# REPORT 2026-11-01 — VENUŠE: tři soupeři

> **Stav:** hotové, ověřené headless (celý závod 3 kola + restart + mobil 390×844).
> **Build:** zelený (`tsc --noEmit`, `next build`), **nenasazeno** — deploy čeká na 👤.
> **Kde:** `apps/nirvana/src/core/race/`, `apps/nirvana/src/app/venus/page.tsx`,
> `apps/nirvana/src/app/globals.css`.
> **Navazuje na:** `REPORT_2026-11-01_VENUS_RACE.md` (samotný okruh) a
> `nedele1.md` §5 bod 3 („Soupeři na Venuši").

## 1. Co to je

Venuše byla time trial — jezdil jsi sám proti času. Teď na stejné trati jedou
**tři soupeři** a závod se počítá na pořadí: Jitřenka (nejrychlejší), Fosfor,
Vega. Pódium (1.–3.) dává navíc žetony `+3 / +2 / +1`; skóre na tabuli zůstává
**časové** (`laps / seconds × 100 000`), aby byly staré záznamy srovnatelné.

## 2. Jak je to postavené

| Věc | Soubor |
|---|---|
| fyzika hovercraftu — **jeden model pro hráče i boty** | `core/race/physics.ts` |
| boti: spec, AI, počítání kol, postup, pořadí | `core/race/rivals.ts` |
| scéna: tři boti, startovní čára, HUD callbacky | `core/race/VenusRace.tsx` |
| stránka: deska pořadí, verdikt, výsledková tabulka | `app/venus/page.tsx` |

**Fyzika se nevytvářela dvakrát.** `stepCraft()` je jediná implementace
(zrychlení, odpor, zatáčení podle rychlosti, okraj tratě jako zeď). Hráč do ní
posílá klávesy, bot do ní posílá `{throttle, steer}` ze svého rozhodování.
Kdyby měli boti vlastní integrátor, rozdíl by dělala pravidla, ne um.

**Rozhodování bota** je feed-forward na směr tratě + korekce stranové odchylky:

```
headingError = wrapAngle(směr tratě(index + ~1 s) − heading)
steer        = kH · headingError − kL · (cílová_stopa − lateral)
throttle     = clamp((vCap − rychlost) · 1.6, −1, 1)
```

`skill` (0–1) mění jen tři čísla: ostrost sledování stopy (`kH`, `kL`), míru
řezání zatáčky (`targetLateral`) a strop rychlosti (`vCap`). **Žádný
rubber-banding** — kdyby bot doháněl, přestane být čas na tabuli porovnatelný
s lidským.

## 3. Chyby, které jsem při stavbě chytil (a jak)

1. **Tětiva místo tečny.** První AI mířila na bod na trati ~1 s dopředu.
   Na okruhu je to tětiva, takže bot zatáčel víc než trať, řízení saturovalo,
   skončil ve zdi a plazil se 2–4 m/s (první běh v prohlížeči: tři kola za
   **196 s** a ani jedno nedojel). Fix = feed-forward na směr tratě.
2. **Křivost počítaná z úhlu, ne z délky.** První pokus o brzdění měl
   `caution = (Δúhel − 0,08) · k`; `Δúhel` přes 27 m vyšel skoro vždy velký,
   takže boti jeli s plynem na 0,25 a „brzdili“ i na rovině. Fix = κ = Δyaw / Δs
   a cílová rychlost `v = úhlová_rychlost / κ`.
3. **Skóre pořadí bylo schodovité.** První metrika byla „checkpointy +
   zlomek cesty k dalšímu“. Mezi branami (53 vzorků) je zlomek nulový, takže
   všichni za vedoucím hlásili `+0,3 m` — HUD lhal. Fix = sčítat **přírůstek
   indexu** (`LapState.travelled`) s oříznutím na kratší cestu kolem dokola;
   funguje i pro rošt za startovní čárou (záporný začátek).
4. **Čas nešel srovnávat mezi stroji.** Fyzika má `dt = min(0,05, delta)`, aby
   na pomalém stroji neskákalo auto okny — ale čas se měřil `performance.now()`,
   takže na 15 fps se kolo nafouklo o čtvrtinu (naměřeno 2:00 místo 1:32).
   Fix = **simulované hodiny** (`clock += dt`), ze kterých se počítá čas kola,
   celkový čas i „doba od prvního plynu“. Výsledky jsou teď na fps nezávislé.
5. **Znaménko řízení.** `lateral > 0` znamená, že auto je na straně normály;
   `A` (kladný steer) odchylku **zmenšuje**. Ověřeno simulací (dva přepisy,
   106 s vs 169 s a 100 % mimo trať), aby se to nehádalo v prohlížeči.

## 4. Ověření (headless, Playwright)

| Co | Výsledek |
|---|---|
| Celý závod 3 kola s klávesnicí | dojeto, verdikt „Vyhrál jsi. Všichni tři za tebou.“, 1:32,79, skóre 3233 |
| Deska pořadí | 4 řádky, průběžně se přeskupuje, mezery v metrech (`+13,4 m`) |
| Kola a checkpointy botů | počítají se stejným `advanceLap` jako u hráče |
| „Znovu“ | hráč na vzorku 0, boti 315/310/310, lap 1, rychlost 0, deska 4 řádky |
| Mobil 390×844 | panel 358 px (bez vodorovného přesahu), deska 99×99 vpravo nahoře, HUD 2 řádky, žádný překryv |
| Konzole | jen pre-existing `401` z `/api/auth/me` |

**Fyzikální stropy** (simulace bez prohlížeče, `dt = 1/60`): trať 613,7 m,
vzorek 1,92 m, terminální rychlost 20,2 m/s → ideální kolo ~30 s. Boti:
Jitřenka **102,9 s**, Fosfor **107,5 s**, Vega **113,2 s** za tři kola;
„ideální jezdec“ (stejná AI na skill 1,0) 92,6 s. Čistá jízda vyhraje, slušná
jízda je druhá, laxní čtvrtá.

## 5. Co tu záměrně není

- **Kolize auto–auto.** Závodníci se projíždějí. Řešení by chtělo odezvu
  hmotností a je to samostatná věc, ne večerní úprava.
- **Zvuk motoru** — `core/arena/audio.ts` je na to připravený (syntéza),
  ale motor na Venuši ještě nemá hlas.
- **Multiplayer** — pořád lokální; serverová autorita je jiný projekt.
- **VR v závodě** — boti jsou obyčejné meshe, takže by je VR viděl, ale
  headset nemám, tak to netvrdím jako hotové.
