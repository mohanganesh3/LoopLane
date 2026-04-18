import os
import subprocess
import sys


def main() -> int:
    env = os.environ.copy()
    result = subprocess.run(
        ["node", "scripts/verify_system.js"],
        cwd="/Users/mohanganesh/wbd/LoopLane",
        env=env,
        check=False,
    )
    return result.returncode


if __name__ == "__main__":
    sys.exit(main())
