#!/usr/bin/env python3
import asyncio
import json
import time
import hashlib

class SimpleMiner:
    def __init__(self, pool_host, pool_port, wallet, worker):
        self.pool_host = pool_host
        self.pool_port = pool_port
        self.wallet = wallet
        self.worker = worker
        self.reader = None
        self.writer = None
        self.job = None
        
    async def connect(self):
        print(f'🔌 Connecting to {self.pool_host}:{self.pool_port}...')
        self.reader, self.writer = await asyncio.open_connection(self.pool_host, self.pool_port)
        print('✅ Connected!')
        
    async def send(self, data):
        msg = json.dumps(data) + '\n'
        self.writer.write(msg.encode())
        await self.writer.drain()
        
    async def recv(self):
        line = await self.reader.readline()
        if not line:
            return None
        return json.loads(line.decode())
        
    async def login(self):
        print(f'🔐 Logging in as {self.wallet}.{self.worker}...')
        await self.send({
            'id': 1,
            'method': 'login',
            'params': {
                'login': self.wallet,
                'pass': self.worker,
                'agent': 'SimpleMiner/1.0'
            }
        })
        
        response = await self.recv()
        if response and response.get('result'):
            self.job = response['result'].get('job')
            print(f'✅ Login successful! Job: {self.job.get("job_id") if self.job else "None"}')
            return True
        return False
        
    def hash_work(self, blob, nonce):
        # Simple SHA3-256 fallback
        data = bytes.fromhex(blob)
        nonce_bytes = nonce.to_bytes(4, 'little')
        return hashlib.sha3_256(data + nonce_bytes).hexdigest()
        
    async def mine(self):
        if not self.job:
            print('❌ No job available')
            return
            
        print(f'⛏️  Mining job {self.job.get("job_id")}...')
        blob = self.job.get('blob')
        target = self.job.get('target')
        
        shares_tried = 0
        start_time = time.time()
        
        for nonce in range(1000000):
            hash_result = self.hash_work(blob, nonce)
            shares_tried += 1
            
            if shares_tried % 10000 == 0:
                elapsed = time.time() - start_time
                hashrate = shares_tried / elapsed if elapsed > 0 else 0
                print(f'📊 Tried {shares_tried:,} hashes | {hashrate:.0f} H/s')
            
            # Submit every 1000th hash
            if shares_tried % 1000 == 0:
                await self.submit_share(nonce, hash_result)
                await asyncio.sleep(0.1)
                
    async def submit_share(self, nonce, result):
        if not self.job:
            return
            
        print(f'📤 Submitting share: nonce={nonce:08x} hash={result[:16]}...')
        await self.send({
            'id': 2,
            'method': 'submit',
            'params': {
                'id': self.wallet,
                'job_id': self.job['job_id'],
                'nonce': f'{nonce:08x}',
                'result': result
            }
        })
        
        # Wait for response
        try:
            response = await asyncio.wait_for(self.recv(), timeout=5.0)
            if response:
                if response.get('result', {}).get('status') == 'OK':
                    print(f'✅ Share ACCEPTED!')
                else:
                    print(f'❌ Share rejected: {response}')
                    
                # Check for new job
                if 'job' in response.get('result', {}):
                    self.job = response['result']['job']
                    print(f'🔄 New job: {self.job["job_id"]}')
        except asyncio.TimeoutError:
            print('⏱️  Response timeout')
            
    async def run(self):
        try:
            await self.connect()
            if await self.login():
                await self.mine()
        except Exception as e:
            print(f'❌ Error: {e}')
        finally:
            if self.writer:
                self.writer.close()
                await self.writer.wait_closed()

async def main():
    miner = SimpleMiner('localhost', 3333, 'zion1test', 'simple-miner')
    await miner.run()

if __name__ == '__main__':
    asyncio.run(main())
