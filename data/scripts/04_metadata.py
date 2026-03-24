#!/usr/bin/env python3
"""
04_metadata.py — Generate _metadata.json files for the vox-libris markdown tree.

Reads manifest files produced by earlier pipeline steps
(scripts/manifest_<slug>.json) and the actual directory structure under
markdown/ to produce:

  • markdown/<author-slug>/_metadata.json          (author level)
  • markdown/<author-slug>/<work-slug>/_metadata.json  (work level)

Usage:
    python3 scripts/04_metadata.py                   # all authors
    python3 scripts/04_metadata.py victor-hugo       # one author
    python3 scripts/04_metadata.py emile-zola
    python3 scripts/04_metadata.py jules-verne

Run from the project root:
    cd /Users/ecappannelli/devRoot/perso/vox-libris
"""

import json
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Project root
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
MARKDOWN_ROOT = PROJECT_ROOT / "markdown"
SCRIPTS_DIR   = PROJECT_ROOT / "scripts"
IMAGES_ROOT   = PROJECT_ROOT / "images"

# ---------------------------------------------------------------------------
# Known author display names (slug → full name)
# ---------------------------------------------------------------------------
AUTHOR_NAMES: dict[str, str] = {
    "victor-hugo": "Victor Hugo",
    "emile-zola":  "Émile Zola",
    "jules-verne": "Jules Verne",
}

# Known source epub filenames (slug → epub filename)
AUTHOR_SOURCES: dict[str, str] = {
    "victor-hugo": "victor-hugo-oeuvres-completes.epub",
    "emile-zola":  "emile-zola-oeuvres-completes.epub",
    "jules-verne": "jules-verne-oeuvres-completes.epub",
}


# ---------------------------------------------------------------------------
# Manifest helpers
# ---------------------------------------------------------------------------

def load_manifest(author_slug: str) -> dict | None:
    """
    Load scripts/manifest_<author_slug>.json.

    Expected top-level structure (produced by 02_split.py or equivalent):
    {
      "author": "Victor Hugo",
      "slug": "victor-hugo",
      "works": [
        {
          "title": "Han d'Islande",
          "slug": "han-d-islande",
          "sections": ["Tome I", "Tome II", ...]   // optional depth-2 navPoints
        },
        ...
      ]
    }

    Returns the parsed dict, or None if the file doesn't exist.
    """
    manifest_path = SCRIPTS_DIR / f"manifest_{author_slug}.json"
    if not manifest_path.is_file():
        print(f"  WARNING: manifest not found: {manifest_path}")
        return None
    with manifest_path.open(encoding="utf-8") as fh:
        return json.load(fh)


# ---------------------------------------------------------------------------
# Directory / file counting helpers
# ---------------------------------------------------------------------------

def count_chapter_files(work_dir: Path) -> int:
    """
    Count .md files in *work_dir* (recursively) that are chapter files,
    i.e. not _oeuvre-complete.md and not _metadata.json.
    """
    count = 0
    for md in work_dir.rglob("*.md"):
        if md.name.startswith("_"):
            continue
        count += 1
    return count


def list_images_for_work(author_slug: str, work_slug: str) -> list[str]:
    """
    Return a list of image paths (relative to project root) found under
    images/<author-slug>/<work-slug>/, or an empty list if that directory
    does not exist.
    """
    img_dir = IMAGES_ROOT / author_slug / work_slug
    if not img_dir.is_dir():
        return []

    image_extensions = {".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp"}
    images = []
    for img in sorted(img_dir.rglob("*")):
        if img.is_file() and img.suffix.lower() in image_extensions:
            # Path relative to project root
            images.append(str(img.relative_to(PROJECT_ROOT)))
    return images


# ---------------------------------------------------------------------------
# Metadata writers
# ---------------------------------------------------------------------------

