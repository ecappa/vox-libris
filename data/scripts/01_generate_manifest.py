#!/usr/bin/env python3
"""
01_generate_manifest.py
Parse OPF spine + NCX toc for each epub and produce manifest_<slug>.json.

Usage: python3 scripts/01_generate_manifest.py [victor-hugo|emile-zola|jules-verne|all]
"""

import xml.etree.ElementTree as ET
import json
import re
import sys
import unicodedata
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
SCRIPTS_DIR = BASE_DIR / "scripts"
EXTRACT_BASE = Path("/tmp/epub_extract")
NCX_NS = "http://www.daisy.org/z3986/2005/ncx/"
OPF_NS = "http://www.idpf.org/2007/opf"

# Front-matter titles to mark (not real works)
FRONT_MATTER_TITLES = {
    "ARVENSA ÉDITIONS", "ARVENSA EDITIONS",
    "NOTE DE L\u2019ÉDITEUR", "NOTE DE L'ÉDITEUR", "NOTE DE L EDITEUR",
    "LISTE DES TITRES",
}

# Zola group headers (depth-1 items that are section labels, not works)
ZOLA_GROUP_HEADERS = {
    "LES ROUGON-MACQUART", "LES ROMANS", "THÉÂTRE", "THEATRE",
    "CONTES ET NOUVELLES", "ÉTUDES BIOGRAPHIQUES ET CRITIQUES",
    "ETUDES BIOGRAPHIQUES ET CRITIQUES",
    "ÉLOGES ET DISCOURS", "ELOGES ET DISCOURS",
    "OEUVRE POÉTIQUE ET LYRIQUE", "OEUVRE POETIQUE ET LYRIQUE",
    "CORRESPONDANCE", "ANNEXES",
}

AUTHORS = {
    "victor-hugo": {
        "extract_dir": EXTRACT_BASE / "hugo",
        "oebps": "",          # no OEBPS subdir
        "ncx_rel": "toc.ncx",
        "opf_rel": "content.opf",
        "html_dir_rel": "",   # html files at root
        "full_name": "Victor Hugo",
        "source": "victor-hugo-oeuvres-completes.epub",
    },
    "emile-zola": {
        "extract_dir": EXTRACT_BASE / "zola",
        "oebps": "OEBPS",
        "ncx_rel": "OEBPS/toc.ncx",
        "opf_rel": "OEBPS/content.opf",
        "html_dir_rel": "OEBPS/Text",
        "full_name": "Emile Zola",
        "source": "emile-zola-oeuvres-completes.epub",
    },
    "jules-verne": {
        "extract_dir": EXTRACT_BASE / "verne",
        "oebps": "OEBPS",
        "ncx_rel": "OEBPS/toc.ncx",
        "opf_rel": "OEBPS/content.opf",
        "html_dir_rel": "OEBPS/Text",
        "full_name": "Jules Verne",
        "source": "jules-verne-oeuvres-completes.epub",
    },
}


def slugify(text):
    """Lowercase, strip accents, replace non-alphanumeric with hyphens."""
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = text.lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-")


def parse_opf_spine(opf_path, extract_dir):
    """
    Parse OPF manifest + spine.
    Returns ordered list of absolute file paths (HTML/XHTML only).
    """
    tree = ET.parse(opf_path)
    root = tree.getroot()

    opf_dir = opf_path.parent

    # Build id → href map from manifest
    id_to_href = {}
    for item in root.iter(f"{{{OPF_NS}}}item"):
        item_id = item.get("id")
        href = item.get("href", "")
        media_type = item.get("media-type", "")
        if item_id and href and ("html" in media_type or "xhtml" in media_type):
            abs_path = (opf_dir / href).resolve()
            id_to_href[item_id] = str(abs_path)

    # Build spine in order
    spine = []
    seen = set()
    for itemref in root.iter(f"{{{OPF_NS}}}itemref"):
        idref = itemref.get("idref", "")
        if idref in id_to_href:
            path = id_to_href[idref]
            if path not in seen:
                spine.append(path)
                seen.add(path)

    return spine


