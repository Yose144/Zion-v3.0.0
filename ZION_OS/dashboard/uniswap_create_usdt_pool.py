#!/usr/bin/env python3
"""Create USDT/wZION Uniswap V3 pool and add two-sided liquidity.

USDT: 0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2 (6 decimals)
wZION: 0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6 (18 decimals)

Target price: $0.0002 USD/ZION
- 1 ZION = 0.0002 USDT = 0.0002 * 1e6 / 1e18 raw = 2e-16 (token1/token0 if USDT is token1)
- But token0 < token1 by address, so need to sort
- wZION: 0x0c49...  USDT: 0xfde4...
- wZION < USDT → token0=wZION, token1=USDT
- price = token1/token0 = USDT/wZION = 0.0002 * 1e6 / 1e18 = 2e-16
- sqrtPriceX96 = sqrt(2e-16) * 2^96 = 1.41421e-8 * 7.92282e28 = 1.12046e21

Fee: 0.3% (3000) — standard for stable/non-stable pairs
"""
import time
from web3 import Web3
from eth_account import Account

RPC = "https://base.publicnode.com"
NPM_ADDR = Web3.to_checksum_address("0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1")
FACTORY = Web3.to_checksum_address("0x33128a8fC17869897dcE68Ed026d694621f6FDfD")
DEPLOYER = "0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186"
KEY_FILE = "/root/zion-validator-key.env"

WZION = Web3.to_checksum_address("0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6")
USDT = Web3.to_checksum_address("0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2")

FEE = 3000  # 0.3%
TICK_SPACING = 60

# Price: 1 wZION = $0.0002 = 0.0002 USDT
# token0=wZION (18 dec), token1=USDT (6 dec)
# price (token1/token0) = 0.0002 * 1e6 / 1e18 = 2e-16
# sqrtPriceX96 = sqrt(2e-16) * 2^96
import math
PRICE_RATIO = 0.0002 * 1e6 / 1e18  # USDT per raw wZION
SQRT_PRICE_X96 = int(math.sqrt(PRICE_RATIO) * (2**96))
print(f"sqrtPriceX96: {SQRT_PRICE_X96}")

# Compute tick at this price
# tick = log(price) / log(1.0001)
# price = 1.0001^tick → tick = log(2e-16) / log(1.0001)
tick_at_price = math.log(PRICE_RATIO) / math.log(1.0001)
print(f"Tick at price: {tick_at_price:.0f}")

# Round to tick spacing (60)
tick_current = int(tick_at_price // TICK_SPACING * TICK_SPACING)
print(f"Rounded tick: {tick_current}")

# Position: ±50% range around current tick
TICK_LOWER = int((tick_current - 5000) // TICK_SPACING * TICK_SPACING)
TICK_UPPER = int((tick_current + 5000) // TICK_SPACING * TICK_SPACING)
print(f"Position ticks: [{TICK_LOWER}, {TICK_UPPER}]")

WZION_AMOUNT = 100_000 * 10**18  # 100K wZION
USDT_AMOUNT = 3_142_680  # ~3.14 USDT (all we have, 6 decimals)

NPM_ABI = [
    {
        "inputs": [
            {"name": "token0", "type": "address"},
            {"name": "token1", "type": "address"},
            {"name": "fee", "type": "uint24"},
            {"name": "sqrtPriceX96", "type": "uint160"},
        ],
        "name": "createAndInitializePoolIfNecessary",
        "outputs": [{"name": "pool", "type": "address"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [{"components": [
            {"name": "token0", "type": "address"},
            {"name": "token1", "type": "address"},
            {"name": "fee", "type": "uint24"},
            {"name": "tickLower", "type": "int24"},
            {"name": "tickUpper", "type": "int24"},
            {"name": "amount0Desired", "type": "uint256"},
            {"name": "amount1Desired", "type": "uint256"},
            {"name": "amount0Min", "type": "uint256"},
            {"name": "amount1Min", "type": "uint256"},
            {"name": "recipient", "type": "address"},
            {"name": "deadline", "type": "uint256"},
        ], "name": "params", "type": "tuple"}],
        "name": "mint",
        "outputs": [
            {"name": "tokenId", "type": "uint256"},
            {"name": "liquidity", "type": "uint128"},
            {"name": "amount0", "type": "uint256"},
            {"name": "amount1", "type": "uint256"},
        ],
        "stateMutability": "payable",
        "type": "function",
    },
    {"inputs": [{"name": "owner", "type": "address"}], "name": "balanceOf", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"name": "owner", "type": "address"}, {"name": "index", "type": "uint256"}], "name": "tokenOfOwnerByIndex", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"name": "tokenId", "type": "uint256"}], "name": "positions", "outputs": [{"name": "nonce", "type": "uint96"}, {"name": "operator", "type": "address"}, {"name": "token0", "type": "address"}, {"name": "token1", "type": "address"}, {"name": "fee", "type": "uint24"}, {"name": "tickLower", "type": "int24"}, {"name": "tickUpper", "type": "int24"}, {"name": "liquidity", "type": "uint128"}, {"name": "feeGrowthInside0LastX128", "type": "uint256"}, {"name": "feeGrowthInside1LastX128", "type": "uint256"}, {"name": "tokensOwed0", "type": "uint128"}, {"name": "tokensOwed1", "type": "uint128"}], "stateMutability": "view", "type": "function"},
]

FACTORY_ABI = [
    {"inputs": [{"name": "tokenA", "type": "address"}, {"name": "tokenB", "type": "address"}, {"name": "fee", "type": "uint24"}], "name": "getPool", "outputs": [{"name": "", "type": "address"}], "stateMutability": "view", "type": "function"},
]

ERC20_ABI = [
    {"inputs": [{"name": "a", "type": "address"}], "name": "balanceOf", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"name": "o", "type": "address"}, {"name": "s", "type": "address"}], "name": "allowance", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"name": "s", "type": "address"}, {"name": "a", "type": "uint256"}], "name": "approve", "outputs": [{"name": "", "type": "bool"}], "stateMutability": "nonpayable", "type": "function"},
]

