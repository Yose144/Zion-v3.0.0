#!/usr/bin/env python3
"""Test SMOS API auth and find working endpoints."""
import requests, json

API = "https://api.simplemining.net"
TOKEN = "api-2ca5dec3ec452561ea893f8804e61e2f43b9ecd30d0614404a2e8e43b7d0212d"
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
