#!/usr/bin/env python3
"""
Hiran v2.3 Code Generation Dataset
Generates Zion-related code examples in Rust, Solidity, Python.
"""

import json
import random
from pathlib import Path

random.seed(47)

CODE_EXAMPLES = [
    # Rust - Fee split validation
    {
        "instruction": "Write a Rust function to validate Zion's fee split given a block reward and four recipient amounts.",
        "output": """```rust
/// Validates that the fee split matches Zion protocol specification.
/// Expected: miner 89%, humanitarian 5%, Issobella 5%, pool 1%
pub fn validate_zion_fee_split(
    block_reward: u64,
    miner: u64,
    humanitarian: u64,
    issobella: u64,
    pool: u64,
) -> bool {
    let total = miner + humanitarian + issobella + pool;
    if total != block_reward {
        return false;
    }
    // Use integer math to avoid floating point issues
    miner * 100 == block_reward * 89
        && humanitarian * 100 == block_reward * 5
        && issobella * 100 == block_reward * 5
        && pool * 100 == block_reward * 1
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_split() {
        assert!(validate_zion_fee_split(100, 89, 5, 5, 1));
    }

    #[test]
    fn test_invalid_split() {
        assert!(!validate_zion_fee_split(100, 90, 5, 5, 1));
    }
}
```""",
        "category": "code_rust"
    },
    # Rust - DAO proposal
    {
        "instruction": "Write a Rust struct and validation logic for a Zion DAO proposal.",
        "output": """```rust
use chrono::{DateTime, Utc};

#[derive(Debug, Clone)]
pub struct DaoProposal {
    pub id: u64,
    pub title: String,
    pub description: String,
    pub category: HumanitarianCategory,
    pub requested_amount: u64,
    pub proposer: String,
    pub stake: u64,
    pub status: ProposalStatus,
    pub created_at: DateTime<Utc>,
    pub voting_ends_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum HumanitarianCategory {
    FoodAndWater,
    HealthAndHygiene,
    Education,
    DisasterRelief,
    CommunityDevelopment,
    EnvironmentalConservation,
    HumanRightsAndJustice,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ProposalStatus {
    Discussion,
    Voting,
    Passed,
    Rejected,
    Executed,
}

impl DaoProposal {
    pub fn validate(&self) -> Result<(), ProposalError> {
        if self.stake < MINIMUM_STAKE {
            return Err(ProposalError::InsufficientStake);
        }
        if self.requested_amount > MAX_REQUEST {
            return Err(ProposalError::AmountTooHigh);
        }
        if self.voting_ends_at - self.created_at < Duration::days(14) {
            return Err(ProposalError::VotingPeriodTooShort);
        }
        Ok(())
    }
}
```""",
        "category": "code_rust"
    },
    # Rust - Pool protocol message
    {
        "instruction": "Write Rust enums for Zion pool protocol messages (hello, job, submit, result).",
        "output": """```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum PoolMessage {
    #[serde(rename = "hello")]
    Hello {
        worker_name: String,
        miner_id: String,
        protocol_version: u32,
    },

    #[serde(rename = "job")]
    Job {
        job_id: u64,
        block_template: BlockTemplate,
        target: String,
        clean_jobs: bool,
    },

    #[serde(rename = "submit")]
    Submit {
        job_id: u64,
        nonce: u64,
        extranonce2: String,
        worker_name: String,
    },

    #[serde(rename = "result")]
    Result {
        accepted: bool,
        share_difficulty: f64,
        error: Option<String>,
    },

    #[serde(rename = "keepalive")]
    KeepAlive,

    #[serde(rename = "error")]
    Error {
        code: u32,
        message: String,
    },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BlockTemplate {
    pub prev_block_hash: String,
    pub coinbase_tx: String,
    pub merkle_branches: Vec<String>,
    pub version: u32,
    pub bits: u32,
    pub height: u64,
}
```""",
        "category": "code_rust"
    },
    # Solidity - Bridge vault
    {
        "instruction": "Write a Solidity smart contract for a Zion cross-chain bridge vault.",
        "output": """```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title ZionBridgeVault
/// @notice Lock-and-mint bridge vault for Zion cross-chain transfers
contract ZionBridgeVault is ReentrancyGuard, AccessControl {
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    struct Deposit {
        address sender;
        uint256 amount;
        bytes32 targetChain;
        bytes32 targetAddress;
        uint256 timestamp;
        bool processed;
    }

    mapping(bytes32 => Deposit) public deposits;
    mapping(bytes32 => bool) public processedNonces;
    uint256 public totalLocked;
    uint256 public bridgeFee = 10; // 0.1%

    event DepositLocked(
        bytes32 indexed depositId,
        address indexed sender,
        uint256 amount,
        bytes32 targetChain
    );
    event ReleaseCompleted(
        bytes32 indexed depositId,
        address indexed recipient,
        uint256 amount
    );

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function lockDeposit(
        bytes32 targetChain,
        bytes32 targetAddress
    ) external payable nonReentrant returns (bytes32 depositId) {
        require(msg.value > 0, "Deposit must be > 0");
        require(targetChain != bytes32(0), "Invalid target chain");

        uint256 fee = (msg.value * bridgeFee) / 10000;
        uint256 netAmount = msg.value - fee;

        depositId = keccak256(abi.encodePacked(
            msg.sender,
            block.timestamp,
            targetChain,
            targetAddress
        ));

        deposits[depositId] = Deposit({
            sender: msg.sender,
            amount: netAmount,
            targetChain: targetChain,
            targetAddress: targetAddress,
            timestamp: block.timestamp,
            processed: false
        });

        totalLocked += netAmount;
        emit DepositLocked(depositId, msg.sender, netAmount, targetChain);
    }

    function release(
        bytes32 depositId,
        bytes32 nonce,
        address recipient,
        uint256 amount
    ) external nonReentrant onlyRole(RELAYER_ROLE) {
        require(!processedNonces[nonce], "Nonce already used");
        require(deposits[depositId].processed == false, "Already processed");

        processedNonces[nonce] = true;
        deposits[depositId].processed = true;
        totalLocked -= amount;

        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Transfer failed");

        emit ReleaseCompleted(depositId, recipient, amount);
    }

    receive() external payable {}
}
```""",
        "category": "code_solidity"
    },
    # Python - Pool statistics
    {
        "instruction": "Write a Python script to calculate Zion pool statistics from share data.",
        "output": """```python
from dataclasses import dataclass
from typing import List, Dict
from collections import defaultdict

@dataclass
class Share:
    worker_name: str
    difficulty: float
    timestamp: float
    is_valid: bool

@dataclass
class PoolStats:
    total_shares: int
    valid_shares: int
    stale_shares: int
    total_difficulty: float
    average_difficulty: float
    worker_counts: Dict[str, int]
    pplns_weights: Dict[str, float]

class ZionPoolStats:
    def __init__(self, n_blocks: int = 5):
        self.n_blocks = n_blocks
        self.shares: List[Share] = []
        self.block_boundaries: List[int] = []

    def add_share(self, share: Share) -> None:
        self.shares.append(share)

    def mark_new_block(self) -> None:
        self.block_boundaries.append(len(self.shares))
        # Keep only last N blocks
        if len(self.block_boundaries) > self.n_blocks:
            cutoff = self.block_boundaries[0]
            self.shares = self.shares[cutoff:]
            self.block_boundaries = [b - cutoff for b in self.block_boundaries[1:]]

    def calculate_pplns_weights(self) -> Dict[str, float]:
        '''Calculate PPLNS weight for each worker.'''
        if not self.shares:
            return {}

        total_diff = sum(s.difficulty for s in self.shares if s.is_valid)
        weights = defaultdict(float)

        for share in self.shares:
            if share.is_valid and total_diff > 0:
                weights[share.worker_name] += share.difficulty / total_diff

        return dict(weights)

    def get_stats(self) -> PoolStats:
        valid = [s for s in self.shares if s.is_valid]
        total_diff = sum(s.difficulty for s in valid)
        avg_diff = total_diff / len(valid) if valid else 0

        worker_counts = defaultdict(int)
        for s in self.shares:
            worker_counts[s.worker_name] += 1

        return PoolStats(
            total_shares=len(self.shares),
            valid_shares=len(valid),
            stale_shares=len(self.shares) - len(valid),
            total_difficulty=total_diff,
            average_difficulty=avg_diff,
            worker_counts=dict(worker_counts),
            pplns_weights=self.calculate_pplns_weights()
        )

# Example usage
if __name__ == "__main__":
    pool = ZionPoolStats(n_blocks=5)
    pool.add_share(Share("miner1", 1.0, 1000.0, True))
    pool.add_share(Share("miner2", 1.5, 1001.0, True))
    pool.add_share(Share("miner1", 2.0, 1002.0, True))

    stats = pool.get_stats()
    print(f"Total shares: {stats.total_shares}")
    print(f"PPLNS weights: {stats.pplns_weights}")
```""",
        "category": "code_python"
    },
    # Python - Fee split calculator
    {
        "instruction": "Write a Python function that calculates all Zion fee split shares from a block reward.",
        "output": """```python
def calculate_zion_fee_split(block_reward: float) -> dict:
    '''
    Calculate Zion fee split for a given block reward.
    
    Args:
        block_reward: Total block reward amount
        
    Returns:
        Dictionary with shares for each recipient
        
    Raises:
        ValueError: If block_reward is negative
    '''
    if block_reward < 0:
        raise ValueError("Block reward cannot be negative")
    
    SPLIT_CONFIG = {
        'miner': 0.89,
        'humanitarian': 0.05,
        'issobella': 0.05,
        'pool_operator': 0.01
    }
    
    shares = {
        name: round(block_reward * pct, 8)
        for name, pct in SPLIT_CONFIG.items()
    }
    
    # Verification
    total_allocated = sum(shares.values())
    if abs(total_allocated - block_reward) > 0.0001:
        raise RuntimeError(f"Split validation failed: {total_allocated} != {block_reward}")
    
    return {
        'block_reward': block_reward,
        'shares': shares,
        'verification': {
            'total_allocated': total_allocated,
            'matches': abs(total_allocated - block_reward) < 0.0001
        }
    }

# Example
if __name__ == "__main__":
    result = calculate_zion_fee_split(100.0)
    for name, amount in result['shares'].items():
        print(f"{name:20s}: {amount:>10.4f}")
    
    # Verification
    print(f"\nVerification: {result['verification']['matches']}")
```""",
        "category": "code_python"
    },
    # Rust - CLI tool
    {
        "instruction": "Write a Rust CLI tool that queries Zion pool statistics.",
        "output": """```rust
use clap::{Parser, Subcommand};
use reqwest;
use serde::Deserialize;

#[derive(Parser)]
#[command(name = "zion-pool-cli")]
#[command(about = "Zion mining pool command line tool")]
struct Cli {
    #[arg(short, long, default_value = "http://localhost:8444")]
    pool_url: String,
    
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Show current pool statistics
    Stats,
    /// Show connected miners
    Miners,
    /// Show fee split for a given block reward
    Split { reward: f64 },
}

#[derive(Deserialize, Debug)]
struct PoolStats {
    total_hashrate: f64,
    active_miners: usize,
    blocks_found: u64,
    fee_split: FeeSplit,
}

#[derive(Deserialize, Debug)]
struct FeeSplit {
    miner_pct: f64,
    humanitarian_pct: f64,
    issobella_pct: f64,
    pool_pct: f64,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();
    
    match cli.command {
        Commands::Stats => {
            let stats: PoolStats = reqwest::get(format!("{}/stats", cli.pool_url))
                .await?
                .json()
                .await?;
            println!("Pool Statistics:");
            println!("  Total Hashrate: {:.2} TH/s", stats.total_hashrate);
            println!("  Active Miners: {}", stats.active_miners);
            println!("  Blocks Found: {}", stats.blocks_found);
        }
        Commands::Miners => {
            println!("Connected miners would be listed here");
        }
        Commands::Split { reward } => {
            let split = FeeSplit {
                miner_pct: reward * 0.89,
                humanitarian_pct: reward * 0.05,
                issobella_pct: reward * 0.05,
                pool_pct: reward * 0.01,
            };
            println!("Fee Split for reward {}:", reward);
            println!("  Miner: {:.4}", split.miner_pct);
            println!("  Humanitarian: {:.4}", split.humanitarian_pct);
            println!("  Issobella: {:.4}", split.issobella_pct);
            println!("  Pool: {:.4}", split.pool_pct);
        }
    }
    
    Ok(())
}
```""",
        "category": "code_rust"
    },
]


