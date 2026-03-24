#!/usr/bin/env python3
"""
Bulk upload Jules Verne files to RAGFlow and trigger indexing.

Usage:
    export RAGFLOW_ADMIN_API_KEY=$(grep '^RAGFLOW_ADMIN_API_KEY=' .env.local | cut -d= -f2-)
    python3 scripts/upload-jules-verne.py
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
DATASET_ID = "09754114272b11f1a5a87db1341041f4"
SOURCE_DIR = Path("data/markdown-rag/jules-verne")
BATCH_SIZE = 10  # files per upload request
PARSE_BATCH_SIZE = 64  # document IDs per parse request
MAX_RETRIES = 3
RETRY_DELAY = 5  # seconds


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


def api_request(method, path, api_key, body=None, content_type="application/json"):
    url = f"{BASE}{path}"
    headers = {"Authorization": f"Bearer {api_key}"}

    data = None
    if body and content_type == "application/json":
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode()
    elif body:
        headers["Content-Type"] = content_type
        data = body

    req = Request(url, data=data, headers=headers, method=method)
    resp = urlopen(req, timeout=120)
    return json.loads(resp.read().decode())


def build_multipart(files: list[Path]):
    """Build a multipart/form-data body for multiple file uploads."""
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


def upload_batch(files: list[Path], api_key: str, batch_num: int, total_batches: int):
    """Upload a batch of files, return list of document IDs."""
    body, content_type = build_multipart(files)
    url = f"{BASE}/datasets/{DATASET_ID}/documents"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": content_type,
    }

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


def trigger_parsing(doc_ids: list[str], api_key: str, batch_label: str):
    """Trigger parsing for a batch of document IDs."""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            result = api_request(
                "POST",
                f"/datasets/{DATASET_ID}/chunks",
                api_key,
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


def update_dataset_language(api_key: str):
    """Set dataset language to French."""
    try:
        result = api_request(
            "PUT",
            f"/datasets/{DATASET_ID}",
            api_key,
            body={"language": "French"},
        )
        if result.get("code") == 0:
            print("Dataset language updated to French")
        else:
            print(f"Warning: could not update language: {result}")
    except Exception as e:
        print(f"Warning: language update failed: {e}")


def get_upload_progress(api_key: str):
    """Check how many documents are already in the dataset."""
    try:
        result = api_request(
            "GET",
            f"/datasets/{DATASET_ID}/documents?page=1&page_size=1",
            api_key,
        )
        if result.get("code") == 0:
            return result.get("data", {}).get("total", 0) if isinstance(result.get("data"), dict) else 0
    except Exception:
        pass
    return 0


def list_existing_docs(api_key: str):
    """Return set of filenames already uploaded."""
    existing = set()
    page = 1
    while True:
        try:
            url = f"/datasets/{DATASET_ID}/documents?page={page}&page_size=100"
            result = api_request("GET", url, api_key)
            if result.get("code") != 0:
                break
            docs = result.get("data", {})
            if isinstance(docs, dict):
                doc_list = docs.get("docs", [])
            elif isinstance(docs, list):
                doc_list = docs
            else:
                break
            if not doc_list:
                break
            for doc in doc_list:
                existing.add(doc.get("name", ""))
            page += 1
        except Exception:
            break
    return existing


def main():
    api_key = get_api_key()

    files = sorted(SOURCE_DIR.glob("*.txt"))
    if not files:
        print(f"No .txt files found in {SOURCE_DIR}")
        sys.exit(1)

    print(f"Found {len(files)} files in {SOURCE_DIR}")
    print(f"Dataset ID: {DATASET_ID}")
    print(f"Batch size: {BATCH_SIZE} files per upload request")
    print()

    update_dataset_language(api_key)

    # Check for already-uploaded files (resume support)
    print("Checking for already-uploaded documents...")
    existing = list_existing_docs(api_key)
    if existing:
        before = len(files)
        files = [f for f in files if f.name not in existing]
        print(f"  {len(existing)} already uploaded, {len(files)} remaining")
    else:
        print("  Dataset is empty, uploading all files")
    print()

    if not files:
        print("All files already uploaded!")
        return

    # Split into batches
    batches = [files[i : i + BATCH_SIZE] for i in range(0, len(files), BATCH_SIZE)]
    total_batches = len(batches)
    print(f"Will upload in {total_batches} batches")
    print("=" * 60)

    all_doc_ids = []
    failed_batches = []
    start_time = time.time()

    for i, batch in enumerate(batches, 1):
        doc_ids = upload_batch(batch, api_key, i, total_batches)
        if doc_ids:
            all_doc_ids.extend(doc_ids)
        else:
            failed_batches.append(i)

        # Small delay to avoid hammering the server
        if i < total_batches:
            time.sleep(0.5)

    upload_time = time.time() - start_time
    print()
    print("=" * 60)
    print(f"Upload complete in {upload_time:.0f}s")
    print(f"  Uploaded: {len(all_doc_ids)} documents")
    if failed_batches:
        print(f"  Failed batches: {failed_batches}")
    print()

    if not all_doc_ids:
        print("No documents to parse.")
        return

    # Trigger parsing in batches
    print(f"Triggering parsing for {len(all_doc_ids)} documents...")
    parse_batches = [
        all_doc_ids[i : i + PARSE_BATCH_SIZE]
        for i in range(0, len(all_doc_ids), PARSE_BATCH_SIZE)
    ]

    for i, batch in enumerate(parse_batches, 1):
        trigger_parsing(batch, api_key, f"batch {i}/{len(parse_batches)}")
        time.sleep(1)

    print()
    print("All done! Parsing is running in the background on RAGFlow.")
    print(f"Monitor progress at: https://ragflow.cappasoft.cloud")


if __name__ == "__main__":
    main()
