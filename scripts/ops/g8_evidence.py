#!/usr/bin/env python3
"""G8 30-day continuous-run evidence tracker.

Maintains /opt/zion/data/g8_run.json (schema_version 2) and evaluates the run
window against Prometheus range queries over the zion_g8_* metrics exported by
g8_probe_exporter.py.

Commands:
  start    begin a new run (refuses while a v2 run is running; archives any
           previous state file beside it — evidence is never deleted)
  update   query Prometheus, recompute uptime/coverage/incidents, evaluate the
           gate once the window has elapsed
  status   print the current state JSON
  stop     mark the run stopped (all fields/evidence preserved)

Environment:
  G8_STATE_FILE       (default /opt/zion/data/g8_run.json)
  G8_PROMETHEUS_URL   (default http://127.0.0.1:9090)

Python stdlib only.
"""

import argparse
import contextlib
import fcntl
import json
import math
import os
import shutil
import sys
import tempfile
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

DEFAULT_STATE_FILE = "/opt/zion/data/g8_run.json"
DEFAULT_PROMETHEUS_URL = "http://127.0.0.1:9090"

STEP_SECONDS = 60
DEFAULT_POLICY = {
    "step_seconds": 60,
    "required_services": ["chain_live", "pool_http", "pool_stratum", "multichain", "dao", "zis"],
    "chain_tip_max_age_seconds": 900,
    "uptime_threshold_percent": 99.9,
    "critical_outage_seconds": 900,
    "missing_samples": "downtime",
}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, timezone.utc).isoformat()


def state_file_path() -> str:
    return os.environ.get("G8_STATE_FILE", DEFAULT_STATE_FILE)


def prometheus_url() -> str:
    return os.environ.get("G8_PROMETHEUS_URL", DEFAULT_PROMETHEUS_URL)


EXPORTER_FRESHNESS = '(time() - timestamp(up{job="zion_g8"})) <= bool 30'


def signal_expr(name: str) -> str:
    """Prometheus range expression for one required signal.

    A signal counts as up at a bucket only when the underlying sample is fresh
    (<=30s old — Prometheus instant-vector lookback must not resurrect stale
    samples), the scrape succeeded (up == bool 1), and the exporter itself was
    freshly scraped. The `or on() vector(0)` fallback yields a full-length
    zero series when a signal never existed.
    """
    if name == "chain_live":
        return (
            '(zion_g8_chain_live '
            '* scalar(up{job="zion_g8"} == bool 1) '
            '* scalar((time() - timestamp(zion_g8_chain_live)) <= bool 30) '
            f'* scalar({EXPORTER_FRESHNESS})) or on() vector(0)'
        )
    return (
        f'(zion_g8_probe_success{{service="{name}"}} '
        '* scalar(up{job="zion_g8"} == bool 1) '
        f'* scalar((time() - timestamp(zion_g8_probe_success{{service="{name}"}})) <= bool 30) '
        f'* scalar({EXPORTER_FRESHNESS})) or on() vector(0)'
    )


COVERAGE_EXPR = EXPORTER_FRESHNESS


def new_state(started: datetime = None, duration_days: float = 30.0,
              started_by: str = None) -> dict:
    """Build a fresh schema_version 2 run state."""
    if not isinstance(duration_days, (int, float)) or not math.isfinite(duration_days) \
            or duration_days < 30:
        raise ValueError("duration_days must be finite and >= 30")
    if started is None:
        started = utcnow()
    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)
    started = started.astimezone(timezone.utc)
    target_end = started + timedelta(days=duration_days)
    return {
        "schema_version": 2,
        "run_id": "g8-" + started.strftime("%Y%m%dT%H%M%SZ"),
        "started": started.isoformat(),
        "target_end": target_end.isoformat(),
        "status": "running",
        "window_status": "running",
        "gate_status": "pending",
        "gate_reason": None,
        "uptime_percent": 0.0,
        "evidence_coverage_percent": 0.0,
        "service_uptime_percent": {},
        "incidents": [],
        "critical_incidents": [],
        "evidence_policy": dict(DEFAULT_POLICY),
        "started_by": started_by or os.environ.get("USER", "operator"),
    }


@contextlib.contextmanager
def state_lock(state_file: str):
    """Advisory flock on <state_file>.lock serialising read-modify-write."""
    directory = os.path.dirname(state_file) or "."
    os.makedirs(directory, exist_ok=True)
    fd = os.open(state_file + ".lock", os.O_CREAT | os.O_RDWR, 0o644)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        yield
    finally:
        try:
            fcntl.flock(fd, fcntl.LOCK_UN)
        finally:
            os.close(fd)


