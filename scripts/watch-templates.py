#!/usr/bin/env python3
from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
TEMPLATES_DIR = PROJECT_ROOT / "templates"
RENDER_SCRIPT = SCRIPT_DIR / "render-index.py"
WATCH_EXTENSIONS = {".html", ".jinja", ".jinja2"}


def snapshot_files() -> dict[Path, float]:
    state: dict[Path, float] = {}
    for path in TEMPLATES_DIR.rglob("*"):
        if path.is_file() and path.suffix.lower() in WATCH_EXTENSIONS:
            state[path] = path.stat().st_mtime_ns
    return state


def run_render() -> None:
    process = subprocess.run([sys.executable, str(RENDER_SCRIPT)])
    if process.returncode != 0:
        print("Render script failed; waiting for next change.")


def main() -> None:
    last_state = snapshot_files()
    run_render()
    print("Watching templates/ for HTML or Jinja2 changes...")

    while True:
        try:
            time.sleep(0.5)
        except KeyboardInterrupt:
            print("\nStopping template watcher.")
            return

        current_state = snapshot_files()
        if current_state != last_state:
            print("Change detected; rerendering template.")
            run_render()
            last_state = current_state


if __name__ == "__main__":
    main()
