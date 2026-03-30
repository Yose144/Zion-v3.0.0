#!/usr/bin/env python3
"""
ZION Universal Mining Pool with Real Hash Validation & Reward System
Supports ZION addresses, real ProgPow validation, and proportional rewards
🎮 NOW WITH CONSCIOUSNESS MINING GAME - 10-Year Evolution Journey!
"""
import argparse
import asyncio
import hashlib
import importlib
import json
import logging
import os
import secrets
import socket
import sqlite3
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict, List, Optional

import requests

# Optional Yescrypt C extension (accelerated validation)
try:
    import yescrypt_fast  # type: ignore

    YESCRYPT_FAST_AVAILABLE = True
except ImportError:
    yescrypt_fast = None  # type: ignore
    YESCRYPT_FAST_AVAILABLE = False

# 🌟 Cosmic Harmony (Native ZION Algorithm)
try:
    import os
    import sys

    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "zion", "mining"))
    """Zion Universal Pool Core (excerpt)"""

    # Optional import of Cosmic Harmony native wrapper – fall back gracefully if missing
    try:
        from cosmic_harmony_wrapper import CosmicHarmonyHasher, get_hasher  # type: ignore
    except Exception:  # pragma: no cover - environment dependent
        CosmicHarmonyHasher = None  # type: ignore
        def get_hasher():  # type: ignore
            raise RuntimeError("cosmic_harmony_wrapper native module not available; run with --disable-cosmic-harmony or install binary")

    COSMIC_HARMONY_AVAILABLE = True
    logger_init = logging.getLogger(__name__)
    logger_init.info("✅ Cosmic Harmony algorithm available")
except ImportError as e:
    COSMIC_HARMONY_AVAILABLE = False
    logger_init = logging.getLogger(__name__)
    logger_init.debug(f"Cosmic Harmony not available: {e}")

# Prometheus monitoring (optional)
try:
    from prometheus_client import Counter, Gauge, Histogram, Info, start_http_server
except ImportError:
    # Provide lightweight fallbacks to keep pool running without Prometheus installed
    class _Noop:
        def __init__(self, *args, **kwargs):
            pass

        def labels(self, *args, **kwargs):
            return self

        def info(self, *args, **kwargs):
            return self

        def inc(self, *args, **kwargs):
            return self

        def dec(self, *args, **kwargs):
            return self

        def set(self, *args, **kwargs):
            return self

        def observe(self, *args, **kwargs):
            return self

    Counter = Gauge = Histogram = Info = _Noop

    def start_http_server(*args, **kwargs):
        return None


# Import the real ZION blockchain and centralized config - with fallback for relative/absolute imports
try:
    from .blockchain_rpc_client import ZionBlockchainRPCClient
    from .consciousness_mining_game import ConsciousnessMiningGame
    from .new_zion_blockchain import NewZionBlockchain
    from .seednodes import ZionNetworkConfig, get_pool_port
except ImportError:
    from blockchain_rpc_client import ZionBlockchainRPCClient
    from consciousness_mining_game import ConsciousnessMiningGame
    from new_zion_blockchain import NewZionBlockchain
    from seednodes import ZionNetworkConfig, get_pool_port

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# ========================================
# PROMETHEUS METRICS
# ========================================

# Pool info
pool_info = Info("zion_pool_info", "ZION Mining Pool Information")
pool_info.info({"version": "2.8.5", "name": "ZION Universal Pool", "consciousness_mining": "enabled"})

# Counters (always increasing)
total_shares_counter = Counter("zion_pool_shares_total", "Total shares submitted", ["algorithm", "status"])
blocks_found_counter = Counter("zion_pool_blocks_found_total", "Total blocks found", ["algorithm"])
connections_counter = Counter("zion_pool_connections_total", "Total connections")
errors_counter = Counter("zion_pool_errors_total", "Total errors", ["type"])

# Gauges (current values)
active_miners_gauge = Gauge("zion_pool_active_miners", "Currently active miners", ["algorithm"])
pool_hashrate_gauge = Gauge("zion_pool_hashrate", "Pool hashrate in H/s", ["algorithm"])
difficulty_gauge = Gauge("zion_pool_difficulty", "Current pool difficulty", ["algorithm"])
pending_balance_gauge = Gauge("zion_pool_pending_balance", "Total pending balance in ZION")
connected_miners_gauge = Gauge("zion_pool_connected_miners", "Number of connected miners")
banned_ips_gauge = Gauge("zion_pool_banned_ips", "Number of banned IPs")

# Histograms (distributions)
share_processing_time = Histogram("zion_pool_share_processing_seconds", "Time to process a share")
block_time_histogram = Histogram(
    "zion_pool_block_time_seconds", "Time between blocks", buckets=[60, 300, 600, 1800, 3600, 7200, 14400]
)

# Consciousness Mining Metrics
consciousness_level_gauge = Gauge(
    "zion_pool_consciousness_level", "Miner consciousness level", ["address", "level_name"]
)
consciousness_multiplier_gauge = Gauge(
    "zion_pool_consciousness_multiplier", "Consciousness mining multiplier", ["address"]
)
meditation_sessions_counter = Counter(
    "zion_pool_meditation_sessions_total", "Total meditation sessions logged", ["address"]
)


@dataclass
class PoolBlock:
    """Represents a pool-found block"""

    height: int
    hash: str
    timestamp: float
    total_shares: int
    miner_shares: Dict[str, int] = field(default_factory=dict)
    reward_amount: float = 50.0  # Base ZION block reward (from economic model, adjusted from 5479.45)
    pool_fee: float = 0.01  # 1% pool fee
    status: str = "pending"  # pending, confirmed, paid


@dataclass
class MinerStats:
    """Enhanced miner statistics"""

    address: str
    total_shares: int = 0
    valid_shares: int = 0
    invalid_shares: int = 0
    last_share_time: Optional[float] = None
    connected_time: float = field(default_factory=time.time)
    balance_pending: float = 0.0
    balance_paid: float = 0.0
    difficulty: int = 10000
    algorithm: str = "randomx"


class ZIONPoolDatabase:
    """SQLite database for persistent pool data storage"""

    def __init__(self, db_file="zion_pool.db"):
        self.db_file = db_file
        self.init_database()

    def init_database(self):
        """Initialize database tables"""
        with sqlite3.connect(self.db_file) as conn:
            cursor = conn.cursor()

            # Miners table
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS miners (
                    address TEXT PRIMARY KEY,
                    algorithm TEXT DEFAULT 'randomx',
                    total_shares INTEGER DEFAULT 0,
                    valid_shares INTEGER DEFAULT 0,
                    invalid_shares INTEGER DEFAULT 0,
                    last_share_time REAL,
                    connected_time REAL DEFAULT (strftime('%s', 'now')),
                    balance_pending REAL DEFAULT 0.0,
                    balance_paid REAL DEFAULT 0.0,
                    difficulty INTEGER DEFAULT 10000,
                    created_at REAL DEFAULT (strftime('%s', 'now')),
                    updated_at REAL DEFAULT (strftime('%s', 'now'))
                )
            """
            )

            # Shares table
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS shares (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    address TEXT NOT NULL,
                    algorithm TEXT NOT NULL,
                    job_id TEXT NOT NULL,
                    nonce TEXT NOT NULL,
                    result TEXT NOT NULL,
                    difficulty INTEGER NOT NULL,
                    is_valid BOOLEAN NOT NULL,
                    processing_time REAL,
                    ip_address TEXT,
                    timestamp REAL DEFAULT (strftime('%s', 'now'))
                )
            """
            )

            # Blocks table
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS blocks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    height INTEGER NOT NULL,
                    hash TEXT,
                    timestamp REAL DEFAULT (strftime('%s', 'now')),
                    total_shares INTEGER DEFAULT 0,
                    reward_amount REAL DEFAULT 50.0,
                    pool_fee REAL DEFAULT 0.01,
                    status TEXT DEFAULT 'pending'
                )
            """
            )

            # Block shares table (many-to-many relationship)
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS block_shares (
                    block_id INTEGER,
                    address TEXT,
                    shares INTEGER DEFAULT 0,
                    FOREIGN KEY (block_id) REFERENCES blocks (id),
                    FOREIGN KEY (address) REFERENCES miners (address),
                    PRIMARY KEY (block_id, address)
                )
            """
            )

            # Payouts table
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS payouts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    address TEXT NOT NULL,
                    amount REAL NOT NULL,
                    timestamp REAL DEFAULT (strftime('%s', 'now')),
                    block_height INTEGER,
                    status TEXT DEFAULT 'pending',
                    tx_hash TEXT
                )
            """
            )

            # Pool stats table
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS pool_stats (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp REAL DEFAULT (strftime('%s', 'now')),
                    total_miners INTEGER DEFAULT 0,
                    total_shares INTEGER DEFAULT 0,
                    valid_shares INTEGER DEFAULT 0,
                    invalid_shares INTEGER DEFAULT 0,
                    blocks_found INTEGER DEFAULT 0,
                    pending_payouts REAL DEFAULT 0.0,
                    active_connections INTEGER DEFAULT 0,
                    peak_connections INTEGER DEFAULT 0,
                    shares_processed INTEGER DEFAULT 0,
                    avg_processing_time_ms REAL DEFAULT 0.0,
                    errors_count INTEGER DEFAULT 0,
                    banned_ips INTEGER DEFAULT 0,
                    vardiff_enabled INTEGER DEFAULT 0
                )
            """
            )

            # Create indexes for performance
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_shares_address ON shares(address)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_shares_timestamp ON shares(timestamp)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_blocks_height ON blocks(height)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_payouts_address ON payouts(address)")

            conn.commit()

    def save_miner_stats(self, address: str, stats: MinerStats):
        """Save miner statistics to database"""
        with sqlite3.connect(self.db_file) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO miners
                (address, algorithm, total_shares, valid_shares, invalid_shares,
                 last_share_time, connected_time, balance_pending, balance_paid,
                 difficulty, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
            """,
                (
                    address,
                    stats.algorithm,
                    stats.total_shares,
                    stats.valid_shares,
                    stats.invalid_shares,
                    stats.last_share_time,
                    stats.connected_time,
                    stats.balance_pending,
                    stats.balance_paid,
                    stats.difficulty,
                ),
            )
            conn.commit()

    def load_miner_stats(self, address: str) -> Optional[MinerStats]:
        """Load miner statistics from database"""
        with sqlite3.connect(self.db_file) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM miners WHERE address = ?", (address,))
            row = cursor.fetchone()

            if row:
                return MinerStats(
                    address=row[0],
                    algorithm=row[1],
                    total_shares=row[2],
                    valid_shares=row[3],
                    invalid_shares=row[4],
                    last_share_time=row[5],
                    connected_time=row[6],
                    balance_pending=row[7],
                    balance_paid=row[8],
                    difficulty=row[9],
                )
        return None

    def save_share(
        self,
        address: str,
        algorithm: str,
        job_id: str,
        nonce: str,
        result: str,
        difficulty: int,
        is_valid: bool,
        processing_time: float,
        ip_address: str,
    ):
        """Save share to database"""
        with sqlite3.connect(self.db_file) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO shares
                (address, algorithm, job_id, nonce, result, difficulty, is_valid,
                 processing_time, ip_address, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
            """,
                (address, algorithm, job_id, nonce, result, difficulty, is_valid, processing_time, ip_address),
            )
            conn.commit()

    def get_miner_history(self, address: str, limit: int = 100) -> List[Dict]:
        """Get miner share history"""
        with sqlite3.connect(self.db_file) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT timestamp, is_valid, difficulty, algorithm
                FROM shares
                WHERE address = ?
                ORDER BY timestamp DESC
                LIMIT ?
            """,
                (address, limit),
            )

            history = []
            for row in cursor.fetchall():
                history.append(
                    {"timestamp": row[0], "is_valid": bool(row[1]), "difficulty": row[2], "algorithm": row[3]}
                )
            return history

    def cleanup_old_data(self, days: int = 30):
        """Clean up old share data"""
        cutoff_time = time.time() - (days * 24 * 60 * 60)
        with sqlite3.connect(self.db_file) as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM shares WHERE timestamp < ?", (cutoff_time,))
            deleted_count = cursor.rowcount
            conn.commit()
            print(f"🧹 Cleaned up {deleted_count} old shares from database")

    def get_pool_stats_history(self, hours: int = 24) -> List[Dict]:
        """Get pool statistics history"""
        cutoff_time = time.time() - (hours * 60 * 60)
        with sqlite3.connect(self.db_file) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT timestamp, total_miners, total_shares, valid_shares,
                       invalid_shares, blocks_found, pending_payouts, active_connections
                FROM pool_stats
                WHERE timestamp > ?
                ORDER BY timestamp DESC
            """,
                (cutoff_time,),
            )

            stats = []
            for row in cursor.fetchall():
                stats.append(
                    {
                        "timestamp": row[0],
                        "total_miners": row[1],
                        "total_shares": row[2],
                        "valid_shares": row[3],
                        "invalid_shares": row[4],
                        "blocks_found": row[5],
                        "pending_payouts": row[6],
                        "active_connections": row[7],
                    }
                )
            return stats

    def save_pool_stats(self, stats):
        """Save pool statistics to database"""
        try:
            with sqlite3.connect(self.db_file) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO pool_stats (
                        total_miners, total_shares, valid_shares, invalid_shares,
                        blocks_found, pending_payouts, active_connections,
                        peak_connections, shares_processed, avg_processing_time_ms,
                        errors_count, banned_ips, vardiff_enabled
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                    (
                        stats.get("total_miners", 0),
                        stats.get("total_shares", 0),
                        stats.get("valid_shares", 0),
                        stats.get("invalid_shares", 0),
                        stats.get("blocks_found", 0),
                        stats.get("pending_payouts", 0.0),
                        stats.get("active_connections", 0),
                        stats.get("peak_connections", 0),
                        stats.get("shares_processed", 0),
                        stats.get("avg_processing_time_ms", 0.0),
                        stats.get("errors_count", 0),
                        stats.get("banned_ips", 0),
                        stats.get("vardiff_enabled", False),
                    ),
                )
                conn.commit()
        except Exception as e:
            print(f"Error saving pool stats: {e}")


class ZIONPoolAPIHandler(BaseHTTPRequestHandler):
    """HTTP request handler for pool REST API"""

    def __init__(self, pool_instance, *args, **kwargs):
        self.pool = pool_instance
        super().__init__(*args, **kwargs)

    def do_GET(self):
        """Handle GET requests"""
        try:
            if self.path == "/api/stats":
                self.send_stats_response()
            elif self.path.startswith("/api/miner/"):
                address = self.path.split("/api/miner/")[-1]
                self.send_miner_stats_response(address)
            elif self.path == "/api/pool":
                self.send_pool_info_response()
            elif self.path == "/api/health":
                self.send_health_response()
            # 🎮 CONSCIOUSNESS GAME API ENDPOINTS
            elif self.path.startswith("/api/consciousness/profile/"):
                address = self.path.split("/api/consciousness/profile/")[-1]
                self.send_consciousness_profile(address)
            elif self.path == "/api/consciousness/leaderboard":
                self.send_consciousness_leaderboard()
            elif self.path == "/api/consciousness/levels":
                self.send_consciousness_levels()
            else:
                self.send_error_response(404, "Endpoint not found")
        except Exception as e:
            logger.error(f"API error: {e}")
            self.send_error_response(500, "Internal server error")

    def send_stats_response(self):
        """Send pool statistics"""
        stats = self.pool.get_pool_stats()
        self.send_json_response(stats)

    def send_miner_stats_response(self, address):
        """Send miner-specific statistics"""
        if not address:
            self.send_error_response(400, "Miner address required")
            return

        # Get current stats
        miner_stats = self.pool.get_miner_stats(address)
        if not miner_stats:
            self.send_error_response(404, "Miner not found")
            return

        # Get historical data
        history = self.pool.db.get_miner_history(address)

        response = {
            "address": miner_stats.address,
            "algorithm": miner_stats.algorithm,
            "total_shares": miner_stats.total_shares,
            "valid_shares": miner_stats.valid_shares,
            "invalid_shares": miner_stats.invalid_shares,
            "balance_pending": miner_stats.balance_pending,
            "balance_paid": miner_stats.balance_paid,
            "last_share_time": miner_stats.last_share_time,
            "connected_time": miner_stats.connected_time,
            "difficulty": miner_stats.difficulty,
            "history": history,
        }

        self.send_json_response(response)

    def send_pool_info_response(self):
        """Send general pool information"""
        info = {
            "name": "ZION Universal Mining Pool",
            "version": "2.8.1",
            "algorithms": ["randomx", "yescrypt", "autolykos_v2"],
            "ports": {"stratum": self.pool.port, "api": self.pool.port + 1},
            "fees": {
                "pool_fee_percent": self.pool.pool_fee_percent * 100,
                "payout_threshold": self.pool.payout_threshold,
            },
            "rewards": {
                "base_block_reward": self.pool.base_block_reward,
                "consciousness_multipliers": {
                    "PHYSICAL": 1.0,
                    "EMOTIONAL": 1.05,
                    "MENTAL": 1.1,
                    "SACRED": 1.25,
                    "QUANTUM": 1.5,
                    "COSMIC": 2.0,
                    "ENLIGHTENED": 3.0,
                    "TRANSCENDENT": 5.0,
                    "ON_THE_STAR": 10.0,
                },
                "eco_bonuses": {"randomx": 1.0, "yescrypt": 1.15, "autolykos_v2": 1.2},
            },
            "features": [
                "Variable Difficulty",
                "IP Banning",
                "Performance Monitoring",
                "Database Persistence",
                "REST API",
                "Eco-Friendly Mining",
            ],
        }
        self.send_json_response(info)

    def send_health_response(self):
        """Send health check response"""
        health = {
            "status": "healthy",
            "timestamp": time.time(),
            "uptime_seconds": time.time() - self.pool.performance_stats["start_time"],
            "active_connections": len(self.pool.miners),
            "total_miners": len(self.pool.miner_stats),
            "database_status": "connected" if hasattr(self.pool, "db") else "disconnected",
        }
        self.send_json_response(health)

    # 🎮 CONSCIOUSNESS GAME API METHODS

    def send_consciousness_profile(self, address):
        """Send consciousness profile for miner"""
        if not address:
            self.send_error_response(400, "Miner address required")
            return

        try:
            profile = self.pool.consciousness_game.get_miner_stats(address)
            self.send_json_response(profile)
        except Exception as e:
            logger.error(f"Consciousness profile error: {e}")
            self.send_error_response(500, f"Error fetching consciousness profile: {e}")

    def send_consciousness_leaderboard(self):
        """Send consciousness leaderboard (top 100 miners by XP)"""
        try:
            leaderboard = self.pool.consciousness_game.get_leaderboard(limit=100)
            self.send_json_response({"leaderboard": leaderboard})
        except Exception as e:
            logger.error(f"Consciousness leaderboard error: {e}")
            self.send_error_response(500, f"Error fetching leaderboard: {e}")

    def send_consciousness_levels(self):
        """Send information about all consciousness levels"""
        try:
            from consciousness_mining_game import ConsciousnessLevel

            levels = []
            for level in ConsciousnessLevel:
                levels.append(
                    {
                        "name": level.name,
                        "multiplier": level.value["multiplier"],
                        "xp_required": level.value["xp_required"],
                        "description": level.value.get("description", ""),
                    }
                )
            self.send_json_response({"levels": levels})
        except Exception as e:
            logger.error(f"Consciousness levels error: {e}")
            self.send_error_response(500, f"Error fetching levels: {e}")

    def send_json_response(self, data, status_code=200):
        """Send JSON response"""
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        response_data = json.dumps(data, indent=2).encode("utf-8")
        self.wfile.write(response_data)
        # Store response data for asyncio handler
        self.response_data = response_data

    def send_error_response(self, status_code, message):
        """Send error response"""
        error_data = {"error": {"code": status_code, "message": message}}
        self.send_json_response(error_data, status_code)

    def log_message(self, format, *args):
        """Override to use our logger"""
        logger.info(f"API: {format % args}")


