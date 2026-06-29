#!/usr/bin/env python3
"""Clean up SOL/wZION pools and create one correct 0.01% pool at exact price."""
import time, json, urllib.request, math
from web3 import Web3
from eth_account import Account

RPC = "https://base.publicnode.com"
DEPLOYER = "0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186"
KEY_FILE = "/root/zion-validator-key.env"

WZION = Web3.to_checksum_address("0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6")
SOL = Web3.to_checksum_address("0x311935Cd80B76769bF2ecC9D8Ab7635b2139cf82")
WETH = Web3.to_checksum_address("0x4200000000000000000000000000000000000006")
NPM = Web3.to_checksum_address("0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1")
FACTORY = Web3.to_checksum_address("0x33128a8fC17869897dcE68Ed026d694621f6FDfD")

NEW_FEE = 100  # 0.01% fee, tick spacing 1
ACTIVE_SOL_NFT = 5434861  # 0.05% pool NFT to withdraw+burn

ERC20_ABI = [
    {"inputs": [{"name": "a", "type": "address"}], "name": "balanceOf", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"name": "o", "type": "address"}, {"name": "s", "type": "address"}], "name": "allowance", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"name": "s", "type": "address"}, {"name": "a", "type": "uint256"}], "name": "approve", "outputs": [{"name": "", "type": "bool"}], "stateMutability": "nonpayable", "type": "function"},
    {"inputs": [], "name": "deposit", "outputs": [], "stateMutability": "payable", "type": "function"},
]

NPM_ABI = [
    {"inputs": [{"components": [{"name": "tokenId", "type": "uint256"}, {"name": "liquidity", "type": "uint128"}, {"name": "amount0Min", "type": "uint256"}, {"name": "amount1Min", "type": "uint256"}, {"name": "deadline", "type": "uint256"}], "name": "params", "type": "tuple"}], "name": "decreaseLiquidity", "outputs": [{"name": "amount0", "type": "uint256"}, {"name": "amount1", "type": "uint256"}], "stateMutability": "nonpayable", "type": "function"},
    {"inputs": [{"components": [{"name": "tokenId", "type": "uint256"}, {"name": "recipient", "type": "address"}, {"name": "amount0Max", "type": "uint128"}, {"name": "amount1Max", "type": "uint128"}], "name": "params", "type": "tuple"}], "name": "collect", "outputs": [{"name": "amount0", "type": "uint256"}, {"name": "amount1", "type": "uint256"}], "stateMutability": "nonpayable", "type": "function"},
    {"inputs": [{"name": "tokenId", "type": "uint256"}], "name": "burn", "outputs": [], "stateMutability": "nonpayable", "type": "function"},
    {"inputs": [{"name": "token0", "type": "address"}, {"name": "token1", "type": "address"}, {"name": "fee", "type": "uint24"}, {"name": "sqrtPriceX96", "type": "uint160"}], "name": "createAndInitializePoolIfNecessary", "outputs": [{"name": "pool", "type": "address"}], "stateMutability": "nonpayable", "type": "function"},
    {"inputs": [{"components": [{"name": "token0", "type": "address"}, {"name": "token1", "type": "address"}, {"name": "fee", "type": "uint24"}, {"name": "tickLower", "type": "int24"}, {"name": "tickUpper", "type": "int24"}, {"name": "amount0Desired", "type": "uint256"}, {"name": "amount1Desired", "type": "uint256"}, {"name": "amount0Min", "type": "uint256"}, {"name": "amount1Min", "type": "uint256"}, {"name": "recipient", "type": "address"}, {"name": "deadline", "type": "uint256"}], "name": "params", "type": "tuple"}], "name": "mint", "outputs": [{"name": "tokenId", "type": "uint256"}, {"name": "liquidity", "type": "uint128"}, {"name": "amount0", "type": "uint256"}, {"name": "amount1", "type": "uint256"}], "stateMutability": "payable", "type": "function"},
    {"inputs": [{"name": "owner", "type": "address"}], "name": "balanceOf", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"name": "owner", "type": "address"}, {"name": "index", "type": "uint256"}], "name": "tokenOfOwnerByIndex", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"name": "tokenId", "type": "uint256"}], "name": "positions", "outputs": [{"name": "nonce", "type": "uint96"}, {"name": "operator", "type": "address"}, {"name": "token0", "type": "address"}, {"name": "token1", "type": "address"}, {"name": "fee", "type": "uint24"}, {"name": "tickLower", "type": "int24"}, {"name": "tickUpper", "type": "int24"}, {"name": "liquidity", "type": "uint128"}, {"name": "feeGrowthInside0LastX128", "type": "uint256"}, {"name": "feeGrowthInside1LastX128", "type": "uint256"}, {"name": "tokensOwed0", "type": "uint128"}, {"name": "tokensOwed1", "type": "uint128"}], "stateMutability": "view", "type": "function"},
]

