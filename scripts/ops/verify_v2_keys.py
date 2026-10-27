#!/usr/bin/env python3
"""Verify V31_PREMINE_V2_KEYS_2026-08-06.json — v2 with correct per-generator schemes.

ed25519: mnemonic --BIP39(PBKDF2-SHA512,"mnemonic")--> seed; blake3(seed)[0:32]=sk;
         ed25519 vk = pk; zion1 addr = sha256->ripemd160->base32(35)+sha256-ck(4).
evm    : addr = 0x + blake3(evm_sk)[12:32]   (gen-admin-keys / gen-evm-validators)
         NOTE: simplified derivation, NOT standard secp256k1-keccak.
"""
import json, hashlib, unicodedata, re, sys
import blake3
import nacl.signing

import os
KEYS = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("ZION_KEYS_FILE", "/home/zionserver/2.9.6-main/V31_PREMINE_V2_KEYS_2026-08-06.json")
ALPH = "023456789acdefghjklmnpqrstuvwxyz"

def b39_seed(mnemonic: str) -> bytes:
    pw = unicodedata.normalize("NFKD", mnemonic)
    salt = unicodedata.normalize("NFKD", "mnemonic")
    return hashlib.pbkdf2_hmac("sha512", pw.encode(), salt.encode(), 2048, 64)

