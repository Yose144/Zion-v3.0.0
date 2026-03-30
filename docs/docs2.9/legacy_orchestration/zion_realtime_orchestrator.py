#!/usr/bin/env python3
"""
ZION Real-Time Orchestrator
Integrates WebSocket server with existing ZION components for live monitoring
"""

import os
import sys
import threading
import time
from datetime import datetime

try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False
    print("⚠️  psutil not available - system metrics limited")

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import ZION components
from zion_websocket_server import ZIONSocketIOServer, ZIONWebSocketServer

from core.seednodes import ZionNetworkConfig
from integrations.zion_monitoring_system import (
  ZIONMonitoringSystem,
  get_monitoring_system,
)

# Import ML module for hardware monitoring
try:
    from ml.hardware_detector import get_hardware_detector
    from ml.algorithm_benchmarker import get_benchmarker
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False
    print("⚠️  ML module not available - using placeholder values")


class ZIONRealTimeOrchestrator:
    """Real-time orchestrator integrating all ZION components"""

    def __init__(self):
        self.websocket_server = None
        self.socketio_server = None
        self.monitoring_system = ZIONMonitoringSystem()
        self.monitoring_thread = None
        self.running = False

        # System monitoring
        self.start_time = time.time()
        
        # ML module components
        if ML_AVAILABLE:
            self.hardware_detector = get_hardware_detector()
            self.benchmarker = get_benchmarker()
            self._cached_hw_profile = None
            self._hw_profile_cache_time = 0
            self._hw_cache_ttl = 60  # Cache HW profile for 60 seconds
        else:
            self.hardware_detector = None
            self.benchmarker = None

    def start_websocket_server(self):
        """Start WebSocket server"""
        try:
            self.websocket_server = ZIONWebSocketServer()
            ws_thread = threading.Thread(target=self._run_websocket_server, daemon=True)
            ws_thread.start()
            print("✅ WebSocket server started on ws://localhost:8080")
        except Exception as e:
            print(f"⚠️  WebSocket server failed: {e}")

    def start_socketio_server(self):
        """Start Socket.IO server as fallback"""
        try:
            self.socketio_server = ZIONSocketIOServer()
            sio_thread = threading.Thread(target=self._run_socketio_server, daemon=True)
            sio_thread.start()
            print("✅ Socket.IO server started on http://localhost:8081")
        except Exception as e:
            print(f"⚠️  Socket.IO server failed: {e}")

    def start_monitoring(self):
        """Start real-time monitoring"""
        self.monitoring_system.start()
        self.monitoring_thread = threading.Thread(target=self._metrics_broadcast_loop, daemon=True)
        self.monitoring_thread.start()
        print("✅ Real-time monitoring started")

    def _run_websocket_server(self):
        """Run WebSocket server in asyncio event loop"""
        import asyncio

        asyncio.run(self.websocket_server.start())

    def _run_socketio_server(self):
        """Run Socket.IO server"""
        try:
            self.socketio_server.run()
        except Exception as e:
            print(f"⚠️  Socket.IO server error: {e}")

    def _metrics_broadcast_loop(self):
        """Broadcast metrics from monitoring system to WebSocket servers"""
        while self.running:
            try:
                # Get current metrics from monitoring system
                metrics = self.monitoring_system.get_current_metrics()

                # Update WebSocket servers with real metrics
                if self.websocket_server:
                    # System metrics
                    system = metrics["system"]
                    self.websocket_server.update_system_metrics(
                        cpu_usage=system["cpu_percent"],
                        memory_usage=system["memory_percent"],
                        disk_usage=system["disk_percent"],
                        network_rx=metrics["network"]["bytes_recv_per_second"],
                        network_tx=metrics["network"]["bytes_sent_per_second"],
                        uptime=time.time() - self.start_time,
                    )

                    # Get real-time hardware metrics from ML module
                    hw_metrics = self._get_hardware_metrics()

                    # Mining metrics
                    mining = metrics["mining"]
                    self.websocket_server.update_mining_metrics(
                        hashrate=mining["hashrate"],
                        shares_submitted=mining["shares_submitted"],
                        shares_accepted=mining["shares_accepted"],
                        shares_rejected=mining["shares_rejected"],
                        blocks_found=mining["blocks_found"],
                        difficulty=mining["current_difficulty"],
                        temperature=hw_metrics["temperature"],
                        power_consumption=hw_metrics["power_consumption"],
                        efficiency=hw_metrics["efficiency"],
                    )

                    # AI metrics (placeholder for now)
                    self.websocket_server.update_ai_metrics(
                        active_models=2,
                        predictions_made=100,
                        optimization_cycles=10,
                        consciousness_level=0.75,
                        rize_energy=0.80,
                    )

                if self.socketio_server:
                    # Update Socket.IO server with same metrics
                    hw_metrics = self._get_hardware_metrics()
                    
                    system = metrics["system"]
                    self.socketio_server.update_system_metrics(
                        cpu_usage=system["cpu_percent"],
                        memory_usage=system["memory_percent"],
                        disk_usage=system["disk_percent"],
                        network_rx=metrics["network"]["bytes_recv_per_second"],
                        network_tx=metrics["network"]["bytes_sent_per_second"],
                        uptime=time.time() - self.start_time,
                    )

                    mining = metrics["mining"]
                    self.socketio_server.update_mining_metrics(
                        hashrate=mining["hashrate"],
                        shares_submitted=mining["shares_submitted"],
                        shares_accepted=mining["shares_accepted"],
                        shares_rejected=mining["shares_rejected"],
                        blocks_found=mining["blocks_found"],
                        difficulty=mining["current_difficulty"],
                        temperature=hw_metrics["temperature"],
                        power_consumption=hw_metrics["power_consumption"],
                        efficiency=hw_metrics["efficiency"],
                    )

                    self.socketio_server.update_ai_metrics(
                        active_models=2,
                        predictions_made=100,
                        optimization_cycles=10,
                        consciousness_level=0.75,
                        rize_energy=0.80,
                    )

                time.sleep(1)  # Broadcast every second

            except Exception as e:
                print(f"⚠️  Metrics broadcast error: {e}")
                time.sleep(5)

    def stop(self):
        """Stop all services"""
        print("🛑 Stopping ZION Real-Time Orchestrator...")
        self.running = False

        if self.monitoring_system:
            self.monitoring_system.stop()

        if self.websocket_server:
            self.websocket_server.stop()

        print("✅ Real-Time Orchestrator stopped")
    
    def _get_hardware_metrics(self):
        """
        Get real-time hardware metrics from ML module
        
        Returns:
            Dict with temperature, power_consumption, efficiency
        """
        if not ML_AVAILABLE or not self.hardware_detector:
            # Fallback to placeholder values
            return {
                "temperature": 65.0,
                "power_consumption": 200.0,
                "efficiency": 85.0,
            }
        
        try:
            # Get cached hardware profile (expensive operation)
            now = time.time()
            if (self._cached_hw_profile is None or 
                now - self._hw_profile_cache_time > self._hw_cache_ttl):
                self._cached_hw_profile = self.hardware_detector.detect()
                self._hw_profile_cache_time = now
            
            profile = self._cached_hw_profile
            
            # Get CPU temperature
            temperature = 65.0  # Default
            try:
                import psutil
                temps = psutil.sensors_temperatures()
                if temps:
                    # Try common sensor names
                    for sensor in ['coretemp', 'cpu_thermal', 'k10temp']:
                        if sensor in temps:
                            temperature = temps[sensor][0].current
                            break
                    else:
                        # Use first available sensor
                        temperature = list(temps.values())[0][0].current
            except:
                pass
            
            # Estimate power consumption based on CPU usage
            power_consumption = 100.0  # Base idle power
            try:
                import psutil
                cpu_percent = psutil.cpu_percent(interval=0.1)
                # Rough estimate: 100W base + (CPU% * 150W TDP)
                power_consumption = 100.0 + (cpu_percent / 100.0) * 150.0
            except:
                power_consumption = 200.0
            
            # Get latest benchmark results for efficiency
            efficiency = 85.0  # Default
            if self.benchmarker:
                try:
                    results = self.benchmarker.get_latest_results()
                    if results:
                        # Find best efficiency (H/W)
                        for result in results:
                            if result.success and result.power_watts and result.power_watts > 0:
                                eff = result.hashrate / result.power_watts
                                # Normalize to 0-100 scale (arbitrary)
                                efficiency = min(100.0, eff / 1000.0)
                                break
                except:
                    pass
            
            return {
                "temperature": temperature,
                "power_consumption": power_consumption,
                "efficiency": efficiency,
            }
            
        except Exception as e:
            print(f"⚠️  Hardware metrics error: {e}")
            return {
                "temperature": 65.0,
                "power_consumption": 200.0,
                "efficiency": 85.0,
            }

    def _update_mining_metrics(self):
        """Update mining metrics (placeholder for real mining integration)"""
        # This would integrate with actual mining pool/miner stats
        # For now, simulate some activity
        import random

        hashrate = 500000 + random.randint(-50000, 50000)  # ~500 KH/s ±50KH/s
        temperature = 45.0 + random.uniform(-5, 5)  # 45°C ±5°C
        power = 150.0 + random.uniform(-10, 10)  # 150W ±10W

        if self.websocket_server:
            self.websocket_server.update_mining_metrics(
                hashrate=hashrate,
                temperature=temperature,
                power_consumption=power,
                efficiency=85.0 + random.uniform(-5, 5),
            )

        if self.socketio_server:
            self.socketio_server.update_mining_metrics(
                hashrate=hashrate,
                temperature=temperature,
                power_consumption=power,
                efficiency=85.0 + random.uniform(-5, 5),
            )

    def _update_ai_metrics(self):
        """Update AI metrics (placeholder for real AI integration)"""
        # This would integrate with actual AI orchestrator stats
        import random

        consciousness = 0.6 + random.uniform(-0.1, 0.1)  # Base 0.6 ±0.1
        rize_energy = 0.7 + random.uniform(-0.1, 0.1)  # Base 0.7 ±0.1

        if self.websocket_server:
            self.websocket_server.update_ai_metrics(
                active_models=2 + random.randint(0, 2), consciousness_level=consciousness, rize_energy=rize_energy
            )

        if self.socketio_server:
            self.socketio_server.update_ai_metrics(
                active_models=2 + random.randint(0, 2), consciousness_level=consciousness, rize_energy=rize_energy
            )

    def start(self):
        """Start all real-time services"""
        print("🚀 Starting ZION Real-Time Orchestrator...")
        self.running = True

        # Start WebSocket server
        self.start_websocket_server()

        # Start Socket.IO server
        self.start_socketio_server()

        # Start monitoring
        self.start_monitoring()

        print("✅ ZION Real-Time Orchestrator started successfully")
        print("🌐 WebSocket: ws://localhost:8080")
        print("🌐 Socket.IO: http://localhost:8081")
        print("📊 Monitor: Open zion_websocket_monitor.html in browser")
        print("🛑 Press Ctrl+C to stop")

    def stop(self):
        """Stop all services"""
        print("🛑 Stopping ZION Real-Time Orchestrator...")
        self.running = False

        if self.websocket_server:
            self.websocket_server.stop()

        print("✅ Real-Time Orchestrator stopped")


def main():
    """Main entry point"""
    orchestrator = ZIONRealTimeOrchestrator()

    try:
        orchestrator.start()

        # Keep running
        while True:
            time.sleep(1)

    except KeyboardInterrupt:
        print("\n🛑 Shutdown requested by user")
    except Exception as e:
        print(f"❌ Fatal error: {e}")
    finally:
        orchestrator.stop()


if __name__ == "__main__":
    main()
