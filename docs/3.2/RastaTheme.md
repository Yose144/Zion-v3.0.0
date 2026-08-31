# RastaTheme — Komplexní Redesign Plan

> ZION TerraNova website-v2.9 → Rasta Motiv Redesign
> Created: 2026-08-06
> Status: **PLAN — čeká na schválení**

---

## 0. Vize

Převést celý veřejný web `app.zionterranova.com` (Next.js 16.2.9) z současného
"Gold/Purple/Cyan" ZionTheme do **Rasta motivu** — červená, zlatá, zelená
(pan-africké barvy + Haile Selassie / Rastafari tradice), s zachováním
kosmického pozadí pro OASIS onboarding sekci (budeme řešit následně).

### Reference materiály
- `APP&WEB/public_html/V2/rasta.css` — 1805 řádků kompletního rasta CSS (hero, cards, timeline, tables, buttons, stats, dashboard)
- `APP&WEB/public_html/V2/Folio/assets/css/rasta-overrides.css` — rasta color tokens
- `APP&WEB/public_html/V2/Folio/assets/css/v2-rasta-shell.css` — navbar rasta shell
- `APP&WEB/MarketPlace/src/app/globals.css` — **už má rasta paletu nasazenou** (gold #fcd116, red #e41e2b, green #078930)
- `docs/3.0.3/ZIONTHEME.md` — kompletní design system dokumentace
- `docs/3.0.3/ZIONTHEME_CHEATSHEET.md` — rychlý přehled

### Co ZACHOVÁVÁME
- Kosmické pozadí (BackgroundOrchestrator, QuantumBubbles, 5 módů) — pro OASIS onboarding
- Strukturu stránek, layout, navigaci (2-floor)
- Všechnu funkcionalitu (explorer, pool, wallet, DAO, bridge, swap, etc.)
- CS/EN bilinguální systém
- Build pipeline (108 static pages)

---

## 1. Rasta Color Palette

### 1.1 Primary Rasta Colors

| Name | Hex | RGB | Role |
|------|-----|-----|------|
| **Rasta Red** | `#e41e2b` | `228, 30, 43` | Primární akcent, CTAs, headings, gradients |
| **Rasta Gold** | `#fcd116` | `252, 209, 22` | Zlatá akcent, highlights, loga, badge |
| **Rasta Green** | `#078930` | `7, 137, 48` | Success, live, services, secondary akcent |
| **Rasta Dark** | `#1a1a1a` | `26, 26, 26` | Surface dark |
| **Rasta Black** | `#0d0d0d` | `13, 13, 13` | Background deep |

### 1.2 Supplementary Colors (zachovat z ZionTheme)

| Name | Hex | RGB | Role |
|------|-----|-----|------|
| Quantum Blue | `#00d4ff` | `0, 212, 255` | Tech/data accent (status, version badge) |
| Matrix Green | `#00ff41` | `0, 255, 65` | Live pulse, online status |
| Amber | `#f59e0b` | `245, 158, 11` | Warning, attention |
| Rose | `#f43f5e` | `244, 63, 94` | Terra Nova story |
| Teal | `#14b8a6` | `20, 184, 166` | Genesis, docs |
| Indigo | `#6366f1` | `99, 102, 241` | Roadmap, API |

### 1.3 CSS Variable Mapping (old → new)

```css
:root {
  /* OLD ZionTheme → NEW RastaTheme */
  --color-zion-gold: 252 209 22;   /* was 255 215 0 → #fcd116 */
  --color-zion-purple: 228 30 43;  /* was 147 51 234 → #e41e2b (RED replaces purple) */
  --color-zion-cyan: 7 137 48;     /* was 6 182 212 → #078930 (GREEN replaces cyan) */
  --color-zion-blue: 13 13 13;     /* was 30 58 138 → #0d0d0d (BLACK replaces blue) */

  /* NEW Rasta tokens */
  --rasta-red: #e41e2b;
  --rasta-gold: #fcd116;
  --rasta-green: #078930;
  --rasta-dark: #1a1a1a;
  --rasta-black: #0d0d0d;
  --quantum-blue: #00d4ff;
  --matrix-green: #00ff41;

  /* Shadow glow → rasta gold */
  --zion-shadow-glow: 0 0 42px rgba(252, 209, 22, 0.28);
}
```

---

## 2. Komponenty k Redesignu

### 2.1 globals.css — CSS Variables & Base Styles

**Soubor:** `src/app/globals.css`

- [ ] Aktualizovat `:root` CSS variables (gold, purple→red, cyan→green, blue→black)
- [ ] Aktualizovat `body` background — rasta radial glows (red + green + gold over deep black)
- [ ] Přidat `body::before` subtle grid overlay (jako MarketPlace)
- [ ] Aktualizovat `::selection` → rasta gold
- [ ] Aktualizovat `:focus-visible` → rasta green outline
- [ ] Aktualizovat `[data-theme="cyber"]` a `[data-theme="matrix-light"]` varianty

### 2.2 Buttons

**Třída:** `.zion-button-primary`, `.zion-button-secondary`

- [ ] Primary: gradient `linear-gradient(110deg, #e41e2b, #fcd116 48%, #078930)` (rasta tri-color)
- [ ] Primary hover: `background-position: right center` + gold glow shadow
- [ ] Secondary: translucent border s rasta gold accent
- [ ] Active state: `translateY(0)` bez glow

### 2.3 Rainbow Cards (`.zion-rainbow-card`)

- [ ] Default `--rc` → rasta gold `252, 209, 22`
- [ ] Top accent line → rasta gradient (red → gold → green)
- [ ] Hover glow → rasta gold shadow
- [ ] Corner glow accent → rasta color
- [ ] Background: `rgba(7, 10, 20, 0.82)` → `rgba(13, 13, 13, 0.82)` (rasta black)

### 2.4 Sections & Tiles

- [ ] `.zion-section` — rasta dark surface, subtle gold border
- [ ] `.zion-tile` — rasta dark inner tile
- [ ] `.zion-cta-banner` — rasta gradient border top
- [ ] `.zion-kicker` — rasta gold pill background

### 2.5 Badges

- [ ] `.zion-badge-success` → rasta green
- [ ] `.zion-badge-warning` → rasta gold
- [ ] `.zion-badge-danger` → rasta red
- [ ] `.zion-badge-info` → quantum blue
- [ ] `.zion-badge-accent` → rasta gold (default --rc)

### 2.6 Tables

- [ ] `.zion-table` thead → rasta tri-color gradient (red → gold → green)
- [ ] Header text color → rasta black (`#0d0d0d`)
- [ ] Row hover → rasta gold tint

### 2.7 Text Gradients

- [ ] `.text-gradient` → `linear-gradient(90deg, #e41e2b, #fcd116, #078930)` (rasta tri-color)
- [ ] `.text-gradient-gold` → `linear-gradient(90deg, #fcd116, #f7e47a, #fcd116)`
- [ ] `.text-gradient-cyan` → `linear-gradient(90deg, #078930, #34d399)` (green variant)
- [ ] `.text-gradient-animated` → rasta tri-color animated

---

## 3. Navigace

**Soubor:** `src/components/Navigation.tsx`

- [ ] Nav container background → `rgba(4, 8, 18, 0.92)` → `rgba(13, 13, 13, 0.92)` (rasta black)
- [ ] Nav border → rasta gold subtle
- [ ] Logo text gradient → rasta tri-color (red → gold → green)
- [ ] Menu group pills → rasta gradient border (red → gold → green) s inner dark bg
- [ ] Active/hover state → rasta gold border + glow
- [ ] Mobile hamburger menu → rasta dark bg
- [ ] Version badge → rasta gradient (quantum blue → matrix green)

---

## 4. Klíčové Stránky

### 4.1 Homepage (`/`)

- [ ] Hero section — rasta gradient heading, rasta radial glows
- [ ] MainnetCountdown — rasta gold/green accent
- [ ] NewsFeed cards — rasta tri-color top accent
- [ ] LiveDashboard — rasta green for "live" status
- [ ] StoryTriptych — rasta red, gold, green accents
- [ ] HomeQuickLinks — rasta color-coded icons
- [ ] RoadmapPulse — rasta timeline
- [ ] GenesisPreview — rasta teal/green
- [ ] Features — rasta gold/indigo

### 4.2 Explorer (`/explorer`)

- [ ] Block feed — rasta gold accent
- [ ] Transaction cards — rasta green/red for in/out
- [ ] Stats panels — rasta tri-color top bars
- [ ] Network status — rasta green for online

### 4.3 Network (`/network`)

- [ ] Topology diagram — rasta colored nodes
- [ ] Service status badges — rasta green (active), gold (warning), red (down)
- [ ] P2P mesh visualization — rasta gradient connections

### 4.4 Download (`/download`)

- [ ] Platform cards — rasta tri-color top accent
- [ ] Download buttons — rasta primary gradient
- [ ] SHA256 verification — rasta green checkmark

### 4.5 Roadmap (`/roadmap`)

- [ ] Timeline — rasta gradient line (red → gold → green)
- [ ] Milestone cards — rasta gold accent
- [ ] Capability matrix — rasta colored cells

### 4.6 Docs (`/docs`)

- [ ] Version selector — rasta gold active state
- [ ] Doc cards — rasta teal accent
- [ ] Code blocks — rasta dark bg with gold syntax

### 4.7 Multichain (`/multichain`)

- [ ] Protocol cards — rasta green (bridge), gold (WARP), red (swap)
- [ ] Chain family grid — rasta colored icons

### 4.8 Pool & Mining

- [ ] Pool stats — rasta gold numbers, green for active
- [ ] Miner stats — rasta gradient bars
- [ ] Mining guides — rasta dark cards

### 4.9 Wallet, DAO, Bridge, Swap, DeFi

- [ ] Wallet — rasta gold/pink accent
- [ ] DAO — rasta green accent
- [ ] Bridge — rasta gold accent
- [ ] Swap — rasta red accent
- [ ] DeFi — rasta green accent

### 4.10 TerraNova, Tree of Life, Philosophy

- [ ] TerraNova — rasta rose/red
- [ ] Tree of Life — rasta green sephirot
- [ ] Philosophy — rasta gold quotes

---

## 5. Footer

- [ ] Footer background → rasta dark
- [ ] 5-column accent bars → rasta tri-color (red, gold, green, teal, pink)
- [ ] Link hover → rasta gold
- [ ] Social icons → rasta gradient on hover

---

## 6. Intro Hub (`maintenance.html`)

- [ ] Background → rasta dark with radial glows
- [ ] Cards → rasta tri-color accents
- [ ] Buttons → rasta primary gradient
- [ ] Footer → rasta 5-column accent bars

---

## 7. Co se NEMĚNÍ

- **Kosmické pozadí** (BackgroundOrchestrator, starfield, bubbles) — zůstává pro OASIS onboarding
- **BackgroundToggle** — 5 módů zůstává (Deep Space, Planet Orbit, Galactic Core, Nebula Drift, Galaxy Core)
- **OASIS Web** (`oasis.zionterranova.com`) — samostatná app, nedotýkáme
- **MarketPlace** (`market.zionterranova.com`) — už má rasta paletu
- **Funkcionalita** — žádné změny logiky, API, dat
- **Struktura** — žádné přidávání/odebírání stránek
- **CS/EN překlady** — nedotýkáme (probíhá paralelně)

---

## 8. Implementační Fáze

### Fáze 1: CSS Foundation (globals.css)
- Aktualizace CSS variables (color tokens)
- Aktualizace body background, selection, focus
- Aktualizace všech `.zion-*` komponent (buttons, cards, sections, tiles, badges, tables)
- Aktualizace text gradients
- **Ověření:** `npm run build` projde, vizuální kontrola homepage

### Fáze 2: Navigation & Footer
- Navigation.tsx — rasta navbar, logo gradient, menu pills
- Footer.tsx — rasta accent bars, link colors
- **Ověření:** build, kontrola na všech stránkách

### Fáze 3: Homepage komponenty
- Hero.tsx — rasta heading gradient
- MainnetCountdown.tsx — rasta accent
- NewsFeed.tsx — rasta card accents
- StoryTriptych.tsx — rasta tri-color
- HomeQuickLinks.tsx — rasta icons
- RoadmapPulse.tsx — rasta timeline
- ReleaseBanner.tsx, ReleaseHighlightBanner.tsx — rasta gradient
- **Ověření:** build, homepage vizuální kontrola

### Fáze 4: Klíčové stránky
- Explorer pages — rasta accents
- Network page — rasta topology
- Download page — rasta platform cards
- Roadmap page — rasta timeline
- Docs page — rasta version selector
- Multichain page — rasta protocol cards
- **Ověření:** build, kontrola každé stránky

### Fáze 5: Zbylé stránky
- Pool, Mining, Wallet, DAO, Bridge, Swap, DeFi
- TerraNova, Tree of Life, Philosophy
- Dashboard pages
- Admin pages
- **Ověření:** build, kontrola

### Fáze 6: Intro Hub
- maintenance.html — rasta redesign
- **Ověření:** scp na Edge, curl 200

### Fáze 7: Final Build & Deploy
- `npm run build` — 108 pages, 0 errors
- rsync na Edge
- `systemctl restart zion-website`
- `curl` verification na obou doménách
- Vizuální kontrola na mobile + desktop

---

## 9. Tailwind Config

**Soubor:** `tailwind.config.ts`

- [ ] Aktualizovat `zion-gold` → `#fcd116`
- [ ] Aktualizovat `zion-purple` → `#e41e2b` (red)
- [ ] Aktualizovat `zion-cyan` → `#078930` (green)
- [ ] Aktualizovat `zion-blue` → `#0d0d0d` (black)
- [ ] Přidat `rasta-red`, `rasta-gold`, `rasta-green`, `rasta-dark`, `rasta-black`
- [ ] Přidat `quantum-blue`, `matrix-green`

---

## 10. Ověření po každé fázi

1. `npm run build` — musí projít (108 static pages, 0 errors)
2. Žádné interní detaily v public copy (viz AGENTS.md §2)
3. CS + EN obě jazyky zachovány
4. Mobile responsive — kontrola na 375px, 768px, 1024px, 1440px
5. Po deploy: `curl -s -o /dev/null -w '%{http_code}' https://app.zionterranova.com/` = 200

---

## 11. Rollback Plan

Pokud rasta redesign způsobí problémy:
1. `git stash` změn
2. `git checkout HEAD -- src/app/globals.css src/components/Navigation.tsx src/components/Footer.tsx`
3. `npm run build && deploy`

Všechny změny budou commitovány až po úspěšné verifikaci.

---

## 12. Estimated Scope

| Obllast | Souborů | Složitost |
|---------|---------|-----------|
| globals.css | 1 | Vysoká — kompletní color system |
| Tailwind config | 1 | Nízká — color tokens |
| Navigation | 1 | Střední — navbar styling |
| Footer | 1 | Nízká — accent bars |
| Homepage komponenty | ~10 | Střední — accent colors |
| Stránky (page.tsx) | ~30 | Střední — per-page accents |
| maintenance.html | 1 | Střední — static HTML |
| **Celkem** | ~45 souborů | **Střední** |

---

> **Status:** Plan ready. Čeká na schválení usera. Po schválení začneme Fází 1 (globals.css).
