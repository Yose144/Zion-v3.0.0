#!/bin/bash
echo "🔧 Applying pool handshake fix..."

ssh root@91.98.122.165 << 'REMOTE'
cd /root/zion

# Backup původního pool
cp zion_universal_pool_v2.py zion_universal_pool_v2.py.backup

# Přidej welcome message do pool
python3 << 'PYTHON'
import re

with open('zion_universal_pool_v2.py', 'r') as f:
    content = f.read()

# Najdi async def handle_client
match = re.search(r'(async def handle_client\(self, reader, writer\):.*?)(try:)', content, re.DOTALL)

if match:
    # Přidej welcome message before try
    welcome_code = '''
        # WELCOME MESSAGE - send immediately to client
        try:
            welcome = json.dumps({
                "jsonrpc": "2.0",
                "id": None,
                "method": "mining.set_difficulty",
                "params": [32]
            }) + "\\n"
            
            writer.write(welcome.encode('utf-8'))
            await writer.drain()
            logger.info(f"Sent welcome to {addr}")
        except Exception as e:
            logger.error(f"Failed to send welcome: {e}")
        
        '''
    
    new_content = content[:match.end(1)] + welcome_code + match.group(2) + content[match.end():]
    
    with open('zion_universal_pool_v2.py', 'w') as f:
        f.write(new_content)
    print("✅ Welcome message added!")
else:
    print("❌ Could not find handle_client!")

PYTHON

# Spustí pool znovu
echo "🚀 Restarting pool..."
python3 zion_universal_pool_v2.py --port 3333 > pool_280.log 2>&1 &
sleep 2
ps aux | grep pool | grep -v grep

REMOTE

echo "✅ Fix applied and pool restarted!"