def read_state(path: str):
    """Read a state file; returns None when absent or unparseable."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            state = json.load(f)
        return state if isinstance(state, dict) else None
    except (OSError, ValueError):
        return None


def atomic_write(path: str, state: dict) -> None:
    """Write JSON state via temp file + fsync + os.replace."""
    directory = os.path.dirname(path) or "."
    os.makedirs(directory, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".g8_run.", suffix=".tmp", dir=directory)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2)
            f.write("\n")
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise
    try:
        dir_fd = os.open(directory, os.O_RDONLY)
        try:
            os.fsync(dir_fd)
        finally:
            os.close(dir_fd)
    except OSError:
        pass


def archive_existing(path: str) -> str:
    """Archive an existing state file beside it; returns the archive path.

    The archive is named g8_run.<old-run-id-or-timestamp>.json and is never
    overwritten — a numeric suffix is appended on collision.
    """
    old = read_state(path)
    tag = None
    if isinstance(old, dict):
        tag = old.get("run_id")
    if not tag:
        tag = utcnow().strftime("%Y%m%dT%H%M%SZ")
    base = os.path.splitext(path)[0]
    dest = f"{base}.{tag}.json"
    n = 1
    while os.path.exists(dest):
        dest = f"{base}.{tag}-{n}.json"
        n += 1
    tmp = dest + f".tmp-{os.getpid()}"
    shutil.copyfile(path, tmp)
    os.replace(tmp, dest)
    return dest


def query_range(prom_url: str, expr: str, start: float, end: float, step: int) -> list:
    """Run a Prometheus /api/v1/query_range query; returns the matrix list."""
    qs = urllib.parse.urlencode({
        "query": expr,
        "start": start,
        "end": end,
        "step": step,
    })
    with urllib.request.urlopen(f"{prom_url}/api/v1/query_range?{qs}", timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    if data.get("status") != "success":
        raise ValueError(f"Prometheus query failed: {data.get('error', data.get('status'))}")
    return data.get("data", {}).get("result", [])


def merge_matrix(result: list) -> dict:
    """Merge a Prometheus matrix list into {bucket_ts: max_value}.

    Non-finite values (NaN/Inf — e.g. a NaN scalar(up) product) normalise to 0
    so they can never count as uptime nor fragment incident detection.
    """
    series = {}
    for matrix in result or []:
        for point in matrix.get("values", []):
            try:
                ts = int(float(point[0]))
                value = float(point[1])
            except (TypeError, ValueError, IndexError):
                continue
            if not math.isfinite(value):
                value = 0.0
            series[ts] = max(value, series.get(ts, value))
    return series


def expected_buckets(start: float, end: float, step: int) -> list:
    """All step-aligned bucket timestamps in [start, end]."""
    start_i, end_i = int(start), int(end)
    if end_i < start_i:
        return []
    return list(range(start_i, end_i + 1, step))


def derive_incidents(buckets: list, overall: list, step: int,
                     signal_series: dict, names: list, critical_seconds: int):
    """Derive contiguous overall-zero intervals into incident records."""
    incidents = []
    i = 0
    n = len(buckets)
    while i < n:
        if overall[i] > 0:
            i += 1
            continue
        j = i
        while j + 1 < n and overall[j + 1] <= 0:
            j += 1
        ongoing = j == n - 1
        duration = (buckets[j] - buckets[i]) + step
        down = [
            name for name in names
            if any(signal_series[name].get(b, 0.0) <= 0 for b in buckets[i:j + 1])
        ]
        incidents.append({
            "started": iso(buckets[i]),
            "ended": None if ongoing else iso(buckets[j] + step),
            "duration_seconds": duration,
            "services": down,
        })
        i = j + 1
    critical = [inc for inc in incidents if inc["duration_seconds"] >= critical_seconds]
    return incidents, critical


def evaluate(state: dict, signal_series: dict, up_series: dict,
             start: float, end: float, step: int, now: datetime) -> dict:
    """Compute uptime/coverage/incidents/statuses from merged series.

    `signal_series` maps each required signal name to {bucket_ts: value};
    `up_series` is {bucket_ts: value} for the coverage query. Pure function —
    returns the fields to merge into the state dict.
    """
    policy = state.get("evidence_policy") or DEFAULT_POLICY
    names = list(policy.get("required_services") or DEFAULT_POLICY["required_services"])
    threshold = float(policy.get("uptime_threshold_percent", 99.9))
    critical_seconds = int(policy.get("critical_outage_seconds", 900))

    buckets = expected_buckets(start, end, step)
    expected = len(buckets)

    per_signal = {
        name: {b: signal_series.get(name, {}).get(b, 0.0) for b in buckets}
        for name in names
    }
    overall = [min(per_signal[name][b] for name in names) for b in buckets] if names else []

    good = sum(1 for v in overall if v > 0)
    covered = sum(1 for b in buckets if up_series.get(b, 0.0) > 0)
    uptime = round(100.0 * good / expected, 6) if expected else 0.0
    coverage = round(100.0 * covered / expected, 6) if expected else 0.0
    service_uptime = {
        name: (round(100.0 * sum(1 for b in buckets if per_signal[name][b] > 0) / expected, 6)
               if expected else 0.0)
        for name in names
    }

    incidents, critical = derive_incidents(buckets, overall, step, per_signal, names, critical_seconds)

    try:
        target_dt = datetime.fromisoformat(state["target_end"])
        if target_dt.tzinfo is None:
            target_dt = target_dt.replace(tzinfo=timezone.utc)
        target = target_dt.timestamp()
    except (KeyError, TypeError, ValueError):
        target = end

    # Downtime budget over the whole window: how many bad buckets can still
    # occur before the uptime threshold becomes unreachable.
    total_window_samples = max((target - start) / step, 0) if step else 0.0
    budget = math.floor(total_window_samples * (100.0 - threshold) / 100.0)
    bad = expected - good

    if now.timestamp() < target:
        status = "running"
        window_status = "running"
        # Fail the gate early once the outcome is already decided: a critical
        # incident is disqualifying on its own, and exceeding the downtime
        # budget makes the uptime threshold mathematically unreachable.
        if critical:
            gate = "failed"
            gate_reason = "critical_incident"
        elif bad > budget:
            gate = "failed"
            gate_reason = "downtime_budget_exhausted"
        else:
            gate = "pending"
            gate_reason = None
    else:
        status = "window_elapsed"
        window_status = "window_elapsed"
        if coverage < threshold:
            gate = "evidence_incomplete"
            gate_reason = "coverage_below_threshold"
        elif uptime >= threshold and not critical:
            gate = "passed"
            gate_reason = None
        else:
            gate = "failed"
            if critical:
                gate_reason = "critical_incident"
            elif bad > budget:
                gate_reason = "downtime_budget_exhausted"
            else:
                gate_reason = "uptime_below_threshold"

    return {
        "status": status,
        "window_status": window_status,
        "gate_status": gate,
        "gate_reason": gate_reason,
        "uptime_percent": uptime,
        "evidence_coverage_percent": coverage,
        "service_uptime_percent": service_uptime,
        "incidents": incidents,
        "critical_incidents": critical,
        "sample_counts": {"expected": expected, "covered": covered, "good": good},
        "last_evidence_update": now.isoformat(),
    }


def cmd_start(state_file: str, started: datetime = None, duration_days: float = 30.0,
              started_by: str = None) -> int:
    try:
        state = new_state(started=started, duration_days=duration_days,
                          started_by=started_by)
    except ValueError as e:
        print(f"g8_evidence: {e}", file=sys.stderr)
        return 2
    with state_lock(state_file):
        existing = read_state(state_file)
        if (isinstance(existing, dict) and existing.get("schema_version") == 2
                and existing.get("status") == "running"):
            print("g8_evidence: a v2 run is already running — refusing to overwrite",
                  file=sys.stderr)
            return 1
        if os.path.exists(state_file):
            archive = archive_existing(state_file)
            print(f"g8_evidence: archived previous state to {archive}")
        atomic_write(state_file, state)
    print(json.dumps(state, indent=2))
    return 0


def cmd_update(state_file: str, prom_url: str, now: datetime = None,
               query_fn=query_range) -> int:
    now = now or utcnow()
    with state_lock(state_file):
        state = read_state(state_file)
        if state is None:
            return 0
        if state.get("schema_version") != 2 or state.get("status") != "running":
            return 0

        started = datetime.fromisoformat(state["started"]).astimezone(timezone.utc)
        target = datetime.fromisoformat(state["target_end"]).astimezone(timezone.utc)
        end = min(now, target)
        step = int((state.get("evidence_policy") or {}).get("step_seconds", STEP_SECONDS))
        names = list((state.get("evidence_policy") or {}).get("required_services")
                     or DEFAULT_POLICY["required_services"])

        try:
            signal_series = {}
            for name in names:
                signal_series[name] = merge_matrix(
                    query_fn(prom_url, signal_expr(name), started.timestamp(), end.timestamp(), step)
                )
            up_series = merge_matrix(
                query_fn(prom_url, COVERAGE_EXPR, started.timestamp(), end.timestamp(), step)
            )
        except Exception as e:
            print(f"g8_evidence: Prometheus query failed — state unchanged: {e}", file=sys.stderr)
            return 1

        updates = evaluate(state, signal_series, up_series,
                           started.timestamp(), end.timestamp(), step, now)
        state.update(updates)
        atomic_write(state_file, state)
    print(json.dumps({k: state[k] for k in (
        "status", "window_status", "gate_status", "gate_reason", "uptime_percent",
        "evidence_coverage_percent", "sample_counts")}, indent=2))
    return 0


def cmd_status(state_file: str) -> int:
    state = read_state(state_file)
    if state is None:
        print(f"g8_evidence: no readable state at {state_file}", file=sys.stderr)
        return 1
    print(json.dumps(state, indent=2))
    return 0


def _downtime_budget(state: dict) -> float:
    """Max bad buckets allowed by the uptime threshold over the full window.

    Returns None when the state's timestamps/step are missing or unparseable.
    """
    policy = state.get("evidence_policy") or DEFAULT_POLICY
    threshold = float(policy.get("uptime_threshold_percent", 99.9))
    step = int(policy.get("step_seconds", STEP_SECONDS)) or STEP_SECONDS
    try:
        started = datetime.fromisoformat(state["started"]).timestamp()
        target = datetime.fromisoformat(state["target_end"]).timestamp()
    except (KeyError, TypeError, ValueError):
        return None
    total_window_samples = max((target - started) / step, 0)
    return math.floor(total_window_samples * (100.0 - threshold) / 100.0)


def cmd_stop(state_file: str, now: datetime = None) -> int:
    now = now or utcnow()
    with state_lock(state_file):
        state = read_state(state_file)
        if state is None or not state.get("started"):
            print(f"g8_evidence: no run to stop at {state_file}", file=sys.stderr)
            return 1
        # Reflect gate truth: if the collected evidence already decides the
        # outcome, record the failure reason; a terminal gate verdict is
        # preserved; anything else stopped early is evidence_incomplete.
        counts = state.get("sample_counts") or {}
        bad = counts.get("expected", 0) - counts.get("good", 0)
        budget = _downtime_budget(state)
        if state.get("critical_incidents"):
            state["gate_status"] = "failed"
            state["gate_reason"] = "critical_incident"
        elif budget is not None and bad > budget:
            state["gate_status"] = "failed"
            state["gate_reason"] = "downtime_budget_exhausted"
        elif state.get("gate_status") in ("passed", "failed", "evidence_incomplete"):
            pass  # terminal verdict already recorded — keep it
        else:
            state["gate_status"] = "evidence_incomplete"
            state["gate_reason"] = "stopped_before_window_end"
        state["status"] = "stopped"
        state["window_status"] = "stopped"
        state["stopped_at"] = now.isoformat()
        atomic_write(state_file, state)
    print(json.dumps(state, indent=2))
    return 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="G8 run evidence tracker")
    parser.add_argument("command", choices=["start", "update", "status", "stop"])
    parser.add_argument("--started", help="ISO timestamp for run start (default: now UTC)")
    parser.add_argument("--duration-days", type=float, default=30.0)
    parser.add_argument("--started-by", default=None)
    parser.add_argument("--state-file", default=None)
    parser.add_argument("--prometheus-url", default=None)
    args = parser.parse_args(argv)

    state_file = args.state_file or state_file_path()
    prom_url = args.prometheus_url or prometheus_url()

    if args.command == "start":
        try:
            started = datetime.fromisoformat(args.started) if args.started else None
        except ValueError as e:
            print(f"g8_evidence: invalid --started: {e}", file=sys.stderr)
            return 2
        return cmd_start(state_file, started=started, duration_days=args.duration_days,
                         started_by=args.started_by)
    if args.command == "update":
        return cmd_update(state_file, prom_url)
    if args.command == "status":
        return cmd_status(state_file)
    if args.command == "stop":
        return cmd_stop(state_file)
    return 2


if __name__ == "__main__":
    sys.exit(main())
