#!/usr/bin/env python3
"""
Sync YAML frontmatter from data/markdown-rag/victor-hugo/*.txt into RAGFlow
document meta_fields (Victor Hugo dataset).

Requires RAGFLOW_ADMIN_API_KEY in the environment or in .env.local at repo root.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from json import JSONDecodeError
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

BASE = "https://ragflow.cappasoft.cloud/api/v1"
DEFAULT_VICTOR_HUGO_DATASET_ID = "14ef8d8e271611f1a5a87db1341041f4"
TIMEOUT = 600
PUT_SLEEP = 0.15

FRONTMATTER_KEYS = (
    "auteur",
    "slug_auteur",
    "oeuvre",
    "slug_oeuvre",
    "type",
    "section",
)

REPO_ROOT = Path(__file__).resolve().parent.parent


def get_api_key() -> str:
    key = os.environ.get("RAGFLOW_ADMIN_API_KEY")
    if not key:
        env_file = REPO_ROOT / ".env.local"
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                if line.startswith("RAGFLOW_ADMIN_API_KEY="):
                    key = line.split("=", 1)[1]
                    break
    if not key:
        print("ERROR: RAGFLOW_ADMIN_API_KEY not set", file=sys.stderr)
        sys.exit(1)
    return key


def parse_frontmatter(text: str) -> dict[str, str]:
    """Parse YAML-like key: value lines between first two --- lines."""
    if not text.startswith("---"):
        return {}
    parts = text.split("---", 2)
    if len(parts) < 3:
        return {}
    block = parts[1]
    out: dict[str, str] = {}
    for line in block.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" not in line:
            continue
        key, _, rest = line.partition(":")
        key = key.strip()
        val = rest.strip()
        if (val.startswith('"') and val.endswith('"')) or (
            val.startswith("'") and val.endswith("'")
        ):
            val = val[1:-1]
        out[key] = val
    return out


def build_meta_fields(fm: dict[str, str]) -> dict[str, str]:
    meta: dict[str, str] = {}
    for k in FRONTMATTER_KEYS:
        if k not in fm:
            continue
        v = fm[k]
        if v is None:
            continue
        s = str(v).strip()
        if s:
            meta[k] = s
    return meta


def api_request(
    method: str,
    url: str,
    api_key: str,
    body: bytes | None = None,
) -> dict:
    headers: dict[str, str] = {"Authorization": f"Bearer {api_key}"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = Request(url, data=body, headers=headers, method=method)
    try:
        resp = urlopen(req, timeout=TIMEOUT)
    except HTTPError as e:
        err_body = e.read().decode(errors="replace")
        raise RuntimeError(f"HTTP {e.code} {url}: {err_body}") from e
    except URLError as e:
        raise RuntimeError(f"URL error {url}: {e}") from e
    raw = resp.read().decode()
    try:
        return json.loads(raw)
    except JSONDecodeError as e:
        raise RuntimeError(f"Invalid JSON from {url}: {raw[:500]!r}") from e


def extract_docs_page(payload: dict) -> list[dict]:
    data = payload.get("data")
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("docs", "list", "documents"):
            docs = data.get(key)
            if isinstance(docs, list):
                return docs
    return []


def list_all_documents(dataset_id: str, api_key: str) -> list[dict]:
    all_docs: list[dict] = []
    page = 1
    page_size = 200
    while True:
        qs = urlencode({"page": page, "page_size": page_size})
        url = f"{BASE}/datasets/{dataset_id}/documents?{qs}"
        result = api_request("GET", url, api_key)
        if result.get("code") != 0:
            raise RuntimeError(
                f"List documents failed: {result.get('message', result)}"
            )
        docs = extract_docs_page(result)
        if not docs:
            break
        all_docs.extend(docs)
        if len(docs) < page_size:
            break
        page += 1
    return all_docs


def doc_id_and_name(doc: dict) -> tuple[str | None, str | None]:
    did = doc.get("id") or doc.get("document_id")
    name = doc.get("name")
    if did is not None:
        did = str(did)
    if name is not None:
        name = str(name)
    return did, name


def put_meta_fields(
    dataset_id: str,
    document_id: str,
    meta_fields: dict[str, str],
    api_key: str,
    dry_run: bool,
) -> tuple[bool, str | None]:
    if dry_run:
        return True, None
    url = f"{BASE}/datasets/{dataset_id}/documents/{document_id}"
    body = json.dumps({"meta_fields": meta_fields}).encode()
    result = api_request("PUT", url, api_key, body=body)
    if result.get("code") == 0:
        return True, None
    msg = result.get("message")
    if msg is not None:
        msg = str(msg)
    return False, msg or json.dumps(result, ensure_ascii=False)[:500]


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Sync Victor Hugo RAG .txt frontmatter to RAGFlow meta_fields."
    )
    parser.add_argument(
        "--dataset-id",
        default=None,
        help="RAGFlow dataset id (default: VICTOR_HUGO_DATASET_ID env or built-in Victor Hugo id)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List actions only; do not call PUT",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        metavar="N",
        help="Only perform (or count) the first N successful updates",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Log RAGFlow documents with no matching local .txt (by name)",
    )
    args = parser.parse_args()

    dataset_id = (
        args.dataset_id
        or os.environ.get("VICTOR_HUGO_DATASET_ID")
        or DEFAULT_VICTOR_HUGO_DATASET_ID
    )

    hugo_dir = REPO_ROOT / "data" / "markdown-rag" / "victor-hugo"
    if not hugo_dir.is_dir():
        print(f"ERROR: Directory not found: {hugo_dir}", file=sys.stderr)
        sys.exit(1)

    txt_files = sorted(hugo_dir.glob("*.txt"))
    local_by_basename: dict[str, Path] = {}
    for p in txt_files:
        local_by_basename[p.name] = p

    api_key = get_api_key()

    try:
        remote_docs = list_all_documents(dataset_id, api_key)
    except RuntimeError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

    name_to_doc_id: dict[str, str] = {}
    duplicate_names: list[str] = []
    for doc in remote_docs:
        did, name = doc_id_and_name(doc)
        if not did or not name:
            continue
        if name in name_to_doc_id:
            duplicate_names.append(name)
        name_to_doc_id[name] = did

    if duplicate_names:
        print(
            "WARNING: duplicate document names in dataset (using last id): "
            + ", ".join(sorted(set(duplicate_names))),
            file=sys.stderr,
        )

    updated = 0
    skipped = 0
    errors = 0
    unmatched_locals: list[str] = []
    matched_basenames: list[str] = []

    for basename, path in sorted(local_by_basename.items()):
        doc_id = name_to_doc_id.get(basename)
        if not doc_id:
            unmatched_locals.append(basename)
            skipped += 1
            continue

        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError as e:
            print(f"ERROR reading {path}: {e}", file=sys.stderr)
            errors += 1
            continue

        fm = parse_frontmatter(text)
        meta = build_meta_fields(fm)
        if not meta:
            print(f"WARNING: no meta_fields extracted for {basename}", file=sys.stderr)
            skipped += 1
            continue

        matched_basenames.append(basename)

    if args.limit is not None:
        to_process = matched_basenames[: args.limit]
        overflow = matched_basenames[args.limit :]
        skipped += len(overflow)
    else:
        to_process = matched_basenames
        overflow = []

    if overflow:
        print(
            f"NOTE: --limit {args.limit}: skipping {len(overflow)} further matches",
            file=sys.stderr,
        )

    for basename in to_process:
        path = local_by_basename[basename]
        doc_id = name_to_doc_id[basename]
        text = path.read_text(encoding="utf-8", errors="replace")
        meta = build_meta_fields(parse_frontmatter(text))

        try:
            ok, api_msg = put_meta_fields(
                dataset_id, doc_id, meta, api_key, args.dry_run
            )
        except RuntimeError as e:
            print(f"ERROR PUT {basename} ({doc_id}): {e}", file=sys.stderr)
            errors += 1
            continue

        if ok:
            updated += 1
            if not args.dry_run:
                time.sleep(PUT_SLEEP)
        else:
            detail = f": {api_msg}" if api_msg else ""
            print(
                f"ERROR PUT {basename}: API returned non-zero code{detail}",
                file=sys.stderr,
            )
            errors += 1

    if unmatched_locals:
        print(f"Unmatched local files (no RAGFlow doc name): {len(unmatched_locals)}")
        for b in unmatched_locals[:50]:
            print(f"  - {b}")
        if len(unmatched_locals) > 50:
            print(f"  ... and {len(unmatched_locals) - 50} more")

    if args.verbose:
        remote_names = set(name_to_doc_id.keys())
        local_names = set(local_by_basename.keys())
        unmatched_remote = sorted(remote_names - local_names)
        if unmatched_remote:
            print(
                f"Unmatched RAGFlow documents (no local .txt basename): {len(unmatched_remote)}"
            )
            for n in unmatched_remote[:50]:
                print(f"  - {n}")
            if len(unmatched_remote) > 50:
                print(f"  ... and {len(unmatched_remote) - 50} more")

    print()
    print("Summary:")
    print(f"  updated: {updated}" + (" (dry-run)" if args.dry_run else ""))
    print(f"  skipped: {skipped}")
    print(f"  errors:  {errors}")

    if errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
