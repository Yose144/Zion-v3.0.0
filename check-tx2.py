import requests, json
body = {"jsonrpc":"2.0","id":1,"method":"getBlockByHeight","params":{"height":11324}}
r = requests.post("http://127.0.0.1:8443", json=body)
data = r.json().get("result", {})
for utx in data.get("utxo_transactions", []):
    if [b for b in utx.get("id", [])] == [142, 176, 187, 140, 240, 72, 240, 175, 221, 91, 49, 159, 39, 153, 147, 91, 123, 77, 214, 194, 228, 6, 138, 212, 138, 57, 237, 136, 154, 69, 113, 245]:
        print(json.dumps(utx, indent=2))
