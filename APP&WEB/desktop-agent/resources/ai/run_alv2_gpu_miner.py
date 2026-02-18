#!/usr/bin/env python3
import time
from cosmic_harmony_gpu_miner import ZionGPUMiner  # type: ignore

if __name__ == "__main__":
    miner = ZionGPUMiner()
    if miner.start_mining():
        try:
            for i in range(180):
                time.sleep(1)
                s = miner.get_stats()
                print(f"⛏️  {s['hashrate']} | Shares: {s['shares']} | Hashes: {s['total_hashes']}")
        except KeyboardInterrupt:
            pass
        finally:
            miner.stop_mining()
    else:
        print("Init failed")
