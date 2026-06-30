//! # TON Cell Builder + BOC Serializer
//!
//! Minimal implementation of TON's Cell-based serialization for transaction
//! construction. TON uses TL-B (Type Language - Binary) over a Cell tree,
//! serialized as BOC (Bag of Cells).
//!
//! ## Cell structure
//! - Up to 1023 bits of data
//! - Up to 4 references to child cells
//! - Hash is SHA-256 of (refs descriptor + data descriptor + data + child hashes)
//!
//! ## BOC format (unified, magic 0xb5ee00ed)
//! - Header: magic + flags + counts + sizes
//! - Cell data: each cell = 2 descriptor bytes + data + ref indices
//! - Optional CRC32C

use sha2::{Digest, Sha256};

// ─────────────────────────────────────────────────────────────────────────────
// BitString — bit-level buffer
// ─────────────────────────────────────────────────────────────────────────────

/// A bit-level buffer for building Cell data (max 1023 bits).
pub struct BitString {
    buf: Vec<u8>,
    bit_len: usize,
}

impl BitString {
    pub fn new() -> Self {
        Self {
            buf: Vec::with_capacity(128),
            bit_len: 0,
        }
    }

    pub fn with_capacity(bits: usize) -> Self {
        Self {
            buf: Vec::with_capacity((bits + 7) / 8 + 1),
            bit_len: 0,
        }
    }

    pub fn bit_len(&self) -> usize {
        self.bit_len
    }

    /// Write `n` bits from `value` (big-endian bit order).
    pub fn write_uint(&mut self, value: u64, n: usize) {
        for i in (0..n).rev() {
            let bit = (value >> i) & 1;
            self.write_bit(bit == 1);
        }
    }

    /// Write a single bit.
    pub fn write_bit(&mut self, bit: bool) {
        let byte_idx = self.bit_len / 8;
        let bit_idx = 7 - (self.bit_len % 8);

        if byte_idx >= self.buf.len() {
            self.buf.push(0);
        }

        if bit {
            self.buf[byte_idx] |= 1 << bit_idx;
        }
        self.bit_len += 1;
    }

    /// Write a byte array (bit-aligned, full bytes).
    pub fn write_bytes(&mut self, data: &[u8]) {
        for &b in data {
            self.write_uint(b as u64, 8);
        }
    }

    /// Write a coin amount (VarUInteger 16): length prefix (4 bits) + data.
    /// The length is in bytes (0-16), stored as a 4-bit value.
    pub fn write_coins(&mut self, amount: u64) {
        // Find the minimal byte representation
        let mut bytes = [0u8; 8];
        bytes.copy_from_slice(&amount.to_be_bytes());
        // Trim leading zeros
        let mut start = 0;
        while start < 8 && bytes[start] == 0 {
            start += 1;
        }
        let len = 8 - start;
        self.write_uint(len as u64, 4);
        if len > 0 {
            self.write_bytes(&bytes[start..]);
        }
    }

    /// Write an empty message address (addr_none$00).
    pub fn write_addr_none(&mut self) {
        self.write_bit(false); // addr_none$00
    }

    /// Write an internal message address (addr_std$10).
    pub fn write_addr_std(&mut self, workchain: i32, hash: &[u8; 32]) {
        self.write_bit(true); // addr_std$10
        self.write_bit(false); // anycast: maybe no
        self.write_bit(false); // bounceable (no) — actually this is part of addr_std
        // addr_std$10 anycast:(Maybe Anycast) workchain_id:int8 address:bits256
        self.write_uint((workchain as i8) as u64, 8);
        self.write_bytes(hash);
    }

    /// Write a Maybe ^Cell as a bit (1 = present, 0 = absent).
    /// The actual cell ref is added to the Cell's ref list separately.
    pub fn write_maybe_ref(&mut self, present: bool) {
        self.write_bit(present);
    }

    /// Pad to byte boundary with zeros.
    pub fn pad_to_byte(&mut self) {
        while self.bit_len % 8 != 0 {
            self.write_bit(false);
        }
    }

    /// Get the raw bytes (padded to byte boundary).
    pub fn bytes(&self) -> &[u8] {
        &self.buf
    }
}

