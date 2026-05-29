"""Log search across the logs directory."""
from models.config import LOG_DIR


def search_logs(query: str, max_results: int = 50) -> list:
    """Search across all log files for lines matching query (case-insensitive)."""
    results = []
    if not LOG_DIR.exists():
        return results
    query_lower = query.lower()
    log_files = [f for f in LOG_DIR.glob("*.log") if f.is_file()]
    for lf in sorted(log_files, key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            with open(lf, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()
            for i, line in enumerate(lines):
                if query_lower in line.lower():
                    results.append({
                        "file": lf.name,
                        "line": i + 1,
                        "text": line.rstrip("\n")[:300],
                    })
                    if len(results) >= max_results:
                        return results
        except Exception:
            pass
    return results
