#!/usr/bin/env python3
"""
07_clean_rag.py
Aggressive cleaning of markdown-rag/ TXT files.

Removes all pandoc/calibre/epub artefacts and leaves only plain prose text
with minimal structure (blank-line paragraphs, headings as plain lines).

Usage:
    python3 scripts/07_clean_rag.py [victor-hugo|emile-zola|jules-verne|all]
"""

import re
import sys
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
RAG_DIR  = BASE_DIR / "markdown-rag"


# ── cleaning pipeline ────────────────────────────────────────────────────────

def clean(text: str) -> str:
    # 1. Preserve YAML front-matter as-is, clean only the body
    if text.startswith("---"):
        end = text.find("\n---", 3)
        if end != -1:
            frontmatter = text[:end + 4]
            body = text[end + 4:]
        else:
            frontmatter, body = "", text
    else:
        frontmatter, body = "", text

    body = _clean_body(body)

    return (frontmatter + "\n\n" + body).strip() + "\n"


def _clean_body(text: str) -> str:
    # ── step 1: remove empty anchors []{#... ...} ────────────────────────────
    text = re.sub(r'\[\]\{[^}]*\}', '', text)

    # ── step 2: remove all image references (decorative ornaments/illustrations)
    # Keep alt text only if it looks like real content (not "Description : ...")
    def replace_image(m):
        alt = m.group(1).strip()
        # Drop pure decorative images
        if re.match(r'(?i)(description\s*:|ornement|vignette|frise|calibre)', alt):
            return ''
        # For real illustrations, keep a placeholder
        return f'[illustration: {alt}]'
    text = re.sub(r'!\[([^\]]*)\]\([^)]*\)(?:\{[^}]*\})?', replace_image, text)

    # ── step 2b: strip pandoc superscript/subscript markers ─────────────────
    # ^text^ → text,  ~text~ → text
    text = re.sub(r'\^([^^]*)\^', r'\1', text)
    text = re.sub(r'~([^~]*)~', r'\1', text)

    # ── step 3: unwrap nested [text]{.class} spans ────────────────────────────
    # Iteratively strip innermost [content]{attributes} until none remain.
    # Handles arbitrary nesting depth.
    span_pat = re.compile(r'\[([^\[\]]*)\]\{[^}]*\}')
    for _ in range(20):  # max 20 nesting levels
        new = span_pat.sub(r'\1', text)
        if new == text:
            break
        text = new

    # ── step 3b: final pass — strip any remaining {.class} attributes ─────────
    text = re.sub(r'\{[.#][^}]*\}', '', text)
    # Remove orphaned bracket constructs that still contain calibre/css refs
    text = re.sub(r'\[([^\[\]]*)\]\{[^}]*\}', r'\1', text)

    # ── step 4: strip {#id .class} heading suffixes ──────────────────────────
    text = re.sub(r'\{#[^}]*\}', '', text)

    # ── step 5: strip {lang="..."} and similar attribute blocks ──────────────
    text = re.sub(r'\{[^}]*=[^}]*\}', '', text)

    # ── step 6: remove pandoc div fences (:::...) ────────────────────────────
    text = re.sub(r'^:{2,}.*$', '', text, flags=re.MULTILINE)

    # ── step 7: remove remaining bare link wrappers that contain no text ─────
    # [[](url)] or [](url)
    text = re.sub(r'\[?\[\]\([^)]*\)\]?', '', text)

    # ── step 8: remove ALL internal epub links ────────────────────────────────
    # Remove entire lines containing internal epub navigation URLs
    text = re.sub(r'^.*index_split_[^\n]*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'^.*filepos[0-9]+[^\n]*$', '', text, flags=re.MULTILINE)
    # Remove remaining [text](url) links → keep text only
    text = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', text)
    # Remove orphaned nested brackets like [[[[35]]]] after link removal
    for _ in range(10):
        new = re.sub(r'\[([^\[\]]*)\]', r'\1', text)
        if new == text:
            break
        text = new

    # ── step 9: unescape pandoc-escaped characters ────────────────────────────
    text = re.sub(r"\\(['\"\\`*_{}()\[\]#.!|~^])", r'\1', text)

    # ── step 10: clean up heading lines ──────────────────────────────────────
    # "## \n" or "### \n" with only whitespace → remove
    text = re.sub(r'^#{1,6}\s*$', '', text, flags=re.MULTILINE)
    # Collapse multiple spaces after # marker in headings
    text = re.sub(r'^(#{1,6})\s+', r'\1 ', text, flags=re.MULTILINE)
    # Strip trailing whitespace from headings
    text = re.sub(r'^(#{1,6}\s+.+?)\s+$', r'\1', text, flags=re.MULTILINE)

    # ── step 11: remove Arvensa boilerplate lines ─────────────────────────────
    arvensa_patterns = [
        r'arvensa',
        r'editions@arvensa',
        r'servicequalite@',
        r'www\.arvensa\.com',
        r'pour toutes (demandes|remarques)',
        r'rendez-vous sur\s*:',
        r'retour [àa] la (table|liste)',
        r'liste (des titres|g[eé]n[eé]rale)',
        r'liste des rougon',
        r'jules verne\s*:\s*oeuvres compl',
        r'[eé]mile zola\s*:\s*oeuvres compl',
        r'victor hugo\s*:\s*oeuvres compl',
        r'les voyages extraordinaires',
        r'fin de ',
        r'isbn epub',
        r'isbn pdf',
    ]
    for pat in arvensa_patterns:
        text = re.sub(r'^.*' + pat + r'.*$', '', text,
                      flags=re.MULTILINE | re.IGNORECASE)

    # ── step 12: remove lines that are just punctuation/symbols noise ─────────
    text = re.sub(r'^[\s\-_=*•·…]+$', '', text, flags=re.MULTILINE)
    # Lines that are only markdown horizontal rules repeated → remove
    text = re.sub(r'^-{3,}$', '', text, flags=re.MULTILINE)

    # ── step 13: collapse excessive blank lines (max 2) ──────────────────────
    text = re.sub(r'\n{3,}', '\n\n', text)

    return text.strip()


# ── file processor ────────────────────────────────────────────────────────────

def process_file(path: Path) -> bool:
    """Clean one TXT file in place. Returns True if content changed."""
    original = path.read_text(encoding="utf-8", errors="replace")
    cleaned  = clean(original)
    if cleaned != original:
        path.write_text(cleaned, encoding="utf-8")
        return True
    return False


def process_author(slug: str) -> None:
    author_dir = RAG_DIR / slug
    if not author_dir.is_dir():
        print(f"  ERROR: {author_dir} not found")
        return

    files   = sorted(author_dir.glob("*.txt"))
    changed = 0
    errors  = 0

    for f in files:
        try:
            if process_file(f):
                changed += 1
        except Exception as e:
            print(f"  ERROR {f.name}: {e}")
            errors += 1

    print(f"  {slug}: {len(files)} fichiers traités, {changed} modifiés, {errors} erreurs")


# ── entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    targets = (
        ["victor-hugo", "emile-zola", "jules-verne"]
        if len(sys.argv) < 2 or sys.argv[1] == "all"
        else sys.argv[1:]
    )
    for slug in targets:
        print(f"Nettoyage {slug}...")
        process_author(slug)
    print("Terminé.")


if __name__ == "__main__":
    main()
