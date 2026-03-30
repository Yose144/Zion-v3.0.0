# ZION 2.7.5 Quick Start Guide (Post-Debug)

## Installation

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

This will install all required packages:
- numpy, pandas, scikit-learn (AI/ML)
- psutil, gputil (System monitoring)
- ecdsa, cryptography, argon2-cffi (Cryptography)
- fastapi, uvicorn, requests, aiohttp (Web/Network)
- pytest, pytest-asyncio (Testing)

### 2. Verify Installation
```bash
python3 test_system_health.py
```

Expected output:
```
✅ Dependencies: 11/11 passed
✅ Core Modules: 5/5 passed  
✅ AI Modules: 5/5 passed
✅ Blockchain Init: PASSED
🎉 All health checks PASSED!
```

## Running the System

### Basic Blockchain
```bash
# Full system with P2P and RPC
python3 new_zion_blockchain.py

# Custom ports
python3 new_zion_blockchain.py --p2p-port=8333 --rpc-port=8332
```

### Mining Pool
```bash
python3 zion_universal_pool_v2.py --port=3333 --rpc-port=8080
```

### AI Components
```bash
# Predictive maintenance
python3 ai/zion_predictive_maintenance.py

# Blockchain analytics
python3 ai/zion_blockchain_analytics.py

# AI Master Orchestrator
python3 ai/zion_ai_master_orchestrator.py
```

## Testing

### Run All Core Tests
```bash
python3 -m pytest tests/test_basic_functionality.py tests/test_chain_integrity.py -v
```

### Run Specific Test
```bash
python3 -m pytest tests/test_basic_functionality.py::test_basic_blockchain -v
```

### Health Check
```bash
python3 test_system_health.py
```

## Common Issues

### Database Errors
If you see `unable to open database file`:
```bash
mkdir -p data
```

### Import Errors
If modules fail to import:
```bash
pip install -r requirements.txt --force-reinstall
```

### GPU Warnings
GPU-related warnings are normal if no GPU is available:
```
⚠️ No compatible GPU found (NVIDIA CUDA or AMD ROCm/OpenCL)
```

### TensorFlow Warnings
TensorFlow is optional for advanced AI features:
```
⚠️ TensorFlow není dostupný - některé AI funkce budou omezené
```

## Project Structure

```
Zion-TestNet-2.7.5/
├── ai/                          # AI modules
│   ├── zion_predictive_maintenance.py
│   ├── zion_blockchain_analytics.py
│   ├── zion_gpu_miner.py
│   └── ...
├── tests/                       # Test suite
│   ├── test_basic_functionality.py
│   ├── test_chain_integrity.py
│   └── ...
├── data/                        # Blockchain database (created automatically)
├── new_zion_blockchain.py       # Main blockchain
├── zion_rpc_server.py          # RPC server
├── zion_p2p_network.py         # P2P network
├── crypto_utils.py             # Cryptography utilities
├── requirements.txt            # Python dependencies
├── test_system_health.py       # Health check script
└── DEBUGGING_REPORT.md         # Debugging documentation
```

## Next Steps

1. ✅ System is debugged and ready
2. Start blockchain: `python3 new_zion_blockchain.py`
3. Run tests: `python3 -m pytest tests/`
4. Explore AI features: `python3 ai/zion_ai_master_orchestrator.py`

## Support

- Check `DEBUGGING_REPORT.md` for detailed debugging information
- Run `python3 test_system_health.py` to diagnose issues
- Review test output for specific error messages

---
*Last updated: Post-debugging session - All systems operational*
