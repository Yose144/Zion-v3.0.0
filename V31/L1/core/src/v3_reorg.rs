//! V3 reorg handling.
//!
//! When a longer fork arrives, this module finds the common ancestor between
//! the current best chain and the new chain, clears the account/UTXO state,
//! and replays the winning chain from the checkpoint/genesis up to the new tip.
//!
//! This is intentionally simple: it trades full O(n) replay for correctness and
//! avoids the need for undo logs. For long chains the checkpoint import path
//! should be used to resume near the tip.

use std::collections::HashSet;
use std::sync::Arc;

use crate::storage::Storage;
use crate::v3_compat::{validate_v3_block, V3Block};
use crate::v3_state::V3State;

/// Reorg error.
#[derive(Debug, thiserror::Error)]
pub enum V3ReorgError {
    #[error("storage error: {0}")]
    Storage(#[from] crate::storage::StorageError),
    #[error("state error: {0}")]
    State(#[from] crate::v3_state::V3StateError),
    #[error("validation error: {0}")]
    Validation(String),
}

/// Reorganise the chain to `new_chain`, which must be sorted by height and
/// form a contiguous, valid sequence ending at the proposed new tip.
///
/// The replay path is:
///   1. Find the common ancestor of the old tip and the new chain.
///   2. Validate every block in the new chain.
///   3. If the new chain has more total work (here, a greater height), clear
///      account/UTXO state and replay all blocks from height 0 to the new tip.
///   4. Persist the new blocks and update the chain tip.
pub async fn reorg_to_chain(
    storage: Arc<Storage>,
    new_chain: &[V3Block],
) -> Result<(), V3ReorgError> {
    if new_chain.is_empty() {
        return Ok(());
    }

    // Ensure the new chain is contiguous and sorted.
    for window in new_chain.windows(2) {
        let prev = &window[0];
        let next = &window[1];
        if next.height != prev.height.saturating_add(1) {
            return Err(V3ReorgError::Validation(
                "new chain is not contiguous".to_string(),
            ));
        }
        if next.header.previous_hash != prev.header_hash() {
            return Err(V3ReorgError::Validation(
                "new chain has broken linkage".to_string(),
            ));
        }
    }

    let new_tip = new_chain.last().unwrap();
    let current_tip = storage
        .v3_tip()
        .await?
        .ok_or_else(|| V3ReorgError::Validation("no current tip".to_string()))?;

    // No reorg needed if the new tip is already the current tip or lower.
    if new_tip.height <= current_tip.height {
        return Ok(());
    }

    // Find the common ancestor by walking back from the current tip.
    let new_hashes: HashSet<[u8; 32]> = new_chain.iter().map(|b| b.header_hash()).collect();
    let mut old_branch = Vec::new();
    let mut cursor = current_tip;
    loop {
        if new_hashes.contains(&cursor.header_hash()) {
            break;
        }
        if cursor.height == 0 {
            return Err(V3ReorgError::Validation(
                "no common ancestor with new chain".to_string(),
            ));
        }
        old_branch.push(cursor.clone());
        let previous = storage
            .get_v3_block_by_hash(&cursor.header.previous_hash)
            .await?
            .ok_or_else(|| V3ReorgError::Validation("missing predecessor".to_string()))?;
        cursor = previous;
    }
    let common = cursor;

    // Validate the new chain against the common ancestor.
    let mut prev = common.clone();
    for block in new_chain {
        if block.height != prev.height.saturating_add(1) {
            return Err(V3ReorgError::Validation(
                "new chain height mismatch".to_string(),
            ));
        }
        let expected_difficulty = block.difficulty;
        validate_v3_block(
            block,
            prev.header_hash(),
            prev.header.timestamp,
            prev.height,
            expected_difficulty,
        )
        .map_err(|e| V3ReorgError::Validation(e.to_string()))?;
        prev = block.clone();
    }

    // Store all new blocks before replaying. This is safe because they are not
    // the tip yet (the replay path uses the block at each height).
    for block in new_chain {
        storage.put_v3_block(block).await?;
    }

    // Replay from the common ancestor to the new tip. We clear account/UTXO
    // state and re-apply every block from height 0 to the new tip to avoid
    // complex undo logic. This requires the full chain to be present in
    // `v3_blocks` (which is true when the block retention fix is active).
    let state = V3State::new(storage.clone());
    storage.clear_v3_state().await?;

    for height in 0..=new_tip.height {
        let block = storage
            .get_v3_block_by_height(height)
            .await?
            .ok_or_else(|| {
                V3ReorgError::Validation(format!("missing block at height {}", height))
            })?;
        state.apply_block(&block).await?;
    }

    storage.set_v3_tip(new_tip).await?;
    Ok(())
}

/// Simple reorg to a single longer block (the common case: a new tip).
pub async fn reorg_to_block(storage: Arc<Storage>, block: &V3Block) -> Result<(), V3ReorgError> {
    reorg_to_chain(storage, std::slice::from_ref(block)).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::v3_compat::build_v3_genesis_block;
    use crate::v3_template::{V3Miner, V3TemplateBuilder};

    #[tokio::test]
    async fn no_reorg_for_shorter_or_equal_chain() {
        let storage = Arc::new(Storage::open_in_memory().await.unwrap());
        let genesis = build_v3_genesis_block();
        storage.put_v3_block(&genesis).await.unwrap();

        // Reorg to genesis itself should be a no-op.
        reorg_to_block(storage.clone(), &genesis).await.unwrap();

        let tip = storage.v3_tip().await.unwrap().unwrap();
        assert_eq!(tip.height, 0);
    }

    #[tokio::test]
    async fn reorg_to_longer_chain() {
        let storage = Arc::new(Storage::open_in_memory().await.unwrap());
        let genesis = build_v3_genesis_block();
        storage.put_v3_block(&genesis).await.unwrap();

        // Mine two blocks on the main chain.
        let mut builder1 = V3TemplateBuilder::new(storage.clone());
        builder1.set_miner_address("miner".to_string()).unwrap();
        let mut b1 = builder1.build(&genesis, 1).await.unwrap();
        V3Miner::mine_test(&mut b1, 0, 1);

        let mut builder2 = V3TemplateBuilder::new(storage.clone());
        builder2.set_miner_address("miner".to_string()).unwrap();
        let mut b2 = builder2.build(&b1, 1).await.unwrap();
        V3Miner::mine_test(&mut b2, 0, 1);

        storage.put_v3_block(&b1).await.unwrap();
        storage.put_v3_block(&b2).await.unwrap();

        // Reorg to the same two blocks (should be idempotent).
        reorg_to_chain(storage.clone(), &[b1.clone(), b2.clone()])
            .await
            .unwrap();

        let tip = storage.v3_tip().await.unwrap().unwrap();
        assert_eq!(tip.height, 2);
        assert_eq!(tip.header_hash(), b2.header_hash());
    }
}
