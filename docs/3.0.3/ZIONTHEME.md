# ZION Theme — Design System

A unified visual system for the ZION TerraNova web interface and dashboard.
It trades ad-hoc Tailwind combinations for a small set of reusable CSS
classes that share the same color, spacing, and motion language.

> Production URL: `https://zionterranova.com`  
> Deployment target: Edge server (`62.171.141.136`) via Docker/Caddy.

---

## 1. Design Tokens

### 1.1 Core Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Zion Gold | `#ffd700` | `255, 215, 0` | Primary accent, CTAs, highlights |
| Zion Purple | `#9333ea` | `147, 51, 234` | Secondary accent, gradients |
| Zion Cyan | `#06b6d4` | `6, 182, 212` | Network / data / status |
| Zion Blue | `#1e3a8a` | `30, 58, 138` | Deep backgrounds |

### 1.2 Functional Colors

| Color | RGB | Role |
|-------|-----|------|
| Emerald | `16, 185, 129` | Success, live, services |
| Amber | `251, 191, 36` | Warnings, explorer, attention |
| Rose | `244, 63, 94` | Terra Nova / story |
| Fuchsia | `217, 70, 239` | Quantum / AI |
| Teal | `20, 184, 166` | Genesis / docs |
| Indigo | `99, 102, 241` | Roadmap / API |
| Sky | `56, 189, 248` | News / live data |
| Orange | `249, 115, 22` | Roadmap / L4 |
| Pink | `236, 72, 153` | Wallet / DAO |
| Green | `34, 197, 94` | Terra Nova / L6 |
| Violet | `139, 92, 246` | Hiran / L3 |

### 1.3 Spacing & Shape

| Token | Value | Notes |
|-------|-------|-------|
| Radius MD | `1.2rem` | Buttons, small cards |
| Radius LG | `1.65rem` | Panels, sections |
| Panel padding | `1.25rem – 2rem` | Responsive |
| Grid gap | `1rem` | Default card spacing |

### 1.4 Surfaces & Effects

| Token | Light | Dark |
|-------|-------|------|
| Surface | `rgba(245, 247, 252, 0.92)` | `rgba(15, 20, 35, 0.92)` |
| Surface soft | `rgba(0, 0, 0, 0.03)` | `rgba(255, 255, 255, 0.06)` |
| Border subtle | `rgba(0, 0, 0, 0.1)` | `rgba(255, 255, 255, 0.1)` |
| Border strong | `rgba(0, 0, 0, 0.2)` | `rgba(255, 255, 255, 0.18)` |
| Shadow panel | `0 16px 50px rgba(0,0,0,0.35)` | same |
| Shadow glow | `0 0 42px rgba(147,51,234,0.28)` | same |

---

## 2. Component Library

All components are defined in `src/app/globals.css` (website) and
`ZION_OS/dashboard/dashboard.html` (dashboard).

### 2.1 `.zion-rainbow-card`

A panel with a per-card color accent controlled by the `--rc` CSS variable.

```tsx
<section
  className="zion-rainbow-card p-8"
  style={{ '--rc': '139, 92, 246' } as React.CSSProperties}
>
  ...
</section>
```

**Features**
- Colored top accent line
- Subtle colored border glow
- Hover: intensified border + shadow + `translateY(-2px)`
- Ambient blur halo on hover

**Canonical homepage cards**

| Component | Accent `--rc` |
|-----------|---------------|
| MainnetCountdown | Violet `139, 92, 246` |
| NewsFeed | Sky `56, 189, 248` |
| LiveDashboard | Amber `251, 191, 36` |
| TerraNovaHomeMilestones | Rose `244, 63, 94` |
| GoldenEggHaraniagharba | Gold `251, 191, 36` |
| QuantumRevolution | Fuchsia `217, 70, 239` |
| GenesisPreview | Teal `20, 184, 166` |
| Features | Indigo `99, 102, 241` |
| RoadmapPulse | Orange `249, 115, 22` |
| DocsRail | Blue `59, 130, 246` |
| HomeTreePortal | Green `34, 197, 94` |
| StoryTriptych cards | Rose / Fuchsia / Teal |

### 2.2 `.zion-rainbow-sub`

Inner tile variant of the rainbow card. Use for compact sub-cards inside a
rainbow panel (e.g. the 6 compact quick-link cards).

```html
<div class="zion-rainbow-sub" style="--rc: 255, 215, 0;">
```

### 2.3 `.zion-section`

Standard content panel. Replaces ad-hoc combinations such as
`rounded-4xl border border-white/10 bg-black/40 p-8 backdrop-blur`.

```html
<section class="zion-section p-8">
```

### 2.4 `.zion-tile`

Soft inner tile for grids.

```html
<div class="zion-tile p-5">
```

### 2.5 `.zion-cta-banner`

Bottom-of-page call-to-action banner.

```html
<section class="zion-cta-banner p-8">
```

### 2.6 `.zion-kicker`

Small uppercase label with a subtle pill background.

