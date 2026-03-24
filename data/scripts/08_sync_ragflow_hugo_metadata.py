#!/usr/bin/env python3
"""Push YAML frontmatter from data/markdown-rag/victor-hugo/*.txt into RAGFlow document meta_fields.

Requires RAGFLOW_ADMIN_API_KEY in the environment (.env.local not loaded automatically).

Usage:
  export RAGFLOW_ADMIN_API_KEY=$(grep '^RAGFLOW_ADMIN_API_KEY=' .env.local | cut -d= -f2-)
  python3 data/scripts/08_sync_ragflow_hugo_metadata.py
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE = "https://ragflow.cappasoft.cloud/api/v1"
DATASET_ID = "14ef8d8e271611f1a5a87db1341041f4"
RAG_DIR = Path(__file__).resolve().parent.parent / "markdown-rag" / "victor-hugo"

META_KEYS = (
    "auteur",
    "slug_auteur",
    "oeuvre",
    "slug_oeuvre",
    "section",
    "slug_section",
    "type",
)


def parse_frontmatter(path: Path) -> dict[str, str]:
    raw = path.read_text(encoding="utf-8")
    if not raw.startswith("---"):
        return {}
    end = raw.find("\n---\n", 3)
    if end == -1:
        return {}
    block = raw[3:end].strip("\n")
    out: dict[str, str] = {}
    for line in block.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or ":" not in line:
            continue
        key, rest = line.split(":", 1)
        key = key.strip()
        val = rest.strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
            val = val[1:-1]
        out[key] = val
    return out


def api_request(method: str, url: str, body: dict | None = None) -> dict:
    key = os.environ.get("RAGFLOW_ADMIN_API_KEY")
    if not key:
        print("Missing RAGFLOW_ADMIN_API_KEY", file=sys.stderr)
        sys.exit(1)
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {key}",
            **({"Content-Type": "application/json"} if body is not None else {}),
        },
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.load(resp)


def fetch_doc_index() -> dict[str, str]:
    """Map RAGFlow document file name -> document id."""
    name_to_id: dict[str, str] = {}
    page = 1
    while True:
        url = f"{BASE}/datasets/{DATASET_ID}/documents?page={page}&page_size=200"
        data = api_request("GET", url)
        for d in data["data"]["docs"]:
            name_to_id[d["name"]] = d["id"]
        if len(data["data"]["docs"]) < 200:
            break
        page += 1
    return name_to_id


def main() -> None:
    name_to_id = fetch_doc_index()
    txt_files = sorted(RAG_DIR.glob("*.txt"))
    if len(txt_files) != len(name_to_id):
        print(
            f"Warning: local {len(txt_files)} files vs remote {len(name_to_id)} docs",
            file=sys.stderr,
        )

    ok, err = 0, 0
    for i, path in enumerate(txt_files):
        name = path.name
        doc_id = name_to_id.get(name)
        if not doc_id:
            print(f"SKIP no remote doc: {name}", file=sys.stderr)
            err += 1
            continue
        fm = parse_frontmatter(path)
        meta = {k: fm[k] for k in META_KEYS if k in fm and fm[k]}
        if not meta:
            print(f"SKIP empty frontmatter: {name}", file=sys.stderr)
            err += 1
            continue
        url = f"{BASE}/datasets/{DATASET_ID}/documents/{doc_id}"
        try:
            r = api_request("PUT", url, {"meta_fields": meta})
            if r.get("code") != 0:
                print(f"FAIL {name}: {r}", file=sys.stderr)
                err += 1
            else:
                ok += 1
        except urllib.error.HTTPError as e:
            print(f"HTTP {name}: {e.read().decode()}", file=sys.stderr)
            err += 1
        if (i + 1) % 25 == 0:
            print(f"... {i + 1}/{len(txt_files)}")
        time.sleep(0.04)

    print(json.dumps({"updated": ok, "errors": err, "total_local": len(txt_files)}))


if __name__ == "__main__":
    main()
