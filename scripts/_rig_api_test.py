#!/usr/bin/env python3
"""Test SMOS API auth and find working endpoints."""
import requests, json

API = "https://api.simplemining.net"
TOKEN = "api-7a77595ab5176d2ea864c14e8b976a937c34b7e29cb486840e30729ad40f06c8"
H = {"Authorization": f"Bearer {TOKEN}"}

endpoints = [
    ("GET", "/rigs"),
    ("GET", "/rig-groups"),
    ("GET", "/rig-commands"),
    ("GET", "/account"),
    ("GET", "/user"),
]

for method, path in endpoints:
    try:
        r = requests.request(method, f"{API}{path}", headers=H, timeout=10)
        body = r.text[:300]
        print(f"{method} {path} -> HTTP {r.status_code}")
        if r.status_code == 200:
            data = r.json()
            if isinstance(data, list):
                print(f"  Array of {len(data)} items")
                if data:
                    print(f"  First item keys: {list(data[0].keys())[:15]}")
            elif isinstance(data, dict):
                print(f"  Keys: {list(data.keys())[:15]}")
        else:
            print(f"  {body[:200]}")
    except Exception as e:
        print(f"{method} {path} -> Error: {e}")
    print()
