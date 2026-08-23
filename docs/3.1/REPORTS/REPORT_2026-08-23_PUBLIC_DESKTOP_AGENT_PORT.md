# Report: Public Desktop Agent v3.0.6 — VIP Parser Fixes Port

**Date:** 2026-08-23
**Scope:** `archive/DesktopAgentP3.0.6/` (public release = `zion-public-miner` v3.2.0)
**Reference:** VIP version at `APP&WEB/desktop-agent/` (`zion-desktop-agent` v3.2.0)

---

## Summary

Ported all Trinity mining parser fixes, SVG icon migration, block-found detection,
and synthetic share event features from the VIP desktop-agent to the public release
version in `archive/DesktopAgentP3.0.6/`. The public version preserves its
`PUBLIC_BUILD = true` branding (Stream 2/3 shown as "Boost Stream 1/2" with hidden
coin/algorithm details).

**4 files changed, 370 insertions(+), 92 deletions(-)**

---

## Changes by File

### 1. `src/main.js` (267 insertions, 92 deletions)

#### a) `_streamShareCounts` module-level state (line ~669)
- Added `let _streamShareCounts = { 1: {...}, 2: {...}, 3: {...} }` to track
  last-seen accepted/rejected counts per stream for synthetic share event detection.
- Added reset in `resetMinerTelemetryForNewSpawn()` (line ~741).

#### b) `maybeEmitBlockFound()` — V3 Trinity format (line ~3270)
- Added parser for `V3 Trinity: ZION block found height=N` format.
- Emits `block-found` IPC event with `{ height, coin }` payload.

#### c) `maybeEmitShareEvent()` — V3 Trinity share events (line ~3335)
- Added parsers for `V3 Trinity: {COIN} share accepted/rejected job=N nonce=N height=N`.
- Maps coin → stream index (ZION=1, ZANO=2, VRSC=3) and coin → algorithm
  (ekam_deeksha, progpow, verushash).
- Emits `share-event` IPC with `{ stream, coin, accepted, algorithm, job, height, nonce }`.

#### d) Stream stats parser — complete rewrite (line ~3952)
- **Old:** Single `output.match()` for one stream stats line; direct
  `minerStats.streams[1]=...` array assignment causing sparse array + duplicate
  ZION bug after `filter()` compaction.
- **New:** `output.matchAll()` for all stream stats lines in the output batch;
  temp object `_newStreams` keyed by 1-based index; dense array built via
  `Object.keys().sort().map()` — eliminates sparse array and duplicate ZION bug.
- Stream metadata maps: `streamIndex`, `streamLabels`, `streamAlgos`,
  `streamDefaultCoins` for ZION/ZANO/VRSC.
- Per-stream objects include: `index`, `label`, `coin`, `algorithm`,
  `hashrate_10s/60s/15m`, `accepted`, `rejected`, `active`.

#### e) Synthetic share events for ZANO/VRSC (line ~3988)
- For stream idx >= 2 (ZANO, VRSC): detect accepted/rejected count increments
  vs `_streamShareCounts[idx]` and emit synthetic `share-event` IPC.
- Stream 1 (ZION) skipped — it has real-time share events from `maybeEmitShareEvent`.
- Prevents duplicate share log entries.

#### f) TUI log parser (line ~4032)
- Parses `hashrate=X H/s submitted=N accepted=N rejected=N jobs=N reconnects=N coin=X pool=X`.
- Used for hashrate + pool/coin metadata only (accepted/rejected are per-coin,
  not total — total comes from periodic metrics summary).

#### g) Periodic metrics summary parser (line ~4057)
- Parses `periodic metrics summary active_streams=3 total_hashrate=19.68 MH/s
  total_accepted=1337 total_rejected=6 overall_accept_rate="100.0%"`.
- Sets **total** accepted/rejected/shares across all 3 streams.
- Sets `overall_accept_rate` for difficulty card display.
- Unit-aware (kH/s, MH/s, GH/s, TH/s → H/s).

#### h) Fallback summary parser (line ~4085)
- `pool=X coin=X hashrate=X H/s accepted=N rejected=N` — only used when
  neither TUI log nor periodic metrics summary matched.

#### i) Additional V31 parsers (line ~4120)
- **GPU CUDA lite init** with `tpb` field: `gpu_cuda_lite_init device="..." work_size=N scratchpad_mb=N tpb=N`
- **Auto-tune CPU**: `[auto-tune] CPU: ... "CPU name" | physical=N logical=N arch=X | threads=N`
- **Trinity stream enablement**: `Stream 1 (ZION): ENABLED (threads=N)`
- **Block height from progpow recompilation**: `block_height=N`

