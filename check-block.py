import requests, json
for h in [11324, 11325, 11326]:
    body = {"jsonrpc":"2.0","id":1,"method":"getBlockByHeight","params":{"height":h}}
    r = requests.post("http://127.0.0.1:8443", json=body)
    data = r.json().get("result", {})
    print(f"--- Block {h} ---")
    print(f"tx count: {len(data.get('transactions', []))}")
    print(f"utxo tx count: {len(data.get('utxo_transactions', []))}")
    for utx in data.get('utxo_transactions', []):
        txid = utx.get('id', '')
        for i, out in enumerate(utx.get('outputs', [])):
            if out.get('address') == 'zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0':
                print(f"FOUND lock in {txid} output {i}: {out}")
    for tx in data.get('transactions', []):
        if tx.get('to') == 'zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0':
            print(f"account lock in {tx.get('tx_id')}: {tx}")
