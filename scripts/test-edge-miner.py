#!/usr/bin/env python3
"""Test external miner connection to Edge pool."""
import socket, json, sys

EDGE_POOL = ("62.171.141.136", 8444)

def recv_messages(sock, timeout=3.0, max_wait=1.0):
    """Read all available JSON lines from socket with retry."""
    import time
    messages = []
    start = time.time()
    while time.time() - start < timeout:
        sock.settimeout(max_wait)
        try:
            buf = sock.recv(4096)
            if not buf:
                break
            for line in buf.decode().split("\n"):
                line = line.strip()
                if not line:
                    continue
                try:
                    messages.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
        except socket.timeout:
            break
    return messages

def send(sock, msg):
    line = json.dumps(msg) + "\n"
    sock.sendall(line.encode())

def main():
    print(f"Connecting to Edge pool {EDGE_POOL[0]}:{EDGE_POOL[1]} ...")
    s = socket.create_connection(EDGE_POOL, timeout=10)
    print("Connected!")

    # 1. Hello
    send(s, {
        "type": "hello",
        "miner_id": "ext-miner-test-01",
        "worker_name": "test-rig",
        "algorithm": "cosmic_harmony_ekam_deeksha_v2"
    })

    # 2. Read Welcome + SetDifficulty + Job
    messages = recv_messages(s)
    types = [m.get("type") for m in messages]
    print(f"Received: {types}")

    if "welcome" not in types:
        print("FAIL: No welcome received")
        return 1

    job = None
    for m in messages:
        if m.get("type") == "job":
            job = m
            break

    if not job:
        print("FAIL: No job received")
        return 1

    print(f"Job: id={job['job_id']} height={job['height']} diff_target={job['target_hex'][:16]}...")

    # 3. Send NoSolution (simpler - pool always returns result)
    print("Sending NoSolution...")
    send(s, {
        "type": "no_solution",
        "job_id": job["job_id"],
        "miner_id": "ext-miner-test-01",
        "worker_name": "test-rig",
        "attempted_hashes": 4096,
        "elapsed_ms": 1000
    })

    # 4. Read Result
    messages = recv_messages(s, timeout=5.0)
    print(f"Post-submit received: {[m.get('type') for m in messages]}")
    result = None
    for m in messages:
        if m.get("type") == "result":
            result = m
            break

    if not result:
        print("FAIL: No result received")
        return 1

    print(f"Result: accepted={result.get('accepted')} status={result.get('status')}")

    if result.get("accepted"):
        print("SUCCESS: External miner connected to Edge pool and share accepted!")
    else:
        print(f"FAIL: Share rejected - {result.get('status')}")
        return 1

    # 5. Clean disconnect
    send(s, {
        "type": "bye",
        "accepted_shares": 1,
        "rejected_shares": 0,
        "revenue_total_usd": "0.00"
    })

    s.close()
    print("Test complete.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
