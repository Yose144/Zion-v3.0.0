# ZION TerraNova v2.9 - Session Report
**Date:** 28. December 2025  
**Session Focus:** Pool Payout System Fix & Explorer Integration

---

## 🎯 Executive Summary

Critical bug discovered and fixed in the pool payout system. The RPC client was not properly detecting blockchain transaction errors, resulting in "phantom" payouts being marked as confirmed when they never actually executed on the blockchain.

---

## 🐛 Issues Identified

### 1. Pool RPC Client Error Handling Bug
**Severity:** Critical  
**Impact:** 51,363.44 ZION in phantom payouts across 73 transactions

**Root Cause:**  
The RPC client in `src/pool/blockchain/rpc_client.py` only checked for top-level JSON-RPC errors (`data["error"]`), but the blockchain returns application-level errors inside `result.error`. This meant insufficient balance errors were being silently ignored.

**Example Response (incorrectly treated as success):**
```json
{
  "result": {"error": "Insufficient balance: have 250.0, need 267.3"},
  "error": null,
  "id": 1
}
```

### 2. Explorer Address Lookup Returning 0 Balance
**Severity:** High  
**Impact:** Users saw 0 balance in explorer despite having pending rewards

**Root Cause:**  
- Explorer was querying blockchain transactions, but no payouts were recorded there
- Nginx was routing `/api/blockchain/address` to FastAPI (port 8001) instead of Next.js (port 3001)

---

## ✅ Fixes Implemented

### 1. RPC Client Fix
**File:** `src/pool/blockchain/rpc_client.py`

Added proper error detection for application-level errors:

```python
async def call(self, method: str, params: dict = None) -> Any:
    # ... existing code ...
    
    if data.get("error"):
        raise Exception(f"RPC error: {data['error']}")
    
    result = data.get("result")
    
    # NEW: Check for application-level errors inside result
    if isinstance(result, dict) and result.get("error"):
        raise Exception(f"Transaction error: {result['error']}")
    
    return result
```

### 2. Pool Database Repair
**Action:** Created and executed repair script to fix orphaned payouts

**Results:**
| Metric | Value |
|--------|-------|
| Orphaned payouts identified | 73 |
| Total orphaned amount | 51,363.44 ZION |
| Affected wallets | 2 |
| Refunded to pending | ✅ Complete |

**Affected Wallets:**
- `zion1l6qc82s2r9cnw8ckwj0wgjtcllee5ylwl6qc82s` → 18,621.90 ZION returned to pending
- `zion1qxy2kgdygjrsqtz...` → 32,741.54 ZION returned to pending

### 3. Nginx Configuration Update
**File:** `/etc/nginx/sites-enabled/zionterranova.com`

Added specific route for address endpoint to Next.js:

```nginx
# Address API - route to Next.js
location = /api/blockchain/address {
    proxy_pass http://127.0.0.1:3001/api/blockchain/address;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### 4. Pool Container Rebuild
Rebuilt and deployed pool container with fixed RPC client:
```bash
docker compose -f docker-compose-v2.9-production.yml build pool
docker compose -f docker-compose-v2.9-production.yml up -d pool
```

---

## 🧪 Verification Tests

### Test 1: RPC Error Detection
```bash
# Attempted transaction with insufficient balance
Result: Exception raised correctly with "Insufficient balance" message ✅
```

### Test 2: Valid Transaction
```bash
# Test payout of 10 ZION
Result: Transaction accepted to mempool (tx_0_1766960996_13a2169f) ✅
```

### Test 3: Explorer API
```bash
curl "https://www.zionterranova.com/api/blockchain/address?address=zion1l6qc82s2r9cnw8ckwj0wgjtcllee5ylwl6qc82s"

Result: Returns correct pending balance of 18,755.54 ZION ✅
```

---

## 📊 Current System State

### Blockchain
| Metric | Value |
|--------|-------|
| Block Height | 5 |
| Total Transactions | 20 (genesis) |
| Pool Wallet Balance | 250 ZION |

### Pool
| Metric | Value |
|--------|-------|
| Active Miners | 0 (at time of fix) |
| Pending Payouts | 51,898.03 ZION |
| Eligible for Payout | 2 wallets |
| Payout Minimum | 144 ZION |

### Payout Status Distribution
| Status | Count | Total Amount |
|--------|-------|--------------|
| failed | 118,636 | 40,661,439.36 ZION |
| invalid_address | 10,808 | N/A |
| orphaned | 73 | 51,363.44 ZION |

---

## ⚠️ Known Limitations

1. **Pool Wallet Low Balance:** Only 250 ZION available from 5 mined blocks. Real payouts will only work once more blocks are mined.

2. **Large Failed Payout Backlog:** 118,636 failed payouts in database (from testing with invalid addresses). Consider cleanup.

---

## 📋 Files Modified

1. `src/pool/blockchain/rpc_client.py` - RPC error handling fix
2. `/etc/nginx/sites-enabled/zionterranova.com` - Address API routing
3. `website-v2.9/.next/` - Rebuilt and deployed

---

## 🔮 Recommendations

1. **Add RPC Health Checks:** Implement periodic balance verification between pool DB and blockchain
2. **Payout Retry Logic:** Add exponential backoff for failed payouts
3. **Monitoring:** Add alerts for payout failures exceeding threshold
4. **Database Cleanup:** Remove or archive old failed/invalid payouts

---

## 📝 Commands Reference

### Check Pool Status
```bash
ssh -i ~/.ssh/zion_server_key root@91.98.122.165 "docker exec zion-pool-v2.9 curl -s localhost:8080/stats"
```

### Check Miner Balance
```bash
curl "https://www.zionterranova.com/api/blockchain/address?address=YOUR_ADDRESS"
```

### View Pool Logs
```bash
ssh -i ~/.ssh/zion_server_key root@91.98.122.165 "docker logs zion-pool-v2.9 --tail 50"
```

---

**Session completed successfully.** ✅

*Report generated: 2025-12-28 23:30 UTC*