MAX_UINT128 = (2**128) - 1


def load_key():
    with open(KEY_FILE) as f:
        for line in f:
            if line.startswith("ZION_VALIDATOR_PRIVATE_KEY="):
                return line.split("=", 1)[1].strip()


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


def kyber_swap(w3, account, src, dst, amount_in, src_dec, dst_dec):
    url = f"https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn={src}&tokenOut={dst}&amountIn={amount_in}&saveGas=false&gasPrice=0"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=15) as r:
        route = json.loads(r.read())["data"]["routeSummary"]
    dest_amount = int(route["amountOut"])
    print(f"    Quote: {amount_in / 10**src_dec:.6f} -> {dest_amount / 10**dst_dec:.6f}")
    build_url = "https://aggregator-api.kyberswap.com/base/api/v1/route/build"
    build_data = {"routeSummary": route, "sender": account.address, "recipient": account.address, "slippageTolerance": 2000, "deadLine": 9999999999}
    req2 = urllib.request.Request(build_url, data=json.dumps(build_data).encode(), headers={"User-Agent": "Mozilla/5.0", "Content-Type": "application/json"})
    with urllib.request.urlopen(req2, timeout=15) as r2:
        sd = json.loads(r2.read())["data"]
    return sd["routerAddress"], sd["data"], int(sd.get("gas", 500000)), dest_amount


