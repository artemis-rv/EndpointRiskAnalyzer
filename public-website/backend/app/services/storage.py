"""
app/services/storage.py
────────────────────────
Resolution of release artefacts on disk.

This module exists so that exactly one place in the codebase turns a
database-held `file_path` into a real filesystem path, and so that place can be
audited on its own.

THREAT MODEL
`Release.file_path` is written by an administrator through the admin API. Even
though that is a privileged, authenticated, audited action, it is still input,
and it still ends up in a filesystem call. Treating it as trusted would mean a
single mistaken or malicious admin row could read any file the service account
can reach — `/etc/passwd`, the backend `.env`, a private key. So it is validated
here as untrusted input regardless of who wrote it.

Guarantees:
- every resolved path lies inside RELEASE_FILES_BASE_PATH
- traversal sequences, absolute paths and symlinks that escape the root are
  rejected rather than normalised into something that works
- only regular files are served; directories, devices and sockets are refused
- the caller never receives the resolved path, only an opened handle and a
  safe download filename
"""

from __future__ import annotations

import unicodedata
from pathlib import Path
from typing import Optional

from app.core.config import get_settings
from app.core.logging import get_logger

settings = get_settings()
logger = get_logger(__name__)


class ArtefactError(Exception):
    """Base for artefact resolution failures."""


class ArtefactNotFound(ArtefactError):
    """The artefact is absent, unreadable, or not a regular file."""


class ArtefactRejected(ArtefactError):
    """The stored path escapes the storage root. Treated as a security event."""


def storage_root() -> Path:
    """The one directory release artefacts may be served from."""
    return Path(settings.RELEASE_FILES_BASE_PATH).expanduser().resolve()


def _safe_download_name(version: str, resolved: Path) -> str:
    """
    Build the filename the browser will save as.

    Derived from the release version and the artefact's own suffix rather than
    from the stored path, so nothing an admin typed reaches the
    Content-Disposition header. That header is parsed by the browser, and a
    filename containing quotes, newlines or directory separators is a header
    injection and path confusion risk.
    """
    suffix = "".join(
        part for part in resolved.suffixes[-2:] if part.isascii() and len(part) <= 10
    )
    safe_version = "".join(
        char for char in unicodedata.normalize("NFKD", version) if char.isalnum() or char in "._-"
    )
    return f"riskintel-{safe_version or 'release'}{suffix}"


def resolve_artefact(stored_path: str, *, version: str) -> tuple[Path, str]:
    """
    Turn a stored `file_path` into a verified artefact path.

    Returns (resolved_path, download_filename).
    Raises ArtefactRejected if the path escapes the storage root, and
    ArtefactNotFound if there is no readable regular file there.
    """
    root = storage_root()

    raw = (stored_path or "").strip()
    if not raw:
        raise ArtefactNotFound("No artefact path recorded for this release.")

    candidate_path = Path(raw)

    # An absolute stored path is interpreted relative to the root, not honoured
    # as-is. This is what stops "/etc/passwd" in a database row from ever being
    # a filesystem lookup outside the storage area.
    if candidate_path.is_absolute():
        try:
            candidate_path = candidate_path.relative_to(root)
        except ValueError:
            # Absolute but outside the root: strip to the bare name so it can
            # only ever resolve inside the root, or fail there.
            candidate_path = Path(candidate_path.name)

    # Drop any drive/root markers and traversal segments before joining. This is
    # belt and braces: the containment check below is the actual guarantee.
    parts = [
        part
        for part in candidate_path.parts
        if part not in ("..", ".", "/", "\\") and not part.endswith(":")
    ]
    if not parts:
        raise ArtefactNotFound("No artefact path recorded for this release.")

    resolved = (root / Path(*parts)).resolve()

    # THE containment check. Performed after resolve() so symlinks pointing
    # outside the root are caught too.
    if resolved != root and root not in resolved.parents:
        logger.warning(
            "artefact_path_rejected",
            reason="outside_storage_root",
            # The offending value is never logged: it may contain a path an
            # operator would then paste somewhere. Only the release identifies it.
            version=version,
        )
        raise ArtefactRejected("Artefact path is outside the storage root.")

    if not resolved.exists() or not resolved.is_file():
        raise ArtefactNotFound("Artefact is missing from storage.")

    return resolved, _safe_download_name(version, resolved)


def artefact_size(resolved: Path) -> Optional[int]:
    """Size in bytes, or None if it cannot be read."""
    try:
        return resolved.stat().st_size
    except OSError:
        return None
