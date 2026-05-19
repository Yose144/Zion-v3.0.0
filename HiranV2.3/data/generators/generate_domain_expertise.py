#!/usr/bin/env python3
"""
Hiran v2.3 Domain Expertise Dataset Generator
Zion-specific technical questions covering L1-L6 subsystems.
"""

import json
import random
from pathlib import Path

random.seed(43)

# Technical domains with deep Zion knowledge
DOMAIN_TOPICS = [
    {
        "topic": "Mining Pool Protocol",
        "questions": [
            "How does a Zion miner connect to a pool?",
            "Describe the Zion pool line-based protocol (hello/job/submit/result).",
            "What is PPLNS in Zion mining pools?",
            "How does Zion handle share validation?",
            "What happens when a Zion miner submits an invalid share?",
            "How does the Zion pool server generate block templates?",
            "What is the role of the Revenue Proxy in Zion pools?",
            "How does Zion pool handle miner session lifecycle?",
            "What telemetry does the Zion miner emit?",
            "How does Zion support both CPU and GPU mining backends?",
            "What protocol messages does a Zion miner send to the pool?",
            "How is difficulty adjusted in Zion mining?",
            "What is the Zion pool's minimum payout threshold?",
            "How does Zion prevent pool hopping?",
            "Explain Zion's share difficulty targeting.",
            "What is the difference between local mining and pool mining in Zion?",
            "How does the Zion pool distribute work to miners?",
            "What happens when a Zion block is found by the pool?",
            "How does Zion handle orphaned blocks in pool statistics?",
        ],
        "answers": [
            "A Zion miner connects to a pool via TCP using the line-based protocol. The sequence is: (1) miner sends 'hello' with worker name and credentials, (2) pool responds with 'job' containing block template and target, (3) miner searches for nonce and sends 'submit' with solution, (4) pool validates and responds with 'result'.",
            "The Zion pool protocol uses these messages:\n- `hello`: Miner identification\n- `job`: Block template distribution\n- `submit`: Share solution submission\n- `result`: Validation result (accepted/rejected)\n- `keepalive`: Connection heartbeat\n- `error`: Error notification",
            "PPLNS (Pay Per Last N Shares) in Zion means miners are paid based on shares contributed in the last N blocks, not per block found. This prevents pool hopping and ensures fair distribution over time.",
            "Zion share validation checks: (1) share hash meets difficulty target, (2) share references valid block template, (3) nonce range is valid, (4) miner authorization is valid. Invalid shares are rejected with an error code but do not ban the miner immediately.",
            "The Revenue Proxy in Zion pools acts as an intermediary between miners and the node. It tracks fee splits (89/5/5/1), validates revenue distribution, and ensures the 5% humanitarian allocation is correctly routed to the DAO treasury.",
            "Zion supports CPU mining via multi-threaded hash computation and GPU mining via CUDA/OpenCL kernels. The miner binary auto-detects available hardware and selects the optimal backend. Both backends emit telemetry including hash rate, accepted/rejected shares, and temperature.",
            "When Zion finds a block, the pool: (1) verifies the solution with the node, (2) records the block in pool statistics, (3) updates PPLNS share accounting, (4) triggers fee split distribution according to the 89/5/5/1 protocol, (5) notifies all connected miners of the new block.",
        ]
    },
    {
        "topic": "DAO Governance",
        "questions": [
            "How does a Zion DAO proposal get submitted?",
            "What is the quorum requirement for Zion DAO votes?",
            "How long is the Zion DAO discussion period?",
            "How long is the Zion DAO voting period?",
            "What voting mechanism does Zion DAO use?",
            "How are funds disbursed after a Zion DAO proposal passes?",
            "Can a Zion DAO proposal be vetoed?",
            "What happens if a Zion DAO proposal fails quorum?",
            "How does Zion DAO prevent spam proposals?",
            "What is the minimum stake for a Zion DAO proposal?",
            "How does quadratic voting work in Zion DAO?",
            "Who can vote in Zion DAO?",
            "How are Zion DAO treasury funds secured?",
            "What is the Zion DAO governance token?",
            "How does Zion DAO handle disputes over category assignments?",
        ],
        "answers": [
            "Zion DAO proposal submission requires: (1) minimum stake deposit, (2) detailed proposal document, (3) target humanitarian category from the 7 approved categories, (4) budget breakdown, (5) timeline. The proposal enters a 7-day community discussion period before voting opens.",
            "Zion DAO uses **quadratic voting** over a 14-day voting period. Votes are weighted by the square root of stake to prevent whale dominance. The quorum is typically 30% of active voting power.",
            "After a proposal passes, funds are disbursed automatically via smart contract to the recipient address. The 5% humanitarian allocation from mining rewards flows into the treasury, and approved proposals are funded from this pool. All transactions are on-chain and auditable.",
            "Zion DAO prevents spam by requiring a minimum stake deposit that is forfeited if the proposal is rejected by >80% margin. This creates a strong disincentive against low-quality submissions.",
            "The Zion DAO treasury is secured through multi-signature validation requiring 3-of-5 signers. Signers are elected community members with term limits. All treasury operations are logged on-chain with automatic audit trails.",
        ]
    },
    {
        "topic": "Cross-Chain Bridge",
        "questions": [
            "How does Zion's cross-chain bridge work?",
            "What is the WARP protocol in Zion?",
            "How does Zion lock tokens for cross-chain transfers?",
            "What chains does Zion bridge support?",
            "How does Zion verify cross-chain transactions?",
            "What is the role of relayers in Zion bridges?",
            "How does Zion handle bridge failures?",
            "What is the Zion bridge validator set?",
            "How are bridge fees calculated in Zion?",
            "Explain HTLC atomic swaps in Zion.",
            "How does Zion prevent double-spending across chains?",
            "What is the refund mechanism in Zion atomic swaps?",
            "How long is the timelock in Zion HTLC swaps?",
        ],
        "answers": [
            "Zion's cross-chain bridge (L3/WARP) operates through a relay daemon with: (1) L1 watcher monitoring Zion chain events, (2) EVM watcher(s) monitoring external chains, (3) Relayer loop processing cross-chain messages, (4) SQLite persistence for state tracking. Bridge transfers require multi-sig validation from the bridge validator set.",
            "WARP is Zion's cross-chain relay protocol. It enables asset transfers between Zion and EVM-compatible chains (Ethereum, BSC) through lock-and-mint mechanisms. When tokens are locked on the source chain, an equivalent amount is minted on the destination chain via bridge contracts.",
            "Zion uses HTLC (Hash Time-Locked Contract) atomic swaps for trustless cross-chain exchanges. The process: (1) Party A generates hash H from secret S, (2) Party B creates HTLC with hash H and timelock T, (3) Party A reveals S to claim funds, (4) Party B uses S to claim their side. If timelock expires, both parties get refunds.",
            "Zion bridges currently support Ethereum and Binance Smart Chain (BSC). The bridge architecture is modular — new EVM-compatible chains can be added by implementing the watcher interface and deploying bridge contracts.",
            "Bridge fees in Zion are calculated as: base_fee + (transfer_amount × percentage_fee). Fees are split between bridge validators (for operation) and the DAO treasury (for maintenance and upgrades).",
        ]
    },
    {
        "topic": "Node & Consensus",
        "questions": [
            "What consensus algorithm does Zion use?",
            "How does Zion differ from Proof of Work?",
            "What is the Zion mempool policy?",
            "How does Zion handle peer discovery?",
            "What is the Zion block time target?",
            "How does Zion validate transactions?",
            "What is the Zion Genesis block?",
            "How does Zion handle chain reorganizations?",
            "What RPC endpoints does the Zion node expose?",
            "How does Zion synchronize with peers?",
            "What is the Zion P2P protocol?",
            "How does Zion prevent Sybil attacks?",
            "What is the Zion difficulty adjustment algorithm?",
        ],
        "answers": [
            "Zion uses a custom consensus algorithm optimized for fair resource distribution. It combines elements of Proof of Work (for miner participation) with DAO governance (for economic parameters). The consensus validates both cryptographic proofs and fee split compliance.",
            "Unlike traditional Proof of Work where 100% of rewards go to miners, Zion's consensus enforces the 89/5/5/1 fee split at the protocol level. This means even if miners wanted to change it, the network would reject blocks with incorrect reward distribution.",
            "The Zion mempool uses a policy based on: (1) transaction fee rate, (2) transaction size, (3) sender nonce ordering, (4) dependency resolution. Transactions below a minimum fee rate are dropped. The mempool size is bounded to prevent DoS attacks.",
            "Zion peer discovery uses a bootstrap node list plus a DHT-based peer discovery protocol. New nodes connect to seed nodes, download the peer list, and then participate in the DHT. Peer quality is tracked (latency, valid block propagation) and poor peers are eventually dropped.",
            "Zion targets a block time of approximately 2.5 minutes, with difficulty adjusting every 2016 blocks (about 3.5 days). The difficulty algorithm uses a weighted moving average to smooth out hash rate fluctuations.",
        ]
    },
    {
        "topic": "Security & Wallet",
        "questions": [
            "How is the Issobella wallet generated?",
            "What security measures does Zion implement?",
            "How does Zion protect smart contracts?",
            "What is Zion's approach to formal verification?",
            "How are Zion private keys secured?",
            "What multi-sig requirements does Zion use?",
            "How does Zion handle security audits?",
            "What is Zion's bug bounty program?",
        ],
        "answers": [
            "The Issobella wallet is generated deterministically from Zion DAO parameters using a verifiable key derivation function. The derivation path is: DAO_params → seed → HD_wallet → Issobella_address. This ensures transparency — anyone can verify the wallet address from public DAO parameters.",
            "Zion implements multiple security layers: (1) Formal verification of critical smart contracts, (2) Multi-sig validation for treasury operations (3-of-5), (3) Continuous monitoring of network anomalies, (4) Automated circuit breakers on pools, (5) Rate limiting on RPC endpoints, (6) Peer reputation scoring for P2P.",
            "Zion's L6 research layer focuses on formal verification of consensus properties. Key invariants are: (a) total supply conservation, (b) fee split enforcement (89/5/5/1), (c) double-spend impossibility, (d) DAO quorum requirements. These are verified using model checking and theorem proving.",
            "Zion's bug bounty program covers: L1 consensus bugs (critical), bridge vulnerabilities (critical), DAO governance exploits (high), and pool manipulation (high). Rewards scale with impact, ranging from $1,000 to $50,000 equivalent in ZION tokens.",
        ]
    },
]

