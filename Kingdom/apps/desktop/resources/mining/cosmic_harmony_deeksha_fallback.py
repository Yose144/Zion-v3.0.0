#!/usr/bin/env python3
"""
Lightweight Python fallback entrypoint for desktop-agent tests and fallback chain.
It intentionally keeps behavior minimal: startup banner + stratum reconnect loop logs.
"""

import argparse
import signal
import sys
import time

RUNNING = True


def _handle_signal(_signum, _frame):
    global RUNNING
    RUNNING = False


def build_parser():
    parser = argparse.ArgumentParser(description="ZION Deeksha fallback miner")
    parser.add_argument("--pool", default="127.0.0.1:8444")
    parser.add_argument("--worker", default="desktop-agent")
    parser.add_argument("--threads", default="1")
    parser.add_argument("--backend", default="python")
    parser.add_argument("--wallet", default="")
    return parser


def main():
    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    args = build_parser().parse_args()

    print("[CHvDeeksha Miner] Starting Python fallback", flush=True)
    print("[Deeksha] Pipeline: Keccak -> Scratchpad -> Fusion", flush=True)
    print(
        "[Stratum] connecting to {} as worker={} threads={} backend={}".format(
            args.pool,
            args.worker,
            args.threads,
            args.backend,
        ),
        flush=True,
    )

    retry = 0
    while RUNNING:
        retry += 1
        print(
            "[Stratum] retry #{:02d} waiting for pool {}".format(retry, args.pool),
            flush=True,
        )
        time.sleep(1.0)

    print("[CHvDeeksha Miner] Stopped", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