def parse_ncx_flat(ncx_path, extract_dir):
    """
    Parse NCX and return ALL navPoints as a flat list sorted by playOrder.
    Each entry: {title, src_abs, play_order, depth}
    src_abs = absolute path to the HTML file (fragment stripped).
    """
    tree = ET.parse(ncx_path)
    root = tree.getroot()
    ncx_dir = ncx_path.parent

    nav_map = root.find(f"{{{NCX_NS}}}navMap")
    if nav_map is None:
        return []

    points = []

    def walk(node, depth=1):
        for np in node.findall(f"{{{NCX_NS}}}navPoint"):
            label_el = np.find(f".//{{{NCX_NS}}}text")
            content_el = np.find(f"{{{NCX_NS}}}content")
            title = label_el.text.strip() if label_el is not None and label_el.text else ""
            src = content_el.get("src", "") if content_el is not None else ""
            play_order = int(np.get("playOrder", 0))

            # Strip fragment
            src_file = src.split("#")[0] if src else ""
            if src_file:
                abs_path = str((ncx_dir / src_file).resolve())
            else:
                abs_path = ""

            points.append({
                "title": title,
                "src_abs": abs_path,
                "play_order": play_order,
                "depth": depth,
            })
            walk(np, depth + 1)

    walk(nav_map)
    points.sort(key=lambda p: p["play_order"])
    return points


def spine_index(spine, abs_path):
    """Return index of abs_path in spine, or -1 if not found."""
    try:
        return spine.index(abs_path)
    except ValueError:
        # Try resolving differently
        for i, s in enumerate(spine):
            if Path(s).name == Path(abs_path).name:
                return i
        return -1


def is_front_matter(title):
    normalized = title.strip().upper()
    return normalized in FRONT_MATTER_TITLES or normalized.startswith("ARVENSA")


def is_back_matter(title):
    keywords = ["BIOGRAPHIE", "DESSINS", "TESTAMENT", "ANNOTATIONS"]
    t = title.strip().upper()
    return any(t.startswith(k) for k in keywords)


def build_hugo_manifest(slug, cfg):
    """
    Hugo: flat NCX (all 130 navPoints as flat list).
    Detect LES MISERABLES tomes and group them.
    Works are NCX entries; no chapter-level NCX info.
    """
    extract_dir = cfg["extract_dir"]
    ncx_path = extract_dir / cfg["ncx_rel"]
    opf_path = extract_dir / cfg["opf_rel"]

    spine = parse_opf_spine(opf_path, extract_dir)
    ncx_points = parse_ncx_flat(ncx_path, extract_dir)

    print(f"  Hugo: {len(spine)} spine files, {len(ncx_points)} NCX points")

    # Assign file ranges using spine positions
    works_raw = []
    for i, pt in enumerate(ncx_points):
        idx = spine_index(spine, pt["src_abs"])
        next_idx = len(spine)
        if i + 1 < len(ncx_points):
            next_idx_candidate = spine_index(spine, ncx_points[i + 1]["src_abs"])
            if next_idx_candidate > idx:
                next_idx = next_idx_candidate

        works_raw.append({
            "title": pt["title"],
            "play_order": pt["play_order"],
            "spine_start": idx,
            "spine_end_exclusive": next_idx,
            "files": spine[idx:next_idx] if idx >= 0 else [],
        })

    # Group LES MISERABLES tomes into one work
    works = []
    les_mis_tomes = []
    les_mis_pattern = re.compile(r"LES MIS[ÉE]RABLES", re.IGNORECASE)

    for w in works_raw:
        if les_mis_pattern.search(w["title"]):
            les_mis_tomes.append(w)
        else:
            if les_mis_tomes:
                # Flush grouped tomes
                works.append(_make_les_mis_work(les_mis_tomes, slug))
                les_mis_tomes = []
            works.append({
                "title": w["title"],
                "slug": slugify(w["title"]),
                "is_front_matter": is_front_matter(w["title"]),
                "is_back_matter": is_back_matter(w["title"]),
                "spine_start": w["spine_start"],
                "spine_end_exclusive": w["spine_end_exclusive"],
                "files": w["files"],
                "sections": [],  # Hugo has no chapter-level NCX
            })

    if les_mis_tomes:
        works.append(_make_les_mis_work(les_mis_tomes, slug))

    return {
        "author": cfg["full_name"],
        "slug": slug,
        "source": cfg["source"],
        "spine": spine,
        "works": works,
    }


def _make_les_mis_work(tomes, author_slug):
    """Group LES MISERABLES tomes into one work with sections."""
    sections = []
    all_files = []
    for t in tomes:
        # Extract tome label (e.g., "tome 1 – Fantine" from full title)
        title_clean = t["title"]
        # Remove the "LES MISERABLES" prefix
        m = re.search(r"[-–]\s*(.+)$", title_clean)
        section_title = m.group(1).strip() if m else title_clean
        sections.append({
            "title": section_title,
            "slug": slugify(section_title),
            "spine_start": t["spine_start"],
            "spine_end_exclusive": t["spine_end_exclusive"],
            "files": t["files"],
            "subsections": [],
        })
        all_files.extend(t["files"])

    return {
        "title": "Les Misérables",
        "slug": "les-miserables",
        "is_front_matter": False,
        "is_back_matter": False,
        "spine_start": tomes[0]["spine_start"],
        "spine_end_exclusive": tomes[-1]["spine_end_exclusive"],
        "files": all_files,
        "sections": sections,
    }


