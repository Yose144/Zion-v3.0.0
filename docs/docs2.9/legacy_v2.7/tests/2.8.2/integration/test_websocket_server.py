#!/usr/bin/env python3
"""
Test WebSocket Server
Simple test script to verify WebSocket server functionality
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../../src'))

import asyncio
import json
import time
import threading
from oldcore.zion_websocket_server import ZIONWebSocketServer, ZIONSocketIOServer

def test_websocket_server():
    """Test WebSocket server functionality"""
    print("🧪 Testing ZION WebSocket Server...")

    # Create server instance
    ws_server = ZIONWebSocketServer()

    # Update some test metrics
    ws_server.update_mining_metrics(
        hashrate=1500000.0,
        shares_submitted=100,
        shares_accepted=95,
        shares_rejected=5,
        blocks_found=2,
        temperature=65.0,
        power_consumption=250.0,
        efficiency=85.0
    )

    ws_server.update_ai_metrics(
        active_models=3,
        predictions_made=150,
        optimization_cycles=25,
        consciousness_level=0.75,
        rize_energy=0.85
    )

    ws_server.update_system_metrics(
        cpu_usage=45.0,
        memory_usage=60.0,
        network_rx=1500000,
        network_tx=800000,
        disk_usage=35.0,
        uptime=3600.0
    )

    print("✅ Metrics updated successfully")

    # Start server in background thread
    def run_server():
        asyncio.run(ws_server.start())

    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()

    print("✅ WebSocket server started on ws://localhost:8080")
    print("📊 Broadcasting metrics every 1-10 seconds")
    print("💡 Test with: wscat -c ws://localhost:8080")
    print("💡 Send: {\"type\": \"subscribe\", \"channels\": [\"mining_metrics\"]}")
    print("💡 Send: {\"type\": \"ping\"}")

    # Keep running for testing
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n🛑 Stopping WebSocket server...")
        ws_server.stop()

def test_socketio_server():
    """Test Socket.IO server functionality"""
    print("🧪 Testing ZION Socket.IO Server...")

    try:
        # Create Socket.IO server
        sio_server = ZIONSocketIOServer()

        # Update test metrics
        sio_server.update_mining_metrics(hashrate=2000000.0, blocks_found=5)
        sio_server.update_ai_metrics(consciousness_level=0.8, rize_energy=0.9)
        sio_server.update_system_metrics(cpu_usage=50.0, memory_usage=65.0)

        print("✅ Socket.IO server configured")
        print("🌐 Starting on http://localhost:8081")
        print("💡 Test in browser console: socket = io('http://localhost:8081')")

        # Run server
        sio_server.run()

    except ImportError:
        print("⚠️  Socket.IO not available - install flask-socketio")

if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "socketio":
        test_socketio_server()
    else:
        test_websocket_server()