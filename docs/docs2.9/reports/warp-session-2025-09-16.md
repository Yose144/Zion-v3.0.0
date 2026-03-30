# Warp Session Log – 2025-09-16

Environment
- Host: macOS
- Shell: zsh 5.9
- PWD: /Users/yose/Zion

Summary timeline
1) Repo sync and build
   - Checked git remote, fetched, built Release via CMake
   - Initialized submodule RandomX
   - Ran test suite (daemon, wallet, miner smoke)
2) Genesis
   - Computed genesis hash via zion_genesis and updated config/mainnet.conf
3) First run
   - Started ziond with mainnet.conf
   - Started zion_miner with 4 threads (light)
4) Pool client + hashrate (initial)
   - Implemented minimal TCP GETWORK/SUBMIT client in miner
   - Added basic hashrate reporting
5) Multi-threaded pool mining
   - Added job fetcher + N workers (nonce stride)
   - Extended Block::mine(start, step, max_attempts, attempts_out)
6) Stratum-like protocol
   - Pool server: JSON-RPC login/getjob/submit
   - Miner: login/getjob/submit client, user/pass, payout address
   - Tuned CHUNK and added mobile flag
7) Auth + extranonce
   - Pool: optional password auth, login returns extranonce; getjob includes extranonce
   - Miner: --user/--pass, --mobile; parsed extranonce
8) Per-thread stats
   - Miner prints per-thread H/s and accepted/rejected counters every 10s
   - Mobile CHUNK smaller; extranonce tag added to coinbase as 0-amount output
9) Seed/Pool/Peer guidance
   - Provided cloud provider recommendations and setup steps (systemd/UFW/DNS)
10) Stop
   - Terminated local miner and daemon

Key commands (local)
- cmake -S . -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build -j
- ./build/zion_genesis ./config/mainnet.conf
- ./build/ziond --config=./config/mainnet.conf
- ./build/zion_miner --threads 4 --light
- ./build/zion_miner --pool 127.0.0.1:3333 --threads 4 --light [--user USER --pass PASS] --address <PUBKEY_HEX>

Important files touched
- src/mining/miner.cpp
- src/core/block.cpp
- src/network/pool.cpp, include/network/pool.h
- src/daemon/main.cpp
- src/core/config.cpp, include/config.h
- config/mainnet.conf
- .warp/workflows.yaml

Commits (most recent first)
- 61f1509 feat(miner): per-thread stats (H/s, A/R), mobile CHUNK, extranonce tag in coinbase; fix atomics
- 6c8724a feat(pool): add extranonce to getjob; feat(miner): auth flags, mobile flag; minor adjustments
- a5aa6ec feat(pool+miner): add auth (user/pass), extranonce in login, mobile-friendly flags; refine job fetching; config options for auth
- b5a59e1 feat(miner+pool): stratum-like pool, multi-threaded miner, payout, accurate H/s; tune CHUNK; set genesis_hash/difficulty
- 29e8c16 chore(warp): add Warp Workflows for cloud sync (baseline)

Pool JSON-RPC (overview)
- login: {"login":"worker","pass":"p","agent":"zion-miner/1.0"} -> result {job_id, prev_hash, target_bits, height, extranonce}
- getjob: {} -> result {job_id, prev_hash, target_bits, height, extranonce}
- submit: {job_id, nonce, result=block_hex} -> result "OK"/"REJECTED"

Miner CLI (current)
- --threads N, --light
- --pool host:port
- --user USER, --pass PASS
- --address <64hex public key>
- --mobile (tunes CHUNK and suggests low thread count)

Notes / Next steps (planned)
- Optional HTTP /status endpoint for web dashboard
- Extract miner core as C library for mobile (RN/Flutter) bindings
- Next.js site skeleton (status/docs/downloads)
- Docker templates for seed/pool

Session end
- Local processes stopped; repo pushed and up to date.
