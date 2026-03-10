# ZION 2.9.6 Workspace Instructions

## Scope

These instructions apply to the whole repository. Prefer more specific file-level instructions when available.

## Repo Shape

- This is a multi-layer monorepo. L1 contains chain, miner, pool, and hashing crates. APP&WEB contains the Electron desktop agent, mobile app, and website.
- Server deployment source-of-truth lives in docker/ and scripts/. Do not patch live server state conceptually without updating these files too.
- There are often unrelated frontend changes in the working tree. Avoid touching APP&WEB website files unless the task requires them.

## Default Workflow

- Explore the relevant area first. Do not assume whether a request is about core Rust, miner runtime, desktop agent, or website.
- Prefer minimal fixes that preserve current behavior and release intent.
- If a task changes deployment behavior, update both compose and automation scripts when needed.
- If a task changes consensus, mining, or pool behavior, look for matching tests and stale assumptions before editing runtime code.

## Validation

- For Rust miner/core/pool changes, prefer targeted cargo test or cargo test --no-run before broad workspace validation.
- For desktop agent JavaScript changes, run node --check on APP&WEB/desktop-agent/src/main.js when that file changes.
- For desktop agent Python mining fallback changes, run python3 -m py_compile on the touched Python miner files.
- scripts/autopilot-2.9.8.sh already encodes the expected validation sequence for miner and desktop-agent deploy readiness; follow it unless the task explicitly needs a different path.

## Release Context

- Current live network focus is v2.9.8 Deeksha canonical path.
- Desktop-agent package metadata can lag runtime behavior. Do not bump version strings just because runtime code changed unless the task is explicitly about packaging or release alignment.

## Editing Guidance

- Keep operational fixes boring and auditable.
- Do not mix infra fixes with unrelated website cleanup in the same change.
- When changing pool/miner identity behavior, watch for worker names, wallet reuse, nonce partitioning, and other sources of duplicate share patterns.