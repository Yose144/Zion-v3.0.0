import socket, json, time

s = socket.socket()
s.settimeout(5)
try:
    s.connect(("77.42.31.72", 3333))
    print("TCP connect OK")
    wallet = "zion1gfhhxm5hg87cflh6vuyazfklp3c6agx0gfhhxm5"
    msg = json.dumps({"id":1,"method":"login","params":{"login":wallet,"pass":"x","agent":"debug/1.0","algo":"cosmic_harmony_v3"}}) + "\n"
    s.sendall(msg.encode())
    data = b""
    for _ in range(5):
        time.sleep(1)
        try:
            chunk = s.recv(8192)
            if not chunk: break
            data += chunk
        except: break
    print(f"Received {len(data)} bytes")
    if data:
        for line in data.decode(errors="replace").strip().split("\n"):
            try:
                obj = json.loads(line)
                print(json.dumps(obj, indent=2)[:2000])
            except:
                print(line[:500])
    else:
        print("NO DATA - stratum dead")
except Exception as e:
    print(f"ERROR: {e}")
finally:
    s.close()
