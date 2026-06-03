"""Global runtime state shared across the dashboard server."""
import time
from collections import deque

BLOCK_EVENTS: deque = deque(maxlen=50)
LAST_BLOCK_EVENT_TIME = {"node1": 0, "node2": 0, "pool": 0}
_STARTUP_TS = time.time()  # Dashboard process uptime for /health
