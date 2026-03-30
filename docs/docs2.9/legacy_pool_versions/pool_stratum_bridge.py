#!/usr/bin/env python3
"""
🔌 Pool Stratum Bridge - Integrovaná Stratum komunikace v rámci pool serveru
Jednocestná architektura: Miner ↔ Stratum ↔ Pool ↔ Blockchain RPC ↔ Rewards

DŮVOD: Proč mít 2 servery když jeden stačí? 🎯
- Pool server = Mining Pool + Stratum Protocol + Job Manager
- Eliminace síťové latence (vše v jednom procesu)
- Jednoduchá správa (1 konfigurační soubor, 1 databáze, 1 port)
- Lepší synchronizace (realtime blockchain info)
"""

import asyncio
import json
import time
import secrets
import hashlib
import logging
from typing import Dict, Optional, List, Tuple, Any
from dataclasses import dataclass

try:
    from ai.autolykos_v2 import AutolykosV2
except ImportError:
    from autolykos_v2 import AutolykosV2

logger = logging.getLogger(__name__)


@dataclass
class StratumConnection:
    """Stratum client connection v rámci pool serveru"""
    address: Tuple            # (host, port)
    reader: asyncio.StreamReader
    writer: asyncio.StreamWriter
    worker_name: str = "unknown"
    wallet: str = "unknown"
    algorithm: str = "randomx"
    authenticated: bool = False
    last_activity: float = None
    difficulty: int = 0
    current_job: Optional[Dict[str, Any]] = None
    
    def __post_init__(self):
        self.last_activity = time.time()


