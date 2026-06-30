//! # CBOR Encoder (minimal — RFC 8949)
//!
//! Minimal CBOR encoder for Cardano TX construction.
//! Implements the subset of CBOR needed for Cardano transaction bodies:
//! - Unsigned integers (major type 0)
//! - Negative integers (major type 1)
//! - Byte strings (major type 2)
//! - Text strings (major type 3)
//! - Arrays (major type 4)
//! - Maps (major type 5)
//! - Tags (major type 6)
//! - Simple values / null / bool (major type 7)
//!
//! ## Cardano TX CBOR structure (CIP-0008)
//! ```text
//! Transaction = [body, witness_set, auxiliary_data?]  // array(3)
//! TransactionBody = {
//!   0: inputs,         // array of [tx_id(bytes), index(uint)]
//!   1: outputs,        // array of {0: address(bytes), 1: amount(uint)}
//!   2: fee,            // uint
//!   3: ttl,            // uint
//!   9: mint,           // map {policy_id(bytes): {asset_name(bytes): amount(int)}}
//! }
//! TransactionWitnessSet = {
//!   0: vkeywitnesses,  // array of [vkey(bytes32), sig(bytes64)]
//! }
//! ```

// ─────────────────────────────────────────────────────────────────────────────
// CBOR Encoder
// ─────────────────────────────────────────────────────────────────────────────

/// A minimal CBOR encoder that writes into an internal byte buffer.
pub struct CborEncoder {
    buf: Vec<u8>,
}

/// CBOR major types (RFC 8949 §3.1)
const MT_UNSIGNED: u8 = 0; // 0b000
const MT_NEGATIVE: u8 = 1; // 1b001
const MT_BYTE_STRING: u8 = 2; // 0b010
const MT_TEXT_STRING: u8 = 3; // 0b011
const MT_ARRAY: u8 = 4; // 0b100
const MT_MAP: u8 = 5; // 0b101
const MT_TAG: u8 = 6; // 0b110
const MT_SIMPLE: u8 = 7; // 0b111

impl CborEncoder {
    /// Create a new empty CBOR encoder.
    pub fn new() -> Self {
        Self { buf: Vec::new() }
    }

    /// Create with pre-allocated capacity.
    pub fn with_capacity(cap: usize) -> Self {
        Self {
            buf: Vec::with_capacity(cap),
        }
    }

    /// Consume and return the raw CBOR bytes.
    pub fn finish(self) -> Vec<u8> {
        self.buf
    }

    /// Borrow the internal buffer.
    pub fn as_bytes(&self) -> &[u8] {
        &self.buf
    }

    /// Drain and return bytes (non-consuming).
    pub fn take_bytes(&mut self) -> Vec<u8> {
        std::mem::take(&mut self.buf)
    }

    // ── Internal: write header byte + argument ───────────────────────────────

    fn write_header(&mut self, major: u8, arg: u64) {
        if arg < 24 {
            self.buf.push((major << 5) | arg as u8);
        } else if arg < 256 {
            self.buf.push((major << 5) | 24);
            self.buf.push(arg as u8);
        } else if arg < 65536 {
            self.buf.push((major << 5) | 25);
            self.buf.extend_from_slice(&(arg as u16).to_be_bytes());
        } else if arg < 4_294_967_296 {
            self.buf.push((major << 5) | 26);
            self.buf.extend_from_slice(&(arg as u32).to_be_bytes());
        } else {
            self.buf.push((major << 5) | 27);
            self.buf.extend_from_slice(&arg.to_be_bytes());
        }
    }

    // ── Primitives ───────────────────────────────────────────────────────────

    /// Encode an unsigned integer (major type 0).
    pub fn uint(mut self, v: u64) -> Self {
        self.write_header(MT_UNSIGNED, v);
        self
    }

