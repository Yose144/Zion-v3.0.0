# 🚀 ZION 2.7.1 Manual Deployment Instructions

## SSH Server: root@91.98.122.165

### Step 1: Connect to Server
```bash
ssh root@91.98.122.165
```

### Step 2: Clean Previous Installation
```bash
rm -rf ~/zion271 ~/zion* ~/2.7*
```

### Step 3: Create Directory Structure
```bash
mkdir -p ~/zion271/{ai,core,mining,config,tests}
cd ~/zion271
```

### Step 4: Setup Python Environment
```bash
# Install packages
python3 -m pip install --break-system-packages numpy cryptography requests

# OR create virtual environment
python3 -m venv ~/zion_env
source ~/zion_env/bin/activate
pip install numpy cryptography requests
```

### Step 5: Create ZION Components

#### AI Master Orchestrator (ai/zion_ai_master_orchestrator.py)
Copy the content from local 2.7.1/ai/zion_ai_master_orchestrator.py

#### KRISTUS Quantum Engine (core/zion_271_kristus_quantum_engine.py)
Copy the content from local 2.7.1/core/zion_271_kristus_quantum_engine.py

#### Other AI Components
- Copy all zion_*_ai.py files to ai/ directory
- Copy quantum_enhanced_ai_integration.py to ai/

#### Create __init__.py files
```bash
touch ai/__init__.py core/__init__.py mining/__init__.py
```

### Step 6: Test Installation
```bash
cd ~/zion271
export PYTHONPATH="$(pwd):$(pwd)/ai:$(pwd)/core:$PYTHONPATH"

# Test AI
python3 -c "from ai.zion_ai_master_orchestrator import ZionAIMasterOrchestrator; print('AI OK')"

# Test Quantum
python3 -c "from core.zion_271_kristus_quantum_engine import create_safe_kristus_engine; print('Quantum OK')"
```

### Step 7: Start ZION
```bash
# Create startup script
cat > start_zion.py << 'EOF'
#!/usr/bin/env python3
import sys, os
sys.path.insert(0, '/root/zion271')
sys.path.insert(0, '/root/zion271/ai')
sys.path.insert(0, '/root/zion271/core')

print("🌟 ZION 2.7.1 Starting...")
print("🧠 Initializing AI components...")

try:
    from ai.zion_ai_master_orchestrator import ZionAIMasterOrchestrator
    orchestrator = ZionAIMasterOrchestrator()
    print("✅ AI Master Orchestrator initialized")
    
    from core.zion_271_kristus_quantum_engine import create_safe_kristus_engine
    engine = create_safe_kristus_engine(8, False)
    print("✅ KRISTUS Quantum Engine initialized (Safe Mode)")
    
    print("🚀 ZION 2.7.1 ready for mining!")
    print("🌟 JAI RAM SITA HANUMAN - ON THE STAR!")
    
except Exception as e:
    print(f"❌ Error: {e}")
EOF

python3 start_zion.py
```

## 🌟 Ready for Mining!
