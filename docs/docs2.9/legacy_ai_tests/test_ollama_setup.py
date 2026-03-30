#!/usr/bin/env python3
"""
🧪 Test Ollama Setup
Quick test to verify Ollama + CodeLlama are working

Usage:
    python test_ollama_setup.py
"""

import httpx
import json
import sys

def test_ollama_server():
    """Test if Ollama server is running"""
    print("🔍 Testing Ollama server...")
    try:
        response = httpx.get("http://localhost:11434/api/tags", timeout=5.0)
        if response.status_code == 200:
            data = response.json()
            models = data.get("models", [])
            print(f"✅ Ollama is running")
            print(f"   Models installed: {len(models)}")
            for model in models:
                print(f"   - {model['name']}")
            return True
        else:
            print(f"❌ Ollama returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Ollama is NOT running: {e}")
        print("   Run: ollama serve")
        return False

def test_codellama():
    """Test CodeLlama model"""
    print("\n🤖 Testing CodeLlama model...")
    try:
        print("   Sending test prompt (this may take 30-60 seconds)...")
        response = httpx.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "codellama:7b",
                "prompt": "Write a Python function to calculate factorial",
                "stream": False,
                "options": {
                    "num_predict": 100
                }
            },
            timeout=120.0
        )
        
        if response.status_code == 200:
            result = response.json()
            generated = result.get("response", "")
            print(f"✅ CodeLlama is working!")
            print(f"\n📝 Generated code:")
            print("=" * 60)
            print(generated)
            print("=" * 60)
            return True
        else:
            print(f"❌ CodeLlama returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ CodeLlama test failed: {e}")
        if "codellama:7b" in str(e):
            print("   Model not found. Download with: ollama pull codellama:7b")
        return False

def main():
    """Run all tests"""
    print("=" * 60)
    print("🚀 ZION AI Native - Ollama Setup Test")
    print("=" * 60)
    print()
    
    # Test 1: Server
    server_ok = test_ollama_server()
    if not server_ok:
        print("\n⚠️  Tests aborted - Ollama server not running")
        sys.exit(1)
    
    # Test 2: CodeLlama
    codellama_ok = test_codellama()
    
    # Summary
    print("\n" + "=" * 60)
    if server_ok and codellama_ok:
        print("✅ ALL TESTS PASSED!")
        print("\n🎉 You're ready to run:")
        print("   python zion_ai_native_prototype.py")
    else:
        print("❌ SOME TESTS FAILED")
        if not codellama_ok:
            print("\n💡 Download the model:")
            print("   ollama pull codellama:7b")
    print("=" * 60)

if __name__ == "__main__":
    main()
