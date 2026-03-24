#!/usr/bin/env python3
"""
Delete oeuvre-complete documents from Jules Verne and Émile Zola datasets.
Handles timeouts gracefully with retries and small batches.
Idempotent: safe to re-run if interrupted.
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


def delete_docs(dataset_id, doc_ids, api_key, dataset_name):
    print(f"=== {dataset_name}: {len(doc_ids)} docs to delete ===")
    deleted = 0
    failed = 0

    for i, doc_id in enumerate(doc_ids, 1):
        for attempt in range(5):
            try:
                body = json.dumps({"ids": [doc_id]}).encode()
                req = Request(
                    f"{BASE}/datasets/{dataset_id}/documents",
                    data=body,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    method="DELETE",
                )
                resp = urlopen(req, timeout=TIMEOUT)
                result = json.loads(resp.read().decode())
                if result.get("code") == 0:
                    deleted += 1
                    if deleted % 10 == 0 or i == len(doc_ids):
                        print(f"  Progress: {deleted}/{len(doc_ids)} deleted")
                    break
                else:
                    msg = result.get("message", "")
                    if "not found" in msg.lower() or "not exist" in msg.lower():
                        deleted += 1
                        break
                    print(f"  Error on {doc_id}: {msg}")
                    time.sleep(5)
            except (TimeoutError, HTTPError, URLError) as e:
                wait = 10 * (attempt + 1)
                print(f"  Timeout on doc {i}/{len(doc_ids)}, attempt {attempt+1}/5. Waiting {wait}s...")
                time.sleep(wait)
        else:
            failed += 1
            print(f"  FAILED: {doc_id} after 5 attempts")

        time.sleep(0.3)

    print(f"  Done: {deleted} deleted, {failed} failed")
    print()
    return deleted, failed


def main():
    api_key = get_api_key()

    datasets = [
        ("Jules Verne", "09754114272b11f1a5a87db1341041f4", "/tmp/verne_oeuvre_ids.json"),
        ("Émile Zola", "0590e0b2272b11f1a5a87db1341041f4", "/tmp/zola_oeuvre_ids.json"),
    ]

    for name, dataset_id, id_file in datasets:
        if not Path(id_file).exists():
            print(f"Skipping {name}: {id_file} not found")
            continue
        with open(id_file) as f:
            doc_ids = json.load(f)
        delete_docs(dataset_id, doc_ids, api_key, name)

    print("All done!")


if __name__ == "__main__":
    main()
