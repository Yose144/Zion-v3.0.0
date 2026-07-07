import requests, json
body = {"jsonrpc":"2.0","id":1,"method":"getBlockByHeight","params":{"height":11324}}
r = requests.post("http://127.0.0.1:8443", json=body)
data = r.json().get("result", {})
for utx in data.get("utxo_transactions", []):
    for out in utx.get("outputs", []):
        if out.get("address") == "zion1j53677g5k83030x3s2z2z644e7h07792q0u02t7":
            amt = out.get("amount", 0)
            print(f"UTXO to bridge vault: {amt} flowers = {amt / 1e12} ZION")
        else:
            amt = out.get("amount", 0)
            print(f"Change to {out.get('address','')[:20]}...: {amt} flowers = {amt / 1e12} ZION")
