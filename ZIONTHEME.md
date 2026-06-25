# ZION Theme — Homepage & UI Evolution Log

> Session work log: homepage redesign, navigation expansion, background
> system tuning. All changes deployed to Edge production
> (`zionterranova.com`).

---

## 1. Rainbow Card Design System

**Goal:** Unified visual language for all homepage cards using CSS
variables for per-card color theming.

### Implementation

- Created `.zion-rainbow-card` and `.zion-rainbow-sub` CSS classes in
  `globals.css` using `--rc` (RGB triplet) CSS variable.
- Each card sets its own `--rc` value inline, producing:
  - Colored top accent line (gradient via `--rc`)
  - Subtle colored border glow
  - Hover: intensified border + shadow in the card's color
  - Ambient blur halo on hover

### Cards themed (13 total)

| Component | Color | RGB |
|-----------|-------|-----|
| MainnetCountdown | Violet | `139, 92, 246` |
| HomeQuickLinks (6 sub-cards) | Gold, Cyan, Purple, Emerald, Pink, Amber | various |
| NewsFeed | Sky | `56, 189, 248` |
| LiveDashboard | Amber | `251, 191, 36` |
| TerraNovaHomeMilestones | Rose | `244, 63, 94` |
| GoldenEggHaraniagharba | Gold | `251, 191, 36` |
| QuantumRevolution | Fuchsia | `217, 70, 239` |
| GenesisPreview | Teal | `20, 184, 166` |
| Features | Indigo | `99, 102, 241` |
| RoadmapPulse | Orange | `249, 115, 22` |
| DocsRail | Blue | `59, 130, 246` |
| HomeTreePortal | Green | `34, 197, 94` |
| StoryTriptych (3 cards) | Rose, Fuchsia, Teal | various |

**Commit:** `5326f2ad`

---

## 2. AI Entry Layer Panel Removal

**Goal:** Remove the "AI input layer panel" from the Hero component.

- Removed the AI entry layer panel (BrainCircuit teaser card) from
  `Hero.tsx`.
- Cleaned up unused imports (`SITE_LAUNCH_DATE_DISPLAY`, etc.).
- **Note:** WebTerminal was mistakenly removed first, then restored —
  the "AI input layer panel" was a different element from the
  interactive terminal.

**Commits:** `9751a540`, `7b5d5f33`, `14c048c1`

---

## 3. MainnetCountdown Relocation & Compaction

**Goal:** Move the countdown from a standalone section into the Hero
right column, below HolographicEarth.

### Steps

1. **Move to Hero right column** (`07e4ae11`, `293cbb71`):
   - Added `embedded` prop to `MainnetCountdown` — skips
     `<section>`/`zion-container` wrapper when `true`.
   - Imported into `Hero.tsx`, placed under `HolographicEarth`.
   - Removed from `page.tsx`.

2. **Size to match HolographicEarth** (`12b66af1`):
   - Wrapped in `max-w-sm lg:max-w-md` container — same width as
     the earth visualization above.

3. **Compact layout** (`cf4f6002`):
   - Digit boxes: `w-12 h-12` (was `w-20 h-20`), `text-base`
   - Padding: `p-4` when embedded (was `p-6 md:p-8`)
   - Phase badge: small pill (was full banner)
   - Title: `text-sm` with `w-8 h-8` icon
   - Progress bar: `h-1`, smaller subtitle text
   - isLive variant also compacted

---

## 4. HomeQuickLinks — 6 Compact Colorful Cards

**Goal:** Shrink the 6 quick-link cards and arrange in a single row.

**Commit:** `fa9f8af7`

### Changes

- Grid: `lg:grid-cols-6` (was `lg:grid-cols-3`), `sm:grid-cols-3`,
  `grid-cols-2` on mobile.
- Compact card: `p-4`, centered layout (icon → label → short desc →
  arrow).
- Each card has unique rainbow color with colored icon box:
  - Explorer (Gold), Network (Cyan), Pool (Purple), Docs (Emerald),
    Roadmap (Pink), Terra Nova (Amber).
- Hover: icon scale 110%, arrow translate.
- Shortened descriptions ("Bloky, tx, adresy", "Uzly, latence"...).

---

## 5. Navigation — 2-Floor with Mini Icon Quick-Nav

**Goal:** Add a second row of mini icon links for all secondary pages.

**Commit:** `00d31452`

### First floor (existing)

Logo + 4 group dropdowns (Network, DeFi, Layers, Learn) + 4 quick
icons (network, explorer, pool, dashboard) + lang toggle + auth.

### Second floor (new)

16 mini icon links, each color-coded:

| Icon | Page | Color |
|------|------|-------|
| HardHat | Mining | Amber |
| Download | Download | Cyan |
| Coins | DeFi | Emerald |
| ArrowLeftRight | Bridge | Blue |
| Landmark | DAO | Purple |
| Wallet | Wallet | Pink |
| BookOpen | Docs | Teal |
| Newspaper | News | Orange |
| Map | Roadmap | Indigo |
| Sparkles | Genesis | Gold |
| Globe2 | Terra Nova | Green |
| Brain | Hiran | Violet |
| Flower2 | Oasis | Fuchsia |
| Rocket | Free World | Sky |
| Zap | Issobella | Rose |
| Orbit | WARP | Purple |

- `w-3.5 h-3.5` icons, `p-1.5` padding.
- Hover: scale 110% + tooltip with page name.
- Active page: colored border + bg + icon in color.
- `hidden md:flex` — hidden on mobile (hamburger menu covers it).

