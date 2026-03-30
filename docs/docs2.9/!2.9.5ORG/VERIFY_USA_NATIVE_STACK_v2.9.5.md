# ✅ Verify: USA Parallel Native Stack (v2.9.5)

This is the **as-run verification checklist** for the Docker-only `zion-native` v2.9.5 node stack deployed on the USA server.

## Canonical ports

- **Stratum (pool)**: `127.0.0.1:3333`
- **Pool HTTP (stats/metrics)**: `http://127.0.0.1:8080`
- **Core JSON-RPC**: `http://127.0.0.1:8444/jsonrpc`
- **Redis**: internal (no host port mapping required)

## 1) Confirm containers are up

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | egrep "zion-(pool|core|redis)"
```

## 2) Pool HTTP: stats + metrics

```bash
# stats (shape may vary by build)
curl -fsS http://127.0.0.1:8080/stats || true

# prometheus metrics
curl -fsS http://127.0.0.1:8080/metrics | egrep "^(shares|ncl)_" || true
```

Expected: `shares_accepted_total` increases during mining; NCL counters (`ncl_*`) increase during NCL loop.

## 3) NCL smoke test (Python)

Server uses Ubuntu with PEP 668; install deps via venv.

```bash
# one-time (if not already present)
apt-get update -y
apt-get install -y python3-venv
python3 -m venv /root/ncl-venv
/root/ncl-venv/bin/pip install --upgrade pip
/root/ncl-venv/bin/pip install blake3==1.0.6

# run smoke (example uses Stratum 3333)
/root/ncl-venv/bin/python /root/ncl_smoke.py --host 127.0.0.1 --port 3333

# verify metrics bump
curl -fsS http://127.0.0.1:8080/metrics | egrep "^ncl_" || true
```

Expected: `ncl.submit` returns accepted and `ncl_tasks_accepted_total` increments.

Repo copy of the script: [2.9.5/zion-native/ncl_smoke.py](2.9.5/zion-native/ncl_smoke.py)

## 3b) Repo E2E (HTTP + Stratum + NCL)

If you want a single **end-to-end proof** (HTTP + Stratum + deterministic NCL accept), run the repo E2E script from your workstation:

```bash
cd /Users/yeshuae/Desktop/ZION/Zion-2.9-main

# one-time dependency in your local venv:
pip install blake3

python 2.9.5/tests/e2e_native_pool_test.py \
  --host 5.78.145.234 \
  --stratum-port 3333 \
  --api-port 8080
```

Expected: `HTTP OK`, `STRATUM OK`, `NCL OK`.

## 4) Long-running NCL loop (Rust universal miner)

### Build (no host Rust required)
If the server has no `cargo`, build using a Rust Docker image:

```bash
cd /root/zion-2.9.5/zion-universal-miner

docker run --rm \
  -v "$PWD:/work" \
  -v /root/zion-2.9.5/zion-native:/zion-native \
  -w /work \
  rust:latest \
  bash -lc 'export PATH=/usr/local/cargo/bin:$PATH; apt-get update -y >/dev/null; DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends cmake pkg-config build-essential libssl-dev >/dev/null; cargo build --release'
```

### Run (background)

```bash
mkdir -p /root/zion-2.9.5/logs

nohup /root/zion-2.9.5/zion-universal-miner/target/release/zion-universal-miner \
  --pool stratum+tcp://127.0.0.1:3333 \
  --wallet zion1q893q6c5j7y0e3r062g4m7c240t5g294k7z6729 \
  --worker ncl-loop-usa \
  --threads 0 \
  --algorithm cosmic_harmony \
  --ncl \
  --ncl-allocation 0.3 \
  --debug \
  > /root/zion-2.9.5/logs/universal-miner-ncl.log 2>&1 &

echo $! > /root/zion-2.9.5/logs/universal-miner-ncl.pid
```

### Observe

```bash
PID=$(cat /root/zion-2.9.5/logs/universal-miner-ncl.pid)
ps -p "$PID" -o pid,etimes,cmd

tail -n 50 /root/zion-2.9.5/logs/universal-miner-ncl.log

curl -fsS http://127.0.0.1:8080/metrics | egrep "^(shares|ncl)_" || true
```

Expected:
- Miner log shows `✅ NCL task accepted: <task_id>` periodically
- `ncl_tasks_created_total`, `ncl_tasks_submitted_total`, `ncl_tasks_accepted_total` increase over time

### Stop

```bash
kill $(cat /root/zion-2.9.5/logs/universal-miner-ncl.pid)
```

## 5) Leave 1 miner running (monitoring)

If you keep one miner running for observation, these are the practical checks:

```bash
# process health
PID=$(cat /root/zion-2.9.5/logs/universal-miner-ncl.pid)
ps -p "$PID" -o pid,etimes,cmd

# tail logs
tail -n 80 /root/zion-2.9.5/logs/universal-miner-ncl.log

# quick metrics snapshot
curl -fsS http://127.0.0.1:18181/metrics | egrep "^(shares|ncl)_" || true

# live-ish metrics (portable, no 'watch' required)
while true; do date -u; curl -fsS http://127.0.0.1:18181/metrics | egrep "^(shares|ncl)_" || true; echo; sleep 10; done
```
