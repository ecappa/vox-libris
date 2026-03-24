#!/usr/bin/env python3
"""
05_verify.py — Generate _rapport-conversion.md for the vox-libris project.

Walks the markdown/ and images/ trees, cross-references manifest files,
and produces a comprehensive conversion report at the project root.

Usage:
    python3 scripts/05_verify.py

Run from the project root:
    cd /Users/ecappannelli/devRoot/perso/vox-libris
"""

import json
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Project root
# ---------------------------------------------------------------------------
PROJECT_ROOT  = Path(__file__).resolve().parent.parent
MARKDOWN_ROOT = PROJECT_ROOT / "markdown"
IMAGES_ROOT   = PROJECT_ROOT / "images"
SCRIPTS_DIR   = PROJECT_ROOT / "scripts"
REPORT_PATH   = PROJECT_ROOT / "_rapport-conversion.md"

# ---------------------------------------------------------------------------
# Known author display names
# ---------------------------------------------------------------------------
AUTHOR_NAMES: dict[str, str] = {
    "victor-hugo": "Victor Hugo",
    "emile-zola":  "Émile Zola",
    "jules-verne": "Jules Verne",
}

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp"}


# ---------------------------------------------------------------------------
# Data-collection helpers
# ---------------------------------------------------------------------------

def load_manifest(author_slug: str) -> dict | None:
    """Load scripts/manifest_<slug>.json; return None if absent."""
    p = SCRIPTS_DIR / f"manifest_{author_slug}.json"
    if not p.is_file():
        return None
    try:
        with p.open(encoding="utf-8") as fh:
            return json.load(fh)
    except json.JSONDecodeError as exc:
        return {"_error": str(exc)}


def validate_json_file(path: Path) -> str | None:
    """Return an error string if *path* is not valid JSON, else None."""
    try:
        with path.open(encoding="utf-8") as fh:
            json.load(fh)
        return None
    except Exception as exc:
        return str(exc)


def human_size(n_bytes: int) -> str:
    """Return a human-readable size string (KB / MB)."""
    if n_bytes >= 1_048_576:
        return f"{n_bytes / 1_048_576:.2f} MB"
    if n_bytes >= 1_024:
        return f"{n_bytes / 1_024:.1f} KB"
    return f"{n_bytes} B"


def total_size_bytes(directory: Path) -> int:
    """Recursively sum the sizes of all files under *directory*."""
    return sum(f.stat().st_size for f in directory.rglob("*") if f.is_file())


def count_images_in_dir(directory: Path) -> int:
    """Count image files (any depth) under *directory*."""
    if not directory.is_dir():
        return 0
    return sum(
        1 for f in directory.rglob("*")
        if f.is_file() and f.suffix.lower() in IMAGE_EXTENSIONS
    )


# ---------------------------------------------------------------------------
# Per-author stats collection
# ---------------------------------------------------------------------------

class WorkStats:
    def __init__(self, slug: str, title: str):
        self.slug             = slug
        self.title            = title
        self.dir_exists       = False
        self.chapter_count    = 0
        self.total_bytes      = 0
        self.image_count      = 0
        self.has_complete_md  = False
        self.warnings: list[str] = []


class AuthorStats:
    def __init__(self, slug: str):
        self.slug          = slug
        self.display_name  = AUTHOR_NAMES.get(slug, slug)
        self.works: list[WorkStats] = []
        self.manifest_work_count  = 0   # number of works listed in NCX/manifest
        self.actual_work_count    = 0   # number of work dirs actually present
        self.unorganised_images   = 0   # images directly in images/<slug>/ (not in a subdir)
        self.organised_images     = 0   # images in images/<slug>/<work>/


