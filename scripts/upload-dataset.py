#!/usr/bin/env python3
"""
Bulk upload files to a RAGFlow dataset and trigger indexing.

Usage:
    python3 scripts/upload-dataset.py <dataset_id> <source_dir>

Example:
    python3 scripts/upload-dataset.py 0590e0b2272b11f1a5a87db1341041f4 data/markdown-rag/emile-zola

The API key is read from RAGFLOW_ADMIN_API_KEY env var or .env.local.
"""

import json
import os
import sys
import time
import uuid
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

BASE = "https://ragflow.cappasoft.cloud/api/v1"
BATCH_SIZE = 10
PARSE_BATCH_SIZE = 64
MAX_RETRIES = 3
RETRY_DELAY = 5


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
        print("ERROR: RAGFLOW_ADMIN_API_KEY not set. Export it or put it in .env.local")
        sys.exit(1)
    return key


def api_request(method, path, api_key, body=None):
    url = f"{BASE}{path}"
    headers = {"Authorization": f"Bearer {api_key}"}
    data = None
    if body:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode()
    req = Request(url, data=data, headers=headers, method=method)
    resp = urlopen(req, timeout=120)
    return json.loads(resp.read().decode())


def build_multipart(files: list[Path]):
    boundary = uuid.uuid4().hex
    parts = []
    for fp in files:
        parts.append(f"--{boundary}".encode())
        parts.append(
            f'Content-Disposition: form-data; name="file"; filename="{fp.name}"'.encode()
        )
        parts.append(b"Content-Type: application/octet-stream")
        parts.append(b"")
        parts.append(fp.read_bytes())
    parts.append(f"--{boundary}--".encode())
    body = b"\r\n".join(parts)
    content_type = f"multipart/form-data; boundary={boundary}"
    return body, content_type


def upload_batch(dataset_id, files, api_key, batch_num, total_batches):
    body, content_type = build_multipart(files)
    url = f"{BASE}/datasets/{dataset_id}/documents"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": content_type}

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            req = Request(url, data=body, headers=headers, method="POST")
            resp = urlopen(req, timeout=300)
            result = json.loads(resp.read().decode())
            if result.get("code") != 0:
                print(f"  API error: {result.get('message', result)}")
                if attempt < MAX_RETRIES:
                    time.sleep(RETRY_DELAY * attempt)
                    continue
                return []
            doc_ids = [doc["id"] for doc in result.get("data", [])]
            names = [doc["name"] for doc in result.get("data", [])]
            print(
                f"  [{batch_num}/{total_batches}] Uploaded {len(doc_ids)} files: "
                f"{names[0]}...{names[-1]}"
            )
            return doc_ids
        except (HTTPError, URLError, TimeoutError) as e:
            print(f"  Attempt {attempt}/{MAX_RETRIES} failed: {e}")
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY * attempt)
            else:
                print(f"  GIVING UP on batch {batch_num} after {MAX_RETRIES} retries")
                return []


def trigger_parsing(dataset_id, doc_ids, api_key, batch_label):
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            result = api_request(
                "POST", f"/datasets/{dataset_id}/chunks", api_key,
                body={"document_ids": doc_ids},
            )
            if result.get("code") == 0:
                print(f"  Parsing triggered for {len(doc_ids)} docs ({batch_label})")
                return True
            else:
                print(f"  Parse API error: {result.get('message', result)}")
        except (HTTPError, URLError) as e:
            print(f"  Parse attempt {attempt} failed: {e}")
        if attempt < MAX_RETRIES:
            time.sleep(RETRY_DELAY)
    return False


def list_existing_docs(dataset_id, api_key):
    existing = set()
    page = 1
    while True:
        try:
            url = f"/datasets/{dataset_id}/documents?page={page}&page_size=100"
            result = api_request("GET", url, api_key)
            if result.get("code") != 0:
                break
            docs = result.get("data", {})
            doc_list = docs.get("docs", []) if isinstance(docs, dict) else (docs if isinstance(docs, list) else [])
            if not doc_list:
                break
            for doc in doc_list:
                existing.add(doc.get("name", ""))
            page += 1
        except Exception:
            break
    return existing


def main():
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <dataset_id> <source_dir>")
        sys.exit(1)

    dataset_id = sys.argv[1]
    source_dir = Path(sys.argv[2])

    if not source_dir.is_dir():
        print(f"ERROR: {source_dir} is not a directory")
        sys.exit(1)

    api_key = get_api_key()
    files = sorted(source_dir.glob("*.txt"))
    if not files:
        print(f"No .txt files found in {source_dir}")
        sys.exit(1)

    print(f"Source:     {source_dir}")
    print(f"Dataset:   {dataset_id}")
    print(f"Files:     {len(files)}")
    print(f"Batch:     {BATCH_SIZE} files per request")
    print()

    print("Checking for already-uploaded documents...")
    existing = list_existing_docs(dataset_id, api_key)
    if existing:
        files = [f for f in files if f.name not in existing]
        print(f"  {len(existing)} already uploaded, {len(files)} remaining")
    else:
        print("  Dataset is empty, uploading all files")
    print()

    if not files:
        print("All files already uploaded!")
        return

    batches = [files[i : i + BATCH_SIZE] for i in range(0, len(files), BATCH_SIZE)]
    total_batches = len(batches)
    print(f"Will upload in {total_batches} batches")
    print("=" * 60)

    all_doc_ids = []
    failed_batches = []
    start_time = time.time()

    for i, batch in enumerate(batches, 1):
        doc_ids = upload_batch(dataset_id, batch, api_key, i, total_batches)
        if doc_ids:
            all_doc_ids.extend(doc_ids)
        else:
            failed_batches.append(i)
        if i < total_batches:
            time.sleep(0.5)

    elapsed = time.time() - start_time
    print()
    print("=" * 60)
    print(f"Upload complete in {elapsed:.0f}s")
    print(f"  Uploaded: {len(all_doc_ids)} documents")
    if failed_batches:
        print(f"  Failed batches: {failed_batches}")
    print()

    if not all_doc_ids:
        print("No documents to parse.")
        return

    print(f"Triggering parsing for {len(all_doc_ids)} documents...")
    parse_batches = [
        all_doc_ids[i : i + PARSE_BATCH_SIZE]
        for i in range(0, len(all_doc_ids), PARSE_BATCH_SIZE)
    ]
    for i, batch in enumerate(parse_batches, 1):
        trigger_parsing(dataset_id, batch, api_key, f"batch {i}/{len(parse_batches)}")
        time.sleep(1)

    print()
    print("All done! Parsing is running in the background on RAGFlow.")
    print(f"Monitor progress at: https://ragflow.cappasoft.cloud")


if __name__ == "__main__":
    main()
