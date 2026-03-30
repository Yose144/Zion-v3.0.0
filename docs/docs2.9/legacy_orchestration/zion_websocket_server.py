#!/usr/bin/env python3
"""
ZION WebSocket Server
Real-time WebSocket server for live mining monitoring, metrics, and AI orchestration
"""

import asyncio
import json
import logging
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

try:
    import websockets

    WEBSOCKETS_AVAILABLE = True
except ImportError:
    WEBSOCKETS_AVAILABLE = False
    print("⚠️  WebSockets not available - install with: pip install websockets")

try:
    from flask import Flask, request
    from flask_socketio import SocketIO, emit

    FLASK_AVAILABLE = True
except ImportError:
    FLASK_AVAILABLE = False
    print("⚠️  Flask-SocketIO not available - install with: pip install flask flask-socketio")

from seednodes import ZionNetworkConfig

logger = logging.getLogger(__name__)


@dataclass
class MiningMetrics:
    """Real-time mining metrics"""

    hashrate: float = 0.0
    shares_submitted: int = 0
    shares_accepted: int = 0
    shares_rejected: int = 0
    blocks_found: int = 0
    difficulty: float = 0.0
    temperature: float = 0.0
    power_consumption: float = 0.0
    efficiency: float = 0.0
    timestamp: float = field(default_factory=time.time)


@dataclass
class AIMetrics:
    """AI orchestration metrics"""

    active_models: int = 0
    predictions_made: int = 0
    optimization_cycles: int = 0
    consciousness_level: float = 0.0
    rize_energy: float = 0.0
    timestamp: float = field(default_factory=time.time)


@dataclass
class SystemMetrics:
    """System-wide metrics"""

    cpu_usage: float = 0.0
    memory_usage: float = 0.0
    network_rx: float = 0.0
    network_tx: float = 0.0
    disk_usage: float = 0.0
    uptime: float = 0.0
    timestamp: float = field(default_factory=time.time)


