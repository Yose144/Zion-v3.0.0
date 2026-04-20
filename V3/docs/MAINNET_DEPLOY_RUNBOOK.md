# ZION V3 Mainnet Deploy Runbook

Shell-ready rollout procedure for V3 core deploys that affect consensus, block templates, payout routing, or peer sync behavior.

This runbook is based on the live 2026-03-28 fee-split rollout and the failure mode discovered during that deploy.

## 0. Scope

Use this for deploys that touch:

- `V3/L1/core/**`
- `V3/Cargo.toml`
- `docker/docker-compose.v3-mainnet.yml`

Current audited production node set:

- Prague: `91.98.122.165`

Historical note: the 2026-03-28 fee-split rehearsal also covered USA and Singapore, but those nodes are no longer part of the active topology.

## 1. Local Preflight

From repo root:

```bash
cd /Users/yeshuae/Projects/2.9.6

cargo build --release --manifest-path V3/Cargo.toml -p zion-core
```

If the change affects consensus or template logic, also run targeted tests first.

```bash
cd /Users/yeshuae/Projects/2.9.6

cargo test --manifest-path V3/L1/core/Cargo.toml
```

## 2. Deployment Variables

Set the remote repo root once before rollout.

```bash
export REMOTE_DIR="/path/to/deployed/2.9.6"
export NODES="91.98.122.165"
```

For the active Prague deployment, keep `SEED_PEERS` pinned to the Prague primary unless and until a new audited multi-seed set is published.

## 3. Sync Deploy Payload

Sync only the files needed for the rollout.

```bash
cd /Users/yeshuae/Projects/2.9.6

for host in $NODES; do
  rsync -az \
    V3/Cargo.toml \
    V3/L1/core/src/bin/node.rs \
    V3/L1/core/src/discovery.rs \
    V3/L1/core/src/emission.rs \
    V3/L1/core/src/genesis.rs \
    V3/L1/core/src/lib.rs \
    V3/L1/core/src/node_builder.rs \
    V3/L1/core/src/rpc.rs \
    docker/docker-compose.v3-mainnet.yml \
    root@${host}:${REMOTE_DIR}/
done
```

If the rollout touches more files, add them explicitly. Do not assume a full-tree sync is harmless.

## 4. Rebuild and Recreate Core Services

```bash
for host in $NODES; do
  ssh root@${host} "cd ${REMOTE_DIR} && docker compose --env-file .env -f docker/docker-compose.v3-mainnet.yml up -d --build core seed1"
done
```

## 5. Basic Container Health

```bash
for host in $NODES; do
  echo "===== ${host} ====="
  ssh root@${host} "docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'zion-core|zion-seed-1'"
done
```

## 6. Live Env Verification Inside zion-core

Do not stop at checking the compose file on disk. Verify the running container environment.

```bash
for host in $NODES; do
  echo "===== ${host} ====="
  ssh root@${host} "docker exec zion-core env | grep '^ZION_' | grep -E 'MINER_ADDRESS|HUMANITARIAN_WALLET|ISSOBELLA_WALLET|POOL_FEE_WALLET'"
done
```

Expected for fee-split deploys:

- `ZION_MINER_ADDRESS`
- `ZION_HUMANITARIAN_WALLET`
- `ZION_ISSOBELLA_WALLET`
- `ZION_POOL_FEE_WALLET`

Also verify `ZION_SEED_PEERS` matches the currently audited bootstrap set. As of 2026-04-20 that means Prague-only.

## 7. Chain Health

Use raw TCP JSON-RPC on port `8443`.

```bash
for host in $NODES; do
  echo "===== ${host} ====="
  ssh root@${host} "printf '%s\n' '{\"jsonrpc\":\"2.0\",\"method\":\"getChainInfo\",\"params\":[],\"id\":1}' | nc -w 2 127.0.0.1 8443"
done
```

Confirm the deployed node reports coherent:

- `chain_height`
- `tip_hash`

## 8. Wait For First New Block

Use Prague as the primary observation point.

```bash
ssh root@91.98.122.165 '
last=$(printf "%s\n" "{\"jsonrpc\":\"2.0\",\"method\":\"getChainInfo\",\"params\":[],\"id\":1}" | nc -w 2 127.0.0.1 8443 | python3 -c "import sys,json; print(json.load(sys.stdin)[\"result\"][\"chain_height\"])")
echo "starting_height=${last}"
while true; do
  current=$(printf "%s\n" "{\"jsonrpc\":\"2.0\",\"method\":\"getChainInfo\",\"params\":[],\"id\":1}" | nc -w 2 127.0.0.1 8443 | python3 -c "import sys,json; print(json.load(sys.stdin)[\"result\"][\"chain_height\"])")
  if [ "$current" -gt "$last" ]; then
    echo "new_height=${current}"
    break
  fi
  sleep 5
done
'
```

