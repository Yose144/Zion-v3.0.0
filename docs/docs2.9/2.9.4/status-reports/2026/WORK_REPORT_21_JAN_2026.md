# WORK REPORT — 21 Jan 2026 (CHv3 Pools)

## Kontext
Cíl byl stabilizovat a ověřit Cosmic Harmony v3 (CHv3) mining end-to-end v pool stacku: korektní validace share, stabilní nativní hash knihovna na různých CPU architekturách a dlouhodobější cross-server těžba pro ověření bloků/payout pipeline.

## Hotovo
- Stabilizace CHv3 share validace (XMRig kompatibilita):
  - Target parsing: job `target` jako 64-bit little-endian (16 hex) → derivace `target32 = target64 >> 32`.
  - Share check: porovnání `state0` (z prvních 4 bytů hashe) vůči `target32`.
- Cross-server mining (server→server) pro validaci provozu:
  - Nasazení lite mineru ve style XMRig JSON-RPC (`login`, `job`, `submit`) přímo do pool kontejnerů.
  - Ověřeno přes pool stats endpointy, že minerům rostou accepted shares.
- Oprava nestability na x86 (SIGILL/invalid opcode):
  - Root-cause: BLAKE3 runtime dispatch vybral AVX512 cestu, ale binárka měla stuby (`ud2`) → crash.
  - Nasazena kompatibilní CH knihovna (build s kompletními SIMD variantami / nebo bezpečný fallback).

## Změny v repo
- [tools/mining_scripts/chv3_lite_miner.py](tools/mining_scripts/chv3_lite_miner.py)
  - Lite miner pro CHv3: stabilnější submitování přes XMRig session id z login response (`result.id`).
  - Cache job blob/target per `job_id` a ochrana proti stale submitu (re-check jobu před submitem).
  - Přidána metrika `stale_skip` do logů (ASCII-only výstup pro snadné grepování).
- [zion/mining/build_cosmic_harmony_ubuntu.sh](zion/mining/build_cosmic_harmony_ubuntu.sh)
  - Upravena build logika BLAKE3 tak, aby se předešlo runtime SIGILL při nekompletní AVX512 kompilaci (safe fallback / disable AVX512 dispatch pokud AVX512 object nevznikne).

## Stav ověření bloků/payout
- Shares se akceptují a metriky rostou.
- `/blocks` a `/payouts` v době kontroly vracely `count: 0` (zatím bez nalezených bloků / payoutů).
- Další krok pro zvýšení šance na blok:
  - nechat minery běžet delší dobu / přidat hashrate,
  - případně použít test konfiguraci se sníženou obtížností (jen pro testnet/smoke ověření pipeline),
  - a paralelně ověřit, že backend komponenty (block template, submit block, payout scheduler) jsou aktivní.

## Poznámky
- Rozdílné architektury serverů (aarch64 vs x86_64) vyžadují odpovídající nativní knihovny a opatrnost u SIMD dispatch.
