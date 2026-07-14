# ZION Theme — One-Page Cheatsheet

Quick reference for the ZION TerraNova design system.

---

## Color Tokens

| Accent | RGB | Use |
|--------|-----|-----|
| Gold | `255, 215, 0` | Primary / CTAs |
| Purple | `147, 51, 234` | Secondary / gradients |
| Cyan | `6, 182, 212` | Network / status |
| Emerald | `16, 185, 129` | Success / live |
| Amber | `251, 191, 36` | Explorer / warning |
| Rose | `244, 63, 94` | Terra Nova / story |
| Fuchsia | `217, 70, 239` | Quantum / AI |
| Teal | `20, 184, 166` | Genesis / docs |
| Indigo | `99, 102, 241` | Roadmap / API |
| Sky | `56, 189, 248` | News / live data |
| Orange | `249, 115, 22` | Roadmap / L4 |
| Pink | `236, 72, 153` | Wallet / DAO |
| Green | `34, 197, 94` | Terra Nova / L6 |
| Violet | `139, 92, 246` | Hiran / L3 |
| Blue | `59, 130, 246` | Download / bridge |

Apply with inline CSS variable `--rc`:

```tsx
style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
```

---

## Core CSS Classes

| Class | Purpose |
|-------|---------|
| `.zion-rainbow-card` | Accent panel with top glow line and hover lift |
| `.zion-rainbow-sub` | Compact inner tile with accent color |
| `.zion-section` | Standard dark/light content panel |
| `.zion-tile` | Soft inner grid tile |
| `.zion-cta-banner` | Bottom call-to-action banner |
| `.zion-kicker` | Small uppercase pill label |
| `.zion-button-primary` | Gradient primary button |
| `.zion-button-secondary` | Translucent secondary button |
| `.zion-action-btn` | Icon-only toolbar button (dashboard) |
| `.zion-badge-success` / `-warning` / `-danger` / `-info` / `-accent` | Status pills |
| `.zion-table` | Data table with hover row highlight |
| `.zion-hero-grid` / `.zion-hero-card` | Dashboard hero status cards |
| `.zion-nav-shell` / `.zion-nav-floor` | 2-floor navigation |

---

## Quick Snippets

### Rainbow card

```tsx
<section
  className="zion-rainbow-card p-6 md:p-8"
  style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
>
  <div className="zion-kicker mb-3">Kicker</div>
  <h2 className="text-2xl font-bold mb-4">Title</h2>
  <p className="text-gray-400">Content.</p>
</section>
```

### Standard section panel

```tsx
<section className="zion-section p-8">
  ...
</section>
```

### CTA banner

```tsx
<section className="zion-cta-banner p-8">
  <h2 className="text-xl font-bold">Call to action</h2>
  <button className="zion-button-primary mt-4">Go</button>
</section>
```

### Dashboard hero grid

```html
<section class="zion-hero-grid mb-6">
  <div class="zion-hero-card" style="--rc: 6 182 212;">Network</div>
  <div class="zion-hero-card" style="--rc: 147 51 234;">Pool</div>
  <div class="zion-hero-card" style="--rc: 251 191 36;">Block</div>
  <div class="zion-hero-card" style="--rc: 16 185 129;">Miners</div>
</section>
```

### 2-floor navigation shell

```html
<nav class="zion-nav-shell">
  <div class="zion-nav-floor">Primary categories</div>
  <div class="zion-nav-floor">Quick icon links</div>
</nav>
```

---

## Shape & Spacing

| Token | Value |
|-------|-------|
| Radius MD | `1.2rem` |
| Radius LG | `1.65rem` |
| Panel padding | `1.25rem – 2rem` |
| Grid gap | `1rem` |

---

## Light Mode

Add class `light-theme` to `body`. All `.zion-*` components include light
overrides automatically.

---

## Page Accent Mapping

| Page | `--rc` |
|------|--------|
| `/network` | `6, 182, 212` |
| `/download` | `59, 130, 246` |
| `/wallet` | `251, 191, 36` |
| `/dao` | `147, 51, 234` |
| `/warp` | `147, 51, 234` |
| `/defi` | `16, 185, 129` |
| `/roadmap` | `249, 115, 22` |
| `/explorer` | `6, 182, 212` / `147, 51, 234` |
| `/api-reference` | `99, 102, 241` |
| `/l3-hiran` | `139, 92, 246` |
| `/l4-oasis` | `249, 115, 22` |
| `/l5-free-world` | `245, 158, 11` |
| `/l6-issobella` | `244, 63, 94` |

---

## Files

- `src/app/globals.css` — component CSS
- `docs/3.0.3/ZIONTHEME.md` — full design system guide
