# Web3.3 integration and forward plans

Strategic overview of the current architecture, integration flows, and product roadmap for the ZION TerraNova Web3.3 platform.

> **Roadmap alignment**: This plan aligns with `ROADMAP.md` (master roadmap 2025–2030), `ROADMAP_2.8.6-2.8.9.md` (stabilization → polish pipeline), and `ROADMAP_v2.9.0.md` (Quantum Leap). Milestones cite those sources.

## Architecture snapshot

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4, cosmic background components (Starfield, MeteorShower, BubbleOverlay, ThemePanel).
- **Content layer**: Markdown renderer (`react-markdown`, `remark-gfm`) with aliases to whitepaper assets under curated `public/docs` paths.
- **Documentation**: Dynamic navigation (`/docs`) with sidebar tree and hashed deep links into markdown files served from `/docs/*.md`.
- **DevOps**: `npm run lint`, `npm run build`, `npm run dev`; deployment targets typically Vercel + CDN with static caching.

## Global roadmap alignment

- **Q4 2025 (Roadmap 2.8.6–2.8.9)**: Web3.3 frontend runs alongside backend bugfix / performance / polish cycles. Finish stabilization tasks (2.8.6) and performance tuning (2.8.7) so dashboards and docs sit on dependable APIs.
- **Q1 2026 (Roadmap v2.9.0 “Quantum Leap”)**: Security hardening, bridge work, and multi-sig wallets surface in integrations (SDK, tutorials, dashboard). Web3.3 should expose guides and UI hooks for new APIs.
- **Q2–Q4 2026 (Master roadmap)**: Dashboard + docs progressively reflect humanitarian bridges, additional chain integrations, mobile wallet rollout, and mainnet rehearsal milestones.

### Initiative mapping

| Web3.3 component | Roadmap reference | Notes |
| --- | --- | --- |
| `/docs` markdown pipeline | `ROADMAP_2.8.6-2.8.9` (documentation overhaul) | Land during v2.8.9 “Polish”. |
| Tutorials (First dApp, etc.) | `ROADMAP_v2.9.0` Phase 5.3 Developer Grants | Tutorial growth supports builders. |
| Dashboard metrics | `ROADMAP.md` Q1 2026 security & bridge; Q2 2026 testnet KPIs | Show bridge throughput + testnet health. |
| Theme / visual effects | Master roadmap brand continuity | Consistent UX for campaigns. |

## Integration flows

1. **Documentation sync**
   - Pull upstream markdown from protocol repos and whitepaper sources of truth.
   - Update internal link targets when moving files under `public/docs/**`.
   - Keep navigation (`page.tsx`) in sync with new doc paths.

2. **Visual components**
   - `Starfield`, `MeteorShower`, `BubbleOverlay`, `ThemePanel` ship with toggles on marketing pages.
   - Validate performance (FPS profiling, `requestAnimationFrame` throttling on mobile).

3. **API & SDK integration**
   - Prefer lazy-loaded client modules for interactive examples.
   - Use the site’s public API routes as the reference surface for tutorials.

4. **Dashboard concept**
   - Operator dashboards visualize test-mainnet metrics (hashrate, governance signals, etc.).
   - Modules evolve with RPC / pool telemetry availability.

5. **Internationalization**
   - Maintain CS/EN pairs under `public/docs/cs` and `public/docs/en` with root fallback where intentional.

## Rollout checklist

1. **Local bootstrap**
   - `git pull` latest default branch  
   - `npm install`  
   - `npm run lint && npm run build`

2. **Content sync**
   - Automate copying from canonical doc repos where applicable.
   - Add link-check CI for markdown anchors.

3. **Components & layout**
   - Document props on shared visual primitives.
   - Centralize theme tokens for multi-page reuse.

4. **CI/CD**
   - Lint + build on every PR.
   - Preview deploys with sufficient Node heap for large doc trees.

5. **Monitoring**
   - Use analytics plus structured logging on API routes where enabled.
   - Collect docs feedback via conventional community channels.

## Security & operations

- Keep secrets out of tracked files — use `.env` + `.gitignore`.
- Rate-limit public API surfaces that back tutorials.
- Tight CSP in `next.config.*` aligned with CDN allowlists.
- Run recurring dependency audits (`npm audit`) with human review before major bumps.

## Testing strategy

- **Unit**: RTL coverage for reusable UI primitives.
- **Integration / E2E**: Playwright (or equivalent) over `/docs` navigation and hero CTAs when enabled.
- **Performance**: Lighthouse CI targets for core marketing routes.
- **Content**: Automated markdown link scanning.

## Web3.3 milestones (illustrative; verify against active roadmap docs)

### Q4 2025 — 2.8.6 → 2.8.9 wave

- **v2.8.6 “Stability”**: Docs site stays green while docker stacks move; validate health endpoints feeding dashboards.
- **v2.8.7 “Performance”**: UI caching hooks (e.g., SWR / React Query) aligned with backend cache layers.
- **v2.8.8 “Features”**: richer operator views + interactive snippets in tutorials.
- **v2.8.9 “Polish”**: README / troubleshooting / API docs embedded in-site; navigation E2E coverage.

### Q1 2026 — v2.9.0 “Quantum Leap”

- Security documentation (wallets, multi-sig) tied to roadmap security phases.
- Bridge-oriented tutorials + dashboard modules as APIs stabilize.
- AI / orchestration widgets only when backed by real endpoints.

### Q2–Q4 2026 — main roadmap execution

- Testnet KPI surfaces (uptime, propagation, bridge volume) as metrics become reliable.
- Multi-chain modules behind feature flags as integrations ship.
- DAO onboarding + docs gamification per community programs.

## Milestone table (historical planning snapshot)

| Milestone | Target | Done when |
| --- | --- | --- |
| Web3.3 Beta (aligned with v2.8.9) | mid-Dec 2025 | Dashboard MVP, three tutorials, clean build |
| Web3.3 GA (post v2.9.0 RC) | end-Jan 2026 | i18n baseline, automated CI/CD, high docs coverage |
| Web3.4 Preview (Q2 roadmap) | Apr 2026 | Live data feeds + personalized widgets |

## Next steps

1. Keep dashboard routes aligned with active operator metrics.
2. Automate doc sync + link validation.
3. Ship starter kits (video walkthroughs + sample repos) for builders.
4. Schedule security review ahead of major public marketing pushes.

---

Update this document after each planning review (at least bi-weekly while execution is active).
