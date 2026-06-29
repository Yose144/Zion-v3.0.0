#!/usr/bin/env python3
"""Swap WETH → SOL via KyberSwap aggregator on Base, then create SOL/wZION pool."""
import time, json, urllib.request
from web3 import Web3
from eth_account import Account
import math

RPC = "https://base.publicnode.com"
DEPLOYER = "0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186"
KEY_FILE = "/root/zion-validator-key.env"

WETH = Web3.to_checksum_address("0x4200000000000000000000000000000000000006")
SOL = Web3.to_checksum_address("0x311935Cd80B76769bF2ecC9D8Ab7635b2139cf82")
WZION = Web3.to_checksum_address("0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6")
NPM = Web3.to_checksum_address("0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1")
FACTORY = Web3.to_checksum_address("0x33128a8fC17869897dcE68Ed026d694621f6FDfD")

SWAP_AMOUNT = Web3.to_wei(0.002, "ether")  # 0.002 WETH → SOL
FEE = 3000  # 0.3% for SOL/wZION pool

ERC20_ABI = [
    {"inputs": [{"name": "a", "type": "address"}], "name": "balanceOf", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"name": "o", "type": "address"}, {"name": "s", "type": "address"}], "name": "allowance", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"name": "s", "type": "address"}, {"name": "a", "type": "uint256"}], "name": "approve", "outputs": [{"name": "", "type": "bool"}], "stateMutability": "nonpayable", "type": "function"},
    {"inputs": [], "name": "deposit", "outputs": [], "stateMutability": "payable", "type": "function"},
]

NPM_ABI = [
    {"inputs": [{"name": "token0", "type": "address"}, {"name": "token1", "type": "address"}, {"name": "fee", "type": "uint24"}, {"name": "sqrtPriceX96", "type": "uint160"}], "name": "createAndInitializePoolIfNecessary", "outputs": [{"name": "pool", "type": "address"}], "stateMutability": "nonpayable", "type": "function"},
    {"inputs": [{"components": [{"name": "token0", "type": "address"}, {"name": "token1", "type": "address"}, {"name": "fee", "type": "uint24"}, {"name": "tickLower", "type": "int24"}, {"name": "tickUpper", "type": "int24"}, {"name": "amount0Desired", "type": "uint256"}, {"name": "amount1Desired", "type": "uint256"}, {"name": "amount0Min", "type": "uint256"}, {"name": "amount1Min", "type": "uint256"}, {"name": "recipient", "type": "address"}, {"name": "deadline", "type": "uint256"}], "name": "params", "type": "tuple"}], "name": "mint", "outputs": [{"name": "tokenId", "type": "uint256"}, {"name": "liquidity", "type": "uint128"}, {"name": "amount0", "type": "uint256"}, {"name": "amount1", "type": "uint256"}], "stateMutability": "payable", "type": "function"},
    {"inputs": [{"name": "owner", "type": "address"}], "name": "balanceOf", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"name": "owner", "type": "address"}, {"name": "index", "type": "uint256"}], "name": "tokenOfOwnerByIndex", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"name": "tokenId", "type": "uint256"}], "name": "positions", "outputs": [{"name": "nonce", "type": "uint96"}, {"name": "operator", "type": "address"}, {"name": "token0", "type": "address"}, {"name": "token1", "type": "address"}, {"name": "fee", "type": "uint24"}, {"name": "tickLower", "type": "int24"}, {"name": "tickUpper", "type": "int24"}, {"name": "liquidity", "type": "uint128"}, {"name": "feeGrowthInside0LastX128", "type": "uint256"}, {"name": "feeGrowthInside1LastX128", "type": "uint256"}, {"name": "tokensOwed0", "type": "uint128"}, {"name": "tokensOwed1", "type": "uint128"}], "stateMutability": "view", "type": "function"},
]

