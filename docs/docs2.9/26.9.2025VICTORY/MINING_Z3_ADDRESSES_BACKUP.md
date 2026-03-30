# ZION Mining Z3 Addresses Backup
**Generated:** 26. září 2025
**Purpose:** Mining test addresses with new Z3 prefix

## Mining Address 1
**Address:** Z3222ywic7fGUZHv9EfFwEKf1VJRrEqPbLrHgRiBb43LWaS1Cz2gVwgdF2kvUPsGb9jSvUUf31oNCSZgNEtUiGDT4sBLtXmGzc
**View Key:** 03c93a57dc3a57cd54d04de174c5df5086ca17b98725e3e0fcba78fcdc7fc50a
**Wallet File:** /tmp/mining_wallet_1.dat (in zion-seed1 container)
**Password:** mining123
**Label:** Mining1

## Mining Address 2
**Address:** Z321beMixJMZVt2fcz3xGHLSM1GUDhxkwHuJdtZGnGSjEHqBvpzdEvWWuFGUfw5KwshZubxjWsox96eirYdFaMPq8kRdxenj5d
**View Key:** 29e951aca0ed8388023377620d062e01ea2fcb3a2cc98733ab3e6b5cae897a0f
**Wallet File:** /tmp/mining_wallet_2.dat (in zion-seed1 container)
**Password:** mining456
**Label:** Mining2

## Validation
- ✅ Both addresses start with Z3 prefix (correct)
- ✅ Address format matches new CryptoNote config (0x433F)
- ✅ View keys generated successfully
- ✅ Wallet files saved in container

## Usage Notes
- Use Mining Address 1 for primary mining test
- Use Mining Address 2 for secondary/backup mining
- Both addresses ready for XMRig configuration
- Wallet files persist in container temp directory

## Next Steps
1. Configure XMRig with Mining Address 1
2. Test mining connection to port 3333
3. Monitor block generation and payouts
4. Validate Z3 address compatibility in payout flow

---
**CRITICAL:** These are test addresses - backup securely before mainnet use!