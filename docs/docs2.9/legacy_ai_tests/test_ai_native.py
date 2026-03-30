#!/usr/bin/env python3
"""
🧪 ZION AI Native - Quick Test Suite
Tests all components without requiring Ollama running

Usage:
    python3 test_ai_native.py
"""

import sys
from pathlib import Path

# Colors for output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"

def print_test(name: str, status: str, message: str = ""):
    """Print test result"""
    color = GREEN if status == "✅" else RED if status == "❌" else YELLOW
    print(f"{color}{status}{RESET} {name}")
    if message:
        print(f"   {message}")

def test_imports():
    """Test if all required modules can be imported"""
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}TEST 1: Module Imports{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")
    
    results = []
    
    # Test core imports
    try:
        import asyncio
        print_test("asyncio", "✅", "Built-in async support")
        results.append(True)
    except ImportError as e:
        print_test("asyncio", "❌", str(e))
        results.append(False)
    
    try:
        import json
        print_test("json", "✅", "Built-in JSON support")
        results.append(True)
    except ImportError as e:
        print_test("json", "❌", str(e))
        results.append(False)
    
    try:
        import sqlite3
        print_test("sqlite3", "✅", "Built-in database support")
        results.append(True)
    except ImportError as e:
        print_test("sqlite3", "❌", str(e))
        results.append(False)
    
    # Test httpx
    try:
        import httpx
        print_test("httpx", "✅", "HTTP client for Ollama")
        results.append(True)
    except ImportError:
        print_test("httpx", "❌", "Install with: pip install httpx")
        results.append(False)
    
    # Test optional dependencies
    try:
        import chromadb
        print_test("chromadb", "✅", "Vector database available")
        results.append(True)
    except ImportError:
        print_test("chromadb", "⚠️", "Optional - install for knowledge extraction")
        # Not a failure
    
    try:
        from sentence_transformers import SentenceTransformer
        print_test("sentence-transformers", "✅", "Embeddings available")
        results.append(True)
    except ImportError:
        print_test("sentence-transformers", "⚠️", "Optional - install for semantic search")
        # Not a failure
    
    return all(results)

def test_memory_system():
    """Test memory system functionality"""
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}TEST 2: Memory System{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")
    
    try:
        from zion_memory_system import ZionMemory, Conversation
        from datetime import datetime
        
        # Initialize memory
        memory = ZionMemory(db_path="./test_memory.db")
        print_test("Memory initialization", "✅", f"Session: {memory.short_term.session_id}")
        
        # Add test conversation
        memory.add_conversation(
            user_msg="Test question about mining",
            ai_response="Test answer about RandomX algorithm",
            context={"file": "test.py", "task": "testing"}
        )
        print_test("Store conversation", "✅", "Conversation saved")
        
        # Recall conversation
        results = memory.recall("mining", n=1)
        if results and len(results) > 0:
            print_test("Recall conversation", "✅", f"Found {len(results)} results")
        else:
            print_test("Recall conversation", "⚠️", "No results (embeddings not available)")
        
        # Get stats
        stats = memory.get_stats()
        print_test("Memory stats", "✅", 
                   f"Conversations: {stats['long_term']['conversations']}")
        
        # Cleanup
        Path("./test_memory.db").unlink(missing_ok=True)
        Path("./test_memory.db-shm").unlink(missing_ok=True)
        Path("./test_memory.db-wal").unlink(missing_ok=True)
        
        return True
        
    except Exception as e:
        print_test("Memory system", "❌", str(e))
        return False

def test_context_engine():
    """Test context engine"""
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}TEST 3: Context Engine{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")
    
    try:
        from zion_ai_native_prototype import ZionContextEngine
        from pathlib import Path
        
        # Initialize
        engine = ZionContextEngine(Path.cwd().parent)
        print_test("Context engine init", "✅", "Patterns loaded")
        
        # Test pattern detection
        code = "async def mine_block(): pass"
        patterns = engine._find_relevant_patterns(code)
        print_test("Pattern detection", "✅", f"Found {len(patterns)} relevant patterns")
        
        # Test context building
        context = engine.build_context(
            file_path="test.py",
            code_before="async def calculate_reward(height: int):",
            code_after="    return reward",
            cursor_line=10
        )
        
        if "File: test.py" in context:
            print_test("Context building", "✅", "Context generated")
        else:
            print_test("Context building", "❌", "Context incomplete")
            return False
        
        return True
        
    except Exception as e:
        print_test("Context engine", "❌", str(e))
        return False

def test_ollama_client():
    """Test Ollama client (without requiring Ollama running)"""
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}TEST 4: Ollama Client{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")
    
    try:
        from zion_ai_native_prototype import OllamaClient
        
        # Initialize client
        client = OllamaClient()
        print_test("Ollama client init", "✅", f"Base URL: {client.base_url}")
        
        # Test health check (won't fail if Ollama not running)
        import asyncio
        
        async def check():
            is_running = await client.check_health()
            return is_running
        
        is_running = asyncio.run(check())
        
        if is_running:
            print_test("Ollama server", "✅", "Ollama is running and ready")
        else:
            print_test("Ollama server", "⚠️", 
                      "Ollama not running - start with: ollama serve")
        
        return True
        
    except Exception as e:
        print_test("Ollama client", "❌", str(e))
        return False

def test_zion_ai_native():
    """Test main ZionAINative class"""
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}TEST 5: ZION AI Native{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")
    
    try:
        from zion_ai_native_prototype import ZionAINative
        from pathlib import Path
        
        # Initialize
        ai = ZionAINative(Path.cwd().parent)
        print_test("AI initialization", "✅", f"CL Level: {ai.consciousness_level}")
        
        # Test consciousness assessment
        test_code = '''
def calculate_reward(height: int) -> float:
    """Calculate block reward"""
    base = 50.0
    halvings = height // 210000
    return base / (2 ** halvings)
'''
        score = ai._assess_consciousness(test_code)
        print_test("Consciousness assessment", "✅", f"Score: {score:.1f}/9.0")
        
        # Test system prompt
        prompt = ai._build_system_prompt()
        if "AI Native" in prompt and "consciousness" in prompt.lower():
            print_test("System prompt", "✅", "Philosophy integrated")
        else:
            print_test("System prompt", "❌", "Prompt incomplete")
            return False
        
        return True
        
    except Exception as e:
        print_test("ZION AI Native", "❌", str(e))
        return False

def main():
    """Run all tests"""
    print(f"\n{GREEN}{'='*60}{RESET}")
    print(f"{GREEN}🧪 ZION AI NATIVE - TEST SUITE{RESET}")
    print(f"{GREEN}{'='*60}{RESET}")
    
    results = []
    
    # Run tests
    results.append(("Imports", test_imports()))
    results.append(("Memory System", test_memory_system()))
    results.append(("Context Engine", test_context_engine()))
    results.append(("Ollama Client", test_ollama_client()))
    results.append(("ZION AI Native", test_zion_ai_native()))
    
    # Summary
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}TEST SUMMARY{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = f"{GREEN}✅ PASS{RESET}" if result else f"{RED}❌ FAIL{RESET}"
        print(f"{status} - {test_name}")
    
    print(f"\n{BLUE}{'='*60}{RESET}")
    
    if passed == total:
        print(f"{GREEN}🎉 ALL TESTS PASSED ({passed}/{total}){RESET}")
        print(f"{GREEN}{'='*60}{RESET}\n")
        return 0
    else:
        print(f"{YELLOW}⚠️  SOME TESTS FAILED ({passed}/{total}){RESET}")
        print(f"{YELLOW}{'='*60}{RESET}\n")
        
        print(f"{YELLOW}Next steps:{RESET}")
        print(f"  1. Install missing dependencies:")
        print(f"     pip install httpx")
        print(f"  2. Optional (for better features):")
        print(f"     pip install chromadb sentence-transformers")
        print(f"  3. Start Ollama:")
        print(f"     ollama serve")
        print()
        return 1

if __name__ == "__main__":
    sys.exit(main())
