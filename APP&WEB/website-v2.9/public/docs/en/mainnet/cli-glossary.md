# ZION CLI Glossary

Short explanations for public and beginner users.

## `zion`

Main CLI tool for operating the ZION stack.

## CLI

Command Line Interface. Running commands in a terminal.

## L1

Base blockchain layer: node, pool, miner.

## L2

Upper protocol layer: bridge, DAO, DeFi.

## L3

AI Native, WARP, NCL (orchestration and higher-level coordination).

## Node

Blockchain node process. Stores chain data and serves RPC.

## RPC

Interface used by apps (like web explorer) to read data from node.

## Pool

Server coordinating miners and accepting shares.

## Miner

Process that computes hashes and searches PoW-valid results.

## Wallet

Address and balance management for transactions.

## AI Native

Currently primarily orchestration/control-plane. It does not always imply heavyweight local inference.

## Fallback mode

Service is up but model backend is unavailable. Explicit degraded mode is better than silent failure.

## `zion status`

Quick stack health summary.

## `zion doctor`

Preflight readiness checks: config, endpoints, basic diagnostics.

## `zion logs <service>`

Shows logs for one service (for example `node`, `pool`, `ai-native`).

## `zion deploy`

Deploy/operations command group for server-side actions.

## `zion update`

Updates local CLI binary.

## `zion deploy update`

Updates remote runtime/services on target server.

## Health check

Endpoint/status signal proving service is running correctly.

## Prune

Cleaning unused Docker artifacts (cache, dangling images). Not the first step in incident diagnosis.
