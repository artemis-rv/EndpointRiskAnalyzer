"""
scripts/set_storage_path.py
────────────────────────────
Point RELEASE_FILES_BASE_PATH at the local storage directory.

Development convenience only. The default in `.env.example` is a container path
(`/data/releases`) which does not exist on a developer machine, and the download
endpoint refuses to serve anything from a root it cannot resolve.
"""

from __future__ import annotations

import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
STORAGE = (BACKEND_DIR / "storage" / "releases").resolve()
STORAGE.mkdir(parents=True, exist_ok=True)

env_path = BACKEND_DIR / ".env"
posix_root = STORAGE.as_posix()

lines = env_path.read_text(encoding="utf-8").splitlines()
updated, found = [], False
for line in lines:
    if line.startswith("RELEASE_FILES_BASE_PATH="):
        updated.append(f"RELEASE_FILES_BASE_PATH={posix_root}")
        found = True
    else:
        updated.append(line)
if not found:
    updated.append(f"RELEASE_FILES_BASE_PATH={posix_root}")

env_path.write_text("\n".join(updated) + "\n", encoding="utf-8")
print(f"RELEASE_FILES_BASE_PATH={posix_root}")
print(f"storage directory ready: {STORAGE.exists()}")
