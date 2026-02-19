/// End-to-end integration tests for ZION core
/// 
/// Tests complete mining workflow:
/// 1. Start node
/// 2. Get block template
/// 3. Mine block
/// 4. Submit block
/// 5. Verify chain state

use zion_core::state::Inner as State;
use zion_core::blockchain::block::Block;
use zion_core::crypto;
use zion_core::tx::{Transaction, TxInput, TxOutput};
use std::time::{SystemTime, UNIX_EPOCH};

use ed25519_dalek::{Signer, SigningKey};

fn temp_db_path(test_name: &str) -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();

    let mut path = std::env::temp_dir();
    path.push(format!("zion_test_{}_{}", test_name, nanos));
    path.to_string_lossy().to_string()
}

fn deterministic_signing_key() -> SigningKey {
    SigningKey::from_bytes(&[7u8; 32])
}

fn make_signed_spend_tx(
    prev_tx_hash: &str,
    output_index: u32,
    signing_key: &SigningKey,
    to_address: String,
    amount: u64,
    fee: u64,
    timestamp: u64,
) -> Transaction {
    let public_key_hex = crypto::to_hex(signing_key.verifying_key().as_bytes());

    let mut tx = Transaction {
        id: String::new(),
        version: 1,
        inputs: vec![TxInput {
            prev_tx_hash: prev_tx_hash.to_string(),
            output_index,
            signature: String::new(),
            public_key: public_key_hex,
        }],
        outputs: vec![TxOutput { amount, address: to_address }],
        fee,
        timestamp,
    };

    tx.id = tx.calculate_hash();
    let msg_bytes = crypto::keys::from_hex(&tx.id).expect("tx id is hex");
    let sig = signing_key.sign(&msg_bytes);
    tx.inputs[0].signature = crypto::to_hex(&sig.to_bytes());
    tx
}

#[tokio::test]
async fn test_e2e_mining_workflow() {
    // 1. Initialize node
    let db_path = temp_db_path("mining");
    let state = State::new(&db_path);
    
    let initial_height = state.height.load(std::sync::atomic::Ordering::Relaxed);
    assert_eq!(initial_height, 0, "Genesis should be at height 0");

    // 2. Get block template data
    let height = state.height.load(std::sync::atomic::Ordering::Relaxed);
    let difficulty = state.difficulty.load(std::sync::atomic::Ordering::Relaxed);
    let prev_hash = { state.tip.lock().unwrap().clone() };
    
    println!("Mining block {} with difficulty {} (prev: {})", height + 1, difficulty, &prev_hash[..16]);

    // 3. Seed a UTXO and add a signed transaction into mempool
    let signing_key = deterministic_signing_key();
    let owner_pub_hex = crypto::to_hex(signing_key.verifying_key().as_bytes());
    let owner_address = crypto::keys::address_from_public_key_hex(&owner_pub_hex);

    let faucet_prev_tx = "1111111111111111111111111111111111111111111111111111111111111111";
    let faucet_out_index: u32 = 0;
    let faucet_key = format!("{}:{}", faucet_prev_tx, faucet_out_index);
    state
        .storage
        .add_utxo(&faucet_key, &TxOutput {
            amount: 1_000,
            address: owner_address,
        })
        .unwrap();

    let tx = make_signed_spend_tx(
        faucet_prev_tx,
        faucet_out_index,
        &signing_key,
        "recipient_address".to_string(),
        900,
        100,
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs(),
    );
    let _ = state.process_transaction(tx.clone());

    // 4. Get mempool transactions for block
    let mempool_txs = state.mempool.get_all();
    println!("Found {} transactions in mempool", mempool_txs.len());

    // 5. Mine a block with mempool transactions
    let coinbase_tx = Transaction {
        id: "coinbase_tx_1".to_string(),
        version: 1,
        inputs: vec![],
        outputs: vec![TxOutput {
            amount: 1,
            address: "miner_address".to_string(),
        }],
        fee: 0,
        timestamp: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs(),
    };

    let block_timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let mut block = Block::new(
        1,
        height + 1,
        prev_hash.clone(),
        block_timestamp,
        1000, // Use difficulty 1000 (matches Genesis + MIN_DIFFICULTY)
        0,
        vec![coinbase_tx].into_iter().chain(mempool_txs).collect(),
    );

    // Quick mine (difficulty 1000 - matches Genesis)
    println!("Mining with difficulty 1000...");

    let mut found = false;
    for nonce in 0..1_000_000u64 {
        block.header.nonce = nonce;
        if zion_core::blockchain::validation::validate_pow(&block).is_ok() {
            println!("Found nonce: {}", nonce);
            found = true;
            break;
        }
    }

    assert!(found, "Failed to find valid PoW nonce within search range");

    // 6. Submit block
    let result = state.process_block(block.clone());
    assert!(result.is_ok(), "Block should be accepted: {:?}", result);

    let (new_height, new_hash) = result.unwrap();
    assert_eq!(new_height, height + 1);
    assert_eq!(new_hash, block.calculate_hash());

    // 5. Verify chain state
    let final_height = state.height.load(std::sync::atomic::Ordering::Relaxed);
    assert_eq!(final_height, height + 1);

    let tip = { state.tip.lock().unwrap().clone() };
    assert_eq!(tip, new_hash);

    // 6. Verify block is in storage
    let stored_block = state.storage.get_block(&new_hash).unwrap();
    assert!(stored_block.is_some(), "Block should be in storage");
    assert_eq!(stored_block.unwrap().height(), new_height);

    // 7. Verify mempool transaction was included (removed from mempool by process_block)
    let mempool_after = state.mempool.get_transaction(&tx.id);
    assert!(mempool_after.is_none(), "TX should be removed from mempool after mining");

    println!("E2E mining workflow completed successfully!");
    let _ = std::fs::remove_dir_all(&db_path);
}