def main():
    w3 = Web3(Web3.HTTPProvider(RPC))
    account = Account.from_key(load_key())
    npm = w3.eth.contract(address=NPM, abi=NPM_ABI)
    fac = w3.eth.contract(address=FACTORY, abi=[{"inputs": [{"name": "tokenA", "type": "address"}, {"name": "tokenB", "type": "address"}, {"name": "fee", "type": "uint24"}], "name": "getPool", "outputs": [{"name": "", "type": "address"}], "stateMutability": "view", "type": "function"}])
    wz = w3.eth.contract(address=WZION, abi=ERC20_ABI)
    sl = w3.eth.contract(address=SOL, abi=ERC20_ABI)
    weth = w3.eth.contract(address=WETH, abi=ERC20_ABI)

    print("=" * 60)
    print("FINAL CLEANUP: SOL/wZION exact price")
    print("=" * 60)
    print(f"wZION: {wz.functions.balanceOf(account.address).call() / 1e18:,.2f}")
    print(f"SOL:   {sl.functions.balanceOf(account.address).call() / 1e9:.6f}")
    print(f"WETH:  {weth.functions.balanceOf(account.address).call() / 1e18:.6f}")
    print(f"ETH:   {w3.eth.get_balance(account.address) / 1e18:.6f}")
    print()

    # 1. Withdraw active 0.05% pool NFT
    print(f"STEP 1: Withdraw NFT #{ACTIVE_SOL_NFT}")
    pos = npm.functions.positions(ACTIVE_SOL_NFT).call()
    liq = pos[7]
    print(f"  liq={liq}")
    if liq > 0:
        deadline = w3.eth.get_block("latest").timestamp + 600
        fn = npm.functions.decreaseLiquidity((ACTIVE_SOL_NFT, liq, 0, 0, deadline))
        tx_hash, receipt = send_tx(w3, account, fn, gas_limit=300000)
        print(f"  decrease: {'OK' if receipt.status==1 else 'FAIL'}")
        time.sleep(2)
        fn = npm.functions.collect((ACTIVE_SOL_NFT, account.address, MAX_UINT128, MAX_UINT128))
        tx_hash, receipt = send_tx(w3, account, fn, gas_limit=200000)
        print(f"  collect: {'OK' if receipt.status==1 else 'FAIL'}")
        time.sleep(2)
    fn = npm.functions.burn(ACTIVE_SOL_NFT)
    tx_hash, receipt = send_tx(w3, account, fn, gas_limit=150000)
    print(f"  burn: {'OK' if receipt.status==1 else 'FAIL'}")
    time.sleep(2)
    print()

    # 2. Calculate exact price and deposit ratio
    SOL_PRICE = 73.44
    ZION_PRICE = 0.0002
    zion_per_sol = SOL_PRICE / ZION_PRICE
    sol_per_zion = ZION_PRICE / SOL_PRICE
    price_raw = (sol_per_zion * 1e9) / 1e18
    sqrt_price_x96 = int(math.sqrt(price_raw) * (2**96))
    tick_exact = math.log(price_raw) / math.log(1.0001)
    tick = math.floor(tick_exact)
    tick_lower = tick - 5000
    tick_upper = tick + 5000

    # For 0.01% fee, tick spacing is 1, so all ticks are valid
    # Calculate exact amount1 for 100K wZION
    p = price_raw
    p_a = 1.0001 ** tick_lower
    p_b = 1.0001 ** tick_upper
    sqrt_p = math.sqrt(p)
    sqrt_pa = math.sqrt(p_a)
    sqrt_pb = math.sqrt(p_b)
    amount0 = 100_000 * 10**18  # 100K wZION
    L = amount0 * sqrt_p * sqrt_pb / (sqrt_pb - sqrt_p)
    amount1 = int(L * (sqrt_p - sqrt_pa))

    print("STEP 2: Calculate exact ratio")
    print(f"  SOL price: ${SOL_PRICE}, ZION price: ${ZION_PRICE}")
    print(f"  1 SOL = {zion_per_sol:,.0f} ZION")
    print(f"  sqrtPriceX96 = {sqrt_price_x96}")
    print(f"  tick = {tick} (exact {tick_exact:.2f})")
    print(f"  range = [{tick_lower}, {tick_upper}]")
    print(f"  wZION desired: {amount0 / 1e18:,.0f}")
    print(f"  SOL needed:    {amount1 / 1e9:.6f}")
    print()

    # 3. Get SOL if needed
    sol_have = sl.functions.balanceOf(account.address).call()
    if sol_have < amount1:
        sol_needed = amount1 - sol_have + int(0.001 * 1e9)  # small buffer
        # estimate WETH needed: 0.001 WETH -> ~0.021 SOL, so scale linearly
        weth_needed = max(int(sol_needed / 1e9 / 0.021 * 0.001 * 1e18), Web3.to_wei(0.001, "ether"))
        weth_needed = min(weth_needed, Web3.to_wei(0.015, "ether"))
        print(f"STEP 3: Need {sol_needed / 1e9:.6f} more SOL -> swap {weth_needed / 1e18:.6f} WETH")

        # Wrap if needed
        if weth_needed > weth.functions.balanceOf(account.address).call():
            wrap_amount = weth_needed - weth.functions.balanceOf(account.address).call()
            max_wrap = w3.eth.get_balance(account.address) - Web3.to_wei(0.005, "ether")
            wrap_amount = min(wrap_amount, max_wrap)
            if wrap_amount > 0:
                fn = weth.functions.deposit()
                tx_hash, receipt = send_tx(w3, account, fn, gas_limit=100000, value=wrap_amount)
                print(f"  wrap: {'OK' if receipt.status==1 else 'FAIL'}")
                time.sleep(2)

        # KyberSwap
        weth_bal = weth.functions.balanceOf(account.address).call()
        if weth_bal > 0:
            swap_amount = min(weth_needed, weth_bal)
            print(f"  Swapping {swap_amount / 1e18:.6f} WETH...")
            router, calldata, gas_limit, _ = kyber_swap(w3, account, WETH, SOL, swap_amount, 18, 9)
            router = Web3.to_checksum_address(router)
            if weth.functions.allowance(account.address, router).call() < swap_amount:
                fn = weth.functions.approve(router, swap_amount * 2)
                tx_hash, receipt = send_tx(w3, account, fn, gas_limit=100000)
                print(f"  approve: {'OK' if receipt.status==1 else 'FAIL'}")
                time.sleep(2)
            nonce = w3.eth.get_transaction_count(account.address)
            tx = {"from": account.address, "to": router, "data": calldata, "nonce": nonce, "gas": gas_limit + 200000, "gasPrice": w3.eth.gas_price, "chainId": w3.eth.chain_id, "value": 0}
            signed = account.sign_transaction(tx)
            tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            print(f"  swap: {'OK' if receipt.status==1 else 'FAIL'} gas: {receipt.gasUsed}")
            time.sleep(3)
    else:
        print("STEP 3: SOL sufficient")

    sol_have = sl.functions.balanceOf(account.address).call()
    if sol_have < amount1:
        print(f"Not enough SOL. Have {sol_have / 1e9:.6f}, need {amount1 / 1e9:.6f}. Aborting.")
        return

    # 4. Create 0.01% pool
    print("\nSTEP 4: Create 0.01% pool at exact price")
    token0, token1 = WZION, SOL
    pool = fac.functions.getPool(token0, token1, NEW_FEE).call()
    print(f"  Existing pool (fee=100): {pool}")
    if pool == "0x0000000000000000000000000000000000000000":
        fn = npm.functions.createAndInitializePoolIfNecessary(token0, token1, NEW_FEE, sqrt_price_x96)
        tx_hash, receipt = send_tx(w3, account, fn, gas_limit=5000000)
        print(f"  create: {'OK' if receipt.status==1 else 'FAIL'} gas: {receipt.gasUsed}")
        time.sleep(3)
        pool = fac.functions.getPool(token0, token1, NEW_FEE).call()
    print(f"  Pool: {pool}")
    print()

    # 5. Mint exact ratio
    print("STEP 5: Mint exact ratio")
    for tok, amt, name in [(WZION, amount0, "wZION"), (SOL, amount1, "SOL")]:
        c = w3.eth.contract(address=tok, abi=ERC20_ABI)
        if c.functions.allowance(account.address, NPM).call() < amt:
            fn = c.functions.approve(NPM, amt * 2)
            tx_hash, receipt = send_tx(w3, account, fn, gas_limit=100000)
            print(f"  approve {name}: {'OK' if receipt.status==1 else 'FAIL'}")
            time.sleep(2)

    deadline = w3.eth.get_block("latest").timestamp + 600
    params = (token0, token1, NEW_FEE, tick_lower, tick_upper, amount0, amount1, 0, 0, account.address, deadline)
    try:
        gas_est = npm.functions.mint(params).estimate_gas({"from": account.address})
        print(f"  Gas estimate: {gas_est}")
    except Exception as e:
        print(f"  Gas estimate failed: {e}")
        gas_est = 600000

    fn = npm.functions.mint(params)
    tx_hash, receipt = send_tx(w3, account, fn, gas_limit=gas_est + 100000)
    status = "OK" if receipt.status == 1 else "FAIL"
    print(f"  mint: {status} gas: {receipt.gasUsed} TX: {tx_hash.hex()}")
    if receipt.status == 1:
        for log in receipt.logs:
            if log["address"].lower() == NPM.lower() and log["topics"][0].hex() == Web3.keccak(text="IncreaseLiquidity(uint256,uint128,uint256,uint256)").hex():
                tid = int(log["topics"][1].hex(), 16)
                liq = int.from_bytes(log["data"][:32], "big")
                a0 = int.from_bytes(log["data"][32:64], "big")
                a1 = int.from_bytes(log["data"][64:96], "big")
                print(f"  NFT #{tid}: liq={liq} wZION={a0 / 1e18:,.2f} SOL={a1 / 1e9:.6f}")
    print()

    # 6. Verify
    POOL_ABI = [
        {"inputs": [], "name": "liquidity", "outputs": [{"name": "", "type": "uint128"}], "stateMutability": "view", "type": "function"},
        {"inputs": [], "name": "slot0", "outputs": [{"name": "sqrtPriceX96", "type": "uint160"}, {"name": "tick", "type": "int24"}, {"name": "a", "type": "uint16"}, {"name": "b", "type": "uint16"}, {"name": "c", "type": "uint16"}, {"name": "d", "type": "uint8"}, {"name": "e", "type": "bool"}], "stateMutability": "view", "type": "function"},
    ]
    ppc = w3.eth.contract(address=Web3.to_checksum_address(pool), abi=POOL_ABI)
    s0 = ppc.functions.slot0().call()
    pool_liq = ppc.functions.liquidity().call()
    pr_raw = (s0[0] / (2**96)) ** 2
    actual_zion_per_sol = 1 / (pr_raw * 1e18 / 1e9)
    print("STEP 6: Verify")
    print(f"  Pool: {pool}")
    print(f"  Liquidity: {pool_liq}")
    print(f"  Tick: {s0[1]}")
    print(f"  Price: 1 SOL = {actual_zion_per_sol:,.0f} ZION (target {zion_per_sol:,.0f})")
    print(f"  Pool wZION: {wz.functions.balanceOf(Web3.to_checksum_address(pool)).call() / 1e18:,.2f}")
    print(f"  Pool SOL:   {sl.functions.balanceOf(Web3.to_checksum_address(pool)).call() / 1e9:.6f}")
    print(f"  Final deployer: wZION={wz.functions.balanceOf(account.address).call() / 1e18:,.2f} SOL={sl.functions.balanceOf(account.address).call() / 1e9:.6f} ETH={w3.eth.get_balance(account.address) / 1e18:.6f}")

    print(f"\n  NFTs ({npm.functions.balanceOf(account.address).call()}):")
    for i in range(npm.functions.balanceOf(account.address).call()):
        tid = npm.functions.tokenOfOwnerByIndex(account.address, i).call()
        p = npm.functions.positions(tid).call()
        t0, t1, f = p[2], p[3], p[4]
        if t0.lower() == WZION.lower() and t1.lower() == SOL.lower():
            name = "wZION/SOL"
        elif t0.lower() == WZION.lower() and t1.lower() == WETH.lower():
            name = "wZION/WETH"
        elif t0.lower() == WZION.lower() and t1.lower() == "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2":
            name = "wZION/USDT"
        else:
            name = f"{t0[:8]}/{t1[:8]}"
        print(f"    NFT #{tid}: {name} fee={f} tick=[{p[5]},{p[6]}] liq={p[7]}")


if __name__ == "__main__":
    main()
