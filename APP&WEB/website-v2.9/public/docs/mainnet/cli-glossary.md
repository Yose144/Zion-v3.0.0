# ZION CLI Glossary

Brief explanations for the public and newcomers.

## `zion`

The main CLI tool for controlling the ZION stack.

## CLI

Command Line Interface. Commands in the terminal.

## L1

Base blockchain layer: node, pool, miner.

## L2

Layer-2 protocols: bridge, DAO, DeFi.

## L3

AI Native, WARP, NCL (orchestration and higher coordination layer).

## Node

Blockchain node. Holds chain data and provides RPC.

## RPC

Interface through which applications (e.g. web explorer) read data from the node.

## Pool

Server that coordinates miners and accepts shares.

## Miner

Process that computes hashes and looks for valid PoW results.

## Wallet

Wallet for addresses, balance and transactions.

## AI Native

Currently mainly an orchestration / control-plane layer. It does not have to mean a heavy local inference backend.

## Fallback mode

The service is running, but the model backend is unavailable. Transparent degradation is better than a silent crash.

## `zion status`

Quick summary of stack health.

## `zion doctor`

Preflight readiness check: config, endpoints, basic diagnostics.

## `zion logs <service>`

Prints logs for a specific service (e.g. `node`, `pool`, `ai-native`).

## `zion deploy`

Set of commands for deployment and operational actions on the server.

## `zion update`

Update of the local CLI binary.

## `zion deploy update`

Update of remote runtime / services on the server.

## Health check

Check endpoint / service that confirms the application is running.

## Prune

Cleaning unused Docker artifacts (cache, dangling images). It is not the first step of incident diagnosis.
