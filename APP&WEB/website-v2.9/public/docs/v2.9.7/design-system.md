# Design System — ZION Pre-MainNet Gate

> Version: v2.9.7 · CSS Utilities for the "On the Star" interface

---

## Overview

The ZION design system is a set of CSS utility classes built on Tailwind v4. They provide visual consistency across all pages while keeping the observatory warp background system fully intact.

All utilities are defined in `globals.css` under `@layer utilities`.

---

## Core Classes

### `zion-shell`

The transparent page wrapper. Replaces all `min-h-screen bg-black` and `min-h-screen bg-slate-950` patterns.

```html
<div class="zion-shell min-h-screen">
  <!-- page content -->
</div>
```

**Properties:**
- `min-height: 100vh`
- `position: relative`
- `background: transparent` — critical: lets the observatory canvas show through
- `::before` pseudo-element adds subtle color overlays (purple 12%, cyan 8%) at `z-index: -1`

**Observatory Compatibility:**
The `BackgroundOrchestrator` renders `StarfieldBackground`, `MatrixRain`, `CyberGrid`, and `QuantumBubbles` on a `fixed` canvas managed by `ObservatoryContext`. The transparent shell ensures these render correctly under page content.

Available observatory modes:
- `deep-space` — warm gold star field, 260 stars, 2.4× speed
- `planet-orbit` — blue star field, 300 stars, 3× speed
- `galactic-core` — purple-pink field, 320 stars, 3.2× speed

---

### `zion-container`

Responsive centered content wrapper.

```html
<div class="zion-container max-w-7xl">
  <!-- constrained content -->
</div>
```

**Properties:**
```css
width: 100%;
max-width: 80rem;       /* 1280px — same as max-w-7xl */
margin-inline: auto;    /* centered */
padding-inline: 1rem;   /* 16px horizontal padding */
```

For narrower containers, add Tailwind `max-w-*` to override:
```html
<div class="zion-container max-w-5xl">  <!-- 960px max -->
<div class="zion-container max-w-6xl">  <!-- 1152px max -->
```

---

### `zion-panel`

Glass panel for cards, sections, and sidebars.

```html
<div class="zion-panel p-6">
  <!-- panel content -->
</div>
```

**Properties:**
```css
border-radius: 1.5rem;                      /* rounded-2xl */
border: 1px solid rgba(255, 255, 255, 0.1);
background: rgba(0, 0, 0, 0.6);
backdrop-filter: blur(20px);
box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
```

For larger panels with 28–32px radius, add Tailwind modifier:
```html
<div class="zion-panel rounded-[28px] p-8">
<div class="zion-panel rounded-[32px] p-10">
```

---

### Typography Utilities

#### `zion-kicker`
Micro uppercase label above titles.

```html
<p class="zion-kicker">Layer 1 Protocol</p>
```
→ `0.65rem · 0.45em tracking · gray-400 · uppercase`

#### `zion-section-title`
Large responsive section headings.

```html
<h2 class="zion-section-title">Mainnet Architecture</h2>
```
→ `2.5rem → 3.5rem → 4.5rem · bold · text-white`

#### `zion-section-sub`
Description text below section titles.

```html
<p class="zion-section-sub max-w-2xl">Protocol overview...</p>
```
→ `1.125rem · gray-400 · 1.75 line-height`

---

## Color Tokens

Defined as CSS custom properties in `:root`:

| Token | Value | Usage |
|-------|-------|-------|
| `--color-zion-gold` | `#f5c842` | Primary accent, titles |
| `--color-zion-cyan` | `#22d3ee` | Active states, links |
| `--color-zion-purple` | `#9333ea` | Overlay accent |
| `--color-bg` | `#030712` | Base background (via observatory) |

Tailwind access: `text-zion-gold`, `border-zion-cyan/30`, `bg-zion-purple/10`, etc.

---

## Usage Patterns

### Standard Page

```tsx
export default function MyPage() {
  return (
    <div className="zion-shell min-h-screen pt-28 md:pt-32 pb-24 overflow-x-hidden">
      <div className="zion-container max-w-7xl space-y-12">

        {/* Hero card */}
        <section className="zion-panel rounded-[32px] p-6 md:p-10">
          <p className="zion-kicker">Section label</p>
          <h1 className="zion-section-title text-gradient">Page Title</h1>
          <p className="zion-section-sub">Description text here.</p>
        </section>

        {/* Content grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="zion-panel p-6">...</div>
          <div className="zion-panel p-6">...</div>
          <div className="zion-panel p-6">...</div>
        </div>

      </div>
    </div>
  );
}
```

### Sidebar Layout (Docs/Genesis pattern)

```tsx
<div className="zion-shell min-h-screen">
  {/* Hero */}
  <div className="border-b border-white/10 bg-linear-to-b from-zion-cyan/10 ...">
    <div className="zion-container py-20">...</div>
  </div>
  {/* Content */}
  <div className="zion-container py-12">
    <div className="flex gap-8">
      <aside className="hidden lg:block w-72 shrink-0">
        <div className="zion-panel sticky top-24 ..." />
      </aside>
      <main className="flex-1">...</main>
    </div>
  </div>
</div>
```

---

## Observatory System Reference

The observatory is mounted globally in `layout.tsx` via `<ClientBackgrounds />` before `<main>`. It uses `ObservatoryContext` to switch between three visual modes:

```tsx
const { mode, setMode } = useObservatory();
setMode('deep-space');    // warm gold starfield
setMode('planet-orbit');  // blue starfield  
setMode('galactic-core'); // purple starfield
```

**Critical:** Never apply an opaque background to `zion-shell` or any full-page wrapper. The observatory renders on `fixed` z-index below the content stack. Any `background-color` with opacity > 0 on a full-viewport element will block the effect.
