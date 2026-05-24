#!/usr/bin/env python3
"""
🌟 ZION AI Native Client for Desktop Agent
Connects to the AI Native server on the current Zion2 host for full AI capabilities
"""

import sys
import json
import asyncio
import logging
import aiohttp
import os
from datetime import datetime
from typing import Dict, List, Optional

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger("AIClient")

DEFAULT_SERVER_URL = "http://127.0.0.1:8001"
LOCAL_FALLBACK_URL = "http://localhost:8001"


def resolve_server_url(explicit_url: Optional[str] = None) -> str:
    env_url = os.getenv("ZION_AI_NATIVE_URL") or os.getenv("ZION_HELSINKI_URL")
    effective_url = (env_url or explicit_url or "").strip() or DEFAULT_SERVER_URL
    return effective_url.rstrip('/')


class AINativeClient:
    """
    Client for ZION AI Native Server v2.9.2
    Provides: Knowledge search, Memory, Self-learning, AI Q&A
    """
    
    # Default to the current Zion2 AI Native endpoint.
    # Can be overridden by env var or constructor for dev/tunnel setups.
    def __init__(self, server_url: str = DEFAULT_SERVER_URL):
        self.server_url = resolve_server_url(server_url)
        self.session: Optional[aiohttp.ClientSession] = None
        self.connected = False
        self.server_info: Optional[Dict] = None
        self.last_connect_attempted: List[str] = []
        self.last_connect_error: Optional[str] = None
        self.stats = {
            "queries": 0,
            "errors": 0,
            "last_query": None
        }
    
    async def connect(self):
        """Initialize connection to AI Native server"""
        try:
            if not self.session or self.session.closed:
                # Longer timeout for AI responses (can take 90s+)
                self.session = aiohttp.ClientSession(
                    timeout=aiohttp.ClientTimeout(total=120, connect=10)
                )
            
            # Test connection (with optional fallback to localhost tunnel)
            attempted: List[str] = []
            last_error: Optional[str] = None

            env_url = os.getenv("ZION_AI_NATIVE_URL") or os.getenv("ZION_HELSINKI_URL")
            allow_fallback = not (isinstance(env_url, str) and env_url.strip())

            candidates = [self.server_url]
            if allow_fallback and self.server_url.rstrip('/') != LOCAL_FALLBACK_URL:
                candidates.append(LOCAL_FALLBACK_URL)

            for url in candidates:
                attempted.append(url)
                try:
                    async with self.session.get(f"{url}/health") as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            self.server_url = url.rstrip('/')
                            self.connected = True
                            self.server_info = data
                            self.last_connect_attempted = attempted
                            self.last_connect_error = None
                            logger.info(f"✅ Connected to AI Native {data.get('version', 'v2.9.2')} @ {self.server_url}")
                            return {"success": True, "server": data, "server_url": self.server_url, "attempted": attempted}
                        else:
                            last_error = f"HTTP {resp.status}"
                except Exception as e:
                    last_error = str(e)

            self.connected = False
            self.server_info = None
            self.last_connect_attempted = attempted
            self.last_connect_error = last_error or "connect_failed"
            return {"success": False, "error": last_error or "connect_failed", "attempted": attempted, "server_url": self.server_url}
                    
        except Exception as e:
            self.connected = False
            self.server_info = None
            self.last_connect_attempted = [self.server_url]
            self.last_connect_error = str(e)
            return {"success": False, "error": str(e)}

    async def ensure_connected(self) -> Dict:
        """Ensure we have a live connection; attempts reconnect if needed."""
        if self.connected and self.session and not self.session.closed:
            return {"success": True, "connected": True, "server_url": self.server_url}
        return await self.connect()
    
    async def disconnect(self):
        """Close connection"""
        if self.session:
            await self.session.close()
        self.connected = False
        self.server_info = None
    
    async def _post(self, endpoint: str, data: Dict) -> Dict:
        """POST request helper with auto-reconnect"""
        # Auto-reconnect if session is closed
        if not self.session or self.session.closed:
            await self.connect()
        
        if not self.session:
            return {"error": "Not connected"}
        
        try:
            url = f"{self.server_url}{endpoint}"
            async with self.session.post(url, json=data) as resp:
                self.stats["queries"] += 1
                self.stats["last_query"] = datetime.utcnow().isoformat()
                
                if resp.status == 200:
                    return await resp.json()
                else:
                    text = await resp.text()
                    return {"error": f"HTTP {resp.status}: {text[:200]}"}
                    
        except aiohttp.ServerDisconnectedError:
            # Server disconnected - try reconnect once
            logger.warning("Server disconnected, attempting reconnect...")
            await self.connect()
            if self.connected:
                try:
                    async with self.session.post(url, json=data) as resp:
                        if resp.status == 200:
                            return await resp.json()
                except Exception as e:
                    return {"error": f"Reconnect failed: {str(e)}"}
            return {"error": "Server disconnected"}
            
        except Exception as e:
            self.stats["errors"] += 1
            return {"error": str(e)}
    
    async def _get(self, endpoint: str, params: Optional[Dict] = None) -> Dict:
        """GET request helper with auto-reconnect"""
        # Auto-reconnect if session is closed
        if not self.session or self.session.closed:
            await self.connect()
        
        if not self.session:
            return {"error": "Not connected"}
        
        try:
            url = f"{self.server_url}{endpoint}"
            async with self.session.get(url, params=params or {}) as resp:
                self.stats["queries"] += 1
                self.stats["last_query"] = datetime.utcnow().isoformat()
                
                if resp.status == 200:
                    return await resp.json()
                else:
                    text = await resp.text()
                    return {"error": f"HTTP {resp.status}: {text[:200]}"}
                    
        except aiohttp.ServerDisconnectedError:
            # Server disconnected - try reconnect once
            logger.warning("Server disconnected, attempting reconnect...")
            await self.connect()
            if self.connected:
                try:
                    async with self.session.get(url, params=params or {}) as resp:
                        if resp.status == 200:
                            return await resp.json()
                except Exception as e:
                    return {"error": f"Reconnect failed: {str(e)}"}
            return {"error": "Server disconnected"}
            
        except Exception as e:
            self.stats["errors"] += 1
            return {"error": str(e)}
    
    # ========================================================================
    # KNOWLEDGE BASE
    # ========================================================================
    
    async def search_knowledge(self, query: str, limit: int = 5, category: Optional[str] = None) -> Dict:
        """Search knowledge base"""
        params = {"q": query, "limit": limit}
        if category:
            params["category"] = category
        return await self._get("/knowledge/search", params)
    
    async def get_knowledge_stats(self) -> Dict:
        """Get knowledge base statistics"""
        return await self._get("/knowledge/stats")
    
    async def get_categories(self) -> Dict:
        """Get all knowledge categories"""
        return await self._get("/knowledge/categories")
    
    # ========================================================================
    # AI CHAT
    # ========================================================================
    
    async def ask_ai(self, question: str, use_knowledge: bool = True, context_limit: int = 3) -> Dict:
        """Ask AI with knowledge base context"""
        return await self._post("/ai/ask", {
            "question": question,
            "use_knowledge": use_knowledge,
            "context_limit": context_limit
        })
    
    async def ask_ai_with_memory(self, question: str, use_knowledge: bool = True, 
                                  use_memory: bool = True, context_limit: int = 3) -> Dict:
        """Ask AI with full context (knowledge + memory + learnings)"""
        return await self._post("/ai/ask_with_memory", {
            "question": question,
            "use_knowledge": use_knowledge,
            "use_memory": use_memory,
            "context_limit": context_limit
        })
    
    # ========================================================================
    # MEMORY SYSTEM
    # ========================================================================
    
    async def add_memory(self, user_message: str, ai_response: str, 
                        tags: Optional[List[str]] = None, context: Optional[Dict] = None) -> Dict:
        """Store conversation in memory"""
        return await self._post("/memory/add", {
            "user_message": user_message,
            "ai_response": ai_response,
            "tags": tags or [],
            "context": context or {}
        })
    
    async def search_memory(self, query: str, limit: int = 5, filter_tags: Optional[str] = None) -> Dict:
        """Search conversation history"""
        params = {"q": query, "limit": limit}
        if filter_tags:
            params["filter_tags"] = filter_tags
        return await self._get("/memory/search", params)
    
    async def get_memory_context(self, query: str, n_conversations: int = 3, n_learnings: int = 2) -> Dict:
        """Get relevant memory context"""
        params = {
            "q": query,
            "n_conversations": n_conversations,
            "n_learnings": n_learnings
        }
        return await self._get("/memory/context", params)
    
    async def get_memory_stats(self) -> Dict:
        """Get memory statistics"""
        return await self._get("/memory/stats")
    
    # ========================================================================
    # SELF-LEARNING
    # ========================================================================
    
    async def analyze_log(self, log_path: str, category: str = "pool") -> Dict:
        """Analyze log file"""
        return await self._post("/learning/analyze_log", {
            "log_path": log_path,
            "category": category
        })
    
    async def get_learning_insights(self, category: Optional[str] = None, limit: int = 10) -> Dict:
        """Get learned insights"""
        params = {"limit": limit}
        if category:
            params["category"] = category
        return await self._get("/learning/insights", params)
    
    async def analyze_system_health(self) -> Dict:
        """Get system health analysis with recommendations"""
        return await self._post("/learning/health_analysis", {})
    
    async def get_learning_summary(self) -> Dict:
        """Get learning pattern summary"""
        return await self._get("/learning/summary")
    
    # ========================================================================
    # MONITORING
    # ========================================================================
    
    async def get_blockchain_status(self) -> Dict:
        """Get blockchain status"""
        return await self._get("/blockchain/status")
    
    async def get_blockchain_health(self) -> Dict:
        """Get blockchain health check"""
        return await self._get("/blockchain/health")
    
    async def monitor_pools(self) -> Dict:
        """Monitor all mining pools"""
        return await self._get("/pool/monitor")
    
    async def get_system_health(self) -> Dict:
        """Get comprehensive system health"""
        return await self._get("/system/health")
    
    # ========================================================================
    # HIGH-LEVEL METHODS
    # ========================================================================
    
    async def chat(self, messages: List[Dict]) -> Dict:
        """
        Chat with AI (with memory and context)
        
        Args:
            messages: List of {"role": "user"/"assistant", "content": "..."}
        
        Returns:
            AI response with full context awareness
        """
        if not messages:
            return {"error": "No messages provided"}

        # Reconnect if server became available later
        conn = await self.ensure_connected()
        if not conn.get("success"):
            return {
                "error": f"Not connected to AI Native server: {conn.get('error')}",
                "attempted": conn.get("attempted") or self.last_connect_attempted,
                "server_url": self.server_url,
            }
        
        # Get last user message
        last_user = next((m for m in reversed(messages) if m.get("role") == "user"), None)
        if not last_user:
            return {"error": "No user message found"}
        
        question = last_user.get("content", "")
        
        # Ask AI with full context
        response = await self.ask_ai_with_memory(question, use_knowledge=True, use_memory=True)
        
        if "error" not in response:
            # Store this conversation
            await self.add_memory(
                user_message=question,
                ai_response=response.get("answer", ""),
                tags=["desktop-agent", "chat"],
                context={"timestamp": datetime.utcnow().isoformat()}
            )
        
        return response
    
    async def get_dashboard_data(self) -> Dict:
        """
        Get all data for dashboard view
        
        Returns comprehensive system status
        """
        try:
            # Parallel requests for speed
            results = await asyncio.gather(
                self.get_system_health(),
                self.get_blockchain_status(),
                self.monitor_pools(),
                self.get_memory_stats(),
                self.get_learning_summary(),
                return_exceptions=True
            )
            
            system_health, blockchain, pools, memory, learning = results
            
            return {
                "success": True,
                "system_health": system_health if not isinstance(system_health, Exception) else {"error": str(system_health)},
                "blockchain": blockchain if not isinstance(blockchain, Exception) else {"error": str(blockchain)},
                "pools": pools if not isinstance(pools, Exception) else {"error": str(pools)},
                "memory": memory if not isinstance(memory, Exception) else {"error": str(memory)},
                "learning": learning if not isinstance(learning, Exception) else {"error": str(learning)},
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def get_stats(self) -> Dict:
        """Get client statistics"""
        return {
            "connected": self.connected,
            "server_url": self.server_url,
            "queries": self.stats["queries"],
            "errors": self.stats["errors"],
            "last_query": self.stats["last_query"],
            "error_rate": self.stats["errors"] / max(1, self.stats["queries"])
        }


# ============================================================================
# STANDALONE MODE (JSON-lines communication with Desktop Agent)
# ============================================================================

async def handle_stdin():
    """Read commands from stdin (JSON-lines)"""
    client = AINativeClient()
    
    logger.info("🌟 AI Native Client started")
    logger.info("Connecting to server...")
    
    # Connect
    result = await client.connect()
    
    # Need to signal ready even if connection fails, otherwise main.js waits 12s then throws
    is_connected = result.get("success", False)
    if is_connected:
        logger.info(f"✅ Connected to AI Native server @ {client.server_url}")
    else:
        logger.warning(f"⚠️ Connection failed: {result.get('error')} (Client running in offline mode)")
    
    print(json.dumps({
        "status": "ready", 
        "server": result.get("server"), 
        "connected": is_connected,
        "error": result.get("error"),
        "server_url": result.get("server_url") or client.server_url,
        "attempted": result.get("attempted")
    }))
    sys.stdout.flush()
    
    # Command loop
    try:
        stop_requested = False
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            
            try:
                cmd_data = json.loads(line)
                cmd = cmd_data.get("cmd")
                
                response = None
                
                # Route commands
                if cmd == "start":
                    # Compatibility shim for older desktop-agent main.js.
                    # Optionally allow overriding server url.
                    start_config = cmd_data.get("config") if isinstance(cmd_data.get("config"), dict) else {}
                    requested_url = (
                        cmd_data.get("server_url")
                        or cmd_data.get("url")
                        or start_config.get("server_url")
                        or start_config.get("pool_url")
                    )
                    if isinstance(requested_url, str) and requested_url.strip():
                        new_url = requested_url.strip()
                        if new_url.rstrip('/') != client.server_url:
                            client.server_url = new_url.rstrip('/')
                            try:
                                await client.disconnect()
                            except Exception:
                                pass
                            result = await client.connect()
                            # connect() already updates server_info
                    response = {
                        "ok": True,
                        "connected": client.connected,
                        "server_url": client.server_url,
                        "server": client.server_info,
                    }

                elif cmd == "search_knowledge":
                    response = await client.search_knowledge(
                        cmd_data.get("query", ""),
                        cmd_data.get("limit", 5),
                        cmd_data.get("category")
                    )
                
                elif cmd == "ask_ai":
                    response = await client.ask_ai(
                        cmd_data.get("question", ""),
                        cmd_data.get("use_knowledge", True),
                        cmd_data.get("context_limit", 3)
                    )
                
                elif cmd == "chat":
                    response = await client.chat(cmd_data.get("messages", []))
                
                elif cmd == "add_memory":
                    response = await client.add_memory(
                        cmd_data.get("user_message", ""),
                        cmd_data.get("ai_response", ""),
                        cmd_data.get("tags"),
                        cmd_data.get("context")
                    )
                
                elif cmd == "search_memory":
                    response = await client.search_memory(
                        cmd_data.get("query", ""),
                        cmd_data.get("limit", 5)
                    )
                
                elif cmd == "system_health":
                    response = await client.analyze_system_health()
                
                elif cmd == "blockchain_status":
                    response = await client.get_blockchain_status()
                
                elif cmd == "pool_monitor":
                    response = await client.monitor_pools()
                
                elif cmd == "dashboard":
                    response = await client.get_dashboard_data()
                
                elif cmd == "stats":
                    response = await client.get_stats()

                elif cmd == "status":
                    response = {
                        "ok": True,
                        "connected": client.connected,
                        "server_url": client.server_url,
                        "server": client.server_info,
                        "attempted": client.last_connect_attempted,
                        "last_error": client.last_connect_error,
                        "client": {
                            "queries": client.stats.get("queries", 0),
                            "errors": client.stats.get("errors", 0),
                            "last_query": client.stats.get("last_query"),
                        },
                    }

                elif cmd == "stop":
                    response = {"ok": True}
                    stop_requested = True
                
                elif cmd == "ping":
                    response = {"pong": True, "connected": client.connected}
                
                else:
                    response = {"error": f"Unknown command: {cmd}"}
                
                # Send response
                print(json.dumps(response))
                sys.stdout.flush()

                if stop_requested:
                    break
                
            except json.JSONDecodeError as e:
                print(json.dumps({"error": "invalid_json", "details": str(e)}))
                sys.stdout.flush()
            
            except Exception as e:
                print(json.dumps({"error": "command_failed", "details": str(e)}))
                sys.stdout.flush()
    
    finally:
        await client.disconnect()


if __name__ == "__main__":
    if "--test" in sys.argv:
        # Test mode
        async def test():
            client = AINativeClient()
            
            print("🧪 Testing AI Native Client...")
            print("\n1. Connecting...")
            result = await client.connect()
            print(f"   Result: {result}")
            
            if result.get("success"):
                print("\n2. Knowledge search...")
                kb = await client.search_knowledge("mining pool")
                print(f"   Found: {kb.get('count', 0)} documents")
                
                print("\n3. Memory stats...")
                mem = await client.get_memory_stats()
                print(f"   Memory: {json.dumps(mem, indent=2)}")
                
                print("\n4. System health...")
                health = await client.get_system_health()
                print(f"   Health: {health.get('health_score', 0)}/100")
                
                print("\n5. AI chat...")
                chat_resp = await client.chat([
                    {"role": "user", "content": "What is ZION?"}
                ])
                print(f"   Answer: {chat_resp.get('answer', 'N/A')[:100]}...")
                
                print("\n6. Dashboard data...")
                dashboard = await client.get_dashboard_data()
                print(f"   Success: {dashboard.get('success')}")
                
                await client.disconnect()
                print("\n✅ All tests completed!")
            else:
                print("\n❌ Connection failed - tests skipped")
        
        asyncio.run(test())
    
    else:
        # Normal mode - JSON-lines communication
        asyncio.run(handle_stdin())