CROSS_DOMAIN_TOPICS = [
    {
        "topic": "Zion vs Other Blockchains",
        "questions": [
            "Compare Zion's fee split to Bitcoin's 100% miner model.",
            "How does Zion differ from Ethereum's fee burning mechanism?",
            "Compare Zion DAO to MakerDAO governance.",
            "How is Zion's consensus different from Proof of Stake?",
            "What makes Zion unique compared to other humanitarian blockchain projects?",
            "Compare Zion's cross-chain bridge to Polkadot's parachain model.",
            "How does Zion's L6 research layer compare to Cardano's formal methods approach?",
            "Why did Zion choose QLoRA/DORA for AI training instead of traditional NLP pipelines?",
        ],
        "answers": [
            "Bitcoin allocates 100% of block rewards to miners, with no protocol-level humanitarian or operational allocation. Zion's 89/5/5/1 split embeds social impact directly into consensus — miners cannot opt out of the humanitarian contribution. This creates sustainable, self-funding social impact without relying on external donations.",
            "Ethereum burns base fees (EIP-1559) and gives priority fees to miners/validators. Zion takes a different approach: instead of burning, it actively redirects 10% of rewards (5% humanitarian + 5% Issobella) to social causes. The 1% pool fee ensures sustainable infrastructure.",
            "MakerDAO uses token-weighted voting where MKR holders govern the protocol. Zion uses quadratic voting (square root of stake) to prevent whale dominance. Additionally, Zion's governance is directly tied to mining activity — every block reinforces the DAO treasury, creating natural funding.",
            "Unlike Proof of Stake where validators are chosen based on token holdings, Zion retains Proof of Work for miner participation while embedding DAO governance for economic decisions. This hybrid approach maintains decentralization (anyone can mine) while enabling community governance.",
        ]
    },
    {
        "topic": "Technical Integration",
        "questions": [
            "How would Zion integrate with an existing Ethereum DeFi protocol?",
            "Design a Zion API endpoint for querying pool statistics.",
            "How would you implement a Zion block explorer?",
            "Write a Rust function to validate Zion fee splits.",
            "Write a Python script to monitor Zion DAO proposals.",
            "How would Zion handle a cross-chain bridge to Solana?",
            "Design a Zion mobile wallet architecture.",
            "How would Zion implement zero-knowledge proofs for privacy?",
        ],
        "answers": [
            "A Zion-Ethereum DeFi integration would use: (1) The existing L2 bridge to wrap ZION as ERC-20, (2) A Uniswap V3 liquidity pool for trading, (3) A custom oracle feeding Zion block confirmations to Ethereum, (4) Smart contracts that respect the 89/5/5/1 split for any yield generated from staked ZION.",
            "```rust\npub fn validate_fee_split(block_reward: u64, miner: u64, hum: u64, iss: u64, pool: u64) -> bool {\n    let total = miner + hum + iss + pool;\n    if total != block_reward { return false; }\n    miner * 100 == block_reward * 89 &&\n    hum * 100 == block_reward * 5 &&\n    iss * 100 == block_reward * 5 &&\n    pool * 100 == block_reward * 1\n}\n```",
            "A Zion block explorer needs: (1) L1 node RPC client for block/tx data, (2) SQLite/PostgreSQL indexer with rich query API, (3) Web frontend with real-time WebSocket updates, (4) Pool statistics aggregation, (5) DAO proposal tracker, (6) Cross-chain bridge monitoring. The indexer should track fee split compliance per block.",
        ]
    },
]


