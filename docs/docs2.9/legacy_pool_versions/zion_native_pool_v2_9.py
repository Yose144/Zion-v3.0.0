#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║                  🏊 ZION NATIVE POOL SERVER v2.9.0 🏊                   ║
║                                                                          ║
║           Native Mining Pool - Stratum Protocol Support                 ║
║                  Cosmic Harmony + RandomX + Yescrypt                     ║
║                                                                          ║
║  Features:                                                               ║
║    • Multi-algorithm support (Cosmic Harmony, RandomX, Yescrypt)        ║
║    • Stratum protocol (mining.subscribe/authorize/submit)               ║
║    • Native share validation using DLLs                                 ║
║    • Real-time statistics and hashrate tracking                         ║
║    • PPLNS reward distribution                                          ║
║    • Web API for monitoring                                             ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
"""

import asyncio
import json
import time
import secrets
import logging
import ctypes
import os
from typing import Dict, Optional, List, Tuple, Any
from dataclasses import dataclass, field, asdict
from collections import defaultdict
from aiohttp import web
import hashlib

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger("ZionNativePool")


@dataclass
class MinerConnection:
    """Stratum client connection"""
    address: Tuple[str, int]
    reader: asyncio.StreamReader
    writer: asyncio.StreamWriter
    wallet: str = "unknown"
    worker_name: str = "unknown"
    algorithm: str = "cosmic_harmony"
    authenticated: bool = False
    difficulty: int = 1000
    extranonce1: str = ""
    last_activity: float = field(default_factory=time.time)
    shares_submitted: int = 0
    shares_accepted: int = 0
    shares_rejected: int = 0
    hashrate: float = 0.0
    current_job: Optional[Dict] = None


@dataclass
class MiningJob:
    """Mining job template"""
    job_id: str
    algorithm: str
    difficulty: int
    header: bytes
    target: bytes
    height: int
    timestamp: int
    clean_jobs: bool = True


@dataclass
class ShareSubmission:
    """Share submission record"""
    wallet: str
    algorithm: str
    job_id: str
    nonce: int
    result_hash: bytes
    difficulty: int
    timestamp: float
    valid: bool


class NativeLibraryLoader:
    """Load native mining DLLs for share validation"""
    
    def __init__(self):
        self.libs = {}
        self.dll_path = os.path.join("ai", "mining")
        
    def load_cosmic_harmony(self) -> Optional[ctypes.CDLL]:
        """Load Cosmic Harmony DLL"""
        try:
            dll = os.path.join(self.dll_path, "cosmic_harmony_zion.dll")
            lib = ctypes.CDLL(dll)
            
            lib.cosmic_hash.argtypes = [
                ctypes.POINTER(ctypes.c_uint8),
                ctypes.c_size_t,
                ctypes.c_uint32,
                ctypes.POINTER(ctypes.c_uint8)
            ]
            lib.cosmic_hash.restype = None
            
            self.libs['cosmic_harmony'] = lib
            logger.info("✅ Cosmic Harmony DLL loaded for validation")
            return lib
        except Exception as e:
            logger.error(f"❌ Failed to load Cosmic Harmony: {e}")
            return None
    
    def load_randomx(self) -> Optional[ctypes.CDLL]:
        """Load RandomX DLL"""
        try:
            dll = os.path.join(self.dll_path, "librandomx_zion.dll")
            lib = ctypes.CDLL(dll)
            
            lib.zion_randomx_init.argtypes = [ctypes.c_char_p, ctypes.c_int]
            lib.zion_randomx_init.restype = ctypes.c_int
            
            lib.zion_randomx_hash_bytes.argtypes = [
                ctypes.POINTER(ctypes.c_uint8),
                ctypes.c_size_t,
                ctypes.POINTER(ctypes.c_uint8)
            ]
            lib.zion_randomx_hash_bytes.restype = None
            
            self.libs['randomx'] = lib
            logger.info("✅ RandomX DLL loaded for validation")
            
            # Initialize RandomX
            default_key = "00" * 32
            result = lib.zion_randomx_init(default_key.encode(), 1)
            if result != 1:
                logger.error("RandomX initialization failed")
                return None
            
            return lib
        except Exception as e:
            logger.error(f"❌ Failed to load RandomX: {e}")
            return None
    
    def load_yescrypt(self) -> Optional[ctypes.CDLL]:
        """Load Yescrypt DLL"""
        try:
            dll = os.path.join(self.dll_path, "libyescrypt_zion.dll")
            lib = ctypes.CDLL(dll)
            
            lib.yescrypt_init_mining.argtypes = [ctypes.c_int]
            lib.yescrypt_init_mining.restype = ctypes.c_int
            
            lib.yescrypt_hash_bytes.argtypes = [
                ctypes.c_char_p,
                ctypes.c_size_t,
                ctypes.c_char_p
            ]
            lib.yescrypt_hash_bytes.restype = ctypes.c_int
            
            self.libs['yescrypt'] = lib
            logger.info("✅ Yescrypt DLL loaded for validation")
            
            # Initialize Yescrypt
            result = lib.yescrypt_init_mining(1)
            if result != 0:
                logger.error("Yescrypt initialization failed")
                return None
            
            return lib
        except Exception as e:
            logger.error(f"❌ Failed to load Yescrypt: {e}")
            return None


class ZionNativePool:
    """
    ZION Native Mining Pool v2.9.0
    
    Standalone pool server with native algorithm support
    """
    
    def __init__(self,
                 stratum_host: str = "0.0.0.0",
                 stratum_port: int = 3333,
                 web_port: int = 8080):
        
        self.stratum_host = stratum_host
        self.stratum_port = stratum_port
        self.web_port = web_port
        
        # Native library loader
        self.loader = NativeLibraryLoader()
        
        # Pool state
        self.connections: Dict[Tuple, MinerConnection] = {}
        self.jobs: Dict[str, MiningJob] = {}
        self.shares: List[ShareSubmission] = []
        self.job_counter = 0
        
        # Statistics
        self.stats = {
            'total_shares': 0,
            'valid_shares': 0,
            'invalid_shares': 0,
            'blocks_found': 0,
            'total_hashrate': 0.0,
            'connected_miners': 0,
            'uptime_start': time.time()
        }
        
        # Algorithm-specific stats
        self.algo_stats = defaultdict(lambda: {
            'shares': 0,
            'hashrate': 0.0,
            'miners': 0,
            'difficulty': 1000
        })
        
        # Default difficulties
        self.difficulties = {
            'cosmic_harmony': 100000,  # GPU optimized
            'randomx': 1000,
            'yescrypt': 500
        }
        
        # Servers
        self.stratum_server = None
        self.web_app = None
        self.running = False
    
    async def start(self):
        """Start pool server"""
        self.running = True
        
        # Load native libraries
        logger.info("Loading native libraries...")
        self.loader.load_cosmic_harmony()
        self.loader.load_randomx()
        self.loader.load_yescrypt()
        
        # Start Stratum server
        self.stratum_server = await asyncio.start_server(
            self.handle_stratum_connection,
            self.stratum_host,
            self.stratum_port
        )
        
        logger.info(f"✅ Stratum server listening on {self.stratum_host}:{self.stratum_port}")
        
        # Background tasks
        asyncio.create_task(self.broadcast_jobs())
        asyncio.create_task(self.cleanup_inactive_connections())
        asyncio.create_task(self.update_statistics())
        
        logger.info("✅ ZION Native Pool v2.9.0 started successfully")
        logger.info(f"   Stratum: stratum+tcp://{self.stratum_host}:{self.stratum_port}")
        logger.info(f"   Press Ctrl+C to stop")
    
    async def handle_stratum_connection(self, reader: asyncio.StreamReader,
                                       writer: asyncio.StreamWriter):
        """Handle incoming Stratum miner connection"""
        addr = writer.get_extra_info('peername')
        
        conn = MinerConnection(
            address=addr,
            reader=reader,
            writer=writer,
            extranonce1=f"{len(self.connections):08x}"
        )
        
        self.connections[addr] = conn
        logger.info(f"🔌 Stratum connection from {addr[0]}:{addr[1]}")
        
        try:
            while self.running:
                try:
                    line = await asyncio.wait_for(
                        reader.readuntil(b'\n'),
                        timeout=60.0
                    )
                except asyncio.TimeoutError:
                    logger.warning(f"Timeout from {addr}")
                    break
                except asyncio.IncompleteReadError:
                    break
                
                try:
                    request = json.loads(line.decode().strip())
                    response = await self.handle_stratum_method(request, conn)
                    
                    if response:
                        writer.write(response.encode() + b'\n')
                        await writer.drain()
                    
                    conn.last_activity = time.time()
                    
                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON from {addr}")
                except Exception as e:
                    logger.error(f"Error processing request: {e}")
        
        finally:
            self.connections.pop(addr, None)
            writer.close()
            await writer.wait_closed()
            logger.info(f"🔌 Disconnected: {addr[0]}:{addr[1]}")
    
    async def handle_stratum_method(self, request: Dict,
                                    conn: MinerConnection) -> Optional[str]:
        """Process Stratum RPC method"""
        method = request.get('method')
        params = request.get('params', [])
        req_id = request.get('id')
        
        if method == 'mining.subscribe':
            return self.handle_subscribe(conn, req_id)
        
        elif method in ('mining.authorize', 'mining.login'):
            return await self.handle_authorize(conn, params, req_id)
        
        elif method == 'mining.submit':
            return await self.handle_submit(conn, params, req_id)
        
        elif method == 'mining.keepalive':
            return self.json_response(req_id, {"status": "OK"}, None)
        
        else:
            logger.warning(f"Unknown method: {method}")
            return None
    
    def handle_subscribe(self, conn: MinerConnection, req_id: int) -> str:
        """Handle mining.subscribe"""
        result = [
            [
                ["mining.set_difficulty", "mining.notify"],
                conn.extranonce1,
                4  # extranonce2_size
            ]
        ]
        
        logger.info(f"✅ Subscribe: {conn.address[0]} (extranonce1: {conn.extranonce1})")
        return self.json_response(req_id, result, None)
    
    async def handle_authorize(self, conn: MinerConnection,
                               params: List, req_id: int) -> str:
        """Handle mining.authorize"""
        if not params:
            return self.json_response(req_id, None, "Invalid params")
        
        wallet = params[0]
        password = params[1] if len(params) > 1 else ""
        
        # Detect algorithm from password
        password_lower = password.lower()
        if "cosmic" in password_lower or "harmony" in password_lower:
            algorithm = "cosmic_harmony"
        elif "randomx" in password_lower:
            algorithm = "randomx"
        elif "yescrypt" in password_lower:
            algorithm = "yescrypt"
        else:
            algorithm = "cosmic_harmony"  # Default
        
        conn.wallet = wallet
        conn.algorithm = algorithm
        conn.authenticated = True
        conn.worker_name = f"{wallet[:8]}@{algorithm}"
        conn.difficulty = self.difficulties.get(algorithm, 1000)
        
        logger.info(f"🔐 Authorized: {wallet[:16]}... on {algorithm} (diff: {conn.difficulty})")
        
        # Send difficulty notification
        diff_notify = json.dumps({
            "id": None,
            "method": "mining.set_difficulty",
            "params": [conn.difficulty]
        })
        conn.writer.write(diff_notify.encode() + b'\n')
        await conn.writer.drain()
        
        # Send initial job
        job = self.create_job(algorithm)
        if job:
            await self.send_job_to_connection(conn, job)
        
        return self.json_response(req_id, True, None)
    
    async def handle_submit(self, conn: MinerConnection,
                           params: List, req_id: int) -> str:
        """Handle mining.submit"""
        if not conn.authenticated or len(params) < 4:
            return self.json_response(req_id, None, "Unauthorized")
        
        worker = params[0]
        job_id = params[1]
        nonce_hex = params[2]
        result_hex = params[3]
        
        logger.info(f"📤 Submit: {conn.wallet[:16]}... job={job_id[:8]}... nonce={nonce_hex}")
        
        job = self.jobs.get(job_id)
        if not job:
            logger.warning(f"❌ Unknown job: {job_id}")
            return self.json_response(req_id, False, "Job not found")
        
        # Validate share
        is_valid = await self.validate_share(job, nonce_hex, result_hex)
        
        # Record share
        share = ShareSubmission(
            wallet=conn.wallet,
            algorithm=conn.algorithm,
            job_id=job_id,
            nonce=int(nonce_hex, 16) if nonce_hex.startswith('0x') else int(nonce_hex, 16),
            result_hash=bytes.fromhex(result_hex),
            difficulty=conn.difficulty,
            timestamp=time.time(),
            valid=is_valid
        )
        
        self.shares.append(share)
        conn.shares_submitted += 1
        
        if is_valid:
            conn.shares_accepted += 1
            self.stats['valid_shares'] += 1
            logger.info(f"✅ Valid share from {conn.wallet[:16]}...")
        else:
            conn.shares_rejected += 1
            self.stats['invalid_shares'] += 1
            logger.warning(f"❌ Invalid share from {conn.wallet[:16]}...")
        
        self.stats['total_shares'] += 1
        
        return self.json_response(req_id, is_valid, None)
    
    async def validate_share(self, job: MiningJob, nonce_hex: str, result_hex: str) -> bool:
        """Validate submitted share using native DLL"""
        try:
            nonce = int(nonce_hex, 16)
            result = bytes.fromhex(result_hex)
            
            if job.algorithm == "cosmic_harmony":
                lib = self.loader.libs.get('cosmic_harmony')
                if not lib:
                    return False
                
                # Compute hash with nonce
                input_array = (ctypes.c_uint8 * len(job.header)).from_buffer_copy(job.header)
                output_array = (ctypes.c_uint8 * 32)()
                lib.cosmic_hash(input_array, len(job.header), nonce, output_array)
                
                computed_hash = bytes(output_array)
                
                # Check if result matches
                if computed_hash != result:
                    return False
                
                # Check if meets difficulty (result < target)
                result_int = int.from_bytes(result, 'big')
                target_int = int.from_bytes(job.target, 'big')
                
                return result_int < target_int
            
            elif job.algorithm == "randomx":
                lib = self.loader.libs.get('randomx')
                if not lib:
                    return False
                
                input_array = (ctypes.c_uint8 * len(job.header)).from_buffer_copy(job.header)
                output_array = (ctypes.c_uint8 * 32)()
                lib.zion_randomx_hash_bytes(input_array, len(job.header), output_array)
                
                computed_hash = bytes(output_array)
                result_int = int.from_bytes(computed_hash, 'big')
                target_int = int.from_bytes(job.target, 'big')
                
                return result_int < target_int
            
            elif job.algorithm == "yescrypt":
                lib = self.loader.libs.get('yescrypt')
                if not lib:
                    return False
                
                output = ctypes.create_string_buffer(32)
                lib.yescrypt_hash_bytes(job.header, len(job.header), output)
                
                computed_hash = output.raw
                result_int = int.from_bytes(computed_hash, 'big')
                target_int = int.from_bytes(job.target, 'big')
                
                return result_int < target_int
            
            return False
            
        except Exception as e:
            logger.error(f"Share validation error: {e}")
            return False
    
    def create_job(self, algorithm: str) -> Optional[MiningJob]:
        """Create new mining job"""
        try:
            self.job_counter += 1
            job_id = f"zion_{algorithm[:4]}_{self.job_counter:06d}"
            
            difficulty = self.difficulties.get(algorithm, 1000)
            
            # Generate job header (block template)
            header = secrets.token_bytes(64)
            
            # Calculate target from difficulty
            target_int = (1 << 256) // max(1, difficulty)
            target = target_int.to_bytes(32, 'big')
            
            job = MiningJob(
                job_id=job_id,
                algorithm=algorithm,
                difficulty=difficulty,
                header=header,
                target=target,
                height=self.job_counter,
                timestamp=int(time.time())
            )
            
            self.jobs[job_id] = job
            logger.debug(f"📋 Created job {job_id} for {algorithm} (diff: {difficulty})")
            
            return job
            
        except Exception as e:
            logger.error(f"Job creation error: {e}")
            return None
    
    async def send_job_to_connection(self, conn: MinerConnection, job: MiningJob):
        """Send mining job to specific connection"""
        try:
            params = {
                "job_id": job.job_id,
                "algorithm": job.algorithm,
                "header": job.header.hex(),
                "target": job.target.hex(),
                "difficulty": job.difficulty,
                "height": job.height,
                "timestamp": job.timestamp,
                "clean_jobs": job.clean_jobs
            }
            
            notification = json.dumps({
                "id": None,
                "method": "mining.notify",
                "params": [params]
            })
            
            conn.writer.write(notification.encode() + b'\n')
            await conn.writer.drain()
            conn.current_job = job
            
            logger.debug(f"📤 Sent job {job.job_id} to {conn.worker_name}")
            
        except Exception as e:
            logger.warning(f"Failed to send job: {e}")
    
    async def broadcast_jobs(self):
        """Periodically broadcast new jobs to all miners"""
        while self.running:
            await asyncio.sleep(30)  # New job every 30 seconds
            
            for algorithm in ['cosmic_harmony', 'randomx', 'yescrypt']:
                job = self.create_job(algorithm)
                if not job:
                    continue
                
                # Send to all miners using this algorithm
                for addr, conn in list(self.connections.items()):
                    if conn.authenticated and conn.algorithm == algorithm:
                        try:
                            await self.send_job_to_connection(conn, job)
                        except Exception as e:
                            logger.warning(f"Failed to send job to {addr}: {e}")
    
    async def cleanup_inactive_connections(self):
        """Close inactive connections"""
        while self.running:
            await asyncio.sleep(60)
            
            current_time = time.time()
            timeout = 300  # 5 minutes
            
            for addr, conn in list(self.connections.items()):
                if current_time - conn.last_activity > timeout:
                    logger.info(f"⏱️  Closing inactive connection: {addr}")
                    try:
                        conn.writer.close()
                        await conn.writer.wait_closed()
                    except:
                        pass
                    self.connections.pop(addr, None)
    
    async def update_statistics(self):
        """Update pool statistics"""
        while self.running:
            await asyncio.sleep(10)
            
            # Count connected miners per algorithm
            algo_counts = defaultdict(int)
            for conn in self.connections.values():
                if conn.authenticated:
                    algo_counts[conn.algorithm] += 1
            
            # Update stats
            self.stats['connected_miners'] = len([c for c in self.connections.values() if c.authenticated])
            
            for algo, count in algo_counts.items():
                self.algo_stats[algo]['miners'] = count
    
    def json_response(self, req_id: int, result: Any, error: Optional[str]) -> str:
        """Format JSON-RPC response"""
        return json.dumps({
            "id": req_id,
            "result": result,
            "error": error
        })
    
    # ========== Web API ==========
    
    async def start_web_server(self):
        """Start web API server"""
        app = web.Application()
        app.router.add_get('/stats', self.api_stats)
        app.router.add_get('/miners', self.api_miners)
        app.router.add_get('/shares', self.api_shares)
        app.router.add_get('/', self.api_index)
        
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, '0.0.0.0', self.web_port)
        await site.start()
        
        logger.info(f"✅ Web API started on port {self.web_port}")
        self.web_app = runner
    
    async def api_index(self, request):
        """Pool info endpoint"""
        uptime = int(time.time() - self.stats['uptime_start'])
        
        html = f"""
        <html>
        <head>
            <title>ZION Native Pool v2.9.0</title>
            <meta http-equiv="refresh" content="10">
            <style>
                body {{ font-family: monospace; background: #1a1a1a; color: #00ff00; padding: 20px; }}
                h1 {{ color: #00ffff; }}
                .stat {{ margin: 10px 0; }}
                .label {{ color: #ffff00; }}
                table {{ border-collapse: collapse; margin: 20px 0; }}
                th, td {{ border: 1px solid #00ff00; padding: 8px; text-align: left; }}
                th {{ background: #003300; }}
            </style>
        </head>
        <body>
            <h1>🏊 ZION Native Pool v2.9.0</h1>
            
            <div class="stat"><span class="label">Uptime:</span> {uptime}s</div>
            <div class="stat"><span class="label">Connected Miners:</span> {self.stats['connected_miners']}</div>
            <div class="stat"><span class="label">Total Shares:</span> {self.stats['total_shares']}</div>
            <div class="stat"><span class="label">Valid Shares:</span> {self.stats['valid_shares']}</div>
            <div class="stat"><span class="label">Invalid Shares:</span> {self.stats['invalid_shares']}</div>
            <div class="stat"><span class="label">Blocks Found:</span> {self.stats['blocks_found']}</div>
            
            <h2>Algorithm Statistics</h2>
            <table>
                <tr>
                    <th>Algorithm</th>
                    <th>Miners</th>
                    <th>Shares</th>
                    <th>Difficulty</th>
                </tr>
"""
        
        for algo, stats in self.algo_stats.items():
            html += f"""
                <tr>
                    <td>{algo}</td>
                    <td>{stats['miners']}</td>
                    <td>{stats['shares']}</td>
                    <td>{stats.get('difficulty', self.difficulties.get(algo, 1000))}</td>
                </tr>
"""
        
        html += """
            </table>
            
            <h2>Connected Miners</h2>
            <table>
                <tr>
                    <th>Wallet</th>
                    <th>Algorithm</th>
                    <th>Shares</th>
                    <th>Accepted</th>
                    <th>Rejected</th>
                </tr>
"""
        
        for conn in self.connections.values():
            if conn.authenticated:
                html += f"""
                <tr>
                    <td>{conn.wallet[:16]}...</td>
                    <td>{conn.algorithm}</td>
                    <td>{conn.shares_submitted}</td>
                    <td>{conn.shares_accepted}</td>
                    <td>{conn.shares_rejected}</td>
                </tr>
"""
        
        html += """
            </table>
            
            <p style="color: #888; margin-top: 40px;">Auto-refresh every 10 seconds</p>
        </body>
        </html>
        """
        
        return web.Response(text=html, content_type='text/html')
    
    async def api_stats(self, request):
        """Pool statistics API"""
        return web.json_response({
            'stats': self.stats,
            'algorithms': dict(self.algo_stats),
            'difficulties': self.difficulties
        })
    
    async def api_miners(self, request):
        """Connected miners API"""
        miners = []
        for conn in self.connections.values():
            if conn.authenticated:
                miners.append({
                    'wallet': conn.wallet,
                    'algorithm': conn.algorithm,
                    'shares_submitted': conn.shares_submitted,
                    'shares_accepted': conn.shares_accepted,
                    'shares_rejected': conn.shares_rejected,
                    'difficulty': conn.difficulty
                })
        
        return web.json_response({'miners': miners})
    
    async def api_shares(self, request):
        """Recent shares API"""
        recent_shares = [
            {
                'wallet': s.wallet[:16] + '...',
                'algorithm': s.algorithm,
                'valid': s.valid,
                'difficulty': s.difficulty,
                'timestamp': s.timestamp
            }
            for s in self.shares[-100:]  # Last 100 shares
        ]
        
        return web.json_response({'shares': recent_shares})


async def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description="ZION Native Pool v2.9.0")
    parser.add_argument("--stratum-host", default="0.0.0.0",
                       help="Stratum server host (default: 0.0.0.0)")
    parser.add_argument("--stratum-port", type=int, default=3333,
                       help="Stratum server port (default: 3333)")
    parser.add_argument("--web-port", type=int, default=8080,
                       help="Web API port (default: 8080)")
    
    args = parser.parse_args()
    
    print("=" * 80)
    print("              ZION NATIVE POOL SERVER v2.9.0")
    print("         Native Mining Pool - Stratum Protocol Support")
    print("            Cosmic Harmony + RandomX + Yescrypt")
    print("=" * 80)
    print()
    
    pool = ZionNativePool(
        stratum_host=args.stratum_host,
        stratum_port=args.stratum_port,
        web_port=args.web_port
    )
    
    try:
        await pool.start()
        
        # Keep running
        while pool.running:
            await asyncio.sleep(1)
    
    except KeyboardInterrupt:
        logger.info("\n⏹️  Shutting down pool...")
        pool.running = False


if __name__ == "__main__":
    asyncio.run(main())
