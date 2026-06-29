#!/usr/bin/env python3
"""Burn empty (liq=0, owed=0) Uniswap V3 NFT positions.

Target NFTs:
  #5431714  wZION/WETH fee=10000  liq=0  owed=0
  #5434637  wZION/USDT fee=3000   liq=0  owed=0
"""
from web3 import Web3

RPC = "https://base.publicnode.com"
KEY_FILE = "/root/zion-validator-key.env"
DEPLOYER = "0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186"
NPM = Web3.to_checksum_address("0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1")

BURN_NFTS = [5431714, 5434637]

NPM_ABI = [
    {"inputs":[{"name":"tokenId","type":"uint256"}],"name":"burn","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"name":"tokenId","type":"uint256"}],"name":"positions","outputs":[{"name":"nonce","type":"uint96"},{"name":"operator","type":"address"},{"name":"token0","type":"address"},{"name":"token1","type":"address"},{"name":"fee","type":"uint24"},{"name":"tickLower","type":"int24"},{"name":"tickUpper","type":"int24"},{"name":"liquidity","type":"uint128"},{"name":"feeGrowthInside0LastX128","type":"uint256"},{"name":"feeGrowthInside1LastX128","type":"uint256"},{"name":"tokensOwed0","type":"uint128"},{"name":"tokensOwed1","type":"uint128"}],"stateMutability":"view","type":"function"},
]


def load_key():
    with open(KEY_FILE) as f:
        for line in f:
            if line.startswith("ZION_VALIDATOR_PRIVATE_KEY="):
                return line.split("=", 1)[1].strip()
    raise RuntimeError("Key not found in " + KEY_FILE)


def main():
    w3 = Web3(Web3.HTTPProvider(RPC))
    key = load_key()
    account = w3.eth.account.from_key(key)
    print(f"Signer: {account.address}")
    assert account.address.lower() == DEPLOYER.lower(), "Wrong key!"

    npm = w3.eth.contract(address=NPM, abi=NPM_ABI)

    for nft_id in BURN_NFTS:
        pos = npm.functions.positions(nft_id).call()
        liq = pos[7]
        owed0 = pos[10]
        owed1 = pos[11]
        print(f"\nNFT #{nft_id}: liq={liq}  owed0={owed0}  owed1={owed1}")

        if liq != 0:
            print(f"  SKIP — liquidity={liq} (not zero, safe to burn only if 0)")
            continue
        if owed0 != 0 or owed1 != 0:
            print(f"  SKIP — tokensOwed not zero, collect first")
            continue

        print(f"  Burning NFT #{nft_id}...")
        nonce = w3.eth.get_transaction_count(account.address)
        gas_price = w3.eth.gas_price
        tx = npm.functions.burn(nft_id).build_transaction({
            "from": account.address,
            "nonce": nonce,
            "gas": 150000,
            "gasPrice": gas_price,
            "chainId": w3.eth.chain_id,
        })
        signed = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        print(f"  TX sent: {tx_hash.hex()}")
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        status = "OK" if receipt.status == 1 else "FAILED"
        print(f"  Receipt: {status}  block={receipt.blockNumber}  gas={receipt.gasUsed}")

    print("\nDone.")


if __name__ == "__main__":
    main()