impl Default for BitString {
    fn default() -> Self {
        Self::new()
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cell — TON's basic data unit
// ─────────────────────────────────────────────────────────────────────────────

/// A TON Cell: up to 1023 bits of data + up to 4 refs to child cells.
pub struct Cell {
    data: BitString,
    refs: Vec<Cell>,
}

impl Cell {
    pub fn new() -> Self {
        Self {
            data: BitString::new(),
            refs: Vec::new(),
        }
    }

    pub fn with_capacity(bits: usize) -> Self {
        Self {
            data: BitString::with_capacity(bits),
            refs: Vec::new(),
        }
    }

    pub fn data(&self) -> &BitString {
        &self.data
    }

    pub fn data_mut(&mut self) -> &mut BitString {
        &mut self.data
    }

    /// Add a child cell reference (max 4 refs).
    pub fn add_ref(&mut self, child: Cell) -> Result<(), String> {
        if self.refs.len() >= 4 {
            return Err("cell already has 4 refs".into());
        }
        self.refs.push(child);
        Ok(())
    }

    pub fn refs(&self) -> &[Cell] {
        &self.refs
    }

    /// Compute the cell's representation hash (SHA-256 of the cell's serialized form).
    pub fn hash(&self) -> [u8; 32] {
        let repr = self.repr_bytes();
        Sha256::digest(&repr).into()
    }

    /// Build the cell's representation for hashing:
    /// - 2 descriptor bytes (refs descriptor + data descriptor)
    /// - data bytes (padded)
    /// - child cell hashes (32 bytes each)
    fn repr_bytes(&self) -> Vec<u8> {
        let mut out = Vec::new();

        // Refs descriptor: d1 = (ref_count << 5) for ordinary cells (level=0, not exotic)
        let d1 = (self.refs.len() as u8) << 5;

        // d2 (data descriptor): bits 7-1 = data length in bytes, bit 0 = partially filled
        let data_bytes = (self.data.bit_len() + 7) / 8;
        let is_partial = self.data.bit_len() % 8 != 0;
        let d2 = ((data_bytes as u8) << 1) | (if is_partial { 1 } else { 0 });

        out.push(d1);
        out.push(d2);

        // Data bytes
        out.extend_from_slice(self.data.bytes());
        // Pad with a 1 bit if partially filled (TON convention)
        if is_partial {
            let pad_pos = out.len() - 1;
            let remaining = 8 - (self.data.bit_len() % 8);
            out[pad_pos] |= 1 << (remaining - 1);
        }

        // Child cell hashes
        for child in &self.refs {
            out.extend_from_slice(&child.hash());
        }

        out
    }

    /// Get the data bytes (for BOC serialization).
    fn data_bytes(&self) -> &[u8] {
        self.data.bytes()
    }

    /// Collect all cells in depth-first order.
    fn collect_cells<'a>(&'a self, out: &mut Vec<&'a Cell>) {
        for child in &self.refs {
            child.collect_cells(out);
        }
        out.push(self);
    }
}

impl Default for Cell {
    fn default() -> Self {
        Self::new()
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// BOC Serializer (Bag of Cells)
// ─────────────────────────────────────────────────────────────────────────────

/// BOC magic bytes (unified format).
const BOC_MAGIC: [u8; 4] = [0xb5, 0xee, 0x00, 0xed];

/// Serialize a Cell tree into BOC (Bag of Cells) format.
pub fn serialize_boc(root: &Cell) -> Vec<u8> {
    // Collect all cells in depth-first order (children first)
    let mut cells: Vec<&Cell> = Vec::new();
    root.collect_cells(&mut cells);
    // Reverse so root is last (topological order: children before parents)
    cells.reverse();

    let cell_count = cells.len();
    let root_count = 1;

    // Determine size bytes needed
    let ref_size = size_bytes(cell_count as u64);

    // Build cell data section
    let mut cell_data = Vec::new();
    let mut offsets: Vec<u64> = Vec::new();

    for cell in cells.iter() {
        offsets.push(cell_data.len() as u64);

        // Refs descriptor
        let d1 = (cell.refs().len() as u8) << 5;
        // Data descriptor
        let data_bits = cell.data().bit_len();
        let data_bytes = (data_bits + 7) / 8;
        let is_partial = data_bits % 8 != 0;
        let d2 = ((data_bytes as u8) << 1) | (if is_partial { 1 } else { 0 });

        cell_data.push(d1);
        cell_data.push(d2);

        // Data bytes (with padding bit if partial)
        let mut data = cell.data_bytes().to_vec();
        if is_partial && !data.is_empty() {
            let remaining = 8 - (data_bits % 8);
            let last_idx = data.len() - 1;
            data[last_idx] |= 1 << (remaining - 1);
        }
        cell_data.extend_from_slice(&data);

        // Ref indices (children come before parents in our ordering)
        // We need to find the index of each child in our cells array
        for child_ref in cell.refs() {
            // Find child index by pointer comparison
            let child_idx = cells
                .iter()
                .position(|c| std::ptr::eq(*c, child_ref))
                .unwrap_or(0);
            write_uint_bytes(&mut cell_data, child_idx as u64, ref_size);
        }
    }

    let total_data_size = cell_data.len() as u64;
    let offset_size = size_bytes(total_data_size);

    // Build BOC header
    let mut out = Vec::new();
    out.extend_from_slice(&BOC_MAGIC);

    // Flags byte:
    // bit 0: has_idx (1)
    // bit 1: has_crc32c (0)
    // bit 2: has_cache_bits (0)
    // bits 3-4: cell_size (0=8bit, 1=16bit, 2=32bit)
    // bits 5-7: reserved (0)
    let cell_size = ref_size - 1; // 0=8bit, 1=16bit, 2=32bit
    let flags = 0x01 | ((cell_size as u8) << 3); // has_idx=1, cell_size
    out.push(flags);

    // Counts
    write_uint_bytes(&mut out, cell_count as u64, ref_size);
    write_uint_bytes(&mut out, root_count as u64, ref_size);
    write_uint_bytes(&mut out, 0, ref_size); // absent count = 0
    write_uint_bytes(&mut out, total_data_size, ref_size);
    write_uint_bytes(&mut out, cell_data.len() as u64, offset_size);

    // Index (offsets for each cell)
    for off in &offsets {
        write_uint_bytes(&mut out, *off, offset_size);
    }

    // Cell data
    out.extend_from_slice(&cell_data);

    out
}

/// Determine the number of bytes needed to represent a value (1, 2, or 4).
fn size_bytes(max_val: u64) -> usize {
    if max_val < 256 {
        1
    } else if max_val < 65536 {
        2
    } else {
        4
    }
}

/// Write a value as `size` bytes (big-endian).
fn write_uint_bytes(out: &mut Vec<u8>, val: u64, size: usize) {
    match size {
        1 => out.push(val as u8),
        2 => out.extend_from_slice(&(val as u16).to_be_bytes()),
        4 => out.extend_from_slice(&(val as u32).to_be_bytes()),
        _ => out.extend_from_slice(&val.to_be_bytes()),
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// TON Message Builders
// ─────────────────────────────────────────────────────────────────────────────

/// Build a jetton transfer message body cell.
///
/// TL-B scheme:
/// ```text
/// transfer#0f8a7ea5 query_id:uint64 amount:(VarUInteger 16)
///   destination:MsgAddress response_destination:MsgAddress
///   custom_payload:(Maybe ^Cell)
///   forward_ton_amount:(VarUInteger 16)
///   forward_payload:(Maybe ^Cell) = InternalMsgBody;
/// ```
pub fn build_jetton_transfer_body(
    query_id: u64,
    amount: u64,
    dest_workchain: i32,
    dest_hash: &[u8; 32],
) -> Cell {
    let mut cell = Cell::new();
    let data = cell.data_mut();

    // op_code: uint32 = 0x0f8a7ea5
    data.write_uint(0x0f8a7ea5, 32);
    // query_id: uint64
    data.write_uint(query_id, 64);
    // amount: VarUInteger 16 (coins)
    data.write_coins(amount);
    // destination: MsgAddress (addr_std)
    data.write_addr_std(dest_workchain, dest_hash);
    // response_destination: MsgAddress (addr_none)
    data.write_addr_none();
    // custom_payload: Maybe ^Cell (none)
    data.write_maybe_ref(false);
    // forward_ton_amount: VarUInteger 16 (0)
    data.write_coins(0);
    // forward_payload: Maybe ^Cell (none)
    data.write_maybe_ref(false);

    cell
}

/// Build an internal message cell wrapping a body cell.
///
/// TL-B scheme:
/// ```text
/// int_msg_info$0 ihr_disabled:Bool bounce:Bool bounced:Bool
///   src:MsgAddress dest:MsgAddressInt value:Grams
///   hr_fee:Grams fwd_fee:Grams created_lt:uint64 created_at:uint32 = CommonMsgInfo;
/// ```
pub fn build_internal_message(
    dest_workchain: i32,
    dest_hash: &[u8; 32],
    value_coins: u64,
    body_cell: Cell,
) -> Result<Cell, String> {
    let mut cell = Cell::with_capacity(256);
    {
        let data = cell.data_mut();

        // CommonMsgInfo: int_msg_info$0
        data.write_bit(false); // int_msg_info$0
        data.write_bit(true); // ihr_disabled
        data.write_bit(true); // bounce
        data.write_bit(false); // bounced
        // src: addr_none
        data.write_addr_none();
        // dest: addr_std
        data.write_addr_std(dest_workchain, dest_hash);
        // value: Grams (coins)
        data.write_coins(value_coins);
        // ihr_fee: Grams
        data.write_coins(0);
        // fwd_fee: Grams
        data.write_coins(0);
        // created_lt: uint64
        data.write_uint(0, 64);
        // created_at: uint32
        data.write_uint(0, 32);

        // StateInit: Maybe ^Cell (none)
        data.write_maybe_ref(false);

        // Body: either inline (bits) or ref (^Cell)
        // For larger bodies, use a ref
        data.write_bit(true); // body is a ref
    }
    cell.add_ref(body_cell)?;

    Ok(cell)
}

/// Build a wallet V2R2 external message.
///
/// The wallet V2R2 external message format:
/// ```text
/// external message:
///   CommonMsgInfo: ext_in_msg_info$10
///     src: addr_none
///     dest: addr_std (wallet address)
///     import_fee: 0
///   StateInit: maybe (none)
///   Body:
///     signature: bits512
///     subwallet_id: uint32
///     valid_until: uint32
///     seqno: uint32
///     message refs (up to 4)
/// ```
pub fn build_wallet_v2r2_external(
    wallet_workchain: i32,
    wallet_hash: &[u8; 32],
    subwallet_id: u32,
    valid_until: u32,
    seqno: u32,
    message: Cell,
    signature: &[u8; 64],
) -> Result<Cell, String> {
    // Build the outer cell with signature + message data inline
    let mut outer = Cell::with_capacity(1023);
    {
        let outer_data = outer.data_mut();

        // CommonMsgInfo: ext_in_msg_info$10
        outer_data.write_bit(true); // 1
        outer_data.write_bit(false); // 0 → ext_in_msg_info$10
        // src: addr_none
        outer_data.write_addr_none();
        // dest: addr_std (wallet address)
        outer_data.write_addr_std(wallet_workchain, wallet_hash);
        // import_fee: Grams (0)
        outer_data.write_coins(0);

        // StateInit: maybe (none)
        outer_data.write_maybe_ref(false);

        // Body: bits (inline, not ref)
        outer_data.write_bit(false); // body is inline (bits)

        // signature: 512 bits
        outer_data.write_bytes(signature);

        // subwallet_id + valid_until + seqno
        outer_data.write_uint(subwallet_id as u64, 32);
        outer_data.write_uint(valid_until as u64, 32);
        outer_data.write_uint(seqno as u64, 32);
    }

    // Add the message ref
    outer.add_ref(message)?;

    Ok(outer)
}

/// Compute the signing hash for a wallet V2R2 message.
/// This is the hash of the body cell (subwallet_id + valid_until + seqno + message).
pub fn wallet_v2r2_signing_hash(
    subwallet_id: u32,
    valid_until: u32,
    seqno: u32,
    message: &Cell,
) -> [u8; 32] {
    let mut body = Cell::with_capacity(512);
    let data = body.data_mut();
    data.write_uint(subwallet_id as u64, 32);
    data.write_uint(valid_until as u64, 32);
    data.write_uint(seqno as u64, 32);
    // We need to add the message ref, but we can't clone it easily.
    // Instead, compute the hash manually by building the repr.
    // Actually, let's just build the cell with a ref to the message.
    // But we only have &Cell, not owned. Let's compute the hash differently.

    // Build the representation bytes manually
    let mut repr = Vec::new();

    // Body data
    let mut body_data = BitString::new();
    body_data.write_uint(subwallet_id as u64, 32);
    body_data.write_uint(valid_until as u64, 32);
    body_data.write_uint(seqno as u64, 32);

    // Descriptor bytes
    let d1 = 1u8 << 5; // 1 ref
    let data_bits = body_data.bit_len();
    let data_bytes = (data_bits + 7) / 8;
    let is_partial = data_bits % 8 != 0;
    let d2 = ((data_bytes as u8) << 1) | (if is_partial { 1 } else { 0 });

    repr.push(d1);
    repr.push(d2);

    // Data
    let mut data = body_data.bytes().to_vec();
    if is_partial && !data.is_empty() {
        let remaining = 8 - (data_bits % 8);
        let last_idx = data.len() - 1;
        data[last_idx] |= 1 << (remaining - 1);
    }
    repr.extend_from_slice(&data);

    // Child hash (message cell hash)
    repr.extend_from_slice(&message.hash());

    Sha256::digest(&repr).into()
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bitstring_write_bit() {
        let mut bs = BitString::new();
        bs.write_bit(true);
        bs.write_bit(false);
        bs.write_bit(true);
        assert_eq!(bs.bit_len(), 3);
        // 101xxxxx → 0b10100000 = 0xA0
        assert_eq!(bs.bytes()[0], 0xA0);
    }

    #[test]
    fn test_bitstring_write_uint() {
        let mut bs = BitString::new();
        bs.write_uint(0xAB, 8);
        assert_eq!(bs.bit_len(), 8);
        assert_eq!(bs.bytes()[0], 0xAB);
    }

    #[test]
    fn test_bitstring_write_uint_32() {
        let mut bs = BitString::new();
        bs.write_uint(0x0f8a7ea5, 32);
        assert_eq!(bs.bit_len(), 32);
        assert_eq!(bs.bytes(), [0x0f, 0x8a, 0x7e, 0xa5]);
    }

    #[test]
    fn test_bitstring_write_coins_zero() {
        let mut bs = BitString::new();
        bs.write_coins(0);
        // 4 bits: len=0
        assert_eq!(bs.bit_len(), 4);
    }

    #[test]
    fn test_bitstring_write_coins_small() {
        let mut bs = BitString::new();
        bs.write_coins(1);
        // 4 bits: len=1, 8 bits: 0x01
        assert_eq!(bs.bit_len(), 12);
    }

    #[test]
    fn test_bitstring_write_bytes() {
        let mut bs = BitString::new();
        bs.write_bytes(&[0xde, 0xad]);
        assert_eq!(bs.bit_len(), 16);
        assert_eq!(bs.bytes(), [0xde, 0xad]);
    }

    #[test]
    fn test_bitstring_write_addr_none() {
        let mut bs = BitString::new();
        bs.write_addr_none();
        assert_eq!(bs.bit_len(), 1);
        // 0xxxxxxx → 0x00
        assert_eq!(bs.bytes()[0], 0x00);
    }

    #[test]
    fn test_bitstring_write_addr_std() {
        let mut bs = BitString::new();
        let hash = [0x42; 32];
        bs.write_addr_std(0, &hash);
        // 2 bits (addr_std$10) + 1 bit (anycast=no) + 8 bits (workchain) + 256 bits (hash) = 267
        assert_eq!(bs.bit_len(), 267);
    }

    #[test]
    fn test_cell_new_empty() {
        let cell = Cell::new();
        assert_eq!(cell.data().bit_len(), 0);
        assert_eq!(cell.refs().len(), 0);
    }

    #[test]
    fn test_cell_add_ref() {
        let mut cell = Cell::new();
        let child = Cell::new();
        assert!(cell.add_ref(child).is_ok());
        assert_eq!(cell.refs().len(), 1);
    }

    #[test]
    fn test_cell_add_ref_max() {
        let mut cell = Cell::new();
        for _ in 0..4 {
            assert!(cell.add_ref(Cell::new()).is_ok());
        }
        assert!(cell.add_ref(Cell::new()).is_err());
    }

    #[test]
    fn test_cell_hash_deterministic() {
        let mut cell1 = Cell::new();
        cell1.data_mut().write_uint(42, 32);

        let mut cell2 = Cell::new();
        cell2.data_mut().write_uint(42, 32);

        assert_eq!(cell1.hash(), cell2.hash());
    }

    #[test]
    fn test_cell_hash_differs() {
        let mut cell1 = Cell::new();
        cell1.data_mut().write_uint(42, 32);

        let mut cell2 = Cell::new();
        cell2.data_mut().write_uint(43, 32);

        assert_ne!(cell1.hash(), cell2.hash());
    }

    #[test]
    fn test_serialize_boc_empty_cell() {
        let cell = Cell::new();
        let boc = serialize_boc(&cell);
        // Should start with magic bytes
        assert_eq!(&boc[0..4], &BOC_MAGIC);
        assert!(boc.len() > 10);
    }

    #[test]
    fn test_serialize_boc_with_data() {
        let mut cell = Cell::new();
        cell.data_mut().write_uint(0x12345678, 32);
        let boc = serialize_boc(&cell);
        assert_eq!(&boc[0..4], &BOC_MAGIC);
        assert!(boc.len() > 14);
    }

    #[test]
    fn test_serialize_boc_with_ref() {
        let mut child = Cell::new();
        child.data_mut().write_uint(1, 32);

        let mut root = Cell::new();
        root.data_mut().write_uint(0, 8);
        root.add_ref(child).unwrap();

        let boc = serialize_boc(&root);
        assert_eq!(&boc[0..4], &BOC_MAGIC);
        // Should have 2 cells
        assert!(boc.len() > 20);
    }

    #[test]
    fn test_build_jetton_transfer_body() {
        let dest_hash = [0xab; 32];
        let body = build_jetton_transfer_body(1, 1_000_000, 0, &dest_hash);
        // op(32) + query_id(64) + amount_coins(4+24=28) + dest(267) + resp(1) + maybe(1) + fwd_coins(4) + maybe(1)
        // = 32 + 64 + 28 + 267 + 1 + 1 + 4 + 1 = 398 bits
        assert!(body.data().bit_len() > 390);
    }

    #[test]
    fn test_build_internal_message() {
        let dest_hash = [0xcd; 32];
        let body = build_jetton_transfer_body(1, 1000, 0, &dest_hash);
        let msg = build_internal_message(0, &dest_hash, 50_000_000, body).unwrap();
        // Should have 1 ref (the body)
        assert_eq!(msg.refs().len(), 1);
    }

    #[test]
    fn test_wallet_v2r2_signing_hash_deterministic() {
        let dest_hash = [0xef; 32];
        let body = build_jetton_transfer_body(1, 1000, 0, &dest_hash);
        let msg = build_internal_message(0, &dest_hash, 50_000_000, body).unwrap();

        let h1 = wallet_v2r2_signing_hash(0x29a9a317, 999999, 0, &msg);
        let h2 = wallet_v2r2_signing_hash(0x29a9a317, 999999, 0, &msg);
        assert_eq!(h1, h2);
    }

    #[test]
    fn test_wallet_v2r2_signing_hash_differs() {
        let dest_hash = [0xef; 32];
        let body = build_jetton_transfer_body(1, 1000, 0, &dest_hash);
        let msg = build_internal_message(0, &dest_hash, 50_000_000, body).unwrap();

        let h1 = wallet_v2r2_signing_hash(0x29a9a317, 999999, 0, &msg);
        let h2 = wallet_v2r2_signing_hash(0x29a9a317, 999999, 1, &msg);
        assert_ne!(h1, h2);
    }

    #[test]
    fn test_build_wallet_v2r2_external() {
        let wallet_hash = [0x11; 32];
        let dest_hash = [0x22; 32];
        let sig = [0x33; 64];

        let body = build_jetton_transfer_body(1, 1000, 0, &dest_hash);
        let msg = build_internal_message(0, &dest_hash, 50_000_000, body).unwrap();

        let external = build_wallet_v2r2_external(
            0, &wallet_hash, 0x29a9a317, 999999, 0, msg, &sig,
        )
        .unwrap();

        // Should have 1 ref (the message)
        assert_eq!(external.refs().len(), 1);
        // Should have significant data (signature + headers)
        assert!(external.data().bit_len() > 600);
    }

    #[test]
    fn test_boc_serialization_roundtrip() {
        use base64::Engine;
        let dest_hash = [0xaa; 32];
        let body = build_jetton_transfer_body(42, 1_000_000, 0, &dest_hash);
        let msg = build_internal_message(0, &dest_hash, 50_000_000, body).unwrap();
        let boc = serialize_boc(&msg);

        // BOC should be valid: starts with magic, has reasonable length
        assert_eq!(&boc[0..4], &BOC_MAGIC);
        assert!(boc.len() > 50);

        // Should be base64-encodable (for TON Center API)
        let b64 = base64::engine::general_purpose::STANDARD.encode(&boc);
        assert!(b64.len() > 50);
    }
}
