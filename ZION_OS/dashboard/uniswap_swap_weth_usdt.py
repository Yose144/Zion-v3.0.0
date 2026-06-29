#!/usr/bin/env python3
"""Swap WETH → USDT via Uniswap V3 SwapRouter02 (multicall + exactInput)."""
import time
from web3 import Web3
from eth_account import Account

RPC = "https://base.publicnode.com"
ROUTER = Web3.to_checksum_address("0x2626664c2603336E57B271c5C0b26F421741e481")
DEPLOYER = "0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186"
KEY_FILE = "/root/zion-validator-key.env"

WETH = Web3.to_checksum_address("0x4200000000000000000000000000000000000006")
USDT = Web3.to_checksum_address("0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2")

AMOUNT_IN = Web3.to_wei(0.002, "ether")  # 0.002 WETH
FEE = 500  # 0.05%

EXACT_INPUT_ABI = [
    {"inputs": [{"components": [
        {"name": "path", "type": "bytes"},
        {"name": "recipient", "type": "address"},
        {"name": "amountIn", "type": "uint256"},
        {"name": "amountOutMinimum", "type": "uint256"},
    ], "name": "params", "type": "tuple"}],
    "name": "exactInput",
    "outputs": [{"name": "amountOut", "type": "uint256"}],
    "stateMutability": "payable",
    "type": "function"},
]

MULTICALL_ABI = [
    {"inputs": [{"name": "deadline", "type": "uint256"}, {"name": "data", "type": "bytes[]"}],
    "name": "multicall",
    "outputs": [{"name": "results", "type": "bytes[]"}],
    "stateMutability": "payable",
    "type": "function"},
]

ERC20_ABI = [
    {"inputs": [{"name": "a", "type": "address"}], "name": "balanceOf", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"name": "o", "type": "address"}, {"name": "s", "type": "address"}], "name": "allowance", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"name": "s", "type": "address"}, {"name": "a", "type": "uint256"}], "name": "approve", "outputs": [{"name": "", "type": "bool"}], "stateMutability": "nonpayable", "type": "function"},
]


def load_key():
    with open(KEY_FILE) as f:
        for line in f:
            if line.startswith("ZION_VALIDATOR_PRIVATE_KEY="):
                return line.split("=", 1)[1].strip()
    raise RuntimeError("Key not found")


def send_tx(w3, account, fn, gas_limit=300000, value=0):
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
    account = Account.from_key(load_key())
    assert account.address.lower() == DEPLOYER.lower()

    weth_c = w3.eth.contract(address=WETH, abi=ERC20_ABI)
    usdt_c = w3.eth.contract(address=USDT, abi=ERC20_ABI)

    print(f"Deployer: {account.address}")
    print(f"WETH: {weth_c.functions.balanceOf(account.address).call() / 1e18:.6f}")
    print(f"USDT: {usdt_c.functions.balanceOf(account.address).call() / 1e6:.6f}")
    print(f"Swap: {AMOUNT_IN / 1e18:.6f} WETH → USDT (fee={FEE})")
    print()

    # Step 1: Approve WETH for router
    allowance = weth_c.functions.allowance(account.address, ROUTER).call()
    if allowance < AMOUNT_IN:
        print("Step 1: Approving WETH for router...")
        fn = weth_c.functions.approve(ROUTER, AMOUNT_IN * 2)
        tx_hash, receipt = send_tx(w3, account, fn, gas_limit=100000)
        print(f"  [{'OK' if receipt.status==1 else 'FAILED'}] {tx_hash.hex()}")
        time.sleep(3)
    else:
        print("Step 1: Allowance sufficient")

    # Step 2: Build exactInput calldata
    # path = WETH + fee(3 bytes) + USDT
    path = bytes.fromhex(WETH[2:].lower() + FEE.to_bytes(3, "big").hex() + USDT[2:].lower())
    print(f"Step 2: Building swap...")
    print(f"  Path: 0x{path.hex()}")

    block = w3.eth.get_block("latest")
    deadline = block.timestamp + 600

    router_ei = w3.eth.contract(address=ROUTER, abi=EXACT_INPUT_ABI)
    ei_fn = router_ei.functions.exactInput((path, account.address, AMOUNT_IN, 0))
    ei_calldata = ei_fn.build_transaction({
        "from": account.address, "gas": 200000,
        "gasPrice": w3.eth.gas_price, "chainId": w3.eth.chain_id, "value": 0,
    })["data"]

    # Step 3: multicall(deadline, [exactInput_calldata])
    print("Step 3: multicall swap...")
    router_mc = w3.eth.contract(address=ROUTER, abi=MULTICALL_ABI)
    fn = router_mc.functions.multicall(deadline, [ei_calldata])
    tx_hash, receipt = send_tx(w3, account, fn, gas_limit=250000)
    status = "OK" if receipt.status == 1 else "FAILED"
    print(f"  [{status}] TX: {tx_hash.hex()}  gas: {receipt.gasUsed}")

    if receipt.status == 1:
        usdt_after = usdt_c.functions.balanceOf(account.address).call()
        print(f"  USDT received: {usdt_after / 1e6:.6f}")

    print()
    print("=== Final Balances ===")
    print(f"WETH: {weth_c.functions.balanceOf(account.address).call() / 1e18:.6f}")
    print(f"USDT: {usdt_c.functions.balanceOf(account.address).call() / 1e6:.6f}")
    print(f"ETH:  {w3.eth.get_balance(account.address) / 1e18:.6f}")


if __name__ == "__main__":
    main()