class ZIONWebSocketServer:
    """WebSocket server for real-time ZION monitoring"""

    def __init__(self, host: str = None, port: int = None):
        ws_config = ZionNetworkConfig.WEBSOCKET_CONFIG
        self.host = host or ws_config["host"]
        self.port = port or ws_config["port"]
        self.server = None
        self.running = False

        # Connected clients
        self.clients: Set[websockets.WebSocketServerProtocol] = set()

        # Metrics storage
        self.mining_metrics = MiningMetrics()
        self.ai_metrics = AIMetrics()
        self.system_metrics = SystemMetrics()

        # Broadcast intervals (seconds)
        self.mining_broadcast_interval = 1.0  # 1Hz
        self.ai_broadcast_interval = 5.0  # 0.2Hz
        self.system_broadcast_interval = 10.0  # 0.1Hz

        # Broadcast threads
        self.broadcast_threads: List[threading.Thread] = []

    async def register_client(self, websocket: websockets.WebSocketServerProtocol):
        """Register new client connection"""
        self.clients.add(websocket)
        logger.info(f"Client connected: {websocket.remote_address}")
        await self.send_welcome_message(websocket)

    async def unregister_client(self, websocket: websockets.WebSocketServerProtocol):
        """Unregister client connection"""
        self.clients.discard(websocket)
        logger.info(f"Client disconnected: {websocket.remote_address}")

    async def send_welcome_message(self, websocket: websockets.WebSocketServerProtocol):
        """Send welcome message to new client"""
        welcome_data = {
            "type": "welcome",
            "message": "Connected to ZION WebSocket Server",
            "timestamp": time.time(),
            "server_info": {
                "version": "2.8.5",
                "features": ["mining_monitoring", "ai_orchestration", "system_metrics", "rize_energy"],
            },
        }
        await websocket.send(json.dumps(welcome_data))

    async def handle_message(self, websocket: websockets.WebSocketServerProtocol, message: str):
        """Handle incoming WebSocket message"""
        try:
            data = json.loads(message)
            msg_type = data.get("type", "unknown")

            if msg_type == "subscribe":
                await self.handle_subscribe(websocket, data)
            elif msg_type == "unsubscribe":
                await self.handle_unsubscribe(websocket, data)
            elif msg_type == "ping":
                await websocket.send(json.dumps({"type": "pong", "timestamp": time.time()}))
            else:
                logger.warning(f"Unknown message type: {msg_type}")

        except json.JSONDecodeError:
            logger.error(f"Invalid JSON received: {message}")
        except Exception as e:
            logger.error(f"Error handling message: {e}")

    async def handle_subscribe(self, websocket: websockets.WebSocketServerProtocol, data: Dict[str, Any]):
        """Handle subscription request"""
        channels = data.get("channels", [])
        response = {"type": "subscribed", "channels": channels, "timestamp": time.time()}
        await websocket.send(json.dumps(response))
        logger.info(f"Client subscribed to channels: {channels}")

    async def handle_unsubscribe(self, websocket: websockets.WebSocketServerProtocol, data: Dict[str, Any]):
        """Handle unsubscription request"""
        channels = data.get("channels", [])
        response = {"type": "unsubscribed", "channels": channels, "timestamp": time.time()}
        await websocket.send(json.dumps(response))
        logger.info(f"Client unsubscribed from channels: {channels}")

    async def broadcast_mining_metrics(self):
        """Broadcast mining metrics to all clients"""
        while self.running:
            if self.clients:
                data = {
                    "type": "mining_metrics",
                    "data": {
                        "hashrate": self.mining_metrics.hashrate,
                        "shares_submitted": self.mining_metrics.shares_submitted,
                        "shares_accepted": self.mining_metrics.shares_accepted,
                        "shares_rejected": self.mining_metrics.shares_rejected,
                        "blocks_found": self.mining_metrics.blocks_found,
                        "difficulty": self.mining_metrics.difficulty,
                        "temperature": self.mining_metrics.temperature,
                        "power_consumption": self.mining_metrics.power_consumption,
                        "efficiency": self.mining_metrics.efficiency,
                    },
                    "timestamp": time.time(),
                }

                # Send to all clients
                websockets_to_remove = set()
                for websocket in self.clients:
                    try:
                        await websocket.send(json.dumps(data))
                    except websockets.exceptions.ConnectionClosed:
                        websockets_to_remove.add(websocket)

                # Remove disconnected clients
                self.clients -= websockets_to_remove

            await asyncio.sleep(self.mining_broadcast_interval)

    async def broadcast_ai_metrics(self):
        """Broadcast AI metrics to all clients"""
        while self.running:
            if self.clients:
                data = {
                    "type": "ai_metrics",
                    "data": {
                        "active_models": self.ai_metrics.active_models,
                        "predictions_made": self.ai_metrics.predictions_made,
                        "optimization_cycles": self.ai_metrics.optimization_cycles,
                        "consciousness_level": self.ai_metrics.consciousness_level,
                        "rize_energy": self.ai_metrics.rize_energy,
                    },
                    "timestamp": time.time(),
                }

                websockets_to_remove = set()
                for websocket in self.clients:
                    try:
                        await websocket.send(json.dumps(data))
                    except websockets.exceptions.ConnectionClosed:
                        websockets_to_remove.add(websocket)

                self.clients -= websockets_to_remove

            await asyncio.sleep(self.ai_broadcast_interval)

    async def broadcast_system_metrics(self):
        """Broadcast system metrics to all clients"""
        while self.running:
            if self.clients:
                data = {
                    "type": "system_metrics",
                    "data": {
                        "cpu_usage": self.system_metrics.cpu_usage,
                        "memory_usage": self.system_metrics.memory_usage,
                        "network_rx": self.system_metrics.network_rx,
                        "network_tx": self.system_metrics.network_tx,
                        "disk_usage": self.system_metrics.disk_usage,
                        "uptime": self.system_metrics.uptime,
                    },
                    "timestamp": time.time(),
                }

                websockets_to_remove = set()
                for websocket in self.clients:
                    try:
                        await websocket.send(json.dumps(data))
                    except websockets.exceptions.ConnectionClosed:
                        websockets_to_remove.add(websocket)

                self.clients -= websockets_to_remove

            await asyncio.sleep(self.system_broadcast_interval)

    async def handler(self, websocket: websockets.WebSocketServerProtocol, path: str):
        """Main WebSocket handler"""
        if not WEBSOCKETS_AVAILABLE:
            logger.error("WebSockets not available")
            return

        await self.register_client(websocket)
        try:
            async for message in websocket:
                await self.handle_message(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            await self.unregister_client(websocket)

    def update_mining_metrics(self, **kwargs):
        """Update mining metrics"""
        for key, value in kwargs.items():
            if hasattr(self.mining_metrics, key):
                setattr(self.mining_metrics, key, value)
        self.mining_metrics.timestamp = time.time()

    def update_ai_metrics(self, **kwargs):
        """Update AI metrics"""
        for key, value in kwargs.items():
            if hasattr(self.ai_metrics, key):
                setattr(self.ai_metrics, key, value)
        self.ai_metrics.timestamp = time.time()

    def update_system_metrics(self, **kwargs):
        """Update system metrics"""
        for key, value in kwargs.items():
            if hasattr(self.system_metrics, key):
                setattr(self.system_metrics, key, value)
        self.system_metrics.timestamp = time.time()

    async def start(self):
        """Start WebSocket server"""
        if not WEBSOCKETS_AVAILABLE:
            logger.error("WebSocket server cannot start - websockets library not available")
            return

        self.running = True

        # Start broadcast tasks
        asyncio.create_task(self.broadcast_mining_metrics())
        asyncio.create_task(self.broadcast_ai_metrics())
        asyncio.create_task(self.broadcast_system_metrics())

        # Start WebSocket server
        self.server = await websockets.serve(self.handler, self.host, self.port, ping_interval=30, ping_timeout=10)

        logger.info(f"ZION WebSocket server started on ws://{self.host}:{self.port}")
        await self.server.wait_closed()

    def stop(self):
        """Stop WebSocket server"""
        self.running = False
        if self.server:
            self.server.close()
        logger.info("ZION WebSocket server stopped")


# Flask-SocketIO integration for compatibility
class ZIONSocketIOServer:
    """Socket.IO server for broader compatibility"""

    def __init__(self, host: str = None, port: int = None):
        if not FLASK_AVAILABLE:
            raise ImportError("Flask-SocketIO not available. Install with: pip install flask flask-socketio")

        ws_config = ZionNetworkConfig.WEBSOCKET_CONFIG
        self.host = host or ws_config["host"]
        self.port = port or (ws_config["port"] + 1)  # Different port for Socket.IO

        self.app = Flask(__name__)
        self.socketio = SocketIO(self.app, cors_allowed_origins="*")

        # Metrics
        self.mining_metrics = MiningMetrics()
        self.ai_metrics = AIMetrics()
        self.system_metrics = SystemMetrics()

        self.setup_socket_events()

    def setup_socket_events(self):
        """Setup Socket.IO event handlers"""

        @self.socketio.on("connect")
        def handle_connect():
            if FLASK_AVAILABLE:
                logger.info(f"Socket.IO client connected: {request.sid}")
            emit(
                "welcome",
                {
                    "message": "Connected to ZION Socket.IO Server",
                    "timestamp": time.time(),
                    "server_info": {
                        "version": "2.8.5",
                        "features": ["mining_monitoring", "ai_orchestration", "system_metrics", "rize_energy"],
                    },
                },
            )

        @self.socketio.on("disconnect")
        def handle_disconnect():
            if FLASK_AVAILABLE:
                logger.info(f"Socket.IO client disconnected: {request.sid}")

        @self.socketio.on("subscribe")
        def handle_subscribe(data):
            channels = data.get("channels", [])
            emit("subscribed", {"channels": channels, "timestamp": time.time()})
            logger.info(f"Socket.IO client subscribed to: {channels}")

        @self.socketio.on("ping")
        def handle_ping():
            emit("pong", {"timestamp": time.time()})

    def start_broadcasting(self):
        """Start broadcasting metrics"""

        def broadcast_mining():
            while True:
                self.socketio.emit(
                    "mining_metrics",
                    {
                        "hashrate": self.mining_metrics.hashrate,
                        "shares_submitted": self.mining_metrics.shares_submitted,
                        "shares_accepted": self.mining_metrics.shares_accepted,
                        "shares_rejected": self.mining_metrics.shares_rejected,
                        "blocks_found": self.mining_metrics.blocks_found,
                        "difficulty": self.mining_metrics.difficulty,
                        "temperature": self.mining_metrics.temperature,
                        "power_consumption": self.mining_metrics.power_consumption,
                        "efficiency": self.mining_metrics.efficiency,
                        "timestamp": time.time(),
                    },
                )
                self.socketio.sleep(1.0)

        def broadcast_ai():
            while True:
                self.socketio.emit(
                    "ai_metrics",
                    {
                        "active_models": self.ai_metrics.active_models,
                        "predictions_made": self.ai_metrics.predictions_made,
                        "optimization_cycles": self.ai_metrics.optimization_cycles,
                        "consciousness_level": self.ai_metrics.consciousness_level,
                        "rize_energy": self.ai_metrics.rize_energy,
                        "timestamp": time.time(),
                    },
                )
                self.socketio.sleep(5.0)

        def broadcast_system():
            while True:
                self.socketio.emit(
                    "system_metrics",
                    {
                        "cpu_usage": self.system_metrics.cpu_usage,
                        "memory_usage": self.system_metrics.memory_usage,
                        "network_rx": self.system_metrics.network_rx,
                        "network_tx": self.system_metrics.network_tx,
                        "disk_usage": self.system_metrics.disk_usage,
                        "uptime": self.system_metrics.uptime,
                        "timestamp": time.time(),
                    },
                )
                self.socketio.sleep(10.0)

        # Start broadcast threads
        threading.Thread(target=broadcast_mining, daemon=True).start()
        threading.Thread(target=broadcast_ai, daemon=True).start()
        threading.Thread(target=broadcast_system, daemon=True).start()

    def update_mining_metrics(self, **kwargs):
        """Update mining metrics"""
        for key, value in kwargs.items():
            if hasattr(self.mining_metrics, key):
                setattr(self.mining_metrics, key, value)
        self.mining_metrics.timestamp = time.time()

    def update_ai_metrics(self, **kwargs):
        """Update AI metrics"""
        for key, value in kwargs.items():
            if hasattr(self.ai_metrics, key):
                setattr(self.ai_metrics, key, value)
        self.ai_metrics.timestamp = time.time()

    def update_system_metrics(self, **kwargs):
        """Update system metrics"""
        for key, value in kwargs.items():
            if hasattr(self.system_metrics, key):
                setattr(self.system_metrics, key, value)
        self.system_metrics.timestamp = time.time()

    def run(self):
        """Run Socket.IO server"""
        self.start_broadcasting()
        logger.info(f"ZION Socket.IO server starting on http://{self.host}:{self.port}")
        self.socketio.run(self.app, host=self.host, port=self.port, debug=False)


if __name__ == "__main__":
    # Setup logging
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")

    # Start WebSocket server
    ws_server = ZIONWebSocketServer()

    # Run in separate thread
    def run_ws():
        asyncio.run(ws_server.start())

    ws_thread = threading.Thread(target=run_ws, daemon=True)
    ws_thread.start()

    # Start Socket.IO server
    sio_server = ZIONSocketIOServer()
    sio_server.run()
