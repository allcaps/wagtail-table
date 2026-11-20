"""Build and check release artifacts, including installation without Node.js."""

import os
import shutil
import subprocess
import sys
import tarfile
import tempfile
import tomllib
from email.parser import BytesParser
from importlib.metadata import version
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parent.parent


def check_metadata(metadata, project):
    expected = {
        "Name": project["name"],
        "Version": project["version"],
        "License-Expression": project["license"],
        "Requires-Python": project["requires-python"],
    }
    for field, value in expected.items():
        if metadata[field] != value:
            raise RuntimeError(f"Incorrect distribution metadata: {field}")
    for label, url in project["urls"].items():
        if f"{label}, {url}" not in metadata.get_all("Project-URL", []):
            raise RuntimeError(f"Missing project URL: {label}")


def check_wheel(path, project):
    with ZipFile(path) as archive:
        names = archive.namelist()
        for source in (ROOT / "src/wagtail_table").rglob("*"):
            if not source.is_file() or "__pycache__" in source.parts:
                continue
            member = source.relative_to(ROOT / "src").as_posix()
            if archive.read(member) != source.read_bytes():
                raise RuntimeError(f"Missing or changed wheel content: {member}")
        metadata_path = next(name for name in names if name.endswith("/METADATA"))
        metadata = BytesParser().parsebytes(archive.read(metadata_path))
        check_metadata(metadata, project)
        if not any(name.endswith("/licenses/LICENSE") for name in names):
            raise RuntimeError("Missing package license")
        if any(
            not name.startswith(("wagtail_table/", "wagtail_table-")) for name in names
        ):
            raise RuntimeError("Unexpected files in wheel")


def check_sdist(path):
    with tarfile.open(path) as archive:
        members = archive.getnames()
        prefix = members[0].split("/")[0] + "/"
        names = {name.removeprefix(prefix) for name in members}
        required = {
            "README.md",
            "CHANGELOG.md",
            "LICENSE",
            "pyproject.toml",
            "package-lock.json",
            "frontend/editor.ts",
            "scripts/check_distribution.py",
            "scripts/smoke_installed.py",
            ".github/workflows/publish.yml",
        }
        if missing := required - names:
            raise RuntimeError(f"Missing sdist content: {sorted(missing)}")
        for source in (ROOT / "src/wagtail_table").rglob("*"):
            if not source.is_file() or "__pycache__" in source.parts:
                continue
            member = source.relative_to(ROOT).as_posix()
            file = archive.extractfile(prefix + member)
            if file is None or file.read() != source.read_bytes():
                raise RuntimeError(f"Missing or changed sdist content: {member}")
        excluded = {"node_modules", ".venv", "__pycache__", "staticfiles", "media"}
        if any(
            excluded.intersection(Path(name).parts)
            or name.endswith((".sqlite3", ".pyc"))
            for name in names
        ):
            raise RuntimeError("Development artifacts found in sdist")


def main():
    uv = shutil.which("uv")
    if uv is None:
        raise RuntimeError("Install uv before checking distributions")
    project = tomllib.loads((ROOT / "pyproject.toml").read_text())["project"]
    dist = ROOT / "dist"
    with tempfile.TemporaryDirectory(prefix="wagtail-table-release-") as directory:
        work = Path(directory)
        artifacts = work / "artifacts"
        # An empty executable search path makes Node and npm unavailable throughout
        # the build/install check. uv and Python are supplied by absolute path.
        empty_bin = work / "empty-bin"
        empty_bin.mkdir()
        env = {**os.environ, "PATH": str(empty_bin)}
        env.pop("PYTHONPATH", None)
        env.pop("VIRTUAL_ENV", None)
        subprocess.run(  # noqa: S603
            [
                uv,
                "build",
                "--no-sources",
                "--python",
                sys.executable,
                "--out-dir",
                str(artifacts),
                str(ROOT),
            ],
            cwd=work,
            env=env,
            check=True,
        )
        (wheel,) = artifacts.glob("*.whl")
        (sdist,) = artifacts.glob("*.tar.gz")
        check_wheel(wheel, project)
        check_sdist(sdist)
        rebuilt = work / "rebuilt"
        subprocess.run(  # noqa: S603
            [
                uv,
                "build",
                "--no-sources",
                "--wheel",
                "--python",
                sys.executable,
                "--out-dir",
                str(rebuilt),
                str(sdist),
            ],
            cwd=work,
            env=env,
            check=True,
        )
        (rebuilt_wheel,) = rebuilt.glob("*.whl")
        check_wheel(rebuilt_wheel, project)
        venv = work / "venv"
        subprocess.run(  # noqa: S603
            [uv, "venv", "--python", sys.executable, str(venv)],
            cwd=work,
            env=env,
            check=True,
        )
        python = venv / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
        # Reuse the tested dependency versions, without inheriting site-packages.
        requirements = [f"{name}=={version(name)}" for name in ("Wagtail", "Django")]
        subprocess.run(  # noqa: S603
            [
                uv,
                "pip",
                "install",
                "--python",
                str(python),
                str(rebuilt_wheel),
                *requirements,
            ],
            cwd=work,
            env=env,
            check=True,
        )
        subprocess.run(  # noqa: S603
            [str(python), "-I", str(ROOT / "scripts/smoke_installed.py")],
            cwd=work,
            env=env,
            check=True,
        )
        # Publish only checked artifacts. Remove stale distributions from older builds.
        dist.mkdir(exist_ok=True)
        for pattern in ("*.whl", "*.tar.gz"):
            for old in dist.glob(pattern):
                old.unlink()
        for artifact in (wheel, sdist):
            shutil.copy2(artifact, dist / artifact.name)
        print(f"Verified {wheel.name} and {sdist.name}; artifacts are in {dist}")


if __name__ == "__main__":
    main()