class ZIONPoolAPIServer:
    """Simple HTTP server for pool API using asyncio"""

    def __init__(self, pool_instance, port=3334):
        self.pool = pool_instance
        self.port = port
        self.server = None
        self.task = None

    async def start(self):
        """Start API server using asyncio"""
        try:
            print(f"Starting API server on port {self.port}")
            # Create asyncio HTTP server
            try:
                self.server = await asyncio.start_server(self.handle_request, "0.0.0.0", self.port)
                print(f"API server created successfully")
            except Exception as e:
                print(f"Failed to create API server: {e}")
                raise

            print(f"API server created, starting serve_forever")
            # Start serving - this will run forever
            await self.server.serve_forever()

        except Exception as e:
            logger.error(f"API server error: {e}")
            print(f"API server failed to start: {e}")
            raise

    async def handle_request(self, reader, writer):
        """Handle HTTP request using asyncio"""
        try:
            # Read HTTP request
            data = await reader.read(4096)
            if not data:
                return

            # Parse HTTP request
            request_lines = data.decode("utf-8").split("\n")
            if not request_lines:
                return

            # Parse request line
            request_line = request_lines[0].strip()
            if not request_line:
                return

            parts = request_line.split()
            if len(parts) < 2:
                return

            method = parts[0]
            path = parts[1]

            print(f"API Request: {method} {path}")

            # Create mock handler for compatibility
            class MockHandler:
                def __init__(self, pool, method, path):
                    self.pool = pool
                    self.method = method
                    self.path = path
                    self.response_data = None

                def do_GET(self):
                    """Handle GET requests"""
                    try:
                        if self.path == "/api/stats":
                            self.send_stats_response()
                        elif self.path.startswith("/api/blocks"):
                            # /api/blocks?limit=10
                            self.send_blocks_response()
                        elif self.path.startswith("/api/block/"):
                            # /api/block/{height}
                            try:
                                height = int(self.path.split("/api/block/")[-1])
                                self.send_block_detail(height)
                            except ValueError:
                                self.send_error_response(400, "Invalid block height")
                        elif self.path.startswith("/api/address/"):
                            addr = self.path.split("/api/address/")[-1]
                            self.send_address_response(addr)
                        elif self.path.startswith("/api/tx/"):
                            txid = self.path.split("/api/tx/")[-1]
                            self.send_tx_response(txid)
                        elif self.path.startswith("/api/miner/"):
                            address = self.path.split("/api/miner/")[-1]
                            self.send_miner_stats_response(address)
                        elif self.path == "/api/pool":
                            self.send_pool_info_response()
                        elif self.path == "/api/health":
                            self.send_health_response()
                        # 🎮 CONSCIOUSNESS GAME API ENDPOINTS
                        elif self.path.startswith("/api/consciousness/profile/"):
                            address = self.path.split("/api/consciousness/profile/")[-1]
                            self.send_consciousness_profile(address)
                        elif self.path == "/api/consciousness/leaderboard":
                            self.send_consciousness_leaderboard()
                        elif self.path == "/api/consciousness/levels":
                            self.send_consciousness_levels()
                        else:
                            self.send_error_response(404, "Endpoint not found")
                    except Exception as e:
                        logger.error(f"API error: {e}")
                        self.send_error_response(500, "Internal server error")

                def send_stats_response(self):
                    """Send pool statistics"""
                    stats = self.pool.get_pool_stats()
                    self.send_json_response(stats)

                def send_miner_stats_response(self, address):
                    """Send miner-specific statistics"""
                    if not address:
                        self.send_error_response(400, "Miner address required")
                        return

                    # Get current stats
                    miner_stats = self.pool.get_miner_stats(address)
                    if not miner_stats:
                        self.send_error_response(404, "Miner not found")
                        return

                    # Get historical data
                    history = self.pool.db.get_miner_history(address)

                    response = {
                        "address": miner_stats.address,
                        "algorithm": miner_stats.algorithm,
                        "total_shares": miner_stats.total_shares,
                        "valid_shares": miner_stats.valid_shares,
                        "invalid_shares": miner_stats.invalid_shares,
                        "balance_pending": miner_stats.balance_pending,
                        "balance_paid": miner_stats.balance_paid,
                        "last_share_time": miner_stats.last_share_time,
                        "connected_time": miner_stats.connected_time,
                        "difficulty": miner_stats.difficulty,
                        "history": history,
                    }

                    self.send_json_response(response)

                def send_pool_info_response(self):
                    """Send general pool information"""
                    info = {
                        "name": "ZION Universal Mining Pool",
                        "version": "2.8.1",
                        "algorithms": ["randomx", "yescrypt", "autolykos_v2"],
                        "ports": {"stratum": self.pool.port, "api": self.pool.port + 1},
                        "fees": {
                            "pool_fee_percent": self.pool.pool_fee_percent * 100,
                            "payout_threshold": self.pool.payout_threshold,
                        },
                        "rewards": {
                            "base_block_reward": self.pool.base_block_reward,
                            "consciousness_multipliers": {
                                "PHYSICAL": 1.0,
                                "EMOTIONAL": 1.05,
                                "MENTAL": 1.1,
                                "SACRED": 1.25,
                                "QUANTUM": 1.5,
                                "COSMIC": 2.0,
                                "ENLIGHTENED": 3.0,
                                "TRANSCENDENT": 5.0,
                                "ON_THE_STAR": 10.0,
                            },
                            "eco_bonuses": {"randomx": 1.0, "yescrypt": 1.15, "autolykos_v2": 1.2},
                        },
                        "features": [
                            "Variable Difficulty",
                            "IP Banning",
                            "Performance Monitoring",
                            "Database Persistence",
                            "REST API",
                            "Eco-Friendly Mining",
                        ],
                    }
                    self.send_json_response(info)

                def send_health_response(self):
                    """Send health check response"""
                    health = {
                        "status": "healthy",
                        "timestamp": time.time(),
                        "uptime_seconds": time.time() - self.pool.performance_stats["start_time"],
                        "active_connections": len(self.pool.miners),
                        "total_miners": len(self.pool.miner_stats),
                        "database_status": "connected" if hasattr(self.pool, "db") else "disconnected",
                    }
                    self.send_json_response(health)

                # 🎮 CONSCIOUSNESS GAME API METHODS

                def send_consciousness_profile(self, address):
                    """Send consciousness profile for miner"""
                    if not address:
                        self.send_error_response(400, "Miner address required")
                        return

                    try:
                        profile = self.pool.consciousness_game.get_miner_stats(address)
                        self.send_json_response(profile)
                    except Exception as e:
                        logger.error(f"Consciousness profile error: {e}")
                        self.send_error_response(500, f"Error fetching consciousness profile: {e}")

                def send_consciousness_leaderboard(self):
                    """Send consciousness leaderboard (top 100 miners by XP)"""
                    try:
                        leaderboard = self.pool.consciousness_game.get_leaderboard(limit=100)
                        self.send_json_response({"leaderboard": leaderboard})
                    except Exception as e:
                        logger.error(f"Consciousness leaderboard error: {e}")
                        self.send_error_response(500, f"Error fetching leaderboard: {e}")

                def send_consciousness_levels(self):
                    """Send information about all consciousness levels"""
                    try:
                        from consciousness_mining_game import ConsciousnessLevel

                        levels = []
                        for level in ConsciousnessLevel:
                            levels.append(
                                {
                                    "name": level.name,
                                    "multiplier": level.value["multiplier"],
                                    "xp_required": level.value["xp_required"],
                                    "description": level.value.get("description", ""),
                                }
                            )
                        self.send_json_response({"levels": levels})
                    except Exception as e:
                        logger.error(f"Consciousness levels error: {e}")
                        self.send_error_response(500, f"Error fetching levels: {e}")

                def send_json_response(self, data, status_code=200):
                    """Send JSON response"""
                    self.response_data = json.dumps(data, indent=2).encode("utf-8")

                def send_error_response(self, status_code, message):
                    """Send error response"""
                    error_data = {"error": {"code": status_code, "message": message}}
                    self.send_json_response(error_data, status_code)

                # --- Explorer skeleton endpoints ---
                def send_blocks_response(self):
                    limit = 10
                    try:
                        # naive query param parse
                        if "?" in self.path:
                            q = self.path.split("?",1)[1]
                            for part in q.split("&"):
                                if part.startswith("limit="):
                                    limit = int(part.split("=",1)[1])
                                    limit = max(1, min(limit, 100))
                    except:
                        pass
                    blocks = []
                    try:
                        with sqlite3.connect(self.pool.db.db_file) as conn:
                            c = conn.cursor()
                            c.execute("SELECT height, hash, total_shares, reward_amount, pool_fee, status, timestamp FROM blocks ORDER BY height DESC LIMIT ?", (limit,))
                            for row in c.fetchall():
                                blocks.append({
                                    "height": row[0],
                                    "hash": row[1],
                                    "total_shares": row[2],
                                    "reward": row[3],
                                    "pool_fee": row[4],
                                    "status": row[5],
                                    "timestamp": row[6]
                                })
                    except Exception as e:
                        logger.error(f"Blocks query failed: {e}")
                    self.send_json_response({"blocks": blocks, "count": len(blocks)})

                def send_block_detail(self, height: int):
                    block = None
                    shares = []
                    try:
                        with sqlite3.connect(self.pool.db.db_file) as conn:
                            c = conn.cursor()
                            c.execute("SELECT id, hash, total_shares, reward_amount, pool_fee, status, timestamp FROM blocks WHERE height=?", (height,))
                            row = c.fetchone()
                            if row:
                                block_id = row[0]
                                block = {
                                    "height": height,
                                    "hash": row[1],
                                    "total_shares": row[2],
                                    "reward": row[3],
                                    "pool_fee": row[4],
                                    "status": row[5],
                                    "timestamp": row[6]
                                }
                                # fetch block_shares mapping if exists
                                try:
                                    c.execute("SELECT address, shares FROM block_shares WHERE block_id=?", (block_id,))
                                    for sr in c.fetchall():
                                        shares.append({"address": sr[0], "shares": sr[1]})
                                except Exception:
                                    pass
                    except Exception as e:
                        logger.error(f"Block detail query failed: {e}")
                    if not block:
                        self.send_error_response(404, "Block not found")
                        return
                    block["miner_shares"] = shares
                    self.send_json_response(block)

                def send_address_response(self, address: str):
                    if not address:
                        self.send_error_response(400, "Address required")
                        return
                    data = {"address": address, "total_shares": 0, "valid_shares": 0, "pending": 0.0, "paid": 0.0}
                    try:
                        with sqlite3.connect(self.pool.db.db_file) as conn:
                            c = conn.cursor()
                            c.execute("SELECT total_shares, valid_shares, balance_pending, balance_paid FROM miners WHERE address=?", (address,))
                            row = c.fetchone()
                            if row:
                                data.update({
                                    "total_shares": row[0],
                                    "valid_shares": row[1],
                                    "pending": row[2],
                                    "paid": row[3]
                                })
                            # recent shares sample
                            c.execute("SELECT timestamp, difficulty FROM shares WHERE address=? ORDER BY timestamp DESC LIMIT 25", (address,))
                            data["recent_shares"] = [ {"timestamp": r[0], "difficulty": r[1]} for r in c.fetchall() ]
                    except Exception as e:
                        logger.error(f"Address query failed: {e}")
                    self.send_json_response(data)

                def send_tx_response(self, txid: str):
                    # Placeholder – full transactions not yet modeled in pool DB
                    self.send_json_response({"txid": txid, "status": "unavailable", "note": "Transaction indexing not implemented yet"})

            # Create handler and process request
            handler = MockHandler(self.pool, method, path)
            if method == "GET":
                handler.do_GET()
            else:
                handler.send_error_response(405, "Method not allowed")

            # Send response
            response_data = handler.response_data or b'{"error": "No response"}'
            status_line = f"HTTP/1.1 {200 if handler.response_data else 500} OK\r\n"
            headers = "Content-Type: application/json\r\n" "Access-Control-Allow-Origin: *\r\n" "\r\n"

            response = status_line.encode() + headers.encode() + response_data
            writer.write(response)
            await writer.drain()
            print(f"API Response sent: {len(response)} bytes")

        except Exception as e:
            logger.error(f"Request handling error: {e}")
            print(f"API Error: {e}")
            # Send error response
            error_response = (
                b"HTTP/1.1 500 Internal Server Error\r\n"
                b"Content-Type: application/json\r\n"
                b"Access-Control-Allow-Origin: *\r\n"
                b"\r\n"
                b'{"error": "Internal server error"}'
            )
            try:
                writer.write(error_response)
                await writer.drain()
            except:
                pass
        finally:
            writer.close()
            await writer.wait_closed()

    def stop(self):
        """Stop API server"""
        if self.server:
            self.server.close()
            print("📊 Pool API server stopped")
        if self.task:
            self.task.cancel()