POOL_ABI = [
    {"inputs": [], "name": "slot0", "outputs": [{"name": "sqrtPriceX96", "type": "uint160"}, {"name": "tick", "type": "int24"}, {"name": "observationIndex", "type": "uint16"}, {"name": "observationCardinality", "type": "uint16"}, {"name": "observationCardinalityNext", "type": "uint16"}, {"name": "feeProtocol", "type": "uint8"}, {"name": "unlocked", "type": "bool"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "liquidity", "outputs": [{"name": "", "type": "uint128"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "token0", "outputs": [{"name": "", "type": "address"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "token1", "outputs": [{"name": "", "type": "address"}], "stateMutability": "view", "type": "function"},
]


def load_key():
    with open(KEY_FILE) as f:
        for line in f:
            if line.startswith("ZION_VALIDATOR_PRIVATE_KEY="):
                return line.split("=", 1)[1].strip()
    raise RuntimeError("Key not found")


def send_tx(w3, account, fn, gas_limit=500000, value=0):
    nonce = w3.eth.get_transaction_count(account.address)
    tx = fn.build_transaction({
        "from": account.address, "nonce": nonce, "gas": gas_limit,
        "gasPrice": w3.eth.gas_price, "chainId": w3.eth.chain_id, "value": value,
    })
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    return tx_hash, receipt


def main():
    w3 = Web3(Web3.HTTPProvider(RPC))
    account = Account.from_key(load_key())
    assert account.address.lower() == DEPLOYER.lower()

    print(f"Deployer: {account.address}")
    print(f"wZION: {w3.eth.contract(address=WZION, abi=ERC20_ABI).functions.balanceOf(account.address).call() / 1e18:,.2f}")
    print(f"USDT:  {w3.eth.contract(address=USDT, abi=ERC20_ABI).functions.balanceOf(account.address).call() / 1e6:.6f}")
    print(f"ETH:   {w3.eth.get_balance(account.address) / 1e18:.6f}")
    print()

    npm = w3.eth.contract(address=NPM_ADDR, abi=NPM_ABI)
    factory = w3.eth.contract(address=FACTORY, abi=FACTORY_ABI)

    # Sort tokens (token0 < token1 by address)
    if WZION.lower() < USDT.lower():
        token0, token1 = WZION, USDT
        print(f"token0=wZION, token1=USDT")
    else:
        token0, token1 = USDT, WZION
        print(f"token0=USDT, token1=wZION")

    # Check if pool exists
    pool_addr = factory.functions.getPool(token0, token1, FEE).call()
    print(f"Existing pool: {pool_addr}")
    pool_exists = pool_addr != "0x0000000000000000000000000000000000000000"
    print()

    # Step 1: Create + initialize pool
    if not pool_exists:
        print("Step 1: Creating + initializing pool...")
        fn = npm.functions.createAndInitializePoolIfNecessary(token0, token1, FEE, SQRT_PRICE_X96)
        tx_hash, receipt = send_tx(w3, account, fn, gas_limit=5000000)
        status = "OK" if receipt.status == 1 else "FAILED"
        print(f"  [{status}] TX: {tx_hash.hex()}  gas: {receipt.gasUsed}")
        time.sleep(3)
        pool_addr = factory.functions.getPool(token0, token1, FEE).call()
        print(f"  Pool address: {pool_addr}")
    else:
        print("Step 1: Pool already exists — skipping creation")

    # Verify pool state
    pool = w3.eth.contract(address=Web3.to_checksum_address(pool_addr), abi=POOL_ABI)
    slot0 = pool.functions.slot0().call()
    print(f"  Pool tick: {slot0[1]}  sqrtPriceX96: {slot0[0]}")
    print()

    # Step 2: Approve tokens
    print("Step 2: Approving tokens for NPM...")
    for token, amount, name in [(WZION, WZION_AMOUNT, "wZION"), (USDT, USDT_AMOUNT, "USDT")]:
        c = w3.eth.contract(address=token, abi=ERC20_ABI)
        allowance = c.functions.allowance(account.address, NPM_ADDR).call()
        if allowance < amount:
            fn = c.functions.approve(NPM_ADDR, amount * 2)
            tx_hash, receipt = send_tx(w3, account, fn, gas_limit=100000)
            print(f"  {name} approve: [{'OK' if receipt.status==1 else 'FAILED'}]")
            time.sleep(3)
        else:
            print(f"  {name} allowance sufficient")
    print()

    # Step 3: Mint liquidity position
    block = w3.eth.get_block("latest")
    deadline = block.timestamp + 600
    print(f"Step 3: Minting position...")
    print(f"  tickLower={TICK_LOWER}  tickUpper={TICK_UPPER}")
    print(f"  amount0Desired={WZION_AMOUNT / 1e18:,.0f} wZION")
    print(f"  amount1Desired={USDT_AMOUNT / 1e6:.6f} USDT")

    params = (token0, token1, FEE, TICK_LOWER, TICK_UPPER,
              WZION_AMOUNT, USDT_AMOUNT, 0, 0, account.address, deadline)
    fn = npm.functions.mint(params)
    tx_hash, receipt = send_tx(w3, account, fn, gas_limit=500000)
    status = "OK" if receipt.status == 1 else "FAILED"
    print(f"  [{status}] TX: {tx_hash.hex()}  gas: {receipt.gasUsed}")

    if receipt.status == 1:
        # Find NFT ID from Transfer event
        for log in receipt.logs:
            if log["address"].lower() == NPM_ADDR.lower():
                if log["topics"][0].hex() == "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef":
                    if int(log["topics"][1].hex(), 16) == 0:  # from 0x0
                        token_id = int(log["topics"][3].hex(), 16)
                        print(f"  New NFT ID: {token_id}")

        # Verify
        count = npm.functions.balanceOf(account.address).call()
        print(f"  Total NFTs: {count}")
        for i in range(count):
            tid = npm.functions.tokenOfOwnerByIndex(account.address, i).call()
            pos = npm.functions.positions(tid).call()
            print(f"    NFT #{tid}: fee={pos[4]} tick=[{pos[5]},{pos[6]}] liq={pos[7]}")

    print()
    print("=== Final Balances ===")
    print(f"wZION: {w3.eth.contract(address=WZION, abi=ERC20_ABI).functions.balanceOf(account.address).call() / 1e18:,.2f}")
    print(f"USDT:  {w3.eth.contract(address=USDT, abi=ERC20_ABI).functions.balanceOf(account.address).call() / 1e6:.6f}")
    print(f"ETH:   {w3.eth.get_balance(account.address) / 1e18:.6f}")
    print(f"Pool liquidity: {pool.functions.liquidity().call()}")


if __name__ == "__main__":
    main()
