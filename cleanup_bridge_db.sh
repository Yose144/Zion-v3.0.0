#!/bin/bash
DB="/root/zion-2.9.6-main/data/bridge-mainnet.db"

sqlite3 "$DB" "UPDATE l1_locks SET status='Completed', last_error='Already executed on bridge (processedL1Locks=true). Marked completed by cleanup.' WHERE l1_tx_hash='6de6a6382b9b6f42b5169df088ed2bab6abedd889078a08df373ae2d6e5ddcb3';"

sqlite3 "$DB" "UPDATE evm_burns SET status='Completed', completed_at=datetime('now'), last_error='Already unlocked on L1 (replay key used). Marked completed by cleanup.' WHERE burn_id='0x250553f0f98b382f0ed2939e1192f257f5c8c65467c6fa7590654f496a692b3c';"

echo "=== After cleanup ==="
echo "--- l1_locks ---"
sqlite3 "$DB" "SELECT status, COUNT(*) FROM l1_locks GROUP BY status;"
echo "--- evm_burns ---"
sqlite3 "$DB" "SELECT status, COUNT(*) FROM evm_burns GROUP BY status;"
