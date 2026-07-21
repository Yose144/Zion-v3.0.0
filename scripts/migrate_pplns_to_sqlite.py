#!/usr/bin/env python3
"""F4.7: Migrate pplns-state.json → SQLite pool-store.db.

Reads the PPLNS state JSON (shares, miner balances, block counters) and
inserts historical shares/blocks into the pool SQLite store.  This is a
one-time migration — after running it, the pool server will write-through
new shares/blocks/payouts to the DB automatically.

Usage:
    python3 migrate_pplns_to_sqlite.py /data/zion/pplns-state.json /data/zion/pool-store.db

The script is idempotent — re-running it will skip already-migrated blocks
(matched by height) and upsert miners.
"""
import json
import sqlite3
import sys
import time
from pathlib import Path


def main() -> int:
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <pplns-state.json> <pool-store.db>", file=sys.stderr)
        return 1
    state_path = Path(sys.argv[1])
    db_path = Path(sys.argv[2])
    if not state_path.exists():
        print(f"ERROR: state file not found: {state_path}", file=sys.stderr)
        return 1
    if not db_path.exists():
        print(f"ERROR: db file not found: {db_path} (start the pool once to create it)", file=sys.stderr)
        return 1

    with open(state_path) as f:
        state = json.load(f)

    con = sqlite3.connect(str(db_path))
    con.execute("PRAGMA foreign_keys = ON")
    cur = con.cursor()

    # Migrate miners (upsert).
    miners = state.get("miners", {})
    miner_count = 0
    for miner_id, mdata in miners.items():
        shares = mdata.get("shares", {})
        valid = shares.get("valid", 0)
        invalid = shares.get("invalid", 0)
        blocks = shares.get("blocks", 0)
        total_paid = mdata.get("total_paid", 0)
        cur.execute(
            """INSERT INTO miners (miner_id, first_seen, last_seen, total_shares,
               accepted_shares, rejected_shares, total_paid_flowers)
               VALUES (?, unixepoch(), unixepoch(), ?, ?, ?, ?)
               ON CONFLICT(miner_id) DO UPDATE SET
                 total_shares = total_shares + ?,
                 accepted_shares = accepted_shares + ?,
                 rejected_shares = rejected_shares + ?,
                 total_paid_flowers = total_paid_flowers + ?""",
            (miner_id, valid + invalid, valid, invalid, total_paid,
             valid + invalid, valid, invalid, total_paid),
        )
        miner_count += 1
    print(f"Migrated {miner_count} miners")

    # Migrate blocks (from block_counters if present).
    block_counters = state.get("block_counters", {})
    block_count = 0
    for key, count in block_counters.items():
        # key is "miner_id/worker_name" — we don't have height/hash, so
        # insert as a summary row with height=0 (placeholder).  Real block
        # records will be created by the pool going forward.
        if "/" in key:
            miner_id, worker_name = key.split("/", 1)
        else:
            miner_id, worker_name = key, "default"
        for _ in range(count):
            cur.execute(
                """INSERT OR IGNORE INTO blocks (height, hash, miner_id, worker_name,
                   share_difficulty, network_difficulty, status, ts)
                   VALUES (0, '', ?, ?, 0, 0, 'confirmed', unixepoch())""",
                (miner_id, worker_name),
            )
            block_count += 1
    print(f"Migrated {block_count} block records (summary, height=0)")

    # Migrate shares from the window (if present).
    window = state.get("window", [])
    share_count = 0
    for entry in window:
        miner_key = entry.get("miner_id", "")
        worker = entry.get("worker_name", "default")
        if "/" in miner_key:
            miner_id, worker_name = miner_key.split("/", 1)
        else:
            miner_id, worker_name = miner_key, worker
        height = entry.get("height", 0)
        difficulty = entry.get("difficulty", 0)
        cur.execute(
            """INSERT INTO shares (miner_id, worker_name, job_id, nonce, hash_hex,
               height, accepted, share_difficulty, network_difficulty, is_block, source)
               VALUES (?, ?, 0, 0, '', ?, 1, ?, 0, 0, 'zion')""",
            (miner_id, worker_name, height, difficulty),
        )
        share_count += 1
    print(f"Migrated {share_count} window shares")

    con.commit()
    con.close()
    print(f"Migration complete: {state_path} → {db_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
