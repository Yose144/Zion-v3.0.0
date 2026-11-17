# Batch 6 — Onboard — chybějící hero plochy

> **5 obrázků.** Zkopíruj celý soubor do GPT jako jednu zprávu.
> Styl, kánon a negativy jsou v `00-GPT-MASTER-PROMPT.md` — GPT je už má.

Pět stránek 3.3 onboardu dnes nemá žádný hero (jen text): /roadmap, /team, /ai-native, /status, /contact. Všechny jsou 16:9, text vlevo (tmavá levá třetina), stejná malba jako ostatní hero plochy.

## Přehled

| # | id | poměr | master | cíl |
|---|---|---|---|---|
| 1 | `onboard-roadmap-hero` | 16:9 | 2048×1152 | `onboard/public/images/roadmap/hero` |
| 2 | `onboard-team-hero` | 16:9 | 2048×1152 | `onboard/public/images/team/hero` |
| 3 | `onboard-ai-native-hero` | 16:9 | 2048×1152 | `onboard/public/images/ai-native/hero` |
| 4 | `onboard-status-hero` | 16:9 | 2048×1152 | `onboard/public/images/status/hero` |
| 5 | `onboard-contact-hero` | 16:9 | 2048×1152 | `onboard/public/images/contact/hero` |

## Zadání

### 1. `onboard-roadmap-hero`

- **Poměr:** 16:9 · **Master:** 2048×1152
- **Text-safe:** left third, vertically centered
- **Cílové soubory:** `onboard/public/images/roadmap/hero.webp` (1672×941), `onboard/public/images/roadmap/hero-m.webp` (960×540)
- **Alt CS:** Navigátorská komora za soumraku: na dřevěném stole rozložený plán letu, mosazná kružítka, dřevěné modely lodí jako milníky a jedna jantarová lucerna.
- **Alt EN:** A navigator's chart room at dusk: a flight plan unrolled on a wooden table, brass dividers, carved ship models as milestones and one amber lantern.

```text
A navigator's chart room at dusk: a large parchment flight plan unrolled across a worn wooden table, brass dividers, a compass and small carved wooden ship models marking stages along the route; a steward's hand rests on the plan. One amber lantern lights the chart, deep ink shadows around, a calm window on the right showing a grey-blue sea and a distant coastline. Painterly manga brushwork, parchment and amber accents, rust-red cloth detail. The left third stays dark and uncluttered for text. No lettering on the plan, no labels, no numbers.
```

### 2. `onboard-team-hero`

- **Poměr:** 16:9 · **Master:** 2048×1152
- **Text-safe:** left third, vertically centered
- **Cílové soubory:** `onboard/public/images/team/hero.webp` (1672×941), `onboard/public/images/team/hero-m.webp` (960×540)
- **Alt CS:** Kulatý stůl v lucernami osvětlené síni: správce s klíči, řemeslnice s dláty a archivářka s knihou; nad stolem se vznáší malá zlatá koule světla.
- **Alt EN:** A round table in a lantern-lit hall: a steward with keys, a craftswoman with chisels and an archivist with a book; a small golden sphere of light hovers above the table.

```text
A round oak table in a lantern-lit timber hall: three travellers seated — an older steward with a ring of iron keys, a craftswoman with chisels and a leather apron, a young archivist holding a closed book — and above the table a small calm golden sphere of light with fine luminous filaments (an AI presence, not a human, no face, no body). Warm amber lanterns hang from beams, the left side of the hall falls into deep ink shadow, one window shows a night sky. Respectful, human-scaled, painterly manga. Left third dark and clear for text. No text, no banners, no crests with lettering.
```

### 3. `onboard-ai-native-hero`

- **Poměr:** 16:9 · **Master:** 2048×1152
- **Text-safe:** left third, vertically centered
- **Cílové soubory:** `onboard/public/images/ai-native/hero.webp` (1672×941), `onboard/public/images/ai-native/hero-m.webp` (960×540)
- **Alt CS:** Noční observatoř-knihovna: regály knih, mosazné orrery a nad stolem klidná zlatá koule světla s jemnými vlákny; u stolu píše sedící postava.
- **Alt EN:** A night observatory library: bookshelves, a brass orrery and above the table a calm golden sphere of light with fine filaments; a seated figure is writing.

```text
An observatory library at night: tall shelves of worn books, a brass orrery on a side table, arched windows with stars, and above the central desk a calm golden sphere of light with delicate luminous filaments radiating like a geometric mandala (Hiran — a sphere of light, never a human figure, no face). A seated traveller writes by hand in a ledger, an amber lantern on the desk answers the sphere's glow. Painterly manga, ink depth, one warm focal light, cool night blues. Left third dark and clear for text. No text on the spines or the ledger, no UI, no screens.
```

### 4. `onboard-status-hero`

- **Poměr:** 16:9 · **Master:** 2048×1152
- **Text-safe:** left third, vertically centered
- **Cílové soubory:** `onboard/public/images/status/hero.webp` (1672×941), `onboard/public/images/status/hero-m.webp` (960×540)
- **Alt CS:** Kamenná hlásná věž na útesu za modré hodiny, lucerna na vrcholu svítí; pod ní řada signálních lamp — tři svítí, jedna zhaslá.
- **Alt EN:** A stone beacon tower on a cliff at blue hour, its lantern lit; below it a row of signal lamps — three burning, one dark.

```text
A stone beacon tower on a sea cliff at blue hour: the tower's lantern room brightly lit, a soft amber beam across calm water, gulls, weathered ropes and a small wooden stair. On the terrace below, a row of four iron signal lamps — three burning amber, one dark and cold. A single keeper's silhouette checks the lamps. Painterly manga, cold marine blues against warm lantern light, rust-red banner cloth without lettering. Left third dark and clear for text. No gauges with numbers, no screens, no lettering.
```

### 5. `onboard-contact-hero`

- **Poměr:** 16:9 · **Master:** 2048×1152
- **Text-safe:** left third, vertically centered
- **Cílové soubory:** `onboard/public/images/contact/hero.webp` (1672×941), `onboard/public/images/contact/hero-m.webp` (960×540)
- **Alt CS:** Psací stůl u otevřeného okna za soumraku: rozepsaný dopis, pečetní vosk a brk, hrnek, jantarová lucerna a výhled na moře s uvázanou lodí.
- **Alt EN:** A writing desk by an open window at dusk: a half-written letter, sealing wax and a quill, a cup, an amber lantern and a view of the sea with a moored boat.

```text
A writing desk by an open window at dusk: a half-written letter on parchment (abstract pen strokes, no readable words), a stick of sealing wax, a brass seal and a quill in an inkwell, a ceramic cup with steam, an amber lantern. Beyond the window a quiet bay with one moored wooden boat and the last warm light on the water. Painterly manga, warm interior against cool evening sea, rust cloth over the chair back. Left third dark and clear for text. No readable writing, no addresses, no logos.
```
