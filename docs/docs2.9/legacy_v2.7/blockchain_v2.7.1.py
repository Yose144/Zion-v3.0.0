#!/usr/bin/env python3
"""
ZION 2.7.1 - Clean Blockchain Implementation
Pure RandomX + SHA256 Hybrid PoW
Built from scratch for maximum reliability
"""

import json
import hashlib
import time
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
from enum import Enum


class NetworkType(Enum):
    MAINNET = "mainnet"
    TESTNET = "testnet"
    DEVNET = "devnet"


@dataclass
class Transaction:
    """Clean transaction structure"""
    version: int
    timestamp: int
    inputs: List[Dict[str, Any]]
    outputs: List[Dict[str, Any]]
    fee: int
    extra: str = ""
    txid: str = ""  # Auto-calculated, not included in hash
    
    def __post_init__(self):
        """Auto-calculate txid if not provided"""
        if not self.txid:
            self.txid = self.get_hash()
    
    def to_dict(self) -> Dict[str, Any]:
        """Return transaction as dict WITHOUT txid for hash calculation"""
        data = asdict(self)
        data.pop('txid', None)  # Remove txid from hashing
        return data
    
    def get_hash(self) -> str:
        """Generate deterministic transaction hash"""
        tx_data = json.dumps(self.to_dict(), sort_keys=True).encode()
        return hashlib.sha256(tx_data).hexdigest()


@dataclass
class Block:
    """Clean block structure with deterministic hashing"""
    height: int
    prev_hash: str
    timestamp: int
    merkle_root: str
    difficulty: int
    nonce: int
    txs: List[Transaction]
    hash: str = ""
    
    def calc_hash(self, algorithm=None) -> str:
        """Calculate block hash - supports multiple algorithms"""
        # Convert transactions to dict format
        tx_data = [tx.to_dict() for tx in self.txs]
        
        block_data = {
            'height': self.height,
            'prev_hash': self.prev_hash,
            'timestamp': self.timestamp,
            'merkle_root': self.merkle_root,
            'difficulty': self.difficulty,
            'nonce': self.nonce,
            'transactions': tx_data
        }
        
        # Create deterministic JSON
        json_data = json.dumps(block_data, sort_keys=True).encode()
        
        # Use provided algorithm or fallback to SHA256
        if algorithm is not None:
            return algorithm.hash(json_data)
        else:
            # Fallback to SHA256 for compatibility
            return hashlib.sha256(json_data).hexdigest()
    
    def is_valid_pow(self) -> bool:
        """Validate Proof of Work"""
        if not self.hash:
            self.hash = self.calc_hash()
            
        # Convert hash to integer for comparison
        hash_int = int(self.hash, 16)
        
        # Calculate target from difficulty
        # For simplicity: target = 2^256 / difficulty
        max_target = (1 << 256) - 1
        target = max_target // self.difficulty
        
        return hash_int <= target


