# ZION V3 Mainnet Deploy Runbook

> **Aktuální topologie:** Core + Edge (Hetzner VPS). Historické multi-server reference (Prague, USA, Singapore) v tomto runbooku byly aktualizovány na Core + Edge. Postup zůstává platný.

Shell-ready rollout procedure for V3 core deploys that affect consensus, block templates, payout routing, or peer sync behavior.

This runbook is based on the live 2026-03-28 fee-split rollout and the failure mode discovered during that deploy.

## 0. Scope

Use this for deploys that touch:

- `V3/L1/core/**`
- `V3/Cargo.toml`
- `docker/docker-compose.v3-mainnet.yml`

Current live topology:

- **Core:** Windows 11 node (Tailscale `100.86.102.5`)
- **Edge:** Hetzner VPS relay (Tailscale `100.76.16.108`, public `77.42.71.94`)

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
export NODES="100.76.16.108 77.42.71.94"
```

For audited fleet nodes, write `SEED_PEERS` per host and exclude the host's own public address. Fresh external nodes can still bootstrap from the full public list.

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

Also verify `ZION_SEED_PEERS` does not include the current host's own public `host:8333` entry when deploying the Core + Edge fleet.

## 7. Cross-Node Chain Health

Use raw TCP JSON-RPC on port `8443`.

```bash
for host in $NODES; do
  echo "===== ${host} ====="
  ssh root@${host} "printf '%s\n' '{\"jsonrpc\":\"2.0\",\"method\":\"getChainInfo\",\"params\":[],\"id\":1}' | nc -w 2 127.0.0.1 8443"
done
```

Confirm all nodes agree on:

- `chain_height`
- `tip_hash`

## 8. Wait For First New Block

Use Edge as the primary observation point.

```bash
ssh root@100.76.16.108 '
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

ssh root@100.76.16.108 "printf '%s\n' '{\"jsonrpc\":\"2.0\",\"method\":\"getBlockByHeight\",\"params\":[${HEIGHT}],\"id\":1}' | nc -w 2 127.0.0.1 8443"
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

Edge primary host:

```bash
ssh root@100.76.16.108 "docker logs --since 20m zion-pool | tail -120"
ssh root@100.76.16.108 "docker logs --since 20m zion-miner | tail -120"
ssh root@100.76.16.108 "curl -s http://127.0.0.1:8080/stats"
```

Acceptable immediately after restart:

- one transient upstream RPC refusal
- one transient reconnect loop
- isolated `UpstreamRejected` or `JobMismatch`

Not acceptable:

- sustained reject pattern
- no accepted shares after restart recovery window
- pool stats not moving

## 11. Non-Primary Node Audit

USA:

```bash
ssh root@5.78.194.94 "docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'zion-core|zion-seed-1'"
ssh root@5.78.194.94 "docker logs --since 20m zion-core | tail -120"
ssh root@5.78.194.94 "printf '%s\n' '{\"jsonrpc\":\"2.0\",\"method\":\"getChainInfo\",\"params\":[],\"id\":1}' | nc -w 2 127.0.0.1 8443"
```

Singapore:

```bash
ssh root@5.223.84.191 "docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'zion-core|zion-seed-1'"
ssh root@5.223.84.191 "docker logs --since 20m zion-core | tail -120"
ssh root@5.223.84.191 "printf '%s\n' '{\"jsonrpc\":\"2.0\",\"method\":\"getChainInfo\",\"params\":[],\"id\":1}' | nc -w 2 127.0.0.1 8443"
```

## 12. Release Criteria For This Rollout

The rollout is considered successful only if all of the following are true:

- `zion-core` is healthy on every audited node
- live env inside `zion-core` contains the intended runtime variables
- all audited nodes agree on `chain_height` and `tip_hash`
- at least one post-deploy block proves the intended runtime behavior on-chain
- Edge pool resumes accepted share flow after restart
- Core and Edge accept and relay the updated blocks without divergence

## 13. Failure Pattern Learned On 2026-03-28

The first rollout attempt rebuilt successfully but still produced legacy single-output coinbase blocks.

Root cause:

- server-side `docker/docker-compose.v3-mainnet.yml` was stale
- fee-wallet env vars existed for `pool` but not for `core`
- `zion-core` therefore booted only with `ZION_MINER_ADDRESS`

Mandatory lesson:

- never treat successful container recreation as proof of runtime correctness
- always inspect live `zion-core` env and the first new block after deploy