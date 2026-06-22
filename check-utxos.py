import requests, json
body = {"jsonrpc":"2.0","id":1,"method":"getUtxos","params":{"address":"zion1r565v3k2u8p8t6n494p0n527c0m7a5s4s5ae0x7"}}
r = requests.post("http://127.0.0.1:8443", json=body)
print(r.status_code)
print(r.text)