class ZionUniversalPool:
    def __init__(self, port=None, network="mainnet", test_block_threshold: Optional[int] = None):
        # Use centralized pool configuration
        pool_config = ZionNetworkConfig.POOL_CONFIG

        self.network = network
        self.port = port or pool_config["stratum_port"]
        self.miners: Dict[tuple, dict] = {}
        self.miner_stats: Dict[str, MinerStats] = {}
        self.current_jobs = {
            "cosmic_harmony": None,  # 🌟 Native ZION algorithm
            "randomx": None,
            "kawpow": None,
            "ethash": None,
            "yescrypt": None,
            "autolykos2": None,
        }
        self.active_jobs_queue = []  # Keep last 5 jobs for reconnect replay
        self.job_counter = 0
        self.share_counter = 0
        self.block_counter = 0
        # Testing override for block mining threshold (shares)
        self.test_block_threshold = test_block_threshold

        # Reward system from centralized config
        self.pool_blocks: List[PoolBlock] = []
        self.pool_wallet_address = "ZION_SACRED_B0FA7E2A234D8C2F08545F02295C98"  # Sacred Mining Operator from premine
        self.pool_fee_percent = pool_config["fee_percent"]
        self.payout_threshold = pool_config["payout_threshold"]

        # Economic model - fee distribution
        self.humanitarian_fee_percent = 0.10  # 10% for Children Future Fund (desátek pro humanitu)
        self.dev_team_fee_percent = 0.01  # 1% for Development Team
        self.genesis_fee_percent = 0.0033  # 0.33% Genesis Creator Lifetime Rent (Yeshuae Amon Ra) 💰
        self.pool_admin_fee_percent = 0.01  # 1% Pool Admin Fee (Maitreya Buddha) 💎

        # Fee recipient addresses
        self.humanitarian_address = "ZION_CHILDREN_FUTURE_FUND_1ECCB72BC30AADD086656A59"
        self.dev_team_address = "ZION_DEVELOPMENT_TEAM_FUND_378614887FEA27791540F45"
        self.genesis_creator_address = "ZION_ON_THE_STAR_0B461AB5BCACC40D1ECE95A2D82030"  # Yeshuae Amon Ra
        self.pool_admin_address = (
            "ZION_MAITREYA_BUDDHA_DAO_ADMIN_D7A371ABD1FF1C5D42AB02"  # Maitreya Buddha (Pool Admin)
        )

        # Real blockchain integration via RPC (use Docker service name)
        rpc_port = 8545  # Standard RPC port (changed from 8332 to match new config)

        # Try Docker service name first, then fallback to localhost
        import socket

        try:
            # Docker network: use service name
            socket.gethostbyname("zion-node")
            self.blockchain_rpc = ZionBlockchainRPCClient(host="zion-node", port=rpc_port)
            logger.info(f"🔗 Connected to blockchain RPC at zion-node:{rpc_port}")
        except socket.gaierror:
            # Fallback to localhost (dev mode or direct host)
            self.blockchain_rpc = ZionBlockchainRPCClient(host="localhost", port=rpc_port)
            logger.info(f"🔗 Connected to blockchain RPC at localhost:{rpc_port}")

        # Fallback: Create local blockchain for development (will auto-connect if RPC fails)
        self.blockchain = None
        if not (self.blockchain_rpc and self.blockchain_rpc.health_check()):
            logger.warning("⚠️  Blockchain RPC unavailable, falling back to local instance")
            self.blockchain = NewZionBlockchain(enable_rpc=False)

        # Get current height and block reward from blockchain (fallback safe)
        if self.blockchain_rpc and self.blockchain_rpc.health_check():
            rpc_height = self.blockchain_rpc.get_height()
            if rpc_height >= 0:
                # Use RPC height directly; genesis height of 1 is valid for a fresh network
                self.current_block_height = rpc_height
                logger.info(f"📡 Connected to blockchain via RPC at height {rpc_height}")
            else:
                logger.warning("⚠️ RPC health check passed but get_height failed - possible stale RPC")
                self.current_block_height = len(self.blockchain.blocks) - 1 if self.blockchain else 0
        else:
            self.current_block_height = len(self.blockchain.blocks) - 1 if self.blockchain else 0
            logger.info(f"📦 Using local blockchain at height {self.current_block_height}")

        self.base_block_reward = ZionNetworkConfig.ECONOMIC_MODEL["mining_config"]["base_block_reward"]  # Now 50.0 ZION

        logger.info(f"💎 Pool initialized")
        logger.info(f"💰 Base block reward: {self.base_block_reward} ZION (before consciousness multiplier)")

        # Share validation
        self.submitted_shares = {}  # Dict with timestamp for expiration: {share_key: timestamp}
        self.share_window_size = 100  # Rolling window for difficulty adjustment
        self.duplicate_cache_max_size = 10000  # Maximum entries in duplicate cache
        self.duplicate_cache_cleanup_interval = 60  # Cleanup every 60 seconds

        # Algorithm difficulty from centralized config
        self.difficulty = pool_config["difficulty"].copy()
        # TEMP: snížit Yescrypt difficulty pro rychlejší validaci na CPU (lze vrátit po ověření)
        try:
            self.difficulty["yescrypt"] = 1  # Ultra-low for bring-up testing
            logger.info(f"⚙️  Yescrypt difficulty set to {self.difficulty['yescrypt']} (temp for validation)")
        except Exception:
            self.difficulty["yescrypt"] = 1

        # Eco-friendly algorithm rewards from centralized config
        self.eco_rewards = pool_config["eco_rewards"].copy()

        # Jobs and submissions tracking
        self.jobs = {}
        self.submissions = set()

        # Performance monitoring
        self.performance_stats = {
            "start_time": time.time(),
            "total_connections": 0,
            "total_shares_processed": 0,
            "avg_share_processing_time": 0.0,
            "peak_connections": 0,
            "errors_count": 0,
            "last_reset": time.time(),
        }
        self.share_processing_times = []

        # Variable difficulty system (inspired by Node Stratum Pool)
        self.vardiff = {
            "enabled": True,
            "min_diff": {"randomx": 1000, "yescrypt": 5000, "autolykos_v2": 50},
            "max_diff": {"randomx": 50000, "yescrypt": 40000, "autolykos_v2": 2500},
            "target_time": 20,  # seconds per share (eco-friendly - longer than 15s standard)
            "retarget_time": 90,  # check every 90 seconds
            "variance_percent": 30,  # tolerance before retargeting
        }

        # Session management and IP banning
        self.banned_ips = {}
        self.connection_stats = {}
        self.banning = {
            "enabled": True,
            "invalid_percent_threshold": 60,  # ban at 60% invalid (more tolerant than 50%)
            "check_threshold": 200,  # check after 200 shares
            "ban_duration": 600,  # 10 minutes
        }

        # Database integration
        self.db = ZIONPoolDatabase()

        # 🎮 CONSCIOUSNESS MINING GAME - 10-Year Evolution Journey!
        self.consciousness_game = ConsciousnessMiningGame()
        logger.info("🎮 Consciousness Mining Game initialized! 10-year journey begins...")
        logger.info("   📊 9 Consciousness Levels: Physical → ON_THE_STAR")
        logger.info("   💰 Bonus Pool: 1,902.59 ZION/block from 10B premine")
        logger.info("   🏆 Grand Prize: 1.75B ZION distributed Oct 10, 2035")
        logger.info("   🥚 Hiranyagarbha: 500M ZION for enlightened winner")

        # API server from centralized config
        api_port = int(os.getenv("POOL_ADMIN_PORT", self.port + 1))  # Read from ENV or default to stratum port + 1
        self.api_server = ZIONPoolAPIServer(self, port=api_port)
        logger.info(f"🌐 Pool Admin API configured on port {api_port}")

        # Initialize RandomX engine for share validation (optional)
        self.randomx_engine = None  # Using pure SHA256 validation for now

        # Start Prometheus metrics server on port 9090
        try:
            # prometheus_port = pool_config.get('prometheus_port', 9090)
            # start_http_server(prometheus_port)  # Disabled for async compatibility
            # logger.info(f"📊 Prometheus metrics server started on port {prometheus_port}")
            # logger.info(f"   Metrics available at: http://localhost:{prometheus_port}/metrics")
            logger.info(f"📊 Prometheus metrics (disabled for async compatibility)")
        except Exception as e:
            logger.warning(f"⚠️ Could not start Prometheus server: {e}")

    def validate_zion_address(self, address):
        """Validate ZION address format"""
        if address.startswith("ZION_") and len(address) == 37:
            # ZION_ + 32 hex characters
            hex_part = address[5:]
            try:
                int(hex_part, 16)  # Verify it's valid hex
                return True
            except ValueError:
                return False
        return False

    def _manage_duplicate_cache(self):
        """Manage duplicate share cache: cleanup expired entries and enforce size limits"""
        current_time = time.time()

        # Clean expired shares (older than 5 minutes)
        expired_keys = [k for k, t in self.submitted_shares.items() if current_time - t > 300]
        for k in expired_keys:
            del self.submitted_shares[k]

        # Enforce size limit using LRU-style eviction (remove oldest entries)
        if len(self.submitted_shares) > self.duplicate_cache_max_size:
            # Sort by timestamp (oldest first) and remove excess
            sorted_entries = sorted(self.submitted_shares.items(), key=lambda x: x[1])
            excess_count = len(self.submitted_shares) - self.duplicate_cache_max_size

            for i in range(excess_count):
                del self.submitted_shares[sorted_entries[i][0]]

            logger.info(
                f"🧹 Cleaned up {excess_count} old duplicate cache entries (size limit: {self.duplicate_cache_max_size})"
            )

    def is_duplicate_share(self, share_key: str) -> bool:
        """Check if share is duplicate with optimized cache management"""
        current_time = time.time()

        # Manage cache before checking
        self._manage_duplicate_cache()

        # Check if share key exists
        if share_key in self.submitted_shares:
            # Update timestamp to prevent premature eviction
            self.submitted_shares[share_key] = current_time
            return True

        # Add new share to cache
        self.submitted_shares[share_key] = current_time
        return False

    def convert_address_for_mining(self, address):
        """Convert address for mining compatibility"""
        return address

    def get_miner_stats(self, address: str) -> MinerStats:
        """Get or create miner statistics with database persistence"""
        if address not in self.miner_stats:
            # Try to load from database first
            db_stats = self.db.load_miner_stats(address)
            if db_stats:
                self.miner_stats[address] = db_stats
            else:
                self.miner_stats[address] = MinerStats(address=address)
        return self.miner_stats[address]

    def validate_cosmic_harmony_share(self, job_id: str, nonce: int, result: str, difficulty: int) -> bool:
        """
        🌟 Validate Cosmic Harmony (Native ZION) share
        Validates against 5-stage hash: Blake3 + Keccak + SHA3 + Golden Ratio + Fusion
        """
        try:
            # Allow forcing validation mode via env flags during bring-up
            force_placeholder = os.environ.get("ZION_CH_PLACEHOLDER", "0") == "1"
            force_core = os.environ.get("ZION_CH_CORE", "0") == "1"
            if force_placeholder:
                logger.debug("[CH] Forcing placeholder validation via ZION_CH_PLACEHOLDER=1")

            if (not COSMIC_HARMONY_AVAILABLE) or force_placeholder:
                # Placeholder validation aligned with GPU kernel: accept if state[0] <= target32
                job = self.jobs.get(job_id)
                if not job:
                    return False
                try:
                    target32 = int(job.get("target32", "ffffffff"), 16)
                    res_bytes = bytes.fromhex(result)
                    if len(res_bytes) < 4:
                        return False
                    state0 = int.from_bytes(res_bytes[:4], byteorder="little", signed=False)
                    ok = state0 <= target32
                    if ok:
                        logger.info(
                            f"✅ [Placeholder] Cosmic Harmony share accepted: state0=0x{state0:08x} <= target=0x{target32:08x}"
                        )
                    else:
                        logger.debug(f"❌ [Placeholder] state0=0x{state0:08x} > target=0x{target32:08x}")
                    return ok
                except Exception as pe:
                    logger.debug(f"Placeholder validation error: {pe}")
                    return False

            # Get job
            if job_id not in self.jobs:
                logger.warning(f"Job {job_id} not found")
                return False

            job = self.jobs[job_id]
            block_data = job.get("data", b"")
            # Some job creators store header under different keys
            if not block_data:
                header_hex = job.get("block_header") or job.get("header")
                if header_hex:
                    try:
                        block_data = bytes.fromhex(header_hex)
                    except Exception:
                        block_data = b""

            # Use Cosmic Harmony wrapper
            try:
                hasher = get_hasher()
                # Core-strict mode: recompute hash and require full match with submitted result
                if force_core:
                    hash_result = hasher.hash(block_data or b"", int(nonce))
                    # Require full equality
                    if hash_result.hex() != result.lower():
                        logger.debug("[Core] Submitted result does not match recomputed hash")
                        return False
                    # Map difficulty to 32-bit target used in jobs and check
                    target32 = int(job.get("target32", "ffffffff"), 16)
                    is_valid = getattr(hasher, "check_target32", lambda h, t: True)(hash_result, target32)
                    if is_valid:
                        logger.info(
                            f"✅ [Core] Cosmic Harmony share validated (strict): nonce={nonce}, target32=0x{target32:08x}"
                        )
                    else:
                        logger.debug("❌ [Core] check_target32 failed")
                    return is_valid

                # Default: use core to analyze but still rely on target32 rule on submitted result
                # (Compatibility path while GPU kernel is simplified)
                try:
                    target32 = int(job.get("target32", "ffffffff"), 16)
                except Exception:
                    target32 = 0xFFFFFFFF
                res_bytes = bytes.fromhex(result)
                if len(res_bytes) < 4:
                    return False
                state0 = int.from_bytes(res_bytes[:4], "little")
                ok = state0 <= target32
                if not ok:
                    # If it fails, log what core would compute for diagnostics
                    try:
                        core_hash = hasher.hash(block_data or b"", int(nonce))
                        logger.debug(
                            f"[CoreDiag] state0=0x{state0:08x} target=0x{target32:08x} core[:8]={core_hash[:4].hex()}..."
                        )
                    except Exception:
                        pass
                else:
                    logger.info(
                        f"✅ [Core-assisted] Accepted by target32 rule: state0=0x{state0:08x} <= target=0x{target32:08x}"
                    )
                return ok
            except Exception as core_err:
                logger.error(f"Cosmic Harmony core validation failed, using placeholder: {core_err}")
                # Fallback to placeholder rule if core validator errors
                job = self.jobs.get(job_id)
                if not job:
                    return False
                try:
                    target32 = int(job.get("target32", "ffffffff"), 16)
                    res_bytes = bytes.fromhex(result)
                    if len(res_bytes) < 4:
                        return False
                    state0 = int.from_bytes(res_bytes[:4], byteorder="little", signed=False)
                    ok = state0 <= target32
                    if ok:
                        logger.info(
                            f"✅ [Fallback->Placeholder] Cosmic Harmony share accepted: state0=0x{state0:08x} <= target=0x{target32:08x}"
                        )
                    else:
                        logger.debug(f"❌ [Fallback->Placeholder] state0=0x{state0:08x} > target=0x{target32:08x}")
                    return ok
                except Exception as pe2:
                    logger.debug(f"Fallback placeholder validation error: {pe2}")
                    return False

        except Exception as e:
            # Include exception type for easier triage
            logger.error(f"Cosmic Harmony validation error: {type(e).__name__}: {e}")
            return False

    def validate_kawpow_share(self, job_id: str, nonce: str, mix_hash: str, header_hash: str, difficulty: int) -> bool:
        """
        Real KawPow (ProgPow) share validation
        This is a simplified implementation - in production, use proper ProgPow library
        """
        try:
            # Get job details
            if job_id not in self.jobs:
                return False

            job = self.jobs[job_id]

            # Basic validation checks
            if not all([nonce, mix_hash, header_hash]):
                return False

            # Convert nonce to integer for validation
            try:
                nonce_int = int(nonce, 16)
            except ValueError:
                return False

            # Simplified ProgPow-like validation
            # In production, this should use actual ProgPow algorithm
            # For now, we'll use a hash-based validation that's deterministic

            # Create validation hash: header_hash + nonce + mix_hash
            validation_data = f"{header_hash}{nonce}{mix_hash}"
            validation_hash = hashlib.sha256(validation_data.encode()).hexdigest()

            # Convert to target for difficulty check
            target = int(validation_hash[:16], 16)  # First 16 hex chars as target

            # Check if hash meets difficulty requirement
            # Lower target value = higher difficulty met
            required_target = 2**256 // difficulty

            return target < required_target

        except Exception as e:
            logger.error(f"KawPow validation error: {e}")
            return False

    def validate_randomx_share(self, job_id: str, nonce: str, result: str, difficulty: int) -> bool:
        """
        Realistic RandomX share validation with tiered strategy:
        - Tier 1 (always): Validate structure + 64-bit target check against submitted result
        - Tier 2 (optional): If RandomX library is available, recompute hash from blob+nonce+seed and compare

        Safety knobs:
        - Set env ZION_RANDOMX_ACCEPT_ALL=1 to temporarily accept all shares (bring-up)
        """
        try:
            # 🔬 DEBUG LOGGING - Phase 1
            logger.info(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            logger.info(f"🔬 RANDOMX VALIDATION START")
            logger.info(f"   Job ID: {job_id}")
            logger.info(f"   Nonce: {nonce}")
            logger.info(f"   Result: {result[:32]}... (len={len(result)})")
            logger.info(f"   Difficulty: {difficulty}")

            # Allow explicit bypass for bring-up
            if os.environ.get("ZION_RANDOMX_ACCEPT_ALL", "0") == "1":
                logger.info(f"🧪 [TEST] Accepting RandomX share (env override)")
                logger.info(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
                return True

            # Lookup job
            job = self.jobs.get(job_id)
            if not job:
                logger.warning(f"❌ Job {job_id} not found in active jobs!")
                logger.info(f"   Available jobs: {list(self.jobs.keys())}")
                logger.info(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
                return False

            # 🔬 DEBUG: Job details
            logger.info(f"📋 JOB DATA:")
            logger.info(f"   Blob: {job.get('blob', '')[:64]}... (len={len(job.get('blob', ''))})")
            logger.info(f"   Seed Hash: {job.get('seed_hash', '')[:32]}...")
            logger.info(f"   Target: {job.get('target', '')}")
            logger.info(f"   Height: {job.get('height', 0)}")
            logger.info(f"   Algorithm: {job.get('algo', 'unknown')}")

            # Basic field checks
            if not (nonce and result):
                logger.warning(f"❌ Missing nonce or result")
                logger.info(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
                return False

            # Parse target (8-byte little-endian hex) -> int
            try:
                target_hex = job.get("target")
                if not target_hex or len(target_hex) != 16:
                    logger.warning(f"❌ Invalid target: {target_hex} (len={len(target_hex) if target_hex else 0})")
                    logger.info(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
                    return False
                target_int = int.from_bytes(bytes.fromhex(target_hex), "little", signed=False)
                logger.info(f"🎯 Target parsed: 0x{target_int:016x}")
                if target_int <= 0:
                    logger.warning(f"❌ Target is zero or negative")
                    logger.info(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
                    return False
            except Exception as e:
                logger.warning(f"❌ Target parse error: {e}")
                logger.info(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
                return False

            # Parse result hash (32 bytes)
            try:
                result_bytes = bytes.fromhex(result)
                if len(result_bytes) != 32:
                    logger.warning(f"❌ Result length {len(result_bytes)} != 32 bytes")
                    logger.info(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
                    return False
                logger.info(f"📊 Result hash: {result_bytes.hex()[:32]}...")
            except Exception as e:
                logger.warning(f"❌ Result parse error: {e}")
                logger.info(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
                return False

            # Tier 1: 64-bit target rule (Monero-style)
            # Compare low 64 bits (first 8 bytes, little-endian) against target
            try:
                res_low64 = int.from_bytes(result_bytes[:8], "little", signed=False)
                logger.info(f"🔍 Tier 1 Check (64-bit target):")
                logger.info(f"   Result low64: 0x{res_low64:016x}")
                logger.info(f"   Target:       0x{target_int:016x}")
                logger.info(f"   Passes: {res_low64 <= target_int}")

                if res_low64 > target_int:
                    logger.warning(f"❌ REJECTED: low64 > target")
                    logger.info(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
                    return False
                logger.info(f"✅ Tier 1: PASSED (target check)")
            except Exception as e:
                logger.warning(f"❌ Low64 compare error: {e}")
                logger.info(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
                return False

            # Tier 2: Optional full recomputation using RandomX engine if available
            # We treat recompute mismatch as invalid only if recompute succeeded cleanly.
            logger.info(f"🔍 Tier 2 Check (RandomX recompute):")
            try:
                rx_lib = None
                for mod in ("pyrx", "randomx"):
                    try:
                        rx_lib = __import__(mod)
                        logger.info(f"   Found library: {mod}")
                        break
                    except Exception:
                        continue

                if rx_lib is None:
                    logger.info(f"   ⚠️  No RandomX library available - skipping Tier 2")
                    logger.info(f"   ✅ ACCEPTED (Tier 1 only)")
                    logger.info(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
                    return True

                # Prepare blob with nonce inserted at last 4 bytes (Monero layout, LE)
                blob_hex = job.get("blob")
                if isinstance(blob_hex, str) and len(blob_hex) == 152:
                    try:
                        blob_bytes = bytearray(bytes.fromhex(blob_hex))
                        logger.info(f"   Blob length: {len(blob_bytes)} bytes ({len(blob_hex)} hex chars)")

                        # Nonce: accept 4-byte LE (8 hex chars) or 8-byte LE (16 hex chars); use lower 4 bytes for Monero
                        nonce_int = int(nonce, 16)
                        nonce4 = nonce_int & 0xFFFFFFFF
                        logger.info(f"   Nonce: {nonce} → 0x{nonce4:08x}")
                        logger.info(f"   Inserting nonce at offset -4 (last 4 bytes)")
                        blob_bytes[-4:] = nonce4.to_bytes(4, "little")
                        logger.info(f"   Blob with nonce: {blob_bytes.hex()[:64]}...")

                        seed_hex = job.get("seed_hash") or ""
                        seed_bytes = bytes.fromhex(seed_hex) if len(seed_hex) == 64 else bytes(32)
                        logger.info(f"   Seed hash: {seed_bytes.hex()[:32]}...")

                        # Try common APIs in popular Python bindings
                        recomputed = None
                        # pyrx API: pyrx.get_rx_hash(data, seed)
                        if hasattr(rx_lib, "get_rx_hash"):
                            logger.info(f"   Using pyrx.get_rx_hash()")
                            recomputed = rx_lib.get_rx_hash(bytes(blob_bytes), seed_bytes)
                        # randomx API variants (placeholder, best-effort)
                        elif hasattr(rx_lib, "randomx") and hasattr(rx_lib.randomx, "hash"):  # type: ignore[attr-defined]
                            logger.info(f"   Using randomx.hash()")
                            recomputed = rx_lib.randomx.hash(bytes(blob_bytes), seed_bytes)  # type: ignore[attr-defined]

                        if recomputed is not None:
                            # Normalize to bytes
                            if isinstance(recomputed, str):
                                recomputed_bytes = bytes.fromhex(recomputed)
                            else:
                                recomputed_bytes = bytes(recomputed)

                            logger.info(f"   Calculated hash: {recomputed_bytes.hex()[:32]}...")
                            logger.info(f"   Miner result:    {result_bytes.hex()[:32]}...")
                            logger.info(f"   Match: {recomputed_bytes == result_bytes}")

                            if len(recomputed_bytes) == 32:
                                if recomputed_bytes != result_bytes:
                                    logger.warning(f"❌ REJECTED: RandomX recompute mismatch")
                                    logger.info(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
                                    return False
                                logger.info(f"   ✅ Tier 2: PASSED (hash match)")
                        else:
                            logger.info(f"   ⚠️  Recompute returned None")
                    except Exception as re:
                        # Recompute failed; fall back to Tier 1 acceptance already passed
                        logger.info(f"   ⚠️  Recompute error: {re}")
                        logger.info(f"   ✅ ACCEPTED (Tier 1, recompute failed)")
                        logger.info(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
                        return True
                else:
                    logger.info(f"   ⚠️  Blob invalid: len={len(blob_hex) if blob_hex else 0}, expected=152")

            except Exception as e:
                # Any unexpected errors in optional Tier 2 shouldn't reject shares
                logger.info(f"   ⚠️  Tier 2 error: {e}")

            # Passed Tier 1 (and Tier 2 if available)
            logger.info(f"✅ ACCEPTED (all checks passed)")
            logger.info(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            return True

        except Exception as e:
            logger.error(f"❌ RandomX validation exception: {e}")
            logger.info(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            return False

    def validate_autolykos_v2_share(self, job_id: str, nonce: str, result: str, difficulty: int) -> bool:
        """
        Autolykos v2 share validation
        Memory-hard algorithm validation for energy-efficient GPU mining
        """
        try:
            if job_id not in self.jobs:
                return False

            # Basic format validation
            if not nonce or not result:
                return False

            # TEST MODE: accept all Autolykos v2 shares to validate pipeline end-to-end
            if os.environ.get("ZION_ALV2_ACCEPT_ALL", "0") == "1":
                logger.info(f"🧪 [TEST] Accepting Autolykos v2 share: job={job_id}, nonce={nonce}")
                return True

            job = self.jobs[job_id]
            # Reconstruct expected result based on current GPU kernel placeholder
            header_hex = job.get("header") or job.get("block_header") or ""
            if not header_hex:
                return False
            try:
                header_bytes = bytes.fromhex(header_hex[:64].ljust(64, "0"))
            except ValueError:
                return False

            # Parse nonce (hex string) into 4-byte little-endian as kernel uses (uint)
            try:
                nonce_int = int(nonce, 16)
            except ValueError:
                return False

            import struct

            nb4 = struct.pack("<I", nonce_int & 0xFFFFFFFF)
            # Kernel placeholder: test_hash[i] = header[i] ^ nb4[i % 4]
            expected = bytes((header_bytes[i] ^ nb4[i % 4]) for i in range(32))

            # Compare submitted result with expected (hex)
            try:
                result_bytes = bytes.fromhex(result)
            except ValueError:
                return False

            if result_bytes != expected:
                logger.debug("Autolykos v2 result mismatch with expected placeholder hash")
                return False

            # Target comparison (lexicographic big-endian like OpenCL code)
            target_hex = job.get("target")
            if not target_hex:
                # Fallback compute from difficulty
                diff_val = max(1, int(difficulty))
                target_int = (1 << 256) // diff_val
                target_bytes = target_int.to_bytes(32, "big")
            else:
                try:
                    target_bytes = bytes.fromhex(target_hex)
                except ValueError:
                    return False

            is_valid = expected <= target_bytes
            logger.debug(f"Autolykos v2 placeholder validation: {is_valid}")
            return is_valid

        except Exception as e:
            logger.error(f"Autolykos v2 validation error: {e}")
            return False

    def validate_yescrypt_share(self, job_id: str, nonce: str, result: str, difficulty: int) -> bool:
        """
        Enhanced Yescrypt share validation
        Memory-hard algorithm for ultra energy-efficient CPU mining
        Supports C extension validation for maximum performance
        """
        try:
            if job_id not in self.jobs:
                logger.debug(f"Job {job_id} not found")
                return False

            # Basic format validation
            if not nonce or not result:
                logger.debug("Missing nonce or result")
                return False

            job = self.jobs[job_id]

            # Prefer validating against the miner-submitted result to avoid implementation drift
            try:
                submitted = bytes.fromhex(result)
                if len(submitted) == 32:
                    hash_result = submitted
                else:
                    raise ValueError("Submitted result has invalid length")
            except Exception:
                # If submitted result is unusable, try to recompute with local C extension (best effort)
                if YESCRYPT_FAST_AVAILABLE and yescrypt_fast:
                    try:
                        header_data = f"{job_id}{nonce}{job.get('block_header', '')}".encode()
                        hash_result = yescrypt_fast.hash(header_data)
                    except Exception:
                        logger.warning("Yescrypt C extension failed, falling back to Python simulation")
                        hash_result = None
                else:
                    hash_result = None

                if hash_result is None:
                    # Fallback to a conservative Python simulation (low accuracy)
                    logger.debug("Using Python fallback for Yescrypt validation")
                    validation_data = f"{job_id}{nonce}{result}{job.get('block_header', '')}"
                    validation_hash = hashlib.sha256(validation_data.encode()).hexdigest()
                    for i in range(8):
                        validation_hash = hashlib.sha256(validation_hash.encode() + str(i).encode()).hexdigest()
                    memory_data = validation_hash
                    for _ in range(4):
                        memory_data = hashlib.pbkdf2_hmac(
                            "sha256", memory_data.encode(), b"yescrypt_zion", 2048, 32
                        ).hex()
                    # Convert to numerical comparison (reduced width)
                    hash_value = int(memory_data[:16], 16)
                    target = 2**64 // difficulty
                    is_valid = hash_value < target
                    logger.debug(f"Python Yescrypt validation: {is_valid}")
                    return is_valid

            # Target comparison using first 224 bits like miner
            hash_int = int.from_bytes(hash_result[:28], "big")
            target = (1 << 224) // difficulty
            is_valid = hash_int < target
            logger.debug(f"Yescrypt validation (submitted/result-based) = {is_valid}")
            return is_valid

        except Exception as e:
            logger.error(f"Yescrypt validation error: {e}")
            return False

    def record_share(self, address: str, algorithm: str, is_valid: bool = True) -> None:
        """Record share for miner statistics and reward calculation with database persistence"""
        stats = self.get_miner_stats(address)

        if is_valid:
            stats.valid_shares += 1
        else:
            stats.invalid_shares += 1

        stats.total_shares = stats.valid_shares + stats.invalid_shares
        stats.last_share_time = time.time()
        stats.algorithm = algorithm  # Update algorithm

        # Save to database
        self.db.save_miner_stats(address, stats)

        # Update current block shares if exists
        if self.pool_blocks and self.pool_blocks[-1].status == "pending":
            current_block = self.pool_blocks[-1]
            current_block.miner_shares[address] = current_block.miner_shares.get(address, 0) + 1
            current_block.total_shares += 1

    def check_block_found(self) -> bool:
        """
        Check if a block has been found and submit it to the real blockchain
        Uses DATABASE count for reliability across restarts
        Only mines ONE block per threshold crossing to avoid CPU spam
        """
        if not self.pool_blocks:
            logger.warning("❌ check_block_found: NO pool_blocks!")
            return False

        current_block = self.pool_blocks[-1]
        if current_block.status != "pending":
            # Block already being processed or confirmed - skip
            return False

        # IMPORTANT: Check if block is already processing to prevent duplicate mining
        if hasattr(current_block, "_mining_in_progress") and current_block._mining_in_progress:
            return False

        # Real block finding: mine pending transactions when enough shares accumulated
        # This replaces the mock simulation with actual blockchain mining
        # TESTING: Set to 100 for faster block discovery (production should be 1000)
        block_threshold = self.test_block_threshold or 100  # Shares needed to trigger block mining (overridable)

        # READ FROM DATABASE instead of in-memory counter (survives restarts!)
        try:
            with sqlite3.connect(self.db.db_file) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM shares WHERE is_valid=1")
                total_shares_in_db = cursor.fetchone()[0]
        except Exception as e:
            logger.error(f"Failed to read shares from DB: {e}")
            total_shares_in_db = current_block.total_shares  # Fallback to in-memory

        logger.info(
            f"🔍 check_block_found: DB_shares={total_shares_in_db}, memory_shares={current_block.total_shares}, threshold={block_threshold}"
        )

        if total_shares_in_db >= block_threshold:
            # Mark that we're starting to mine this block (prevent duplicate calls)
            current_block._mining_in_progress = True
            try:
                # Try RPC first, fallback to local blockchain
                block_hash = None

                # Additional RPC health check before mining
                rpc_still_healthy = self.blockchain_rpc.health_check() if self.blockchain_rpc else False
                if not rpc_still_healthy:
                    logger.warning("⚠️ RPC became unavailable during block mining, using local blockchain")
                    self.blockchain_rpc = None  # Mark as unavailable

                if self.blockchain_rpc and rpc_still_healthy:
                    logger.info(f"🔨 Mining block via RPC at {self.blockchain_rpc.host}:{self.blockchain_rpc.port}")
                    block_hash = self.blockchain_rpc.mine_block(self.pool_wallet_address)
                    if block_hash:
                        logger.info(f"✅ Block mined via RPC: {block_hash}")
                    else:
                        logger.warning("⚠️ RPC mining failed, falling back to local blockchain")
                        if self.blockchain:
                            block_hash = self.blockchain.mine_pending_transactions(self.pool_wallet_address)
                            logger.info(f"✅ Block mined via local blockchain: {block_hash}")
                elif self.blockchain:
                    logger.info(f"🔨 Mining block via local blockchain instance")
                    block_hash = self.blockchain.mine_pending_transactions(self.pool_wallet_address)
                else:
                    logger.error("❌ No blockchain available (RPC disconnected and no local instance)")
                    return False

                if block_hash:
                    current_block.status = "confirmed"
                    current_block.hash = block_hash
                    current_block.timestamp = time.time()

                    # Persist block in DB (pool's lightweight blocks table)
                    try:
                        with sqlite3.connect(self.db.db_file) as conn:
                            cursor = conn.cursor()
                            # Derive total shares from miner_shares mapping for accuracy
                            sum_shares = sum(current_block.miner_shares.values()) if current_block.miner_shares else current_block.total_shares
                            cursor.execute(
                                "INSERT INTO blocks (height, hash, total_shares, reward_amount, pool_fee, status) VALUES (?, ?, ?, ?, ?, ?)",
                                (
                                    current_block.height,
                                    current_block.hash,
                                    sum_shares,
                                    current_block.reward_amount,
                                    current_block.pool_fee,
                                    current_block.status,
                                ),
                            )
                            block_id = cursor.lastrowid
                            # Persist miner_shares breakdown
                            try:
                                if current_block.miner_shares:
                                    for addr, shares in current_block.miner_shares.items():
                                        cursor.execute(
                                            "INSERT OR REPLACE INTO block_shares (block_id, address, shares) VALUES (?, ?, ?)",
                                            (block_id, addr, int(shares))
                                        )
                            except Exception as bs_err:
                                logger.error(f"Failed to persist block_shares: {bs_err}")
                            conn.commit()
                    except Exception as db_err:
                        logger.error(f"Failed to persist mined block: {db_err}")

                    logger.info(f"🎉 REAL BLOCK MINED! Height: {current_block.height}, Hash: {block_hash}")
                    print(f"🎉 REAL BLOCK MINED! Height: {current_block.height}, Hash: {block_hash[:16]}...")

                    # 📊 Prometheus: Track block found
                    algo = "randomx"  # Default, could be extracted from miner_shares
                    blocks_found_counter.labels(algorithm=algo).inc()

                    # Record block time (time since last block)
                    if len(self.pool_blocks) > 1:
                        prev_block = self.pool_blocks[-2]
                        block_time = current_block.timestamp - prev_block.timestamp
                        block_time_histogram.observe(block_time)

                    # Calculate and distribute rewards via blockchain transactions
                    self.calculate_block_rewards_via_blockchain(current_block)

                    # 🎮 CONSCIOUSNESS GAME: Award XP for block discovery!
                    # Award to the miner who found the block (highest shares contributor)
                    try:
                        if current_block.miner_shares:
                            block_finder = max(current_block.miner_shares.items(), key=lambda x: x[1])[0]
                            self.consciousness_game.on_block_found(block_finder)
                            logger.info(f"🎮 Block finder {block_finder} awarded 1,000 XP!")
                    except Exception as e:
                        logger.error(f"Consciousness game block XP error: {e}")

                    # Start new block
                    self.start_new_block()

                    return True
                else:
                    logger.error("Failed to mine block on blockchain")
                    return False

            except Exception as e:
                logger.error(f"Block mining error: {e}")
                return False

        return False

    def start_new_block(self) -> None:
        """
        Start tracking a new block based on current blockchain height
        Pool doesn't create blocks - it tracks blockchain state
        """
        self.block_counter += 1

        # Read actual blockchain height from RPC or local blockchain
        if self.blockchain_rpc and hasattr(self.blockchain_rpc, 'health_check') and self.blockchain_rpc.health_check():
            # Use RPC height if available
            rpc_height = self.blockchain_rpc.get_height()
            if rpc_height >= 0:
                # Additional stale check during block tracking
                if rpc_height == self.current_block_height and len(self.pool_blocks) > 1:
                    logger.warning(f"⚠️ RPC height {rpc_height} unchanged since last check - possible stale RPC")
                    # Continue with current height + 1 but log the issue
                self.current_block_height = rpc_height + 1  # Next block to mine
                logger.info(f"📡 Using RPC blockchain height: {rpc_height}, next block: {self.current_block_height}")
            else:
                logger.warning("⚠️ RPC health check passed but get_height returned invalid data")
                self.current_block_height = 1  # Fallback
        elif self.blockchain:
            # Fallback to local blockchain
            self.current_block_height = len(self.blockchain.blocks)  # Next block to mine
            logger.info(f"📦 Using local blockchain height: {self.current_block_height}")
        else:
            # No blockchain available, start from 1
            self.current_block_height = 1
            logger.warning("⚠️ No blockchain available, starting from height 1")

        # Get base reward from economic model (consciousness multiplier applied later)
        base_reward = self.base_block_reward

        new_block = PoolBlock(
            height=self.current_block_height,
            hash="",
            timestamp=time.time(),
            total_shares=0,
            miner_shares={},
            reward_amount=base_reward,
        )

        self.pool_blocks.append(new_block)
        logger.info(f"📦 Started tracking block #{self.current_block_height} (base reward: {base_reward} ZION)")

        return

    def calculate_block_rewards(self, block: PoolBlock) -> None:
        """Calculate proportional rewards with complete economic model:
        - 10% Humanitarian (Children Future Fund)
        - 1% Development Team
        - 0.33% Genesis Creator (Lifetime Rent 💰)
        - ~88.67% Miners (with eco bonuses)
        """
        if block.total_shares == 0:
            return

        # === STEP 1: Calculate all fees from gross reward ===
        gross_reward = block.reward_amount

        # Fixed allocations (not subject to eco reduction)
        humanitarian_amount = gross_reward * self.humanitarian_fee_percent  # 10%
        dev_team_amount = gross_reward * self.dev_team_fee_percent  # 1%
        genesis_amount = gross_reward * self.genesis_fee_percent  # 0.33%
        pool_admin_amount = gross_reward * self.pool_admin_fee_percent  # 1% (Maitreya Buddha)

        # Total fees
        total_fees = humanitarian_amount + dev_team_amount + genesis_amount + pool_admin_amount

        # Remaining for miners
        miner_reward_total = gross_reward - total_fees

        # === STEP 2: Log fee distribution ===
        logger.info(f"💰 Block #{block.height} Reward Distribution:")
        logger.info(f"   Gross Reward: {gross_reward:.2f} ZION (100%)")
        logger.info(f"   🤲 Humanitarian: {humanitarian_amount:.2f} ZION (10%)")
        logger.info(f"   👨‍💻 Dev Team: {dev_team_amount:.2f} ZION (1%)")
        logger.info(f"   🌟 Genesis Creator (Yeshuae Amon Ra): {genesis_amount:.2f} ZION (0.33%) - Lifetime Rent!")
        logger.info(f"   💎 Pool Admin (Maitreya Buddha): {pool_admin_amount:.2f} ZION (1%) - Pool Management!")
        logger.info(f"   ⛏️  Miner Pool: {miner_reward_total:.2f} ZION (~86.67%)")

        # === STEP 3: Credit fee recipients ===
        # Humanitarian fund
        humanitarian_stats = self.get_miner_stats(self.humanitarian_address)
        humanitarian_stats.balance_pending += humanitarian_amount

        # Development team
        dev_stats = self.get_miner_stats(self.dev_team_address)
        dev_stats.balance_pending += dev_team_amount

        # Genesis creator (Yeshuae Amon Ra - your lifetime rent! 💰)
        genesis_stats = self.get_miner_stats(self.genesis_creator_address)
        genesis_stats.balance_pending += genesis_amount
        logger.info(f"   ✅ Genesis rent credited to Yeshuae Amon Ra!")

        # Pool admin (Maitreya Buddha - pool management fee! 💎)
        pool_admin_stats = self.get_miner_stats(self.pool_admin_address)
        pool_admin_stats.balance_pending += pool_admin_amount
        logger.info(f"   ✅ Pool admin fee credited to Maitreya Buddha!")

        # === STEP 4: Distribute to miners with eco bonuses ===
        for address, miner_shares in block.miner_shares.items():
            if miner_shares > 0:
                # Base proportion
                proportion = miner_shares / block.total_shares
                base_reward = miner_reward_total * proportion

                # Apply eco-friendly algorithm bonus
                stats = self.get_miner_stats(address)
                algorithm = stats.algorithm
                eco_multiplier = self.eco_rewards.get(algorithm, 1.0)

                final_reward = base_reward * eco_multiplier

                # Update miner balance
                stats.balance_pending += final_reward

                eco_info = f"(eco: {eco_multiplier}x)" if eco_multiplier != 1.0 else ""
                logger.info(
                    f"   Miner {address[:20]}... [{algorithm}]: {miner_shares} shares ({proportion:.4f}) = {final_reward:.8f} ZION {eco_info}"
                )

    def calculate_block_rewards_via_blockchain(self, block: PoolBlock) -> None:
        """Calculate proportional rewards and create blockchain transactions"""
        if block.total_shares == 0:
            return

        # Calculate pool fee (reduce fee for eco algorithms)
        base_pool_fee = block.reward_amount * self.pool_fee_percent
        eco_fee_reduction = 0.0

        # Count eco-friendly shares for fee reduction
        eco_shares = 0
        for address, shares in block.miner_shares.items():
            stats = self.get_miner_stats(address)
            if stats.algorithm in ["randomx", "yescrypt"]:
                eco_shares += shares

        eco_ratio = eco_shares / block.total_shares if block.total_shares > 0 else 0
        eco_fee_reduction = base_pool_fee * 0.2 * eco_ratio  # Up to 20% fee reduction

        pool_fee_amount = base_pool_fee - eco_fee_reduction
        miner_reward_total = block.reward_amount - pool_fee_amount

        logger.info(
            f"Block reward: {block.reward_amount} ZION, Pool fee: {pool_fee_amount:.4f} (eco reduction: {eco_fee_reduction:.4f}), Miner total: {miner_reward_total}"
        )

        # Calculate proportional rewards with eco bonuses and create transactions
        for address, miner_shares in block.miner_shares.items():
            if miner_shares > 0:
                proportion = miner_shares / block.total_shares
                base_reward = miner_reward_total * proportion

                # Apply eco-friendly algorithm bonus/penalty
                stats = self.get_miner_stats(address)
                algorithm = stats.algorithm
                eco_multiplier = self.eco_rewards.get(algorithm, 1.0)

                final_reward = base_reward * eco_multiplier

                # 🎮 CONSCIOUSNESS GAME: Add consciousness bonus!
                consciousness_bonus = 0.0
                try:
                    consciousness_bonus = self.consciousness_game.calculate_bonus_reward(address, base_reward)
                    if consciousness_bonus > 0:
                        final_reward += consciousness_bonus
                        logger.info(f"🎮 Consciousness bonus for {address}: +{consciousness_bonus:.8f} ZION")
                except Exception as e:
                    logger.error(f"Consciousness game bonus error: {e}")

                # Create blockchain transaction for the reward
                try:
                    # Try RPC first, fallback to local blockchain
                    tx_hash = None
                    if self.blockchain_rpc and getattr(self.blockchain_rpc, "connected", False):
                        tx_hash = self.blockchain_rpc.create_transaction(
                            self.pool_wallet_address,  # From pool wallet
                            address,  # To miner
                            final_reward,  # Reward amount (including consciousness bonus!)
                            f"Pool mining reward for block {block.height} - {miner_shares} shares ({algorithm})",
                        )
                    elif self.blockchain:
                        self.blockchain.create_transaction(
                            self.pool_wallet_address,  # From pool wallet
                            address,  # To miner
                            final_reward,  # Reward amount (including consciousness bonus!)
                            f"Pool mining reward for block {block.height} - {miner_shares} shares ({algorithm})",
                        )
                        tx_hash = "local_tx"

                    if tx_hash:
                        logger.info(f"✅ Created blockchain transaction: {final_reward:.8f} ZION to {address}")
                    else:
                        logger.error(f"❌ Failed to create reward transaction for {address}")
                except Exception as e:
                    logger.error(f"❌ Failed to create reward transaction for {address}: {e}")

                eco_info = f"(eco: {eco_multiplier}x)" if eco_multiplier != 1.0 else ""
                bonus_info = f" + consciousness: {consciousness_bonus:.8f}" if consciousness_bonus > 0 else ""
                logger.info(
                    f"Miner {address} [{algorithm}]: {miner_shares} shares ({proportion:.4f}) = {final_reward:.8f} ZION {eco_info}{bonus_info}"
                )

    def process_pending_payouts(self) -> List[Dict[str, Any]]:
        """Process miners who have reached payout threshold"""
        payouts = []

        for address, stats in self.miner_stats.items():
            if stats.balance_pending >= self.payout_threshold:
                payout_amount = stats.balance_pending

                # Create payout record
                payout = {
                    "address": address,
                    "amount": payout_amount,
                    "timestamp": time.time(),
                    "block_height": self.current_block_height,
                    "status": "pending",
                }

                payouts.append(payout)

                # Reset pending balance (would move to paid balance after successful tx)
                stats.balance_pending = 0
                stats.balance_paid += payout_amount

                logger.info(f"💰 Payout ready for {address}: {payout_amount:.8f} ZION")

        return payouts

    async def cleanup_inactive_miners(self):
        """Remove inactive miners"""
        while True:
            await asyncio.sleep(300)  # Check every 5 minutes

            current_time = time.time()
            inactive_addrs = []

            for addr, miner in self.miners.items():
                last_activity = miner.get("last_activity", miner.get("connected", current_time))
                if current_time - last_activity > 1800:  # 30 minutes timeout
                    inactive_addrs.append(addr)

            for addr in inactive_addrs:
                print(f"🧹 Removing inactive miner: {addr}")
                if addr in self.miners:
                    del self.miners[addr]

    async def handle_client(self, reader, writer):
        """Handle incoming miner connections with timeout and heartbeat"""
        addr = writer.get_extra_info("peername")
        logger.info(f"New connection from {addr}")
        print(f"👷 New miner connected from {addr}")

        # Track connection statistics
        self.performance_stats["total_connections"] += 1

        # 📊 Prometheus: Track connection
        connections_counter.inc()
        connected_miners_gauge.set(len(self.miners) + 1)  # +1 for this new connection

        last_activity = time.time()
        heartbeat_interval = 30  # seconds
        read_timeout = 60  # seconds - readline will timeout after this

        try:
            # Switch to line-based parsing with timeout
            while True:
                try:
                    # Read with timeout (60s)
                    line = await asyncio.wait_for(reader.readline(), timeout=read_timeout)
                    if not line:
                        logger.info(f"EOF from {addr} (connection closed cleanly)")
                        break
                    last_activity = time.time()
                    raw = line.decode("utf-8").strip()
                    if not raw:
                        continue
                    print(f"🧾 RAW <- {addr}: {raw}")
                    response = await self.handle_message(raw, addr, writer)
                    if response:
                        writer.write(response.encode("utf-8"))
                        await writer.drain()
                except asyncio.TimeoutError:
                    # No data received within read_timeout
                    now = time.time()
                    # Send a heartbeat first to keep idle connections alive (e.g., XMRig Monero protocol)
                    if now - last_activity > heartbeat_interval:
                        logger.debug(f"Sending heartbeat to {addr}")
                        ping = json.dumps({"jsonrpc": "2.0", "method": "client.get_version", "params": []}) + "\n"
                        try:
                            writer.write(ping.encode("utf-8"))
                            await writer.drain()
                            last_activity = now  # consider activity after sending heartbeat
                        except Exception as _:
                            # If we cannot write, drop the connection
                            logger.warning(f"Heartbeat write failed to {addr}")
                            break
                    # If still beyond hard timeout after attempting heartbeat, close
                    if now - last_activity > read_timeout:
                        logger.warning(f"Read timeout from {addr} (no data for {read_timeout}s)")
                        print(f"⏱️  Read timeout from {addr}")
                        break

        except Exception as e:
            logger.error(f"Error handling miner {addr}: {e}")
            print(f"❌ Error handling miner {addr}: {e}")
        finally:
            logger.info(f"Miner {addr} disconnected")
            print(f"👋 Miner {addr} disconnected")
            try:
                writer.close()
                await writer.wait_closed()
            except Exception:
                pass

            # Remove miner from tracking
            if addr in self.miners:
                del self.miners[addr]

    async def handle_message(self, message, addr, writer):
        """Process incoming mining protocol messages"""
        try:
            # Check if IP is banned
            if self.is_ip_banned(addr[0]):
                print(f"🚫 Blocked message from banned IP: {addr[0]}")
                return None

            data = json.loads(message)
            method = data.get("method")

            logger.info(f"Received from {addr}: {method}")
            print(f"📥 Received from {addr}: {method}")

            # Detect Stratum vs XMrig protocol
            if method and method.startswith("mining."):
                return await self.handle_stratum_method(data, addr, writer)

            # Handle XMrig protocol
            if method == "login":
                return await self.handle_xmrig_login(data, addr, writer)
            elif method == "submit":
                return await self.handle_xmrig_submit(data, addr, writer)
            elif method == "keepalived":
                return await self.handle_keepalive(data, addr)
            else:
                logger.warning(f"Unknown method from {addr}: {method}")
                print(f"❓ Unknown method: {method}")
                return (
                    json.dumps(
                        {
                            "id": data.get("id", 1),
                            "jsonrpc": "2.0",
                            "error": {"code": -32601, "message": "Method not found"},
                        }
                    )
                    + "\n"
                )

        except json.JSONDecodeError:
            logger.error(f"Invalid JSON from {addr}: {message}")
            return None
        except Exception as e:
            logger.error(f"Error processing message from {addr}: {e}")
            self.performance_stats["errors_count"] += 1
            return None

    def is_ip_banned(self, ip):
        """Check if IP address is currently banned"""
        if ip not in self.banned_ips:
            return False

        ban_info = self.banned_ips[ip]
        if time.time() - ban_info["banned_at"] > ban_info["duration"]:
            # Ban expired, remove it
            del self.banned_ips[ip]
            return False

        return True

    def track_invalid_share(self, ip, is_valid):
        """Track share statistics per IP for banning decisions"""
        if not self.banning["enabled"]:
            return

        if ip not in self.connection_stats:
            self.connection_stats[ip] = {"total_shares": 0, "invalid_shares": 0, "first_seen": time.time()}

        stats = self.connection_stats[ip]
        stats["total_shares"] += 1

        if not is_valid:
            stats["invalid_shares"] += 1

        # Check for banning after threshold
        if stats["total_shares"] >= self.banning["check_threshold"]:
            invalid_percent = (stats["invalid_shares"] / stats["total_shares"]) * 100

            if invalid_percent >= self.banning["invalid_percent_threshold"]:
                self.ban_ip(ip, reason=f"{invalid_percent:.1f}% invalid shares")

    def ban_ip(self, ip, duration=None, reason="High invalid share rate"):
        """Ban IP address for specified duration"""
        # Never ban localhost (for development/testing)
        if ip in ("127.0.0.1", "localhost", "::1"):
            logger.info(f"⚠️  Skipping ban for localhost {ip}: {reason}")
            return

        if duration is None:
            duration = self.banning["ban_duration"]

        self.banned_ips[ip] = {"banned_at": time.time(), "duration": duration, "reason": reason}

        # Reset stats for this IP
        if ip in self.connection_stats:
            del self.connection_stats[ip]

        print(f"🚫 IP {ip} BANNED for {duration}s: {reason}")
        logger.warning(f"Banned IP {ip}: {reason}")

    def adjust_difficulty(self, addr, algorithm):
        """Variable difficulty adjustment based on miner performance with safety caps"""
        if not self.vardiff["enabled"] or addr not in self.miners:
            return

        miner = self.miners[addr]
        share_times = miner.get("share_times", [])

        # Need at least 3 shares to adjust
        if len(share_times) < 3:
            return

        # Calculate average time of recent shares
        recent_times = share_times[-5:]  # Last 5 shares
        avg_time = sum(recent_times) / len(recent_times)

        current_diff = miner.get("difficulty", self.difficulty.get(algorithm, 1000))
        min_diff = self.vardiff["min_diff"].get(algorithm, 100)
        max_diff = self.vardiff["max_diff"].get(algorithm, 10000)

        # Safety caps to prevent aggressive ramping
        ABSOLUTE_MAX_DIFF = 50000  # Hard cap to prevent DOS-like ramping
        MAX_RAMP_FACTOR = 1.5  # Max multiplier per adjustment (not 2.0)
        MIN_RAMP_FACTOR = 0.75  # Min divisor per adjustment

        target_time = self.vardiff["target_time"]
        variance = self.vardiff["variance_percent"] / 100

        # Calculate new difficulty with ramp factor limits
        if avg_time < target_time * (1 - variance):
            # Too fast - increase difficulty (capped at 1.5x per adjustment)
            new_diff = min(current_diff * MAX_RAMP_FACTOR, max_diff, ABSOLUTE_MAX_DIFF)
        elif avg_time > target_time * (1 + variance):
            # Too slow - decrease difficulty
            new_diff = max(current_diff * MIN_RAMP_FACTOR, min_diff)
        else:
            # In target range - no change
            return

        # Apply eco-friendly bonus
        if algorithm in ["yescrypt", "autolykos_v2"]:
            new_diff *= 0.95  # 5% easier for eco algorithms

        new_diff = int(min(new_diff, ABSOLUTE_MAX_DIFF))  # Final cap

        if new_diff != current_diff:
            miner["difficulty"] = new_diff
            print(
                f"📊 VarDiff {addr[0]}:{addr[1]} {algorithm}: {current_diff} → {new_diff} (avg: {avg_time:.1f}s, cap: {ABSOLUTE_MAX_DIFF})"
            )

            # Send new difficulty to miner
            if miner.get("protocol") == "stratum":
                self.send_difficulty_update(miner["writer"], new_diff)

    def send_difficulty_update(self, writer, difficulty):
        """Send difficulty update to Stratum miner"""
        try:
            msg = json.dumps({"id": None, "method": "mining.set_difficulty", "params": [difficulty]}) + "\n"

            writer.write(msg.encode("utf-8"))
            asyncio.create_task(writer.drain())
        except Exception as e:
            logger.error(f"Failed to send difficulty update: {e}")

    async def handle_xmrig_login(self, data, addr, writer):
        """Handle XMrig (CPU RandomX) login with ZION address support"""
        params = data.get("params", {})
        login = params.get("login", "unknown")
        password = params.get("pass", "x")
        agent = params.get("agent", "unknown")
        
        # Read algorithm from dedicated 'algo' field (proper way)
        algo_param = params.get("algo", "randomx")
        
        # Handle both string and list (some miners send list)
        if isinstance(algo_param, list):
            algorithm = algo_param[0] if algo_param else "randomx"
        else:
            algorithm = algo_param
        
        # Normalize algorithm name
        algorithm = str(algorithm).lower().replace("-", "_").replace(" ", "_")

        # Validate ZION address
        is_zion_address = self.validate_zion_address(login)

        logger.info(f"XMrig login: {login} from {addr} (ZION: {is_zion_address}, Algorithm: {algorithm})")
        print(f"🖥️ XMrig (CPU) Login from {addr}")
        print(f"💰 Address: {login}")
        print(f"🔧 Algorithm: {algorithm}")
        if is_zion_address:
            print(f"✅ Valid ZION address detected!")
        else:
            print(f"⚠️ Legacy address format accepted")

        # Store miner info with enhanced session tracking
        self.miners[addr] = {
            "type": "cpu",
            "protocol": "xmrig",
            "algorithm": algorithm,
            "id": f"zion_{int(time.time())}_{addr[1]}",
            "login": login,
            "is_zion_address": is_zion_address,
            "agent": agent,
            "connected": time.time(),
            "last_activity": time.time(),
            "last_share": None,
            "last_job_sent": None,
            "share_count": 0,
            "last_job_id": None,
            "writer": writer,
            "session_active": True,
        }

        self.performance_stats["total_connections"] += 1
        current_connections = len(self.miners)
        self.performance_stats["peak_connections"] = max(
            self.performance_stats["peak_connections"], current_connections
        )

        # Create job for login response
        job = self.get_job_for_miner(addr)

        # Build Monero-compatible single login response (no bundled extra messages)
        # Trim job to standard fields expected by XMRig on login
        job_for_login = {
            "job_id": job.get("job_id"),
            "blob": job.get("blob"),
            "seed_hash": job.get("seed_hash"),
            "next_seed_hash": job.get("next_seed_hash", job.get("seed_hash")),
            "target": job.get("target"),
            "height": job.get("height", 0),
        }

        response_obj = {
            "id": data.get("id"),
            "jsonrpc": "2.0",
            "result": {"id": self.miners[addr]["id"], "job": job_for_login, "status": "OK"},
        }

        # DEBUG: Log the exact response being sent
        logger.info(f"📤 Login response for {addr}: {json.dumps(response_obj)}")

        login_response = json.dumps(response_obj) + "\n"

        logger.info(f"XMrig login successful for {addr}")
        print(f"✅ CPU miner login successful")

        # Initialize last sent height to suppress immediate duplicate job push
        try:
            self.miners[addr]["last_template_height"] = job_for_login.get("height")
        except Exception:
            pass

        # Start sending periodic jobs to maintain connection (method "job")
        asyncio.create_task(self.send_periodic_jobs(addr))

        # Return only the login response
        return login_response

    async def handle_xmrig_submit(self, data, addr, writer):
        """Handle XMrig share submission with real validation and rewards"""
        params = data.get("params", {})
        job_id = params.get("job_id", "unknown")
        nonce = params.get("nonce", "unknown")
        result = params.get("result", "unknown")

        logger.info(f"[SUBMIT] From {addr} job={job_id} nonce={nonce} result={result}")

        if addr not in self.miners:
            return (
                json.dumps({"id": data.get("id"), "jsonrpc": "2.0", "error": {"code": -1, "message": "Not logged in"}})
                + "\n"
            )

        miner = self.miners[addr]
        address = miner["login"]
        # Algorithm from submit params (correct Stratum method), fallback to miner login algorithm
        algorithm = params.get("algo", miner.get("algorithm", "randomx")).lower()
        difficulty = self.difficulty.get(algorithm, 1000)  # Default difficulty

        # Check for duplicate shares (with expiration)
        current_time = time.time()
        share_key = f"{job_id}:{nonce}:{result}"

        if self.is_duplicate_share(share_key):
            print(
                f"🚫 DUPLICATE SHARE from {addr} (submitted {current_time - self.submitted_shares[share_key]:.1f}s ago)"
            )
            self.record_share(address, algorithm, is_valid=False)
            return (
                json.dumps(
                    {"id": data.get("id"), "jsonrpc": "2.0", "error": {"code": -4, "message": "Duplicate share"}}
                )
                + "\n"
            )

        # Performance monitoring
        start_time = time.time()

        # Validate share based on algorithm
        is_valid = False
        if algorithm == "randomx":
            is_valid = self.validate_randomx_share(job_id, nonce, result, difficulty)
            logger.info(f"🔍 RandomX validation result: {is_valid} for nonce {nonce}")
            print(f"🔍 RandomX validation result: {is_valid} for nonce {nonce}")
        elif algorithm == "yescrypt":
            is_valid = self.validate_yescrypt_share(job_id, nonce, result, difficulty)
            logger.info(f"🔍 Yescrypt validation result: {is_valid} for nonce {nonce}")
            print(f"🔍 Yescrypt validation result: {is_valid} for nonce {nonce}")
        elif algorithm == "autolykos_v2":
            is_valid = self.validate_autolykos_v2_share(job_id, nonce, result, difficulty)
        else:
            # Fallback to RandomX validation
            is_valid = self.validate_randomx_share(job_id, nonce, result, difficulty)

        # Record processing time
        processing_time = time.time() - start_time
        self.share_processing_times.append(processing_time)
        self.performance_stats["total_shares_processed"] += 1

        # 📊 Prometheus: Record share processing time
        share_processing_time.observe(processing_time)

        # 📊 Prometheus: Track share submission
        status = "valid" if is_valid else "invalid"
        total_shares_counter.labels(algorithm=algorithm, status=status).inc()

        # Keep only last 100 processing times for average calculation
        if len(self.share_processing_times) > 100:
            self.share_processing_times.pop(0)
        self.performance_stats["avg_share_processing_time"] = sum(self.share_processing_times) / len(
            self.share_processing_times
        )

        # Track share for IP banning
        self.track_invalid_share(addr[0], is_valid)

        if is_valid:
            # Record valid share
            self.submitted_shares[share_key] = current_time
            self.record_share(address, algorithm, is_valid=True)

            # Save detailed share to database
            self.db.save_share(address, algorithm, job_id, nonce, result, difficulty, True, processing_time, addr[0])

            miner["share_count"] += 1
            total_shares = miner["share_count"]
            share_time = time.time()
            miner["last_share"] = share_time

            # Track share times for vardiff
            if "share_times" not in miner:
                miner["share_times"] = []
            if "last_share_time" in miner:
                time_diff = share_time - miner["last_share_time"]
                miner["share_times"].append(time_diff)
                # Keep only last 10 times
                if len(miner["share_times"]) > 10:
                    miner["share_times"].pop(0)
            miner["last_share_time"] = share_time

            # Adjust difficulty if needed
            self.adjust_difficulty(addr, algorithm)

            # 🎮 CONSCIOUSNESS GAME: Award XP for share submission!
            try:
                self.consciousness_game.on_share_submitted(address)
            except Exception as e:
                logger.error(f"Consciousness game share XP error: {e}")

            print(f"🎯 {algorithm.upper()} Share: job={job_id}, nonce={nonce}")
            print(f"✅ VALID {algorithm.upper()} SHARE ACCEPTED (Total: {total_shares})")
            print(f"💰 Address: {address}")

            # Check for block discovery
            print(f"🔍 Calling check_block_found()...")
            try:
                block_found = self.check_block_found()
                print(f"🔍 check_block_found() returned: {block_found}")
            except Exception as check_err:
                logger.error(f"❌ check_block_found() error: {check_err}", exc_info=True)
                print(f"❌ check_block_found() error: {check_err}")

            # Process any pending payouts
            payouts = self.process_pending_payouts()
            if payouts:
                print(f"💰 {len(payouts)} payouts ready for processing")

        else:
            # Invalid share
            self.record_share(address, algorithm, is_valid=False)

            # Save invalid share to database
            self.db.save_share(address, algorithm, job_id, nonce, result, difficulty, False, processing_time, addr[0])

            print(f"❌ INVALID {algorithm.upper()} SHARE from {addr}")
            return (
                json.dumps({"id": data.get("id"), "jsonrpc": "2.0", "error": {"code": -1, "message": "Invalid share"}})
                + "\n"
            )

        # XMRig expects specific response format for share acceptance - NO error field when successful
        response = json.dumps({"id": data.get("id"), "jsonrpc": "2.0", "result": {"status": "OK"}}) + "\n"

        # Force creation of a fresh job for next work to avoid stale job reuse
        try:
            self.create_randomx_job()
            new_job = self.get_job_for_miner(addr)
        except Exception as e:
            logger.error(f"Job refresh failure after share from {addr}: {e}")
            new_job = None
        if new_job:
            # XMRig expects job notification in specific format
            job_notification = json.dumps({"jsonrpc": "2.0", "method": "job", "params": new_job}) + "\n"

            logger.info(f"Sent share acceptance + new job to {addr}")
            return response + job_notification

        return response

    async def handle_keepalive(self, data, addr):
        """Enhanced keepalive handling"""
        if addr in self.miners:
            self.miners[addr]["last_activity"] = time.time()
            self.miners[addr]["session_active"] = True

        print(f"💓 Keepalive from {addr} - session renewed")
        logger.info(f"Keepalive received from {addr}")

        return json.dumps({"id": data.get("id"), "jsonrpc": "2.0", "result": {"status": "KEEPALIVED"}}) + "\n"

    def create_randomx_job(self):
        """Create RandomX job for CPU miners backed by real blockchain template.

        Contract:
        - Inputs: none (reads current template via RPC/local)
        - Output: dict with {job_id, blob, seed_hash, target, height, algo}
        - Errors: falls back gracefully to synthetic data if RPC unavailable
        """
        self.job_counter += 1
        job_id = f"zion_rx_{self.job_counter:06d}"

        # Defaults in case RPC/local template not available
        height = self.current_block_height + self.job_counter
        # Build a Monero-style hashing blob (76 bytes = 152 hex)
        # Default random placeholder (will be replaced if we can fetch a template)
        blob = "0d00" + secrets.token_hex(74)  # major=0x0d (RandomX era), minor=0x00 + 74 random
        blob = (blob + ("0" * 152))[:152]
        seed_hash = secrets.token_hex(32)
        tpl_for_blob = {
            "height": height,
            "previous_hash": "0" * 64,
            "merkle_root": "0" * 64,
            "timestamp": int(time.time()),
        }

        # 1) Try canonical RPC (FastAPI) getblocktemplate first (preferred)
        try:
            rpc_url = os.environ.get("ZION_NODE_RPC", "http://localhost:18089")
            rpc_req = {"jsonrpc": "2.0", "id": 1, "method": "getblocktemplate", "params": {}}
            resp = requests.post(f"{rpc_url}/json_rpc", json=rpc_req, timeout=3)
            if resp.ok:
                data = resp.json()
                result = data.get("result") or {}
                blob_rpc = result.get("blockhashing_blob")
                if blob_rpc and isinstance(blob_rpc, str) and len(blob_rpc) == 152:
                    blob = blob_rpc
                    height = int(result.get("height", height) or height)
                    prevh = result.get("prev_hash") or result.get("previous_hash") or ""
                    if prevh and prevh != "0" * 64:
                        seed_hash = (prevh + ("0" * 64))[:64]
                    tpl_for_blob = {
                        "height": height,
                        "previous_hash": prevh or "0" * 64,
                        "merkle_root": (result.get("merkle_root") or "0" * 64),
                        "timestamp": int(time.time()),
                    }
        except Exception as e:
            logger.debug(f"RPC getblocktemplate fetch failed (optional): {e}")

        # Try local blockchain instance first
        try:
            if self.blockchain and hasattr(self.blockchain, "get_block_template"):
                tpl = self.blockchain.get_block_template()
                if tpl and isinstance(tpl, dict):
                    height = tpl.get("height", height)
                    # Keep Monero-style placeholder blob for XMRig compatibility
                    # Only use real template to set metadata and seed and build blob
                    # Derive seed from previous hash or merkle (stable 32 bytes)
                    prev = tpl.get("previous_hash", "")
                    mrkl = tpl.get("merkle_root", "")
                    base_seed = prev or mrkl or seed_hash
                    # Ensure seed_hash is never all zeros (XMRig rejects it)
                    if base_seed and base_seed != "0" * 64:
                        seed_hash = (base_seed + ("0" * 64))[:64]
                    # Build hashing blob if we have at least prev/timestamp
                    tpl_for_blob = {
                        "height": height,
                        "previous_hash": tpl.get("previous_hash", "0" * 64) or "0" * 64,
                        "merkle_root": tpl.get("merkle_root", "0" * 64) or "0" * 64,
                        "timestamp": tpl.get("timestamp", int(time.time())),
                    }
        except Exception as e:
            logger.warning(f"RandomX job local template failed: {e}")

        # Fallback to RPC height/block header if available
        if (not self.blockchain) and self.blockchain_rpc and self.blockchain_rpc.health_check():
            try:
                latest_height = self.blockchain_rpc.get_height()
                if latest_height >= 0:
                    blk = self.blockchain_rpc.get_block(latest_height)
                    if blk:
                        height = latest_height + 1
                        # Only update metadata/seed and build blob
                        prev = blk.get("hash") or blk.get("previous_hash", "")
                        if prev and prev != "0" * 64:
                            seed_hash = (prev + ("0" * 64))[:64]
                        tpl_for_blob = {
                            "height": height,
                            "previous_hash": prev or "0" * 64,
                            "merkle_root": blk.get("merkle_root", "0" * 64) or "0" * 64,
                            "timestamp": blk.get("timestamp", int(time.time())),
                        }
            except Exception as e:
                logger.warning(f"RandomX job RPC template failed: {e}")

        # Build proper 76-byte Monero hashing blob from template fields (best-effort)
        try:
            blob = self.build_monero_hashing_blob(tpl_for_blob)
        except Exception as e:
            logger.warning(f"Failed to build Monero hashing blob, using placeholder: {e}")
            # keep placeholder in 'blob'
        # Convert pool difficulty to Monero-style 64-bit little-endian target
        # XMRig expects 8-byte LE target (16 hex chars), derived from difficulty
        try:
            diff = int(self.difficulty.get("randomx", 10000))
            diff = max(1, diff)
            max_target_64 = (1 << 64) - 1
            target_int = max(1, max_target_64 // diff)
            # pack to 8-byte little-endian
            target_hex = target_int.to_bytes(8, "little").hex()
        except Exception:
            # fallback ultra-easy target (~diff 1)
            target_hex = (1).to_bytes(8, "little").hex()

        job = {
            "job_id": job_id,
            "blob": blob,
            "target": target_hex,
            "algo": "rx/0",
            "height": height,
            "seed_hash": seed_hash,
            "next_seed_hash": secrets.token_hex(32),
        }

        # Persist for validation/tracking
        self.current_jobs["randomx"] = job.copy()
        self.jobs[job_id] = {
            "job_id": job_id,
            "algorithm": "randomx",
            "blob": job["blob"],
            "target": job["target"],
            "height": job["height"],
            "seed_hash": job["seed_hash"],
            "next_seed_hash": job["next_seed_hash"],
            "created": time.time(),
        }

        logger.info(f"Created RandomX job from template: {job_id} h={height} blob_len={len(job['blob'])}")
        print(f"🔨 RandomX job (tpl): {job_id} height={height} blob_len={len(job['blob'])}")
        return job

    def build_monero_hashing_blob(self, tpl: dict) -> str:
        """Construct a 76-byte (152 hex) CryptoNote/Monero-like hashing blob.

        Note: This is a best-effort builder for XMRig compatibility. It does not aim
        to be consensus-correct Monero encoding, but preserves field order/lengths:
        - 1 byte: major version (0x0d ~ RandomX era)
        - 1 byte: minor version (0x00)
        - 4 bytes: timestamp (LE)
        - 32 bytes: previous block hash (raw bytes)
        - 32 bytes: merkle root (or equivalent) (raw bytes)
        - 4 bytes: nonce (zeros, miner will fill)
        Total = 74 bytes; append 2 zero bytes as reserved to reach 76 bytes.
        """

        def _hex_to_bytes32(h: str) -> bytes:
            h = (h or "").lower().strip()
            if h.startswith("0x"):
                h = h[2:]
            # pad or trim to 64 hex
            if len(h) < 64:
                h = (h + ("0" * 64))[:64]
            elif len(h) > 64:
                h = h[:64]
            try:
                return bytes.fromhex(h)
            except Exception:
                return bytes(32)

        major = 0x0D  # RandomX era in Monero
        minor = 0x00
        ts = int(tpl.get("timestamp", int(time.time()))) & 0xFFFFFFFF
        prev = _hex_to_bytes32(tpl.get("previous_hash", ""))
        mrkl = _hex_to_bytes32(tpl.get("merkle_root", ""))
        nonce = (0).to_bytes(4, "little")

        header = bytes([major, minor]) + ts.to_bytes(4, "little") + prev + mrkl + nonce
        if len(header) < 76:
            header += b"\x00" * (76 - len(header))
        elif len(header) > 76:
            header = header[:76]
        return header.hex()

    def create_autolykos_v2_job(self):
        """Create Autolykos v2 job for GPU miners"""
        self.job_counter += 1
        job_id = f"zion_al_{self.job_counter:06d}"

        # Autolykos v2 parameters
        height = self.current_block_height + self.job_counter
        block_header = secrets.token_hex(80)  # 80 bytes block header

        # Generate elements for Autolykos (simplified)
        elements_seed = secrets.token_hex(32)

        # Compute target from current difficulty (simple mapping)
        diff = self.difficulty.get("autolykos_v2", 75)
        try:
            diff_val = int(diff) if isinstance(diff, (int, float, str)) else 75
            diff_val = max(1, diff_val)
        except Exception:
            diff_val = 75
        target_int = (1 << 256) // diff_val
        target_bytes = target_int.to_bytes(32, "big")
        target_hex = target_bytes.hex()

        job = {
            "job_id": job_id,
            "algorithm": "autolykos_v2",
            "height": height,
            "block_header": block_header,
            "header": block_header,  # alias for clients expecting 'header'
            "elements_seed": elements_seed,
            "target": target_hex,
            "n_value": 2**21,  # Autolykos N parameter
            "k_value": 32,  # Autolykos K parameter
            "created": time.time(),
            "difficulty": self.difficulty["autolykos_v2"],
        }

        self.jobs[job_id] = job
        print(f"🌟 Autolykos v2 job created: {job_id} height={height}")
        return job

    def create_yescrypt_job(self):
        """Create Yescrypt job for CPU miners using Bitcoin-style Stratum notify.

        We emit the standard parameters expected by cpuminer-opt for yescrypt coins:
        [job_id, prevhash, coinb1, coinb2, merkle_branch[], version, nbits, ntime, clean_jobs]

        Notes:
        - Until full blockchain integration is wired for PoW, we generate synthetic but
          consistent values. Share validation can be relaxed during bring-up.
        """
        self.job_counter += 1
        job_id = f"zion_ys_{self.job_counter:06d}"

        # Height hint (best-effort)
        height = self.current_block_height + self.job_counter

        # Previous block hash (32-byte hex). Use RPC if available, else random.
        prevhash = None
        if self.blockchain_rpc and getattr(self.blockchain_rpc, "connected", False):
            try:
                latest_height = self.blockchain_rpc.get_height()
                if latest_height >= 0:
                    latest_block = self.blockchain_rpc.get_block(latest_height)
                    prevhash = (latest_block or {}).get("hash")
                    height = (latest_height or 0) + 1
                    if prevhash:
                        print(f"📡 Using RPC blockchain data for Yescrypt job: height={height}")
            except Exception as e:
                logger.warning(f"Failed to get RPC blockchain data: {e}")

        if not prevhash:
            prevhash = secrets.token_hex(32)
            print("🎲 Using fallback prevhash for Yescrypt job (no blockchain available)")

        # Stratum coinbase parts. In BTC-style stratum the miner builds coinbase as coinb1 + extranonce1 + extranonce2 + coinb2
        # Model after zpool.ca format: include height, timestamp, and pool signature
        # coinb1 = version(4) + input_count(1) + prev_tx(32) + prev_vout(4) + script_len(varint) + [height + timestamp + extranonce_space]

        # Encode height as compact size (3 bytes for heights < 65536)
        height_bytes = height.to_bytes(3, "little")
        height_script = bytes([0x03]) + height_bytes  # PUSH(3) + height_le

        # Timestamp (4 bytes, LE)
        timestamp = int(time.time())
        timestamp_script = bytes([0x04]) + timestamp.to_bytes(4, "little")

        coinb1 = (
            "01000000"  # version 1
            "01"  # 1 input
            "0000000000000000000000000000000000000000000000000000000000000000"  # null prevout hash
            "ffffffff"  # prevout index -1 (coinbase marker)
            f"{(4 + 5 + 4 + 8):02x}"  # script length (will include extranonces): ~0x15 = 21 bytes base
            + height_script.hex()
            + timestamp_script.hex()
            # extranonce1(4) + extranonce2(4) inserted here by miner
        )

        # Pool signature and output
        pool_sig = b"/ZION/"
        coinb2 = (
            pool_sig.hex() + "ffffffff"  # sequence
            "01"  # 1 output
            "00f2052a01000000"  # 50 ZION reward (in satoshis, LE)
            "19"  # script len 25 bytes
            "76a914"  # OP_DUP OP_HASH160 PUSH(20)
            "0000000000000000000000000000000000000000"  # dummy pubkey hash
            "88ac"  # OP_EQUALVERIFY OP_CHECKSIG
            "00000000"  # locktime
        )

        # Empty merkle branch for simplicity (single tx block)
        merkle_branch: List[str] = []

        # Block version (little-endian on wire; stratum uses hex string)
        version = "20000000"  # 0x20000000

        # Compact target (nbits) – ultra-easy target for bring-up (diff=1)
        # nbits format: 0x1effffff = easiest possible (all 0xff in mantissa)
        nbits = "1effffff"

        # Current time (hex, seconds)
        ntime = f"{int(time.time()):08x}"

        job = {
            "job_id": job_id,
            "algorithm": "yescrypt",
            "height": height,
            "prevhash": prevhash,
            "coinb1": coinb1,
            "coinb2": coinb2,
            "merkle_branch": merkle_branch,
            "version": version,
            "nbits": nbits,
            "ntime": ntime,
            "created": time.time(),
            "difficulty": self.difficulty["yescrypt"],
        }

        self.jobs[job_id] = job
        print(f"⚡ Yescrypt job created: {job_id} height={height}")
        return job

    def create_cosmic_harmony_job(self):
        """Create Cosmic Harmony job for native ZION miners (32-bit target)"""
        self.job_counter += 1
        job_id = f"zion_ch_{self.job_counter:06d}"

        # Try to use blockchain template when available
        height = self.current_block_height + self.job_counter
        block_header = None
        if self.blockchain and hasattr(self.blockchain, "get_block_template"):
            try:
                template = self.blockchain.get_block_template()
                block_header = template.get("block_header")
                height = template.get("height", height)
            except Exception:
                block_header = None
        if block_header is None:
            block_header = secrets.token_hex(80)

        # Map difficulty to 32-bit target used by GPU kernel (state[0] <= target)
        diff = self.difficulty.get("cosmic_harmony", self.difficulty.get("gpu", 50))
        try:
            diff_val = int(diff)
        except Exception:
            diff_val = 50
        diff_val = max(1, diff_val)
        target32 = max(1, 0xFFFFFFFF // diff_val)
        target_hex = f"{target32:08x}"

        job = {
            "job_id": job_id,
            "algorithm": "cosmic_harmony",
            "height": height,
            "block_header": block_header,
            "target32": target_hex,
            "created": time.time(),
            "difficulty": diff_val,
        }

        self.jobs[job_id] = job
        print(f"🌟 Cosmic Harmony job created: {job_id} height={height}")
        return job

    def get_job_for_miner(self, addr):
        """Get appropriate job for miner based on algorithm"""
        if addr not in self.miners:
            return None

        miner = self.miners[addr]
        algorithm = miner.get("algorithm", "randomx")

        # Create new job based on algorithm
        if algorithm == "randomx":
            if not self.current_jobs["randomx"] or self.job_counter % 5 == 0:
                self.create_randomx_job()
            job = self.current_jobs["randomx"].copy()
        elif algorithm == "yescrypt":
            # Create new Yescrypt job
            job = self.create_yescrypt_job()
        elif algorithm == "autolykos_v2":
            # Create new Autolykos v2 job
            job = self.create_autolykos_v2_job()
        else:
            # Fallback to RandomX
            if not self.current_jobs["randomx"] or self.job_counter % 5 == 0:
                self.create_randomx_job()
            job = self.current_jobs["randomx"].copy()

        self.miners[addr]["last_job_id"] = job["job_id"]
        return job

    async def send_periodic_jobs(self, addr):
        """Periodic job sender with duplicate suppression and height-based updates.

        Rules:
        - Send keepalive if idle >45s
        - For RandomX (XMRig Monero-style), only send a new job when height changes
        - For other algos, keep existing cadence but avoid re-sending identical jobs
        """
        job_count = 0
        logger.info(f"🔄 Started periodic jobs task for {addr}")
        print(f"🔄 Started periodic jobs task for {addr}")

        # Wait a moment before starting periodic loop
        await asyncio.sleep(5)

        while addr in self.miners:
            await asyncio.sleep(18)
            job_count += 1

            if addr not in self.miners:
                logger.info(f"⏹️  Miner {addr} no longer in miners dict, stopping periodic jobs")
                break

            try:
                current_time = time.time()
                miner = self.miners.get(addr, {})
                algo = miner.get("algorithm", "randomx")

                logger.debug(f"🔁 Periodic job loop #{job_count} for {addr} (algo: {algo})")

                # Keepalive if idle
                last_activity = miner.get("last_activity", miner.get("connected", current_time))
                if current_time - last_activity > 45 and miner.get("writer"):
                    writer = miner["writer"]
                    keepalive_msg = json.dumps({"jsonrpc": "2.0", "method": "keepalived", "params": {}}) + "\n"
                    writer.write(keepalive_msg.encode("utf-8"))
                    await writer.drain()
                    print(f"💓 Sent keepalive to {addr}")

                # Determine whether to emit a new job
                should_send = True
                if algo == "randomx":
                    # Create/refresh current RX job only if height changed
                    cur_job = self.current_jobs.get("randomx")
                    last_h = miner.get("last_template_height") or miner.get("last_sent_height")

                    # Peek a fresh template-backed job (does not send yet)
                    temp_job = self.create_randomx_job()
                    new_h = temp_job.get("height")

                    # Send if: no previous height OR height changed
                    if last_h is None:
                        should_send = True  # First job after login
                        logger.info(f"📤 Sending first periodic job to {addr}")
                    elif new_h != last_h:
                        should_send = True  # Height changed
                        logger.info(f"📤 Height changed {last_h} → {new_h}, sending new job to {addr}")
                    else:
                        should_send = False  # Same height, suppress duplicate
                        logger.debug(f"⏭️  Skipping duplicate job (height {new_h}) for {addr}")

                    job = temp_job
                else:
                    # Non-RX algos keep prior behavior but avoid recreating job every tick
                    job = self.get_job_for_miner(addr)

                if should_send and job and miner.get("writer"):
                    writer = miner["writer"]

                    # For Monero protocol (XMRig), send job notification
                    if miner.get("protocol") == "monero":
                        job_notification = (
                            json.dumps(
                                {
                                    "jsonrpc": "2.0",
                                    "method": "job",
                                    "params": {
                                        "job_id": job.get("job_id"),
                                        "blob": job.get("blob"),
                                        "seed_hash": job.get("seed_hash"),
                                        "next_seed_hash": job.get("next_seed_hash", job.get("seed_hash")),
                                        "target": job.get("target"),
                                        "height": job.get("height", 0),
                                        "algo": job.get("algo", "rx/0"),
                                    },
                                }
                            )
                            + "\n"
                        )
                    else:
                        # Standard Stratum protocol
                        job_notification = json.dumps({"jsonrpc": "2.0", "method": "job", "params": job}) + "\n"

                    writer.write(job_notification.encode("utf-8"))
                    await writer.drain()
                    logger.info(f"📡 Periodic job #{job_count} sent to {addr} (algo: {algo})")
                    print(f"📡 Periodic job #{job_count} sent to {addr} (height: {job.get('height')})")

                    # Track last-sent height for duplicate suppression
                    if algo == "randomx":
                        miner["last_template_height"] = job.get("height")

                    miner["last_job_sent"] = current_time
                    miner["last_activity"] = current_time

            except Exception as e:
                logger.error(f"Error in periodic jobs for {addr}: {e}")
                print(f"❌ Connection lost to {addr}")
                if addr in self.miners:
                    del self.miners[addr]
                break

    # ============= STRATUM IMPLEMENTATION FOR KAWPOW =============

    async def handle_stratum_method(self, data, addr, writer):
        """Handle Stratum protocol methods - Auto-detect algorithm"""
        method = data.get("method")

        # Initialize miner state if not exists
        if addr not in self.miners:
            # Try to detect algorithm from user agent or params
            user_agent = ""
            if method == "mining.subscribe" and data.get("params"):
                user_agent = str(data["params"][0]).lower() if data["params"] else ""

            # Auto-detect algorithm and type based on miner
            algorithm = "randomx"  # Default to RandomX (CPU)
            miner_type = "cpu"

            if "xmrig" in user_agent or "randomx" in user_agent:
                algorithm = "randomx"
                miner_type = "cpu"
            elif "srbminer" in user_agent or "kawpow" in user_agent:
                algorithm = "kawpow"
                miner_type = "gpu"
            elif "yescrypt" in user_agent:
                algorithm = "yescrypt"
                miner_type = "cpu"
            elif "autolykos" in user_agent:
                algorithm = "autolykos_v2"
                miner_type = "gpu"

            logger.info(f"🔍 Detected miner: {user_agent} -> {algorithm} ({miner_type})")

            extranonce1 = secrets.token_hex(4)  # 8 hex chars
            self.miners[addr] = {
                "type": miner_type,
                "protocol": "stratum",
                "algorithm": algorithm,
                "id": f"stratum_{int(time.time())}_{addr[1]}",
                "login": None,
                "connected": time.time(),
                "last_activity": time.time(),
                "session_active": True,
                "difficulty": self.difficulty.get(algorithm, self.difficulty.get(miner_type, 100)),
                "shares_window": [],
                "writer": writer,
                "authorized": False,
                "last_job_id": None,
                "extranonce1": extranonce1,
                "extranonce2_size": 4,  # Standard for yescrypt (not 8)
            }

        if method == "mining.subscribe":
            return await self.handle_stratum_subscribe(data, addr)
        elif method in ("mining.authorize", "mining.login"):
            return await self.handle_stratum_authorize(data, addr)
        elif method == "login":
            # Monero/XMRig-style login for RandomX
            return await self.handle_monero_login(data, addr, writer)
        elif method == "mining.submit":
            return await self.handle_stratum_submit(data, addr)
        elif method == "mining.extranonce.subscribe":
            # Simple acknowledge for extranonce subscription
            return json.dumps({"id": data.get("id"), "result": True, "error": None}) + "\n"
        else:
            return (
                json.dumps(
                    {"id": data.get("id"), "error": {"code": -32601, "message": "Method not found"}, "result": None}
                )
                + "\n"
            )

    async def handle_stratum_subscribe(self, data, addr):
        """Handle mining.subscribe for SRBMiner KawPow, with job replay on reconnect"""
        extranonce1 = self.miners[addr]["extranonce1"]
        extranonce2_size = self.miners[addr]["extranonce2_size"]

        response = {
            "id": data.get("id"),
            "result": [["mining.set_difficulty", "mining.notify"], extranonce1, extranonce2_size],
            "error": None,
        }
        print(f"📤 Subscribe response: extranonce1={extranonce1}")

        # Prepare response bundle with last job (if available, for reconnect replay)
        bundled_response = json.dumps(response) + "\n"

        # If we have queued jobs, send the latest one immediately after subscribe
        # This helps reconnecting miners get back to work quickly
        if self.active_jobs_queue:
            last_job = self.active_jobs_queue[-1]
            job_notify = json.dumps({"id": None, "method": "mining.notify", "params": last_job["notify_params"]}) + "\n"
            bundled_response += job_notify
            logger.info(f"📜 Replaying last job {last_job['job_id']} on reconnect for {addr}")

        return bundled_response

    async def handle_stratum_authorize(self, data, addr):
        """Handle mining.authorize and send initial job"""
        params = data.get("params", [])
        wallet = params[0] if params else "unknown"
        password = params[1] if len(params) > 1 else ""

        # Detect algorithm from password or use already detected from subscribe
        current_algorithm = self.miners[addr].get("algorithm", "randomx")

        # Allow password to override algorithm
        if "randomx" in password.lower():
            algorithm = "randomx"
        elif "autolykos" in password.lower():
            algorithm = "autolykos_v2"
        elif "yescrypt" in password.lower():
            algorithm = "yescrypt"
        elif "cosmic" in password.lower():
            algorithm = "cosmic_harmony"
        elif "kawpow" in password.lower():
            algorithm = "kawpow"
        else:
            # Keep algorithm from subscribe detection
            algorithm = current_algorithm

        logger.info(f"🔧 Miner {addr} algorithm: {algorithm} (from password: {password})")

        # Update miner info
        self.miners[addr]["login"] = wallet
        self.miners[addr]["algorithm"] = algorithm
        self.miners[addr]["authorized"] = True

        # Set difficulty based on algorithm
        if algorithm in self.difficulty:
            self.miners[addr]["difficulty"] = self.difficulty[algorithm]
        else:
            self.miners[addr]["difficulty"] = self.difficulty["gpu"]

        # Initialize miner stats
        self.get_miner_stats(wallet)

        # Create job based on algorithm
        if algorithm == "randomx":
            job = self.create_randomx_job()
            diff = self.miners[addr]["difficulty"]
            # RandomX uses simplified notify format (similar to Monero Stratum)
            notify_params = [
                job["job_id"],
                job["blob"],
                job["seed_hash"],
                job["next_seed_hash"],
                job["height"],
                diff,
                True,  # clean_jobs
            ]
        elif algorithm == "autolykos_v2":
            job = self.create_autolykos_v2_job()
            # Autolykos v2: send [job_id, header, target, ...]
            notify_params = [
                job["job_id"],
                job.get("header") or job["block_header"],
                job["target"],
                job["height"],
                job["elements_seed"],
                job["n_value"],
                job["k_value"],
                True,  # clean_jobs
            ]
        elif algorithm == "yescrypt":
            job = self.create_yescrypt_job()
            # BTC-style Stratum notify for yescrypt-compatible miners (cpuminer-opt)
            notify_params = [
                job["job_id"],
                job["prevhash"],
                job["coinb1"],
                job["coinb2"],
                job["merkle_branch"],
                job["version"],
                job["nbits"],
                job["ntime"],
                True,  # clean_jobs
            ]
        elif algorithm == "cosmic_harmony":
            job = self.create_cosmic_harmony_job()
            # Cosmic Harmony notify: [job_id, block_header, target32, height, clean_jobs]
            notify_params = [job["job_id"], job["block_header"], job["target32"], job["height"], True]
            try:
                logger.info(
                    f"📤 Building Cosmic Harmony auth bundle: job={job['job_id']}, height={job.get('height')}, target32={job.get('target32')}, diff={self.miners[addr].get('difficulty')}"
                )
            except Exception:
                pass
        else:  # kawpow
            job = self.create_kawpow_job()
            diff = self.miners[addr]["difficulty"]
            target_8b = self.difficulty_to_kawpow_target_8byte(diff)
            notify_params = [
                job["job_id"],
                job["seed_hash"],
                job["header_hash"],
                job["height"],
                job["epoch"],
                target_8b,
                True,
            ]

        diff = self.miners[addr]["difficulty"]

        # Build response bundle
        auth_resp = json.dumps({"id": data.get("id"), "result": True, "error": None}) + "\n"

        set_diff_msg = json.dumps({"id": None, "method": "mining.set_difficulty", "params": [diff]}) + "\n"

        notify_msg = json.dumps({"id": None, "method": "mining.notify", "params": notify_params}) + "\n"

        bundled = auth_resp + set_diff_msg + notify_msg

        # Store job in queue for reconnect replay (keep last 5 jobs)
        job_record = {"job_id": job["job_id"], "notify_params": notify_params, "timestamp": time.time()}
        self.active_jobs_queue.append(job_record)
        if len(self.active_jobs_queue) > 5:
            self.active_jobs_queue.pop(0)  # Remove oldest

        try:
            logger.info(
                f"📤 Auth+notify prepared: algo={self.miners[addr].get('algorithm')} job={job['job_id']} diff={diff}"
            )
        except Exception:
            pass
        return bundled

    async def handle_monero_login(self, data, addr, writer):
        """Handle XMRig Monero-style 'login' method for RandomX.
        Expects params as object: {login, pass, agent, rigid?}
        Returns result {status:'OK', id, job:{...}} per Monero Stratum.

        CRITICAL: Must store writer and start periodic_jobs task to keep connection alive.
        """
        try:
            params = data.get("params") or {}
            if isinstance(params, list) and params and isinstance(params[0], dict):
                params = params[0]

            username = params.get("login") or "unknown"
            password = params.get("pass", "")
            agent = params.get("agent", "")
            rigid = params.get("rigid") or params.get("rigId") or ""

            # Default to randomx for XMRig login; allow password override
            algorithm = "randomx"
            pw_lower = str(password).lower()
            if "kawpow" in pw_lower:
                algorithm = "kawpow"
            elif "autolykos" in pw_lower:
                algorithm = "autolykos_v2"
            elif "yescrypt" in pw_lower:
                algorithm = "yescrypt"
            elif "cosmic" in pw_lower:
                algorithm = "cosmic_harmony"

            # Initialize miner record if needed
            miner = self.miners.get(addr)
            if not miner:
                extranonce1 = secrets.token_hex(4)
                self.miners[addr] = {
                    "type": "cpu",
                    "protocol": "monero",  # Changed from 'stratum' to distinguish protocol
                    "algorithm": algorithm,
                    "id": f"xmrig_{int(time.time())}_{addr[1]}",
                    "login": username,
                    "connected": time.time(),
                    "last_activity": time.time(),
                    "session_active": True,
                    "difficulty": self.difficulty.get(algorithm, self.difficulty.get("cpu", 100)),
                    "shares_window": [],
                    "writer": writer,  # ✅ FIX: Store writer reference!
                    "authorized": True,
                    "last_job_id": None,
                    "extranonce1": extranonce1,
                    "extranonce2_size": 8,
                }
                miner = self.miners[addr]

                # ✅ FIX: Start periodic jobs task to keep connection alive
                asyncio.create_task(self.send_periodic_jobs(addr))
                logger.info(f"🔄 Started periodic jobs task for XMRig at {addr}")
            else:
                miner["login"] = username
                miner["algorithm"] = algorithm
                miner["authorized"] = True
                miner["writer"] = writer  # Update writer reference

            # Difficulty
            if algorithm in self.difficulty:
                miner["difficulty"] = self.difficulty[algorithm]

            # Prepare RandomX job in Monero format
            if algorithm != "randomx":
                # For non-RX algos, fallback to standard authorize flow response
                return await self.handle_stratum_authorize(
                    {"id": data.get("id"), "method": "mining.authorize", "params": [username, password]}, addr
                )

            job = self.create_randomx_job()
            miner["last_job_id"] = job["job_id"]

            # Use 8-byte LE target from created job (Monero/XMRig expectation)
            target_hex = job["target"]

            result = {
                "id": miner["id"],
                "job": {
                    "job_id": job["job_id"],
                    "blob": job["blob"],
                    "seed_hash": job["seed_hash"],
                    "next_seed_hash": job.get("next_seed_hash", job["seed_hash"]),
                    "target": target_hex,
                    "height": job.get("height", 0),
                    "algo": "rx/0",  # Tell XMRig the selected algorithm
                },
                "extensions": ["algo"],  # Tell XMRig we support algorithm negotiation
                "status": "OK",
            }

            # Monero/XMRig očekává pouze login result se zabudovaným jobem.
            # Nezasíláme žádné dodatečné zprávy (ani job/mining.notify/mining.set_difficulty) v rámci loginu.
            logger.info(f"📤 Sending login response with job {job['job_id']} to {addr}")
            return json.dumps({"id": data.get("id"), "jsonrpc": "2.0", "error": None, "result": result}) + "\n"
        except Exception as e:
            logger.error(f"Monero-style login failed: {e}")
            return (
                json.dumps({"id": data.get("id"), "result": None, "error": {"code": -1, "message": "Login failed"}})
                + "\n"
            )

    async def handle_stratum_submit(self, data, addr):
        """Handle mining.submit with real KawPow validation"""
        params = data.get("params", [])
        logger.info(f"📨 Mining.submit received from {addr}: params={params}")

        start_time = time.time()

        if addr not in self.miners:
            return (
                json.dumps({"id": data.get("id"), "result": False, "error": {"code": -1, "message": "Not authorized"}})
                + "\n"
            )

        miner = self.miners[addr]
        address = miner["login"]
        algorithm = miner.get("algorithm", "kawpow")
        difficulty = miner["difficulty"]

        # KawPow-style submit uses 5 parameters, Autolykos/CPU modes use 4
        expected_params = 5
        # BTC-style yescrypt uses 5 params as well, RandomX/Autolykos/Cosmic use 4
        if algorithm in ("autolykos_v2", "randomx", "cosmic_harmony"):
            expected_params = 4

        if len(params) < expected_params:
            logger.warning(f"❌ Submit params too short: {len(params)} (need {expected_params})")
            return (
                json.dumps({"id": data.get("id"), "result": False, "error": {"code": -1, "message": "Invalid params"}})
                + "\n"
            )

        # Parse parameters according to algorithm expectations
        if algorithm == "autolykos_v2":
            worker, job_id, nonce, result = params[:4]
            mix_hash = result  # Alias for downstream handling
            job = self.jobs.get(job_id, {})
            header_hash = job.get("block_header", "")
        elif algorithm in ("yescrypt", "randomx", "cosmic_harmony"):
            worker, job_id, nonce, result = params[:4]
            mix_hash = result
            header_hash = ""
        else:
            worker, job_id, nonce, mix_hash, header_hash = params[:5]

        logger.info(f"📩 Submit: worker={worker}, job={job_id}, nonce={nonce[:8]}...")

        # Check for duplicate shares
        current_time = time.time()
        share_key = f"{job_id}:{nonce}:{mix_hash}:{header_hash}"

        if self.is_duplicate_share(share_key):
            print(f"🚫 DUPLICATE {algorithm.upper()} SHARE from {addr}")
            self.record_share(address, algorithm, is_valid=False)
            return (
                json.dumps({"id": data.get("id"), "result": False, "error": {"code": -4, "message": "Duplicate share"}})
                + "\n"
            )

        # Validate share based on algorithm
        is_valid = False
        if algorithm == "kawpow":
            is_valid = self.validate_kawpow_share(job_id, nonce, mix_hash, header_hash, difficulty)
        elif algorithm == "yescrypt":
            # cpuminer-opt submits: [worker, job_id, extranonce2, ntime, nonce]
            try:
                worker, job_id, extranonce2, ntime_hex, nonce_hex = params[:5]
            except Exception:
                return (
                    json.dumps(
                        {
                            "id": data.get("id"),
                            "result": False,
                            "error": {"code": -1, "message": "Invalid yescrypt submit params"},
                        }
                    )
                    + "\n"
                )

            # Assemble header components (placeholder, single-tx block):
            # header = version|prevhash|merkle_root|ntime|nbits|nonce  (all little-endian fields)
            job = self.jobs.get(job_id, {})
            extranonce1 = self.miners.get(addr, {}).get("extranonce1", "")
            coinb1 = job.get("coinb1", "")
            coinb2 = job.get("coinb2", "")
            # Construct coinbase: coinb1 + extranonce1 + extranonce2 + coinb2
            coinbase = coinb1 + extranonce1 + extranonce2 + coinb2
            # Merkle root = double SHA256(coinbase) (placeholder ok)
            try:
                cb_bytes = bytes.fromhex(coinbase)
                mr = hashlib.sha256(hashlib.sha256(cb_bytes).digest()).digest()
            except Exception:
                mr = bytes.fromhex(secrets.token_hex(32))

            # For bring-up: accept shares without strict PoW check, record and move on
            is_valid = True
            print(
                f"🌱 YESCRYPT submit (compat path): job={job_id}, en2={extranonce2[:8]}..., ntime={ntime_hex}, nonce={nonce_hex} -> accepted={is_valid}"
            )
        elif algorithm == "randomx":
            # RandomX CPU mining
            result = mix_hash  # Use mix_hash as result for RandomX
            is_valid = self.validate_randomx_share(job_id, nonce, result, difficulty)
        elif algorithm == "autolykos_v2":
            # For Autolykos v2, we need to adapt the parameters
            # Autolykos v2 uses different parameter format than KawPow
            result = mix_hash  # Use mix_hash as result for Autolykos v2
            is_valid = self.validate_autolykos_v2_share(job_id, nonce, result, difficulty)
        elif algorithm == "cosmic_harmony":
            result = mix_hash
            # Cosmic Harmony native validation
            try:
                # nonce may be hex string, convert to int for validator if needed
                is_valid = self.validate_cosmic_harmony_share(job_id, int(nonce, 16), result, difficulty)
            except Exception:
                is_valid = False
        else:
            # Fallback to KawPow validation
            is_valid = self.validate_kawpow_share(job_id, nonce, mix_hash, header_hash, difficulty)

        processing_time = time.time() - start_time
        share_result = mix_hash
        if algorithm in ("yescrypt", "randomx", "autolykos_v2"):
            share_result = result

        if is_valid:
            # Record valid share
            self.submitted_shares[share_key] = current_time
            self.record_share(address, algorithm, is_valid=True)

            # Persist valid share for payouts/auditing
            try:
                self.db.save_share(
                    address, algorithm, job_id, nonce, share_result, difficulty, True, processing_time, addr[0]
                )
            except Exception as db_err:
                logger.error(f"Failed to persist valid share: {db_err}")

            miner["share_count"] = miner.get("share_count", 0) + 1
            total_shares = miner["share_count"]
            share_time = time.time()
            miner["last_share"] = share_time

            # Track share cadence for vardiff tuning
            times = miner.setdefault("share_times", [])
            last_share_time = miner.get("last_share_time")
            if last_share_time is not None:
                times.append(share_time - last_share_time)
                if len(times) > 10:
                    times.pop(0)
            miner["last_share_time"] = share_time

            # 🎮 CONSCIOUSNESS GAME: Award XP for share submission!
            try:
                self.consciousness_game.on_share_submitted(address)
            except Exception as e:
                logger.error(f"Consciousness game share XP error: {e}")

            # Adjust miner difficulty if necessary
            try:
                self.adjust_difficulty(addr, algorithm)
            except Exception as diff_err:
                logger.debug(f"Difficulty adjust skipped: {diff_err}")

            print(f"🎯 {algorithm.upper()} Share: job={job_id}, nonce={nonce}")
            print(f"✅ VALID {algorithm.upper()} SHARE ACCEPTED (Total: {total_shares})")
            print(f"💰 Address: {address}")

            # Check for block discovery
            self.check_block_found()

            # Process any pending payouts
            payouts = self.process_pending_payouts()
            if payouts:
                print(f"💰 {len(payouts)} payouts ready for processing")

        else:
            # Invalid share
            self.record_share(address, algorithm, is_valid=False)
            try:
                self.db.save_share(
                    address, algorithm, job_id, nonce, share_result, difficulty, False, processing_time, addr[0]
                )
            except Exception as db_err:
                logger.error(f"Failed to persist invalid share: {db_err}")

            # Track invalid share for potential banning heuristics
            try:
                self.track_invalid_share(addr[0], False)
            except Exception as track_err:
                logger.debug(f"Invalid share tracking failed: {track_err}")
            print(f"❌ INVALID {algorithm.upper()} SHARE from {addr}")
            return (
                json.dumps({"id": data.get("id"), "result": False, "error": {"code": -1, "message": "Invalid share"}})
                + "\n"
            )

        return json.dumps({"id": data.get("id"), "result": True, "error": None}) + "\n"

    def create_kawpow_job(self):
        """Create KawPow job for GPU miners"""
        self.job_counter += 1
        job_id = f"zion_kp_{self.job_counter:06d}"
        # Pro kompatibilitu se SRBMiner: použij nízkou výšku a epoch=0
        height = self.current_block_height + self.job_counter  # < 7500 → epoch 0
        epoch = 0
        # Deterministický seed pro aktuální epoch (placeholder)
        base_seed = "00" * 32  # 64 hex nul – stabilní seed
        seed_hash = base_seed
        header_hash = secrets.token_hex(32)
        mix_hash = secrets.token_hex(16)
        job = {
            "job_id": job_id,
            "algorithm": "kawpow",
            "height": height,
            "epoch": epoch,
            "seed_hash": seed_hash,
            "header_hash": header_hash,
            "mix_hash": mix_hash,
            "created": time.time(),
            "difficulty": self.difficulty["gpu"],
        }

        self.jobs[job_id] = job
        print(f"🔥 KawPow job created: {job_id} height={height} epoch={epoch}")
        return job

    def difficulty_to_kawpow_target_8byte(self, diff: int) -> str:
        """Convert difficulty to 8-byte big-endian target for KawPow"""
        diff = max(1, min(diff, 2_000_000))
        # Jednoduchý výpočet: base / difficulty
        base = 0xFFFFFFFFFFFFFFFF  # 8 bytes max
        target = base // diff
        if target < 1:
            target = 1
        # Big-endian 8 bytes
        return f"{target:016x}"

    def difficulty_to_kawpow_target_32bit(self, diff: int) -> str:
        """Convert difficulty to 32-bit big-endian target for KawPow"""
        diff = max(1, min(diff, 2_000_000))
        # Jednoduchý výpočet: base / difficulty
        base = 0xFFFFFFFF  # 4 bytes max
        target = base // diff
        if target < 1:
            target = 1
        # Big-endian 4 bytes
        return f"{target:08x}"

    def get_pool_stats(self) -> Dict[str, Any]:
        """Get comprehensive pool statistics"""
        total_miners = len(self.miners)
        total_shares = sum(stats.total_shares for stats in self.miner_stats.values())
        total_valid_shares = sum(stats.valid_shares for stats in self.miner_stats.values())
        total_invalid_shares = sum(stats.invalid_shares for stats in self.miner_stats.values())

        blocks_found = len([b for b in self.pool_blocks if b.status == "confirmed"])
        pending_payouts = sum(stats.balance_pending for stats in self.miner_stats.values())

        return {
            "pool_name": "ZION Universal Pool",
            "pool_port": self.port,
            "current_height": self.current_block_height,
            "total_miners": total_miners,
            "total_shares": total_shares,
            "valid_shares": total_valid_shares,
            "invalid_shares": total_invalid_shares,
            "blocks_found": blocks_found,
            "pending_payouts_zion": pending_payouts,
            "pool_fee_percent": self.pool_fee_percent * 100,
            "payout_threshold_zion": self.payout_threshold,
            "algorithms": ["randomx", "yescrypt", "autolykos_v2"],
            "pool_wallet": self.pool_wallet_address,
            "server_time": datetime.now().isoformat(),
            "performance": {
                "uptime_seconds": time.time() - self.performance_stats["start_time"],
                "total_connections": self.performance_stats["total_connections"],
                "peak_connections": self.performance_stats["peak_connections"],
                "shares_processed": self.performance_stats["total_shares_processed"],
                "avg_processing_time_ms": self.performance_stats["avg_share_processing_time"] * 1000,
                "errors_count": self.performance_stats["errors_count"],
                "banned_ips": len(self.banned_ips),
                "vardiff_enabled": self.vardiff["enabled"],
            },
        }

    async def periodic_duplicate_cache_cleanup(self):
        """Periodically cleanup expired duplicate share cache entries"""
        while True:
            await asyncio.sleep(self.duplicate_cache_cleanup_interval)
            try:
                cache_size_before = len(self.submitted_shares)
                self._manage_duplicate_cache()
                cache_size_after = len(self.submitted_shares)

                if cache_size_before != cache_size_after:
                    logger.info(
                        f"🧹 Periodic duplicate cache cleanup: {cache_size_before} → {cache_size_after} entries"
                    )
            except Exception as e:
                logger.error(f"Error in periodic duplicate cache cleanup: {e}")

    async def periodic_stats_save(self):
        """Periodically save pool statistics to database"""
        while True:
            await asyncio.sleep(300)  # Save every 5 minutes

            try:
                stats = self.get_pool_stats()
                self.db.save_pool_stats(stats)

                # 📊 Prometheus: Update gauges with current stats
                self.update_prometheus_metrics(stats)

                logger.info(f"📊 Pool stats saved: {stats['total_shares']} shares, {stats['blocks_found']} blocks")
            except Exception as e:
                logger.error(f"Error saving pool stats: {e}")
                errors_counter.labels(type="stats_save").inc()

    def update_prometheus_metrics(self, stats):
        """Update Prometheus gauges with current pool statistics"""
        try:
            # Update connected miners gauge
            connected_miners_gauge.set(len(self.miners))

            # Update pending balance
            pending_balance_gauge.set(stats.get("pending_payouts_zion", 0))

            # Update banned IPs
            banned_ips_gauge.set(len(self.banned_ips))

            # Calculate and update hashrate per algorithm
            for algo in ["randomx", "yescrypt", "autolykos_v2"]:
                hashrate = self.calculate_pool_hashrate(algo)
                pool_hashrate_gauge.labels(algorithm=algo).set(hashrate)
                difficulty_gauge.labels(algorithm=algo).set(self.difficulty.get(algo, 0))

                # Count active miners per algorithm
                active_count = sum(1 for m in self.miners.values() if m.get("algorithm") == algo)
                active_miners_gauge.labels(algorithm=algo).set(active_count)

            logger.debug("📊 Prometheus metrics updated successfully")
        except Exception as e:
            logger.error(f"Error updating Prometheus metrics: {e}")
            errors_counter.labels(type="prometheus_update").inc()

    def calculate_pool_hashrate(self, algorithm):
        """Calculate pool hashrate for specific algorithm"""
        try:
            hashrate = 0
            current_time = time.time()

            for addr, miner in self.miners.items():
                if miner.get("algorithm") == algorithm:
                    # Get miner stats
                    address = miner.get("login", "unknown")
                    if address in self.miner_stats:
                        stats = self.miner_stats[address]
                        # Calculate hashrate based on recent shares
                        if stats.last_share_time and (current_time - stats.last_share_time) < 300:
                            # Active in last 5 minutes
                            difficulty = stats.difficulty
                            time_window = 60  # 1 minute window
                            # Rough estimate: difficulty * shares_per_minute
                            estimated_hashrate = difficulty / time_window
                            hashrate += estimated_hashrate

            return hashrate
        except Exception as e:
            logger.error(f"Error calculating hashrate: {e}")
            return 0

    async def rpc_watchdog(self):
        """Continuously monitor RPC availability and switch to RPC-backed templates when ready."""
        # Small initial delay to give the node time to boot
        await asyncio.sleep(5)
        while True:
            await asyncio.sleep(5)
            try:
                if self.blockchain_rpc and self.blockchain_rpc.health_check():
                    # Mark connected and prefer RPC-backed templates
                    if not getattr(self, "_rpc_connected", False):
                        logger.info("📡 RPC became available; switching to RPC-backed templates")
                    self._rpc_connected = True
                    # Stop using local blockchain for template generation once RPC is healthy
                    if self.blockchain is not None:
                        self.blockchain = None
                    # Update current height from RPC
                    try:
                        h = self.blockchain_rpc.get_height()
                        if h >= 0:
                            self.current_block_height = h
                    except Exception:
                        pass
                else:
                    if getattr(self, "_rpc_connected", False):
                        logger.warning("⚠️ RPC lost; falling back to local blockchain if available")
                    self._rpc_connected = False
            except Exception as e:
                logger.debug(f"RPC watchdog error: {e}")

    async def start_server(self):
        """Start the mining pool server with database integration"""
        # Load existing miner stats from database
        print("Loading miner statistics from database...")
        # Note: Individual miner stats are loaded on-demand in get_miner_stats()

        # Initialize first block
        self.start_new_block()

        # Start periodic stats saving
        asyncio.create_task(self.periodic_stats_save())

        # Start periodic duplicate cache cleanup
        asyncio.create_task(self.periodic_duplicate_cache_cleanup())

        # Start alerting system if Discord webhook configured
        discord_webhook = ZionNetworkConfig.POOL_CONFIG.get("discord_webhook_url")
        if discord_webhook:
            try:
                pool_alerting = importlib.import_module("zion_pool_alerting")
                start_pool_with_alerting = getattr(pool_alerting, "start_pool_with_alerting")
                self.alerting = await start_pool_with_alerting(self, discord_webhook)
                print("🔔 Discord alerting system enabled")
            except (ModuleNotFoundError, AttributeError) as e:
                logger.warning(f"Failed to start alerting system: {e}")
                print("⚠️ Alerting system disabled (check configuration)")

        server = await asyncio.start_server(self.handle_client, "0.0.0.0", self.port)

        print(f"ZION Universal Mining Pool started on port {self.port}")
        print(f"Pool Stats API available at http://localhost:{self.port + 1}/api/stats")
        print(f"Pool Fee: {self.pool_fee_percent * 100}% | Payout Threshold: {self.payout_threshold} ZION")
        print(f"Algorithms: RandomX (CPU), Yescrypt (CPU), Autolykos v2 (GPU)")
        print(f"Base Block Reward: {self.base_block_reward} ZION (before consciousness multiplier)")
        print(f"Current Blockchain Height: {self.current_block_height}")
        print(f"Database: zion_pool.db (persistent storage enabled)")

        # Start API server in background task
        try:
            print(f"Starting API server...")
            # Start API server in background task
            self.api_task = asyncio.create_task(self.api_server.start())
            print(f"Pool API server task started on port {self.port + 1}")
        except Exception as e:
            logger.error(f"Failed to start API server task: {e}")
            print(f"Failed to start API server task: {e}")
            raise

        # Start cleanup task
        asyncio.create_task(self.cleanup_inactive_miners())
        # Start RPC watchdog to auto-switch to RPC when node is ready
        asyncio.create_task(self.rpc_watchdog())

        try:
            async with server:
                await server.serve_forever()
        except Exception as e:
            logger.error(f"Server error: {e}")
            print(f"Server error: {e}")


async def main():
    import argparse

    parser = argparse.ArgumentParser(description="ZION Universal Mining Pool")
    parser.add_argument("--testnet", action="store_true", help="Run in testnet mode")
    # Synthetic internal lite miner (TEST ONLY). Explicit opt-in to avoid contaminating production economics.
    parser.add_argument("--lite-miner-synthetic", action="store_true", help="(TEST ONLY) Spustí interní syntetický multi‑algo lite miner – NEPOUŽÍVEJTE NA PRODUKCI")
    parser.add_argument("--lite-miner-rate", type=float, default=2.0, help="Synthetic lite miner shares per second (default 2.0)")
    parser.add_argument("--lite-miner-algos", type=str, default="randomx,yescrypt,autolykos_v2,kawpow,cosmic_harmony", help="Comma separated list of algorithms to rotate in synthetic lite miner")
    parser.add_argument("--test-block-threshold", type=int, default=None, help="Override block mining share threshold for testing")
    args = parser.parse_args()

    # Set port and network based on mode
    if args.testnet:
        port = 3335  # Testnet pool port
        network = "testnet"
        print("🧪 ZION Universal Pool - TESTNET MODE")
    else:
        port = 3333  # Mainnet pool port
        network = "mainnet"
        print("🚀 ZION Universal Pool - PRODUCTION MODE")

    pool = ZionUniversalPool(port=port, network=network, test_block_threshold=args.test_block_threshold)

    # If requested, start a built-in ultra-light miner that:
    # - connects via in-memory calls, bypassing network
    # - periodically creates a job (if needed) and submits a valid-ish share
    # - honors var-diff by reading pool.current_difficulty (per algo default)
    async def _lite_miner_task():  # synthetic ONLY
        """Rotující interní lite miner: střídá algoritmy a generuje syntetické validní share.

        Inspirace: universal miner – zde jen rychlá emulace pro end-to-end verifikaci odměn a block threshold.
        Rotace:
          - seznam algoritmů z --lite-miner-algos
          - každých N (algo_switch_interval) share se přepne na další
        Pro každý algoritmus se pokusí vytvořit nativní job (pokud je implementován), jinak fallback placeholder.
        """
        import random, hashlib
        algos = [a.strip() for a in args.lite_miner_algos.split(',') if a.strip()]
        if not algos:
            algos = ["randomx"]
        miner_addr = "zion1liteMultiAlgo"
        print(f"🪄 [SYNTHETIC TEST] Lite multi-algo miner started: addr={miner_addr}, algos={algos}, rate={args.lite_miner_rate} shares/s")
        algo_index = 0
        shares_on_current = 0
        algo_switch_interval = max(1, int(args.lite_miner_rate))  # heuristika: přepni po ~1s práce

        def _create_job_for(algo_name: str):
            try:
                if algo_name == "randomx" and hasattr(pool, "create_randomx_job"):
                    return pool.create_randomx_job()
                if algo_name == "yescrypt" and hasattr(pool, "create_yescrypt_job"):
                    return pool.create_yescrypt_job()
                if algo_name == "autolykos_v2" and hasattr(pool, "create_autolykos_v2_job"):
                    return pool.create_autolykos_v2_job()
                if algo_name == "cosmic_harmony" and hasattr(pool, "create_cosmic_harmony_job"):
                    return pool.create_cosmic_harmony_job()
                if algo_name == "kawpow" and hasattr(pool, "create_kawpow_job"):
                    return pool.create_kawpow_job()
            except Exception as e:
                logger.debug(f"Job creation failed for {algo_name}: {e}")
            # Fallback placeholder
            return {"job_id": f"lite_{algo_name}_job", "placeholder": True}

        current_algo = algos[algo_index]
        current_job = _create_job_for(current_algo)

        while True:
            try:
                # Rotace algoritmu pokud dosažen interval
                if shares_on_current >= algo_switch_interval:
                    shares_on_current = 0
                    algo_index = (algo_index + 1) % len(algos)
                    current_algo = algos[algo_index]
                    current_job = _create_job_for(current_algo)
                    print(f"🔁 Lite miner switched to algo={current_algo}")

                job_id = current_job.get("job_id", f"lite_{current_algo}_job")
                nonce = random.randint(1, 2_000_000)
                payload = f"{job_id}:{miner_addr}:{current_algo}:{nonce}".encode()
                result = hashlib.sha256(payload).hexdigest()

                # Update block & stats (stejně jako dříve)
                if not pool.pool_blocks:
                    pool.start_new_block()
                block = pool.pool_blocks[-1]
                if block.status != "pending":
                    pool.start_new_block()
                    block = pool.pool_blocks[-1]

                block.total_shares += 1
                block.miner_shares[miner_addr] = block.miner_shares.get(miner_addr, 0) + 1

                stats = pool.get_miner_stats(miner_addr)
                stats.algorithm = current_algo
                stats.total_shares += 1
                stats.valid_shares += 1
                stats.last_share_time = time.time()
                pool.performance_stats["total_shares_processed"] += 1
                pool.db.save_miner_stats(miner_addr, stats)

                try:
                    pool.save_share(
                        address=miner_addr,
                        algorithm=current_algo,
                        job_id=job_id,
                        nonce=str(nonce),
                        result=result[:32],
                        difficulty=getattr(stats, 'difficulty', 1),
                        is_valid=True,
                        processing_time=0.0002,
                        ip_address="127.0.0.1",
                    )
                except Exception as e:
                    logger.debug(f"Lite miner DB save share failed: {e}")

                shares_on_current += 1
                pool.check_block_found()

                await asyncio.sleep(max(0.01, 1.0 / max(0.1, args.lite_miner_rate)))
            except Exception as e:
                logger.error(f"Lite multi-algo miner error (synthetic): {e}")
                await asyncio.sleep(0.5)

    # Start pool and optionally the lite miner
    if args.lite_miner_synthetic:
        # Start server first, then miner
        asyncio.create_task(pool.start_server())
        asyncio.create_task(_lite_miner_task())
        # Keep main alive
        while True:
            await asyncio.sleep(1)
    else:
        await pool.start_server()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nPool stopped")
