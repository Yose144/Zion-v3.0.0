# V3 Rollout Verification Checklist

Use this checklist after any V3 core deployment that changes consensus, block template generation, payout routing, or peer sync behavior.

## 1. Pre-Restart Validation

- confirm the deploy is using `docker/docker-compose.v3-mainnet.yml`, not the older `V3/docker/docker-compose.v3-mainnet.yml`
- confirm the local workspace file being synced is the intended version
- run a local release build of `zion-core`
- verify which files are actually being deployed

## 2. Container Recreation

- sync the target files to every active V3 node
- recreate `core` and `seed1` with `docker compose --env-file .env -f docker/docker-compose.v3-mainnet.yml up -d core seed1`
- confirm `zion-core` is healthy on each node

## 3. Live Env Verification

- inspect the live env of `zion-core`, not just the compose file on disk
- verify required runtime variables are present when payout logic depends on them:
  - `ZION_MINER_ADDRESS`
  - `ZION_HUMANITARIAN_WALLET`
  - `ZION_ISSOBELLA_WALLET`
  - `ZION_POOL_FEE_WALLET`

## 4. Chain Health Verification

- query `getChainInfo` over raw TCP JSON-RPC on every node
- confirm all nodes report the same `chain_height`
- confirm all nodes report the same `tip_hash`
- confirm `active_template_transactions` matches the expected template shape after the rollout

## 5. Proof Block Verification

- wait for at least one new block after the corrected containers are live
- fetch the new block with `getBlockByHeight`
- verify the block fields expected by the rollout are actually populated
- if the change affects coinbase or payout flow, verify transaction count, recipient addresses, and exact amounts
- if the rollout is supposed to enforce split rewards, verify the on-chain sum matches the full subsidy

## 6. Pool and Miner Sanity

- on the primary mining site, inspect recent pool logs for transient restart errors versus sustained rejection patterns
- inspect recent miner logs for reconnect storms, job mismatches, or persistent upstream rejects
- check pool `/stats` and confirm share acceptance recovered after restart

## 7. Cross-Node Audit

- inspect at least one recent core log tail on each non-primary node
- confirm they relay and accept the new blocks without divergence
- confirm there are no repeated sync or validation failures after the rollout

## 8. Required Output

- write a short deployment report under `docs/reports/`
- record root cause if the first rollout attempt did not produce the intended runtime behavior
- include at least one proof block height and its observed result

## Lesson Learned From 2026-03-28

Successful container rebuild is not enough. For V3 mainnet rollout verification, the decisive checks are:

- live `zion-core` env inside the running container
- first post-deploy block contents on-chain
- cross-node `chain_height` and `tip_hash` agreement