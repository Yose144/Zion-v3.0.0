# Migration Plan — ZION v2.9.8 (Cosmic Harmony Deeksha)

## Fáze A — Spec freeze (1 den)

1. Označit `COSMIC_HARMONY_DEEKSHA_SPEC.md` jako jediný canonical source.
2. Zapsat finální consensus konstanty (64KiB/2/64).
3. Definovat jedinou activation policy konstantu.

Deliverable:
- docs freeze commit + sign-off (Lead Dev + Infra).

## Fáze B — Kódové sjednocení (2–3 dny)

1. Sloučit dispatch na jedinou canonical větev `cosmic_harmony`.
2. Nechat CHv4.2 advanced profil pouze feature-gated (non-default).
3. Sjednotit parser aliasů v miner/pool/core.
4. Odstranit duplicity v desktop-agent CHv4 fast-path vs CH3 flow.

Deliverable:
- jednotný runtime flow v pool/miner/agent.

## Fáze C — Revenue hardening (1–2 dny)

1. Ověřit CPU + GPU revenue parity pro Deeksha start path.
2. Opravit reconnect/retry flow (pool i miner).
3. Přidat smoke testy start/stop/restart pro revenue procesy.

Deliverable:
- revenue parity report + test output.

## Fáze D — Canary (72h)

Měřit:
- share acceptance/reject ratio,
- stale/orphan trend,
- reconnect incidence,
- hashrate stabilitu (median + p95),
- CPU/GPU usage drift.

Go/no-go:
- reject storm = NO-GO,
- chain divergence = NO-GO,
- nestabilní pool loop = NO-GO.

## Fáze E — Release 2.9.8

1. Tag + changelog.
2. Unified docs refresh (odstranit staré contradictory tabulky).
3. rollout hel/usa/asia + post-deploy check.

---

## Rychlé doporučení (praktické)

Pro 2.9.8 jít co nejjednodušší cestou:
- jeden algo profil (Deeksha),
- stejný revenue systém jako CHv3,
- NPU pouze deterministická akcelerace,
- žádné nové consensus experimenty do release branch.
