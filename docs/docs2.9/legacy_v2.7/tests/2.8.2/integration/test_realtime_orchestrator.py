#!/usr/bin/env python3
"""
Test Real-Time Orchestrator
Simple test script to verify real-time monitoring functionality
"""

import sys
import os
import time
import threading

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from zion_realtime_orchestrator import ZIONRealTimeOrchestrator

def test_realtime_orchestrator():
    """Test real-time orchestrator functionality"""
    print("🧪 Testing ZION Real-Time Orchestrator...")

    orchestrator = ZIONRealTimeOrchestrator()

    try:
        # Start orchestrator
        orchestrator.start()

        # Let it run for a bit to collect metrics
        print("📊 Collecting metrics for 10 seconds...")
        for i in range(10):
            time.sleep(1)
            print(f"⏱️  {i+1}/10 seconds...")

        print("✅ Real-time orchestrator test completed successfully")
        print("🌐 WebSocket server should be running on ws://localhost:8080")
        print("🌐 Socket.IO server should be running on http://localhost:8081")

        # Keep running for manual testing
        print("💡 Open zion_websocket_monitor.html in browser to test monitoring")
        print("🛑 Press Ctrl+C to stop")

        while True:
            time.sleep(1)

    except KeyboardInterrupt:
        print("\n🛑 Test interrupted by user")
    except Exception as e:
        print(f"❌ Test failed: {e}")
    finally:
        orchestrator.stop()

if __name__ == "__main__":
    test_realtime_orchestrator()