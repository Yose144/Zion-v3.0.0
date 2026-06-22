import requests, json
body = {"jsonrpc":"2.0","id":1,"method":"getTransaction","params":{"txid":"8eb0bb8cf048f0afdd5b319f2799935b7b4dd6c2e4068ad48a39ed889a4571f5"}}
r = requests.post("http://127.0.0.1:8443", json=body)
print(r.text)