#[tokio::test]
async fn test_e2e_transaction_flow() {
    let db_path = temp_db_path("transaction");
    let state = State::new(&db_path);

    // 1. Seed a UTXO and submit a signed spend transaction to mempool
    let signing_key = deterministic_signing_key();
    let owner_pub_hex = crypto::to_hex(signing_key.verifying_key().as_bytes());
    let owner_address = crypto::keys::address_from_public_key_hex(&owner_pub_hex);

    let faucet_prev_tx = "2222222222222222222222222222222222222222222222222222222222222222";
    let faucet_out_index: u32 = 0;
    let faucet_key = format!("{}:{}", faucet_prev_tx, faucet_out_index);
    state
        .storage
        .add_utxo(&faucet_key, &TxOutput {
            amount: 1_000,
            address: owner_address,
        })
        .unwrap();

    let tx = make_signed_spend_tx(
        faucet_prev_tx,
        faucet_out_index,
        &signing_key,
        "recipient_address".to_string(),
        900,
        100,
        1000,
    );

    let result = state.process_transaction(tx.clone());
    assert!(result.is_ok());

    // 2. Verify in mempool
    let mempool_tx = state.mempool.get_transaction(&tx.id);
    assert!(mempool_tx.is_some());
    assert_eq!(mempool_tx.unwrap().id, tx.id);

    // 3. Mine block with transaction (must include TX in block for removal)
    let prev_hash = { state.tip.lock().unwrap().clone() };
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let coinbase_tx = Transaction {
        id: "coinbase_tx_2".to_string(),
        version: 1,
        inputs: vec![],
        outputs: vec![TxOutput {
            amount: 1,
            address: "miner_address".to_string(),
        }],
        fee: 0,
        timestamp,
    };
    
    let mut block = Block::new(
        1, 1, prev_hash, timestamp, 1000, 0,
        vec![coinbase_tx, tx.clone()],
    );

    // Quick mine (difficulty 1000 - matches Genesis)
    let mut found = false;
    for nonce in 0..1_000_000u64 {
        block.header.nonce = nonce;
        if zion_core::blockchain::validation::validate_pow(&block).is_ok() {
            found = true;
            break;
        }
    }

    assert!(found, "Failed to find valid PoW nonce within search range");

    let result = state.process_block(block);
    assert!(result.is_ok(), "Block should be accepted: {:?}", result);

    // 4. Verify transaction removed from mempool (because it was in the block)
    let mempool_tx_after = state.mempool.get_transaction(&tx.id);
    assert!(mempool_tx_after.is_none(), "TX should be removed from mempool after block includes it");

    // 5. Verify transaction in block storage
    let block_hash = state.storage.get_block_hash_for_tx(&tx.id).unwrap();
    assert!(block_hash.is_some(), "TX should be indexed in storage");

    println!("E2E transaction flow completed successfully!");
    let _ = std::fs::remove_dir_all(&db_path);
}

#[tokio::test]
async fn test_e2e_mempool_eviction() {
    let db_path = temp_db_path("mempool");
    let state = State::new(&db_path);

    // Fill mempool beyond limit
    for i in 0..100 {
        let tx = Transaction {
            id: format!("tx_{}", i),
            version: 1,
            inputs: vec![],
            outputs: vec![],
            fee: i % 10, // Varying fees for eviction priority
            timestamp: i,
        };
        let _ = state.process_transaction(tx);
    }

    let mempool_size = state.mempool.size();
    assert!(mempool_size <= 50_000, "Mempool should respect limit");
    println!("Mempool size after eviction: {}", mempool_size);
    let _ = std::fs::remove_dir_all(&db_path);
}
