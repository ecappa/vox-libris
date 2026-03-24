#!/usr/bin/env python3
"""
06_rag_structure.py
Build a flat, RAG-optimised directory from the existing markdown/ tree.

Output: markdown-rag/<author-slug>/
  - <work-slug>.md                          full work  (for broad RAG queries)
  - <work-slug>--<section-slug>.md          chapter / tome / partie  (for citation)
  - <work-slug>--<part-slug>--<ch-slug>.md  chapter inside a part (Verne 3-level)

Every file receives a YAML front-matter block so the RAG system can filter
by author, work, chapter without parsing filenames.

Usage:
    python3 scripts/06_rag_structure.py [victor-hugo|emile-zola|jules-verne|all]
"""

import json
import re
import sys
from pathlib import Path

BASE_DIR   = Path(__file__).parent.parent
MD_SRC     = BASE_DIR / "markdown"          # existing structured tree
MD_RAG     = BASE_DIR / "markdown-rag"      # flat RAG output
SCRIPTS    = BASE_DIR / "scripts"

AUTHOR_DISPLAY = {
    "victor-hugo": "Victor Hugo",
    "emile-zola":  "Émile Zola",
    "jules-verne": "Jules Verne",
}

# ── helpers ──────────────────────────────────────────────────────────────────

def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace").strip()
    except Exception:
        return ""


def read_meta(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def slug_to_title(slug: str) -> str:
    """Best-effort human title from slug (used only as fallback)."""
    return slug.replace("-", " ").title()


def build_frontmatter(**fields) -> str:
    """Return a YAML front-matter block (only non-empty fields)."""
    lines = ["---"]
    for key, val in fields.items():
        if val:
            # Escape double-quotes in value
            safe = str(val).replace('"', '\\"')
            lines.append(f'{key}: "{safe}"')
    lines.append("---")
    return "\n".join(lines)


def write_rag_file(dest: Path, frontmatter: str, body: str) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    content = frontmatter + "\n\n" + body.strip() + "\n"
    dest.write_text(content, encoding="utf-8")


# ── per-author flattening ────────────────────────────────────────────────────

def flatten_author(author_slug: str) -> None:
    src_dir = MD_SRC / author_slug
    if not src_dir.is_dir():
        print(f"  ERROR: {src_dir} not found")
        return

    rag_dir = MD_RAG / author_slug
    rag_dir.mkdir(parents=True, exist_ok=True)

    author_name = AUTHOR_DISPLAY.get(author_slug, slug_to_title(author_slug))
    author_meta = read_meta(src_dir / "_metadata.json")

    work_dirs = sorted(
        d for d in src_dir.iterdir()
        if d.is_dir() and not d.name.startswith("_")
    )

    files_written = 0

    for work_dir in work_dirs:
        work_slug = work_dir.name
        work_meta = read_meta(work_dir / "_metadata.json")
        work_title = work_meta.get("titre") or slug_to_title(work_slug)

        # ── 1. Full-work file ─────────────────────────────────────────────
        oeuvre_complete = work_dir / "_oeuvre-complete.md"
        if oeuvre_complete.exists():
            body = read_text(oeuvre_complete)
            if body:
                fm = build_frontmatter(
                    auteur       = author_name,
                    slug_auteur  = author_slug,
                    oeuvre       = work_title,
                    slug_oeuvre  = work_slug,
                    type         = "oeuvre-complete",
                )
                dest = rag_dir / f"{work_slug}.md"
                write_rag_file(dest, fm, body)
                files_written += 1

        # ── 2. Sections inside this work dir ─────────────────────────────
        # Case A: direct chapter files  chapitre-01.md, premiere-partie.md …
        chapter_files = sorted(
            f for f in work_dir.iterdir()
            if f.is_file()
            and f.suffix == ".md"
            and not f.name.startswith("_")
        )
        for cf in chapter_files:
            section_slug = cf.stem
            body = read_text(cf)
            if not body:
                continue
            section_title = slug_to_title(section_slug)
            fm = build_frontmatter(
                auteur        = author_name,
                slug_auteur   = author_slug,
                oeuvre        = work_title,
                slug_oeuvre   = work_slug,
                section       = section_title,
                slug_section  = section_slug,
                type          = "chapitre",
            )
            dest = rag_dir / f"{work_slug}--{section_slug}.md"
            write_rag_file(dest, fm, body)
            files_written += 1

        # Case B: subdirectories (tomes, parties) containing chapter files
        sub_dirs = sorted(
            d for d in work_dir.iterdir()
            if d.is_dir() and not d.name.startswith("_")
        )
        for sub_dir in sub_dirs:
            part_slug  = sub_dir.name
            part_title = slug_to_title(part_slug)

            # Part-level complete file
            part_complete = sub_dir / "_oeuvre-complete.md"
            if part_complete.exists():
                body = read_text(part_complete)
                if body:
                    fm = build_frontmatter(
                        auteur        = author_name,
                        slug_auteur   = author_slug,
                        oeuvre        = work_title,
                        slug_oeuvre   = work_slug,
                        section       = part_title,
                        slug_section  = part_slug,
                        type          = "partie",
                    )
                    dest = rag_dir / f"{work_slug}--{part_slug}.md"
                    write_rag_file(dest, fm, body)
                    files_written += 1

            # Chapter files inside the part
            part_chapters = sorted(
                f for f in sub_dir.iterdir()
                if f.is_file()
                and f.suffix == ".md"
                and not f.name.startswith("_")
            )
            for cf in part_chapters:
                ch_slug = cf.stem
                body    = read_text(cf)
                if not body:
                    continue
                ch_title = slug_to_title(ch_slug)
                fm = build_frontmatter(
                    auteur        = author_name,
                    slug_auteur   = author_slug,
                    oeuvre        = work_title,
                    slug_oeuvre   = work_slug,
                    section       = part_title,
                    slug_section  = part_slug,
                    chapitre      = ch_title,
                    slug_chapitre = ch_slug,
                    type          = "chapitre",
                )
                dest = rag_dir / f"{work_slug}--{part_slug}--{ch_slug}.md"
                write_rag_file(dest, fm, body)
                files_written += 1

    print(f"  {author_slug}: {files_written} fichiers RAG écrits → {rag_dir}")


# ── entry point ──────────────────────────────────────────────────────────────

def main() -> None:
    targets = (
        ["victor-hugo", "emile-zola", "jules-verne"]
        if len(sys.argv) < 2 or sys.argv[1] == "all"
        else sys.argv[1:]
    )
    for slug in targets:
        print(f"\nFlattening {slug}...")
        flatten_author(slug)
    print("\nTerminé.")


if __name__ == "__main__":
    main()
