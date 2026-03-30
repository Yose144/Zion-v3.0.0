"""
ZION Blockchain Core v2.6.75

Main blockchain engine implementing CryptoNote-compatible protocol
with Python-native performance and real data integration.
"""
from __future__ import annotations
import asyncio
import hashlib
import json
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Union
import logging

logger = logging.getLogger(__name__)


@dataclass
class ZionBlock:
    """ZION blockchain block structure"""
    height: int
    timestamp: int
    previous_hash: str
    merkle_root: str
    difficulty: int
    nonce: int
    transactions: List[Dict[str, Any]] = field(default_factory=list)
    hash: Optional[str] = None
    
    def calculate_hash(self) -> str:
        """Calculate block hash"""
        block_data = {
            'height': self.height,
            'timestamp': self.timestamp,
            'previous_hash': self.previous_hash,
            'merkle_root': self.merkle_root,
            'difficulty': self.difficulty,
            'nonce': self.nonce,
            'transactions': self.transactions
        }
        
        block_json = json.dumps(block_data, sort_keys=True)
        hash_obj = hashlib.sha256(block_json.encode())
        return hash_obj.hexdigest()
    
    def is_valid(self) -> bool:
        """Validate block structure and hash"""
        if self.hash is None:
            self.hash = self.calculate_hash()
            
        # Check hash meets difficulty target
        target = "0" * (self.difficulty // 4)  # Simplified difficulty check
        return self.hash.startswith(target)


@dataclass 
class ZionTransaction:
    """ZION transaction structure"""
    txid: str
    inputs: List[Dict[str, Any]]
    outputs: List[Dict[str, Any]]
    fee: int
    timestamp: int
    signature: Optional[str] = None
    
    def calculate_txid(self) -> str:
        """Calculate transaction ID"""
        tx_data = {
            'inputs': self.inputs,
            'outputs': self.outputs,
            'fee': self.fee,
            'timestamp': self.timestamp
        }
        tx_json = json.dumps(tx_data, sort_keys=True)
        return hashlib.sha256(tx_json.encode()).hexdigest()


class ZionMempool:
    """Transaction memory pool"""
    
    def __init__(self, max_size: int = 10000):
        self.transactions: Dict[str, ZionTransaction] = {}
        self.max_size = max_size
        
    def add_transaction(self, tx: ZionTransaction) -> bool:
        """Add transaction to mempool"""
        if len(self.transactions) >= self.max_size:
            logger.warning("Mempool full, rejecting transaction")
            return False
            
        if tx.txid in self.transactions:
            logger.debug(f"Transaction {tx.txid} already in mempool")
            return False
            
        # Basic validation
        if not tx.txid:
            tx.txid = tx.calculate_txid()
            
        self.transactions[tx.txid] = tx
        logger.debug(f"Added transaction {tx.txid} to mempool")
        return True
        
    def remove_transaction(self, txid: str) -> Optional[ZionTransaction]:
        """Remove transaction from mempool"""
        return self.transactions.pop(txid, None)
        
    def get_transactions(self, count: int = 100) -> List[ZionTransaction]:
        """Get transactions for block creation"""
        txs = list(self.transactions.values())
        return txs[:count]
        
    def get_count(self) -> int:
        """Get mempool size"""
        return len(self.transactions)


class ZionConsensus:
    """ZION consensus rules and difficulty adjustment"""
    
    # Network parameters (from ZION specs)
    MAX_SUPPLY = 144_000_000_000  # 144 billion ZION
    INITIAL_REWARD = 333  # Initial block reward
    BLOCK_TIME = 120  # Target block time in seconds
    HALVING_INTERVAL = 210_000  # Blocks between halvings
    MIN_DIFFICULTY = 1
    MAX_DIFFICULTY = 2**256 - 1
    
    @staticmethod
    def calculate_block_reward(height: int) -> int:
        """Calculate block reward at given height"""
        halvings = height // ZionConsensus.HALVING_INTERVAL
        reward = ZionConsensus.INITIAL_REWARD
        
        # Apply halvings
        for _ in range(halvings):
            reward //= 2
            if reward < 1:
                reward = 1
                break
                
        return reward
    
    @staticmethod
    def adjust_difficulty(blocks: List[ZionBlock]) -> int:
        """Adjust mining difficulty based on recent block times"""
        if len(blocks) < 2:
            return ZionConsensus.MIN_DIFFICULTY
            
        # Look at last 10 blocks for adjustment
        recent_blocks = blocks[-10:] if len(blocks) >= 10 else blocks
        
        if len(recent_blocks) < 2:
            return recent_blocks[-1].difficulty if recent_blocks else ZionConsensus.MIN_DIFFICULTY
            
        # Calculate average block time
        time_span = recent_blocks[-1].timestamp - recent_blocks[0].timestamp
        avg_time = time_span / (len(recent_blocks) - 1)
        
        # Target ratio
        target_ratio = avg_time / ZionConsensus.BLOCK_TIME
        current_difficulty = recent_blocks[-1].difficulty
        
        # Adjust difficulty (max 25% change per adjustment)
        if target_ratio > 1.25:  # Blocks too slow, decrease difficulty
            new_difficulty = int(current_difficulty / 1.25)
        elif target_ratio < 0.8:  # Blocks too fast, increase difficulty  
            new_difficulty = int(current_difficulty * 1.25)
        else:
            new_difficulty = current_difficulty
            
        # Clamp to valid range
        new_difficulty = max(ZionConsensus.MIN_DIFFICULTY, 
                           min(ZionConsensus.MAX_DIFFICULTY, new_difficulty))
        
        logger.debug(f"Difficulty adjusted from {current_difficulty} to {new_difficulty} "
                    f"(avg time: {avg_time:.1f}s, target: {ZionConsensus.BLOCK_TIME}s)")
        
        return new_difficulty


class ZionBlockchain:
    """
    Main ZION blockchain implementation
    
    Features:
    - CryptoNote-compatible block structure
    - Real difficulty adjustment
    - Transaction validation and mempool
    - Python-native performance
    - Async-ready architecture
    """
    
    def __init__(self, genesis_address: str = None):
        self.blocks: List[ZionBlock] = []
        self.mempool = ZionMempool()
        self.genesis_address = genesis_address or self._get_default_genesis_address()
        self.current_difficulty = ZionConsensus.MIN_DIFFICULTY
        
        # Create genesis block
        self._create_genesis_block()
        
    def _get_default_genesis_address(self) -> str:
        """Get default ZION genesis address"""
        # Official ZION genesis address from docs
        return "Z3BDEEC2A0AE0F5D81B034308F99ECD8990D9B8B01BD9C7E7429392CA31861C6220DA3B30D74E809FA0A1FE069F1"
    
    def _create_genesis_block(self):
        """Create the genesis block"""
        genesis_tx = ZionTransaction(
            txid="genesis_coinbase_tx",
            inputs=[],
            outputs=[{
                "address": self.genesis_address,
                "amount": ZionConsensus.INITIAL_REWARD * 10**6  # Convert to atomic units
            }],
            fee=0,
            timestamp=int(time.time())
        )
        
        genesis_block = ZionBlock(
            height=0,
            timestamp=int(time.time()),
            previous_hash="0" * 64,
            merkle_root=genesis_tx.txid,
            difficulty=ZionConsensus.MIN_DIFFICULTY,
            nonce=0,
            transactions=[{
                "txid": genesis_tx.txid,
                "type": "coinbase",
                "outputs": genesis_tx.outputs
            }]
        )
        
        genesis_block.hash = genesis_block.calculate_hash()
        self.blocks.append(genesis_block)
        
        logger.info(f"Genesis block created: {genesis_block.hash}")
    
    def get_height(self) -> int:
        """Get current blockchain height"""
        return len(self.blocks)
    
    def get_last_block(self) -> Optional[ZionBlock]:
        """Get the last block in chain"""
        return self.blocks[-1] if self.blocks else None
    
    def get_block(self, height: int) -> Optional[ZionBlock]:
        """Get block at specific height"""
        if 0 <= height < len(self.blocks):
            return self.blocks[height]
        return None
    
    def get_block_by_hash(self, block_hash: str) -> Optional[ZionBlock]:
        """Get block by hash"""
        for block in self.blocks:
            if block.hash == block_hash:
                return block
        return None
    
    def add_block(self, block: ZionBlock) -> bool:
        """Add new block to chain"""
        if not self.validate_block(block):
            logger.warning(f"Block validation failed: {block.height}")
            return False
            
        # Remove block transactions from mempool
        for tx in block.transactions:
            if 'txid' in tx:
                self.mempool.remove_transaction(tx['txid'])
        
        self.blocks.append(block)
        self.current_difficulty = ZionConsensus.adjust_difficulty(self.blocks)
        
        logger.info(f"Block {block.height} added to chain: {block.hash}")
        return True
    
    def validate_block(self, block: ZionBlock) -> bool:
        """Validate a block before adding to chain"""
        # Check height sequence
        if block.height != len(self.blocks):
            logger.error(f"Invalid block height: {block.height}, expected: {len(self.blocks)}")
            return False
        
        # Check previous hash
        last_block = self.get_last_block()
        if last_block and block.previous_hash != last_block.hash:
            logger.error(f"Invalid previous hash: {block.previous_hash}")
            return False
        
        # Validate block structure
        if not block.is_valid():
            logger.error("Block validation failed")
            return False
        
        # Check difficulty target
        if block.difficulty != self.current_difficulty:
            logger.error(f"Invalid difficulty: {block.difficulty}, expected: {self.current_difficulty}")
            return False
            
        return True
    
    def create_block_template(self) -> Dict[str, Any]:
        """Create block template for mining"""
        last_block = self.get_last_block()
        height = len(self.blocks)
        
        # Get transactions from mempool
        transactions = self.mempool.get_transactions(100)
        tx_data = []
        
        # Add coinbase transaction
        coinbase_tx = {
            "txid": f"coinbase_{height}_{int(time.time())}",
            "type": "coinbase",
            "outputs": [{
                "address": self.genesis_address,  # Should be miner address in real implementation
                "amount": ZionConsensus.calculate_block_reward(height)
            }]
        }
        tx_data.append(coinbase_tx)
        
        # Add mempool transactions
        for tx in transactions:
            tx_data.append({
                "txid": tx.txid,
                "inputs": tx.inputs,
                "outputs": tx.outputs,
                "fee": tx.fee
            })
        
        # Calculate merkle root (simplified)
        merkle_data = [tx["txid"] for tx in tx_data]
        merkle_root = hashlib.sha256(json.dumps(merkle_data).encode()).hexdigest()
        
        template = {
            "height": height,
            "previous_hash": last_block.hash if last_block else "0" * 64,
            "timestamp": int(time.time()),
            "difficulty": self.current_difficulty,
            "merkle_root": merkle_root,
            "transactions": tx_data,
            "target": self._difficulty_to_target(self.current_difficulty)
        }
        
        return template
    
    def _difficulty_to_target(self, difficulty: int) -> str:
        """Convert difficulty to target hash prefix"""
        # Simplified: difficulty determines number of leading zeros required
        zeros = difficulty // 4096  # Adjust this ratio for real mining
        return "0" * zeros
    
    def submit_block(self, block_data: Dict[str, Any]) -> bool:
        """Submit mined block"""
        try:
            block = ZionBlock(
                height=block_data['height'],
                timestamp=block_data['timestamp'],
                previous_hash=block_data['previous_hash'],
                merkle_root=block_data['merkle_root'],
                difficulty=block_data['difficulty'],
                nonce=block_data['nonce'],
                transactions=block_data.get('transactions', [])
            )
            
            block.hash = block.calculate_hash()
            
            return self.add_block(block)
            
        except Exception as e:
            logger.error(f"Block submission failed: {e}")
            return False
    
    def get_info(self) -> Dict[str, Any]:
        """Get blockchain info (compatible with CryptoNote getinfo)"""
        last_block = self.get_last_block()
        
        return {
            "height": self.get_height(),
            "difficulty": self.current_difficulty,
            "tx_count": self.mempool.get_count(),
            "tx_pool_size": self.mempool.get_count(),
            "last_block_hash": last_block.hash if last_block else None,
            "last_block_timestamp": last_block.timestamp if last_block else None,
            "network": "ZION-mainnet",
            "version": "2.6.75",
            "status": "OK"
        }
    
    async def sync_with_peers(self):
        """Placeholder for P2P sync (to be implemented)"""
        # TODO: Implement P2P synchronization
        logger.debug("P2P sync not yet implemented")
        pass


# Test harness
if __name__ == '__main__':
    import json
    
    print("ZION Blockchain Core v2.6.75 Test")
    print("=" * 40)
    
    # Create blockchain
    blockchain = ZionBlockchain()
    
    print(f"Genesis block created at height: {blockchain.get_height()}")
    
    # Get blockchain info
    info = blockchain.get_info()
    print("\nBlockchain Info:")
    print(json.dumps(info, indent=2))
    
    # Create block template
    template = blockchain.create_block_template()
    print("\nBlock Template:")
    print(json.dumps(template, indent=2))
    
    # Simulate mining a block
    block_data = {
        'height': template['height'],
        'timestamp': template['timestamp'],
        'previous_hash': template['previous_hash'],
        'merkle_root': template['merkle_root'],
        'difficulty': template['difficulty'],
        'nonce': 12345,  # Simulated nonce finding
        'transactions': template['transactions']
    }
    
    print(f"\nSubmitting mined block...")
    success = blockchain.submit_block(block_data)
    print(f"Block submission: {'✅ SUCCESS' if success else '❌ FAILED'}")
    
    if success:
        print(f"New blockchain height: {blockchain.get_height()}")
        new_info = blockchain.get_info()
        print("Updated info:")
        print(json.dumps(new_info, indent=2))