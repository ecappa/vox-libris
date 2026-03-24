#!/usr/bin/env python3
"""
03_cleanup.py — Clean up markdown files in the vox-libris markdown/ tree.

Removes Arvensa navigation boilerplate, pandoc artifacts, normalises headings,
collapses blank lines and ensures each file ends with a single newline.

Usage:
    python3 scripts/03_cleanup.py                   # process all authors
    python3 scripts/03_cleanup.py victor-hugo       # process one author
    python3 scripts/03_cleanup.py emile-zola        # process one author
    python3 scripts/03_cleanup.py jules-verne       # process one author

Run from the project root:
    cd /Users/ecappannelli/devRoot/perso/vox-libris
"""

import re
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Project root — the script lives in scripts/, one level below the root.
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
MARKDOWN_ROOT = PROJECT_ROOT / "markdown"


# ---------------------------------------------------------------------------
# Compiled patterns used for line-level filtering.
# Each pattern is checked against the *stripped* line.
# ---------------------------------------------------------------------------

# Lines that should be dropped entirely (case-insensitive where noted).
_REMOVE_LINE_PATTERNS: list[re.Pattern] = [
    # --- Arvensa branding / contact ---
    re.compile(r"ARVENSA\s*[ÉE]DITIONS", re.IGNORECASE),
    re.compile(r"arvensa\.com", re.IGNORECASE),
    re.compile(r"servicequalite@", re.IGNORECASE),
    re.compile(r"editions@arvensa", re.IGNORECASE),
    re.compile(r"Pour\s+toutes\s+remarques", re.IGNORECASE),
    re.compile(r"rendez-vous\s+sur", re.IGNORECASE),

    # --- Navigation links ---
    re.compile(r"Retour\s+[àa]\s+la\s+table\s+des\s+mati[eè]res", re.IGNORECASE),
    re.compile(r"Retour\s+[àa]\s+la\s+liste\s+des\s+titres", re.IGNORECASE),
    re.compile(r"Retour\s+[àa]\s+la\s+table", re.IGNORECASE),
    re.compile(r"Retour\s+[àa]\s+la\s+liste", re.IGNORECASE),
    re.compile(r"Liste\s+des\s+Rougon-Macquart", re.IGNORECASE),
    re.compile(r"Liste\s+g[ée]n[ée]rale\s+des\s+titres", re.IGNORECASE),
    re.compile(r"Liste\s+des\s+titres", re.IGNORECASE),
    # Inline nav links whose entire visible text is "Table des matières"
    # e.g. [[[Table des matières]{...}](url)]{...}   or  [[Table des matières](url)]
    re.compile(r"^\[.*Table\s+des\s+mati[eè]res.*\]\(", re.IGNORECASE),
    re.compile(r"^\[+\[Table\s+des\s+mati[eè]res", re.IGNORECASE),
    # Arvensa branding line inside paragraphs (line 36 of Verne)
    re.compile(r"l'objectif\s+des\s+[ée]ditions\s+arvensa", re.IGNORECASE),

    # --- Collection headers used as nav lines ---
    re.compile(r"Jules\s+Verne\s*:\s*Oeuvres\s+compl[eè]tes", re.IGNORECASE),
    re.compile(r"[ÉE]mile\s+Zola\s*:\s*Oeuvres\s+compl[eè]tes", re.IGNORECASE),
    re.compile(r"Victor\s+Hugo\s*:\s*Oeuvres\s+compl[eè]tes", re.IGNORECASE),

    # "LES VOYAGES EXTRAORDINAIRES" / "LES ROUGON-MACQUART" used as standalone nav
    # (match lines that contain ONLY this text, possibly wrapped in markdown heading markers)
    re.compile(r"^#{0,6}\s*LES\s+VOYAGES\s+EXTRAORDINAIRES\s*$", re.IGNORECASE),
    re.compile(r"^#{0,6}\s*LES\s+ROUGON-MACQUART\s*$", re.IGNORECASE),

    # --- "FIN de <titre>" lines ---
    re.compile(r"\bFIN\s+de\s+", re.IGNORECASE),

    # --- Ornament image references ---
    # Matches  ![frisehorizontale](...)  or  ![ frisehorizontale ](...)
    re.compile(r"!\[.*frisehorizontale.*\]\(", re.IGNORECASE),

    # --- Pandoc div markers ---
    re.compile(r"^:::\s*(\{.*\})?\s*$"),
]

# Pattern: a line that is ONLY a backslash (pandoc hard-line-break artifact).
_ONLY_BACKSLASH = re.compile(r"^\\\s*$")

# Pattern: trailing backslash at end of line (pandoc line-break marker).
_TRAILING_BACKSLASH = re.compile(r"\s*\\$")