def collect_author_stats(author_slug: str) -> AuthorStats:
    stats = AuthorStats(author_slug)
    author_md_dir  = MARKDOWN_ROOT / author_slug
    author_img_dir = IMAGES_ROOT   / author_slug

    manifest = load_manifest(author_slug)

    # --- Build work list from manifest ---
    manifest_works: list[dict] = []
    if manifest and "_error" not in manifest:
        manifest_works = manifest.get("works", [])
        stats.manifest_work_count = len(manifest_works)

    # Collect work slugs we expect from the manifest
    manifest_slugs = {w.get("slug", "") for w in manifest_works}

    # --- Also collect work dirs that exist on disk (may not be in manifest) ---
    disk_work_dirs: set[str] = set()
    if author_md_dir.is_dir():
        for child in author_md_dir.iterdir():
            if child.is_dir():
                disk_work_dirs.add(child.name)
    stats.actual_work_count = len(disk_work_dirs)

    # --- Process each work from manifest ---
    all_work_slugs = sorted(manifest_slugs | disk_work_dirs)

    for work_slug in all_work_slugs:
        # Find title: prefer manifest entry
        title = work_slug  # fallback
        for mw in manifest_works:
            if mw.get("slug") == work_slug:
                title = mw.get("title", work_slug)
                break

        ws = WorkStats(slug=work_slug, title=title)
        work_dir = author_md_dir / work_slug

        if work_dir.is_dir():
            ws.dir_exists = True

            # Count chapter files (exclude _* files)
            chapter_files = [
                f for f in work_dir.rglob("*.md")
                if not f.name.startswith("_")
            ]
            ws.chapter_count = len(chapter_files)
            ws.has_complete_md = (work_dir / "_oeuvre-complete.md").is_file()
            ws.total_bytes = total_size_bytes(work_dir)

            # Warnings: only _oeuvre-complete.md and no chapters
            if ws.has_complete_md and ws.chapter_count == 0:
                ws.warnings.append(
                    f"Only `_oeuvre-complete.md` — no chapter files split yet"
                )

            # Warnings: empty or tiny markdown files
            for md in work_dir.rglob("*.md"):
                size = md.stat().st_size
                if size == 0:
                    ws.warnings.append(f"`{md.name}` is empty (0 bytes)")
                elif size < 100:
                    ws.warnings.append(
                        f"`{md.name}` is very small ({size} bytes)"
                    )

            # Validate _metadata.json if present
            meta_path = work_dir / "_metadata.json"
            if meta_path.is_file():
                err = validate_json_file(meta_path)
                if err:
                    ws.warnings.append(f"`_metadata.json` JSON error: {err}")
        else:
            # Work in manifest but no directory on disk
            ws.warnings.append("Directory not found on disk (split step not run?)")

        # Image count for this work
        work_img_dir = author_img_dir / work_slug
        ws.image_count = count_images_in_dir(work_img_dir)

        stats.works.append(ws)

    # --- Image organisation stats ---
    if author_img_dir.is_dir():
        for item in author_img_dir.iterdir():
            if item.is_file() and item.suffix.lower() in IMAGE_EXTENSIONS:
                stats.unorganised_images += 1
            elif item.is_dir():
                stats.organised_images += count_images_in_dir(item)

    return stats


# ---------------------------------------------------------------------------
# Report rendering helpers
# ---------------------------------------------------------------------------

def _md_table(headers: list[str], rows: list[list[str]]) -> list[str]:
    """Return lines for a markdown pipe table."""
    # Compute column widths
    widths = [len(h) for h in headers]
    for row in rows:
        for i, cell in enumerate(row):
            if i < len(widths):
                widths[i] = max(widths[i], len(cell))

    def _row_line(cells: list[str]) -> str:
        parts = []
        for i, cell in enumerate(cells):
            w = widths[i] if i < len(widths) else len(cell)
            parts.append(cell.ljust(w))
        return "| " + " | ".join(parts) + " |"

    sep = "| " + " | ".join("-" * w for w in widths) + " |"

    lines = [_row_line(headers), sep]
    for row in rows:
        lines.append(_row_line(row))
    return lines


# ---------------------------------------------------------------------------
# Report generation
# ---------------------------------------------------------------------------