    /// Encode a negative integer (major type 1). CBOR encodes -n as (-n-1).
    pub fn nint(mut self, v: i64) -> Self {
        if v < 0 {
            self.write_header(MT_NEGATIVE, (-1 - v) as u64);
        } else {
            self.write_header(MT_UNSIGNED, v as u64);
        }
        self
    }

    /// Encode a byte string (major type 2).
    pub fn bytes(mut self, data: &[u8]) -> Self {
        self.write_header(MT_BYTE_STRING, data.len() as u64);
        self.buf.extend_from_slice(data);
        self
    }

    /// Encode a text string (major type 3).
    pub fn text(mut self, s: &str) -> Self {
        let data = s.as_bytes();
        self.write_header(MT_TEXT_STRING, data.len() as u64);
        self.buf.extend_from_slice(data);
        self
    }

    /// Encode a bool (major type 7, simple values 20/21).
    pub fn bool(mut self, v: bool) -> Self {
        self.buf.push((MT_SIMPLE << 5) | if v { 21 } else { 20 });
        self
    }

    /// Encode null (major type 7, simple value 22).
    pub fn null(mut self) -> Self {
        self.buf.push((MT_SIMPLE << 5) | 22);
        self
    }

    // ── Composite types ──────────────────────────────────────────────────────

    /// Start a definite-length array (major type 4).
    pub fn array(mut self, len: usize) -> Self {
        self.write_header(MT_ARRAY, len as u64);
        self
    }

    /// Start an indefinite-length array (major type 4, arg 31).
    pub fn array_indef(mut self) -> Self {
        self.buf.push((MT_ARRAY << 5) | 31);
        self
    }

    /// Start a definite-length map (major type 5).
    pub fn map(mut self, len: usize) -> Self {
        self.write_header(MT_MAP, len as u64);
        self
    }

    /// Start an indefinite-length map (major type 5, arg 31).
    pub fn map_indef(mut self) -> Self {
        self.buf.push((MT_MAP << 5) | 31);
        self
    }

    /// Write a break code (0xFF) for indefinite-length items.
    pub fn break_code(mut self) -> Self {
        self.buf.push(0xFF);
        self
    }

    /// Write a tag (major type 6).
    pub fn tag(mut self, tag: u64) -> Self {
        self.write_header(MT_TAG, tag);
        self
    }

    /// Raw append (for pre-encoded sub-structures).
    pub fn raw(mut self, data: &[u8]) -> Self {
        self.buf.extend_from_slice(data);
        self
    }

    // ── &mut self variants (for use in helper functions) ─────────────────────

    /// Encode an unsigned integer (&mut self variant).
    pub fn uint_mut(&mut self, v: u64) {
        self.write_header(MT_UNSIGNED, v);
    }

    /// Encode a byte string (&mut self variant).
    pub fn bytes_mut(&mut self, data: &[u8]) {
        self.write_header(MT_BYTE_STRING, data.len() as u64);
        self.buf.extend_from_slice(data);
    }

    /// Encode a text string (&mut self variant).
    pub fn text_mut(&mut self, s: &str) {
        let data = s.as_bytes();
        self.write_header(MT_TEXT_STRING, data.len() as u64);
        self.buf.extend_from_slice(data);
    }

    /// Start a definite-length array (&mut self variant).
    pub fn array_mut(&mut self, len: usize) {
        self.write_header(MT_ARRAY, len as u64);
    }

    /// Start a definite-length map (&mut self variant).
    pub fn map_mut(&mut self, len: usize) {
        self.write_header(MT_MAP, len as u64);
    }

    /// Raw append (&mut self variant).
    pub fn raw_mut(&mut self, data: &[u8]) {
        self.buf.extend_from_slice(data);
    }
}