def write_author_metadata(author_slug: str, manifest: dict) -> Path:
    """
    Write markdown/<author-slug>/_metadata.json from the manifest.

    Returns the path written.
    """
    author_dir = MARKDOWN_ROOT / author_slug
    author_dir.mkdir(parents=True, exist_ok=True)

    works_list: list[dict] = manifest.get("works", [])
    # Exclude front/back matter and Zola group headers from the oeuvres list
    real_works = [
        w for w in works_list
        if not w.get("is_front_matter")
        and not w.get("is_back_matter")
        and not w.get("is_group_header")
    ]
    oeuvres_titles = [w["title"] for w in real_works]

    metadata = {
        "auteur":        manifest.get("author", AUTHOR_NAMES.get(author_slug, author_slug)),
        "slug":          author_slug,
        "source":        AUTHOR_SOURCES.get(author_slug, f"{author_slug}-oeuvres-completes.epub"),
        "nombre_oeuvres": len(oeuvres_titles),
        "oeuvres":       oeuvres_titles,
    }

    out_path = author_dir / "_metadata.json"
    with out_path.open("w", encoding="utf-8") as fh:
        json.dump(metadata, fh, ensure_ascii=False, indent=2)

    return out_path


def write_work_metadata(author_slug: str, work_info: dict) -> Path | None:
    """
    Write markdown/<author-slug>/<work-slug>/_metadata.json for a single work.

    *work_info* is one entry from the manifest "works" array:
    {
      "title":    "Les Misérables",
      "slug":     "les-miserables",
      "sections": ["Tome 1 – Fantine", ...]   // optional
    }

    Returns the path written, or None if the work directory does not exist.
    """
    work_slug = work_info.get("slug", "")
    if not work_slug:
        print(f"  WARNING: work entry has no slug: {work_info}")
        return None

    work_dir = MARKDOWN_ROOT / author_slug / work_slug
    if not work_dir.is_dir():
        # The directory may not have been created yet (split step not run).
        # Create it so that the metadata can still be written.
        work_dir.mkdir(parents=True, exist_ok=True)

    author_display = AUTHOR_NAMES.get(author_slug, author_slug)

    nombre_chapitres = count_chapter_files(work_dir)
    structure        = work_info.get("sections", [])
    images           = list_images_for_work(author_slug, work_slug)

    metadata = {
        "auteur":           author_display,
        "titre":            work_info.get("title", work_slug),
        "slug":             work_slug,
        "nombre_chapitres": nombre_chapitres,
        "structure":        structure,
        "genre":            "",
        "annee":            "",
        "images":           images,
    }

    out_path = work_dir / "_metadata.json"
    with out_path.open("w", encoding="utf-8") as fh:
        json.dump(metadata, fh, ensure_ascii=False, indent=2)

    return out_path


# ---------------------------------------------------------------------------
# Per-author processing
# ---------------------------------------------------------------------------

def process_author(author_slug: str) -> int:
    """
    Generate all metadata files for *author_slug*.

    Returns the total number of metadata files written.
    """
    manifest = load_manifest(author_slug)
    if manifest is None:
        print(f"  Skipping {author_slug}: no manifest available.")
        return 0

    written = 0

    # --- Author-level metadata ---
    author_meta_path = write_author_metadata(author_slug, manifest)
    print(f"  Generated metadata for: {author_meta_path}")
    written += 1

    # --- Work-level metadata ---
    works_list: list[dict] = manifest.get("works", [])
    if not works_list:
        print(f"  WARNING: manifest for {author_slug} has no works.")
        return written

    for work_info in works_list:
        # Skip front/back matter and group headers
        if (work_info.get("is_front_matter")
                or work_info.get("is_back_matter")
                or work_info.get("is_group_header")):
            continue
        out_path = write_work_metadata(author_slug, work_info)
        if out_path:
            print(f"  Generated metadata for: {out_path}")
            written += 1

    return written


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    args = sys.argv[1:]

    if args:
        author_slugs = args
    else:
        # Auto-discover author directories
        if not MARKDOWN_ROOT.is_dir():
            print(f"ERROR: markdown/ directory not found at {MARKDOWN_ROOT}")
            sys.exit(1)
        author_slugs = [
            d.name for d in sorted(MARKDOWN_ROOT.iterdir()) if d.is_dir()
        ]
        # Also include authors that only have a manifest but no directory yet
        for manifest_file in sorted(SCRIPTS_DIR.glob("manifest_*.json")):
            slug = manifest_file.stem.replace("manifest_", "", 1)
            if slug not in author_slugs:
                author_slugs.append(slug)

        if not author_slugs:
            print("No authors found. Nothing to do.")
            sys.exit(0)

    total_written = 0
    for slug in author_slugs:
        print(f"\nProcessing author: {slug}")
        count = process_author(slug)
        print(f"  → {count} metadata file(s) written for {slug}")
        total_written += count

    print(f"\nDone. Total metadata files written: {total_written}")


if __name__ == "__main__":
    main()
