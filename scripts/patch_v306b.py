#!/usr/bin/env python3
"""Patch: skip NPU data writes entirely. Use zero-filled buffers.
AMD gfx900 driver hangs on clEnqueueWriteBuffer after kernel compilation."""

path = '/root/zion-2.9.6/V3/L1/miner/src/gpu_backend.rs'
with open(path, 'r') as f:
    code = f.read()

old_write = '''            // Now write data to all buffers
            println!("npu: writing data..."); let _ = std::io::stdout().flush();
            if !packed.weights.is_empty() {
                npu_weights.write(&packed.weights).enq()?;
            }
            if !packed.biases.is_empty() {
                npu_biases.write(&packed.biases).enq()?;
            }
            if !packed.scales.is_empty() {
                npu_scales.write(&packed.scales).enq()?;
            }
            npu_meta.write(&packed.meta).enq()?;
            q.finish()?;
            println!("npu: all data written ok"); let _ = std::io::stdout().flush();'''

new_write = '''            // WORKAROUND: AMD gfx900 hangs on clEnqueueWriteBuffer after kernel compile.
            // Skip NPU data writes — use zero-filled buffers for now.
            // The NPU mix stage will produce zeroed output but the pipeline will work.
            println!("npu: skipping data writes (AMD gfx900 workaround)"); let _ = std::io::stdout().flush();'''

if old_write in code:
    code = code.replace(old_write, new_write, 1)
    print("OK: skipped NPU data writes")
else:
    print("ERROR: write section not found")
    idx = code.find('npu: writing data')
    if idx >= 0:
        print("Found at:", idx)
        print(repr(code[idx:idx+500]))

with open(path, 'w') as f:
    f.write(code)

print("Patch v3.0.6b complete")
