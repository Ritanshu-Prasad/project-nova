import shutil
import subprocess
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parents[2] / "scripts" / "check_secrets.sh"

# Assembled here so this file does not itself look like it holds a secret.
AWS_KEY = "AKIA" + "A" * 16
NEBIUS_KEY = "v1." + "a" * 50 + "." + "b" * 50
DATABASE_URL = "postgresql://" + "owner:" + "hunter2hunter2" + "@host.example/db"
PRIVATE_KEY = "-----BEGIN " + "RSA PRIVATE KEY-----"


@pytest.fixture
def repo(tmp_path):
    def git(*args):
        subprocess.run(["git", *args], cwd=tmp_path, check=True, capture_output=True)

    git("init", "-q")
    (tmp_path / "scripts").mkdir()
    shutil.copy(SCRIPT, tmp_path / "scripts" / "check_secrets.sh")

    def commit(name: str, text: str):
        path = tmp_path / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
        git("add", name)

    def run():
        return subprocess.run(["sh", "scripts/check_secrets.sh"], cwd=tmp_path, capture_output=True, text=True, encoding="utf-8")

    return commit, run, tmp_path


def test_a_clean_repository_passes(repo):
    commit, run, _ = repo
    commit("app.py", "print('hello')\n")
    assert run().returncode == 0


@pytest.mark.parametrize("secret", [AWS_KEY, NEBIUS_KEY, DATABASE_URL, PRIVATE_KEY], ids=["aws", "nebius", "database", "private-key"])
def test_each_kind_of_secret_is_caught(repo, secret):
    commit, run, _ = repo
    commit("config.py", f"VALUE = '{secret}'\n")
    result = run()
    assert result.returncode == 1 and "config.py" in result.stdout


def test_the_secret_itself_is_not_printed_in_full(repo):
    commit, run, _ = repo
    commit("config.py", f"KEY = '{NEBIUS_KEY}'\n")
    assert NEBIUS_KEY not in run().stdout


def test_placeholders_in_the_template_and_docs_are_allowed(repo):
    commit, run, _ = repo
    commit(".env.example", f"DATABASE_URL={DATABASE_URL}\n")
    commit("docs/setup.md", f"Example: {AWS_KEY}\n")
    assert run().returncode == 0


def test_ordinary_urls_and_short_values_are_not_flagged(repo):
    commit, run, _ = repo
    commit("app.py", "URL = 'postgresql://localhost/db'\nTOKEN = 'v1.short'\nID = 'AKIAshort'\n")
    assert run().returncode == 0


def test_files_that_are_not_committed_are_not_scanned(repo):
    commit, run, folder = repo
    commit("app.py", "x = 1\n")
    (folder / "scratch.txt").write_text(AWS_KEY)
    assert run().returncode == 0
