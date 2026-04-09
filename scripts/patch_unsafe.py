#!/usr/bin/env python3
"""Fix: wrap .block(true) calls in unsafe blocks."""

path = '/root/zion-2.9.6/V3/L1/miner/src/gpu_backend.rs'
with open(path, 'r') as f:
    code = f.read()

# Fix header write
code = code.replace(
    'self.header_buf.write(&header_bytes[..]).block(true).enq()?;',
    'unsafe { self.header_buf.write(&header_bytes[..]).block(true).enq()? };'
)

# Fix sentinel write
code = code.replace(
    'self.result_nonce_buf.write(&sentinel_slice[..]).block(true).enq()?;',
    'unsafe { self.result_nonce_buf.write(&sentinel_slice[..]).block(true).enq()? };'
)

# Fix nonce read
code = code.replace(
    'self.result_nonce_buf.read(&mut nonce_out).block(true).enq()?;',
    'unsafe { self.result_nonce_buf.read(&mut nonce_out).block(true).enq()? };'
)

# Fix hash read
code = code.replace(
    'self.result_hash_buf.read(&mut hash_out).block(true).enq()?;',
    'unsafe { self.result_hash_buf.read(&mut hash_out).block(true).enq()? };'
)

with open(path, 'w') as f:
    f.write(code)

print("Fixed unsafe blocks")