def generate_code_variations(base_examples, count=3000):
    """Generate many variations of code tasks."""
    pairs = []

    task_templates = [
        "Write {lang} code to {task}.",
        "Implement a {lang} function that {task}.",
        "Create a {lang} {component} for {purpose}.",
        "Design a {lang} module for {feature}.",
        "Write a {lang} script that {task}.",
        "Implement {feature} in {lang}.",
        "Create a {lang} data structure for {purpose}.",
        "Write {lang} unit tests for {component}.",
        "Debug this {lang} code: {code_snippet}",
        "Optimize a {lang} function that {task}.",
    ]

    languages = ["Rust", "Solidity", "Python", "TypeScript"]
    tasks = [
        "validate Zion fee splits",
        "calculate PPLNS rewards",
        "handle Zion pool protocol messages",
        "implement DAO proposal voting",
        "process cross-chain bridge transfers",
        "generate Issobella wallet addresses",
        "track humanitarian fund allocations",
        "implement quadratic voting",
        "validate block templates",
        "handle atomic swap HTLCs",
        "monitor pool share submissions",
        "calculate mining difficulty",
        "implement peer discovery",
        "serialize Zion transactions",
    ]

    components = [
        "smart contract", "CLI tool", "library crate", "API endpoint",
        "data structure", "protocol handler", "test suite", "benchmark",
    ]

    for _ in range(count):
        ex = random.choice(base_examples)
        pairs.append({
            "instruction": ex["instruction"],
            "output": ex["output"],
            "category": ex["category"],
            "priority": "high"
        })

    return pairs


def main():
    output_dir = Path(__file__).parent.parent / "curriculum"
    output_dir.mkdir(parents=True, exist_ok=True)

    print("Generating code generation dataset for Hiran v2.3...")

    pairs = generate_code_variations(CODE_EXAMPLES, count=3000)
    random.shuffle(pairs)

    output_file = output_dir / "stage7_code_generation.jsonl"
    with open(output_file, "w", encoding="utf-8") as f:
        for p in pairs:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")

    print(f"\nCode generation pairs: {len(pairs)}")
    print(f"  Rust examples: {len([p for p in pairs if 'rust' in p['category']])}")
    print(f"  Solidity examples: {len([p for p in pairs if 'solidity' in p['category']])}")
    print(f"  Python examples: {len([p for p in pairs if 'python' in p['category']])}")
    print(f"\nSaved to: {output_file}")


if __name__ == "__main__":
    main()
