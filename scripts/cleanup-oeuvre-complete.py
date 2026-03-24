#!/usr/bin/env python3
"""
Remove oeuvre-complete duplicates from Jules Verne and Émile Zola datasets.
Keeps only chapter-level files (--chapitre-*).

Run AFTER indexing is complete (server must be idle):

    export RAGFLOW_ADMIN_API_KEY=$(grep '^RAGFLOW_ADMIN_API_KEY=' .env.local | cut -d= -f2-)
    python3 scripts/cleanup-oeuvre-complete.py
"""

import json
import os
import sys
import time
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

BASE = "https://ragflow.cappasoft.cloud/api/v1"
TIMEOUT = 600

DATASETS = [
    ("Jules Verne", "09754114272b11f1a5a87db1341041f4"),
    ("Émile Zola", "0590e0b2272b11f1a5a87db1341041f4"),
]


def get_api_key():
    key = os.environ.get("RAGFLOW_ADMIN_API_KEY")
    if not key:
        env_file = Path(".env.local")
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                if line.startswith("RAGFLOW_ADMIN_API_KEY="):
                    key = line.split("=", 1)[1]
                    break
    if not key:
        print("ERROR: RAGFLOW_ADMIN_API_KEY not set")
        sys.exit(1)
    return key


def api_get(path, api_key):
    req = Request(f"{BASE}{path}", headers={"Authorization": f"Bearer {api_key}"})
    resp = urlopen(req, timeout=TIMEOUT)
    return json.loads(resp.read().decode())


def api_delete(path, api_key, body):
    data = json.dumps(body).encode()
    req = Request(
        f"{BASE}{path}",
        data=data,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="DELETE",
    )
    resp = urlopen(req, timeout=TIMEOUT)
    return json.loads(resp.read().decode())


def collect_oeuvre_complete(dataset_id, api_key):
    """Return list of (id, name) for non-chapter documents."""
    results = []
    page = 1
    while True:
        data = api_get(f"/datasets/{dataset_id}/documents?page={page}&page_size=200", api_key)
        doc_list = data.get("data", {}).get("docs", [])
        if not doc_list:
            break
        for d in doc_list:
            name = d.get("name", "")
            if "--chapitre-" not in name:
                results.append((d["id"], name))
        page += 1
    return results


def main():
    api_key = get_api_key()

    for name, dataset_id in DATASETS:
        print(f"=== {name} ===")

        print("  Listing documents...")
        oeuvre = collect_oeuvre_complete(dataset_id, api_key)
        if not oeuvre:
            print("  No oeuvre-complete docs found, skipping.")
            print()
            continue

        print(f"  Found {len(oeuvre)} oeuvre-complete docs to delete:")
        for _, n in oeuvre[:5]:
            print(f"    {n}")
        if len(oeuvre) > 5:
            print(f"    ... and {len(oeuvre) - 5} more")

        deleted = 0
        failed = 0
        for i, (doc_id, doc_name) in enumerate(oeuvre, 1):
            for attempt in range(3):
                try:
                    result = api_delete(
                        f"/datasets/{dataset_id}/documents", api_key, {"ids": [doc_id]}
                    )
                    if result.get("code") == 0:
                        deleted += 1
                        break
                    else:
                        print(f"    Error on {doc_name}: {result.get('message')}")
                        time.sleep(5)
                except (TimeoutError, HTTPError, URLError) as e:
                    wait = 15 * (attempt + 1)
                    print(f"    [{i}/{len(oeuvre)}] attempt {attempt+1} timeout. Wait {wait}s...")
                    time.sleep(wait)
            else:
                failed += 1
                print(f"    FAILED: {doc_name}")

            if deleted % 10 == 0 and deleted > 0:
                print(f"  Progress: {deleted}/{len(oeuvre)} deleted")
            time.sleep(0.5)

        print(f"  Done: {deleted} deleted, {failed} failed")
        print()

    # Final verification
    print("=== Final state ===")
    for name, dataset_id in DATASETS:
        data = api_get(f"/datasets/{dataset_id}/documents?page=1&page_size=1", api_key)
        total = data.get("data", {}).get("total", "?") if isinstance(data.get("data"), dict) else "?"
        print(f"  {name}: {total} documents")

    print("\nCleanup complete!")


if __name__ == "__main__":
    main()
