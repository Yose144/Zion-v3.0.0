#!/usr/bin/env python3
"""Swap WETH → SOL via Paraswap (route: PancakeSwap V3) on Base.

SOL on Base: 0x311935Cd80B76769bF2ecC9D8Ab7635b2139cf82 (9 decimals, official Base bridge)
"""
import time, json, urllib.request
from web3 import Web3
from eth_account import Account

RPC = "https://base.publicnode.com"
DEPLOYER = "0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186"
KEY_FILE = "/root/zion-validator-key.env"

WETH = Web3.to_checksum_address("0x4200000000000000000000000000000000000006")
SOL = Web3.to_checksum_address("0x311935Cd80B76769bF2ecC9D8Ab7635b2139cf82")

WETH_TO_WRAP = Web3.to_wei(0.005, "ether")  # wrap 0.005 ETH
AMOUNT_IN = Web3.to_wei(0.002, "ether")  # swap 0.002 WETH → SOL

ERC20_ABI = [
    {"inputs": [{"name": "a", "type": "address"}], "name": "balanceOf", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"name": "o", "type": "address"}, {"name": "s", "type": "address"}], "name": "allowance", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"name": "s", "type": "address"}, {"name": "a", "type": "uint256"}], "name": "approve", "outputs": [{"name": "", "type": "bool"}], "stateMutability": "nonpayable", "type": "function"},
    {"inputs": [], "name": "deposit", "outputs": [], "stateMutability": "payable", "type": "function"},
]


def load_key():
    with open(KEY_FILE) as f:
        for line in f:
            if line.startswith("ZION_VALIDATOR_PRIVATE_KEY="):
                return line.split("=", 1)[1].strip()
    raise RuntimeError("Key not found")


def send_tx(w3, account, to, data, gas_limit=400000, value=0):
    nonce = w3.eth.get_transaction_count(account.address)
    tx = {
        "from": account.address, "to": to, "data": data,
        "nonce": nonce, "gas": gas_limit, "gasPrice": w3.eth.gas_price,
        "chainId": w3.eth.chain_id, "value": value,
    }
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    return tx_hash, receipt


def paraswap_get_swap(w3, account, src_token, dest_token, amount_in, dest_decimals):
    """Get swap calldata from Paraswap API."""
    # Step 1: Get price quote
    url = (f"https://apiv5.paraswap.io/prices?"
           f"srcToken={src_token}&destToken={dest_token}"
           f"&amount={amount_in}&srcDecimals=18&destDecimals={dest_decimals}"
           f"&side=SELL&network=8453")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=15) as r:
        price_data = json.loads(r.read())

    pr = price_data["priceRoute"]
    dest_amount = int(pr["destAmount"])
    print(f"  Paraswap quote: {amount_in / 1e18:.6f} WETH → {dest_amount / 1e9:.6f} SOL")

    # Step 2: Get swap transaction data
    swap_url = "https://apiv5.paraswap.io/swap/8453"
    params = {
        "srcToken": src_token,
        "destToken": dest_token,
        "srcAmount": str(amount_in),
        "srcDecimals": "18",
        "destDecimals": str(dest_decimals),
        "side": "SELL",
        "priceRoute": pr,
        "userAddress": account.address,
        "receiver": account.address,
    }
    req2 = urllib.request.Request(
        swap_url,
        data=json.dumps(params).encode(),
        headers={"User-Agent": "Mozilla/5.0", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req2, timeout=15) as r2:
        swap_data = json.loads(r2.read())

    return swap_data, dest_amount


def main():
    w3 = Web3(Web3.HTTPProvider(RPC))
    account = Account.from_key(load_key())
    assert account.address.lower() == DEPLOYER.lower()

    weth_c = w3.eth.contract(address=WETH, abi=ERC20_ABI)
    sol_c = w3.eth.contract(address=SOL, abi=ERC20_ABI)

    print(f"Deployer: {account.address}")
    print(f"WETH: {weth_c.functions.balanceOf(account.address).call() / 1e18:.6f}")
    print(f"SOL:  {sol_c.functions.balanceOf(account.address).call() / 1e9:.6f}")
    print(f"ETH:  {w3.eth.get_balance(account.address) / 1e18:.6f}")
    print()

    # Step 1: Wrap ETH → WETH if needed
    weth_bal = weth_c.functions.balanceOf(account.address).call()
    if weth_bal < AMOUNT_IN:
        wrap_amount = AMOUNT_IN - weth_bal
        print(f"Step 1: Wrapping {wrap_amount / 1e18:.6f} ETH → WETH...")
        fn = weth_c.functions.deposit()
        nonce = w3.eth.get_transaction_count(account.address)
        tx = fn.build_transaction({
            "from": account.address, "nonce": nonce, "gas": 100000,
            "gasPrice": w3.eth.gas_price, "chainId": w3.eth.chain_id,
            "value": wrap_amount,
        })
        signed = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        print(f"  [{'OK' if receipt.status==1 else 'FAILED'}] {tx_hash.hex()}")
        time.sleep(3)
    else:
        print("Step 1: WETH balance sufficient")

    # Step 2: Get Paraswap swap data
    print("Step 2: Getting Paraswap swap data...")
    swap_data, dest_amount = paraswap_get_swap(w3, account, WETH, SOL, AMOUNT_IN, 9)

    to_address = Web3.to_checksum_address(swap_data["to"])
    calldata = swap_data["data"]
    gas_limit = int(swap_data.get("gasLimit", 400000))
    print(f"  To: {to_address}")
    print(f"  Calldata: {calldata[:80]}...")
    print(f"  Gas limit: {gas_limit}")

    # Step 3: Approve WETH for Paraswap AugustusSwapper
    augustus = to_address
    allowance = weth_c.functions.allowance(account.address, augustus).call()
    if allowance < AMOUNT_IN:
        print(f"Step 3: Approving WETH for AugustusSwapper ({augustus})...")
        fn = weth_c.functions.approve(augustus, AMOUNT_IN * 10)
        nonce = w3.eth.get_transaction_count(account.address)
        tx = fn.build_transaction({
            "from": account.address, "nonce": nonce, "gas": 100000,
            "gasPrice": w3.eth.gas_price, "chainId": w3.eth.chain_id,
        })
        signed = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        print(f"  [{'OK' if receipt.status==1 else 'FAILED'}] {tx_hash.hex()}")
        time.sleep(3)
    else:
        print("Step 3: Allowance sufficient")

    # Step 4: Execute swap
    print("Step 4: Executing swap...")
    tx_hash, receipt = send_tx(w3, account, to_address, calldata, gas_limit=gas_limit + 50000)
    status = "OK" if receipt.status == 1 else "FAILED"
    print(f"  [{status}] TX: {tx_hash.hex()}  gas: {receipt.gasUsed}")

    if receipt.status == 1:
        sol_bal = sol_c.functions.balanceOf(account.address).call()
        print(f"  SOL received: {sol_bal / 1e9:.6f}")

    print()
    print("=== Final Balances ===")
    print(f"WETH: {weth_c.functions.balanceOf(account.address).call() / 1e18:.6f}")
    print(f"SOL:  {sol_c.functions.balanceOf(account.address).call() / 1e9:.6f}")
    print(f"ETH:  {w3.eth.get_balance(account.address) / 1e18:.6f}")


if __name__ == "__main__":
    main()
