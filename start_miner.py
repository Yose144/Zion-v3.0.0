import subprocess
import os
import time

env = os.environ.copy()
env["ZION_POOL_ADDR"] = "77.42.71.94:8444"
env["ZION_LOOP_COUNT"] = "1000000"
env["ZION_MINER_THREADS"] = "1"
env["ZION_WORKER_NAME"] = "worker1"
env["ZION_MINER_ID"] = "w11-amd-gpu-miner-01"
env["ZION_PAYOUT_ADDRESS"] = "zion1w523a76830x2t5m7f3j023w265e8g5c400a4790"
env["ZION_GPU_BACKEND"] = "opencl"
env["ZION_GPU_WORK_SIZE"] = "8192"
env["ZION_OCL_WORK_CAP"] = "8192"
env["ZION_OCL_VRAM_PCT"] = "50"

log = open(r"C:\Users\yosef\Desktop\Zion\2.9.6-main\logs\miner-py.log", "w")

proc = subprocess.Popen(
    [r"C:\Users\yosef\Desktop\Zion\2.9.6-main\V3\target\release\zion-miner.exe"],
    cwd=r"C:\Users\yosef\Desktop\Zion\2.9.6-main",
    env=env,
    stdout=log,
    stderr=subprocess.STDOUT,
    creationflags=subprocess.CREATE_NO_WINDOW
)

print(f"Started miner PID {proc.pid}")
time.sleep(3)
print(f"Miner poll: {proc.poll()}")
