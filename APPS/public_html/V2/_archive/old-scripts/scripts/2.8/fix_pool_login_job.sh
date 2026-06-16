#!/bin/bash
echo "🔧 Fixing pool - adding JOB to login response..."

ssh root@91.98.122.165 << 'REMOTE'
cd /root/zion

# Backup
cp zion_universal_pool_v2.py zion_universal_pool_v2.py.bak2

# Fix: Add job to login response
python3 << 'PYTHON'
import re

with open('zion_universal_pool_v2.py', 'r') as f:
    content = f.read()

# Najdi handle_xmrig_login response
# Měníme z:
#   response = json.dumps({"id": ..., "jsonrpc": ..., "result": {"id": ..., "status": "OK"}})
# Na:
#   response = json.dumps({"id": ..., "jsonrpc": ..., "result": {"id": ..., "job": job_data, "status": "OK"}})

# Najdi kde se generuje response v handle_xmrig_login
pattern = r'(response = json\.dumps\(\{\s*[\'"]id[\'"]: data\.get\([\'"]id[\'"]\),\s*[\'"]jsonrpc[\'"]: [\'"]2\.0[\'"],[^}]*[\'"]result[\'"]: \{[^}]*[\'"]id[\'"]: [^,]+,)(\s*[\'"]status[\'"]: [\'"]OK[\'"])'

# První: Přidej job creation před response
job_creation = '''
        # Get job for miner IHNED (podle cryptonote-universal-pool)
        job_data = self.get_job_for_miner(addr)
        if not job_data:
            # Fallback - create job
            if algorithm == 'randomx':
                job_data = self.create_randomx_job()
            elif algorithm == 'autolykos_v2':
                job_data = self.create_autolykos_v2_job()
            else:
                job_data = self.create_randomx_job()  # default
'''

# Najdi kde je response = json.dumps v handle_xmrig_login
match = re.search(r'(async def handle_xmrig_login.*?)(response = json\.dumps)', content, re.DOTALL)
if match:
    # Insert job creation BEFORE response
    insertion_point = match.end(1)
    new_content = content[:insertion_point] + job_creation + "\n        " + content[insertion_point:]
    
    # Teď uprav response aby obsahoval job
    new_content = re.sub(
        r'([\'"]result[\'"]: \{[^}]*[\'"]id[\'"]: [^,]+,)(\s*[\'"]status[\'"]: [\'"]OK[\'"])',
        r'\1\n                "job": job_data,\2',
        new_content
    )
    
    with open('zion_universal_pool_v2.py', 'w') as f:
        f.write(new_content)
    
    print("✅ Job added to login response!")
else:
    print("❌ Could not find handle_xmrig_login response!")

PYTHON

# Restart pool
pkill -f zion_universal_pool_v2
sleep 2
python3 zion_universal_pool_v2.py --port 3333 > pool_280.log 2>&1 &
sleep 2
ps aux | grep pool | grep -v grep
tail -5 pool_280.log

REMOTE

echo "✅ Pool fixed and restarted!"
