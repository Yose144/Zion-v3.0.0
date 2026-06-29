#!/usr/bin/env python3
"""Add a second, wider liquidity position to the active wZION/WETH 1.0% pool.

Current state:
- Active pool: 0x18c0DaeF295E63F1bfBC7C39e71d0fabf4600699 (fee=10000, tickSpacing=200)
- Current tick: ~-161184
- Existing position NFT #5431714: tick [-162000, -160000] (narrow, ~±10%)
- Deployer: 99.9M wZION, 0.013 WETH, 0.041 ETH

Plan:
1. Wrap 0.02 ETH → WETH (leaves ~0.021 ETH for gas)
2. Approve wZION + WETH for NPM
3. Mint wider position: tick [-164000, -158000] (~±30% range, more depth)
4. Use tuple ABI for mint()
"""
import time
from web3 import Web3
from eth_account import Account

RPC = "https://base.publicnode.com"
NPM_ADDR = Web3.to_checksum_address("0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1")
DEPLOYER_ADDR = "0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186"
KEY_FILE = "/root/zion-validator-key.env"

WZION = Web3.to_checksum_address("0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6")
WETH = Web3.to_checksum_address("0x4200000000000000000000000000000000000006")
POOL_ADDR = Web3.to_checksum_address("0x18c0DaeF295E63F1bfBC7C39e71d0fabf4600699")

# Position params
TICK_LOWER = -164000  # ~-30% from current
TICK_UPPER = -158000  # ~+30% from current
FEE = 10000  # 1%
WZION_AMOUNT = 200_000 * 10**18  # 200K wZION
WETH_TO_WRAP = Web3.to_wei(0.02, "ether")  # 0.02 ETH → WETH

# ABIs
NPM_ABI = [
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
    {"inputs": [{"name": "tokenId", "type": "uint256"}], "name": "positions", "outputs": [{"name": "nonce", "type": "uint96"}, {"name": "operator", "type": "address"}, {"name": "token0", "type": "address"}, {"name": "token1", "type": "address"}, {"name": "fee", "type": "uint24"}, {"name": "tickLower", "type": "int24"}, {"name": "tickUpper", "type": "int24"}, {"name": "liquidity", "type": "uint128"}, {"name": "feeGrowthInside0LastX128", "type": "uint256"}, {"name": "feeGrowthInside1LastX128", "type": "uint256"}, {"name": "tokensOwed0", "type": "uint128"}, {"name": "tokensOwed1", "type": "uint128"}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"name": "owner", "type": "address"}], "name": "balanceOf", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"name": "owner", "type": "address"}, {"name": "index", "type": "uint256"}], "name": "tokenOfOwnerByIndex", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
]

ERC20_ABI = [
    {"inputs": [{"name": "owner", "type": "address"}, {"name": "spender", "type": "address"}], "name": "allowance", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"name": "spender", "type": "address"}, {"name": "amount", "type": "uint256"}], "name": "approve", "outputs": [{"name": "", "type": "bool"}], "stateMutability": "nonpayable", "type": "function"},
    {"inputs": [{"name": "account", "type": "address"}], "name": "balanceOf", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "deposit", "outputs": [], "stateMutability": "payable", "type": "function"},
]