class PoolStratumBridge:
    """
    Jednolitá Stratum implementace v rámci pool serveru
    
    Místo standalone stratum_client.py, toto je integrováno do ZionUniversalPool
    """
    
    def __init__(self, pool_instance):
        """
        Initialize Stratum bridge
        
        Args:
            pool_instance: Reference na ZionUniversalPool
        """
        self.pool = pool_instance
        self.connections: Dict[Tuple, StratumConnection] = {}
        self.job_queue = asyncio.Queue()
        self.job_counter = 0
        self.jobs: Dict[str, Dict[str, Any]] = {}
        self.autolykos = AutolykosV2(use_gpu=False)
        
        logger.info("✅ Pool Stratum Bridge initialized")
    
    async def handle_stratum_connection(self, reader: asyncio.StreamReader, 
                                       writer: asyncio.StreamWriter):
        """
        Handle incomingStratum client connection
        
        Integruje přichozí Stratum klienty do pool managementu
        """
        addr = writer.get_extra_info('peername')
        
        # Vytvořit connection objekt
        conn = StratumConnection(
            address=addr,
            reader=reader,
            writer=writer
        )
        
        self.connections[addr] = conn
        
        logger.info(f"🔌 Stratum client connected from {addr[0]}:{addr[1]}")
        
        try:
            # Čtení příkazů od minera
            while True:
                # Načíst řádek (JSON-RPC)
                try:
                    line = await asyncio.wait_for(
                        reader.readuntil(b'\n'),
                        timeout=30.0
                    )
                except asyncio.TimeoutError:
                    logger.warning(f"Timeout od {addr} - odpojuji")
                    break
                except asyncio.IncompleteReadError:
                    break
                
                try:
                    request = json.loads(line.decode().strip())
                    
                    # Zpracovat Stratum metodu
                    response = await self._handle_stratum_method(request, conn)
                    
                    if response:
                        writer.write(response.encode() + b'\n')
                        await writer.drain()
                    
                    conn.last_activity = time.time()
                    
                except json.JSONDecodeError:
                    logger.warning(f"Neplatný JSON od {addr}")
                except Exception as e:
                    logger.error(f"Chyba zpracování: {e}")
        
        finally:
            # Disconnect
            self.connections.pop(addr, None)
            writer.close()
            await writer.wait_closed()
            logger.info(f"🔌 Stratum client disconnected: {addr}")
    
    async def _handle_stratum_method(self, request: Dict, 
                                     conn: StratumConnection) -> Optional[str]:
        """
        Zpracovat Stratum RPC metodu
        
        Args:
            request: JSON-RPC request
            conn: Stratum connection
            
        Returns:
            JSON-RPC response string
        """
        method = request.get('method')
        params = request.get('params', [])
        req_id = request.get('id')
        
        logger.debug(f"📨 Stratum method: {method} from {conn.address[0]}")
        
        # ============ SUBSCRIBE ============
        if method == 'mining.subscribe':
            return await self._handle_subscribe(conn, req_id)
        
        # ============ AUTHORIZE ============
        elif method in ('mining.authorize', 'mining.login'):
            return await self._handle_authorize(conn, params, req_id)
        
        # ============ SUBMIT ============
        elif method == 'mining.submit':
            return await self._handle_submit(conn, params, req_id)
        
        # ============ KEEPALIVE ============
        elif method == 'mining.keepalive' or method == 'keepalived':
            conn.last_activity = time.time()
            return self._json_response(req_id, {"status": "OK"}, None)
        
        # ============ UNKNOWN ============
        else:
            logger.warning(f"Unknown Stratum method: {method}")
            return None
    
    async def _handle_subscribe(self, conn: StratumConnection, req_id: int) -> str:
        """
        Zpracovat mining.subscribe - Zahájit session
        """
        # Alokovat extranonce
        extranonce1 = f"{len(self.connections):08x}"  # Unique per connection
        extranonce2_size = 4
        
        logger.info(f"✅ Subscribe: {conn.address[0]} - extranonce1={extranonce1}")
        
        result = [
            [
                ["mining.set_difficulty", "mining.notify"],  # Capabilities
                extranonce1,
                extranonce2_size
            ]
        ]
        
        return self._json_response(req_id, result, None)
    
    async def _handle_authorize(self, conn: StratumConnection, 
                                params: List, req_id: int) -> str:
        """
        Zpracovat mining.authorize - Ověřit wallet a algoritmus
        """
        if not params:
            return self._json_response(req_id, None, "Invalid params")
        
        wallet = params[0]
        password = params[1] if len(params) > 1 else ""
        
        # Detekovat algoritmus z hesla
        password_lower = password.lower()
        algorithm = "randomx"  # Default
        if "autolykos" in password_lower:
            algorithm = "autolykos_v2"
        elif "yescrypt" in password_lower:
            algorithm = "yescrypt"
        elif "kawpow" in password_lower:
            algorithm = "kawpow"
        
        # Aktualizovat connection info
        conn.wallet = wallet
        conn.algorithm = algorithm
        conn.authenticated = True
        conn.worker_name = f"{wallet.split('.')[0]}-{algorithm}"
        
        # Registrovat v pool - DŮLEŽITÉ: přidat do pool.miners!
        addr_str = f"{conn.address[0]}:{conn.address[1]}"
        
        # Zaregistrovat minera v pool
        if addr_str not in self.pool.miners:
            self.pool.miners[addr_str] = {
                'wallet': wallet,
                'algorithm': algorithm,
                'shares': 0,
                'accepted_shares': 0,
                'rejected_shares': 0,
                'hashrate': 0.0,
                'last_share_time': None,
                'last_job_id': None,
                'connected_at': time.time()
            }
        
        # Aktualizovat existujícího minera
        self.pool.miners[addr_str]['wallet'] = wallet
        self.pool.miners[addr_str]['algorithm'] = algorithm
        self.pool.miners[addr_str]['last_activity'] = time.time()
        
        # Nastavit výchozí difficulty
        conn.difficulty = int(self.pool.difficulty.get(algorithm, 1000))
        difficulty_notification = json.dumps({
            "id": None,
            "method": "mining.set_difficulty",
            "params": [conn.difficulty]
        })
        conn.writer.write(difficulty_notification.encode() + b'\n')
        await conn.writer.drain()
        
        logger.info(f"🔐 Authorized: {wallet} on {algorithm}")
        logger.info(f"   Registered miner: {addr_str} (algorithm: {algorithm}, diff: {conn.difficulty})")
        
        # Odeslat okamžitě nový job
        job = self._create_job_for_algorithm(algorithm)
        if job:
            await self._send_job_to_connection(conn, job)
        
        # Vrátit pouze autorizační response + difficulty v notification
        # (job se posílá až později broadcast)
        
        # Auth response (to je to hlavní, co client čeká)
        return self._json_response(req_id, True, None)
    
    def _format_job_for_stratum(self, job: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Formátovat Stratum payload podle algoritmu"""
        algorithm = job.get('algorithm', 'randomx')
        timestamp = int(time.time())
        
        if algorithm == "autolykos_v2":
            payload = {
                "id": job['job_id'],
                "job_id": job['job_id'],
                "algorithm": "autolykos2",
                "header": job['header'],
                "target": job['target'],
                "difficulty": job['difficulty'],
                "height": job['height'],
                "timestamp": job.get('timestamp', timestamp),
                "clean_jobs": True
            }
        elif algorithm == "yescrypt":
            payload = {
                "id": job['job_id'],
                "job_id": job['job_id'],
                "algorithm": "yescrypt",
                "block_header": job.get('block_header', '00' * 80),
                "difficulty": job.get('difficulty', self.pool.difficulty.get('yescrypt', 1000)),
                "height": job.get('height', 0),
                "timestamp": timestamp,
                "clean_jobs": True
            }
        else:  # randomx / fallback
            payload = {
                "id": job['job_id'],
                "job_id": job['job_id'],
                "algorithm": "randomx",
                "blob": job.get('blob', '00' * 80),
                "target": job.get('target', self._difficulty_to_target(self.pool.difficulty.get('randomx', 1000))),
                "seed_hash": job.get('seed_hash', secrets.token_hex(32)),
                "height": job.get('height', 0),
                "timestamp": timestamp,
                "clean_jobs": True
            }
        
        return [payload]
    
    async def _handle_submit(self, conn: StratumConnection, 
                            params: List, req_id: int) -> str:
        """
        Zpracovat mining.submit - Přijetí share a reward výpočet
        """
        if not conn.authenticated or len(params) < 4:
            return self._json_response(req_id, None, "Unauthorized or invalid params")
        
        worker = params[0]
        job_id = params[1]
        nonce_hex = params[2]
        result_hex = params[3]
        extra_data = params[4:] if len(params) > 4 else []
        
        logger.info(f"📤 Submit: {conn.wallet} job={job_id[:8]}... nonce={nonce_hex}")
        
        job = self.jobs.get(job_id)
        if not job:
            logger.warning(f"❌ Submit for unknown job {job_id}")
            return self._json_response(req_id, False, "Unknown job")
        
        algorithm = job.get('algorithm', conn.algorithm)
        difficulty = conn.difficulty or self.pool.difficulty.get(algorithm, 1000)
        is_valid = False
        is_block_candidate = False
        
        try:
            if algorithm == "autolykos_v2":
                nonce_int = int(nonce_hex, 16)
                result_bytes = bytes.fromhex(result_hex)
                header_bytes = bytes.fromhex(job['header'])
                target_bytes = bytes.fromhex(job['target'])
                is_valid = self.autolykos.verify(header_bytes, nonce_int, result_bytes, target_bytes)
                if is_valid:
                    result_value = int.from_bytes(result_bytes, 'big')
                    target_value = int.from_bytes(target_bytes, 'big')
                    # Block candidate if meets base network difficulty (placeholder check)
                    base_target = int.from_bytes(bytes.fromhex(job['target']), 'big')
                    is_block_candidate = result_value < max(1, base_target // 2)
            elif algorithm == "yescrypt":
                is_valid = self.pool.validate_yescrypt_share(job_id, nonce_hex, result_hex, difficulty)
            elif algorithm == "randomx":
                is_valid = self.pool.validate_randomx_share(job_id, nonce_hex, result_hex, difficulty)
            else:
                is_valid = True  # Testing mode pro ostatní algoritmy
        except Exception as e:
            logger.error(f"Share validation error ({algorithm}): {e}")
            is_valid = False
        
        # Zaznamenat share
        self.pool.record_share(conn.wallet, algorithm, is_valid)
        conn.last_activity = time.time()
        
        if is_valid and algorithm == "autolykos_v2":
            # Aktualizovat miner statistics if available
            addr_str = f"{conn.address[0]}:{conn.address[1]}"
            if addr_str in self.pool.miners:
                self.pool.miners[addr_str]['last_activity'] = time.time()
                self.pool.miners[addr_str]['last_job_id'] = job_id
        
        if is_valid and is_block_candidate:
            logger.info(f"🌟 Potential block solution submitted by {conn.wallet} (job {job_id})")
            # TODO: Integrace na blockchain submit
        
        if is_valid:
            logger.info(f"✅ Valid share from {conn.wallet}")
        else:
            logger.warning(f"❌ Invalid share from {conn.wallet}")
        
        # Vrátit response
        return self._json_response(req_id, is_valid, None)
    
    def _json_response(self, req_id: int, result: Any, error: Optional[str]) -> str:
        """Formátovat JSON-RPC response"""
        return json.dumps({
            "id": req_id,
            "result": result,
            "error": error
        })
    
    def _difficulty_to_target(self, difficulty: int) -> str:
        """Převést pool difficulty na 32-bajtový target"""
        difficulty = max(1, int(difficulty))
        target_int = max(1, (1 << 256) // difficulty)
        return target_int.to_bytes(32, 'big').hex()
    
    def _create_job_for_algorithm(self, algorithm: str) -> Optional[Dict[str, Any]]:
        """Vygenerovat nový job pro zadaný algoritmus"""
        try:
            if algorithm == "randomx":
                job = self.pool.create_randomx_job()
            elif algorithm == "yescrypt":
                job = self.pool.create_yescrypt_job()
            elif algorithm == "autolykos_v2":
                self.job_counter += 1
                job_id = f"zion_al_{self.job_counter:06d}"
                difficulty = max(1, int(self.pool.difficulty.get('autolykos_v2', 100)))
                header_bytes = secrets.token_bytes(32)
                target_hex = self._difficulty_to_target(difficulty)
                job = {
                    'job_id': job_id,
                    'algorithm': 'autolykos_v2',
                    'height': self.pool.current_block_height + self.job_counter,
                    'header': header_bytes.hex(),
                    'target': target_hex,
                    'difficulty': difficulty,
                    'timestamp': int(time.time())
                }
            else:
                return None
            
            if job:
                self.jobs[job['job_id']] = job
            return job
        except Exception as e:
            logger.error(f"Job creation failed for {algorithm}: {e}")
            return None
    
    async def _send_job_to_connection(self, conn: StratumConnection, job: Dict[str, Any]) -> None:
        """Odeslat Stratum job konkrétnímu minerovi"""
        try:
            payload = self._format_job_for_stratum(job)
            notification = json.dumps({
                "id": None,
                "method": "mining.notify",
                "params": payload
            })
            conn.writer.write(notification.encode() + b'\n')
            await conn.writer.drain()
            conn.current_job = job
            logger.debug(f"📤 Sent job {job['job_id']} to {conn.worker_name}")
        except Exception as e:
            logger.warning(f"Failed to send job to {conn.address}: {e}")
    
    async def broadcast_new_job(self):
        """
        Periodicky odesílat nové jobs všem připojeným minersům
        (mining.notify notifications)
        """
        while True:
            await asyncio.sleep(10)  # Nový job každých 10 sekund
            
            # Pro každý algoritmus vytvořit job a poslat všem
            for algorithm in ["randomx", "autolykos_v2", "yescrypt"]:
                job = self._create_job_for_algorithm(algorithm)
                if not job:
                    continue
                
                for addr, conn in list(self.connections.items()):
                    if not conn.authenticated or conn.algorithm != algorithm:
                        continue
                    
                    try:
                        await self._send_job_to_connection(conn, job)
                    except Exception as e:
                        logger.warning(f"Failed to send job to {addr}: {e}")
    
    async def check_inactive_connections(self):
        """
        Periodicky kontrolovat a uzavírat inactive connections
        """
        while True:
            await asyncio.sleep(60)  # Check every minute
            
            current_time = time.time()
            timeout = 300  # 5 minut
            
            for addr, conn in list(self.connections.items()):
                if current_time - conn.last_activity > timeout:
                    logger.info(f"⏱️  Closing inactive connection: {addr}")
                    try:
                        conn.writer.close()
                        await conn.writer.wait_closed()
                    except:
                        pass
                    self.connections.pop(addr, None)


# ============================================================================
# MODIFIKACE POOL SERVERU pro integraci Stratum
# ============================================================================

def integrate_stratum_into_pool(pool_instance):
    """
    Integrovat PoolStratumBridge do existujícího pool serveru
    
    Přídá se do ZionUniversalPool.__init__():
    
    ```python
    self.stratum_bridge = PoolStratumBridge(self)
    
    # V start_server():
    stratum_server = await asyncio.start_server(
        self.stratum_bridge.handle_stratum_connection,
        '0.0.0.0',
        3333  # Stratum port
    )
    
    # Spustit broadcast jobů a cleanup tasků
    asyncio.create_task(self.stratum_bridge.broadcast_new_job())
    asyncio.create_task(self.stratum_bridge.check_inactive_connections())
    ```
    """
    
    # Vytvořit bridge
    pool_instance.stratum_bridge = PoolStratumBridge(pool_instance)
    
    logger.info("🔌 Stratum bridge integrated into pool server")


if __name__ == "__main__":
    print("""
    🔌 Pool Stratum Bridge
    
    TOTO NENÍ STANDALONE PROGRAM!
    
    Integrace do ZionUniversalPool:
    
    1. Import tohoto modulu v zion_universal_pool_v2.py
    2. V __init__ pool serveru:
       from pool_stratum_bridge import PoolStratumBridge
       self.stratum_bridge = PoolStratumBridge(self)
    
    3. V start_server():
       asyncio.create_task(self.stratum_bridge.broadcast_new_job())
       asyncio.create_task(self.stratum_bridge.check_inactive_connections())
    
    Výhody:
    ✅ Jednocestná architektura (jedna aplikace, jeden port)
    ✅ Žádné duplicitní networking
    ✅ Lepší synchronizace s blockchain RPC
    ✅ Jednodušší správa a debugging
    """)