def generate_report() -> str:
    lines: list[str] = []

    lines += [
        "# Rapport de conversion — Vox Libris",
        "",
        f"*Généré le : {_today()}*",
        "",
        "---",
        "",
    ]

    # Discover authors
    author_slugs: list[str] = []
    if MARKDOWN_ROOT.is_dir():
        author_slugs = [d.name for d in sorted(MARKDOWN_ROOT.iterdir()) if d.is_dir()]
    # Also include authors with a manifest but no directory yet
    for p in sorted(SCRIPTS_DIR.glob("manifest_*.json")):
        slug = p.stem.replace("manifest_", "", 1)
        if slug not in author_slugs:
            author_slugs.append(slug)

    if not author_slugs:
        lines.append("*Aucun auteur trouvé sous `markdown/`.*")
        return "\n".join(lines)

    all_stats: list[AuthorStats] = []
    for slug in author_slugs:
        all_stats.append(collect_author_stats(slug))

    # -----------------------------------------------------------------------
    # Section 1: Summary table
    # -----------------------------------------------------------------------
    lines += [
        "## 1. Résumé par auteur",
        "",
    ]
    summary_headers = ["Auteur", "Oeuvres (NCX)", "Oeuvres (disque)", "Chapitres total", "Taille totale"]
    summary_rows = []
    for as_ in all_stats:
        total_chapters = sum(w.chapter_count for w in as_.works)
        total_bytes    = sum(w.total_bytes   for w in as_.works)
        summary_rows.append([
            as_.display_name,
            str(as_.manifest_work_count),
            str(as_.actual_work_count),
            str(total_chapters),
            human_size(total_bytes),
        ])
    lines += _md_table(summary_headers, summary_rows)
    lines.append("")

    # -----------------------------------------------------------------------
    # Section 2: Per-work tables
    # -----------------------------------------------------------------------
    lines += [
        "---",
        "",
        "## 2. Détail par oeuvre",
        "",
    ]

    for as_ in all_stats:
        lines += [f"### {as_.display_name}", ""]
        if not as_.works:
            lines += ["*Aucune oeuvre trouvée.*", ""]
            continue

        work_headers = ["Titre", "Slug", "Chapitres", "Taille", "Images", "Statut"]
        work_rows = []
        for ws in as_.works:
            status = "OK" if ws.dir_exists and not ws.warnings else (
                "MANQUANT" if not ws.dir_exists else "⚠ AVERT."
            )
            work_rows.append([
                ws.title,
                ws.slug,
                str(ws.chapter_count) if ws.dir_exists else "—",
                human_size(ws.total_bytes) if ws.dir_exists else "—",
                str(ws.image_count),
                status,
            ])
        lines += _md_table(work_headers, work_rows)
        lines.append("")

    # -----------------------------------------------------------------------
    # Section 3: NCX vs actual comparison
    # -----------------------------------------------------------------------
    lines += [
        "---",
        "",
        "## 3. Comparaison NCX → répertoires générés",
        "",
    ]
    for as_ in all_stats:
        ncx_n    = as_.manifest_work_count
        actual_n = as_.actual_work_count
        match    = "✓" if ncx_n == actual_n else "✗"
        lines.append(
            f"- **{as_.display_name}**: NCX contenait **{ncx_n}** oeuvre(s) → "
            f"**{actual_n}** répertoire(s) généré(s) {match}"
        )
    lines.append("")

    # -----------------------------------------------------------------------
    # Section 4: Warnings
    # -----------------------------------------------------------------------
    lines += [
        "---",
        "",
        "## 4. Avertissements",
        "",
    ]

    has_warnings = False
    for as_ in all_stats:
        for ws in as_.works:
            if ws.warnings:
                has_warnings = True
                for warn in ws.warnings:
                    lines.append(
                        f"- **{as_.display_name} / {ws.title}**: {warn}"
                    )

    # Also flag any _metadata.json at author level that is invalid
    for as_ in all_stats:
        author_meta = MARKDOWN_ROOT / as_.slug / "_metadata.json"
        if author_meta.is_file():
            err = validate_json_file(author_meta)
            if err:
                has_warnings = True
                lines.append(
                    f"- **{as_.display_name}** `_metadata.json` (auteur) JSON error: {err}"
                )

    if not has_warnings:
        lines.append("*Aucun avertissement.*")

    lines.append("")

    # -----------------------------------------------------------------------
    # Section 5: Image summary
    # -----------------------------------------------------------------------
    lines += [
        "---",
        "",
        "## 5. Images",
        "",
    ]
    img_headers = ["Auteur", "Organisées (par oeuvre)", "Non-organisées (racine)", "Total"]
    img_rows = []
    for as_ in all_stats:
        total_img = as_.organised_images + as_.unorganised_images
        img_rows.append([
            as_.display_name,
            str(as_.organised_images),
            str(as_.unorganised_images),
            str(total_img),
        ])
    lines += _md_table(img_headers, img_rows)
    lines.append("")

    # -----------------------------------------------------------------------
    # Section 6: Conversion status / pandoc logs
    # -----------------------------------------------------------------------
    lines += [
        "---",
        "",
        "## 6. Statut de conversion (logs pandoc)",
        "",
    ]
    log_files = sorted(PROJECT_ROOT.glob("*.log")) + sorted(SCRIPTS_DIR.glob("*.log"))
    if log_files:
        for lf in log_files:
            lines.append(f"### `{lf.name}`")
            lines.append("")
            lines.append("```")
            try:
                content = lf.read_text(encoding="utf-8", errors="replace")
                # Truncate very long logs
                if len(content) > 4000:
                    content = content[:4000] + "\n... [truncated]"
                lines.append(content.rstrip())
            except Exception as exc:
                lines.append(f"[Could not read log: {exc}]")
            lines.append("```")
            lines.append("")
    else:
        lines.append("*Aucun fichier log pandoc trouvé.*")
        lines.append("")

    lines += [
        "---",
        "",
        "*Fin du rapport.*",
    ]

    return "\n".join(lines) + "\n"


def _today() -> str:
    """Return today's date as YYYY-MM-DD using the file system (no datetime needed)."""
    import time
    t = time.localtime()
    return f"{t.tm_year:04d}-{t.tm_mon:02d}-{t.tm_mday:02d}"


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    print("Collecting conversion statistics…")
    report = generate_report()

    REPORT_PATH.write_text(report, encoding="utf-8")
    print(f"Report written to _rapport-conversion.md")
    print(f"  ({human_size(REPORT_PATH.stat().st_size)} — {REPORT_PATH})")


if __name__ == "__main__":
    main()