def build_zola_manifest(slug, cfg):
    """
    Zola: flat NCX where group headers and works are siblings at depth-1.
    depth-2 children = chapters/parts (named sections of a work).
    Spine order is reliable and sequential.
    """
    extract_dir = cfg["extract_dir"]
    ncx_path = extract_dir / cfg["ncx_rel"]
    opf_path = extract_dir / cfg["opf_rel"]

    spine = parse_opf_spine(opf_path, extract_dir)
    ncx_points = parse_ncx_flat(ncx_path, extract_dir)

    print(f"  Zola: {len(spine)} spine files, {len(ncx_points)} NCX points")

    # Separate depth-1 from depth-2
    depth1 = [p for p in ncx_points if p["depth"] == 1]
    depth2_map = {}  # play_order of parent → list of depth-2 children
    # We need to reconstruct parent-child from the flat list
    # Approach: depth-2 points belong to the most recent depth-1 point before them
    current_parent_order = None
    for p in ncx_points:
        if p["depth"] == 1:
            current_parent_order = p["play_order"]
            depth2_map[current_parent_order] = []
        elif p["depth"] == 2 and current_parent_order is not None:
            depth2_map[current_parent_order].append(p)

    works = []
    depth1_work_indices = []  # indices of actual works (not group headers)

    for i, pt in enumerate(depth1):
        title_upper = pt["title"].strip().upper()
        # Skip group headers and front matter
        is_group = title_upper in ZOLA_GROUP_HEADERS
        is_fm = is_front_matter(pt["title"])

        idx = spine_index(spine, pt["src_abs"])
        next_work_idx = len(spine)
        # Find next depth-1 entry for end boundary
        if i + 1 < len(depth1):
            next_idx = spine_index(spine, depth1[i + 1]["src_abs"])
            if next_idx > idx:
                next_work_idx = next_idx

        children = depth2_map.get(pt["play_order"], [])
        sections = _build_sections(children, spine, next_work_idx)

        works.append({
            "title": pt["title"],
            "slug": slugify(pt["title"]),
            "is_front_matter": is_fm,
            "is_back_matter": False,
            "is_group_header": is_group,
            "spine_start": idx,
            "spine_end_exclusive": next_work_idx,
            "files": spine[idx:next_work_idx] if idx >= 0 else [],
            "sections": sections,
        })

    return {
        "author": cfg["full_name"],
        "slug": slug,
        "source": cfg["source"],
        "spine": spine,
        "works": works,
    }


def _build_sections(children, spine, work_end_idx):
    """Build section entries from depth-2 NCX children."""
    sections = []
    for j, child in enumerate(children):
        c_idx = spine_index(spine, child["src_abs"])
        c_end = work_end_idx
        if j + 1 < len(children):
            next_c_idx = spine_index(spine, children[j + 1]["src_abs"])
            if next_c_idx > c_idx:
                c_end = next_c_idx
        sections.append({
            "title": child["title"],
            "slug": slugify(child["title"]),
            "spine_start": c_idx,
            "spine_end_exclusive": c_end,
            "files": spine[c_idx:c_end] if c_idx >= 0 else [],
            "subsections": [],
        })
    return sections


