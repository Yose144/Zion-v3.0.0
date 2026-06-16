#!/bin/bash
# Launch 5 ZION Testnet Seed Nodes
# This script starts 5 independent blockchain nodes to form a stable Testnet cluster.

DATA_DIR="data/testnet_seeds"
mkdir -p $DATA_DIR

echo "🚀 Launching ZION Testnet Seed Cluster (5 Nodes)..."

# Function to start a node
start_node() {
    ID=$1
    P2P=$2
    RPC=$3
    DB="$DATA_DIR/node$ID.db"
    
    echo "Starting Node $ID (P2P: $P2P, RPC: $RPC)..."
    nohup python3 src/core/new_zion_blockchain.py --testnet --p2p-port $P2P --rpc-port $RPC --db-file $DB > "$DATA_DIR/node$ID.log" 2>&1 &
    PID=$!
    echo "✅ Node $ID started (PID: $PID)"
}

# Node 1 (Primary Seed)
start_node 1 8334 8545
sleep 2

# Node 2
start_node 2 8335 8546
sleep 2

# Node 3
start_node 3 8336 8547
sleep 2

# Node 4
start_node 4 8337 8548
sleep 2

# Node 5
start_node 5 8338 8549

echo ""
echo "🌟 Testnet Cluster is ACTIVE!"
echo "Logs are available in $DATA_DIR/"
echo "To stop all nodes: pkill -f new_zion_blockchain.py"