impl Default for CborEncoder {
    fn default() -> Self {
        Self::new()
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cardano TX CBOR helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Build a Cardano `TransactionInput` CBOR: `[tx_id: bytes(32), index: uint]`.
pub fn cardano_tx_input(tx_id: &[u8; 32], index: u32) -> Vec<u8> {
    let mut enc = CborEncoder::new();
    enc.array_mut(2);
    enc.bytes_mut(tx_id);
    enc.uint_mut(index as u64);
    enc.finish()
}

/// Build a Cardano `TransactionOutput` CBOR (post-Alonzo):
/// `{0: address(bytes), 1: amount(uint)}`.
/// For multi-asset outputs, amount is a map: `{0: lovelace, 1: {policy_id: {asset_name: amount}}}`.
pub fn cardano_tx_output_simple(address: &[u8], lovelace: u64) -> Vec<u8> {
    let mut enc = CborEncoder::new();
    enc.map_mut(2);
    enc.uint_mut(0); // key: address
    enc.bytes_mut(address);
    enc.uint_mut(1); // key: amount
    enc.uint_mut(lovelace);
    enc.finish()
}

/// Build a Cardano `TransactionOutput` with multi-asset (mint) support:
/// `{0: address(bytes), 1: {0: lovelace(uint), 1: {policy_id: {asset_name: amount}}}}`.
pub fn cardano_tx_output_multiasset(
    address: &[u8],
    lovelace: u64,
    policy_id: &[u8; 28],
    asset_name: &[u8],
    asset_amount: u64,
) -> Vec<u8> {
    let mut enc = CborEncoder::new();
    enc.map_mut(2);
    // key 0: address
    enc.uint_mut(0);
    enc.bytes_mut(address);
    // key 1: amount (map with lovelace + assets)
    enc.uint_mut(1);
    enc.map_mut(2);
    // 0: lovelace
    enc.uint_mut(0);
    enc.uint_mut(lovelace);
    // 1: assets map
    enc.uint_mut(1);
    enc.map_mut(1);
    enc.bytes_mut(policy_id);
    enc.map_mut(1);
    enc.bytes_mut(asset_name);
    enc.uint_mut(asset_amount);
    enc.finish()
}

/// Build a Cardano `TransactionBody` CBOR (simplified, no collateral/scripts):
/// ```text
/// {
///   0: [inputs...],
///   1: [outputs...],
///   2: fee(uint),
///   3: ttl(uint),
///   9: {policy_id: {asset_name: amount(int)}}  // mint
/// }
/// ```
pub fn cardano_tx_body(
    inputs_cbor: &[u8],
    outputs_cbor: &[u8],
    fee: u64,
    ttl: u64,
    policy_id: &[u8; 28],
    asset_name: &[u8],
    mint_amount: u64,
) -> Vec<u8> {
    let mut enc = CborEncoder::new();
    // Map with 5 entries: inputs(0), outputs(1), fee(2), ttl(3), mint(9)
    enc.map_mut(5);

    // 0: inputs
    enc.uint_mut(0);
    enc.raw_mut(inputs_cbor);

    // 1: outputs
    enc.uint_mut(1);
    enc.raw_mut(outputs_cbor);

    // 2: fee
    enc.uint_mut(2);
    enc.uint_mut(fee);

    // 3: ttl
    enc.uint_mut(3);
    enc.uint_mut(ttl);

    // 9: mint (map of policy_id → {asset_name → amount})
    // amount is a positive int for minting
    enc.uint_mut(9);
    enc.map_mut(1);
    enc.bytes_mut(policy_id);
    enc.map_mut(1);
    enc.bytes_mut(asset_name);
    enc.uint_mut(mint_amount);

    enc.finish()
}

/// Build a Cardano `TransactionWitnessSet` CBOR with a single vkey witness:
/// `{0: [[vkey(bytes32), sig(bytes64)]]}`.
pub fn cardano_witness_set(vkey: &[u8; 32], signature: &[u8; 64]) -> Vec<u8> {
    let mut enc = CborEncoder::new();
    enc.map_mut(1);
    // key 0: vkeywitnesses
    enc.uint_mut(0);
    // array of 1 witness
    enc.array_mut(1);
    // each witness is [vkey, sig]
    enc.array_mut(2);
    enc.bytes_mut(vkey);
    enc.bytes_mut(signature);
    enc.finish()
}

/// Build a complete Cardano `Transaction` CBOR:
/// `[body, witness_set]` (array of 2, no auxiliary data).
pub fn cardano_transaction(body_cbor: &[u8], witness_set_cbor: &[u8]) -> Vec<u8> {
    let mut enc = CborEncoder::new();
    enc.array_mut(2);
    enc.raw_mut(body_cbor);
    enc.raw_mut(witness_set_cbor);
    enc.finish()
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_uint_small() {
        // 0 → 0x00
        let enc = CborEncoder::new().uint(0).finish();
        assert_eq!(enc, vec![0x00]);
        // 1 → 0x01
        let enc = CborEncoder::new().uint(1).finish();
        assert_eq!(enc, vec![0x01]);
        // 23 → 0x17
        let enc = CborEncoder::new().uint(23).finish();
        assert_eq!(enc, vec![0x17]);
    }

    #[test]
    fn test_uint_one_byte() {
        // 24 → 0x18 0x18
        let enc = CborEncoder::new().uint(24).finish();
        assert_eq!(enc, vec![0x18, 0x18]);
        // 255 → 0x18 0xFF
        let enc = CborEncoder::new().uint(255).finish();
        assert_eq!(enc, vec![0x18, 0xFF]);
    }

    #[test]
    fn test_uint_two_byte() {
        // 256 → 0x19 0x01 0x00
        let enc = CborEncoder::new().uint(256).finish();
        assert_eq!(enc, vec![0x19, 0x01, 0x00]);
        // 1000 → 0x19 0x03 0xE8
        let enc = CborEncoder::new().uint(1000).finish();
        assert_eq!(enc, vec![0x19, 0x03, 0xE8]);
    }

    #[test]
    fn test_uint_four_byte() {
        // 65536 → 0x1A 0x00 0x01 0x00 0x00
        let enc = CborEncoder::new().uint(65536).finish();
        assert_eq!(enc, vec![0x1A, 0x00, 0x01, 0x00, 0x00]);
    }

    #[test]
    fn test_uint_eight_byte() {
        // 4294967296 → 0x1B 0x00 0x00 0x00 0x01 0x00 0x00 0x00 0x00
        let enc = CborEncoder::new().uint(4_294_967_296).finish();
        assert_eq!(enc[0], 0x1B);
        assert_eq!(enc.len(), 9);
    }

    #[test]
    fn test_bytes_empty() {
        let enc = CborEncoder::new().bytes(&[]).finish();
        assert_eq!(enc, vec![0x40]); // major 2, arg 0
    }

    #[test]
    fn test_bytes_short() {
        let enc = CborEncoder::new().bytes(&[0xde, 0xad]).finish();
        assert_eq!(enc, vec![0x42, 0xde, 0xad]); // major 2, arg 2, data
    }

    #[test]
    fn test_text() {
        let enc = CborEncoder::new().text("hi").finish();
        assert_eq!(enc, vec![0x62, b'h', b'i']); // major 3, arg 2, data
    }

    #[test]
    fn test_array_definite() {
        let enc = CborEncoder::new().array(2).uint(1).uint(2).finish();
        assert_eq!(enc, vec![0x82, 0x01, 0x02]); // major 4, arg 2
    }

    #[test]
    fn test_map_definite() {
        let enc = CborEncoder::new().map(1).uint(0).uint(42).finish();
        assert_eq!(enc, vec![0xA1, 0x00, 0x18, 0x2A]); // major 5, arg 1
    }

    #[test]
    fn test_bool() {
        assert_eq!(CborEncoder::new().bool(false).finish(), vec![0xF4]);
        assert_eq!(CborEncoder::new().bool(true).finish(), vec![0xF5]);
    }

    #[test]
    fn test_null() {
        assert_eq!(CborEncoder::new().null().finish(), vec![0xF6]);
    }

    #[test]
    fn test_nint() {
        // -1 → major 1, arg 0 → 0x20
        let enc = CborEncoder::new().nint(-1).finish();
        assert_eq!(enc, vec![0x20]);
        // -10 → major 1, arg 9 → 0x29
        let enc = CborEncoder::new().nint(-10).finish();
        assert_eq!(enc, vec![0x29]);
    }

    #[test]
    fn test_tag() {
        // Tag 24 → 0xD8 0x18
        let enc = CborEncoder::new().tag(24).finish();
        assert_eq!(enc, vec![0xD8, 0x18]);
    }

    #[test]
    fn test_array_indef() {
        let enc = CborEncoder::new()
            .array_indef()
            .uint(1)
            .break_code()
            .finish();
        assert_eq!(enc, vec![0x9F, 0x01, 0xFF]);
    }

    // ── Cardano helpers ──────────────────────────────────────────────────────

    #[test]
    fn test_cardano_tx_input() {
        let tx_id = [0xab; 32];
        let cbor = cardano_tx_input(&tx_id, 0);
        // array(2) + bytes(32) + uint(0)
        assert_eq!(cbor[0], 0x82); // array of 2
        assert_eq!(cbor[1], 0x58); // bytes, 1-byte length
        assert_eq!(cbor[2], 32); // length
        assert_eq!(cbor[3], 0xab); // first byte of tx_id
    }

    #[test]
    fn test_cardano_tx_output_simple() {
        let addr = [0x01; 28];
        let cbor = cardano_tx_output_simple(&addr, 1_000_000);
        // map(2) + uint(0) + bytes(28) + uint(1) + uint(1000000)
        assert_eq!(cbor[0], 0xA2); // map of 2
    }

    #[test]
    fn test_cardano_tx_output_multiasset() {
        let addr = [0x01; 28];
        let policy = [0x02; 28];
        let asset_name = b"wZION";
        let cbor = cardano_tx_output_multiasset(&addr, 1_000_000, &policy, asset_name, 500);
        assert_eq!(cbor[0], 0xA2); // outer map of 2
        assert!(!cbor.is_empty());
    }

    #[test]
    fn test_cardano_witness_set() {
        let vkey = [0x42; 32];
        let sig = [0x55; 64];
        let cbor = cardano_witness_set(&vkey, &sig);
        // map(1) + uint(0) + array(1) + array(2) + bytes(32) + bytes(64)
        assert_eq!(cbor[0], 0xA1); // map of 1
    }

    #[test]
    fn test_cardano_transaction() {
        let body = vec![0xA5]; // fake body
        let witness = vec![0xA1]; // fake witness
        let cbor = cardano_transaction(&body, &witness);
        assert_eq!(cbor[0], 0x82); // array of 2
        assert_eq!(cbor[1], 0xA5); // body
        assert_eq!(cbor[2], 0xA1); // witness
    }

    #[test]
    fn test_cardano_tx_body_structure() {
        let inputs = cardano_tx_input(&[0xab; 32], 0);
        // Wrap inputs in an array
        let inputs_arr = {
            let mut e = CborEncoder::new();
            e.array_mut(1);
            e.raw_mut(&inputs);
            e.finish()
        };
        let outputs = cardano_tx_output_simple(&[0x01; 28], 1_000_000);
        let outputs_arr = {
            let mut e = CborEncoder::new();
            e.array_mut(1);
            e.raw_mut(&outputs);
            e.finish()
        };
        let body = cardano_tx_body(
            &inputs_arr,
            &outputs_arr,
            170_000,  // fee
            99999999, // ttl
            &[0x02; 28],
            b"wZION",
            500,
        );
        // Should start with map(5) = 0xA5
        assert_eq!(body[0], 0xA5);
        assert!(body.len() > 50);
    }
}
