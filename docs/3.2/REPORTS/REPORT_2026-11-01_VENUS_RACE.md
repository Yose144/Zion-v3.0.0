# REPORT 2026-11-01 — VENUŠE (okruh) + zvuk arény + VR pohyb

> **Stav:** hotové, ověřené lokálně; nasazeno na EDGE.
> **Route:** `/venus` (veřejná). Vstup z pouti: „Venuše · okruh na hovercraftu →".

## 1. Venuše — time trial

Tři kola na hovercraftu po okruhu, který se celý počítá z pár čísel:

```
r(θ) = 86 + sin(3θ) · 22      šířka pásu 11 m, 320 vzorků, 6 checkpointů
```

`core/race/track.ts` z toho odvodí geometrii pásu, tečny, normály, checkpointy
a skóre (`laps / seconds × 100 000`, takže vyšší = rychlejší).

**Fyzika je arkádová, ne simulace:** plyn/brzda (22 m/s²), odpor, zatáčení
úměrné rychlosti, max 34 m/s (122 km/h). Trať drží: při nárazu do okraje tě to
jednou zpomalí (18 %) a pak po něm kloužeš — žádné trvalé brzdění a žádné pády
do prázdna.

**Co jsem při stavbě chytil:** první verze měla „pružinový" návrat na trať a
auto zamrzlo ve zdi (klampovalo se i podélně, takže se každý frame vracelo na
stejné místo). Oprava: zachovat podélný postup (`along`) a opravit jen stranu.

**HUD:** rychlost, kolo, čas, nejlepší kolo, varování „mimo trať".

## 2. Zvuk arény — syntéza, ne soubory

`core/arena/audio.ts`: rail (sykot + klesající tón), raketa, exploze (šum
s nízkým filtrem), zásah, frag, zranění, pickup, smrt, konec zápasu. Všechno
z oscilátorů a šumového bufferu — **v repu není ani jeden zvukový soubor**.
AudioContext se otevírá až po gestu (klik do plátna / start zápasu), protože
prohlížeče jinak přehrávání blokují.

## 3. VR pohyb v aréně

`XROrigin` nese tělo hráče, takže se kamera (hlava) hýbe s ním:

- **levý thumbstick** = pohyb (`xr-standard-thumbstick`), mrtvá zóna 0,18
- **„vpřed" je tam, kam se dívá hlava** — směr se bere z kamery, ne z myši
- **kolize zůstávají** — pohyb jde přes stejnou AABB fyziku jako na desktopu
- pravý ovladač míří, spoušť střílí (z předchozí dávky)

Pořád platí: **na headsetu neověřeno.** Kód je psaný proti API `@react-three/xr`
6.6.32, ale bez zařízení to nemůžu označit za otestované.

## 4. Ověřeno (headless)

| Test | Výsledek |
|---|---|
| Venuše start + plyn | auto zrychlí (0 → 14,5 m/s za 1,2 s) |
| Okraj tratě | náraz zpomalí, auto klouže po okraji místo aby se zaseklo (13–16 m/s) |
| Checkpointy / kola | logika v pořadí, kolo se počítá po 6. checkpointu |
| HUD | rychlost, kolo, čas, „mimo trať" se mění live |
| Zvuk | WebAudio kontext se otevře, výstřely nevyhodí chybu |
| Konzole | jen pre-existing `401` |

Debug háček `?raceDebug=1` vrací `{x,z,sample,lateral,heading,speed,offTrack}`.

## 5. Meze (poctivě)

- **Žádní soupeři.** Venuše je time trial, ne závod s boty.
- **Žádné modely ani zvuk motoru.** Hovercraft je pět krabic a koule.
- **VR v závodě není** — kamera je chase cam, v headsetu by to bylo nepříjemné.
- **Skóre je odvozené z času**, ne z pořadí — tabule je „kdo byl nejrychlejší".

## 6. Změnový log

| Datum | Změna |
|---|---|
| 2026-11-01 | Venuše (trať, fyzika, HUD, tabule), zvuk arény, VR pohyb |
