# Web Update Plan — ZION Theme Unification

> Living plan for unifying the `website-v2.9` UI/UX under the Zion theme system defined in `docs/3.0.3/ZIONTHEME.md`.

---

## 1. Goal

Make the entire website feel like one coherent product:
- every page uses the canonical Zion design tokens and components
- navigation, Aloha panel, and key landing pages are polished and consistent
- mobile experience is compact and usable
- no leftover ad-hoc `rounded-4xl border-white/10 bg-black/40` or per-page gradient patterns

---

## 2. Design System (canonical)

From `src/app/globals.css`:

| Utility | Use for |
|---------|---------|
| `.zion-rainbow-card` | Hero/feature cards with a per-card color accent (set `--rc` inline) |
| `.zion-rainbow-sub` | Smaller inner cards / grid tiles inside a section |
| `.zion-section` | Standard dark content panel (`rounded-4xl border-white/10 bg-black/40` replacement) |
| `.zion-tile` | Inner grid tile (`rounded-2xl border-white/10 bg-white/5` replacement) |
| `.zion-cta-banner` | Bottom CTA banner (replaces gold/purple gradient pattern) |
| `.zion-section-title` | Big page/section heading |
| `.zion-section-sub` | Secondary paragraph under a title |

Rasta navigation palette (used for nav only):
- green: `16, 185, 129` (emerald-500)
- gold: `251, 191, 36` (zion-gold)
- red: `239, 68, 68` (red-500)

---

## 3. Already Done

- `src/components/VisionBar.tsx` — compact Aloha cards, 4-card grid, Oasis portal, `.zion-rainbow-card`
- `src/components/HeroSection.tsx` — smaller mobile Stargate/Oasis CTA, `.zion-rainbow-card` CTA
- `src/components/Navigation.tsx` — consistent rasta gradient border + rasta accents throughout
- `src/app/api/defi/pools/route.ts`, `src/app/defi/page.tsx`, `src/lib/defi-contracts.ts`, `DefiL2.md` — DeFi real on-chain data + V3 update

---

## 4. Remaining Work (priority order)

### Phase A — Global utilities & shared components
1. Audit `src/app/globals.css` and ensure all Zion utilities are robust (hover states, responsive padding, dark-mode safe).
2. Create a small set of reusable wrappers if missing:
   - `ZionCard` wrapper for `.zion-rainbow-card`
   - `ZionSection` wrapper for `.zion-section`
   - `ZionCta` wrapper for `.zion-cta-banner`
   (Keep existing CSS class approach; wrappers only where they reduce duplication.)
3. Add a global helper for rasta gradient borders (`border-linear`) if needed in multiple places.

### Phase B — Top traffic / conversion pages
Convert these pages to Zion theme first:
4. `/mining` (`src/components/MiningUnifiedClient.tsx`)
   - Replace ad-hoc panels with `.zion-section`/`.zion-tile`
   - Replace feature cards with `.zion-rainbow-card` / `.zion-rainbow-sub`
   - Replace per-page CTA buttons with `.zion-cta-banner` or standard buttons
5. `/pool` (`src/app/pool/page.tsx` and related components)
6. `/dashboard/*` (`src/app/dashboard/**/page.tsx` + shared dashboard layout)
7. `/docs` (`src/app/docs/page.tsx` and docs layout)

### Phase C — Content & ecosystem pages
8. `/news` (`src/app/news/page.tsx`)
9. `/quantum-revolution` (`src/app/quantum-revolution/page.tsx`)
10. `/tree-of-life` (`src/app/tree-of-life/page.tsx`)
11. `/terranova/*` (book reader pages) — only light theme touch if needed; content reader UX is different
12. `/account`, `/login`, `/admin/*` — theme the login/account shells
13. `/ai-native`, `/cex`, `/swap`, `/ziondex`, `/wiki`, `/resonance`, `/kompas`, `/miner-stats`, `/node-setup`, `/mining/guides`, `/mining/node-setup`, `/philosophy`, `/benchmarks`, `/doge-vs-zion`, `/genesis`

### Phase D — Polish & consistency pass
14. Global search & replace remaining legacy patterns:
    - `rounded-4xl border border-white/10 bg-black/40 p-... backdrop-blur` → `.zion-section p-...`
    - `rounded-2xl border border-white/10 bg-white/5 p-...` → `.zion-tile p-...`
    - `bg-gradient-to-r from-zion-purple/30 via-zion-gold/15 to-zion-purple/30` → `.zion-cta-banner`
15. Verify every page still builds (`npm run build`).
16. Verify TypeScript (`npx tsc --noEmit`) for changed files.
17. Deploy to Edge (`zion-new`) and spot-check on desktop + mobile viewport.

### Phase E — Aloha / nav follow-ups (if user wants)
18. Fine-tune rasta navigation colors/contrast based on user feedback.
19. Further shrink/optimize Aloha panel if still too large on very small screens.

---

## 5. Definition of Done

- `npm run build` passes
- `npx tsc --noEmit` has no new errors in touched files
- All pages listed in Phase B and Phase C use `.zion-section`/`.zion-tile`/`.zion-rainbow-card`/`.zion-cta-banner` where appropriate
- No leftover `bg-black/40 border border-white/10 rounded-4xl` or `bg-white/5 border border-white/10 rounded-2xl` ad-hoc patterns in touched files
- Deployed to `zionterranova.com`

---

## 6. Notes

- Keep changes inside `APP&WEB/website-v2.9` unless explicitly asked otherwise.
- Do not commit unrelated changes in `AuXpow/`, `public/V3/`, etc.
- Use existing dependencies only; do not add new packages.
- Maintain Czech/English bilingual labels where they already exist.
- If a page is a specialized tool (explorer, book reader, dashboard charts), preserve its functional UI and only apply Zion theme shells/tiles around it.