## 9. Proof Block Verification

Replace `HEIGHT` with the first new block height observed after deploy.

```bash
export HEIGHT=465

ssh root@91.98.122.165 "printf '%s\n' '{\"jsonrpc\":\"2.0\",\"method\":\"getBlockByHeight\",\"params\":[${HEIGHT}],\"id\":1}' | nc -w 2 127.0.0.1 8443"
```

For fee-split rollouts, verify in the returned block:

- `humanitarian_address` is populated
- `issobella_address` is populated
- `pool_fee_address` is populated
- there are 4 coinbase transactions
- the amounts sum exactly to `subsidy_zion`

Expected 2026-03-28 split example:

- miner: `4806059630000000`
- humanitarian: `270003350000000`
- issobella: `270003350000000`
- pool fee: `54000670000000`

## 10. Primary Pool and Miner Sanity

Prague primary host:

```bash
ssh root@91.98.122.165 "docker logs --since 20m zion-pool | tail -120"
ssh root@91.98.122.165 "docker logs --since 20m zion-miner | tail -120"
ssh root@91.98.122.165 "curl -s http://127.0.0.1:8080/stats"
```

Acceptable immediately after restart:

- one transient upstream RPC refusal
- one transient reconnect loop
- isolated `UpstreamRejected` or `JobMismatch`

Not acceptable:

- sustained reject pattern
- no accepted shares after restart recovery window
- pool stats not moving

## 11. Historical Multi-Node Audit

The original USA/Singapore checks remain relevant only when a new multi-node expansion is deliberately reintroduced. Do not treat them as part of the active production rollout.

## 12. Release Criteria For This Rollout

The rollout is considered successful only if all of the following are true:

- `zion-core` is healthy on the audited Prague production node
- live env inside `zion-core` contains the intended runtime variables
- Prague reports coherent `chain_height` and `tip_hash` over raw TCP JSON-RPC
- at least one post-deploy block proves the intended runtime behavior on-chain
- Prague pool resumes accepted share flow after restart
- any future non-Prague nodes are explicitly re-audited before they are considered part of production

## 13. Failure Pattern Learned On 2026-03-28

The first rollout attempt rebuilt successfully but still produced legacy single-output coinbase blocks.

Root cause:

- server-side `docker/docker-compose.v3-mainnet.yml` was stale
- fee-wallet env vars existed for `pool` but not for `core`
- `zion-core` therefore booted only with `ZION_MINER_ADDRESS`

Mandatory lesson:

- never treat successful container recreation as proof of runtime correctness
- always inspect live `zion-core` env and the first new block after deploy

## 14. V3 L2 Profile Rollout (Bridge / Swap / DAO)

Use this section after core rollout is stable when enabling or updating L2 services.

### 14.1 Prepare L2 profile env

On the deployment host, create profile env from template:

```bash
cd /path/to/deployed/2.9.6
cp -n V3/docker/.env.l2.example V3/docker/.env.l2
```

Set at minimum:

- `ZION_BRIDGE_CONFIG`
- `ZION_SWAP_CONFIG`
- `ZION_DAO_CONFIG`
- `ZION_SWAP_ESCROW_KEY`
- `ZION_VALIDATOR_PRIVATE_KEY`

For multisig fan-in and core-side proof verification also set:

- `ZION_VALIDATOR_EXTRA_KEYS` / `ZION_VALIDATOR_EXTRA_IDS` (bridge relayer side)
- `ZION_BRIDGE_VALIDATOR_PUBKEYS` / `ZION_BRIDGE_VALIDATOR_THRESHOLD` (core side)

### 14.2 Start L2 stack

```bash
cd /path/to/deployed/2.9.6
docker compose --env-file V3/docker/.env.l2 -f V3/docker/docker-compose.v3-l2.yml up -d --build
```

### 14.3 Verify container health

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'zion-v3-bridge|zion-v3-swap|zion-v3-dao'
```

Health endpoints:

- Bridge: `http://127.0.0.1:9100/health`
- Swap: `http://127.0.0.1:8888/health`
- DAO: `http://127.0.0.1:8081/api/dao/health`

Quick checks:

```bash
curl -fsS http://127.0.0.1:9100/health
curl -fsS http://127.0.0.1:8888/health
curl -fsS http://127.0.0.1:8081/api/dao/health
```

### 14.4 Rollback (L2 only)

```bash
cd /path/to/deployed/2.9.6
docker compose --env-file V3/docker/.env.l2 -f V3/docker/docker-compose.v3-l2.yml down
```

If needed, restore prior env profile and start again:

```bash
docker compose --env-file V3/docker/.env.l2 -f V3/docker/docker-compose.v3-l2.yml up -d
```