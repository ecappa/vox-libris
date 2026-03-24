# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Goal

Build **Vox Libris**, an AI-powered literary dialogue application that lets users converse with the complete works of Victor Hugo, Emile Zola, and Jules Verne through a RAGFlow-based retrieval-augmented generation system.

The application offers three dialogue modes:

- **Mode Erudit** — scholarly analysis: strictly sourced answers with citations, critical commentary, intertextual references. For researchers, students, and literature enthusiasts.
- **Mode Apprentissage** — guided learning: pedagogical explanations, contextualisation, vocabulary help. For anyone discovering an author's work.
- **Mode Jeune** — youth discovery: accessible language, engaging tone, age-appropriate content. Designed for adolescents and younger readers discovering classic literature for the first time.

## Project Structure

```
vox-libris/
  .env.local                        # Credentials (not versioned)
  .gitignore
  CLAUDE.md                         # This file
  .cursor/skills/ragflow-api/       # RAGFlow API skill for Cursor
  docs/                             # Project documentation
    instruction-ragflow.md          # RAGFlow instance SSH/API/deployment docs
    rapport-conversion.md           # Epub-to-markdown conversion report
  data/                             # All source data and transformations
    epub/                           # Raw Arvensa Editions epubs (~93 MB)
    images/                         # Extracted images by author/work (~87 MB)
    markdown/                       # Structured markdown by author/work/chapter (~333 MB)
    markdown-rag/                   # Flat .txt files for RAGFlow upload (~197 MB)
    scripts/                        # Archived conversion pipeline (Python + JSON manifests) — reference only
```

## Current State

### Completed

- **data/epub/** — Three source epubs from Arvensa Editions (~23-45 MB each): Hugo, Zola, Verne.
- **data/markdown/** — Fully split into per-author / per-work / per-chapter `.md` files:
  - `emile-zola/`: 111 works, 817 files (716 chapters)
  - `jules-verne/`: 99 works, 2125 files (1928 chapters)
  - `victor-hugo/`: 125 works, 126 files (no chapter splits — works stored as single files)
- **data/markdown-rag/** — Flat `.txt` files optimised for RAGFlow upload, with YAML frontmatter:
  - `victor-hugo/`: 125 files (one per work, oeuvre-complete level)
  - `emile-zola/`: 816 files (oeuvre-complete + per-chapter)
  - `jules-verne/`: 2073 files (oeuvre-complete + per-chapter)
- **data/images/** — Extracted images organised by author/work.
- **data/scripts/** — **Archive only.** Historical epub→markdown/RAG pipeline (`01_*.py` … `07_*.py`) and per-author JSON manifests; not maintained for active use. The derived data under `markdown/` and `markdown-rag/` is the source of truth.
- **docs/rapport-conversion.md** — Conversion report with per-author and per-work statistics.

### In Progress

- **RAGFlow dataset "Victor Hugo"** — 125 documents uploaded, indexing in progress (chunking method: `book`, embedding: `text-embedding-3-large@OpenAI`).
- **Metadata** — Documents currently have **empty `meta_fields`** in RAGFlow. Frontmatter exists in the `.txt` files but is not yet mapped to RAGFlow document metadata.

### Not Yet Started

- RAGFlow datasets for Emile Zola and Jules Verne.
- RAGFlow chat assistants (one per author or per mode).
- Prompt design for the three dialogue modes.
- Metadata enrichment in RAGFlow (oeuvre, genre, annee, type).
- Frontend / API integration.
- Retrieval testing and tuning.

## RAGFlow Instance

- **URL**: `https://ragflow.cappasoft.cloud`
- **API base**: `https://ragflow.cappasoft.cloud/api/v1/`
- **Version**: `v0.24.0`
- **Auth**: `Authorization: Bearer $RAGFLOW_ADMIN_API_KEY`
- **Credentials**: stored in `.env.local` (not versioned)

See `docs/instruction-ragflow.md` for full SSH/API/deployment documentation.
See `.cursor/skills/ragflow-api/` for the complete API skill (endpoints, metadata, prompts, quirks).

### Existing Datasets

| Name | ID | Documents | Chunk Method | Status |
|------|----|-----------|--------------|--------|
| Victor Hugo | `14ef8d8e271611f1a5a87db1341041f4` | 125 | book | Indexing |
| cappasoft-demo-production(1) | `e2f67b60130d11f1a5a87db1341041f4` | 0 | naive | Empty |
| cappasoft-demo-playground(1) | `e2f295c2130d11f1a5a87db1341041f4` | 2 | naive | Done |
| Stoneham-optimized | `b6929ad4124711f1a5a87db1341041f4` | 1 | naive | Done |

## File Formats

### data/markdown-rag/ — RAGFlow-ready files

Each `.txt` file has a YAML frontmatter block followed by the literary text:

**Oeuvre-complete level** (one file per work):
```yaml
---
auteur: "Victor Hugo"
slug_auteur: "victor-hugo"
oeuvre: "Les Misérables"
slug_oeuvre: "les-miserables"
type: "oeuvre-complete"
---
```

**Chapter level** (Zola and Verne only):
```yaml
---
auteur: "Émile Zola"
slug_auteur: "emile-zola"
oeuvre: "AU BONHEUR DES DAMES"
slug_oeuvre: "au-bonheur-des-dames"
section: "Chapitre 01"
slug_section: "chapitre-01"
---
```

File naming: `{slug_oeuvre}.txt` for oeuvre-complete, `{slug_oeuvre}--{slug_section}.txt` for chapters.

### data/markdown/ — Structured reference files

Hierarchical: `data/markdown/{author}/{work}/chapitre-NN.md` with `_oeuvre-complete.md` and `_metadata.json` at each level. Multi-tome works have intermediate `tome-N-{slug}/` subdirectories.

## Common Commands

```bash
# Load credentials
export RAGFLOW_ADMIN_API_KEY=$(grep '^RAGFLOW_ADMIN_API_KEY=' .env.local | cut -d= -f2-)
```

For RAGFlow API commands, see the skill at `.cursor/skills/ragflow-api/SKILL.md`.

## Key Reminders

- **`data/scripts/` is archival** — do not assume those scripts are the supported path to regenerate corpus data unless you explicitly revive that workflow.
- These epubs all come from Arvensa Editions and share a similar structure.
- Accents must be stripped for file/folder slugs but preserved in metadata and display values.
- `data/markdown-rag/` is the canonical source for RAGFlow uploads; `data/markdown/` is the structured reference.
- For RAG, chapter-level files are the ideal granularity (Zola and Verne have them; Hugo does not yet).
- Victor Hugo's `data/markdown-rag/` files are oeuvre-complete only (no chapter splits) — this may need revisiting for retrieval quality on large works like Les Misérables.
- RAGFlow v0.24.0 does **not** support the `include_parsing_status` query parameter on datasets.
- Images are NOT needed for RAG indexing but are preserved for potential frontend use.
- Never source `.env.local` with `bash` history expansion enabled — the `!` in `VPS_SSH_PASSWORD` causes issues. Use `set +H` or `grep`-based extraction instead.