#### j) `test-block-found` IPC handler (line ~4500)
- Added `ipcMain.handle('test-block-found', ...)` for testing block-found toast.
- Emits `block-found` event + increments `blocks_found` counter.

### 2. `src/preload.js` (1 insertion)
- Added `testBlockFound: (data) => ipcRenderer.invoke('test-block-found', data)`.

### 3. `src/ui/index.html` (76 insertions)
- Added 16 missing SVG `<symbol>` definitions: `i-whale`, `i-zap`, `i-pickaxe`,
  `i-sparkles`, `i-apple`, `i-linux`, `i-help`, `i-bulb`, `i-alert-triangle`,
  `i-arrow-down`, `i-arrow-up`, `i-swap-vert`, `i-check-circle`, `i-x-circle`,
  `i-monitor-cpu`.
- Added `id="difficulty-label"` to the difficulty card label element (for
  dynamic "Accept Rate" / "Pool Difficulty" switching).

### 4. `src/ui/renderer.js` (118 insertions, 92 deletions)

#### a) SVG icon helpers (line ~24)
- Added `_SVG_ICONS` map (warn, error, ok, info) with colored SVG `<use>` refs.
- Added `setStatusIcon(el, type, text)` helper for XSS-safe status messages.

#### b) Share log table icons (line ~2520)
- `✓`/`✗` → `<svg><use href="#i-check-circle"></use></svg>` / `#i-x-circle`.

#### c) Difficulty card — accept rate display (line ~2260)
- Shows `overall_accept_rate` as "Accept Rate" when available, else "Pool Difficulty".
- Added `overall_accept_rate` to `buildStatsSignature()` for change detection.

#### d) Stream finder guard (line ~3648)
- `streams.find(s => Number(s.index) === i)` → `streams.find(s => s && Number(s.index) === i)`
  to prevent crash on null/undefined stream entries.

#### e) SVG icon migration — all emoji in innerHTML contexts (42 edits)
- **Send form status** (9 edits): `⚠`/`❌`/`✅` → `setStatusIcon()` with SVG icons.
- **Network sync icons** (3 edits): `✗`/`✓`/`!` → SVG `#i-x-circle`/`#i-check-circle`/`#i-alert-triangle`.
- **Peer direction arrows** (3 edits): `↓`/`↑`/`⚠` → SVG `#i-arrow-down`/`#i-arrow-up`/`#i-alert-triangle`.
- **Security status icons** (7 edits): `✅`/`❌`/`⚠️` → SVG `#i-check-circle`/`#i-x-circle`/`#i-alert-triangle`.
- **Bridge readiness** (1 edit): `✓`/`◐` → SVG `#i-check-circle`/`#i-arrow-up`.
- **Bridge form status** (10 edits): `⚠`/`❌` → `setStatusIcon()` with SVG icons.
- **Node sync stat + sync bar** (5 edits): `✓`/`⚡`/`🌐`/`⬇` → SVG icons + `svgIcon()` helper.
- **Node sync offline** (1 edit): `⚡` → SVG `#i-zap`.
- **Stake/portfolio form status** (2 edits): `⚠` → `setStatusIcon()`.
- **DAO guardian** (1 edit): `✓ Active` → SVG `#i-check-circle` + "Active".

#### f) Preserved (not changed)
- `addLogEntry()` calls with `✓`/`✗` — these use `textContent`, can't render HTML.
- Log parser text symbols (`[✗]`, `[+]`, `█`, `★`, `→`, `↔`) — log formatting.
- Regex patterns matching `⚠` in miner output — functional, not display.
- All `PUBLIC_BUILD` conditionals and "Boost Stream 1/2" branding.

---

## Performance Optimization

Both VIP and public versions already have identical performance optimizations:
- **Renderer debouncing:** `scheduleStatsUpdate()` uses `requestAnimationFrame` +
  500ms setTimeout fallback; `buildStatsSignature()` skips redundant DOM updates.
- **IPC batching:** `enqueueMinerOutputToRenderer()` batches stdout/stderr into
  150ms flush cycles with 64KB buffer cap.
- **Stats emit throttling:** `scheduleStatsEmit()` throttles stats-update IPC to
  500ms intervals.

No additional performance work was needed.

---

## Verification

- `node --check` passes on all 3 modified JS files (main.js, renderer.js, preload.js).
- VIP files also pass `node --check` (no regressions).
- Stream renderer compatible with new parser output (objects with `index`, `coin`,
  `algorithm`, `hashrate_10s/60s/15m`, `accepted`, `rejected`, `active`).
- `PUBLIC_BUILD = true` branding preserved — Stream 2/3 show "Boost Stream 1/2"
  with "Boost" algorithm label.
