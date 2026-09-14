# 18 — AI prompty pro klíčové obrazy K01–K12

> **DRAFT — pracovní prompt list.** Prompty jsou v angličtině (modely jí lépe rozumí). Použitelné pro Midjourney (`--niji`), Flux/SDXL i jako referenční vstup pro image→video (Kling, LTX, Runway).
>
> **Pravidlo stylu:** žádné „Ghibli style" v promptu — inspirovat se, ne kopírovat. Styl popisujeme přímo: *hand-painted animation background, painterly 2D, watercolor texture, soft volumetric light*.

## Jak používat

1. **Nejdřív styl:** vygenerovat 2–3 testovací obrazy (K01, K06) a doladit `STYLE` blok.
2. **Zamknout Lumi:** jakmile sedí, používat **stejný** `LUMI` blok všude + referenční obrázek (Midjourney `--cref` / `--sref`, Flux LoRA).
3. **Statické obrazy první:** K01–K12 jako stills → animatik → teprve potom image→video na vybrané záběry.
4. **16:9:** všechny obrazy `--ar 16:9`.

## Sdílené token bloky (vložit do každého promptu)

```
STYLE:
hand-painted 2D animation still, painterly watercolor backgrounds, soft
volumetric lighting, warm muted palette, cinematic composition, film grain,
no text, no watermark
```

```
LUMI (malá Elizabet — avatar OASIS, růžový paprsek / Pink Ray):
a little girl around 6 years old, young priestess of the gate, gentle
determined face, soft blonde wispy hair, simple layered travel clothes
in warm ochre and cream with a soft rose-pink sash and small rose
pendant, carrying a wooden-and-copper lantern glowing warm rose-amber,
barefoot, curious and kind
```

```
LANTERN:
a small handheld lantern of dark wood and aged copper, warm amber glow
inside, hand-crafted, slightly worn
```

```
NEGATIVE (kam model podporuje):
photorealistic, 3d render, plastic skin, extra fingers, text, logo,
watermark, ghibli
```

## K01 — Lucerna u brány (obraz 01)

```
STYLE + LUMI
Scene: ancient stone gate overgrown with living roots and moss at night,
warm lantern glow as the only light source, small girl holding lantern,
inside the lantern flame a faint unfinished pencil line glowing instead of
a flame, travelers passing as soft silhouettes, wet stone, fireflies of
spores in air, quiet wonder
Mood: mystery, safety, threshold
Camera: wide shot, low angle, lantern centered
```

## K02 — Péče o vodu v lese (obraz 02)

```
STYLE + LUMI
Scene: deep forest, tall old trees with shafts of morning light, the girl
kneels at a small dry side stream, her hands freeing a fallen branch that
dammed leaves, first water beginning to flow again over wet dark soil,
tiny translucent droplet spirit clinging to her sleeve, intimate close
moment
Mood: care before haste
Camera: medium close-up, ground level
```

## K03 — Výhled do L5 (obraz 02)

```
STYLE
Scene: forest opens into a wide sunlit future valley — people working
together, a child carrying a wooden bowl of water, a repaired timber
bridge, communal kitchen with steam, terraced gardens, hand-made tools,
no technology on display, lived-in warmth
Mood: an ordinary good world
Camera: wide vista, slow, girl small at frame edge with lantern
```

## K04 — Dům jmen (obraz 03)

```
STYLE + LUMI
Scene: interior of a vast paper-and-ink archive house, corridors of
handwritten scrolls, small glowing paper tags floating like fireflies,
rain visible through paper windows, the girl stands small among floating
labels, one tag near her pulses with the same pencil line as her lantern
Mood: hushed library, echoes of names
Camera: medium shot, soft depth, floating tags in foreground
```

## K05 — Větrná zahrada (obraz 04)

```
STYLE + LUMI
Scene: a garden of light terraces floating among clouds, white canvas
sails, copper fittings with green patina, thin channels of water running
between beds, the girl and an old kindly maintenance mechanism together
restore a small water channel, seedlings, repairs visible everywhere
Mood: lightness, awe in service
Camera: medium shot, sea of clouds below, warm sun
```

## K06 — Keporkak (obraz 05)

```
STYLE + LUMI
Scene: dark Atlantic water before a storm, silver surface, the girl at
the rocky shore lowers her lantern toward the sea — beneath the surface
an enormous slow ancient whale-like creature rises to meet her, one calm
eye level with hers, contact not spectacle
Mood: depth, reverence, vulnerability
Camera: wide shot, half above / half below waterline if possible
```

