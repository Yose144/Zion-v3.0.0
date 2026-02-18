# 🧠 L3 — Warp & AI Native

> Závisí na L1 + L2. Nezávislé na L4.

L3 vrstva poskytuje cross-chain bridge framework, AI compute marketplace a autonomní agenty.

## Crates

| Crate | Package | LOC | Testů | Popis |
|-------|---------|-----|-------|-------|
| `warp/` | `zion-warp` | 4,859 | 192 | Multi-chain bridge — 7 chain families, fee router |
| `ncl/` | `zion-ncl` | 1,034 | 9 | Neural Compute Layer — task scheduler, 4 backendy |
| `ai-native/` | `zion-ai-native` | 752 | 5 | AI Agent framework — orchestrátor, consciousness, SDK |

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
cargo test -p zion-warp
```