def generate_pairs(topics, count_per_topic=100):
    """Generate Q&A pairs from topic definitions."""
    pairs = []
    for topic in topics:
        questions = topic["questions"]
        answers = topic["answers"]
        for _ in range(count_per_topic):
            q = random.choice(questions)
            a = random.choice(answers)
            # Add system prompt randomly
            if random.random() < 0.3:
                q = "<|system|>\nYou are the Zion DAO technical assistant.\n<|user|>\n" + q + "\n<|assistant|>\n"
                a = "<|assistant|>\n" + a
            pairs.append({
                "instruction": q,
                "output": a,
                "category": f"domain_{topic['topic'].lower().replace(' ', '_')}",
                "priority": "high"
            })
    return pairs


def main():
    output_dir = Path(__file__).parent.parent / "curriculum"
    output_dir.mkdir(parents=True, exist_ok=True)

    print("Generating domain expertise dataset for Hiran v2.3...")
    domain_pairs = generate_pairs(DOMAIN_TOPICS, count_per_topic=300)
    random.shuffle(domain_pairs)

    output_file = output_dir / "stage2_domain_expertise.jsonl"
    with open(output_file, "w", encoding="utf-8") as f:
        for pair in domain_pairs:
            f.write(json.dumps(pair, ensure_ascii=False) + "\n")

    print(f"  Generated {len(domain_pairs)} domain expertise pairs")
    print(f"  Saved to: {output_file}")

    print("\nGenerating cross-domain dataset for Hiran v2.3...")
    cross_pairs = generate_pairs(CROSS_DOMAIN_TOPICS, count_per_topic=500)
    random.shuffle(cross_pairs)

    cross_file = output_dir / "stage3_cross_domain.jsonl"
    with open(cross_file, "w", encoding="utf-8") as f:
        for pair in cross_pairs:
            f.write(json.dumps(pair, ensure_ascii=False) + "\n")

    print(f"  Generated {len(cross_pairs)} cross-domain pairs")
    print(f"  Saved to: {cross_file}")


if __name__ == "__main__":
    main()
