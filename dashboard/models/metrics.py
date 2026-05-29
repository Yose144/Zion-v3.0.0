"""Metrics history — SQLite-backed time-series cache for dashboard charts."""
import sqlite3
import sys
import threading
import time
from collections import deque

from .config import REPO_ROOT, METRICS_MAX_POINTS


class MetricsHistory:
    """Keeps last N samples for charting. Persisted to SQLite so history survives restarts."""
    MAX_POINTS = METRICS_MAX_POINTS  # ~10 min at 5s interval
    _DB_PATH = REPO_ROOT / "V3" / "data" / "dashboard-metrics.db"

    def __init__(self):
        self.lock = threading.Lock()
        self.samples = deque(maxlen=self.MAX_POINTS)
        self._ensure_table()
        self._load_from_db()

    def _ensure_table(self):
        try:
            self._DB_PATH.parent.mkdir(parents=True, exist_ok=True)
            con = sqlite3.connect(str(self._DB_PATH))
            cur = con.cursor()
            cur.execute("""
                CREATE TABLE IF NOT EXISTS metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ts INTEGER NOT NULL,
                    n1_height INTEGER,
                    n2_height INTEGER,
                    n1_peers INTEGER,
                    hashrate REAL,
                    shares_ok INTEGER,
                    shares_bad INTEGER,
                    blocks INTEGER,
                    sessions INTEGER
                )
            """)
            con.commit()
            con.close()
        except Exception as e:
            print(f"[metrics] DB init error: {e}", file=sys.stderr)

    def _load_from_db(self):
        try:
            con = sqlite3.connect(str(self._DB_PATH))
            cur = con.cursor()
            cur.execute(
                "SELECT ts, n1_height, n2_height, n1_peers, hashrate, shares_ok, shares_bad, blocks, sessions "
                "FROM metrics ORDER BY id DESC LIMIT ?",
                (self.MAX_POINTS,),
            )
            rows = cur.fetchall()
            con.close()
            # Reverse to chronological order
            for row in reversed(rows):
                self.samples.append({
                    "t": row[0], "n1_height": row[1], "n2_height": row[2],
                    "n1_peers": row[3], "hashrate": row[4], "shares_ok": row[5],
                    "shares_bad": row[6], "blocks": row[7], "sessions": row[8],
                })
        except Exception as e:
            print(f"[metrics] DB load error: {e}", file=sys.stderr)

    def record(self, status: dict):
        sample = {
            "t": int(time.time()),
            "n1_height": status["node1"]["chain_height"],
            "n2_height": status["node2"]["chain_height"],
            "n1_peers": status["node1"]["known_peers"],
            "hashrate": status["miner"]["hashrate"],
            "shares_ok": status["pool"]["shares_accepted"],
            "shares_bad": status["pool"]["shares_rejected"],
            "blocks": status["pool"]["blocks_found"],
            "sessions": status["pool"]["active_sessions"],
        }
        with self.lock:
            self.samples.append(sample)
        self._persist(sample)

    def _persist(self, sample: dict):
        try:
            con = sqlite3.connect(str(self._DB_PATH))
            cur = con.cursor()
            cur.execute(
                "INSERT INTO metrics (ts, n1_height, n2_height, n1_peers, hashrate, shares_ok, shares_bad, blocks, sessions) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (sample["t"], sample["n1_height"], sample["n2_height"], sample["n1_peers"],
                 sample["hashrate"], sample["shares_ok"], sample["shares_bad"], sample["blocks"], sample["sessions"]),
            )
            # Keep only last MAX_POINTS * 2 rows to prevent unbounded growth
            cur.execute("DELETE FROM metrics WHERE id <= (SELECT MAX(id) FROM metrics) - ?", (self.MAX_POINTS * 2,))
            con.commit()
            con.close()
        except Exception as e:
            print(f"[metrics] DB persist error: {e}", file=sys.stderr)

    def snapshot(self) -> list:
        with self.lock:
            return list(self.samples)


# Global singleton — instantiated after optional config override in app.py
HISTORY = None  # type: MetricsHistory | None
