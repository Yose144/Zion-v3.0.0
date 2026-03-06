"""
ZION Cosmic Harmony Deeksha GPU entrypoint (v2.9.8)

Canonical script name for desktop/runtime integration.
Implementation is delegated to the existing GPU wrapper module to keep
backward compatibility while moving runtime naming to Deeksha.
"""

from cosmic_harmony_v42_gpu import *  # noqa: F401,F403
from cosmic_harmony_v42_gpu import main as _legacy_main


def main() -> None:
    _legacy_main()


if __name__ == "__main__":
    main()
