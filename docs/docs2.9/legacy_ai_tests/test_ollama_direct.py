import httpx
import asyncio
import json

async def test():
    try:
        print("🔍 Testing Ollama connection...")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            print("📡 Sending request to http://localhost:11434/api/generate")
            
            response = await client.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": "codellama:7b",
                    "prompt": "Write a simple Python hello world function",
                    "stream": False
                }
            )
            
            print(f"✅ Status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ Response: {result.get('response', 'NO RESPONSE')[:200]}")
            else:
                print(f"❌ Error: {response.text}")
    
    except Exception as e:
        print(f"❌ Exception: {e}")
        import traceback
        traceback.print_exc()

asyncio.run(test())
