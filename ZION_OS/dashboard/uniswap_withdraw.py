#!/usr/bin/env python3
"""Withdraw 3 Uniswap V3 NFT positions using correct tuple ABI."""
import time
from web3 import Web3
from eth_account import Account

RPC = "https://base.publicnode.com"
NPM_ADDR = Web3.to_checksum_address("0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1")
DEPLOYER_ADDR = "0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186"
KEY_FILE = "/root/zion-validator-key.env"

POSITIONS_TO_WITHDRAW = [
    (4901417, "wZION/WETH 0.3% OLD (full range)"),
    (5431091, "wZION/USDC 0.3% (single-sided)"),
    (5431093, "wZION/WETH 1.0% (single-sided)"),
]

MAX_UINT128 = 2**128 - 1

NPM_ABI = [
    {
        "inputs": [{"components": [
            {"name": "tokenId", "type": "uint256"},
            {"name": "liquidity", "type": "uint128"},
            {"name": "amount0Min", "type": "uint256"},
            {"name": "amount1Min", "type": "uint256"},
            {"name": "deadline", "type": "uint256"},
        ], "name": "params", "type": "tuple"}],
        "name": "decreaseLiquidity",
        "outputs": [{"name": "amount0", "type": "uint256"}, {"name": "amount1", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [{"components": [
            {"name": "tokenId", "type": "uint256"},
            {"name": "recipient", "type": "address"},
            {"name": "amount0Max", "type": "uint128"},
            {"name": "amount1Max", "type": "uint128"},
        ], "name": "params", "type": "tuple"}],
        "name": "collect",
        "outputs": [{"name": "amount0", "type": "uint256"}, {"name": "amount1", "type": "uint256"}],
        "stateMutability": "payable",
        "type": "function",
    },
    {"inputs": [{"name": "tokenId", "type": "uint256"}], "name": "burn", "outputs": [], "stateMutability": "nonpayable", "type": "function"},
    {"inputs": [{"name": "tokenId", "type": "uint256"}], "name": "positions", "outputs": [{"name": "nonce", "type": "uint96"}, {"name": "operator", "type": "address"}, {"name": "token0", "type": "address"}, {"name": "token1", "type": "address"}, {"name": "fee", "type": "uint24"}, {"name": "tickLower", "type": "int24"}, {"name": "tickUpper", "type": "int24"}, {"name": "liquidity", "type": "uint128"}, {"name": "feeGrowthInside0LastX128", "type": "uint256"}, {"name": "feeGrowthInside1LastX128", "type": "uint256"}, {"name": "tokensOwed0", "type": "uint128"}, {"name": "tokensOwed1", "type": "uint128"}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"name": "owner", "type": "address"}], "name": "balanceOf", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"name": "owner", "type": "address"}, {"name": "index", "type": "uint256"}], "name": "tokenOfOwnerByIndex", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
]

ERC20_ABI = [
    {"inputs": [{"name": "account", "type": "address"}], "name": "balanceOf", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
]


def load_key():
    with open(KEY_FILE) as f:
        for line in f:
            if line.startswith("ZION_VALIDATOR_PRIVATE_KEY="):
                return line.split("=", 1)[1].strip()
    raise RuntimeError("Deployer key not found")


def send_tx(w3, account, fn, gas_limit=400000, value=0):
    nonce = w3.eth.get_transaction_count(account.address)
    tx = fn.build_transaction({
        "from": account.address,
        "nonce": nonce,
        "gas": gas_limit,
        "gasPrice": w3.eth.gas_price,
        "chainId": w3.eth.chain_id,
        "value": value,
    })
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    return tx_hash, receipt


def main():
    w3 = Web3(Web3.HTTPProvider(RPC))
    private_key = load_key()
    account = Account.from_key(private_key)
    assert account.address.lower() == DEPLOYER_ADDR.lower()

    print(f"Deployer: {account.address}")
    print(f"ETH balance: {w3.eth.get_balance(account.address) / 1e18:.6f} ETH")

    npm = w3.eth.contract(address=NPM_ADDR, abi=NPM_ABI)
    WZION = Web3.to_checksum_address("0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6")
    wzion_c = w3.eth.contract(address=WZION, abi=ERC20_ABI)
    wzion_before = wzion_c.functions.balanceOf(account.address).call()
    print(f"wZION before: {wzion_before / 1e18:,.6f}")
    print()

    for token_id, label in POSITIONS_TO_WITHDRAW:
        print(f"=== NFT #{token_id}: {label} ===")
        try:
            pos = npm.functions.positions(token_id).call()
            liquidity = pos[7]
            print(f"  liquidity={liquidity}")

            if liquidity > 0:
                block = w3.eth.get_block("latest")
                deadline = block.timestamp + 600
                print(f"  Step 1: decreaseLiquidity...")
                fn = npm.functions.decreaseLiquidity((token_id, liquidity, 0, 0, deadline))
                tx_hash, receipt = send_tx(w3, account, fn, gas_limit=400000)
                status = "OK" if receipt.status == 1 else "REVERTED"
                print(f"  [{status}] TX: {tx_hash.hex()}  gas: {receipt.gasUsed}")
                if receipt.status == 0:
                    print("  FAILED — skipping")
                    print()
                    time.sleep(3)
                    continue
                time.sleep(3)

            print(f"  Step 2: collect...")
            fn = npm.functions.collect((token_id, account.address, MAX_UINT128, MAX_UINT128))
            tx_hash, receipt = send_tx(w3, account, fn, gas_limit=200000)
            status = "OK" if receipt.status == 1 else "REVERTED"
            print(f"  [{status}] TX: {tx_hash.hex()}  gas: {receipt.gasUsed}")
            if receipt.status == 0:
                print("  FAILED — skipping burn")
                print()
                time.sleep(3)
                continue
            time.sleep(3)

            print(f"  Step 3: burn...")
            fn = npm.functions.burn(token_id)
            tx_hash, receipt = send_tx(w3, account, fn, gas_limit=150000)
            status = "OK" if receipt.status == 1 else "REVERTED"
            print(f"  [{status}] TX: {tx_hash.hex()}  gas: {receipt.gasUsed}")
            if receipt.status == 1:
                print(f"  NFT #{token_id} withdrawn and burned")
            else:
                print(f"  burn FAILED")
            print()
            time.sleep(3)
        except Exception as e:
            print(f"  ERROR: {e}")
            print()
            time.sleep(5)

    wzion_after = wzion_c.functions.balanceOf(account.address).call()
    print("=== Final ===")
    print(f"wZION: {wzion_after / 1e18:,.6f}  (delta: {(wzion_after - wzion_before) / 1e18:,.6f})")
    print(f"ETH:   {w3.eth.get_balance(account.address) / 1e18:.6f}")
    remaining = npm.functions.balanceOf(account.address).call()
    print(f"\nRemaining NFTs: {remaining}")
    for i in range(remaining):
        tid = npm.functions.tokenOfOwnerByIndex(account.address, i).call()
        pos = npm.functions.positions(tid).call()
        print(f"  NFT #{tid}: fee={pos[4]} liq={pos[7]}")


if __name__ == "__main__":
    main()
