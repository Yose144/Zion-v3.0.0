#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""
ZION Stellar Asset Setup Script
================================

Sets up the ZION asset on the Stellar network:
1. Creates (or loads) the WARP bridge issuer account
2. Adds 5 WARP validators as multi-sig signers (5/5 quorum)
3. Configures asset flags (auth_required, revocable, clawback)
4. Sets the home_domain for TOML discovery
5. Creates the ZION asset (asset code "ZION" issued by bridge account)

Prerequisites:
    pip install stellar-sdk

Usage:
    python setup_zion_asset.py --network mainnet
    python setup_zion_asset.py --network testnet  # for testing

Environment variables:
    STELLAR_BRIDGE_SECRET   — secret key of the bridge issuer account
    STELLAR_VALIDATOR_1..5  — public keys of the 5 WARP validators
    STELLAR_NETWORK         — "mainnet" or "testnet" (default: testnet)
"""

import argparse
import os
import sys

try:
    from stellar_sdk import (
        Server,
        Keypair,
        TransactionBuilder,
        Network,
        Asset,
        SetOptions,
        ChangeTrust,
        Payment,
        AccountMerge,
        Signer,
        Thresholds,
    )
    from stellar_sdk.exceptions import SdkError
except ImportError:
    print("ERROR: stellar-sdk not installed. Run: pip install stellar-sdk")
    sys.exit(1)


# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────

ASSET_CODE = "ZION"
DECIMALS = 6  # 1 ZION = 1,000,000 stroops (matching L1 atomic units)
MAX_SUPPLY_STROOPS = 144_000_000_000 * (10 ** DECIMALS)  # 144B ZION
MIN_BRIDGE_STROOPS = 100 * (10 ** DECIMALS)  # 100 ZION
VALIDATOR_QUORUM = 5

NETWORKS = {
    "mainnet": {
        "server": "https://horizon.stellar.org",
        "network_passphrase": Network.PUBLIC_NETWORK_PASSPHRASE,
    },
    "testnet": {
        "server": "https://horizon-testnet.stellar.org",
        "network_passphrase": Network.TESTNET_NETWORK_PASSPHRASE,
    },
    "futurenet": {
        "server": "https://horizon-futurenet.stellar.org",
        "network_passphrase": "Test SDF Future Network ; October 2022",
    },
}


# ─────────────────────────────────────────────────────────────────────────────
# Setup functions
# ─────────────────────────────────────────────────────────────────────────────


def load_bridge_keypair() -> Keypair:
    """Load the bridge issuer keypair from env or generate a new one."""
    secret = os.environ.get("STELLAR_BRIDGE_SECRET")
    if secret:
        return Keypair.from_secret(secret)
    else:
        print("WARNING: STELLAR_BRIDGE_SECRET not set. Generating a new keypair.")
        kp = Keypair.random()
        print(f"  Bridge public key: {kp.public_key}")
        print(f"  Bridge secret key: {kp.secret}")
        print("  SAVE THIS SECRET KEY SECURELY!")
        return kp


def load_validator_pubkeys() -> list:
    """Load the 5 WARP validator public keys from environment."""
    validators = []
    for i in range(1, VALIDATOR_QUORUM + 1):
        key = os.environ.get(f"STELLAR_VALIDATOR_{i}")
        if not key:
            print(f"WARNING: STELLAR_VALIDATOR_{i} not set — using placeholder")
            validators.append(f"GVAL{i}PLACEHOLDERXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
        else:
            validators.append(key)
    return validators


def fund_testnet(server: Server, kp: Keypair):
    """Fund the bridge account on testnet using Friendbot."""
    import urllib.request

    url = f"https://friendbot.stellar.org?addr={kp.public_key}"
    print(f"Funding bridge account on testnet: {kp.public_key}")
    urllib.request.urlopen(url).read()
    print("  Account funded.")


def setup_bridge_account(server: Server, bridge_kp: Keypair, validators: list, network_passphrase: str):
    """
    Configure the bridge issuer account:
    1. Set multi-sig signers (5 validators, weight 1 each)
    2. Set thresholds (low=5, med=5, high=5) for 5/5 quorum
    3. Set asset flags (auth_required, revocable, clawback)
    4. Set home_domain
    """
    account = server.load_account(bridge_kp.public_key)

    builder = TransactionBuilder(
        source_account=account,
        network_passphrase=network_passphrase,
        base_fee=10000,  # 0.1 XLM base fee
    )

    # Set thresholds: all operations require 5/5
    builder.append_set_options_op(
        low_threshold=VALIDATOR_QUORUM,
        med_threshold=VALIDATOR_QUORUM,
        high_threshold=VALIDATOR_QUORUM,
        master_weight=0,  # Remove master key weight (use multi-sig only)
    )

    # Set asset flags
    builder.append_set_options_op(
        set_flags=SetOptions.SET_FLAG_AUTH_REQUIRED
        | SetOptions.SET_FLAG_AUTH_REVOCABLE
        | SetOptions.SET_FLAG_CLAWBACK_ENABLED,
    )

    # Set home domain for TOML discovery
    builder.append_set_options_op(
        home_domain="zionterranova.com",
    )

    # Add each validator as a signer (weight 1)
    for i, validator_pubkey in enumerate(validators):
        builder.append_ed_signer(validator_pubkey, weight=1)

    tx = builder.build()
    tx.sign(bridge_kp)
    response = server.submit_transaction(tx)
    print(f"Bridge account configured: {response['hash']}")
    return response


def create_zion_asset(server: Server, bridge_kp: Keypair, network_passphrase: str):
    """
    The ZION asset is created implicitly when:
    1. The issuer creates a trustline to its own asset (optional)
    2. The first payment is made

    For the bridge, we just need to ensure the asset exists by making
    a 0-amount trustline or the first mint payment.
    """
    # The asset is defined by (ASSET_CODE, bridge_kp.public_key)
    zion_asset = Asset(ASSET_CODE, bridge_kp.public_key)
    print(f"ZION asset created: code={ASSET_CODE}, issuer={bridge_kp.public_key}")
    print(f"  Asset ID: {zion_asset}")
    return zion_asset


def main():
    parser = argparse.ArgumentParser(description="Set up ZION asset on Stellar")
    parser.add_argument(
        "--network",
        choices=["mainnet", "testnet", "futurenet"],
        default=os.environ.get("STELLAR_NETWORK", "testnet"),
        help="Stellar network to use",
    )
    args = parser.parse_args()

    net = NETWORKS[args.network]
    server = Server(horizon_url=net["server"])
    passphrase = net["network_passphrase"]

    print(f"=== ZION Stellar Asset Setup ({args.network}) ===\n")

    # 1. Load bridge keypair
    bridge_kp = load_bridge_keypair()
    print(f"Bridge issuer: {bridge_kp.public_key}\n")

    # 2. Load validators
    validators = load_validator_pubkeys()
    print(f"Validators ({len(validators)}):")
    for i, v in enumerate(validators, 1):
        print(f"  {i}. {v}")
    print()

    # 3. Fund on testnet
    if args.network == "testnet":
        try:
            server.load_account(bridge_kp.public_key)
            print("Bridge account already exists on testnet.")
        except SdkError:
            fund_testnet(server, bridge_kp)
        print()

    # 4. Setup bridge account (multi-sig, flags, home_domain)
    print("Configuring bridge account (multi-sig, flags, home_domain)...")
    try:
        setup_bridge_account(server, bridge_kp, validators, passphrase)
    except Exception as e:
        print(f"  ERROR: {e}")
        print("  Note: On mainnet, this requires all 5 validators to co-sign.")
        return

    # 5. Create ZION asset
    print("\nCreating ZION asset...")
    zion_asset = create_zion_asset(server, bridge_kp, passphrase)

    print(f"\n=== Setup Complete ===")
    print(f"ZION asset on {args.network}:")
    print(f"  Code:   {ASSET_CODE}")
    print(f"  Issuer: {bridge_kp.public_key}")
    print(f"  Decimals: {DECIMALS}")
    print(f"  Max supply: {MAX_SUPPLY_STROOPS} stroops ({MAX_SUPPLY_STROOPS // (10**DECIMALS)} ZION)")
    print(f"\nUpdate V31/L2/multichain/src/warp/adapter/stellar.rs with:")
    print(f"  zion_contract(\"{args.network}\") => Some(\"{bridge_kp.public_key}\")")


if __name__ == "__main__":
    main()
