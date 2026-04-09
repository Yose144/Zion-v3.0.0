#!/usr/bin/env python3
"""Patch: add separate transfer queue for AMD gfx900.
The compilation queue deadlocks on clEnqueueWriteBuffer after clBuildProgram."""

path = '/root/zion-2.9.6/V3/L1/miner/src/gpu_backend.rs'
with open(path, 'r') as f:
    code = f.read()

changes = 0

# 1) Add transfer_queue field to struct
old_struct_field = '        kernel_src: String,'
new_struct_field = '        kernel_src: String,\n        transfer_queue: ocl::Queue,  // separate queue for data transfers (AMD workaround)'
if 'transfer_queue' not in code:
    code = code.replace(old_struct_field, new_struct_field, 1)
    changes += 1
    print("1) Added transfer_queue field to struct")

# 2) Create transfer queue after ProQue build, using the context and device
# Find where we get the queue after compilation
old_queue_get = '''            println!("gpu_opencl_compiled ok"); let _ = std::io::stdout().flush();
            let q = pro_que.queue().clone();
            q.finish()?;
            println!("gpu: queue flushed after compile"); let _ = std::io::stdout().flush();'''
new_queue_get = '''            println!("gpu_opencl_compiled ok"); let _ = std::io::stdout().flush();
            let q = pro_que.queue().clone();
            q.finish()?;
            println!("gpu: queue flushed after compile"); let _ = std::io::stdout().flush();
            // Create separate transfer queue (AMD gfx900 workaround: compile queue deadlocks on writes)
            let transfer_queue = ocl::Queue::new(pro_que.context(), device, None)
                .map_err(|e| anyhow::anyhow!("transfer queue creation failed: {e}"))?;
            println!("gpu: transfer queue created"); let _ = std::io::stdout().flush();'''
if 'transfer queue created' not in code:
    code = code.replace(old_queue_get, new_queue_get, 1)
    changes += 1
    print("2) Added transfer queue creation")

# 3) Store transfer_queue in Self
old_self_return = '                kernel_src: kernel_src,'
new_self_return = '                kernel_src: kernel_src,\n                transfer_queue,'
if 'transfer_queue,' not in code.split('kernel_src: kernel_src,')[1][:100] if code.count('kernel_src: kernel_src,') > 0 else True:
    code = code.replace(old_self_return, new_self_return, 1)
    changes += 1
    print("3) Added transfer_queue to Self construction")

# 4) In mine_batch: use transfer_queue for all buffer operations
# header write
code = code.replace(
    'unsafe { self.header_buf.write(&header_bytes[..]).block(true).enq()? };',
    'self.header_buf.write(&header_bytes[..]).queue(&self.transfer_queue).enq()?;\n            self.transfer_queue.finish()?;'
)
# sentinel write
code = code.replace(
    'unsafe { self.result_nonce_buf.write(&sentinel_slice[..]).block(true).enq()? };',
    'self.result_nonce_buf.write(&sentinel_slice[..]).queue(&self.transfer_queue).enq()?;\n                self.transfer_queue.finish()?;'
)
# nonce read
code = code.replace(
    'unsafe { self.result_nonce_buf.read(&mut nonce_out).block(true).enq()? };',
    'self.result_nonce_buf.read(&mut nonce_out).queue(&self.transfer_queue).enq()?;\n                self.transfer_queue.finish()?;'
)
# hash read
code = code.replace(
    'unsafe { self.result_hash_buf.read(&mut hash_out).block(true).enq()? };',
    'self.result_hash_buf.read(&mut hash_out).queue(&self.transfer_queue).enq()?;\n                    self.transfer_queue.finish()?;'
)
changes += 1
print("4) Replaced mine_batch operations to use transfer_queue")

# 5) Also use transfer queue for NPU data writes (currently skipped but let's re-enable)
# For now keep NPU writes skipped since we need to prove the pipeline first

# 6) Use transfer queue in update_epoch header write too
old_epoch_write = 'self.header_buf.write(&header_bytes[..]).enq()?;'
if old_epoch_write in code:
    code = code.replace(
        old_epoch_write,
        'self.header_buf.write(&header_bytes[..]).queue(&self.transfer_queue).enq()?;\n            self.transfer_queue.finish()?;'
    )
    print("6) Fixed epoch header write to use transfer_queue")

with open(path, 'w') as f:
    f.write(code)

print(f"Applied {changes}+ changes. Patch v3.0.8b complete")
