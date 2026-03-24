#!/usr/bin/env python3
"""
04_images.py
Reorganize extracted images into images/<author>/<work>/ structure.

Strategy:
1. Find all images in the extracted epub's Images/ directory
2. For each image, grep through the HTML source files to find which HTML references it
3. Using the manifest, determine which work that HTML file belongs to
4. Copy/move image to images/<author>/<work>/
5. Update image references in markdown files

Usage: python3 scripts/04_images.py [victor-hugo|emile-zola|jules-verne|all]
"""

import json
import os
import re
import shutil
import sys
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
SCRIPTS_DIR = BASE_DIR / "scripts"
MARKDOWN_DIR = BASE_DIR / "markdown"
IMAGES_DIR = BASE_DIR / "images"
EXTRACT_BASE = Path("/tmp/epub_extract")

AUTHORS_EXTRACT = {
    "victor-hugo": {
        "extract_dir": EXTRACT_BASE / "hugo",
        "images_subdir": "images",       # epub internal path (no OEBPS)
        # pandoc extracted to images/victor-hugo/images/
        "pandoc_images": IMAGES_DIR / "victor-hugo" / "images",
    },
    "emile-zola": {
        "extract_dir": EXTRACT_BASE / "zola",
        "images_subdir": "OEBPS/Images",
        # pandoc extracted to images/emile-zola/Images/
        "pandoc_images": IMAGES_DIR / "emile-zola" / "Images",
    },
    "jules-verne": {
        "extract_dir": EXTRACT_BASE / "verne",
        "images_subdir": "OEBPS/Images",
        # pandoc extracted to images/jules-verne/Images/
        "pandoc_images": IMAGES_DIR / "jules-verne" / "Images",
    },
}


def build_file_to_work_map(manifest):
    """
    Build a dict: html_abs_path → work_slug (or "work_slug/section_slug" for tomed works).
    """
    mapping = {}
    for work in manifest["works"]:
        if work.get("is_front_matter") or work.get("is_back_matter"):
            continue
        if work.get("is_group_header"):
            continue
        work_slug = work["slug"]
        sections = work.get("sections", [])
        if sections:
            for sec in sections:
                for f in sec.get("files", []):
                    mapping[f] = work_slug
                for sub in sec.get("subsections", []):
                    for f in sub.get("files", []):
                        mapping[f] = work_slug
        for f in work.get("files", []):
            if f not in mapping:
                mapping[f] = work_slug
    return mapping


def find_image_references_in_html(html_path):
    """Return set of image filenames referenced in an HTML file."""
    try:
        content = Path(html_path).read_text(encoding="utf-8", errors="replace")
    except Exception:
        return set()
    # Match src attributes pointing to image files
    refs = set()
    for m in re.finditer(r'src=["\']([^"\']+\.(jpg|jpeg|png|gif|svg|webp))["\']',
                         content, re.IGNORECASE):
        refs.add(Path(m.group(1)).name)
    return refs


def reorganize_images(slug):
    manifest_path = SCRIPTS_DIR / f"manifest_{slug}.json"
    if not manifest_path.exists():
        print(f"ERROR: manifest not found for {slug}")
        return

    with open(manifest_path, encoding="utf-8") as f:
        manifest = json.load(f)

    cfg = AUTHORS_EXTRACT[slug]
    extract_dir = cfg["extract_dir"]
    images_src_dir = extract_dir / cfg["images_subdir"]

    # Use pandoc-extracted images (already in images/<author>/) if available,
    # otherwise fall back to epub-extracted images
    pandoc_images_dir = cfg.get("pandoc_images")
    if pandoc_images_dir and pandoc_images_dir.exists():
        images_src_dir = pandoc_images_dir
    elif not images_src_dir.exists():
        print(f"  No images directory found at {images_src_dir}")
        return

    # Get all source images
    all_images = []
    for ext in ("*.jpg", "*.jpeg", "*.png", "*.gif", "*.svg", "*.webp",
                "*.JPG", "*.JPEG", "*.PNG"):
        all_images.extend(images_src_dir.glob(ext))

    print(f"  Found {len(all_images)} images in {images_src_dir}")

    if not all_images:
        return

    # Build html_file → work_slug mapping from manifest
    file_to_work = build_file_to_work_map(manifest)

    # Build image_filename → work_slug by scanning HTML files
    image_to_work = {}
    spine = manifest.get("spine", [])

    print(f"  Scanning {len(spine)} HTML files for image references...")
    for html_path in spine:
        work_slug = file_to_work.get(html_path)
        if not work_slug:
            continue
        refs = find_image_references_in_html(html_path)
        for img_name in refs:
            if img_name not in image_to_work:
                image_to_work[img_name] = work_slug

    # Copy images to organized directories
    moved = 0
    unmapped = 0
    author_images_dir = IMAGES_DIR / slug

    for img_path in all_images:
        img_name = img_path.name
        work_slug = image_to_work.get(img_name)

        if work_slug:
            dest_dir = author_images_dir / work_slug
        else:
            dest_dir = author_images_dir / "_shared"
            unmapped += 1

        dest_dir.mkdir(parents=True, exist_ok=True)
        dest_path = dest_dir / img_name

        # Number duplicates
        if dest_path.exists():
            stem = img_path.stem
            suffix = img_path.suffix
            counter = 1
            while dest_path.exists():
                dest_path = dest_dir / f"{stem}_{counter}{suffix}"
                counter += 1

        shutil.copy2(str(img_path), str(dest_path))
        moved += 1

    print(f"  Copied {moved} images ({unmapped} to _shared/)")

    # Update image references in markdown files
    print(f"  Updating image references in markdown files...")
    md_dir = MARKDOWN_DIR / slug
    update_count = 0

    for md_file in md_dir.rglob("*.md"):
        content = md_file.read_text(encoding="utf-8", errors="replace")
        new_content = content

        # Replace old image paths with new organized paths
        def replace_img_ref(m):
            alt = m.group(1)
            old_path = m.group(2)
            img_name = Path(old_path).name
            work_slug = image_to_work.get(img_name, "_shared")
            # Build relative path from markdown file location to image
            img_dest = IMAGES_DIR / slug / work_slug / img_name
            try:
                rel_path = os.path.relpath(img_dest, md_file.parent)
            except ValueError:
                rel_path = str(img_dest)
            return f"![{alt}]({rel_path})"

        new_content = re.sub(r"!\[([^\]]*)\]\(([^)]+)\)", replace_img_ref, new_content)

        if new_content != content:
            md_file.write_text(new_content, encoding="utf-8")
            update_count += 1

    print(f"  Updated image refs in {update_count} markdown files")


def main():
    if len(sys.argv) < 2 or sys.argv[1] == "all":
        targets = ["victor-hugo", "emile-zola", "jules-verne"]
    else:
        targets = [sys.argv[1]]

    for slug in targets:
        print(f"\nReorganizing images for {slug}...")
        reorganize_images(slug)


if __name__ == "__main__":
    main()
