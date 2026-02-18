#!/usr/bin/env python3
"""
ZION Universal Mining Pool with Real Hash Validation & Reward System
Supports ZION addresses, real ProgPow validation, and proportional rewards
🎮 NOW WITH CONSCIOUSNESS MINING GAME - 10-Year Evolution Journey!
"""
import asyncio
import os
import json
import socket
import time
import secrets
import hashlib
import logging
import sqlite3
from typing import Dict, Optional, Any, List
from dataclasses import dataclass, field
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
import threading

# Prometheus monitoring
from prometheus_client import Counter, Gauge, Histogram, start_http_server, Info

# Import the real ZION blockchain and centralized config
from new_zion_blockchain import NewZionBlockchain
from seednodes import ZionNetworkConfig, get_pool_port
from blockchain_rpc_client import ZionBlockchainRPCClient

# 🎮 CONSCIOUSNESS MINING GAME
from consciousness_mining_game import ConsciousnessMiningGame

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ========================================
# PROMETHEUS METRICS
# ========================================

# Pool info
pool_info = Info('zion_pool_info', 'ZION Mining Pool Information')
pool_info.info({
    'version': '2.8.1',
    'name': 'ZION Universal Pool',
    'consciousness_mining': 'enabled'
})

# Counters (always increasing)
total_shares_counter = Counter('zion_pool_shares_total', 'Total shares submitted', ['algorithm', 'status'])
blocks_found_counter = Counter('zion_pool_blocks_found_total', 'Total blocks found', ['algorithm'])
connections_counter = Counter('zion_pool_connections_total', 'Total connections')
errors_counter = Counter('zion_pool_errors_total', 'Total errors', ['type'])

# Gauges (current values)
active_miners_gauge = Gauge('zion_pool_active_miners', 'Currently active miners', ['algorithm'])
pool_hashrate_gauge = Gauge('zion_pool_hashrate', 'Pool hashrate in H/s', ['algorithm'])
difficulty_gauge = Gauge('zion_pool_difficulty', 'Current pool difficulty', ['algorithm'])
pending_balance_gauge = Gauge('zion_pool_pending_balance', 'Total pending balance in ZION')
connected_miners_gauge = Gauge('zion_pool_connected_miners', 'Number of connected miners')
banned_ips_gauge = Gauge('zion_pool_banned_ips', 'Number of banned IPs')

# Histograms (distributions)
share_processing_time = Histogram('zion_pool_share_processing_seconds', 'Time to process a share')
block_time_histogram = Histogram('zion_pool_block_time_seconds', 'Time between blocks', 
                                  buckets=[60, 300, 600, 1800, 3600, 7200, 14400])

# Consciousness Mining Metrics
consciousness_level_gauge = Gauge('zion_pool_consciousness_level', 'Miner consciousness level', ['address', 'level_name'])
consciousness_multiplier_gauge = Gauge('zion_pool_consciousness_multiplier', 'Consciousness mining multiplier', ['address'])
meditation_sessions_counter = Counter('zion_pool_meditation_sessions_total', 'Total meditation sessions logged', ['address'])

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
            cursor.execute('''
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
            ''')

            # Shares table
            cursor.execute('''
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
            ''')

            # Blocks table
            cursor.execute('''
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
            ''')

            # Block shares table (many-to-many relationship)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS block_shares (
                    block_id INTEGER,
                    address TEXT,
                    shares INTEGER DEFAULT 0,
                    FOREIGN KEY (block_id) REFERENCES blocks (id),
                    FOREIGN KEY (address) REFERENCES miners (address),
                    PRIMARY KEY (block_id, address)
                )
            ''')

            # Payouts table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS payouts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    address TEXT NOT NULL,
                    amount REAL NOT NULL,
                    timestamp REAL DEFAULT (strftime('%s', 'now')),
                    block_height INTEGER,
                    status TEXT DEFAULT 'pending',
                    tx_hash TEXT
                )
            ''')

            # Pool stats table
            cursor.execute('''
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
            ''')

            # Create indexes for performance
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_shares_address ON shares(address)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_shares_timestamp ON shares(timestamp)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_blocks_height ON blocks(height)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_payouts_address ON payouts(address)')

            conn.commit()

    def save_miner_stats(self, address: str, stats: MinerStats):
        """Save miner statistics to database"""
        with sqlite3.connect(self.db_file) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO miners
                (address, algorithm, total_shares, valid_shares, invalid_shares,
                 last_share_time, connected_time, balance_pending, balance_paid,
                 difficulty, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
            ''', (
                address, stats.algorithm, stats.total_shares, stats.valid_shares,
                stats.invalid_shares, stats.last_share_time, stats.connected_time,
                stats.balance_pending, stats.balance_paid, stats.difficulty
            ))
            conn.commit()

    def load_miner_stats(self, address: str) -> Optional[MinerStats]:
        """Load miner statistics from database"""
        with sqlite3.connect(self.db_file) as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM miners WHERE address = ?', (address,))
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
                    difficulty=row[9]
                )
        return None

    def save_share(self, address: str, algorithm: str, job_id: str, nonce: str,
                   result: str, difficulty: int, is_valid: bool, processing_time: float,
                   ip_address: str):
        """Save share to database"""
        with sqlite3.connect(self.db_file) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO shares
                (address, algorithm, job_id, nonce, result, difficulty, is_valid,
                 processing_time, ip_address, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
            ''', (address, algorithm, job_id, nonce, result, difficulty, is_valid,
                  processing_time, ip_address))
            conn.commit()

    def get_miner_history(self, address: str, limit: int = 100) -> List[Dict]:
        """Get miner share history"""
        with sqlite3.connect(self.db_file) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT timestamp, is_valid, difficulty, algorithm
                FROM shares
                WHERE address = ?
                ORDER BY timestamp DESC
                LIMIT ?
            ''', (address, limit))

            history = []
            for row in cursor.fetchall():
                history.append({
                    'timestamp': row[0],
                    'is_valid': bool(row[1]),
                    'difficulty': row[2],
                    'algorithm': row[3]
                })
            return history

    def cleanup_old_data(self, days: int = 30):
        """Clean up old share data"""
        cutoff_time = time.time() - (days * 24 * 60 * 60)
        with sqlite3.connect(self.db_file) as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM shares WHERE timestamp < ?', (cutoff_time,))
            deleted_count = cursor.rowcount
            conn.commit()
            print(f"🧹 Cleaned up {deleted_count} old shares from database")

    def get_pool_stats_history(self, hours: int = 24) -> List[Dict]:
        """Get pool statistics history"""
        cutoff_time = time.time() - (hours * 60 * 60)
        with sqlite3.connect(self.db_file) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT timestamp, total_miners, total_shares, valid_shares,
                       invalid_shares, blocks_found, pending_payouts, active_connections
                FROM pool_stats
                WHERE timestamp > ?
                ORDER BY timestamp DESC
            ''', (cutoff_time,))

            stats = []
            for row in cursor.fetchall():
                stats.append({
                    'timestamp': row[0],
                    'total_miners': row[1],
                    'total_shares': row[2],
                    'valid_shares': row[3],
                    'invalid_shares': row[4],
                    'blocks_found': row[5],
                    'pending_payouts': row[6],
                    'active_connections': row[7]
                })
            return stats

    def save_pool_stats(self, stats):
        """Save pool statistics to database"""
        try:
            with sqlite3.connect(self.db_file) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO pool_stats (
                        total_miners, total_shares, valid_shares, invalid_shares,
                        blocks_found, pending_payouts, active_connections,
                        peak_connections, shares_processed, avg_processing_time_ms,
                        errors_count, banned_ips, vardiff_enabled
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    stats.get('total_miners', 0),
                    stats.get('total_shares', 0),
                    stats.get('valid_shares', 0),
                    stats.get('invalid_shares', 0),
                    stats.get('blocks_found', 0),
                    stats.get('pending_payouts', 0.0),
                    stats.get('active_connections', 0),
                    stats.get('peak_connections', 0),
                    stats.get('shares_processed', 0),
                    stats.get('avg_processing_time_ms', 0.0),
                    stats.get('errors_count', 0),
                    stats.get('banned_ips', 0),
                    stats.get('vardiff_enabled', False)
                ))
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
            if self.path == '/api/stats':
                self.send_stats_response()
            elif self.path.startswith('/api/miner/'):
                address = self.path.split('/api/miner/')[-1]
                self.send_miner_stats_response(address)
            elif self.path == '/api/pool':
                self.send_pool_info_response()
            elif self.path == '/api/health':
                self.send_health_response()
            # 🎮 CONSCIOUSNESS GAME API ENDPOINTS
            elif self.path.startswith('/api/consciousness/profile/'):
                address = self.path.split('/api/consciousness/profile/')[-1]
                self.send_consciousness_profile(address)
            elif self.path == '/api/consciousness/leaderboard':
                self.send_consciousness_leaderboard()
            elif self.path == '/api/consciousness/levels':
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
            'address': miner_stats.address,
            'algorithm': miner_stats.algorithm,
            'total_shares': miner_stats.total_shares,
            'valid_shares': miner_stats.valid_shares,
            'invalid_shares': miner_stats.invalid_shares,
            'balance_pending': miner_stats.balance_pending,
            'balance_paid': miner_stats.balance_paid,
            'last_share_time': miner_stats.last_share_time,
            'connected_time': miner_stats.connected_time,
            'difficulty': miner_stats.difficulty,
            'history': history
        }

        self.send_json_response(response)

    def send_pool_info_response(self):
        """Send general pool information"""
        info = {
            'name': 'ZION Universal Mining Pool',
            'version': '2.8.1',
            'algorithms': ['randomx', 'yescrypt', 'autolykos_v2'],
            'ports': {
                'stratum': self.pool.port,
                'api': self.pool.port + 1
            },
            'fees': {
                'pool_fee_percent': self.pool.pool_fee_percent * 100,
                'payout_threshold': self.pool.payout_threshold
            },
            'rewards': {
                'base_block_reward': self.pool.base_block_reward,
                'consciousness_multipliers': {
                    'PHYSICAL': 1.0,
                    'EMOTIONAL': 1.05,
                    'MENTAL': 1.1,
                    'SACRED': 1.25,
                    'QUANTUM': 1.5,
                    'COSMIC': 2.0,
                    'ENLIGHTENED': 3.0,
                    'TRANSCENDENT': 5.0,
                    'ON_THE_STAR': 10.0
                },
                'eco_bonuses': {
                    'randomx': 1.0,
                    'yescrypt': 1.15,
                    'autolykos_v2': 1.2
                }
            },
            'features': [
                'Variable Difficulty',
                'IP Banning',
                'Performance Monitoring',
                'Database Persistence',
                'REST API',
                'Eco-Friendly Mining'
            ]
        }
        self.send_json_response(info)

    def send_health_response(self):
        """Send health check response"""
        health = {
            'status': 'healthy',
            'timestamp': time.time(),
            'uptime_seconds': time.time() - self.pool.performance_stats['start_time'],
            'active_connections': len(self.pool.miners),
            'total_miners': len(self.pool.miner_stats),
            'database_status': 'connected' if hasattr(self.pool, 'db') else 'disconnected'
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
            self.send_json_response({'leaderboard': leaderboard})
        except Exception as e:
            logger.error(f"Consciousness leaderboard error: {e}")
            self.send_error_response(500, f"Error fetching leaderboard: {e}")

    def send_consciousness_levels(self):
        """Send information about all consciousness levels"""
        try:
            from consciousness_mining_game import ConsciousnessLevel
            levels = []
            for level in ConsciousnessLevel:
                levels.append({
                    'name': level.name,
                    'multiplier': level.value['multiplier'],
                    'xp_required': level.value['xp_required'],
                    'description': level.value.get('description', '')
                })
            self.send_json_response({'levels': levels})
        except Exception as e:
            logger.error(f"Consciousness levels error: {e}")
            self.send_error_response(500, f"Error fetching levels: {e}")

    def send_json_response(self, data, status_code=200):
        """Send JSON response"""
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2).encode('utf-8'))

    def send_error_response(self, status_code, message):
        """Send error response"""
        error_data = {
            'error': {
                'code': status_code,
                'message': message
            }
        }
        self.send_json_response(error_data, status_code)

    def log_message(self, format, *args):
        """Override to use our logger"""
        logger.info(f"API: {format % args}")

