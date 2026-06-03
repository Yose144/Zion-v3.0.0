"""JSON-RPC client for ZION node TCP interface."""
import json
import socket


def rpc_call(host: str, port: int, method: str, params: dict, timeout: float = 2.0) -> dict:
    """Simple TCP JSON-RPC call to ZION node. Returns result dict or None on failure."""
    try:
        payload = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}) + "\n"
        with socket.create_connection((host, port), timeout=timeout) as sock:
            sock.sendall(payload.encode("utf-8"))
            sock.settimeout(timeout)
            data = b""
            while True:
                try:
                    chunk = sock.recv(4096)
                    if not chunk:
                        break
                    data += chunk
                    if b"\n" in data:
                        break
                except socket.timeout:
                    break
        for line in data.decode("utf-8", errors="ignore").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                resp = json.loads(line)
                if "result" in resp:
                    return resp["result"]
                if "error" in resp and resp["error"]:
                    return {"_rpc_error": resp["error"]}
            except json.JSONDecodeError:
                continue
        return None
    except Exception:
        return None