### 2.7 Buttons

| Class | Use |
|-------|-----|
| `.zion-button-primary` | Main action (gradient gold → purple → cyan) |
| `.zion-button-secondary` | Secondary action (translucent border) |
| `.zion-action-btn` | Icon-only toolbar buttons (dashboard) |

### 2.8 Status Badges

| Class | Meaning |
|-------|---------|
| `.zion-badge-success` | Live / healthy |
| `.zion-badge-warning` | Attention needed |
| `.zion-badge-danger` | Critical |
| `.zion-badge-info` | Neutral info |
| `.zion-badge-accent` | Themed by current `--rc` |

### 2.9 Tables

Use `.zion-table` for consistent data tables with hover row highlighting
linked to the current `--rc` accent.

---

## 3. Layout Patterns

### 3.1 Hero Rainbow Grid

Four-card status overview used at the top of the dashboard.

```html
<section class="zion-hero-grid mb-6">
  <div class="zion-hero-card" style="--rc: 6 182 212;">Network</div>
  <div class="zion-hero-card" style="--rc: 147 51 234;">Pool</div>
  <div class="zion-hero-card" style="--rc: 251 191 36;">Block</div>
  <div class="zion-hero-card" style="--rc: 16 185 129;">Miners</div>
</section>
```

Responsive: 1 column on mobile, 2 on tablet, 4 on desktop.

### 3.2 Story Triptych

Three side-by-side rainbow cards replacing three full-width sections.

```tsx
<StoryTriptych
  items={[
    { title: "Terra Nova", rc: "244, 63, 94", ... },
    { title: "Quantum Revolution", rc: "217, 70, 239", ... },
    { title: "ZION Genesis", rc: "20, 184, 166", ... },
  ]}
/>
```

### 3.3 Home Quick Links

6 compact rainbow sub-cards in a single row.

| Card | Icon theme |
|------|------------|
| Explorer | Gold |
| Network | Cyan |
| Pool | Purple |
| Docs | Emerald |
| Roadmap | Pink |
| Terra Nova | Amber |

Specs: `lg:grid-cols-6`, `p-4`, centered icon → label → short desc → arrow.

---

## 4. Navigation

### 4.1 2-Floor Header

The site header has two horizontal rows:

1. **First floor**: logo + 4 group dropdowns (Network, DeFi, Layers, Learn) +
   4 quick icons (network, explorer, pool, dashboard) + language toggle + auth.
2. **Second floor**: 16 color-coded mini icon links for secondary pages.

**Second-floor mini links**

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

Specs: `w-3.5 h-3.5` icons, `p-1.5` padding, hover scale 110% + tooltip,
active page gets colored border + background + icon.

### 4.2 Dashboard Navigation

The dashboard uses the same 2-floor pattern with these logical groups:

- **Overview**
- **Network** → Nodes, Topology, Orchestrator
- **Pool** → Miners, Payouts, Revenue, Live Miner
- **Layers** → L1–L6, WARP
- **AI** → Hiran, AI Agents, NCL Jobs, PoC Lab
- **Ops** → Services Health, Alerts, Logs, Backups, Fleet, Settings
- **Quick links** → Explorer, Wallets, DAO, Bridge, Validators, Swap, CEX,
  Charts, Events, Metrics, DB, Env, Genesis, Blockers, Ops, Servers, Launch,
  Wizard, Agent

---

## 5. Background System

Five selectable background modes for the homepage and dashboard.

| Mode | Icon | Color | Description |
|------|------|-------|-------------|
| Deep Space | Sparkles | Gold | Classic starfield |
| Planet Orbit | Globe | Cyan | Orbital view |
| Galactic Core | Radio | Purple | Command nexus |
| Nebula Drift | Cloud | Lavender | Desktop-agent vibe |
| Galaxy Core | Orbit | Ice-blue | Contact approach |

Implementation files:
- `src/contexts/ObservatoryContext.tsx` — mode type + labels
- `src/components/BackgroundOrchestrator.tsx` — starfield presets
- `src/components/QuantumBubbles.tsx` — bubble presets
- `src/components/BackgroundToggle.tsx` — UI config + styling

**Nebula Drift** (`a85c2f20`)
- Slow drifting lavender starfield (speed 1.6, density 180)
- High-density colorful bubbles: purple, gold, cyan, magenta, pink
- Large blur (65–100 px) for a soft misty look

**Galaxy Core** (`17a9ae77`)
- Extreme forward velocity: speed 7, density 420, trailOpacity 0.03
- Cold blue-white stars `[200, 230, 255]`
- 2 large central glow bubbles (600 px + 400 px) = breathing galactic nucleus
- Deep indigo radial background from center
- Concept doc: `GALAXY_CORE_BG_CONCEPT.md`

---

## 6. Implementation Guide

### 6.1 Add a Rainbow Card

```tsx
<section
  className="zion-rainbow-card p-6 md:p-8"
  style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
>
  <div className="zion-kicker mb-3">Section label</div>
  <h2 className="text-2xl font-bold mb-4">Card title</h2>
  <p className="text-gray-400">Content.</p>
</section>
```

