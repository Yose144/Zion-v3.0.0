# ROOT MD DEDUP — 2026-01-20

## What happened
Root-level `*.md` files were duplicated: the same markdown documents existed both in repo root and in `docs/2.9.3/root-md/`.

## Decision
Canonical location is `docs/2.9.3/root-md/`.

## Action taken
- Verified that every root `*.md` (except `README.md`) already existed in `docs/2.9.3/root-md/`.
- Deleted 42 duplicate root `*.md` files (kept `README.md` in root).

## Result
Repo root is clean from extra markdown files; documentation lives under `docs/2.9.3/root-md/`.
