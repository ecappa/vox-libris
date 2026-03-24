#!/usr/bin/env python3
"""
02_build_structure.py
Build the markdown directory structure from extracted epub HTML files.

For each work in the manifest:
  1. Convert each HTML file in its range to markdown (via pandoc)
  2. Concatenate into _oeuvre-complete.md
  3. Split into per-section/chapter .md files
  4. Also build author-level _oeuvre-complete.md

Usage: python3 scripts/02_build_structure.py [victor-hugo|emile-zola|jules-verne|all]

Requirements: pandoc in PATH, python3, scripts/manifest_<slug>.json exists.
"""

import json
import os
import re
import subprocess
import sys
import unicodedata
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
SCRIPTS_DIR = BASE_DIR / "scripts"
MARKDOWN_DIR = BASE_DIR / "markdown"
MD_CACHE_BASE = Path("/tmp/epub_md")

MAX_WORKERS = 8  # parallel pandoc processes for HTML→MD conversion


def slugify(text):
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = text.lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-")


# ─── HTML → Markdown conversion ───────────────────────────────────────────────

def convert_html_file(args):
    """Convert a single HTML file to markdown. Returns (src_path, md_path, ok)."""
    html_path, md_path = args
    md_path = Path(md_path)
    html_path = Path(html_path)

    if md_path.exists() and md_path.stat().st_size > 0:
        return str(html_path), str(md_path), True  # cached

    md_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        result = subprocess.run(
            ["pandoc", str(html_path), "-f", "html", "-t", "markdown",
             "--wrap=none", "-o", str(md_path)],
            capture_output=True, text=True, timeout=30
        )
        return str(html_path), str(md_path), result.returncode == 0
    except Exception as e:
        return str(html_path), str(md_path), False


def convert_all_html(spine, md_cache_dir):
    """
    Convert all HTML files in the spine to markdown (parallel).
    Returns dict: abs_html_path → abs_md_path
    """
    md_cache_dir = Path(md_cache_dir)
    md_cache_dir.mkdir(parents=True, exist_ok=True)

    jobs = []
    for html_path in spine:
        p = Path(html_path)
        md_filename = p.stem + ".md"
        # Preserve subdirectory structure to avoid filename collisions
        # Use a flat name with parent folder prefix
        parent_name = p.parent.name
        if parent_name and parent_name != ".":
            md_filename = parent_name + "__" + md_filename
        md_path = md_cache_dir / md_filename
        jobs.append((html_path, str(md_path)))

    print(f"  Converting {len(jobs)} HTML files to markdown (up to {MAX_WORKERS} parallel)...")
    mapping = {}
    errors = 0

    with ProcessPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(convert_html_file, job): job for job in jobs}
        done = 0
        for future in as_completed(futures):
            html_path, md_path, ok = future.result()
            mapping[html_path] = md_path
            done += 1
            if not ok:
                errors += 1
            if done % 500 == 0:
                print(f"    {done}/{len(jobs)} converted ({errors} errors)...")

    print(f"  Conversion done: {len(jobs)} files, {errors} errors")
    return mapping


def read_md(md_path):
    """Read markdown file, return content or empty string."""
    p = Path(md_path)
    if p.exists() and p.stat().st_size > 0:
        try:
            return p.read_text(encoding="utf-8", errors="replace")
        except Exception:
            return ""
    return ""


# ─── Chapter splitting for Verne (h3 headings not in NCX) ────────────────────

def split_on_h3(content):
    """
    Split markdown content on ### headings (Verne sub-chapters).
    Returns list of (heading_title, content_block).
    If no h3 found, returns [(None, content)].
    """
    lines = content.split("\n")
    chunks = []
    current_heading = None
    current_lines = []

    for line in lines:
        m = re.match(r"^###\s+(.+)$", line)
        if m:
            if current_lines or current_heading is not None:
                chunks.append((current_heading, "\n".join(current_lines)))
            current_heading = m.group(1).strip()
            current_lines = [line]
        else:
            current_lines.append(line)

    if current_lines or current_heading is not None:
        chunks.append((current_heading, "\n".join(current_lines)))

    if not chunks:
        return [(None, content)]
    return chunks


# ─── Main build logic ─────────────────────────────────────────────────────────

