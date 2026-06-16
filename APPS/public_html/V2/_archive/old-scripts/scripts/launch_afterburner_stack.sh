#!/usr/bin/env bash
# 🚀 Unified launcher for ZION Afterburner + AI Miner Dashboard
set -e

echo "============================================"
echo "🚀 ZION AFTERBURNER + AI MINER STACK LAUNCH"
echo "============================================"

# 1. Start system stats background writer
if ! pgrep -f "ai/system_stats.py" >/dev/null; then
  echo "📊 Starting system stats collector..."
  nohup python3 ai/system_stats.py >/tmp/afterburner_stats.log 2>&1 &
else
  echo "📊 System stats collector already running"
fi

# 2. Start GPU afterburner API if present
if [ -f ai/zion-ai-gpu-afterburner.py ]; then
  if ! pgrep -f "zion-ai-gpu-afterburner.py" >/dev/null; then
    echo "🎮 Starting GPU Afterburner API (port 5001)..."
    nohup python3 ai/zion-ai-gpu-afterburner.py >/tmp/afterburner_gpu.log 2>&1 &
  else
    echo "🎮 GPU Afterburner API already running"
  fi
fi

# 3. Start lightweight API bridge (if exists)
if [ -f ai/zion-afterburner-api.py ]; then
  if ! pgrep -f "zion-afterburner-api.py" >/dev/null; then
    echo "🔗 Starting API Bridge (port 5003)..."
    nohup python3 ai/zion-afterburner-api.py >/tmp/afterburner_api_bridge.log 2>&1 &
  else
    echo "🔗 API Bridge already running"
  fi
fi

# 4. Serve dashboard (port 8080)
if ! pgrep -f "http.server 8080" >/dev/null; then
  echo "🖥️  Starting dashboard server (port 8080)..."
  nohup python3 -m http.server 8080 --directory ai >/tmp/afterburner_dashboard.log 2>&1 &
else
  echo "🖥️  Dashboard server already running"
fi

# 5. Optional: start AI miner integration (simulation)
if [ -f zion_ai_miner_14_integration.py ]; then
  if ! pgrep -f "zion_ai_miner_14_integration.py" >/dev/null; then
    echo "⛏️  Starting AI Miner Integration (simulation mode)..."
    nohup python3 zion_ai_miner_14_integration.py >/tmp/afterburner_ai_miner.log 2>&1 &
  else
    echo "⛏️  AI Miner Integration already running"
  fi
fi

echo "✅ Stack launched!"
echo "🌐 Open dashboard: http://localhost:8080/system_afterburner.html"
echo "📊 System stats: tail -f /tmp/afterburner_stats.log"
echo "🔧 To stop: pkill -f system_stats.py; pkill -f zion-ai-gpu-afterburner.py; pkill -f zion-afterburner-api.py"
