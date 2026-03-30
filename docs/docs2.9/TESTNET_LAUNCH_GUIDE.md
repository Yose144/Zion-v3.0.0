# 🚀 ZION v2.9 TESTNET LAUNCH GUIDE
**Date:** December 3, 2025
**Target:** Public Testnet Launch (New Year's Eve)
**Status:** READY FOR DEPLOYMENT

> ⚠️ **LEGACY DOKUMENT (není pro v2.9.5 native)**
>
> Tento návod popisuje starší testnet cluster (Python/8545+). Pro v2.9.5 native Rust stack použij:
> - Stav reality: [2.9.5/docs/REAL_STATUS_v2.9.5.md](../2.9.5/docs/REAL_STATUS_v2.9.5.md)
> - Port matrix: [docs/2.9.4/meta/PORT_MATRIX_TESTNET_v2.9.5.md](2.9.4/meta/PORT_MATRIX_TESTNET_v2.9.5.md)
> - Native compose: [2.9.5/docker-compose.native-2.9.5.yml](../2.9.5/docker-compose.native-2.9.5.yml)
> - MainNet readiness (gaps): [docs/2.9.4/roadmaps/MAINNET_READINESS_v2.9.5.md](2.9.4/roadmaps/MAINNET_READINESS_v2.9.5.md)

---

## 1. OVERVIEW
This guide explains how to launch the **ZION Testnet Cluster**. The cluster consists of **5 Seed Nodes** that form the backbone of the network. These nodes communicate via P2P to synchronize blocks and provide RPC endpoints for wallets and explorers.

### Network Topology
*   **Node 1 (Primary):** P2P: `8334`, RPC: `8545` (Bootstrap Node)
*   **Node 2:** P2P: `8335`, RPC: `8546`
*   **Node 3:** P2P: `8336`, RPC: `8547`
*   **Node 4:** P2P: `8337`, RPC: `8548`
*   **Node 5:** P2P: `8338`, RPC: `8549`

---

## 2. PREREQUISITES
Before starting, ensure you have:
1.  **Python 3.10+** installed.
2.  **Dependencies** installed via pip:
    ```bash
    pip install -r requirements.txt
    ```
3.  **Ports Open:** If deploying on a public server, ensure ports `8334-8338` (TCP) and `8545-8549` (TCP) are open in your firewall (UFW/AWS Security Groups).

---

## 3. LAUNCH INSTRUCTIONS

### A. Windows (Local Testing)
We have prepared a PowerShell script that launches all 5 nodes in separate minimized windows.

1.  Open PowerShell as Administrator (optional, but recommended for port binding).
2.  Navigate to the project root.
3.  Run the launch script:
    ```powershell
    .\scripts\launch_testnet_seed_nodes.ps1
    ```
4.  **Result:** You will see 5 new windows open. The main window will confirm "Testnet Cluster is ACTIVE!".

### B. Linux (Production Server)
For the official Testnet server (e.g., `91.98.122.165`), use the Bash script. It runs nodes in the background using `nohup`.

1.  Make the script executable:
    ```bash
    chmod +x scripts/launch_testnet_seed_nodes.sh
    ```
2.  Run the script:
    ```bash
    ./scripts/launch_testnet_seed_nodes.sh
    ```
3.  **Result:** Nodes will start in the background. Logs are written to `data/testnet_seeds/nodeX.log`.

---

## 4. VERIFICATION
How to check if the network is alive?

### Check Logs
*   **Windows:** Check the output in the opened windows. You should see "Mined block..." or "Received block...".
*   **Linux:** Tail the logs:
    ```bash
    tail -f data/testnet_seeds/node1.log
    ```

### Check RPC (JSON-RPC)
You can query the Primary Node (Node 1) to see the blockchain status.

**Using cURL:**
```bash
curl -X POST -H "Content-Type: application/json" \
     --data '{"jsonrpc":"2.0","method":"getblockchaininfo","params":[],"id":1}' \
     http://localhost:8545
```

**Expected Response:**
```json
{
  "result": {
    "chain": "testnet",
    "blocks": 123,
    "difficulty": 1,
    "peers": 4
  },
  "error": null,
  "id": 1
}
```

---

## 5. CONNECTING MINERS
To connect a miner to this Testnet, use the following configuration in your miner script (`zion_miner_v2_9.py`):

```python
# Connect to the Primary Seed Node
MINING_POOL_URL = "http://localhost:8545"  # Or public IP: http://91.98.122.165:8545
WALLET_ADDRESS = "zion1testnet..."
```

---

## 6. TROUBLESHOOTING

**Issue: "Address already in use"**
*   **Cause:** Old nodes are still running.
*   **Fix (Windows):** Close all Python windows or run `Stop-Process -Name "python"` in PowerShell.
*   **Fix (Linux):** Run `pkill -f new_zion_blockchain.py`.

**Issue: Nodes not syncing**
*   **Cause:** Firewall blocking P2P ports.
*   **Fix:** Allow ports 8334-8338.

**Issue: Database Locked**
*   **Cause:** Two processes trying to access the same `nodeX.db`.
*   **Fix:** Ensure you are not running the launch script twice.

---

**READY FOR LAUNCH.** 🚀