FAC_ABI = [{"inputs": [{"name": "tokenA", "type": "address"}, {"name": "tokenB", "type": "address"}, {"name": "fee", "type": "uint24"}], "name": "getPool", "outputs": [{"name": "", "type": "address"}], "stateMutability": "view", "type": "function"}]


def load_key():
    with open(KEY_FILE) as f:
        for line in f:
            if line.startswith("ZION_VALIDATOR_PRIVATE_KEY="):
                return line.split("=", 1)[1].strip()
    raise RuntimeError("Key not found")


def send_tx(w3, account, to, data, gas_limit=500000, value=0):
    nonce = w3.eth.get_transaction_count(account.address)
    tx = {"from": account.address, "to": to, "data": data, "nonce": nonce, "gas": gas_limit, "gasPrice": w3.eth.gas_price, "chainId": w3.eth.chain_id, "value": value}
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    return tx_hash, receipt


def kyber_swap(w3, account, src, dst, amount_in, src_dec, dst_dec):
    """Get route + build swap via KyberSwap API."""
    url = f"https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn={src}&tokenOut={dst}&amountIn={amount_in}&saveGas=false&gasPrice=0"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=15) as r:
        d = json.loads(r.read())
    route = d["data"]["routeSummary"]
    dest_amount = int(route["amountOut"])
    print(f"  KyberSwap: {amount_in / 10**src_dec:.6f} → {dest_amount / 10**dst_dec:.6f}")

    build_url = "https://aggregator-api.kyberswap.com/base/api/v1/route/build"
    build_data = {"routeSummary": route, "sender": account.address, "recipient": account.address, "slippageTolerance": 500, "deadLine": 9999999999}
    req2 = urllib.request.Request(build_url, data=json.dumps(build_data).encode(), headers={"User-Agent": "Mozilla/5.0", "Content-Type": "application/json"})
    with urllib.request.urlopen(req2, timeout=15) as r2:
        bd = json.loads(r2.read())
    sd = bd["data"]
    return sd["routerAddress"], sd["data"], int(sd.get("gas", 500000)), dest_amount


