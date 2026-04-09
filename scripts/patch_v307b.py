#!/usr/bin/env python3
"""Patch: add q.finish() after compilation + use blocking writes.
AMD gfx900 command queue is broken for async writes after kernel compilation."""

path = '/root/zion-2.9.6/V3/L1/miner/src/gpu_backend.rs'
with open(path, 'r') as f:
    code = f.read()

changes = 0

# 1) Add q.finish() right after obtaining the queue from ProQue
old_q = '            println!("gpu_opencl_compiled ok"); let _ = std::io::stdout().flush();\n            let q = pro_que.queue().clone();'
new_q = '            println!("gpu_opencl_compiled ok"); let _ = std::io::stdout().flush();\n            let q = pro_que.queue().clone();\n            q.finish()?;\n            println!("gpu: queue flushed after compile"); let _ = std::io::stdout().flush();'
if old_q in code and 'queue flushed after compile' not in code:
    code = code.replace(old_q, new_q, 1)
    changes += 1
    print("1) Added q.finish() after compilation")

# 2) In mine_batch: change all .write().enq() to .write().block(true).enq()
# header_buf write
old_hdr_write = 'self.header_buf.write(&header_bytes[..]).enq()?;'
new_hdr_write = 'self.header_buf.write(&header_bytes[..]).block(true).enq()?;'
if old_hdr_write in code:
    code = code.replace(old_hdr_write, new_hdr_write, 1)
    changes += 1
    print("2) Made header_buf write blocking")

# sentinel write
old_sent_write = 'self.result_nonce_buf.write(&sentinel_slice[..]).enq()?;'
new_sent_write = 'self.result_nonce_buf.write(&sentinel_slice[..]).block(true).enq()?;'
if old_sent_write in code:
    code = code.replace(old_sent_write, new_sent_write, 1)
    changes += 1
    print("3) Made sentinel write blocking")

# result read
old_nonce_read = 'self.result_nonce_buf.read(&mut nonce_out).enq()?;'
new_nonce_read = 'self.result_nonce_buf.read(&mut nonce_out).block(true).enq()?;'
if old_nonce_read in code:
    code = code.replace(old_nonce_read, new_nonce_read, 1)
    changes += 1
    print("4) Made nonce read blocking")

old_hash_read = 'self.result_hash_buf.read(&mut hash_out).enq()?;'
new_hash_read = 'self.result_hash_buf.read(&mut hash_out).block(true).enq()?;'
if old_hash_read in code:
    code = code.replace(old_hash_read, new_hash_read, 1)
    changes += 1
    print("5) Made hash read blocking")

# 3) Also try: after NPU buffer creation, flush queue before kernel build
old_kernel_build = '            println!("gpu: building kernel args..."); let _ = std::io::stdout().flush();'
new_kernel_build = '            q.finish()?;\n            println!("gpu: building kernel args... (queue flushed)"); let _ = std::io::stdout().flush();'
if old_kernel_build in code and 'queue flushed)' not in code:
    code = code.replace(old_kernel_build, new_kernel_build, 1)
    changes += 1
    print("6) Added q.finish() before kernel arg build")

with open(path, 'w') as f:
    f.write(code)

print(f"Applied {changes} changes. Patch v3.0.7b complete")
