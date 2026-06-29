import socket, json
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(5)
try:
    s.connect(('127.0.0.1', 8443))
    req = json.dumps({'jsonrpc':'2.0','method':'getChainInfo','params':{},'id':1})
    s.sendall((req + '\n').encode())
    data = s.recv(4096)
    print('GOT:', data.decode()[:200])
except Exception as e:
    print('ERROR:', e)
finally:
    s.close()