# Pattern: empty markdown link  [](some/path)
_EMPTY_MD_LINK = re.compile(r"\[\]\([^)]*\)")

# Headings of level 4+ that look like chapter titles → remap to ###
_DEEP_HEADING = re.compile(r"^#{4,}\s+")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _should_remove_line(stripped_line: str) -> bool:
    """Return True if the line matches any removal pattern."""
    for pattern in _REMOVE_LINE_PATTERNS:
        if pattern.search(stripped_line):
            return True
    # A line that is just a backslash (pandoc artifact)
    if _ONLY_BACKSLASH.match(stripped_line):
        return True
    return False


def _process_line(raw_line: str) -> str | None:
    """
    Apply per-line transformations.

    Returns the cleaned line (without trailing newline), or None to signal
    that the line should be dropped entirely.
    """
    # Strip trailing whitespace / newline, keep leading (for code blocks etc.)
    line = raw_line.rstrip()

    # Strip leading whitespace too (per spec)
    stripped = line.strip()

    # --- Drop lines matching removal patterns ---
    if _should_remove_line(stripped):
        return None

    # --- Remove empty markdown links ---
    line = _EMPTY_MD_LINK.sub("", line)
    stripped = line.strip()

    # After removing empty links the line might become blank — keep it as blank
    # so the blank-line collapse logic can handle it.

    # --- Normalize heading depth ---
    if _DEEP_HEADING.match(stripped):
        # Replace 4+ # with exactly ### (keep the rest of the heading text)
        line = _DEEP_HEADING.sub("### ", stripped)
        return line

    # --- Strip trailing backslash (line-break artifact) on non-blank lines ---
    if stripped:
        line = _TRAILING_BACKSLASH.sub("", line)

    # Return stripped line as specified
    return line.strip()


def clean_file(filepath: Path) -> bool:
    """
    Read, clean and overwrite *filepath*.

    Returns True if the file was modified, False if it was already clean
    (or on error).
    """
    try:
        original_text = filepath.read_text(encoding="utf-8")
    except Exception as exc:
        print(f"  ERROR reading {filepath}: {exc}")
        return False

    raw_lines = original_text.splitlines()
    processed: list[str] = []

    for raw in raw_lines:
        result = _process_line(raw)
        if result is None:
            # Drop the line
            continue
        processed.append(result)

    # --- Collapse 3+ consecutive blank lines → exactly 2 blank lines ---
    collapsed: list[str] = []
    blank_run = 0
    for line in processed:
        if line == "":
            blank_run += 1
            if blank_run <= 2:
                collapsed.append(line)
        else:
            blank_run = 0
            collapsed.append(line)

    # --- Ensure file ends with exactly one newline ---
    # Strip trailing blank lines, then add a single trailing newline.
    while collapsed and collapsed[-1] == "":
        collapsed.pop()

    new_text = "\n".join(collapsed) + "\n"

    if new_text == original_text:
        return False  # No change needed

    filepath.write_text(new_text, encoding="utf-8")
    return True


def process_author(author_slug: str) -> int:
    """
    Clean all .md files under markdown/<author_slug>/.

    Returns the count of files actually modified.
    """
    author_dir = MARKDOWN_ROOT / author_slug
    if not author_dir.is_dir():
        print(f"WARNING: directory not found: {author_dir}")
        return 0

    cleaned = 0
    # rglob picks up files at any depth under the author directory
    md_files = sorted(author_dir.rglob("*.md"))

    if not md_files:
        print(f"  No .md files found under {author_dir}")
        return 0

    for filepath in md_files:
        modified = clean_file(filepath)
        if modified:
            print(f"  Cleaned: {filepath}")
            cleaned += 1

    return cleaned


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    args = sys.argv[1:]

    if args:
        # Validate slug(s) supplied on the command line
        author_slugs = args
    else:
        # Process all author directories that exist under markdown/
        if not MARKDOWN_ROOT.is_dir():
            print(f"ERROR: markdown/ directory not found at {MARKDOWN_ROOT}")
            sys.exit(1)
        author_slugs = [
            d.name for d in sorted(MARKDOWN_ROOT.iterdir()) if d.is_dir()
        ]
        if not author_slugs:
            print("No author directories found under markdown/. Nothing to do.")
            sys.exit(0)

    total_cleaned = 0

    for slug in author_slugs:
        print(f"\nProcessing author: {slug}")
        count = process_author(slug)
        print(f"  → {count} file(s) cleaned for {slug}")
        total_cleaned += count

    print(f"\nDone. Total files cleaned: {total_cleaned}")


if __name__ == "__main__":
    main()
