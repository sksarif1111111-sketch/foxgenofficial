"""Restore the intact oversized feature source from the shipped immutable ZIP."""
import hashlib
import io
import json
from pathlib import Path
import sys
import urllib.request
import zipfile

root = Path(__file__).resolve().parent
pointer = json.loads((root.parent / 'src/assets/foxgen-pro-5.40.zip.asset.json').read_text())
origin = sys.argv[1] if len(sys.argv) > 1 else 'https://foxgenofficial.lovable.app'
destination = Path('/tmp/foxgen-540-source/powerkits-core.js')
if Path(origin).is_file():
    archive = Path(origin).read_bytes()
else:
    request = urllib.request.Request(origin + pointer['url'], headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(request, timeout=90) as response:
        archive = response.read()
with zipfile.ZipFile(io.BytesIO(archive)) as release:
    source = release.read('powerkits-core.js')
    if release.testzip() is not None:
        raise ValueError('Release archive failed integrity verification')
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_bytes(source)
print('Restored intact core:', len(source), 'bytes; SHA256', hashlib.sha256(source).hexdigest())