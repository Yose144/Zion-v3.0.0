# Changelog — v2.9.7 (Pre-MainNet Gate)

Released: March 2026

---

## Summary

v2.9.7 is a **no-consensus-change** iteration. Zero protocol primitives were altered. All changes are in the web infrastructure, UX, documentation, and operational stability layer.

---

## [v2.9.7] — 2026-03

### Added

#### Design System
- `zion-shell` — transparent page wrapper that preserves observatory warp backgrounds (Deep Space / Planet Orbit / Galactic Core). Replaces opaque `bg-black` / `bg-slate-950` wrappers across all pages.
- `zion-container` — responsive centered layout wrapper (80rem max-width, 1rem padding-inline, auto margins). Replaces `container mx-auto px-4` everywhere.
- `zion-panel` — unified glass card class (1.5rem radius, border/blur/shadow). Replaces 30+ different inline panel class combinations.
- `zion-kicker` — uppercase micro-label utility.
- `zion-section-title` — large responsive section heading.
- `zion-section-sub` — section description text.

#### Observatory System (restored)
- `zion-shell::before` pseudo-element adds subtle color overlays at `z-index: -1` without blocking canvas layers.
- Deep Space, Planet Orbit, Galactic Core backgrounds now display correctly on all unified pages.

#### Documentation
- v2.9.7 docs section: README, Changelog, Design System, Layer Architecture update, MainNet Gate criteria.
- Version tree updated: v2.9.7 (CURRENT), v2.9.6 (PREVIOUS), v2.9.5 (ARCHIVE).

#### Pages Unified
All 30+ page/component files now use the unified design system:
- Explorer: `/explorer`, `/explorer/blocks`, `/explorer/transactions`, `/explorer/richlist`, `/explorer/address`, `/explorer/block`, `/explorer/tx`
- Dashboard: `/dashboard`, `/dashboard/system-metrics`, `/dashboard/pool-metrics`, `/dashboard/advanced-pool`, `/dashboard/ch3`, `/dashboard/ncl`, `/dashboard/dao-tree`
- Mining: `/mining`, `/mining/guides`, `/mining/node-setup`
- Admin: `/admin`, `/admin/algo-manager`, `/admin/pool-config`
- Public: `/`, `/network`, `/download`, `/docs`, `/genesis`, `/roadmap`, `/bridge`, `/dao`, `/warp`, `/ai-native`, `/api-reference`, `/pool`, `/miner-stats`

#### Responsive Improvements
- `overflow-x-hidden` added to all page wrappers.
- Mobile navigation improvements across docs and genesis pages.
- Grid column breakpoints reviewed on dashboard, mining, and explorer cards.

### Changed

- Footer: `v2.9.6` → `v2.9.7 On the Star`
- Navigation: version badge `2.9.6` → `2.9.7`
- Layout title: `v2.9.6 — On the Star` → `v2.9.7 — On the Star`
- Dashboard mission metrics: version reference updated.
- `zion-shell` background changed from opaque gradient to `transparent` (critical observatory fix).

### Fixed

- **[BUG]** Observatory warp backgrounds (StarfieldBackground, QuantumBubbles, BackgroundOrchestrator) were hidden behind the opaque `zion-shell` background. Fix: `background: transparent` on `.zion-shell`, overlays moved to `::before` at `z-index: -1`.
- Sidebar glass card in Docs page was using non-standard backdrop class.
- MinerDashboard redundant background glow `fixed inset-0` overlay removed (observatory handles backgrounds).
- `min-h-screen bg-black` on CH3, NCL, dao-tree, advanced-pool, pool-metrics dashboard pages removed.

### Removed

- Inline `bg-black` from 6 dashboard page wrappers (bg now supplied by observatory layer at layout level).
- Redundant `fixed inset-0` background div in `MinerDashboard.tsx`.
- `px-4` padding from outer page wrappers where `zion-container` already provides `padding-inline: 1rem`.

---

## [v2.9.6] — February 2026

See [v2.9.6/changelog.md](../v2.9.6/changelog.md) for full list of changes in the previous release.

Key highlights:
- 6-Layer "On the Star" architecture introduced
- Decade Decay emission schedule (100+ year horizon)
- Website redesign with cosmic observatory system
- 52,590 lines of Rust across 5 crates
- 780+ passing tests

---

## [v2.9.5] — 2025

Previous stable release (Native Awakening). See v2.9.5 archive docs.
