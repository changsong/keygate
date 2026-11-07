"""Deploy the built UnionUser site to the Keygate server.

Build first:  node build.mjs
Then run:     python scripts/deploy.py

Auth (env):
  UNION_HOST            default 149.28.141.122
  UNION_USER            default union
  UNION_SSH_KEY         private key path, default ~/.ssh/unionuser_ed25519
  UNION_SSH_KEY_PASS    key passphrase
  UNION_SSH_KEY_PASS_FILE  file containing the passphrase (whitespace trimmed)
"""

import io
import os
import sys
import tarfile
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
REMOTE_DIR = "/opt/union/website"

if not (SITE / "index.html").exists():
    sys.exit("site/ is missing or empty - run `node build.mjs` first")

host = os.environ.get("UNION_HOST", "149.28.141.122")
user = os.environ.get("UNION_USER", "union")
keyfile = os.environ.get("UNION_SSH_KEY", str(Path.home() / ".ssh" / "unionuser_ed25519"))
keypass = os.environ.get("UNION_SSH_KEY_PASS")
if not keypass:
    passfile = os.environ.get("UNION_SSH_KEY_PASS_FILE")
    if passfile:
        keypass = Path(passfile).read_text().strip()

stamp = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
tarball = ROOT / f".deploy-{stamp}.tar.gz"

with tarfile.open(tarball, "w:gz") as tar:
    for path in sorted(SITE.rglob("*")):
        tar.add(path, arcname=path.relative_to(SITE))
size = tarball.stat().st_size

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(
    host,
    username=user,
    pkey=paramiko.PKey.from_path(keyfile, password=keypass.encode() if keypass else None),
    timeout=20,
    banner_timeout=30,
    auth_timeout=30,
    look_for_keys=False,
    allow_agent=False,
)
print(f"connected to {user}@{host}")

remote_tar = f"/home/{user}/.unionuser-deploy-{stamp}.tar.gz"
sftp = client.open_sftp()
sftp.putfo(io.BytesIO(tarball.read_bytes()), remote_tar)
sftp.close()
tarball.unlink()
print(f"uploaded {size / 1024:.0f} KiB")

script = f"""
set -e
TAR={remote_tar}
sudo rm -rf {REMOTE_DIR}.new
sudo mkdir -p {REMOTE_DIR}.new
sudo tar -xzf "$TAR" -C {REMOTE_DIR}.new
sudo mkdir -p {REMOTE_DIR}
sudo rsync -a --delete {REMOTE_DIR}.new/ {REMOTE_DIR}/
sudo chmod -R a+rX {REMOTE_DIR}
sudo rm -rf {REMOTE_DIR}.new
rm -f "$TAR"
find {REMOTE_DIR} -type f | wc -l
du -sh {REMOTE_DIR}
"""
stdin, stdout, stderr = client.exec_command(script, timeout=300)
out = stdout.read().decode()
err = stderr.read().decode(errors="replace")
status = stdout.channel.recv_exit_status()
client.close()

print(out.strip())
if err.strip():
    print(err.strip(), file=sys.stderr)
if status != 0:
    sys.exit(f"remote deploy failed (exit {status})")
print(f"deployed to {REMOTE_DIR}")
