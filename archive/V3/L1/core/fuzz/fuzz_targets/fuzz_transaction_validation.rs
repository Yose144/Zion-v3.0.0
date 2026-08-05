#![no_main]
use libfuzzer_sys::fuzz_target;
use zion_core::validation::{
    validate_no_double_spend, validate_structure, validate_value_conservation,
};
use zion_core::Transaction;

// Fuzz transaction validation functions with arbitrary transaction data.
// Goal: ensure validation never panics on any input, including malformed
// transactions with extreme amounts, many inputs/outputs, and edge cases.
fuzz_target!(|data: &[u8]| {
    if data.len() < 8 {
        return;
    }

    let tx_count = (data[0] % 8) as usize; // 0-7 transactions
    let block_size = u64::from_le_bytes(data[1..9].try_into().unwrap()) as usize;
    let rest = &data[9..];

    // Build transactions from fuzzer bytes
    let txs: Vec<Transaction> = (0..tx_count)
        .map(|i| {
            let offset = i * 40;
            let chunk = if rest.len() > offset + 40 {
                &rest[offset..offset + 40]
            } else {
                &rest[rest.len().min(offset)..]
            };
            let amount = if chunk.len() >= 16 {
                u128::from_le_bytes(chunk[0..16].try_into().unwrap_or([0u8; 16]))
            } else {
                1
            };
            let fee = if chunk.len() >= 24 {
                u64::from_le_bytes(chunk[16..24].try_into().unwrap_or([0u8; 8]))
            } else {
                0
            };
            let nonce = if chunk.len() >= 32 {
                u64::from_le_bytes(chunk[24..32].try_into().unwrap_or([0u8; 8]))
            } else {
                i as u64
            };
            Transaction {
                tx_id: format!("fuzz_tx_{i}"),
                from: if i == 0 { "coinbase".into() } else { format!("fuzz_from_{i}") },
                to: format!("fuzz_to_{i}"),
                amount_zion: amount,
                fee_zion: fee,
                nonce,
            }
        })
        .collect();

    // Fuzz all validation functions — none should ever panic
    let _ = validate_structure(&txs, block_size);
    let _ = validate_no_double_spend(&txs);

    // For value conservation, provide a dummy UTXO lookup that returns a fixed amount
    let utxo_lookup = |_: &[u8; 32], _: u32| -> Option<u64> { Some(1_000_000_000) };
    let _ = validate_value_conservation(&txs, &utxo_lookup, &|_, _| false);
});