def build_work(work, html_to_md, author_dir, author_slug, is_zola_group=False):
    """
    Build the directory structure for one work.
    Returns concatenated markdown content of the whole work.
    """
    if is_zola_group or work.get("is_group_header"):
        return ""

    title = work["title"]
    work_slug = work["slug"]
    files = work.get("files", [])
    sections = work.get("sections", [])

    if not files:
        return ""

    work_dir = author_dir / work_slug
    work_dir.mkdir(parents=True, exist_ok=True)

    # Collect full work content
    if sections:
        # Build per-section files
        work_parts = []

        for sec in sections:
            sec_files = sec.get("files", [])
            if not sec_files:
                continue

            # Gather markdown for this section
            sec_md_parts = []
            for f in sec_files:
                md = read_md(html_to_md.get(f, ""))
                if md.strip():
                    sec_md_parts.append(md)
            sec_content = "\n\n".join(sec_md_parts)

            sec_slug = sec["slug"]
            subsections = sec.get("subsections", [])
            is_part = sec.get("is_part", False)

            # Skip Table des matières sections
            if "table" in sec_slug and "mati" in sec_slug:
                work_parts.append(sec_content)
                continue

            if is_part and not subsections:
                # Verne: part with unlisted h3 chapters → split on h3
                chunks = split_on_h3(sec_content)
                if len(chunks) > 1:
                    # Create part subdirectory
                    part_dir = work_dir / sec_slug
                    part_dir.mkdir(exist_ok=True)
                    for k, (h3_title, chunk_content) in enumerate(chunks):
                        if not chunk_content.strip():
                            continue
                        if h3_title is None:
                            # Pre-chapter content (part header)
                            chap_filename = "_intro.md"
                        else:
                            chap_filename = f"chapitre-{k:02d}.md"
                        (part_dir / chap_filename).write_text(
                            chunk_content.strip() + "\n", encoding="utf-8"
                        )
                    # Part-level complete file
                    (part_dir / "_oeuvre-complete.md").write_text(
                        sec_content.strip() + "\n", encoding="utf-8"
                    )
                else:
                    # No h3 found → single file at work level
                    chap_num = len([f for f in work_dir.glob("chapitre-*.md")]) + 1
                    (work_dir / f"chapitre-{chap_num:02d}.md").write_text(
                        sec_content.strip() + "\n", encoding="utf-8"
                    )
            elif sections and not is_part:
                # Direct chapter (Hugo tomes already handled separately, Zola/Verne chapters)
                # Check if work has tome subdirectories (Hugo tomes)
                if work_slug == "les-miserables":
                    tome_dir = work_dir / sec_slug
                    tome_dir.mkdir(exist_ok=True)
                    (tome_dir / "_oeuvre-complete.md").write_text(
                        sec_content.strip() + "\n", encoding="utf-8"
                    )
                    # Hugo tomes don't have NCX chapters → keep as single file
                else:
                    # Single chapter file named by position
                    chap_num = len(list(work_dir.glob("chapitre-*.md"))) + 1
                    # Skip TOC sections
                    if not ("table" in sec_slug):
                        (work_dir / f"chapitre-{chap_num:02d}.md").write_text(
                            sec_content.strip() + "\n", encoding="utf-8"
                        )
            else:
                # Part with subsections (shouldn't happen for current data, but handle)
                (work_dir / f"{sec_slug}.md").write_text(
                    sec_content.strip() + "\n", encoding="utf-8"
                )

            work_parts.append(sec_content)

        work_content = "\n\n---\n\n".join(p for p in work_parts if p.strip())

    else:
        # No sections: Hugo works without chapter NCX, or simple works
        # Concatenate all files
        parts = []
        for f in files:
            md = read_md(html_to_md.get(f, ""))
            if md.strip():
                parts.append(md)
        work_content = "\n\n".join(parts)

    # Write _oeuvre-complete.md
    if work_content.strip():
        (work_dir / "_oeuvre-complete.md").write_text(
            work_content.strip() + "\n", encoding="utf-8"
        )

    return work_content


def build_author(slug):
    manifest_path = SCRIPTS_DIR / f"manifest_{slug}.json"
    if not manifest_path.exists():
        print(f"ERROR: {manifest_path} not found. Run 01_generate_manifest.py first.")
        return

    print(f"\n{'='*60}")
    print(f"Building structure for {slug}")
    print(f"{'='*60}")

    with open(manifest_path, encoding="utf-8") as f:
        manifest = json.load(f)

    spine = manifest["spine"]
    author_dir = MARKDOWN_DIR / slug
    author_dir.mkdir(parents=True, exist_ok=True)

    # Convert all HTML to markdown (cached in /tmp/epub_md/<slug>/)
    md_cache_dir = MD_CACHE_BASE / slug
    html_to_md = convert_all_html(spine, md_cache_dir)

    print(f"  Building work directories...")
    works = manifest["works"]
    all_work_contents = []
    work_count = 0

    for work in works:
        if work.get("is_front_matter") or work.get("is_back_matter"):
            continue
        if work.get("is_group_header"):
            continue

        print(f"  → {work['title'][:60]}")
        content = build_work(work, html_to_md, author_dir, slug)
        if content.strip():
            all_work_contents.append(content)
            work_count += 1

    # Write author-level _oeuvre-complete.md
    print(f"  Writing author-level _oeuvre-complete.md ({work_count} works)...")
    author_complete = "\n\n---\n\n".join(c for c in all_work_contents if c.strip())
    (author_dir / "_oeuvre-complete.md").write_text(
        author_complete.strip() + "\n", encoding="utf-8"
    )

    print(f"  Done: {work_count} works built for {slug}")


def main():
    if len(sys.argv) < 2 or sys.argv[1] == "all":
        targets = ["victor-hugo", "emile-zola", "jules-verne"]
    else:
        targets = [sys.argv[1]]

    for slug in targets:
        build_author(slug)


if __name__ == "__main__":
    main()
