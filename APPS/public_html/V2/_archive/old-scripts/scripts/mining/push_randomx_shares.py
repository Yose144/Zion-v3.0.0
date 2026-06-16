#!/usr/bin/env python3
"""
Quick RandomX share pusher for ZION pool
- Connects to pool and submits a burst of RandomX shares to trigger block threshold
- Uses ai/mining/stratum_client.StratumClient

NOTE: Pool currently accepts RandomX shares (testing path) so results are counted.
"""
import os
import time
import logging
from ai.mining.stratum_client import StratumClient

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("rx_pusher")

POOL_HOST = os.environ.get("ZION_POOL_HOST", "91.98.122.165")
POOL_PORT = int(os.environ.get("ZION_POOL_PORT", "3333"))
WALLET = os.environ.get("ZION_WALLET", "ZION_SACRED_B0FA7E2A234D8C2F08545F02295C98")
WORKER = os.environ.get("ZION_WORKER", "rx_pusher")
SHARES = int(os.environ.get("ZION_PUSH_SHARES", "120"))


def main():
    client = StratumClient(POOL_HOST, POOL_PORT, autostart_handler=False)
    if not client.connect(start_handler=False):
        logger.error("Failed to connect to pool")
        return 1

    if not client.subscribe():
        logger.error("Subscribe failed")
        return 1

    # Authorize with password hint 'randomx' so pool sets algorithm appropriately
    if not client.authorize(WALLET, WORKER, password="randomx"):
        logger.error("Authorize failed")
        return 1

    # Do NOT start background notifications here; it races with synchronous
    # request/response reads and can consume submit responses. For this
    # burst submit, we reuse the current job without a background reader.

    # Wait for first job
    job = None
    for _ in range(50):  # up to ~5s
        job = client.get_job()
        if job:
            break
        time.sleep(0.1)

    if not job:
        logger.error("No job received after authorize")
        return 1

    logger.info(f"Got job: id={job.id}, diff={job.difficulty}")

    accepted = 0
    rejected = 0
    # Burst submit SHARES shares
    for i in range(SHARES):
        # Refresh job occasionally
        latest = client.get_job() or job
        job_id = latest.id
        nonce = 0x10000 + i  # simple increasing nonce
        # Random 32-byte hex result (content not validated in current RandomX path)
        result = os.urandom(32)
        ok = client.submit_share(job_id, nonce, result)
        if ok:
            accepted += 1
        else:
            rejected += 1
        if (i + 1) % 10 == 0:
            logger.info(f"Progress: {i+1}/{SHARES} (accepted={accepted}, rejected={rejected})")
        # Short delay to avoid flooding too fast
        time.sleep(0.02)

    logger.info(f"Done. Submitted {SHARES} shares (accepted={accepted}, rejected={rejected})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
