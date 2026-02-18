#!/usr/bin/env python3
"""
🌌 ZION AI Native Bridge for Desktop Agent
Simple wrapper that connects desktop agent to AI Native system
"""

import sys
import json
import asyncio
import logging
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.append(str(PROJECT_ROOT))

try:
    from ai.ai_task_handler import AITaskHandler
    AI_NATIVE_AVAILABLE = True
except ImportError:
    AI_NATIVE_AVAILABLE = False

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger("AIBridge")


class AIBridge:
    """
    Bridge between Desktop Agent and AI Native
    
    Komunikuje přes JSON-lines (stejně jako afterburner_service.py)
    """
    
    def __init__(self):
        self.handler = None
        self.enabled = False
        self.stats = {
            "tasks_completed": 0,
            "tasks_failed": 0,
            "earnings": 0.0,
            "status": "idle"
        }
    
    async def start(self, config):
        """Start AI Native task handler"""
        if not AI_NATIVE_AVAILABLE:
            return {"error": "AI Native not available"}
        
        try:
            miner_address = config.get("wallet", "")
            pool_url = config.get("pool_url", "http://localhost:8001")
            consciousness_level = config.get("consciousness_level", 1)
            gpu_available = config.get("gpu", False)
            
            if not miner_address:
                return {"error": "No wallet address configured"}
            
            self.handler = AITaskHandler(
                miner_address=miner_address,
                pool_url=pool_url,
                consciousness_level=consciousness_level,
                gpu_available=gpu_available,
                gpu_memory=8192 if gpu_available else 0,
                cpu_cores=config.get("threads", 4)
            )
            
            # Register miner
            success = await self.handler.register()
            
            if success:
                self.enabled = True
                self.stats["status"] = "running"
                
                # Start task loop in background
                asyncio.create_task(self._task_loop())
                
                return {
                    "status": "started",
                    "address": miner_address,
                    "consciousness": consciousness_level,
                    "supported_tasks": self.handler.supported_tasks
                }
            else:
                return {"error": "Registration failed"}
                
        except Exception as e:
            return {"error": str(e)}
    
    async def _task_loop(self):
        """Background task processing loop"""
        while self.enabled and self.handler:
            try:
                # Poll for task
                task = await self.handler.poll_tasks()
                
                if task:
                    # Execute
                    result = await self.handler.execute_task(task)
                    
                    # Submit result
                    success = await self.handler.submit_result(
                        task['task_id'],
                        result
                    )
                    
                    if success:
                        self.stats["tasks_completed"] += 1
                        self.stats["earnings"] += task.get("reward", 0)
                    else:
                        self.stats["tasks_failed"] += 1
                else:
                    # No tasks, wait
                    await asyncio.sleep(5)
                    
            except Exception as e:
                logger.error(f"Task loop error: {e}")
                await asyncio.sleep(5)
    
    async def stop(self):
        """Stop AI Native handler"""
        self.enabled = False
        self.stats["status"] = "stopped"
        
        if self.handler:
            self.handler.stop()
            self.handler = None
        
        return {"status": "stopped"}
    
    async def get_stats(self):
        """Get current statistics"""
        if self.handler:
            self.stats["tasks_completed"] = self.handler.tasks_completed
            self.stats["earnings"] = self.handler.earnings
        
        return self.stats
    
    async def chat(self, data):
        """
        Handle chat message with consciousness-aware AI
        
        For now, uses simple rule-based responses.
        Later: integrate with local LLM (Ollama/local model)
        """
        messages = data.get("messages", [])
        system_prompt = data.get("systemPrompt", "")
        
        if not messages:
            return {"error": "No messages provided"}
        
        # Get last user message
        last_msg = next((m for m in reversed(messages) if m.get("role") == "user"), None)
        if not last_msg:
            return {"error": "No user message found"}
        
        user_text = last_msg.get("content", "").lower()
        
        # Consciousness-aware responses (v1 - simple rules)
        # TODO: Replace with local LLM integration when Ollama is ready
        
        if "consciousness" in user_text or "level" in user_text:
            response = """🌟 **Consciousness Mining System**

ZION uses a unique Proof-of-Consciousness system where your dedication, learning, and contribution increase your mining rewards.

**Consciousness Levels:**
• PHYSICAL (1.0x) - Starting level
• MENTAL (1.1x) - Learning and growing
• COSMIC (2.0x) - Deep understanding
• ON_THE_STAR (15x) - Master level

**How to level up:**
✨ Mine consistently
✨ Complete AI Native tasks
✨ Learn blockchain concepts
✨ Contribute to community

Your journey is measured not just in hashrate, but in wisdom. 🙏"""
        
        elif "mining" in user_text or "how to mine" in user_text:
            response = """⛏️ **Mining Guide**

ZION combines traditional PoW mining with consciousness rewards:

1. **Native Mining** - Use CPU/GPU to solve cryptographic puzzles
2. **AI Native Tasks** - Help train models, analyze data
3. **Pool Mining** - Join forces with others

**Start mining:**
• Enable mining in AI view
• Set your worker name
• Choose CPU or GPU mode
• Watch your consciousness grow!

Mining is not just computation - it's contribution. 🌌"""
        
        elif "ai native" in user_text or "ai task" in user_text:
            status = "running" if self.enabled else "stopped"
            tasks = self.stats.get("tasks_completed", 0)
            earnings = self.stats.get("earnings", 0)
            
            response = f"""🤖 **AI Native System Status**

**Status:** {status.upper()}
**Tasks Completed:** {tasks}
**Earnings:** {earnings:.4f} ZION

**What is AI Native?**
You help train AI models and earn ZION rewards. Your consciousness level multiplies your earnings!

**Supported tasks:**
• Image classification
• Text analysis  
• Model evaluation
• Data labeling

**Purpose:** Build AI that serves consciousness evolution, not just profit. ✨"""
        
        elif "help" in user_text or "commands" in user_text:
            response = """💬 **ZION AI Native Chat**

I'm your offline AI companion! Ask me about:

🔹 **Mining** - How to mine, algorithms, rewards
🔹 **Consciousness** - Levels, XP system, bonuses
🔹 **AI Native** - Tasks, earnings, contribution
🔹 **Blockchain** - ZION architecture, transactions
🔹 **Community** - DAO, humanitarian values

**Special commands:**
• `/ab stats` - Afterburner status
• `/ab task <type>` - Create AI task

I operate 100% offline and respect your privacy. Your data never leaves your machine. 🔒

Ask me anything! 🌟"""
        
        elif "reward" in user_text or "earning" in user_text:
            response = """💰 **ZION Reward Economics**

**Block Reward:** 50 ZION (constant, no halving)
**Consciousness Bonus:** Up to 1,569 ZION (based on your level!)
**Total Possible:** 1,619 ZION per block

**Distribution:**
• 89% to miner (you!)
• 10% humanitarian pool
• 1% pool fee

**Consciousness Multipliers:**
• PHYSICAL: 1.0x
• MENTAL: 1.1x  
• COSMIC: 2.0x
• ON_THE_STAR: 15.0x

Higher consciousness = Higher rewards. This is by design. 🌈

Grow your consciousness, grow your impact. 💚"""
        
        else:
            # Generic helpful response
            response = f"""I hear your question: "{last_msg.get('content', '')}"

I'm ZION AI Native - your offline AI companion integrated into this desktop agent. While I don't have access to cloud models, I can help you with:

✨ **Mining guidance** - How to mine effectively
✨ **Consciousness system** - Understanding levels and XP
✨ **AI Native tasks** - Earning through AI contribution
✨ **ZION blockchain** - Architecture and philosophy

Try asking about specific topics like "consciousness levels" or "how to mine" for detailed answers!

**Current AI Native Status:** {"🟢 Running" if self.enabled else "🔴 Stopped"}
**Tasks Completed:** {self.stats.get('tasks_completed', 0)}

🙏 I'm here to help you on your journey."""
        
        return {
            "content": response,
            "role": "assistant",
            "source": "ai-native-local",
            "consciousness_aware": True
        }
    
    async def handle_command(self, cmd_data):
        """Handle command from desktop agent"""
        cmd = cmd_data.get("cmd")
        
        if cmd == "start":
            return await self.start(cmd_data.get("config", {}))
        elif cmd == "stop":
            return await self.stop()
        elif cmd == "stats":
            return await self.get_stats()
        elif cmd == "status":
            return {
                "enabled": self.enabled,
                "status": self.stats["status"]
            }
        elif cmd == "chat":
            return await self.chat(cmd_data.get("data", {}))
        else:
            return {"error": f"Unknown command: {cmd}"}


async def main():
    """Main JSON-lines RPC loop"""
    bridge = AIBridge()
    
    # Check availability
    if not AI_NATIVE_AVAILABLE:
        print(json.dumps({
            "type": "error",
            "message": "AI Native system not available"
        }), flush=True)
        return
    
    # Ready signal
    print(json.dumps({"type": "ready"}), flush=True)
    
    # Main loop - čte příkazy z stdin
    try:
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            
            try:
                cmd_data = json.loads(line)
                result = await bridge.handle_command(cmd_data)
                
                # Odpověď na stdout
                print(json.dumps({
                    "type": "response",
                    "data": result
                }), flush=True)
                
            except json.JSONDecodeError:
                print(json.dumps({
                    "type": "error",
                    "message": "Invalid JSON"
                }), flush=True)
            except Exception as e:
                print(json.dumps({
                    "type": "error",
                    "message": str(e)
                }), flush=True)
                
    except KeyboardInterrupt:
        await bridge.stop()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)