def main():
    w3 = Web3(Web3.HTTPProvider(RPC))
    account = Account.from_key(load_key())
    assert account.address.lower() == DEPLOYER.lower()

    weth_c = w3.eth.contract(address=WETH, abi=ERC20_ABI)
    sol_c = w3.eth.contract(address=SOL, abi=ERC20_ABI)
    wzion_c = w3.eth.contract(address=WZION, abi=ERC20_ABI)

    print(f"Deployer: {account.address}")
    print(f"WETH: {weth_c.functions.balanceOf(account.address).call() / 1e18:.6f}")
    print(f"SOL:  {sol_c.functions.balanceOf(account.address).call() / 1e9:.6f}")
    print(f"wZION: {wzion_c.functions.balanceOf(account.address).call() / 1e18:,.2f}")
    print(f"ETH:  {w3.eth.get_balance(account.address) / 1e18:.6f}")
    print()

    # Step 1: Get KyberSwap route + execute
    print("Step 1: KyberSwap WETH → SOL...")
    router_addr, calldata, gas_limit, dest_amount = kyber_swap(w3, account, WETH, SOL, SWAP_AMOUNT, 18, 9)
    router = Web3.to_checksum_address(router_addr)
    print(f"  Router: {router}")
    print(f"  Gas: {gas_limit}")

    # Approve WETH for router
    allowance = weth_c.functions.allowance(account.address, router).call()
    if allowance < SWAP_AMOUNT:
        print("  Approving WETH...")
        fn = weth_c.functions.approve(router, SWAP_AMOUNT * 10)
        nonce = w3.eth.get_transaction_count(account.address)
        tx = fn.build_transaction({"from": account.address, "nonce": nonce, "gas": 100000, "gasPrice": w3.eth.gas_price, "chainId": w3.eth.chain_id})
        signed = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        print(f"  Approve: [{'OK' if receipt.status==1 else 'FAILED'}]")
        time.sleep(3)

    # Execute swap
    print("  Executing swap...")
    tx_hash, receipt = send_tx(w3, account, router, calldata, gas_limit=gas_limit + 100000)
    status = "OK" if receipt.status == 1 else "FAILED"
    print(f"  [{status}] TX: {tx_hash.hex()}  gas: {receipt.gasUsed}")

    sol_bal = sol_c.functions.balanceOf(account.address).call()
    print(f"  SOL balance: {sol_bal / 1e9:.6f}")
    print()

    if sol_bal == 0:
        print("  Swap failed — no SOL received. Aborting.")
        return

    # Step 2: Create SOL/wZION pool
    # SOL: 9 decimals, wZION: 18 decimals
    # Price: 1 ZION = $0.0002, 1 SOL = ~$73
    # So 1 SOL = 73/0.0002 = 365,000 ZION
    # token0 < token1 by address: wZION (0x0c49...) < SOL (0x3119...)
    # token0=wZION, token1=SOL
    # price = token1/token0 = SOL/wZION = 365000 * 1e9 / 1e18 = 3.65e-7
    # sqrtPriceX96 = sqrt(3.65e-7) * 2^96

    # Actually, let's use the current SOL price from the swap
    # We got dest_amount SOL for SWAP_AMOUNT WETH
    # ETH price ~$2500, so 0.002 ETH = $5
    # SOL received = dest_amount/1e9
    # SOL price = $5 / (dest_amount/1e9)
    # ZION price = $0.0002
    # SOL/ZION ratio = SOL_price / ZION_price = SOL_price / 0.0002

    eth_price_usd = 2500  # approximate
    sol_received = dest_amount / 1e9
    sol_price_usd = (SWAP_AMOUNT / 1e18 * eth_price_usd) / sol_received
    zion_price_usd = 0.0002
    sol_per_zion = sol_price_usd / zion_price_usd
    print(f"Step 2: Create SOL/wZION pool")
    print(f"  SOL price (est): ${sol_price_usd:.2f}")
    print(f"  SOL/ZION ratio: {sol_per_zion:.2f}")

    # price = token1/token0 = SOL/wZION (in raw units)
    # 1 wZION (1e18 raw) = sol_per_zion * 1e9 raw SOL / 1e18 raw wZION
    price_ratio = sol_per_zion * 1e9 / 1e18
    sqrt_price_x96 = int(math.sqrt(price_ratio) * (2**96))
    tick_at_price = math.log(price_ratio) / math.log(1.0001)
    tick_spacing = 60  # for fee=3000
    tick_current = int(tick_at_price // tick_spacing * tick_spacing)
    tick_lower = int((tick_current - 5000) // tick_spacing * tick_spacing)
    tick_upper = int((tick_current + 5000) // tick_spacing * tick_spacing)

    print(f"  sqrtPriceX96: {sqrt_price_x96}")
    print(f"  tick: {tick_current}  range: [{tick_lower}, {tick_upper}]")

    # Sort tokens
    if WZION.lower() < SOL.lower():
        token0, token1 = WZION, SOL
        print(f"  token0=wZION, token1=SOL")
    else:
        token0, token1 = SOL, WZION
        print(f"  token0=SOL, token1=wZION")

    # Check if pool exists
    fac = w3.eth.contract(address=FACTORY, abi=FAC_ABI)
    pool_addr = fac.functions.getPool(token0, token1, FEE).call()
    print(f"  Existing pool: {pool_addr}")

    npm = w3.eth.contract(address=NPM, abi=NPM_ABI)

    if pool_addr == "0x0000000000000000000000000000000000000000":
        print("  Creating + initializing pool...")
        fn = npm.functions.createAndInitializePoolIfNecessary(token0, token1, FEE, sqrt_price_x96)
        nonce = w3.eth.get_transaction_count(account.address)
        tx = fn.build_transaction({"from": account.address, "nonce": nonce, "gas": 5000000, "gasPrice": w3.eth.gas_price, "chainId": w3.eth.chain_id})
        signed = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        print(f"  [{'OK' if receipt.status==1 else 'FAILED'}] gas: {receipt.gasUsed}")
        time.sleep(3)
        pool_addr = fac.functions.getPool(token0, token1, FEE).call()
        print(f"  Pool: {pool_addr}")
    else:
        print("  Pool already exists")

    # Step 3: Approve + mint liquidity
    WZION_AMOUNT = 100_000 * 10**18  # 100K wZION
    SOL_AMOUNT = sol_bal  # all SOL we have

    print(f"\nStep 3: Mint liquidity")
    print(f"  wZION: {WZION_AMOUNT / 1e18:,.0f}")
    print(f"  SOL: {SOL_AMOUNT / 1e9:.6f}")

    # Approve
    for token, amount, name in [(WZION, WZION_AMOUNT, "wZION"), (SOL, SOL_AMOUNT, "SOL")]:
        c = w3.eth.contract(address=token, abi=ERC20_ABI)
        allowance = c.functions.allowance(account.address, NPM).call()
        if allowance < amount:
            print(f"  Approving {name}...")
            fn = c.functions.approve(NPM, amount * 2)
            nonce = w3.eth.get_transaction_count(account.address)
            tx = fn.build_transaction({"from": account.address, "nonce": nonce, "gas": 100000, "gasPrice": w3.eth.gas_price, "chainId": w3.eth.chain_id})
            signed = account.sign_transaction(tx)
            tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            print(f"    [{'OK' if receipt.status==1 else 'FAILED'}]")
            time.sleep(3)

    # Estimate gas for mint
    block = w3.eth.get_block("latest")
    deadline = block.timestamp + 600
    params = (token0, token1, FEE, tick_lower, tick_upper, WZION_AMOUNT, SOL_AMOUNT, 0, 0, account.address, deadline)
    try:
        gas_est = npm.functions.mint(params).estimate_gas({"from": account.address})
        print(f"  Gas estimate: {gas_est}")
    except Exception as e:
        print(f"  Gas estimate failed: {e}")
        gas_est = 600000

    # Mint
    fn = npm.functions.mint(params)
    nonce = w3.eth.get_transaction_count(account.address)
    tx = fn.build_transaction({"from": account.address, "nonce": nonce, "gas": gas_est + 100000, "gasPrice": w3.eth.gas_price, "chainId": w3.eth.chain_id, "value": 0})
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    status = "OK" if receipt.status == 1 else "FAILED"
    print(f"  [{status}] TX: {tx_hash.hex()}  gas: {receipt.gasUsed}")

    if receipt.status == 1:
        for log in receipt.logs:
            if log["address"].lower() == NPM.lower():
                if log["topics"][0].hex() == "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef":
                    if int(log["topics"][1].hex(), 16) == 0:
                        token_id = int(log["topics"][3].hex(), 16)
                        print(f"  New NFT ID: {token_id}")

        count = npm.functions.balanceOf(account.address).call()
        print(f"  Total NFTs: {count}")
        for i in range(count):
            tid = npm.functions.tokenOfOwnerByIndex(account.address, i).call()
            pos = npm.functions.positions(tid).call()
            print(f"    NFT #{tid}: fee={pos[4]} tick=[{pos[5]},{pos[6]}] liq={pos[7]}")

    print(f"\n=== Final Balances ===")
    print(f"wZION: {wzion_c.functions.balanceOf(account.address).call() / 1e18:,.2f}")
    print(f"SOL:   {sol_c.functions.balanceOf(account.address).call() / 1e9:.6f}")
    print(f"WETH:  {weth_c.functions.balanceOf(account.address).call() / 1e18:.6f}")
    print(f"ETH:   {w3.eth.get_balance(account.address) / 1e18:.6f}")


if __name__ == "__main__":
    main()