class Blockchain:
    """Clean, minimal blockchain implementation"""
    
    def __init__(self, network: NetworkType = NetworkType.TESTNET):
        self.network = network
        self.chain: List[Block] = []
        self.difficulty = 32  # Start low for testing
        self.block_time_target = 120  # 2 minutes
        self.difficulty_adjustment_interval = 10  # blocks
        
        # Create genesis block
        self._create_genesis_block()
    
    def _create_genesis_block(self) -> None:
        """Create the genesis block"""
        genesis_tx = Transaction(
            txid="genesis",
            version=1,
            timestamp=int(time.time()),
            inputs=[],
            outputs=[{
                "amount": 1000000000000,  # 1 trillion initial supply
                "recipient": "genesis_address",
                "output_type": "genesis"
            }],
            fee=0,
            extra="ZION 2.7.1 Genesis Block - Pure RandomX Implementation"
        )
        
        genesis_block = Block(
            height=0,
            prev_hash="0" * 64,
            timestamp=int(time.time()),
            merkle_root=genesis_tx.get_hash(),
            difficulty=1,  # Genesis block has minimal difficulty
            nonce=0,
            txs=[genesis_tx]
        )
        
        genesis_block.hash = genesis_block.calc_hash()
        self.chain.append(genesis_block)
        print(f"✅ Genesis block created: {genesis_block.hash[:16]}...")
    
    def get_latest_block(self) -> Block:
        """Get the most recent block"""
        return self.chain[-1]
    
    def add_block(self, block: Block) -> bool:
        """Add a new block to the chain"""
        # Validate block
        if not self._validate_block(block):
            return False
        
        # Set the hash if not already set
        if not block.hash:
            block.hash = block.calc_hash()
        
        # Add to chain
        self.chain.append(block)
        
        # Adjust difficulty if needed
        if len(self.chain) % self.difficulty_adjustment_interval == 0:
            self._adjust_difficulty()
        
        print(f"✅ Block {block.height} added: {block.hash[:16]}...")
        return True
    
    def _validate_block(self, block: Block) -> bool:
        """Validate a block before adding to chain"""
        latest_block = self.get_latest_block()
        
        # Check height
        if block.height != latest_block.height + 1:
            print(f"❌ Invalid height: expected {latest_block.height + 1}, got {block.height}")
            return False
        
        # Check previous hash
        if block.prev_hash != latest_block.hash:
            print(f"❌ Invalid prev_hash: expected {latest_block.hash}, got {block.prev_hash}")
            return False
        
        # Check timestamp (not too far in future/past)
        current_time = int(time.time())
        if block.timestamp > current_time + 3600:  # 1 hour future tolerance
            print(f"❌ Block timestamp too far in future")
            return False
        
        if block.timestamp < latest_block.timestamp:
            print(f"❌ Block timestamp older than previous block")
            return False
        
        # Check difficulty
        if block.difficulty != self.difficulty:
            print(f"❌ Invalid difficulty: expected {self.difficulty}, got {block.difficulty}")
            return False
        
        # Validate Proof of Work
        if not block.is_valid_pow():
            print(f"❌ Invalid Proof of Work")
            return False
        
        # Validate transactions
        if not self._validate_transactions(block.txs):
            print(f"❌ Invalid transactions")
            return False
        
        return True
    
    def _validate_transactions(self, transactions: List[Transaction]) -> bool:
        """Validate all transactions in a block"""
        if not transactions:
            print("❌ Block must contain at least one transaction (coinbase)")
            return False
        
        # First transaction should be coinbase
        coinbase = transactions[0]
        if not self._is_coinbase_transaction(coinbase):
            print("❌ First transaction must be coinbase")
            return False
        
        # Validate each transaction
        for tx in transactions:
            if not self._validate_transaction(tx):
                return False
        
        return True
    
    def _is_coinbase_transaction(self, tx: Transaction) -> bool:
        """Check if transaction is a valid coinbase"""
        # Coinbase has special input structure
        if len(tx.inputs) != 1:
            return False
        
        coinbase_input = tx.inputs[0]
        return (coinbase_input.get('prev_txid') == '0' * 64 and 
                coinbase_input.get('output_index') == 0xFFFFFFFF)
    
    def _validate_transaction(self, tx: Transaction) -> bool:
        """Validate individual transaction"""
        # For now, just basic validation
        # TODO: Add signature verification, UTXO validation, etc.
        
        # Check txid matches content
        expected_txid = tx.get_hash()
        if tx.txid != expected_txid:
            print(f"❌ Transaction txid mismatch")
            return False
        
        return True
    
    def _adjust_difficulty(self) -> None:
        """Adjust mining difficulty based on block time"""
        if len(self.chain) < self.difficulty_adjustment_interval:
            return
        
        # Calculate average block time for last interval
        recent_blocks = self.chain[-self.difficulty_adjustment_interval:]
        time_span = recent_blocks[-1].timestamp - recent_blocks[0].timestamp
        avg_block_time = time_span / (self.difficulty_adjustment_interval - 1)
        
        # Adjust difficulty
        if avg_block_time < self.block_time_target / 2:
            # Too fast, double difficulty
            self.difficulty *= 2
            print(f"🔼 Difficulty increased to {self.difficulty}")
        elif avg_block_time > self.block_time_target * 2:
            # Too slow, halve difficulty
            self.difficulty = max(1, self.difficulty // 2)
            print(f"🔽 Difficulty decreased to {self.difficulty}")
        else:
            print(f"✅ Difficulty maintained at {self.difficulty}")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get blockchain statistics"""
        return {
            'height': len(self.chain) - 1,
            'difficulty': self.difficulty,
            'latest_hash': self.get_latest_block().hash,
            'network': self.network.value,
            'total_blocks': len(self.chain)
        }
    
    def mine_block(self, transactions: List[Transaction], miner_address: str) -> Optional[Block]:
        """Mine a new block (simple CPU mining for now)"""
        latest_block = self.get_latest_block()
        
        # Create coinbase transaction
        block_reward = 50 * 10**8  # 50 ZION
        coinbase_tx = Transaction(
            txid="",  # Will be calculated
            version=1,
            timestamp=int(time.time()),
            inputs=[{
                'prev_txid': '0' * 64,
                'output_index': 0xFFFFFFFF,
                'signature_script': f"height_{latest_block.height + 1}"
            }],
            outputs=[{
                'amount': block_reward,
                'recipient': miner_address,
                'output_type': 'coinbase'
            }],
            fee=0
        )
        coinbase_tx.txid = coinbase_tx.get_hash()
        
        # Combine coinbase with other transactions
        all_txs = [coinbase_tx] + transactions
        
        # Calculate merkle root (simplified)
        tx_hashes = [tx.get_hash() for tx in all_txs]
        merkle_root = hashlib.sha256(''.join(tx_hashes).encode()).hexdigest()
        
        # Create block template
        new_block = Block(
            height=latest_block.height + 1,
            prev_hash=latest_block.hash,
            timestamp=int(time.time()),
            merkle_root=merkle_root,
            difficulty=self.difficulty,
            nonce=0,
            txs=all_txs
        )
        
        print(f"⛏️ Mining block {new_block.height} with difficulty {self.difficulty}...")
        
        # Simple proof of work mining
        target = ((1 << 256) - 1) // self.difficulty
        start_time = time.time()
        
        while True:
            new_block.hash = new_block.calc_hash()
            hash_int = int(new_block.hash, 16)
            
            if hash_int <= target:
                mining_time = time.time() - start_time
                print(f"🎉 Block mined in {mining_time:.2f}s! Hash: {new_block.hash[:16]}...")
                return new_block
            
            new_block.nonce += 1
            
            # Timeout after 60 seconds for testing
            if time.time() - start_time > 60:
                print("⏰ Mining timeout after 60 seconds")
                return None


# Factory function
def create_blockchain(network: str = "testnet") -> Blockchain:
    """Create a new blockchain instance"""
    net_type = NetworkType.TESTNET if network == "testnet" else NetworkType.MAINNET
    return Blockchain(net_type)


if __name__ == "__main__":
    # Quick test
    print("🌟 ZION 2.7.1 Blockchain Test")
    
    blockchain = create_blockchain("testnet")
    print(f"Genesis stats: {blockchain.get_stats()}")
    
    # Mine a test block
    test_block = blockchain.mine_block([], "test_miner_address")
    if test_block:
        success = blockchain.add_block(test_block)
        print(f"Block added: {success}")
        print(f"New stats: {blockchain.get_stats()}")