---

## 6. Aloha Panel Repositioning

**Goal:** Push the Tahiti flower / Aloha expandable panel below the
new 2-floor navigation.

**Commit:** `309733b0`

- `HeroSection.tsx` top padding: `pt-32 sm:pt-36 md:pt-40` (was
  `pt-20 sm:pt-28`) — ~80px lower.
- Z-index: `z-15` (was `z-20`) — stays below nav (`z-50`).

---

## 7. Story Triptych — 3 Cards Side by Side

**Goal:** Replace 3 full-width sections (TerraNovaHomeMilestones,
QuantumRevolution, GenesisPreview) with a compact 3-column layout.

**Commit:** `f1cc4cf9`

### New component: `StoryTriptych.tsx`

3 `zion-rainbow-card` cards in `md:grid-cols-3`:

| Card | Color | Content |
|------|-------|---------|
| Terra Nova | Rose | Book · Compass · CLI |
| Kvantová Revoluce | Fuchsia | 10 chapters · 11 languages |
| ZION Genesis | Teal | 9 chapters of awakening |

- Each card: colored icon, title, subtitle, short description,
  chapter count, "Open" CTA.
- Hover: icon scale, arrow translate.
- Replaced ~500 lines of 3 separate sections with ~100 lines.

---

## 8. Background System — 5 Modes

**Goal:** Tune existing background modes, add new ones inspired by
desktop agent and film references.

### Mode overview

| Mode | Icon | Color | Description |
|------|------|-------|-------------|
| Deep Space | Sparkles | Gold | Classic starfield |
| Planet Orbit | Globe | Cyan | Orbital view |
| Galactic Core | Radio | Purple | Command nexus |
| Nebula Drift | Cloud | Lavender | Desktop agent vibe |
| Galaxy Core | Orbit | Ice-blue | Contact approach |

### 8a. Nebula Drift mode

**Commit:** `a85c2f20`

- Inspired by desktop agent's `nebula.jpg` background.
- Slow drifting lavender starfield (speed 1.6, density 180).
- High-density colorful bubbles: purple, gold, cyan, magenta, pink.
- Large blur (65-100px) = soft misty look.

### 8b. Galaxy Core mode

**Commit:** `17a9ae77`

- Inspired by *Contact* (1997) wormhole scene — "they should have
  sent a poet."
- Concept doc: `GALAXY_CORE_BG_CONCEPT.md` in repo root.
- Extreme forward velocity: speed 7, density 420, trailOpacity 0.03.
- Cold blue-white stars `[200, 230, 255]`.
- 2 large central glow bubbles (600px + 400px) = breathing galactic
  nucleus.
- Deep indigo radial background from center.

### 8c. BackgroundToggle UI tuning

- Each mode has its own color — button glows in the active mode's
  color.
- Panel items show colored icons matching their mode.
- `rounded-2xl` panel, cleaner hover states.
- Active item: colored border + bg + checkmark in mode color.

### Files touched

- `src/contexts/ObservatoryContext.tsx` — mode type + labels
- `src/components/BackgroundOrchestrator.tsx` — starfield presets
- `src/components/QuantumBubbles.tsx` — bubble presets
- `src/components/BackgroundToggle.tsx` — UI config + styling

---

## Deployment History

| Version | Tag | Description |
|---------|-----|-------------|
| v3.6.1 | countdown-right | Countdown in Hero right column |
| v3.6.2 | countdown-embedded | Full MainnetCountdown embedded |
| v3.6.3 | countdown-sized | Sized to match HolographicEarth |
| v3.6.4 | quick-links | 6 compact colorful cards |
| v3.6.5 | compact-countdown | Compact countdown layout |
| v3.6.6 | nav-2floor | 2-floor navigation with mini icons |
| v3.6.7 | aloha-below-nav | Aloha panel repositioned |
| v3.6.8 | story-triptych | 3 story cards side by side |
| v3.6.9 | nebula-mode | Nebula Drift background mode |
| v3.7.0 | galaxy-core | Galaxy Core background mode |

All deployed to Edge server (`77.42.71.94`) via Docker prebuilt
image + Caddy reverse proxy. Production URL: `zionterranova.com`.

---

## Key Files

| File | Role |
|------|------|
| `src/app/page.tsx` | Homepage composition |
| `src/components/Hero.tsx` | Hero section with HolographicEarth + countdown |
| `src/components/MainnetCountdown.tsx` | Countdown with `embedded` prop |
| `src/components/HomeQuickLinks.tsx` | 6 compact quick-link cards |
| `src/components/StoryTriptych.tsx` | 3 story cards (Terra Nova, Quantum, Genesis) |
| `src/components/Navigation.tsx` | 2-floor nav with mini icon row |
| `src/components/HeroSection.tsx` | Aloha flower + expandable panel |
| `src/components/BackgroundToggle.tsx` | Background mode selector UI |
| `src/components/BackgroundOrchestrator.tsx` | Starfield/bubble presets per mode |
| `src/components/QuantumBubbles.tsx` | Bubble presets per mode |
| `src/contexts/ObservatoryContext.tsx` | Background mode state |
| `src/app/globals.css` | `.zion-rainbow-card` / `.zion-rainbow-sub` classes |
| `GALAXY_CORE_BG_CONCEPT.md` | Galaxy Core visual concept + tuning notes |