def build_verne_manifest(slug, cfg):
    """
    Verne: 13 mixed prefix groups. OPF spine is the ONLY reliable order.
    depth-1 = works, depth-2 = named parts or chapters.
    h3 sub-chapters (sigil_not_in_toc) are NOT in NCX — handled during build step.
    """
    extract_dir = cfg["extract_dir"]
    ncx_path = extract_dir / cfg["ncx_rel"]
    opf_path = extract_dir / cfg["opf_rel"]

    spine = parse_opf_spine(opf_path, extract_dir)
    ncx_points = parse_ncx_flat(ncx_path, extract_dir)

    print(f"  Verne: {len(spine)} spine files, {len(ncx_points)} NCX points")

    depth1 = [p for p in ncx_points if p["depth"] == 1]
    # reconstruct parent-child
    current_parent_order = None
    depth2_map = {}
    for p in ncx_points:
        if p["depth"] == 1:
            current_parent_order = p["play_order"]
            depth2_map[current_parent_order] = []
        elif p["depth"] == 2 and current_parent_order is not None:
            depth2_map[current_parent_order].append(p)

    # Deduplicate spine: for files that appear both as .xhtml and .htm, keep first occurrence
    # (The OPF spine already handles this — we just use it as-is)

    works = []
    for i, pt in enumerate(depth1):
        idx = spine_index(spine, pt["src_abs"])
        next_work_idx = len(spine)
        if i + 1 < len(depth1):
            next_idx = spine_index(spine, depth1[i + 1]["src_abs"])
            if next_idx > idx:
                next_work_idx = next_idx

        children = depth2_map.get(pt["play_order"], [])

        # Determine if depth-2 children are "parts" (have further h3 chapters)
        # or "chapters" directly. Heuristic: if title contains "partie", "tome", "volume" → part
        sections = _build_verne_sections(children, spine, next_work_idx)

        works.append({
            "title": pt["title"],
            "slug": slugify(pt["title"]),
            "is_front_matter": is_front_matter(pt["title"]),
            "is_back_matter": is_back_matter(pt["title"]),
            "spine_start": idx,
            "spine_end_exclusive": next_work_idx,
            "files": spine[idx:next_work_idx] if idx >= 0 else [],
            "sections": sections,
        })

    return {
        "author": cfg["full_name"],
        "slug": slug,
        "source": cfg["source"],
        "spine": spine,
        "works": works,
    }


def _is_part_title(title):
    """Return True if this section title represents a part/tome (not a chapter)."""
    t = title.strip().lower()
    part_keywords = [
        "première partie", "deuxième partie", "troisième partie",
        "quatrième partie", "cinquième partie", "sixième partie",
        "premiere partie", "deuxieme partie", "troisieme partie",
        "quatrieme partie", "cinquieme partie", "sixieme partie",
        "partie i", "partie ii", "partie iii", "partie iv",
        "tome i", "tome ii", "tome iii", "tome iv",
        "volume i", "volume ii", "volume iii",
        "première époque", "deuxième époque", "troisième époque",
        "livre i", "livre ii", "livre iii", "livre iv",
    ]
    return any(t.startswith(kw) or t == kw for kw in part_keywords)


def _build_verne_sections(children, spine, work_end_idx):
    """Build sections for a Verne work. Sections may be parts or direct chapters."""
    # Filter out "Table des matières" entries
    real_children = [c for c in children
                     if "table des matières" not in c["title"].lower()
                     and "table des matieres" not in c["title"].lower()]

    sections = []
    for j, child in enumerate(real_children):
        c_idx = spine_index(spine, child["src_abs"])
        c_end = work_end_idx
        if j + 1 < len(real_children):
            next_c_idx = spine_index(spine, real_children[j + 1]["src_abs"])
            if next_c_idx > c_idx:
                c_end = next_c_idx

        is_part = _is_part_title(child["title"])
        sections.append({
            "title": child["title"],
            "slug": slugify(child["title"]),
            "is_part": is_part,  # if True, h3 chapters will be detected during build
            "spine_start": c_idx,
            "spine_end_exclusive": c_end,
            "files": spine[c_idx:c_end] if c_idx >= 0 else [],
            "subsections": [],
        })
    return sections


def generate_manifest(slug):
    cfg = AUTHORS[slug]
    extract_dir = cfg["extract_dir"]

    if not extract_dir.exists():
        print(f"ERROR: {extract_dir} not found. Run unzip first.")
        return

    print(f"Generating manifest for {slug}...")

    if slug == "victor-hugo":
        manifest = build_hugo_manifest(slug, cfg)
    elif slug == "emile-zola":
        manifest = build_zola_manifest(slug, cfg)
    elif slug == "jules-verne":
        manifest = build_verne_manifest(slug, cfg)
    else:
        print(f"Unknown slug: {slug}")
        return

    # Count real works (not front/back matter, not group headers)
    real_works = [w for w in manifest["works"]
                  if not w.get("is_front_matter") and not w.get("is_back_matter")
                  and not w.get("is_group_header")]
    print(f"  → {len(real_works)} works (excluding front/back matter)")

    output_path = SCRIPTS_DIR / f"manifest_{slug}.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"  → Manifest saved to {output_path}")


def main():
    if len(sys.argv) < 2 or sys.argv[1] == "all":
        targets = list(AUTHORS.keys())
    else:
        targets = [sys.argv[1]]

    for slug in targets:
        if slug not in AUTHORS:
            print(f"Unknown author: {slug}. Choose from: {list(AUTHORS.keys())}")
            continue
        generate_manifest(slug)


if __name__ == "__main__":
    main()
