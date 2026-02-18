#!/usr/bin/env python3
"""
🔌 Synchronní Stratum Pool Client
Používá socket.socket místo asyncio - perfect pro mining thready

Egyszerű, synchronní implementace bez async komplikací.
Anti-duplicate cache added in v2.8.1 to prevent re-submission.
"""

import socket
import json
import time
import logging
from typing import Optional, Dict, Set, Tuple
from collections import defaultdict

logger = logging.getLogger(__name__)


class StratumClientSync:
    """Synchronní Stratum mining pool client"""
    
    def __init__(self, pool_host: str, pool_port: int = 3333, timeout: float = 10.0):
        """Initialize sync Stratum client"""
        self.pool_host = pool_host
        self.pool_port = pool_port
        self.timeout = timeout
        
        self.socket = None
        self.connected = False
        self.authenticated = False
        
        self.worker_id = None
        self.current_job = None
        self.difficulty: Optional[int] = None
        
        self.shares_submitted = 0
        self.shares_accepted = 0
        self.shares_rejected = 0
        
        self.request_id = 0
        self._pending_responses: Dict[int, Dict] = {}
        
        # Anti-duplicate cache (v2.8.1)
        self._submitted_shares: Dict[str, Set[int]] = defaultdict(set)
        self._job_cache_max_age = 300  # 5 minutes TTL
        self._job_cache_timestamps: Dict[str, float] = {}
        # Selected algorithm for this client session (e.g., 'randomx', 'yescrypt', 'autolykos_v2')
        self.algorithm: Optional[str] = None
    
    def _cleanup_old_jobs(self):
        """Remove stale job entries from duplicate cache"""
        now = time.time()
        expired_jobs = [
            job_id for job_id, ts in self._job_cache_timestamps.items()
            if now - ts > self._job_cache_max_age
        ]
        for job_id in expired_jobs:
            self._submitted_shares.pop(job_id, None)
            self._job_cache_timestamps.pop(job_id, None)
        
        if expired_jobs:
            logger.debug(f"🧹 Cleaned {len(expired_jobs)} expired job(s) from duplicate cache")
    
    def _is_duplicate_share(self, job_id: str, nonce: int) -> bool:
        """Check if (job_id, nonce) was already submitted"""
        if job_id not in self._submitted_shares:
            return False
        return nonce in self._submitted_shares[job_id]
    
    def _mark_share_submitted(self, job_id: str, nonce: int):
        """Mark (job_id, nonce) as submitted"""
        self._submitted_shares[job_id].add(nonce)
        self._job_cache_timestamps[job_id] = time.time()
        
        # Periodic cleanup every 100 shares
        if self.shares_submitted % 100 == 0:
            self._cleanup_old_jobs()
    
    def connect(self) -> bool:
        """Connect to pool"""
        try:
            logger.info(f"🔌 Connecting to {self.pool_host}:{self.pool_port}...")
            
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.settimeout(self.timeout)
            self.socket.connect((self.pool_host, self.pool_port))
            
            self.connected = True
            logger.info("✅ Connected to pool")
            return True
            
        except Exception as e:
            logger.error(f"❌ Connection failed: {e}")
            self.connected = False
            return False
    
    def disconnect(self):
        """Disconnect from pool"""
        if self.socket:
            try:
                self.socket.close()
            except:
                pass
        self.connected = False
        self.authenticated = False
        logger.info("🔌 Disconnected")
    
    def subscribe(self) -> bool:
        """Subscribe to pool notifications"""
        try:
            self.request_id += 1
            request = {
                "id": self.request_id,
                "method": "mining.subscribe",
                "params": ["zion-miner/1.0"]
            }
            
            response = self._send_receive(request)
            
            if response and response.get("result"):
                logger.info("✅ Subscribed to pool")
                self.poll_notifications()
                return True
            else:
                logger.error(f"❌ Subscribe failed: {response}")
                return False
                
        except Exception as e:
            logger.error(f"Subscribe error: {e}")
            return False
    
    def authorize(self, wallet: str, worker: str = "miner", algorithm: str = "autolykos2") -> bool:
        """Authorize worker
        
        Args:
            wallet: Wallet address
            worker: Worker name
            algorithm: Mining algorithm (for pool job routing)
        """
        try:
            self.worker_id = f"{wallet}.{worker}"
            self.request_id += 1
            
            # Historically we overloaded password with algorithm for pool routing.
            # Keep this for backward-compatibility with current pool while also storing locally.
            password = algorithm  # e.g., "autolykos2", "randomx", "yescrypt"
            # Store selected algorithm locally
            self.algorithm = (algorithm or "").lower()
            
            request = {
                "id": self.request_id,
                "method": "mining.authorize",
                "params": [self.worker_id, password]
            }
            
            response = self._send_receive(request)
            
            if response and response.get("result") is True:
                self.authenticated = True
                logger.info(f"✅ Authorized: {self.worker_id} (algorithm: {self.algorithm})")
                self.poll_notifications()
                return True
            else:
                logger.error(f"❌ Authorization failed: {response}")
                return False
                
        except Exception as e:
            logger.error(f"Authorization error: {e}")
            return False
    
    def submit_share(self, job_id: str, nonce: int, result_hash: bytes) -> bool:
        """Submit mining share with anti-duplicate check"""
        try:
            # Anti-duplicate check (v2.8.1)
            if self._is_duplicate_share(job_id, nonce):
                logger.debug(f"⏭️  Skipping duplicate share: job={job_id}, nonce={nonce}")
                return False
            
            result_hex = result_hash.hex() if isinstance(result_hash, bytes) else str(result_hash)
            self.request_id += 1
            
            request = {
                "id": self.request_id,
                "method": "mining.submit",
                "params": [
                    self.worker_id,
                    job_id,
                    f"{nonce:x}",
                    result_hex
                ]
            }
            
            # Mark as submitted BEFORE sending to avoid race conditions
            self._mark_share_submitted(job_id, nonce)
            
            response = self._send_receive(request)
            self.shares_submitted += 1
            
            if response and response.get("result") is True:
                self.shares_accepted += 1
                logger.info("✅ Share accepted!")
                return True
            else:
                self.shares_rejected += 1
                logger.warning(f"❌ Share rejected: {response}")
                return False
                
        except Exception as e:
            logger.error(f"Share submission error: {e}")
            return False
    
    def _send_receive(self, request: Dict) -> Optional[Dict]:
        """Send JSON-RPC request and receive response"""
        try:
            if not self.connected:
                logger.error("Not connected")
                return None
            
            request_id = request.get("id")
            if request_id is not None:
                cached = self._pending_responses.pop(request_id, None)
                if cached is not None:
                    return cached

            # Send
            message = json.dumps(request) + "\n"
            self.socket.sendall(message.encode())
            
            # Receive loop (handle async notifications too)
            while True:
                response_str = self._recv_line()
                if not response_str:
                    return None
                try:
                    payload = json.loads(response_str)
                except json.JSONDecodeError:
                    logger.debug(f"Ignoring invalid JSON: {response_str}")
                    continue

                payload_id = payload.get("id")
                if payload_id == request_id:
                    return payload

                if payload_id is not None:
                    # Response to other request in-flight
                    self._pending_responses[payload_id] = payload
                    continue

                # Stratum notification
                self._handle_notification(payload)
            
        except socket.timeout:
            logger.warning("Socket timeout")
            return None
        except Exception as e:
            logger.error(f"Send/receive error: {e}")
            return None
    
    def _recv_line(self) -> Optional[str]:
        """Receive one line from socket"""
        try:
            data = b""
            while True:
                chunk = self.socket.recv(1)
                if not chunk:
                    return None
                data += chunk
                if chunk == b'\n':
                    return data.decode().strip()
                    
        except (socket.timeout, BlockingIOError):
            return None
        except Exception as e:
            logger.debug(f"Recv error: {e}")
            return None
    
    def get_job(self) -> Optional[Dict]:
        """Get current job (if any)"""
        self.poll_notifications()
        return self.current_job
    
    def fetch_job(self) -> Optional[Dict]:
        """Try to fetch a new job from pool"""
        try:
            self.poll_notifications()
            return self.current_job
            
        except Exception as e:
            logger.error(f"Job fetch error: {e}")
            return None

    def poll_notifications(self):
        """Process any pending Stratum notifications without blocking"""
        if not self.connected or not self.socket:
            return

        # Keep a shorter timeout while polling
        previous_timeout = self.socket.gettimeout()
        try:
            self.socket.settimeout(0.05)
        except Exception:
            pass

        try:
            while True:
                message_str = self._recv_line()
                if not message_str:
                    break

                try:
                    payload = json.loads(message_str)
                except json.JSONDecodeError:
                    logger.debug(f"Ignoring invalid JSON: {message_str}")
                    continue

                payload_id = payload.get("id")
                if payload_id is not None:
                    self._pending_responses[payload_id] = payload
                    continue

                self._handle_notification(payload)
        finally:
            try:
                self.socket.settimeout(previous_timeout)
            except Exception:
                pass

    def _handle_notification(self, message: Dict):
        """Handle async Stratum notifications like mining.notify"""
        method = message.get("method")
        params = message.get("params") or []

        if method == "mining.set_difficulty" and params:
            new_diff = params[0]
            try:
                self.difficulty = float(new_diff)
            except (TypeError, ValueError):
                self.difficulty = None
            logger.info(f"🎚️ Pool difficulty set to {self.difficulty}")
            return

        if method == "mining.notify":
            job = self._parse_job_from_notify(params)
            if not job:
                logger.warning(f"⚠️ Received mining.notify without usable job: {params}")
                return

            job.setdefault("received_at", time.time())
            self.current_job = job
            job_id = job.get("job_id") or job.get("id")
            logger.info(f"🎯 New job received: {job_id}")
            return

        logger.debug(f"Unhandled Stratum notification: {message}")

    def _parse_job_from_notify(self, params) -> Optional[Dict]:
        """Normalize mining.notify params into a job dict"""
        if not params:
            return None

        first = params[0]
        if isinstance(first, dict):
            job = dict(first)
            job_id = job.get("job_id") or job.get("id")
            if job_id is not None:
                job["job_id"] = job_id
                job["id"] = job_id
            return job

        # Legacy array-based format: [job_id, header, target, ...]
        job_id = first
        header = params[1] if len(params) > 1 else None
        target = params[2] if len(params) > 2 else None
        extra_nonce_1 = params[3] if len(params) > 3 else None
        extra_nonce_2 = params[4] if len(params) > 4 else None

        job: Dict[str, Optional[str]] = {
            "job_id": job_id,
            "header": header,
            "target": target,
            "extra_nonce_1": extra_nonce_1,
            "extra_nonce_2": extra_nonce_2,
            "raw_params": list(params)
        }
        if job_id is not None:
            job["id"] = job_id
        return job


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    
    # Test
    client = StratumClientSync("127.0.0.1", 3333)
    
    if client.connect():
        time.sleep(0.5)
        
        if client.subscribe():
            time.sleep(0.5)
            
            if client.authorize("ZionbUoRGQqNvDNebPmTCyXjWs9kxHiMfZ", "test-worker"):
                print("\n✅ Stratum sync client working!")
                print(f"   Worker: {client.worker_id}")
                print(f"   Shares: {client.shares_submitted}")
        
        client.disconnect()
