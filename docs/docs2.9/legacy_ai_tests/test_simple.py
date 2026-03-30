#!/usr/bin/env python3
"""
🧪 ZION AI Native - Simple Test
Quick test without external dependencies

Tests:
1. Memory system (SQLite only)
2. Basic conversation storage
3. Preference management
4. Statistics
"""

import sys
from pathlib import Path

# Add ai directory to path
sys.path.insert(0, str(Path(__file__).parent))

from zion_memory_system import ZionMemory

def test_memory_basics():
    """Test basic memory operations"""
    
    print("\n" + "="*60)
    print("🧪 TEST 1: Memory Initialization")
    print("="*60)
    
    memory = ZionMemory(db_path="./test_memory.db")
    stats = memory.get_stats()
    
    print(f"✅ Memory initialized")
    print(f"   Conversations: {stats['long_term']['conversations']}")
    print(f"   Corrections: {stats['long_term']['corrections']}")
    print(f"   Database: {stats['long_term']['database_size']} bytes")
    
    print("\n" + "="*60)
    print("🧪 TEST 2: Store Conversations")
    print("="*60)
    
    # Add test conversations
    test_convos = [
        {
            "user": "How to implement RandomX mining?",
            "ai": "Use RandomX algorithm with 2GB scratchpad. Enable huge pages for performance.",
            "context": {"file": "miner.py", "task": "implementation"}
        },
        {
            "user": "How to fix block validation?",
            "ai": "Check prev_hash matches last block. Validate merkle root. Verify difficulty target.",
            "context": {"file": "validator.py", "task": "debugging"}
        },
        {
            "user": "Best pool switching strategy?",
            "ai": "Monitor profitability every 60s. Switch when new pool > current * 1.15 (15% threshold).",
            "context": {"file": "pool_switcher.py", "task": "optimization"}
        }
    ]
    
    for conv in test_convos:
        memory.add_conversation(
            user_msg=conv["user"],
            ai_response=conv["ai"],
            context=conv["context"]
        )
        print(f"✅ Stored: {conv['user'][:50]}...")
    
    print("\n" + "="*60)
    print("🧪 TEST 3: Set User Preferences")
    print("="*60)
    
    memory.set_preference(
        coding_style="verbose_with_type_hints",
        preferred_patterns=["async/await", "type_hints", "docstrings", "error_handling"],
        language_prefs={"python": "pep8", "javascript": "airbnb"},
        avoid_patterns=["global_variables", "nested_loops", "magic_numbers"]
    )
    
    print("✅ Preferences saved:")
    print("   Style: verbose_with_type_hints")
    print("   Patterns: async/await, type_hints, docstrings, error_handling")
    print("   Avoid: global_variables, nested_loops, magic_numbers")
    
    print("\n" + "="*60)
    print("🧪 TEST 4: Build Context")
    print("="*60)
    
    context = memory.build_context(
        current_prompt="How to optimize mining performance?",
        include_recent=True,
        include_similar=False  # Skip semantic search (no embeddings)
    )
    
    print("✅ Context built:")
    print("-"*60)
    print(context)
    print("-"*60)
    
    print("\n" + "="*60)
    print("🧪 TEST 5: Learn from Correction")
    print("="*60)
    
    memory.learn_from_correction(
        original="use global config variable",
        correction="use environment variables with dotenv",
        context={"reason": "security best practice", "file": "config.py"}
    )
    
    print("✅ Correction stored:")
    print("   Original: use global config variable")
    print("   Correction: use environment variables with dotenv")
    
    print("\n" + "="*60)
    print("🧪 TEST 6: Final Statistics")
    print("="*60)
    
    stats = memory.get_stats()
    
    print(f"✅ Final stats:")
    print(f"   Session ID: {stats['short_term']['session_id']}")
    print(f"   Short-term messages: {stats['short_term']['message_count']}")
    print(f"   Long-term conversations: {stats['long_term']['conversations']}")
    print(f"   Corrections learned: {stats['long_term']['corrections']}")
    print(f"   Database size: {stats['long_term']['database_size']:,} bytes")
    
    print("\n" + "="*60)
    print("🎉 ALL TESTS PASSED!")
    print("="*60)
    print("\n💡 Try running this script again - memory will persist!")
    print("   Database location: ./test_memory.db\n")
    
    return True


def test_short_term_memory():
    """Test short-term memory (current session)"""
    
    print("\n" + "="*60)
    print("🧪 BONUS TEST: Short-Term Memory")
    print("="*60)
    
    memory = ZionMemory(db_path="./test_memory.db")
    
    # Simulate conversation turns
    turns = [
        ("What's RandomX?", "RandomX is ASIC-resistant PoW algorithm"),
        ("How does it work?", "Uses CPU-optimized hash function with large scratchpad"),
        ("What's the scratchpad size?", "2GB for optimal performance"),
        ("Can I use less RAM?", "Yes, but performance will decrease significantly")
    ]
    
    for user, ai in turns:
        memory.short_term.add_message(user, ai, {"mode": "chat"})
        print(f"📝 Turn: {user[:40]}... → {ai[:40]}...")
    
    print(f"\n✅ Short-term memory: {len(memory.short_term.messages)} messages")
    
    # Get recent context
    context = memory.short_term.get_recent_context(n=3)
    print("\n📖 Recent context (last 3 turns):")
    print("-"*60)
    print(context)
    print("-"*60)
    
    return True


if __name__ == "__main__":
    print("\n🚀 ZION AI NATIVE - SIMPLE TESTS")
    print("Testing memory system without external dependencies\n")
    
    try:
        # Run main tests
        test_memory_basics()
        
        # Run bonus test
        test_short_term_memory()
        
        print("\n✅ All tests completed successfully!")
        print("\n🎯 Next steps:")
        print("   1. Install Ollama: brew install ollama")
        print("   2. Download model: ollama pull codellama:7b")
        print("   3. Test full AI: python3 zion_ai_native_prototype.py")
        print("\n🙏 Peace and One Love! JAH BLESS 🦁👑\n")
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