### 6.2 Theme a Full Page

Set the page accent color once and reuse standard components:

```tsx
<main style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
  <section className="zion-rainbow-card p-8">Hero</section>
  <section className="zion-section p-8">Standard panel</section>
  <section className="zion-cta-banner p-8">CTA</section>
</main>
```

### 6.3 Light Theme

Add `body.light-theme` to toggle the light palette. All `.zion-*`
components include light overrides.

### 6.4 Dashboard Specifics

The dashboard file (`ZION_OS/dashboard/dashboard.html`) embeds the same
system and adds `.zion-hero-card`, `.zion-nav-shell`, `.zion-action-btn`,
and pane accent helpers (`.pane-accent`).

---

## 7. Site-Wide Rollout

The rainbow/panel system was propagated from the homepage to every site page.

| Page | Accent `--rc` | Notes |
|------|---------------|-------|
| `/` | — | Canonical reference |
| `/network` | Cyan `6, 182, 212` | Hero + 11 sections + CTA |
| `/download` | Blue `59, 130, 246` | Hero + 3 sections + CTA |
| `/wallet` | Gold `251, 191, 36` | Hero + features + CTA |
| `/dao` | Purple `147, 51, 234` | Hero + CTA |
| `/bridge` | Gold/Purple | CTA only |
| `/warp` | Purple `147, 51, 234` | Strategy blocks + CTA |
| `/defi` | Emerald `16, 185, 129` | Bridge embed panel |
| `/roadmap` | Orange `249, 115, 22` | Capability matrix + CTA |
| `/explorer` | Cyan/Purple | Footer CTA |
| `/api-reference` | Indigo `99, 102, 241` | Hero + per-group panels + CTA |
| `/l3-hiran` | Violet `139, 92, 246` | Hero |
| `/l4-oasis` | Orange `249, 115, 22` | Hero |
| `/l5-free-world` | Amber `245, 158, 11` | Hero + CTA |
| `/l6-issobella` | Rose `244, 63, 94` | Hero + 2× CTA |

---

## 8. Key Source Files

| File | Role |
|------|------|
| `src/app/globals.css` | `.zion-rainbow-card`, `.zion-rainbow-sub`, `.zion-section`, `.zion-tile`, `.zion-cta-banner` |
| `src/app/page.tsx` | Homepage composition |
| `src/components/Hero.tsx` | Hero section |
| `src/components/MainnetCountdown.tsx` | Countdown with `embedded` prop |
| `src/components/HomeQuickLinks.tsx` | 6 compact quick-link cards |
| `src/components/StoryTriptych.tsx` | 3 story cards |
| `src/components/Navigation.tsx` | 2-floor nav with mini icon row |
| `src/components/HeroSection.tsx` | Aloha flower + expandable panel |
| `src/components/BackgroundToggle.tsx` | Background mode selector |
| `src/components/BackgroundOrchestrator.tsx` | Starfield/bubble presets |
| `src/components/QuantumBubbles.tsx` | Bubble presets |
| `src/contexts/ObservatoryContext.tsx` | Background mode state |
| `ZION_OS/dashboard/dashboard.html` | Dashboard implementation |
| `GALAXY_CORE_BG_CONCEPT.md` | Galaxy Core visual concept |

---

## 9. Design Decisions

1. **Single source of truth for surfaces.** All panels derive from
   `.zion-section` or `.zion-rainbow-card`; avoid one-off Tailwind combos.
2. **Per-card color via `--rc`.** No new class per accent; set an RGB triplet
   inline and the component handles glow, border, and hover states.
3. **Sticky 2-floor navigation.** Primary categories on the first floor,
   secondary page shortcuts on the second floor, keeping the header compact.
4. **Hero → overview cards.** Dashboard landing shows 4 status cards first,
   then detailed panels below.
5. **Background as a mode, not a page.** The 5 presets let users tune the
   atmosphere without changing page structure.

---

## 10. Evolution Log

| Version | Tag | Change |
|---------|-----|--------|
| v3.6.1 | countdown-right | MainnetCountdown moved to Hero right column |
| v3.6.2 | countdown-embedded | Full MainnetCountdown embedded |
| v3.6.3 | countdown-sized | Sized to match HolographicEarth |
| v3.6.4 | quick-links | 6 compact colorful quick-link cards |
| v3.6.5 | compact-countdown | Compact countdown layout |
| v3.6.6 | nav-2floor | 2-floor navigation with mini icon links |
| v3.6.7 | aloha-below-nav | Aloha panel repositioned below nav |
| v3.6.8 | story-triptych | 3 story cards side by side |
| v3.6.9 | nebula-mode | Nebula Drift background mode |
| v3.7.0 | galaxy-core | Galaxy Core background mode |
| v3.7.1 | site-theme-rollout | Rainbow/panel system on every site page |

All versions deployed to Edge production (`zionterranova.com`).