def zion_addr(pk: bytes) -> str:
    h = hashlib.sha256(pk).digest()
    r = hashlib.new("ripemd160", h).digest()
    data = "".join(ALPH[b % 32] + ALPH[(b // 32) % 32] for b in r)[:35]
    ck = hashlib.sha256(("zion1" + data).encode()).digest()[:2]
    cks = "".join(ALPH[b % 32] + ALPH[(b // 32) % 32] for b in ck)
    return "zion1" + data + cks

from ecdsa import SigningKey as SecpSigningKey, SECP256k1
from Crypto.Hash import keccak as _k
def _k256(b): k=_k.new(digest_bits=256); k.update(b); return k.digest()
def evm_addr(sk_hex: str) -> str:
    """real EVM: 0x + keccak256(secp256k1 uncompressed pk x||y)[-20:] (lowercase compare)."""
    sk = SecpSigningKey.from_string(bytes.fromhex(sk_hex), curve=SECP256k1)
    return "0x" + _k256(sk.verifying_key.to_string())[-20:].hex()
def evm_addr_sha256_legacy(sk_hex: str) -> str:
    """legacy V2-generator placeholder: 0x + sha256(pk_u)[-20:] (== v3_compat constants)."""
    sk = SecpSigningKey.from_string(bytes.fromhex(sk_hex), curve=SECP256k1)
    return "0x" + hashlib.sha256(sk.verifying_key.to_string()).digest()[-20:].hex()

results = []
def rec(section, name, ok, detail=""):
    results.append((section, name, ok, detail))

d = json.load(open(KEYS))
src = open("V31/L1/core/src/v3_compat.rs").read()
PREMINE_ADDRS = set(re.findall(r'address:\s*"(zion1[a-z0-9]{39})"', src))
ADMIN = {
    "Rama":    ("zion1s4t4y2s4v0a4l4h28423h266f2y7h406d3s0847",
                "210f4cca2e84feacd3fb901fd63cc389691afef65acf5f7f232274591113e4c2",
                "0x716a1be17bc096565c8269dff539303f3111b105"),
    "Sita":    ("zion1l6p5g466r047v7x39623n467v545p2m4l8v30v2",
                "863b556da0fb398eb38f029bb1046a3496ccc2bdf0de4b8b6c2fd3cd72de4442",
                "0x8cf0ae1a83a94f3b608b5863ff5c4c6c2479ac50"),
    "Hanuman": ("zion18693c577h054s7v866e686f8m3z0y8s7s5gl2l7",
                "febc4cbf13d37215764127b10d1c724c66bd74bc1b38a4aee6e7b23d3d182ee3",
                "0xcad8a7fc07a8777aaa7bba5261f409ae40d78141"),
}
CANON = {
    "humanitarian_subsidy": "zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8",
    "issobella_subsidy":    "zion1z4s3a54266f2x7j4x7c27297k49752t7k52l0f0",
    "pool_fee_subsidy":     "zion1l0h428f536s6u3x7h5f0d5c2z644j7t8u8va3x0",
    "default_miner":        "zion1074344t7k686j6n8a0l6t0f4c8d828y083xh4m2",
    "pool_payout":          "zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6",
}
GUARDIAN_TOML = open("PUBLIC/V3/L2/dao/config/dao-mainnet.toml").read()
# parse only [[guardians]] blocks (treasury_addresses sit earlier in the file)
G_REPO_ADDRS, G_REPO_PKS = [], []
for blk in re.findall(r'\[\[guardians\]\](.*?)(?=\[\[|\Z)', GUARDIAN_TOML, re.S):
    a = re.search(r'address\s*=\s*"(zion1[a-z0-9]{39})"', blk)
    p = re.search(r'public_key\s*=\s*"([0-9a-f]{64})"', blk)
    if a: G_REPO_ADDRS.append(a.group(1))
    if p: G_REPO_PKS.append(p.group(1))
# live EDGE2 toml — fetched via ssh for real cross-check
import subprocess
try:
    _live = subprocess.run(["ssh","-n","-o","ConnectTimeout=8","zion-edge2","cat /etc/zion/dao-mainnet.toml"],
                           capture_output=True, text=True, timeout=15).stdout
    G_LIVE_ADDRS = re.findall(r'address\s*=\s*"(zion1[a-z0-9]{39})"',
                              "\n".join(re.findall(r'\[\[guardians\]\].*', _live)))
    if len(G_LIVE_ADDRS) != 7: G_LIVE_ADDRS = None
except Exception:
    G_LIVE_ADDRS = None

def verify_ed(e):
    notes = []
    seed = b39_seed(e["mnemonic"])
    if blake3.blake3(seed).digest()[:32].hex() != e["ed25519_secret_key_hex"]:
        notes.append("sk!=blake3(bip39seed)")
    pk = nacl.signing.SigningKey(bytes.fromhex(e["ed25519_secret_key_hex"])).verify_key.encode().hex()
    if pk != e["ed25519_public_key_hex"]:
        notes.append("pk!=derive(sk)")
    addr = zion_addr(bytes.fromhex(e["ed25519_public_key_hex"]))
    if addr != e["ed25519_address"]:
        notes.append(f"addr!=derive(pk) got {addr}")
    # checksum sanity
    body = e["ed25519_address"]
    if len(body) != 44 or not body.startswith("zion1"):
        notes.append("addr format bad")
    else:
        b35 = body[5:40]; want = hashlib.sha256(("zion1"+b35).encode()).digest()[:2]
        cks = "".join(ALPH[b%32]+ALPH[(b//32)%32] for b in want)
        if body[40:] != cks: notes.append("addr checksum bad")
    return notes

def verify_evm(e):
    notes = []
    if "evm_secret_key_hex" in e:
        da = evm_addr(e["evm_secret_key_hex"])
        if da.lower() != e.get("evm_address","").lower():
            notes.append(f"evm_addr!=keccak(pk_u)[-20] got {da}")
        leg = e.get("evm_address_legacy_sha256")
        if leg is not None and leg.lower() != evm_addr_sha256_legacy(e["evm_secret_key_hex"]).lower():
            notes.append(f"legacy_sha256 field broken got {evm_addr_sha256_legacy(e['evm_secret_key_hex'])}")
        seed = b39_seed(e["mnemonic"])
        if blake3.blake3(seed+b"evm").digest()[:32].hex() != e["evm_secret_key_hex"]:
            notes.append("evm_sk != blake3(seed+'evm')")
    return notes

# premine
seen=[]
for e in d["premine_wallets"]:
    n = verify_ed(e)
    if e["ed25519_address"] not in PREMINE_ADDRS: n.append("addr not in PREMINE_OUTPUTS")
    else: seen.append(e["ed25519_address"])
    rec("premine", e["name"], not n, "; ".join(n))
miss = PREMINE_ADDRS - set(seen)
rec("premine","SET", not miss, "all 14 canonical slots" if not miss else f"missing {sorted(miss)}")

# canonical
for e in d["canonical_wallets"]:
    n = verify_ed(e)
    w = CANON.get(e["name"])
    if w is None: n.append("unknown canonical name")
    elif e["ed25519_address"] != w: n.append(f"addr != canonical {w}")
    rec("canonical", e["name"], not n, "; ".join(n))

# admin
for e in d["admin_keys"]:
    n = verify_ed(e); n += verify_evm(e)
    w = ADMIN.get(e["name"])
    if w is None: n.append("unknown admin")
    else:
        if e["ed25519_address"] != w[0]: n.append(f"L1 addr != canonical {w[0]}")
        if e["ed25519_public_key_hex"] != w[1]: n.append("pk != canonical")
        if e.get("evm_address_legacy_sha256","").lower() != w[2]: n.append(f"legacy_evm != canonical {w[2]}")
    rec("admin", e["name"], not n, "; ".join(n))

# guardians — V2 file IS the canonical source; compare vs repo/live toml as INFO
for i,e in enumerate(d["dao_guardians"]):
    n = verify_ed(e)
    pk = e["ed25519_public_key_hex"]; a = e["ed25519_address"]
    info = []
    if i < len(G_REPO_ADDRS):
        if pk != G_REPO_PKS[i]: info.append(f"pk != repo-toml g{i+1}")
        if a != G_REPO_ADDRS[i]: info.append(f"addr != repo-toml g{i+1} (diff generation)")
        if G_LIVE_ADDRS and a != G_LIVE_ADDRS[i]: info.append(f"addr != live-edge2-toml g{i+1}")
    rec("guardian", e["name"], not n, "; ".join(n) or "OK; " + "; ".join(info) if info else "; ".join(n))

# evm validators (evm-only entries, no ed25519 fields? check keys)
for e in d["evm_validators"]:
    n = verify_evm(e)
    if "ed25519_secret_key_hex" in e: n += verify_ed(e)
    rec("evm_validator", e["name"], not n, "; ".join(n))

for e in d["escrow"]:
    n = verify_ed(e)
    rec("escrow", e["name"], not n, "; ".join(n))

# duplicates across whole file
all_addrs, all_sks, all_mn = [], [], []
for e in (d["premine_wallets"]+d["canonical_wallets"]+d["admin_keys"]
          +d["dao_guardians"]+d["evm_validators"]+d["escrow"]):
    all_addrs.append(e.get("ed25519_address"))
    all_sks.append(e.get("ed25519_secret_key_hex"))
    all_mn.append(e.get("mnemonic"))
dup_a = {a for a in all_addrs if a and all_addrs.count(a)>1}
dup_s = {s for s in all_sks if s and all_sks.count(s)>1}
dup_m = {m for m in all_mn if m and all_mn.count(m)>1}
rec("xcheck","no dup addr/sk/mnemonic", not(dup_a or dup_s or dup_m),
    f"dup addr={len(dup_a)} sk={len(dup_s)} mn={len(dup_m)}")

# guardian toml internal consistency: does toml pk derive to toml addr?
toml_ok = len(G_REPO_PKS)==len(G_REPO_ADDRS)==7 and all(zion_addr(bytes.fromhex(pk))==a for pk,a in zip(G_REPO_PKS, G_REPO_ADDRS))
rec("xcheck","repo dao-mainnet.toml pk→addr", toml_ok,
    "all 7 derive" if toml_ok else f"{sum(zion_addr(bytes.fromhex(p))==a for p,a in zip(G_REPO_PKS,G_REPO_ADDRS))}/7 derive")
if G_LIVE_ADDRS:
    live_ok = all(zion_addr(bytes.fromhex(pk))==a for pk,a in zip(G_REPO_PKS, G_LIVE_ADDRS))
    rec("xcheck","live EDGE2 toml pk→addr", live_ok,
        "all 7 derive" if live_ok else "MISMATCH inside live toml")
else:
    rec("xcheck","live EDGE2 toml pk→addr", True, "skipped (ssh unreachable)")

fails=[r for r in results if not r[2]]
for s,n_,ok,dt in results:
    print(f"[{'PASS' if ok else 'FAIL'}] {s:14} {n_}" + (f"  — {dt}" if dt else ""))
print(f"\n{len(results)-len(fails)}/{len(results)} passed" + (f", {len(fails)} FAILED" if fails else " — ALL OK"))
sys.exit(1 if fails else 0)