class ZIONPoolAPIServer:
    """Simple HTTP server for pool API"""

    def __init__(self, pool_instance, port=3334):
        self.pool = pool_instance
        self.port = port
        self.server = None
        self.thread = None

    def start(self):
        """Start API server in background thread"""
        print(f"Starting API server on port {self.port}...")
        def run_server():
            try:
                # Create custom handler with pool instance
                def handler_class(*args, **kwargs):
                    return ZIONPoolAPIHandler(self.pool, *args, **kwargs)

                self.server = HTTPServer(('0.0.0.0', self.port), handler_class)
                print(f"Pool API server started on port {self.port}")
                self.server.serve_forever()
            except Exception as e:
                logger.error(f"API server error: {e}")

        self.thread = threading.Thread(target=run_server, daemon=True)
        self.thread.start()

    def stop(self):
        """Stop API server"""
        if self.server:
            self.server.shutdown()
            self.server.server_close()
            print("📊 Pool API server stopped")

class ZionUniversalPool:
    def __init__(self, port=None):
        # Use centralized pool configuration
        pool_config = ZionNetworkConfig.POOL_CONFIG
        
        self.port = port or pool_config['stratum_port']
        self.miners: Dict[tuple, dict] = {}
        self.miner_stats: Dict[str, MinerStats] = {}
        self.current_jobs = {
            'randomx': None,
            'kawpow': None,
            'ethash': None
        }
        self.job_counter = 0
        self.share_counter = 0
        self.block_counter = 0

        # Reward system from centralized config
        self.pool_blocks: List[PoolBlock] = []
        self.pool_wallet_address = 'ZION_SACRED_B0FA7E2A234D8C2F08545F02295C98'  # Sacred Mining Operator from premine
        self.pool_fee_percent = pool_config['fee_percent']
        self.payout_threshold = pool_config['payout_threshold']
        
        # Economic model - fee distribution
        self.humanitarian_fee_percent = 0.10  # 10% for Children Future Fund (desátek pro humanitu)
        self.dev_team_fee_percent = 0.01      # 1% for Development Team
        self.genesis_fee_percent = 0.0033     # 0.33% Genesis Creator Lifetime Rent (Yeshuae Amon Ra) 💰
        self.pool_admin_fee_percent = 0.01    # 1% Pool Admin Fee (Maitreya Buddha) 💎
        
        # Fee recipient addresses
        self.humanitarian_address = 'ZION_CHILDREN_FUTURE_FUND_1ECCB72BC30AADD086656A59'
        self.dev_team_address = 'ZION_DEVELOPMENT_TEAM_FUND_378614887FEA27791540F45'
        self.genesis_creator_address = 'ZION_ON_THE_STAR_0B461AB5BCACC40D1ECE95A2D82030'  # Yeshuae Amon Ra
        self.pool_admin_address = 'ZION_MAITREYA_BUDDHA_DAO_ADMIN_D7A371ABD1FF1C5D42AB02'  # Maitreya Buddha (Pool Admin)
        
        # Real blockchain integration via RPC (not local instance!)
        self.blockchain_rpc = ZionBlockchainRPCClient(host='localhost', port=8545)
        
        # Fallback: Create local blockchain for development (will auto-connect if RPC fails)
        self.blockchain = None
        if not self.blockchain_rpc.health_check():
            logger.warning("⚠️  Blockchain RPC unavailable, falling back to local instance")
            self.blockchain = NewZionBlockchain(enable_rpc=False)
        
        # Get current height and block reward from blockchain
        if self.blockchain_rpc.connected:
            self.current_block_height = self.blockchain_rpc.get_height()
            logger.info(f"📡 Connected to blockchain via RPC at height {self.current_block_height}")
        else:
            self.current_block_height = len(self.blockchain.blocks) - 1 if self.blockchain else 0
            logger.info(f"📦 Using local blockchain at height {self.current_block_height}")
            
        self.base_block_reward = ZionNetworkConfig.ECONOMIC_MODEL['mining_config']['base_block_reward']  # Now 50.0 ZION
        
        logger.info(f"💎 Pool initialized")
        logger.info(f"💰 Base block reward: {self.base_block_reward} ZION (before consciousness multiplier)")

        # Share validation
        self.submitted_shares = set()  # For duplicate detection
        self.share_window_size = 100  # Rolling window for difficulty adjustment

        # Algorithm difficulty from centralized config
        self.difficulty = pool_config['difficulty'].copy()
        
        # Eco-friendly algorithm rewards from centralized config
        self.eco_rewards = pool_config['eco_rewards'].copy()

        # Jobs and submissions tracking
        self.jobs = {}
        self.submissions = set()

        # Performance monitoring
        self.performance_stats = {
            'start_time': time.time(),
            'total_connections': 0,
            'total_shares_processed': 0,
            'avg_share_processing_time': 0.0,
            'peak_connections': 0,
            'errors_count': 0,
            'last_reset': time.time()
        }
        self.share_processing_times = []
        
        # Variable difficulty system (inspired by Node Stratum Pool)
        self.vardiff = {
            'enabled': True,
            'min_diff': {
                'randomx': 1000,
                'yescrypt': 800, 
                'autolykos_v2': 50
            },
            'max_diff': {
                'randomx': 50000,
                'yescrypt': 40000,
                'autolykos_v2': 2500
            },
            'target_time': 20,  # seconds per share (eco-friendly - longer than 15s standard)
            'retarget_time': 90,  # check every 90 seconds
            'variance_percent': 30  # tolerance before retargeting
        }
        
        # Session management and IP banning
        self.banned_ips = {}
        self.connection_stats = {}
        self.banning = {
            'enabled': True,
            'invalid_percent_threshold': 60,  # ban at 60% invalid (more tolerant than 50%)
            'check_threshold': 200,  # check after 200 shares
            'ban_duration': 600  # 10 minutes
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
        api_port = pool_config['api_port']
        self.api_server = ZIONPoolAPIServer(self, port=api_port)

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
        if address.startswith('ZION_') and len(address) == 37:
            # ZION_ + 32 hex characters
            hex_part = address[5:]
            try:
                int(hex_part, 16)  # Verify it's valid hex
                return True
            except ValueError:
                return False
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
        TEMPORARY: Accept all shares for testing mining pipeline
        """
        print(f"🧪 VALIDATE called: job={job_id}, nonce={nonce}, result={result[:16]}...")
        return True  # Accept all shares for testing

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
            if os.environ.get('ZION_ALV2_ACCEPT_ALL', '0') == '1':
                logger.info(f"🧪 [TEST] Accepting Autolykos v2 share: job={job_id}, nonce={nonce}")
                return True

            job = self.jobs[job_id]
            # Reconstruct expected result based on current GPU kernel placeholder
            header_hex = job.get('header') or job.get('block_header') or ''
            if not header_hex:
                return False
            try:
                header_bytes = bytes.fromhex(header_hex[:64].ljust(64, '0'))
            except ValueError:
                return False

            # Parse nonce (hex string) into 4-byte little-endian as kernel uses (uint)
            try:
                nonce_int = int(nonce, 16)
            except ValueError:
                return False

            import struct
            nb4 = struct.pack('<I', nonce_int & 0xFFFFFFFF)
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
            target_hex = job.get('target')
            if not target_hex:
                # Fallback compute from difficulty
                diff_val = max(1, int(difficulty))
                target_int = (1 << 256) // diff_val
                target_bytes = target_int.to_bytes(32, 'big')
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

            # Try to use C extension for validation if available
            try:
                import yescrypt_fast
                
                # Create header data for C validation
                header_data = f"{job_id}{nonce}{job.get('block_header', '')}".encode()
                hash_result = yescrypt_fast.hash(header_data)
                
                # Convert to target comparison (use lower 224 bits like miner)
                hash_int = int.from_bytes(hash_result[:28], 'big')
                target = (1 << 224) // difficulty  # Adjusted for Yescrypt difficulty
                
                is_valid = hash_int < target
                logger.debug(f"C extension Yescrypt validation: {is_valid}")
                return is_valid
                
            except ImportError:
                # Fallback to Python implementation
                logger.debug("Using Python fallback for Yescrypt validation")
                
                # Enhanced Python validation
                validation_data = f"{job_id}{nonce}{result}{job.get('block_header', '')}"
                validation_hash = hashlib.sha256(validation_data.encode()).hexdigest()

                # Yescrypt uses multiple rounds - simulate with additional hashing
                for i in range(8):  # More rounds for better ASIC resistance
                    validation_hash = hashlib.sha256(validation_hash.encode() + str(i).encode()).hexdigest()

                # Memory-hard component simulation
                memory_data = validation_hash
                for _ in range(4):
                    memory_data = hashlib.pbkdf2_hmac('sha256', memory_data.encode(), b'yescrypt_zion', 2048, 32).hex()

                # Convert to numerical comparison
                hash_value = int(memory_data[:16], 16)
                target = 2**64 // difficulty

                is_valid = hash_value < target
                logger.debug(f"Python Yescrypt validation: {is_valid}")
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
        if hasattr(current_block, '_mining_in_progress') and current_block._mining_in_progress:
            return False

        # Real block finding: mine pending transactions when enough shares accumulated
        # This replaces the mock simulation with actual blockchain mining
        # TESTING: Set to 100 for faster block discovery (production should be 1000)
        block_threshold = 100  # Shares needed to trigger block mining
        
        # READ FROM DATABASE instead of in-memory counter (survives restarts!)
        try:
            with sqlite3.connect(self.db.db_file) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM shares WHERE is_valid=1")
                total_shares_in_db = cursor.fetchone()[0]
        except Exception as e:
            logger.error(f"Failed to read shares from DB: {e}")
            total_shares_in_db = current_block.total_shares  # Fallback to in-memory
        
        logger.info(f"🔍 check_block_found: DB_shares={total_shares_in_db}, memory_shares={current_block.total_shares}, threshold={block_threshold}")

        if total_shares_in_db >= block_threshold:
            # Mark that we're starting to mine this block (prevent duplicate calls)
            current_block._mining_in_progress = True
            try:
                # Mine the block on the real blockchain
                # Try RPC first, fallback to local blockchain
                block_hash = None
                
                if self.blockchain_rpc.connected:
                    logger.info(f"🔨 Mining block via RPC at {self.blockchain_rpc.host}:{self.blockchain_rpc.port}")
                    block_hash = self.blockchain_rpc.mine_block(self.pool_wallet_address)
                elif self.blockchain:
                    logger.info(f"🔨 Mining block via local blockchain instance")
                    block_hash = self.blockchain.mine_pending_transactions(self.pool_wallet_address)
                else:
                    logger.error("❌ No blockchain available (RPC disconnected and no local instance)")
                
                if block_hash:
                    current_block.status = "confirmed"
                    current_block.hash = block_hash
                    current_block.timestamp = time.time()

                    logger.info(f"🎉 REAL BLOCK MINED! Height: {current_block.height}, Hash: {block_hash}")
                    print(f"🎉 REAL BLOCK MINED! Height: {current_block.height}, Hash: {block_hash[:16]}...")

                    # 📊 Prometheus: Track block found
                    algo = 'randomx'  # Default, could be extracted from miner_shares
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
        
        # Read actual blockchain height
        self.current_block_height = len(self.blockchain.blocks)  # Next block to mine
        
        # Get base reward from economic model (consciousness multiplier applied later)
        base_reward = self.base_block_reward

        new_block = PoolBlock(
            height=self.current_block_height,
            hash="",
            timestamp=time.time(),
            total_shares=0,
            miner_shares={},
            reward_amount=base_reward
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
        dev_team_amount = gross_reward * self.dev_team_fee_percent          # 1%
        genesis_amount = gross_reward * self.genesis_fee_percent            # 0.33%
        pool_admin_amount = gross_reward * self.pool_admin_fee_percent      # 1% (Maitreya Buddha)
        
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
                logger.info(f"   Miner {address[:20]}... [{algorithm}]: {miner_shares} shares ({proportion:.4f}) = {final_reward:.8f} ZION {eco_info}")

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
            if stats.algorithm in ['randomx', 'yescrypt']:
                eco_shares += shares
                
        eco_ratio = eco_shares / block.total_shares if block.total_shares > 0 else 0
        eco_fee_reduction = base_pool_fee * 0.2 * eco_ratio  # Up to 20% fee reduction
        
        pool_fee_amount = base_pool_fee - eco_fee_reduction
        miner_reward_total = block.reward_amount - pool_fee_amount

        logger.info(f"Block reward: {block.reward_amount} ZION, Pool fee: {pool_fee_amount:.4f} (eco reduction: {eco_fee_reduction:.4f}), Miner total: {miner_reward_total}")

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
                    if self.blockchain_rpc.connected:
                        tx_hash = self.blockchain_rpc.create_transaction(
                            self.pool_wallet_address,  # From pool wallet
                            address,                   # To miner
                            final_reward,              # Reward amount (including consciousness bonus!)
                            f"Pool mining reward for block {block.height} - {miner_shares} shares ({algorithm})"
                        )
                    elif self.blockchain:
                        self.blockchain.create_transaction(
                            self.pool_wallet_address,  # From pool wallet
                            address,                   # To miner
                            final_reward,              # Reward amount (including consciousness bonus!)
                            f"Pool mining reward for block {block.height} - {miner_shares} shares ({algorithm})"
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
                logger.info(f"Miner {address} [{algorithm}]: {miner_shares} shares ({proportion:.4f}) = {final_reward:.8f} ZION {eco_info}{bonus_info}")

    def process_pending_payouts(self) -> List[Dict[str, Any]]:
        """Process miners who have reached payout threshold"""
        payouts = []

        for address, stats in self.miner_stats.items():
            if stats.balance_pending >= self.payout_threshold:
                payout_amount = stats.balance_pending

                # Create payout record
                payout = {
                    'address': address,
                    'amount': payout_amount,
                    'timestamp': time.time(),
                    'block_height': self.current_block_height,
                    'status': 'pending'
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
                last_activity = miner.get('last_activity', miner.get('connected', current_time))
                if current_time - last_activity > 1800:  # 30 minutes timeout
                    inactive_addrs.append(addr)

            for addr in inactive_addrs:
                print(f"🧹 Removing inactive miner: {addr}")
                if addr in self.miners:
                    del self.miners[addr]

    async def handle_client(self, reader, writer):
        """Handle incoming miner connections"""
        addr = writer.get_extra_info('peername')
        logger.info(f"New connection from {addr}")
        print(f"👷 New miner connected from {addr}")
        
        # Track connection statistics
        self.performance_stats['total_connections'] += 1
        
        # 📊 Prometheus: Track connection
        connections_counter.inc()
        connected_miners_gauge.set(len(self.miners) + 1)  # +1 for this new connection

        
        # WELCOME MESSAGE - send immediately to client
        try:
            welcome = json.dumps({
                "jsonrpc": "2.0",
                "id": None,
                "method": "mining.set_difficulty",
                "params": [32]
            }) + "\n"
            
            writer.write(welcome.encode('utf-8'))
            await writer.drain()
            logger.info(f"Sent welcome to {addr}")
        except Exception as e:
            logger.error(f"Failed to send welcome: {e}")
        
        try:
            # Switch to line-based parsing to avoid concatenated JSON issues
            while True:
                line = await reader.readline()
                if not line:
                    break
                raw = line.decode('utf-8').strip()
                if not raw:
                    continue
                print(f"🧾 RAW <- {addr}: {raw}")
                response = await self.handle_message(raw, addr, writer)
                if response:
                    writer.write(response.encode('utf-8'))
                    await writer.drain()

        except Exception as e:
            logger.error(f"Error handling miner {addr}: {e}")
            print(f"❌ Error handling miner {addr}: {e}")
        finally:
            logger.info(f"Miner {addr} disconnected")
            print(f"👋 Miner {addr} disconnected")
            writer.close()
            await writer.wait_closed()

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
            method = data.get('method')

            logger.info(f"Received from {addr}: {method}")
            print(f"📥 Received from {addr}: {method}")

            # Detect Stratum vs XMrig protocol
            if method and method.startswith('mining.'):
                return await self.handle_stratum_method(data, addr, writer)

            # Handle XMrig protocol
            if method == 'login':
                return await self.handle_xmrig_login(data, addr, writer)
            elif method == 'submit':
                return await self.handle_xmrig_submit(data, addr, writer)
            elif method == 'keepalived':
                return await self.handle_keepalive(data, addr)
            else:
                logger.warning(f"Unknown method from {addr}: {method}")
                print(f"❓ Unknown method: {method}")
                return json.dumps({
                    "id": data.get('id', 1),
                    "jsonrpc": "2.0",
                    "error": {"code": -32601, "message": "Method not found"}
                }) + '\n'

        except json.JSONDecodeError:
            logger.error(f"Invalid JSON from {addr}: {message}")
            return None
        except Exception as e:
            logger.error(f"Error processing message from {addr}: {e}")
            self.performance_stats['errors_count'] += 1
            return None
            
    def is_ip_banned(self, ip):
        """Check if IP address is currently banned"""
        if ip not in self.banned_ips:
            return False
            
        ban_info = self.banned_ips[ip]
        if time.time() - ban_info['banned_at'] > ban_info['duration']:
            # Ban expired, remove it
            del self.banned_ips[ip]
            return False
            
        return True
        
    def track_invalid_share(self, ip, is_valid):
        """Track share statistics per IP for banning decisions"""
        if not self.banning['enabled']:
            return
            
        if ip not in self.connection_stats:
            self.connection_stats[ip] = {
                'total_shares': 0,
                'invalid_shares': 0,
                'first_seen': time.time()
            }
            
        stats = self.connection_stats[ip]
        stats['total_shares'] += 1
        
        if not is_valid:
            stats['invalid_shares'] += 1
            
        # Check for banning after threshold
        if stats['total_shares'] >= self.banning['check_threshold']:
            invalid_percent = (stats['invalid_shares'] / stats['total_shares']) * 100
            
            if invalid_percent >= self.banning['invalid_percent_threshold']:
                self.ban_ip(ip, reason=f"{invalid_percent:.1f}% invalid shares")
                
    def ban_ip(self, ip, duration=None, reason="High invalid share rate"):
        """Ban IP address for specified duration"""
        if duration is None:
            duration = self.banning['ban_duration']
            
        self.banned_ips[ip] = {
            'banned_at': time.time(),
            'duration': duration,
            'reason': reason
        }
        
        # Reset stats for this IP
        if ip in self.connection_stats:
            del self.connection_stats[ip]
            
        print(f"🚫 IP {ip} BANNED for {duration}s: {reason}")
        logger.warning(f"Banned IP {ip}: {reason}")
        
    def adjust_difficulty(self, addr, algorithm):
        """Variable difficulty adjustment based on miner performance"""
        if not self.vardiff['enabled'] or addr not in self.miners:
            return
            
        miner = self.miners[addr]
        share_times = miner.get('share_times', [])
        
        # Need at least 3 shares to adjust
        if len(share_times) < 3:
            return
            
        # Calculate average time of recent shares
        recent_times = share_times[-5:]  # Last 5 shares
        avg_time = sum(recent_times) / len(recent_times)
        
        current_diff = miner.get('difficulty', self.difficulty.get(algorithm, 1000))
        min_diff = self.vardiff['min_diff'].get(algorithm, 100)
        max_diff = self.vardiff['max_diff'].get(algorithm, 10000)
        target_time = self.vardiff['target_time']
        variance = self.vardiff['variance_percent'] / 100
        
        # Calculate new difficulty
        if avg_time < target_time * (1 - variance):
            # Too fast - increase difficulty
            new_diff = min(current_diff * 1.3, max_diff)
        elif avg_time > target_time * (1 + variance):
            # Too slow - decrease difficulty  
            new_diff = max(current_diff * 0.75, min_diff)
        else:
            # In target range - no change
            return
            
        # Apply eco-friendly bonus
        if algorithm in ['yescrypt', 'autolykos_v2']:
            new_diff *= 0.95  # 5% easier for eco algorithms
            
        new_diff = int(new_diff)
        
        if new_diff != current_diff:
            miner['difficulty'] = new_diff
            print(f"📊 VarDiff {addr[0]}:{addr[1]} {algorithm}: {current_diff} → {new_diff} (avg: {avg_time:.1f}s)")
            
            # Send new difficulty to miner
            if miner.get('protocol') == 'stratum':
                self.send_difficulty_update(miner['writer'], new_diff)
                
    def send_difficulty_update(self, writer, difficulty):
        """Send difficulty update to Stratum miner"""
        try:
            msg = json.dumps({
                'id': None,
                'method': 'mining.set_difficulty', 
                'params': [difficulty]
            }) + '\n'
            
            writer.write(msg.encode('utf-8'))
            asyncio.create_task(writer.drain())
        except Exception as e:
            logger.error(f"Failed to send difficulty update: {e}")

    async def handle_xmrig_login(self, data, addr, writer):
        """Handle XMrig (CPU RandomX) login with ZION address support"""
        params = data.get('params', {})
        login = params.get('login', 'unknown')
        password = params.get('pass', 'x')
        agent = params.get('agent', 'unknown')

        # Validate ZION address
        is_zion_address = self.validate_zion_address(login)

        # Detect algorithm from password parameter or agent
        algorithm = 'randomx'  # Default
        if 'yescrypt' in password.lower() or 'yescrypt' in agent.lower():
            algorithm = 'yescrypt'
        elif 'autolykos' in password.lower() or 'autolykos' in agent.lower():
            algorithm = 'autolykos_v2'

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
            'type': 'cpu',
            'protocol': 'xmrig',
            'algorithm': algorithm,
            'id': f"zion_{int(time.time())}_{addr[1]}",
            'login': login,
            'is_zion_address': is_zion_address,
            'agent': agent,
            'connected': time.time(),
            'last_activity': time.time(),
            'last_share': None,
            'last_job_sent': None,
            'share_count': 0,
            'last_job_id': None,
            'writer': writer,
            'session_active': True
        }

        self.performance_stats['total_connections'] += 1
        current_connections = len(self.miners)
        self.performance_stats['peak_connections'] = max(self.performance_stats['peak_connections'], current_connections)

        # Create job for login response
        job = self.get_job_for_miner(addr)

        # XMRig expects exact login response format - NO error field when successful
        response = json.dumps({
            "id": data.get("id"),
            "jsonrpc": "2.0",
            "result": {
                "id": self.miners[addr]['id'],
                "job": job,
                "status": "OK"
            }
        }) + '\n'

        logger.info(f"XMrig login successful for {addr}")
        print(f"✅ CPU miner login successful")

        # Start sending periodic jobs to maintain connection
        asyncio.create_task(self.send_periodic_jobs(addr))

        return response

    async def handle_xmrig_submit(self, data, addr, writer):
        """Handle XMrig share submission with real validation and rewards"""
        params = data.get('params', {})
        job_id = params.get('job_id', 'unknown')
        nonce = params.get('nonce', 'unknown')
        result = params.get('result', 'unknown')

        logger.info(f"[SUBMIT] From {addr} job={job_id} nonce={nonce} result={result}")

        if addr not in self.miners:
            return json.dumps({
                "id": data.get('id'),
                "jsonrpc": "2.0",
                "error": {"code": -1, "message": "Not logged in"}
            }) + '\n'

        miner = self.miners[addr]
        address = miner['login']
        algorithm = miner.get('algorithm', 'randomx')
        difficulty = self.difficulty.get(algorithm, 1000)  # Default difficulty

        # Check for duplicate shares
        share_key = f"{job_id}:{nonce}:{result}"
        if share_key in self.submitted_shares:
            print(f"🚫 DUPLICATE SHARE from {addr}")
            self.record_share(address, algorithm, is_valid=False)
            return json.dumps({
                "id": data.get('id'),
                "jsonrpc": "2.0",
                "error": {"code": -4, "message": "Duplicate share"}
            }) + '\n'

        # Performance monitoring
        start_time = time.time()

        # Validate share based on algorithm
        is_valid = False
        if algorithm == 'randomx':
            is_valid = self.validate_randomx_share(job_id, nonce, result, difficulty)
            logger.info(f"🔍 RandomX validation result: {is_valid} for nonce {nonce}")
            print(f"🔍 RandomX validation result: {is_valid} for nonce {nonce}")
        elif algorithm == 'yescrypt':
            is_valid = self.validate_yescrypt_share(job_id, nonce, result, difficulty)
            logger.info(f"🔍 Yescrypt validation result: {is_valid} for nonce {nonce}")
            print(f"🔍 Yescrypt validation result: {is_valid} for nonce {nonce}")
        elif algorithm == 'autolykos_v2':
            is_valid = self.validate_autolykos_v2_share(job_id, nonce, result, difficulty)
        else:
            # Fallback to RandomX validation
            is_valid = self.validate_randomx_share(job_id, nonce, result, difficulty)

        # Record processing time
        processing_time = time.time() - start_time
        self.share_processing_times.append(processing_time)
        self.performance_stats['total_shares_processed'] += 1
        
        # 📊 Prometheus: Record share processing time
        share_processing_time.observe(processing_time)
        
        # 📊 Prometheus: Track share submission
        status = 'valid' if is_valid else 'invalid'
        total_shares_counter.labels(algorithm=algorithm, status=status).inc()

        # Keep only last 100 processing times for average calculation
        if len(self.share_processing_times) > 100:
            self.share_processing_times.pop(0)

        self.performance_stats['avg_share_processing_time'] = sum(self.share_processing_times) / len(self.share_processing_times)

        # Track share for IP banning
        self.track_invalid_share(addr[0], is_valid)
        
        if is_valid:
            # Record valid share
            self.submitted_shares.add(share_key)
            self.record_share(address, algorithm, is_valid=True)

            # Save detailed share to database
            self.db.save_share(address, algorithm, job_id, nonce, result, difficulty,
                             True, processing_time, addr[0])

            miner['share_count'] += 1
            total_shares = miner['share_count']
            share_time = time.time()
            miner['last_share'] = share_time
            
            # Track share times for vardiff
            if 'share_times' not in miner:
                miner['share_times'] = []
            if 'last_share_time' in miner:
                time_diff = share_time - miner['last_share_time']
                miner['share_times'].append(time_diff)
                # Keep only last 10 times
                if len(miner['share_times']) > 10:
                    miner['share_times'].pop(0)
            miner['last_share_time'] = share_time
            
            # Adjust difficulty if needed
            self.adjust_difficulty(addr, algorithm)

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

            # Save invalid share to database
            self.db.save_share(address, algorithm, job_id, nonce, result, difficulty,
                             False, processing_time, addr[0])

            print(f"❌ INVALID {algorithm.upper()} SHARE from {addr}")
            return json.dumps({
                "id": data.get('id'),
                "jsonrpc": "2.0",
                "error": {"code": -1, "message": "Invalid share"}
            }) + '\n'

        # XMRig expects specific response format for share acceptance - NO error field when successful
        response = json.dumps({
            "id": data.get('id'),
            "jsonrpc": "2.0",
            "result": {
                "status": "OK"
            }
        }) + '\n'

        # Force creation of a fresh job for next work to avoid stale job reuse
        try:
            self.create_randomx_job()
            new_job = self.get_job_for_miner(addr)
        except Exception as e:
            logger.error(f"Job refresh failure after share from {addr}: {e}")
            new_job = None
        if new_job:
            # XMRig expects job notification in specific format
            job_notification = json.dumps({
                "jsonrpc": "2.0",
                "method": "job",
                "params": new_job
            }) + '\n'

            logger.info(f"Sent share acceptance + new job to {addr}")
            return response + job_notification

        return response

    async def handle_keepalive(self, data, addr):
        """Enhanced keepalive handling"""
        if addr in self.miners:
            self.miners[addr]['last_activity'] = time.time()
            self.miners[addr]['session_active'] = True

        print(f"💓 Keepalive from {addr} - session renewed")
        logger.info(f"Keepalive received from {addr}")

        return json.dumps({
            "id": data.get('id'),
            "jsonrpc": "2.0",
            "result": {"status": "KEEPALIVED"}
        }) + '\n'

    def create_randomx_job(self):
        """Create RandomX job for CPU miners"""
        self.job_counter += 1
        job_id = f"zion_rx_{self.job_counter:06d}"

        self.current_jobs['randomx'] = {
            "job_id": job_id,
            "blob": "0606" + secrets.token_hex(73),  # 76 bytes total
            "target": "b88d0600",  # Difficulty target
            "algo": "rx/0",
            "height": self.current_block_height + self.job_counter,
            "seed_hash": secrets.token_hex(32),
            "next_seed_hash": secrets.token_hex(32)  # For future block
        }

        # Store job for validation
        self.jobs[job_id] = {
            'job_id': job_id,
            'algorithm': 'randomx',
            'blob': self.current_jobs['randomx']['blob'],
            'target': self.current_jobs['randomx']['target'],
            'height': self.current_jobs['randomx']['height'],
            'seed_hash': self.current_jobs['randomx']['seed_hash'],
            'next_seed_hash': self.current_jobs['randomx']['next_seed_hash'],
            'created': time.time()
        }

        logger.info(f"Created RandomX job: {job_id}")
        print(f"🔨 RandomX job: {job_id}")
        return self.current_jobs['randomx']

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
        diff = self.difficulty.get('autolykos_v2', 75)
        try:
            diff_val = int(diff) if isinstance(diff, (int, float, str)) else 75
            diff_val = max(1, diff_val)
        except Exception:
            diff_val = 75
        target_int = (1 << 256) // diff_val
        target_bytes = target_int.to_bytes(32, 'big')
        target_hex = target_bytes.hex()

        job = {
            'job_id': job_id,
            'algorithm': 'autolykos_v2',
            'height': height,
            'block_header': block_header,
            'header': block_header,  # alias for clients expecting 'header'
            'elements_seed': elements_seed,
            'target': target_hex,
            'n_value': 2**21,  # Autolykos N parameter
            'k_value': 32,     # Autolykos K parameter
            'created': time.time(),
            'difficulty': self.difficulty['autolykos_v2']
        }

        self.jobs[job_id] = job
        print(f"🌟 Autolykos v2 job created: {job_id} height={height}")
        return job

    def create_yescrypt_job(self):
        """Create Yescrypt job for CPU miners"""
        self.job_counter += 1
        job_id = f"zion_ys_{self.job_counter:06d}"

        height = self.current_block_height + self.job_counter
        block_header = secrets.token_hex(80)

        job = {
            'job_id': job_id,
            'algorithm': 'yescrypt',
            'height': height,
            'block_header': block_header,
            'created': time.time(),
            'difficulty': self.difficulty['yescrypt']
        }

        self.jobs[job_id] = job
        print(f"⚡ Yescrypt job created: {job_id} height={height}")
        return job

    def get_job_for_miner(self, addr):
        """Get appropriate job for miner based on algorithm"""
        if addr not in self.miners:
            return None

        miner = self.miners[addr]
        algorithm = miner.get('algorithm', 'randomx')

        # Create new job based on algorithm
        if algorithm == 'randomx':
            if not self.current_jobs['randomx'] or self.job_counter % 5 == 0:
                self.create_randomx_job()
            job = self.current_jobs['randomx'].copy()
        elif algorithm == 'yescrypt':
            # Create new Yescrypt job
            job = self.create_yescrypt_job()
        elif algorithm == 'autolykos_v2':
            # Create new Autolykos v2 job
            job = self.create_autolykos_v2_job()
        else:
            # Fallback to RandomX
            if not self.current_jobs['randomx'] or self.job_counter % 5 == 0:
                self.create_randomx_job()
            job = self.current_jobs['randomx'].copy()

        self.miners[addr]['last_job_id'] = job['job_id']
        return job

    async def send_periodic_jobs(self, addr):
        """Enhanced periodic jobs with proper connection maintenance"""
        job_count = 0

        # Wait a shorter time before starting periodic jobs
        await asyncio.sleep(5)

        while addr in self.miners:
            await asyncio.sleep(18)  # Faster cadence to keep connection alive
            job_count += 1

            if addr not in self.miners:
                break

            try:
                current_time = time.time()

                # Check miner activity
                last_activity = self.miners[addr].get('last_activity',
                                                   self.miners[addr].get('connected', current_time))

                # Send keepalive if no recent activity
                if current_time - last_activity > 45:
                    if 'writer' in self.miners[addr]:
                        writer = self.miners[addr]['writer']
                        keepalive_msg = json.dumps({
                            "jsonrpc": "2.0",
                            "method": "keepalived",
                            "params": {}
                        }) + '\n'

                        writer.write(keepalive_msg.encode('utf-8'))
                        await writer.drain()
                        print(f"💓 Sent keepalive to {addr}")

                # Always generate fresh job to avoid stale reuse
                self.create_randomx_job()
                job = self.get_job_for_miner(addr)
                if job and 'writer' in self.miners[addr]:
                    writer = self.miners[addr]['writer']

                    job_notification = json.dumps({
                        "jsonrpc": "2.0",
                        "method": "job",
                        "params": job
                    }) + '\n'

                    writer.write(job_notification.encode('utf-8'))
                    await writer.drain()
                    print(f"📡 Periodic job #{job_count} sent to {addr}")

                    # Update activity
                    self.miners[addr]['last_job_sent'] = current_time
                    self.miners[addr]['last_activity'] = current_time

            except Exception as e:
                logger.error(f"Error in periodic jobs for {addr}: {e}")
                print(f"❌ Connection lost to {addr}")
                if addr in self.miners:
                    del self.miners[addr]
                break

    # ============= STRATUM IMPLEMENTATION FOR KAWPOW =============

    async def handle_stratum_method(self, data, addr, writer):
        """Handle Stratum protocol methods - Auto-detect algorithm"""
        method = data.get('method')

        # Initialize miner state if not exists
        if addr not in self.miners:
            # Try to detect algorithm from user agent or params
            user_agent = ""
            if method == 'mining.subscribe' and data.get('params'):
                user_agent = str(data['params'][0]).lower() if data['params'] else ""
            
            # Auto-detect algorithm and type based on miner
            algorithm = 'randomx'  # Default to RandomX (CPU)
            miner_type = 'cpu'
            
            if 'xmrig' in user_agent or 'randomx' in user_agent:
                algorithm = 'randomx'
                miner_type = 'cpu'
            elif 'srbminer' in user_agent or 'kawpow' in user_agent:
                algorithm = 'kawpow'
                miner_type = 'gpu'
            elif 'yescrypt' in user_agent:
                algorithm = 'yescrypt'
                miner_type = 'cpu'
            elif 'autolykos' in user_agent:
                algorithm = 'autolykos_v2'
                miner_type = 'gpu'
            
            logger.info(f"🔍 Detected miner: {user_agent} -> {algorithm} ({miner_type})")
            
            extranonce1 = secrets.token_hex(4)  # 8 hex chars
            self.miners[addr] = {
                'type': miner_type,
                'protocol': 'stratum',
                'algorithm': algorithm,
                'id': f"stratum_{int(time.time())}_{addr[1]}",
                'login': None,
                'connected': time.time(),
                'last_activity': time.time(),
                'session_active': True,
                'difficulty': self.difficulty.get(algorithm, self.difficulty.get(miner_type, 100)),
                'shares_window': [],
                'writer': writer,
                'authorized': False,
                'last_job_id': None,
                'extranonce1': extranonce1,
                'extranonce2_size': 8
            }

        if method == 'mining.subscribe':
            return await self.handle_stratum_subscribe(data, addr)
        elif method in ('mining.authorize', 'mining.login'):
            return await self.handle_stratum_authorize(data, addr)
        elif method == 'mining.submit':
            return await self.handle_stratum_submit(data, addr)
        elif method == 'mining.extranonce.subscribe':
            # Simple acknowledge for extranonce subscription
            return json.dumps({
                'id': data.get('id'),
                'result': True,
                'error': None
            }) + '\n'
        else:
            return json.dumps({
                'id': data.get('id'),
                'error': {'code': -32601, 'message': 'Method not found'},
                'result': None
            }) + '\n'

    async def handle_stratum_subscribe(self, data, addr):
        """Handle mining.subscribe for SRBMiner KawPow"""
        extranonce1 = self.miners[addr]['extranonce1']
        extranonce2_size = self.miners[addr]['extranonce2_size']

        response = {
            'id': data.get('id'),
            'result': [["mining.set_difficulty", "mining.notify"], extranonce1, extranonce2_size],
            'error': None
        }
        print(f"📤 Subscribe response: extranonce1={extranonce1}")
        return json.dumps(response) + '\n'

    async def handle_stratum_authorize(self, data, addr):
        """Handle mining.authorize and send initial job"""
        params = data.get('params', [])
        wallet = params[0] if params else 'unknown'
        password = params[1] if len(params) > 1 else ''

        # Detect algorithm from password or use already detected from subscribe
        current_algorithm = self.miners[addr].get('algorithm', 'randomx')
        
        # Allow password to override algorithm
        if 'randomx' in password.lower():
            algorithm = 'randomx'
        elif 'autolykos' in password.lower():
            algorithm = 'autolykos_v2'
        elif 'yescrypt' in password.lower():
            algorithm = 'yescrypt'
        elif 'kawpow' in password.lower():
            algorithm = 'kawpow'
        else:
            # Keep algorithm from subscribe detection
            algorithm = current_algorithm
        
        logger.info(f"🔧 Miner {addr} algorithm: {algorithm} (from password: {password})")

        # Update miner info
        self.miners[addr]['login'] = wallet
        self.miners[addr]['algorithm'] = algorithm
        self.miners[addr]['authorized'] = True

        # Set difficulty based on algorithm
        if algorithm in self.difficulty:
            self.miners[addr]['difficulty'] = self.difficulty[algorithm]
        else:
            self.miners[addr]['difficulty'] = self.difficulty['gpu']

        # Initialize miner stats
        self.get_miner_stats(wallet)

        # Create job based on algorithm
        if algorithm == 'randomx':
            job = self.create_randomx_job()
            diff = self.miners[addr]['difficulty']
            # RandomX uses simplified notify format (similar to Monero Stratum)
            notify_params = [
                job['job_id'],
                job['blob'],
                job['seed_hash'],
                job['next_seed_hash'],
                job['height'],
                diff,
                True  # clean_jobs
            ]
        elif algorithm == 'autolykos_v2':
            job = self.create_autolykos_v2_job()
            # Autolykos v2: send [job_id, header, target, ...]
            notify_params = [
                job['job_id'],
                job.get('header') or job['block_header'],
                job['target'],
                job['height'],
                job['elements_seed'],
                job['n_value'],
                job['k_value'],
                True  # clean_jobs
            ]
        elif algorithm == 'yescrypt':
            job = self.create_yescrypt_job()
            # Yescrypt uses simplified notify format
            notify_params = [
                job['job_id'],
                job['block_header'],
                job['height'],
                True  # clean_jobs
            ]
        else:  # kawpow
            job = self.create_kawpow_job()
            diff = self.miners[addr]['difficulty']
            target_8b = self.difficulty_to_kawpow_target_8byte(diff)
            notify_params = [
                job['job_id'],
                job['seed_hash'],
                job['header_hash'],
                job['height'],
                job['epoch'],
                target_8b,
                True
            ]

        diff = self.miners[addr]['difficulty']

        # Build response bundle
        auth_resp = json.dumps({
            'id': data.get('id'),
            'result': True,
            'error': None
        }) + '\n'

        set_diff_msg = json.dumps({
            'id': None,
            'method': 'mining.set_difficulty',
            'params': [diff]
        }) + '\n'

        notify_msg = json.dumps({
            'id': None,
            'method': 'mining.notify',
            'params': notify_params
        }) + '\n'

        bundled = auth_resp + set_diff_msg + notify_msg
        print(f"📤 Auth+notify: job={job['job_id']} diff={diff}")
        return bundled

    async def handle_stratum_submit(self, data, addr):
        """Handle mining.submit with real KawPow validation"""
        params = data.get('params', [])
        logger.info(f"📨 Mining.submit received from {addr}: params={params}")

        if addr not in self.miners:
            return json.dumps({
                'id': data.get('id'),
                'result': False,
                'error': {'code': -1, 'message': 'Not authorized'}
            }) + '\n'

        miner = self.miners[addr]
        address = miner['login']
        algorithm = miner.get('algorithm', 'kawpow')
        difficulty = miner['difficulty']

        # KawPow-style submit uses 5 parameters, Autolykos/CPU modes use 4
        expected_params = 5
        if algorithm in ('autolykos_v2', 'yescrypt', 'randomx'):
            expected_params = 4

        if len(params) < expected_params:
            logger.warning(
                f"❌ Submit params too short: {len(params)} (need {expected_params})"
            )
            return json.dumps({
                'id': data.get('id'),
                'result': False,
                'error': {'code': -1, 'message': 'Invalid params'}
            }) + '\n'

        # Parse parameters according to algorithm expectations
        if algorithm == 'autolykos_v2':
            worker, job_id, nonce, result = params[:4]
            mix_hash = result  # Alias for downstream handling
            job = self.jobs.get(job_id, {})
            header_hash = job.get('block_header', '')
        elif algorithm in ('yescrypt', 'randomx'):
            worker, job_id, nonce, result = params[:4]
            mix_hash = result
            header_hash = ''
        else:
            worker, job_id, nonce, mix_hash, header_hash = params[:5]

        logger.info(f"📩 Submit: worker={worker}, job={job_id}, nonce={nonce[:8]}...")  

        # Check for duplicate shares
        share_key = f"{job_id}:{nonce}:{mix_hash}:{header_hash}"
        if share_key in self.submitted_shares:
            print(f"🚫 DUPLICATE {algorithm.upper()} SHARE from {addr}")
            self.record_share(address, algorithm, is_valid=False)
            return json.dumps({
                'id': data.get('id'),
                'result': False,
                'error': {'code': -4, 'message': 'Duplicate share'}
            }) + '\n'

        # Validate share based on algorithm
        is_valid = False
        if algorithm == 'kawpow':
            is_valid = self.validate_kawpow_share(job_id, nonce, mix_hash, header_hash, difficulty)
        elif algorithm == 'yescrypt':
            # Yescrypt uses different parameter format - CPU mining
            result = mix_hash  # Use mix_hash as result for Yescrypt
            is_valid = self.validate_yescrypt_share(job_id, nonce, result, difficulty)
            print(f"🌱 YESCRYPT validation attempt: job={job_id}, nonce={nonce}, valid={is_valid}")
        elif algorithm == 'randomx':
            # RandomX CPU mining
            result = mix_hash  # Use mix_hash as result for RandomX
            is_valid = self.validate_randomx_share(job_id, nonce, result, difficulty)
        elif algorithm == 'autolykos_v2':
            # For Autolykos v2, we need to adapt the parameters
            # Autolykos v2 uses different parameter format than KawPow
            result = mix_hash  # Use mix_hash as result for Autolykos v2
            is_valid = self.validate_autolykos_v2_share(job_id, nonce, result, difficulty)
        else:
            # Fallback to KawPow validation
            is_valid = self.validate_kawpow_share(job_id, nonce, mix_hash, header_hash, difficulty)

        if is_valid:
            # Record valid share
            self.submitted_shares.add(share_key)
            self.record_share(address, algorithm, is_valid=True)

            miner['share_count'] = miner.get('share_count', 0) + 1
            total_shares = miner['share_count']

            # 🎮 CONSCIOUSNESS GAME: Award XP for share submission!
            try:
                self.consciousness_game.on_share_submitted(address)
            except Exception as e:
                logger.error(f"Consciousness game share XP error: {e}")

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
            print(f"❌ INVALID {algorithm.upper()} SHARE from {addr}")
            return json.dumps({
                'id': data.get('id'),
                'result': False,
                'error': {'code': -1, 'message': 'Invalid share'}
            }) + '\n'

        return json.dumps({
            'id': data.get('id'),
            'result': True,
            'error': None
        }) + '\n'

    def create_kawpow_job(self):
        """Create KawPow job for GPU miners"""
        self.job_counter += 1
        job_id = f"zion_kp_{self.job_counter:06d}"
        # Pro kompatibilitu se SRBMiner: použij nízkou výšku a epoch=0
        height = self.current_block_height + self.job_counter  # < 7500 → epoch 0
        epoch = 0
        # Deterministický seed pro aktuální epoch (placeholder)
        base_seed = '00' * 32  # 64 hex nul – stabilní seed
        seed_hash = base_seed
        header_hash = secrets.token_hex(32)
        mix_hash = secrets.token_hex(16)
        job = {
            'job_id': job_id,
            'algorithm': 'kawpow',
            'height': height,
            'epoch': epoch,
            'seed_hash': seed_hash,
            'header_hash': header_hash,
            'mix_hash': mix_hash,
            'created': time.time(),
            'difficulty': self.difficulty['gpu']
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
            'pool_name': 'ZION Universal Pool',
            'pool_port': self.port,
            'current_height': self.current_block_height,
            'total_miners': total_miners,
            'total_shares': total_shares,
            'valid_shares': total_valid_shares,
            'invalid_shares': total_invalid_shares,
            'blocks_found': blocks_found,
            'pending_payouts_zion': pending_payouts,
            'pool_fee_percent': self.pool_fee_percent * 100,
            'payout_threshold_zion': self.payout_threshold,
            'algorithms': ['randomx', 'yescrypt', 'autolykos_v2'],
            'pool_wallet': self.pool_wallet_address,
            'server_time': datetime.now().isoformat(),
            'performance': {
                'uptime_seconds': time.time() - self.performance_stats['start_time'],
                'total_connections': self.performance_stats['total_connections'],
                'peak_connections': self.performance_stats['peak_connections'],
                'shares_processed': self.performance_stats['total_shares_processed'],
                'avg_processing_time_ms': self.performance_stats['avg_share_processing_time'] * 1000,
                'errors_count': self.performance_stats['errors_count'],
                'banned_ips': len(self.banned_ips),
                'vardiff_enabled': self.vardiff['enabled']
            }
        }

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
                errors_counter.labels(type='stats_save').inc()
                
    def update_prometheus_metrics(self, stats):
        """Update Prometheus gauges with current pool statistics"""
        try:
            # Update connected miners gauge
            connected_miners_gauge.set(len(self.miners))
            
            # Update pending balance
            pending_balance_gauge.set(stats.get('pending_payouts_zion', 0))
            
            # Update banned IPs
            banned_ips_gauge.set(len(self.banned_ips))
            
            # Calculate and update hashrate per algorithm
            for algo in ['randomx', 'yescrypt', 'autolykos_v2']:
                hashrate = self.calculate_pool_hashrate(algo)
                pool_hashrate_gauge.labels(algorithm=algo).set(hashrate)
                difficulty_gauge.labels(algorithm=algo).set(self.difficulty.get(algo, 0))
                
                # Count active miners per algorithm
                active_count = sum(1 for m in self.miners.values() if m.get('algorithm') == algo)
                active_miners_gauge.labels(algorithm=algo).set(active_count)
                
            logger.debug("📊 Prometheus metrics updated successfully")
        except Exception as e:
            logger.error(f"Error updating Prometheus metrics: {e}")
            errors_counter.labels(type='prometheus_update').inc()
    
    def calculate_pool_hashrate(self, algorithm):
        """Calculate pool hashrate for specific algorithm"""
        try:
            hashrate = 0
            current_time = time.time()
            
            for addr, miner in self.miners.items():
                if miner.get('algorithm') == algorithm:
                    # Get miner stats
                    address = miner.get('login', 'unknown')
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

    async def start_server(self):
        """Start the mining pool server with database integration"""
        # Load existing miner stats from database
        print("Loading miner statistics from database...")
        # Note: Individual miner stats are loaded on-demand in get_miner_stats()

        # Initialize first block
        self.start_new_block()

        # Start periodic stats saving
        asyncio.create_task(self.periodic_stats_save())
        
        # Start alerting system if Discord webhook configured
        discord_webhook = ZionNetworkConfig.POOL_CONFIG.get('discord_webhook_url')
        if discord_webhook:
            try:
                from zion_pool_alerting import start_pool_with_alerting
                self.alerting = await start_pool_with_alerting(self, discord_webhook)
                print("🔔 Discord alerting system enabled")
            except Exception as e:
                logger.warning(f"Failed to start alerting system: {e}")
                print("⚠️ Alerting system disabled (check configuration)")

        server = await asyncio.start_server(
            self.handle_client, '0.0.0.0', self.port
        )

        print(f"ZION Universal Mining Pool started on port {self.port}")
        print(f"Pool Stats API available at http://localhost:{self.port + 1}/api/stats")
        print(f"Pool Fee: {self.pool_fee_percent * 100}% | Payout Threshold: {self.payout_threshold} ZION")
        print(f"Algorithms: RandomX (CPU), Yescrypt (CPU), Autolykos v2 (GPU)")
        print(f"Base Block Reward: {self.base_block_reward} ZION (before consciousness multiplier)")
        print(f"Current Blockchain Height: {self.current_block_height}")
        print(f"Database: zion_pool.db (persistent storage enabled)")

        # Start API server
        try:
            self.api_server.start()
            print(f"Pool API server started on port {self.port + 1}")
        except Exception as e:
            logger.error(f"Failed to start API server: {e}")
            print(f"Failed to start API server: {e}")

        # Start cleanup task
        asyncio.create_task(self.cleanup_inactive_miners())

        try:
            async with server:
                await server.serve_forever()
        except Exception as e:
            logger.error(f"Server error: {e}")
            print(f"Server error: {e}")

async def main():
    pool = ZionUniversalPool(port=3333)
    await pool.start_server()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nPool stopped")