POOL_ABI = [
    {'inputs':[],'name':'slot0','outputs':[{'name':'sqrtPriceX96','type':'uint160'},{'name':'tick','type':'int24'},{'name':'observationIndex','type':'uint16'},{'name':'observationCardinality','type':'uint16'},{'name':'observationCardinalityNext','type':'uint16'},{'name':'feeProtocol','type':'uint8'},{'name':'unlocked','type':'bool'}],'stateMutability':'view','type':'function'},
    {'inputs':[],'name':'liquidity','outputs':[{'name':'','type':'uint128'}],'stateMutability':'view','type':'function'},
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
    assert account.address.lower() == DEPLOYER_ADDR.lower()

    print(f"Deployer: {account.address}")
    print(f"ETH: {w3.eth.get_balance(account.address) / 1e18:.6f}")

    npm = w3.eth.contract(address=NPM_ADDR, abi=NPM_ABI)
    wzion_c = w3.eth.contract(address=WZION, abi=ERC20_ABI)
    weth_c = w3.eth.contract(address=WETH, abi=ERC20_ABI)
    pool = w3.eth.contract(address=POOL_ADDR, abi=POOL_ABI)

    # Check current pool state
    slot0 = pool.functions.slot0().call()
    current_tick = slot0[1]
    print(f"Pool tick: {current_tick}")
    print(f"Target position: tick [{TICK_LOWER}, {TICK_UPPER}]")
    print()

    # Step 1: Wrap ETH → WETH
    weth_bal = weth_c.functions.balanceOf(account.address).call()
    print(f"Step 1: WETH balance: {weth_bal / 1e18:.6f}")
    total_weth_needed = WETH_TO_WRAP
    if weth_bal < total_weth_needed:
        wrap_amount = total_weth_needed - weth_bal
        print(f"  Wrapping {wrap_amount / 1e18:.6f} ETH → WETH...")
        fn = weth_c.functions.deposit()
        tx_hash, receipt = send_tx(w3, account, fn, gas_limit=100000, value=wrap_amount)
        print(f"  [{'OK' if receipt.status==1 else 'FAILED'}] {tx_hash.hex()}")
        time.sleep(3)
    weth_bal_after = weth_c.functions.balanceOf(account.address).call()
    print(f"  WETH balance now: {weth_bal_after / 1e18:.6f}")
    print()

    # Step 2: Approve wZION + WETH for NPM
    print("Step 2: Approving tokens for NPM...")
    # wZION
    allowance = wzion_c.functions.allowance(account.address, NPM_ADDR).call()
    if allowance < WZION_AMOUNT:
        fn = wzion_c.functions.approve(NPM_ADDR, WZION_AMOUNT * 2)
        tx_hash, receipt = send_tx(w3, account, fn, gas_limit=100000)
        print(f"  wZION approve: [{'OK' if receipt.status==1 else 'FAILED'}]")
        time.sleep(3)
    else:
        print(f"  wZION allowance sufficient: {allowance / 1e18:,.0f}")

    # WETH
    weth_needed = weth_bal_after
    allowance_w = weth_c.functions.allowance(account.address, NPM_ADDR).call()
    if allowance_w < weth_needed:
        fn = weth_c.functions.approve(NPM_ADDR, weth_needed * 2)
        tx_hash, receipt = send_tx(w3, account, fn, gas_limit=100000)
        print(f"  WETH approve: [{'OK' if receipt.status==1 else 'FAILED'}]")
        time.sleep(3)
    else:
        print(f"  WETH allowance sufficient: {allowance_w / 1e18:.6f}")
    print()

    # Step 3: Mint position
    block = w3.eth.get_block("latest")
    deadline = block.timestamp + 600
    print(f"Step 3: Minting position...")
    print(f"  token0={WZION}  token1={WETH}  fee={FEE}")
    print(f"  tickLower={TICK_LOWER}  tickUpper={TICK_UPPER}")
    print(f"  amount0Desired={WZION_AMOUNT / 1e18:,.0f} wZION")
    print(f"  amount1Desired={weth_needed / 1e18:.6f} WETH")

    params = (
        WZION,           # token0
        WETH,            # token1
        FEE,             # fee
        TICK_LOWER,      # tickLower
        TICK_UPPER,      # tickUpper
        WZION_AMOUNT,    # amount0Desired
        weth_needed,     # amount1Desired
        0,               # amount0Min
        0,               # amount1Min
        account.address, # recipient
        deadline,        # deadline
    )

    fn = npm.functions.mint(params)
    tx_hash, receipt = send_tx(w3, account, fn, gas_limit=500000)
    status = "OK" if receipt.status == 1 else "FAILED"
    print(f"  [{status}] TX: {tx_hash.hex()}  gas: {receipt.gasUsed}")

    if receipt.status == 1:
        # Parse logs to find tokenId
        # Mint event: event IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)
        # Also Transfer event for new NFT
        logs = receipt.logs
        print(f"  Logs: {len(logs)}")
        # Find NFT ID from Transfer event (ERC721 Transfer from 0x0)
        for log in logs:
            if len(log["data"]) >= 32 and log["address"].lower() == NPM_ADDR.lower():
                # Transfer event topic: 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
                if log["topics"][0].hex() == "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef":
                    if log["topics"][1].hex() == "0x" + "0"*63 + "0":  # from 0x0
                        token_id = int(log["topics"][3].hex(), 16)
                        print(f"  New NFT ID: {token_id}")

        # Verify position
        count = npm.functions.balanceOf(account.address).call()
        print(f"  Total NFTs: {count}")
        for i in range(count):
            tid = npm.functions.tokenOfOwnerByIndex(account.address, i).call()
            pos = npm.functions.positions(tid).call()
            print(f"    NFT #{tid}: fee={pos[4]} tick=[{pos[5]},{pos[6]}] liq={pos[7]}")

    # Final balances
    print()
    print("=== Final Balances ===")
    print(f"wZION: {wzion_c.functions.balanceOf(account.address).call() / 1e18:,.2f}")
    print(f"WETH:  {weth_c.functions.balanceOf(account.address).call() / 1e18:.6f}")
    print(f"ETH:   {w3.eth.get_balance(account.address) / 1e18:.6f}")
    print(f"Pool liquidity: {pool.functions.liquidity().call()}")


if __name__ == "__main__":
    main()
