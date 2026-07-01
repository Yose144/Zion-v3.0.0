import socket, json

def rpc(method, params={}):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(5)
    s.connect(('127.0.0.1', 8443))
    req = json.dumps({'jsonrpc':'2.0','method':method,'params':params,'id':1})
    s.sendall((req + '\n').encode())
    data = b''
    while True:
        chunk = s.recv(4096)
        if not chunk:
            break
        data += chunk
        if b'\n' in data:
            break
    s.close()
    return json.loads(data.decode().strip())

# Check escrow balance
escrow = 'zion1y0j484d5e8r49785d253e8w0c2x4t3n792m5724'
bal = rpc('getBalance', {'address': escrow})
print('Escrow balance:', json.dumps(bal.get('result', bal), indent=2))

# Check deployer balance
deployer = 'zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604'
bal2 = rpc('getBalance', {'address': deployer})
print('Deployer balance:', json.dumps(bal2.get('result', bal2), indent=2))
