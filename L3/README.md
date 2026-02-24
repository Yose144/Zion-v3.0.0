# 🧠 L3 — Warp & AI Native

> Závisí na L1 + L2. Nezávislé na L4.

L3 vrstva poskytuje cross-chain bridge framework, AI compute marketplace a autonomní agenty.

## Crates

| Crate | Package | LOC | Testů | Popis |
|-------|---------|-----|-------|-------|
| `warp/` | `zion-warp` | 4,859 | 192 | Multi-chain bridge — 7 chain families, fee router |
| `ncl/` | `zion-ncl` | ~1,800 | 34 | Neural Compute Layer — scheduler, reputation, REST API (axum) |
| `ai-native/` | `zion-ai-native` | ~2,200 | 59 | AI Agent framework — orchestrátor, consciousness engine, memory, WARP |

## Dependency graf

```
warp ←── L2/bridge (cross-layer)
ncl  ←── (standalone)
ai-native ←── (standalone)
```

## Build

```bash
cargo check -p zion-warp
cargo check -p zion-ncl
cargo check -p zion-ai-native
cargo test -p zion-ncl
cargo test -p zion-ai-native
# 93 testů, 0 selhání
```

## Dokumentace

Detailní architektonická dokumentace: [`docs/v2.9.6/L3_AI_ARCHITECTURE.md`](../docs/v2.9.6/L3_AI_ARCHITECTURE.md)
