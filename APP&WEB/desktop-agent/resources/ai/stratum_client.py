#!/usr/bin/env python3
"""
🔌 Stratum Pool Client
Komunikace s Stratum mining pool pro ZION blockchain

Stratum protocol implementace:
- JSON-RPC přes TCP socket
- getwork / submit metodami
- Mining job management
"""

import socket
import json
import time
import threading
import logging
from typing import Dict, Optional, Callable, Any
from dataclasses import dataclass
from queue import Queue

logger = logging.getLogger(__name__)

@dataclass
class StratumJob:
    """Mining job z pool serveru"""
    id: str
    header: str           # Block header (hex)
    seed_hash: str        # Seed hash (hex)
    target: str           # Target difficulty (hex)
    difficulty: float     # Current difficulty
    clean: bool           # Clean job flag
    timestamp: float      # Job received time
    
    def __str__(self):
        return f"Job({self.id[:8]}..., diff={self.difficulty})"


class StratumClient:
    """
    Stratum Mining Pool Client
    
    Podporuje mining pool komunikaci přes JSON-RPC
    """
    
    def __init__(self, pool_host: str, pool_port: int = 3333, autostart_handler: bool = True):
        """
        Initialize Stratum client
        
        Args:
            pool_host: Pool server hostname/IP
            pool_port: Pool server port (default 3333)
        """
        self.pool_host = pool_host
        self.pool_port = pool_port
        self.socket = None
        self.connected = False
        self.authenticated = False
        # Control whether background handler auto-starts on connect
        self.autostart_handler = autostart_handler
        
        # Job management
        self.current_job: Optional[StratumJob] = None
        self.job_queue: Queue = Queue()
        self.jobs: Dict[str, StratumJob] = {}
        
        # Worker info
        self.worker_name = "zion-miner"
        self.worker_id = None
        
        # Stats
        self.shares_submitted = 0
        self.shares_accepted = 0
        self.shares_rejected = 0
        self.subscriptions = {}
        
        # Callbacks
        self.on_job: Optional[Callable[[StratumJob], None]] = None
        self.on_notification: Optional[Callable[[Dict], None]] = None
        
        # Connection thread
        self.connection_thread = None
        self.stop_connection = False
        
        # JSON-RPC id generation
        self._id_lock = threading.Lock()
        self._next_id = 1

    def _next_request_id(self) -> int:
        """Get a unique, incrementing JSON-RPC id."""
        with self._id_lock:
            rid = self._next_id
            self._next_id += 1
        return rid
    
    def connect(self, start_handler: Optional[bool] = None) -> bool:
        """
        Connect to pool server
        
        Returns:
            True if connected
        """
        try:
            logger.info(f"🔌 Connecting to {self.pool_host}:{self.pool_port}...")
            
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.settimeout(10)
            self.socket.connect((self.pool_host, self.pool_port))
            
            self.connected = True
            logger.info("✅ Connected to pool server")
            
            # Start connection handler thread (optional)
            should_start = self.autostart_handler if start_handler is None else start_handler
            if should_start:
                self.stop_connection = False
                self.connection_thread = threading.Thread(
                    target=self._connection_handler,
                    daemon=True
                )
                self.connection_thread.start()
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Connection failed: {e}")
            self.connected = False
            return False
    
    def disconnect(self):
        """Disconnect from pool server"""
        self.stop_connection = True
        if self.socket:
            try:
                self.socket.close()
            except:
                pass
        self.connected = False
        self.authenticated = False
        logger.info("🔌 Disconnected from pool")

    def start_notifications(self):
        """Start background notification handler if not already running"""
        if not self.connected or self.connection_thread:
            return
        self.stop_connection = False
        self.connection_thread = threading.Thread(
            target=self._connection_handler,
            daemon=True
        )
        self.connection_thread.start()
    
    def subscribe(self, pool_version: str = "stratum/2") -> bool:
        """
        Subscribe to mining notifications
        
        Args:
            pool_version: Protocol version (e.g., "stratum/2" or "mining/1")
            
        Returns:
            True if subscription successful
        """
        try:
            # Stratum subscribe request
            request = {
                "id": self._next_request_id(),
                "method": "mining.subscribe",
                "params": [
                    "zion-miner/1.0",  # Client version
                    None,              # Session ID (None for new session)
                    self.pool_host,    # Pool host
                    self.pool_port     # Pool port
                ]
            }
            
            logger.info("📨 Sending subscribe request...")
            response = self._send_request(request)
            
            if response and response.get("result"):
                subscriptions = response["result"]
                logger.info(f"✅ Subscribed: {subscriptions}")
                self.subscriptions = subscriptions if isinstance(subscriptions, dict) else {}
                return True
            else:
                logger.error(f"❌ Subscribe failed: {response}")
                return False
                
        except Exception as e:
            logger.error(f"Subscribe error: {e}")
            return False
    
    def authorize(self, wallet_address: str, worker_name: str = "zion-miner", password: str = "password") -> bool:
        """
        Authorize worker with pool
        
        Args:
            wallet_address: Miner wallet address
            worker_name: Worker identifier
            
        Returns:
            True if authorized
        """
        try:
            self.worker_id = f"{wallet_address}.{worker_name}"
            self.worker_name = worker_name
            
            request = {
                "id": self._next_request_id(),
                "method": "mining.authorize",
                "params": [
                    self.worker_id,
                    password  # Password can hint algorithm (e.g., 'randomx', 'yescrypt')
                ]
            }
            
            logger.info(f"🔐 Authorizing worker: {self.worker_id}...")
            response = self._send_request(request)
            
            if response and response.get("result") is True:
                self.authenticated = True
                logger.info("✅ Worker authorized")
                return True
            else:
                logger.error(f"❌ Authorization failed: {response}")
                return False
                
        except Exception as e:
            logger.error(f"Authorization error: {e}")
            return False
    
    def submit_share(self, job_id: str, nonce: int, result_hash: bytes) -> bool:
        """
        Submit mining share to pool
        
        Args:
            job_id: Job ID from pool
            nonce: Nonce value found
            result_hash: Result hash (bytes)
            
        Returns:
            True if accepted
        """
        try:
            # Convert result to hex
            result_hex = result_hash.hex() if isinstance(result_hash, bytes) else str(result_hash)
            
            self.shares_submitted += 1
            request = {
                "id": self._next_request_id(),
                "method": "mining.submit",
                "params": [
                    self.worker_id,
                    job_id,
                    f"{nonce:x}",  # nonce as hex
                    result_hex     # result hash
                ]
            }
            
            logger.info(f"📤 Submitting share: job={job_id[:8]}..., nonce={nonce}")
            response = self._send_request(request)
            
            if response:
                if response.get("result") is True:
                    self.shares_accepted += 1
                    logger.info("✅ Share accepted!")
                    return True
                else:
                    self.shares_rejected += 1
                    logger.warning(f"❌ Share rejected: {response.get('error')}")
                    return False
            else:
                logger.error("❌ No response to share submission")
                return False
                
        except Exception as e:
            logger.error(f"Share submission error: {e}")
            return False
    
    def get_job(self) -> Optional[StratumJob]:
        """
        Get next mining job from queue
        
        Returns:
            StratumJob or None
        """
        try:
            if not self.job_queue.empty():
                job = self.job_queue.get(timeout=0.1)
                self.current_job = job
                return job
        except:
            pass
        
        return self.current_job
    
    def _send_request(self, request: Dict) -> Optional[Dict]:
        """
        Send JSON-RPC request to pool
        
        Args:
            request: Request dict
            
        Returns:
            Response dict or None
        """
        try:
            if not self.connected or not self.socket:
                logger.error("❌ Not connected to pool")
                return None
            
            # Send JSON-RPC request
            message = json.dumps(request) + "\n"
            self.socket.send(message.encode())
            
            # Receive response: loop until we get matching id (ignore notifications)
            expected_id = request.get("id")
            deadline = time.time() + 5.0  # 5s timeout window
            while time.time() < deadline:
                response_str = self._recv_line()
                if not response_str:
                    continue
                try:
                    obj = json.loads(response_str)
                except json.JSONDecodeError:
                    logger.debug(f"Non-JSON line: {response_str!r}")
                    continue

                # Notification from pool (no id) -> handle inline
                if "method" in obj and obj.get("id") is None:
                    method = obj.get("method")
                    if method == "mining.notify":
                        self._handle_notify(obj)
                    elif method == "mining.set_difficulty":
                        self._handle_set_difficulty(obj)
                    # ignore others
                    continue

                # Match response id
                if expected_id is None or obj.get("id") == expected_id:
                    return obj

            logger.error("Timed out waiting for response id %s", expected_id)
            return None
            
        except Exception as e:
            logger.error(f"Request error: {e}")
            return None
    
    def _recv_line(self) -> Optional[str]:
        """
        Receive one line from socket (JSON-RPC response)
        
        Returns:
            String or None
        """
        try:
            if not self.socket:
                return None
            
            data = b""
            while True:
                chunk = self.socket.recv(1)
                if not chunk:
                    return None
                data += chunk
                if chunk == b'\n':
                    return data.decode().strip()
                    
        except socket.timeout:
            return None
        except Exception as e:
            logger.debug(f"Recv error: {e}")
            return None
    
    def _connection_handler(self):
        """
        Main connection loop - handles pool notifications
        """
        while not self.stop_connection and self.connected:
            try:
                # Receive notifications from pool
                line = self._recv_line()
                if not line:
                    continue
                
                notification = json.loads(line)
                
                # Handle different notification types
                if "method" in notification:
                    method = notification["method"]
                    params = notification.get("params", [])
                    
                    if method == "mining.notify":
                        # New job from pool
                        self._handle_notify(notification)
                    elif method == "mining.set_difficulty":
                        # Difficulty change
                        self._handle_set_difficulty(notification)
                    else:
                        logger.debug(f"Notification: {method}")
                
                # Trigger callback
                if self.on_notification:
                    self.on_notification(notification)
                    
            except json.JSONDecodeError as e:
                logger.debug(f"JSON decode error: {e}")
            except Exception as e:
                logger.debug(f"Connection handler error: {e}")
                time.sleep(1)
    
    def _handle_notify(self, notification: Dict):
        """
        Handle mining.notify notification with new job
        
        Args:
            notification: Notify message from pool
        """
        try:
            params = notification.get("params", [])
            if len(params) < 4:
                logger.warning("Invalid notify params")
                return
            
            job_id = params[0]
            header = params[1]
            seed_hash = params[2]
            target = params[3] if len(params) > 3 else "ffffffffffffffff"
            clean = params[7] if len(params) > 7 else False
            
            # Convert target to difficulty
            try:
                target_int = int(target, 16)
                # difficulty = max_target / target
                max_target = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
                difficulty = max_target / target_int if target_int > 0 else 1
            except:
                difficulty = 1.0
            
            # Create job object
            job = StratumJob(
                id=job_id,
                header=header,
                seed_hash=seed_hash,
                target=target,
                difficulty=difficulty,
                clean=clean,
                timestamp=time.time()
            )
            
            # Store job
            self.jobs[job_id] = job
            self.job_queue.put(job)
            self.current_job = job
            
            logger.info(f"🎯 New job: {job}")
            
            # Trigger callback
            if self.on_job:
                self.on_job(job)
                
        except Exception as e:
            logger.error(f"Notify handling error: {e}")
    
    def _handle_set_difficulty(self, notification: Dict):
        """
        Handle mining.set_difficulty notification
        
        Args:
            notification: Set difficulty message
        """
        try:
            params = notification.get("params", [])
            if params:
                difficulty = params[0]
                logger.info(f"📊 Difficulty changed: {difficulty}")
        except Exception as e:
            logger.error(f"Set difficulty error: {e}")
    
    def get_stats(self) -> Dict:
        """Get client statistics"""
        return {
            'connected': self.connected,
            'authenticated': self.authenticated,
            'pool': f"{self.pool_host}:{self.pool_port}",
            'worker': self.worker_name,
            'current_job': str(self.current_job) if self.current_job else None,
            'shares_submitted': self.shares_submitted,
            'shares_accepted': self.shares_accepted,
            'shares_rejected': self.shares_rejected,
            'acceptance_rate': (
                self.shares_accepted / self.shares_submitted 
                if self.shares_submitted > 0 else 0
            )
        }


# Test harness
if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    
    # Create client
    client = StratumClient("91.98.122.165", 3333)
    
    # Connect
    if client.connect():
        time.sleep(1)
        
        # Subscribe
        if client.subscribe():
            time.sleep(1)
            
            # Authorize
            if client.authorize("ZionbUoRGQqNvDNebPmTCyXjWs9kxHiMfZ", "test-worker"):
                # Wait for job
                logger.info("⏳ Waiting for job...")
                time.sleep(5)
                
                job = client.get_job()
                if job:
                    logger.info(f"✅ Got job: {job}")
                else:
                    logger.warning("❌ No job received")
        
        # Show stats
        time.sleep(2)
        stats = client.get_stats()
        print("\n📊 Client Stats:")
        for key, value in stats.items():
            print(f"  {key}: {value}")
        
        client.disconnect()
