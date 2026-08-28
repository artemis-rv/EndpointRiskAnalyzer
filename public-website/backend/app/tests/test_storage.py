"""
app/tests/test_storage.py
──────────────────────────
Path-safety tests for release artefact resolution.

These are the tests that matter most in this change. `Release.file_path` is
written by an admin and then handed to the filesystem; if resolution can be
steered outside the storage root, an admin account — or anything that can write
that column — becomes arbitrary file read on the server.

Every case here asserts refusal, not sanitisation-into-success.
"""

from __future__ import annotations

import pytest

from app.services import storage
from app.services.storage import (
    ArtefactNotFound,
    ArtefactRejected,
    resolve_artefact,
)


@pytest.fixture()
def storage_root(tmp_path, monkeypatch):
    """Point the storage root at an isolated temporary directory."""
    root = tmp_path / "releases"
    root.mkdir()
    (root / "riskintel-1.0.0.tar.gz").write_bytes(b"artefact")

    # A file that exists OUTSIDE the root, representing anything an escape
    # would reach: a key, an .env, /etc/passwd.
    secret = tmp_path / "secret.env"
    secret.write_text("JWT_SECRET_KEY=should-never-be-served")

    monkeypatch.setattr(storage.settings, "RELEASE_FILES_BASE_PATH", str(root))
    return root, secret


class TestPathTraversal:
    """Nothing outside the storage root may ever be resolved."""

    @pytest.mark.parametrize(
        "hostile",
        [
            "../secret.env",
            "../../secret.env",
            "../../../../../../etc/passwd",
            "..\\secret.env",
            "..\\..\\secret.env",
            "subdir/../../secret.env",
            "./../../secret.env",
        ],
    )
    def test_traversal_never_escapes_the_root(self, storage_root, hostile):
        _root, secret = storage_root
        with pytest.raises((ArtefactNotFound, ArtefactRejected)):
            resolve_artefact(hostile, version="1.0.0")
        # The file it was aiming at is still there and still unread.
        assert secret.exists()

    @pytest.mark.parametrize(
        "hostile",
        [
            "/etc/passwd",
            "C:\\Windows\\System32\\drivers\\etc\\hosts",
            "/root/.ssh/id_rsa",
        ],
    )
    def test_absolute_paths_are_not_honoured(self, storage_root, hostile):
        with pytest.raises((ArtefactNotFound, ArtefactRejected)):
            resolve_artefact(hostile, version="1.0.0")

    def test_symlink_out_of_root_is_rejected(self, storage_root):
        root, secret = storage_root
        link = root / "escape.tar.gz"
        try:
            link.symlink_to(secret)
        except (OSError, NotImplementedError):
            pytest.skip("Symlink creation not permitted in this environment.")

        with pytest.raises((ArtefactRejected, ArtefactNotFound)):
            resolve_artefact("escape.tar.gz", version="1.0.0")


class TestResolution:
    def test_resolves_a_real_artefact(self, storage_root):
        root, _ = storage_root
        resolved, filename = resolve_artefact("riskintel-1.0.0.tar.gz", version="1.0.0")

        assert resolved == (root / "riskintel-1.0.0.tar.gz").resolve()
        assert resolved.read_bytes() == b"artefact"
        assert filename.startswith("riskintel-1.0.0")

    def test_missing_file_raises_not_found(self, storage_root):
        with pytest.raises(ArtefactNotFound):
            resolve_artefact("no-such-build.tar.gz", version="9.9.9")

    def test_empty_path_raises_not_found(self, storage_root):
        for empty in ("", "   ", None):
            with pytest.raises(ArtefactNotFound):
                resolve_artefact(empty, version="1.0.0")

    def test_directory_is_not_servable(self, storage_root):
        root, _ = storage_root
        (root / "adir").mkdir()
        with pytest.raises(ArtefactNotFound):
            resolve_artefact("adir", version="1.0.0")


class TestDownloadFilename:
    """
    The filename reaches a header the browser parses, so nothing an admin typed
    may pass through it unchanged.
    """

    def test_filename_comes_from_version_not_stored_path(self, storage_root):
        root, _ = storage_root
        (root / "internal-build-name-do-not-show.tar.gz").write_bytes(b"x")

        _resolved, filename = resolve_artefact(
            "internal-build-name-do-not-show.tar.gz", version="2.3.4"
        )
        assert "internal-build-name" not in filename
        assert "2.3.4" in filename

    @pytest.mark.parametrize(
        "hostile_version",
        ['1.0"; rm -rf /', "1.0\r\nX-Injected: yes", "1.0/../../etc", "1.0\nSet-Cookie: a=b"],
    )
    def test_header_injection_characters_are_stripped(self, storage_root, hostile_version):
        _resolved, filename = resolve_artefact(
            "riskintel-1.0.0.tar.gz", version=hostile_version
        )
        for forbidden in ('"', "\r", "\n", "/", "\\", ";", " "):
            assert forbidden not in filename
