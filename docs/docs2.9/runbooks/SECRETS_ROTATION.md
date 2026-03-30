# Secrets Rotation Guide

This guide covers rotating:
- ADAPTER_API_KEY
- BITCOIN_RPCUSER / BITCOIN_RPCPASSWORD
- LND macaroons/TLS (if applicable)

## General Principles
- Generate high-entropy secrets
- Store in secure vaults
- Roll gradually with overlap when possible

## Wallet Adapter API Key
1) Generate a new value and set `ADAPTER_API_KEY` in `.env`
2) Reload adapter (docker compose up -d or restart service)
3) Update reverse proxy to inject the new key
4) Deprecate old key and remove from all locations

## Bitcoin RPC Credentials
1) Generate new `BITCOIN_RPCUSER`/`BITCOIN_RPCPASSWORD` in `.env`
2) Restart bitcoind and lnd services to apply
3) Confirm `lncli getinfo` works
4) Remove old credentials from vaults/notes

## LND macaroons/TLS (optional)
- Follow LND docs to rotate admin/invoice macaroons and TLS certs
- Update consuming services with new certificates/credentials
