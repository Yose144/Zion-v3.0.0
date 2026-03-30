# ZION Pool – Yescrypt Mining (Quick Path)

This guide enables CPU mining via Yescrypt against the ZION Universal Pool without Monero/XMRig protocol.

- Why: XMRig requires a Monero-compatible RandomX hashing blob. Until we add the blob builder, use Yescrypt + cpuminer-opt.
- Login: your ZION wallet address as username; set password to `yescrypt` to force the algorithm.

## Pool prerequisites

Pool already supports Yescrypt:
- `create_yescrypt_job()` builds a job from blockchain template/RPC fallback.
- Stratum flow: `mining.subscribe` → `mining.authorize` → `mining.notify` → `mining.submit`.
- Temporary: pool difficulty for Yescrypt is reduced to ~1024 for fast CPU testing.

## Run cpuminer-opt on the server

- Build (Ubuntu/Debian):
```
apt-get update -y
apt-get install -y git build-essential automake libtool pkg-config \
  libcurl4-openssl-dev libjansson-dev libssl-dev libgmp-dev make autoconf
cd /root && git clone https://github.com/JayDDee/cpuminer-opt.git
cd /root/cpuminer-opt && ./build.sh
```

- Start miner (1 thread ≈ 20–25% CPU):
```
cd /root/cpuminer-opt
./cpuminer -a yescrypt -o stratum+tcp://127.0.0.1:3333 \
  -u <YOUR_ZION_WALLET> -p yescrypt -t 1 --api-bind 127.0.0.1:4048
```

Example wallet used in tests: `ZNmRkYqvj8qZwPT7x3L5h9K4N2cX1bW8pQ`.

## Connect from another machine

Replace host with your public IP or domain:
```
./cpuminer -a yescrypt -o stratum+tcp://<PUBLIC_IP_OR_DOMAIN>:3333 \
  -u <YOUR_ZION_WALLET> -p yescrypt -t 2
```

## Verify on pool

- Subscribe/Authorize/Notify appear in pool logs.
- Shares are recorded in SQLite `zion_pool.db`.
- API (if enabled) shows active miners and shares.

## Tuning

- Increase threads with `-t N` based on CPU.
- After validation, increase pool Yescrypt difficulty in `pool_config` back from ~1024 to production values.

## Troubleshooting

- Connection refused: ensure pool is running and port 3333 is open.
- No shares: reduce difficulty or increase threads.
- Invalid shares: ensure password is `yescrypt` so pool sets correct algorithm.

## Next

- Once shares flow, confirm block height progresses and submit a test transaction via node RPC.
- Later, re-enable RandomX path by adding a Monero-compatible hashing blob builder (see `docs/RANDOMX_MONERO_TODO.md`).
