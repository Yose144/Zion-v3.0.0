import os
import subprocess
import time
import sys

def run_test():
    script = "resources/mining/cosmic_harmony_deeksha_fallback.py"
    
    print("=== Deeksha Python Miner - Revenue Stream Test ===")
    
    # Nastavíme nonce base stejně jako main.js revenue partition
    os.environ["ZION_NONCE_BASE"] = "1073741824" # 0x40000000
    
    proc = subprocess.Popen(
        [sys.executable, script, "--pool", "8.8.8.8:3333", "--worker", "test-revenue-1", "--threads", "1", "--backend", "python"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )
    
    print(f"Spuštěno (PID {proc.pid}) se ZION_NONCE_BASE={os.environ['ZION_NONCE_BASE']}")
    
    lines_read = 0
    success = False
    start = time.time()
    
    while time.time() - start < 15:
        line = proc.stdout.readline()
        if not line and proc.poll() is not None:
            break
            
        if line:
            print(" |", line.strip())
            lines_read += 1
            if "[Stratum]" in line and "retry" in line.lower():
                success = True
                
            if "Pipeline: Keccak" in line:
                success = True
                
    proc.terminate()
    proc.wait(timeout=2)
    
    if success:
        print("\n✅ ZRYCHLENÝ TEST OK — Miner spustil pipeline a zahájil Stratum reconnect smyčku.")
    else:
        print("\n❌ TEST SELHAL.")

if __name__ == "__main__":
    run_test()