## K07 — Strom nad Zemí (obraz 06)

```
STYLE
Scene: close on hands tending a small plant in wet soil — behind it a
large curved window reveals planet Earth, lived-in orbital home garden,
someone naps in a hammock, a child draws with a pencil, maintained
machines softly humming in walls, warm domestic light inside, blue planet
outside
Mood: vastness and closeness at once
Camera: slow pull-back from hands to reveal the window
```

## K08 — Slib v hlubině času (obraz 07)

```
STYLE
Scene: two ancient wanderer figures made of faint stardust standing in a
night forest clearing, deep indigo sky with dense stars, soft breath of
light between them, they make a quiet promise, no faces in detail —
gesture and glow only
Mood: intimacy, eternity, return home
Camera: wide, still, figures small against stars
```

## K09 — Rok 2008, kresba (obraz 08)

```
STYLE
Scene: an ordinary table by a window in daylight, a woman's hand drawing
with a pencil on real paper — the drawing glows with the same line seen
in the lantern and gate, a man leans in beside her watching, two people
creating something together without knowing where it leads
Mood: intimacy, origin, tenderness
Camera: close-up on hand and paper, shallow depth
```

## K10 — Kresba + lucerna (obraz 08, detail)

```
STYLE + LANTERN
Scene: macro detail — the finished pencil drawing on paper, beside it the
lantern with the identical line glowing in its light, the drawing is the
source of every line in the film, fibers of paper visible
Mood: recognition
Camera: macro still life
```

## K11 — La Palma, nedopsaná stránka (obraz 09)

```
STYLE
Scene: a quiet real room on a volcanic island, wind moving a curtain, sea
light through a window, on a wooden table a small hand-bound book lies
open — its last page blank, the lantern rests beside it casting warm
light on the empty page, nobody is writing yet
Mood: presence, open space for life
Camera: still, intimate, the blank page centered
```

## K12 — Brána zůstává otevřená (obraz 10)

```
STYLE + LUMI
Scene: the same root-covered stone gate as the opening scene but in warm
daylight, the girl helps a newcomer step over the threshold, gate stands
open, ordinary life continuing around, an open book rests near the gate,
lantern glow soft
Mood: home is what we care for together
Camera: wide shot mirroring K01, daylight
```

## Parametry podle nástroje

| Nástroj | Parametry | Poznámka |
|---|---|---|
| **Midjourney** | `--ar 16:9 --niji 6 --style raw --s 200` + `--sref <url K01>` po zamčení stylu | `--cref` pro Lumi po schválení modelu |
| **Flux / SDXL (ComfyUI)** | styl přes LoRA nebo consistent prompt prefix; CFG ~3.5–4 | lokální, soukromé |
| **LTX Studio** | import K-obrazů jako storyboard → „Elements" pro Lumi | video až po zamknutí stills |
| **Kling i2v** | z každého K-obrazu 5–10s pohyb; prompt pro pohyb zvlášť | pro hero záběry |

## Motion prompty (pro image→video, až po schválení stills)

- **K01:** `slow push-in, lantern light flickers gently, spores drift, camera holds on the glowing line`
- **K02:** `water begins to trickle, leaves shift, droplet spirit trembles on her sleeve`
- **K06:** `whale rises slowly, water ripples, eye meets camera, then it descends`
- **K07:** `slow dolly out from hands to the window, Earth drifts, interior life continues`
- **K08:** `stardust drifts between the two figures, stars wheel slowly, near-static`
- **K11:** `curtain moves in wind, light shifts on blank page, nothing else moves`

## Poznámky

- **LUMI blok je placeholder** — po schválení její podoby (věk, tvář, účes) nahradit přesným popisem a používat identický všude.
- **Keporkak = velryba, ale vlastní** — „ancient whale-like creature" je OK; nekreslit konkrétní druh ani cizí design.
- **Rok 2008:** žádné reálné fotografie Ericky do modelu — pouze stylizovaná ruka/postava. Skutečnou kresbu evoluZionu vložit až v postprodukci (souhlas + práva).
- Ukládat schválené výstupy do `assets/klíčové-obrazy/` (viz [17-Produkce](./17-Produkce.md)).
