# RAGFlow API — Reference

## Metadata Schema for Vox Libris

Target metadata fields per document in RAGFlow:

| Field | Type | Source | Example | Purpose |
|-------|------|--------|---------|---------|
| `auteur` | string | frontmatter | `Victor Hugo` | Filter by author |
| `oeuvre` | string | frontmatter | `Les Misérables` | Filter by work |
| `slug_oeuvre` | string | frontmatter | `les-miserables` | Programmatic filtering |
| `type` | string | frontmatter | `oeuvre-complete` / `chapitre` | Granularity control |
| `section` | string | frontmatter | `Chapitre 01` | Chapter-level filter |
| `genre` | string | to enrich | `roman`, `poesie`, `theatre`, `essai`, `correspondance` | Genre filtering |
| `annee` | string | to enrich | `1862` | Date filtering |
| `periode` | string | to enrich | `exil`, `jeunesse`, `maturite` | Thematic grouping |

### Setting Metadata via API

Use `PUT /api/v1/datasets/{dataset_id}/documents/{document_id}` — no documented batch metadata endpoint exists in v0.24.
Metadata can also be auto-extracted by LLM via the RAGFlow UI (Manage Metadata page).

### Metadata Filtering in Retrieval

Both `POST /retrieval` and `POST /chats/{chat_id}/completions` accept `metadata_condition`:

```json
{
  "metadata_condition": {
    "logic": "and",
    "conditions": [
      {"name": "oeuvre", "comparison_operator": "=", "value": "Les Misérables"},
      {"name": "genre", "comparison_operator": "=", "value": "roman"}
    ]
  }
}
```

Operators: `=`, `!=` (or `≠`), `>`, `<`, `>=` (or `≥`), `<=` (or `≤`), `contains`, `not contains`, `start with`, `empty`, `not empty`.

Three filtering modes (configurable per assistant in the UI):
- **Automatic**: system infers filters from query + existing metadata
- **Semi-automatic**: user predefines field scope, system filters within it
- **Manual**: explicit conditions passed in API call

## Retrieval Tuning

### Hybrid Search

RAGFlow combines keyword (BM25) and vector similarity. The balance is controlled by:

- `vector_similarity_weight` (default 0.3) — weight of vector cosine similarity
- `1 - vector_similarity_weight` (default 0.7) — weight of keyword similarity
- If a `rerank_model` is set, vector similarity is replaced by reranker score

### Key Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `similarity_threshold` | 0.2 | Minimum hybrid score to include a chunk |
| `vector_similarity_weight` | 0.3 | Vector vs keyword balance |
| `top_k` | 1024 | Chunks considered for computation |
| `top_n` | 6 | Chunks sent to LLM |
| `keyword` | false | Enable keyword matching |
| `highlight` | false | Highlight matched terms |
| `use_kg` | false | Use knowledge graph (requires built graph) |
| `toc_enhance` | false | Use extracted table of contents |
| `cross_languages` | [] | Translate query for cross-language search |

### Tuning Workflow

1. Upload and parse documents
2. Run retrieval tests via `POST /retrieval` with representative questions
3. Adjust `similarity_threshold` and `vector_similarity_weight`
4. Optionally add a rerank model
5. Apply the tuned values to the chat assistant configuration

## Chat Assistant Prompt Design

### Reserved Variable

`{knowledge}` is injected by RAGFlow with retrieved chunks. Always include it in the system prompt.

### Custom Variables

Declare in `prompt.variables`, pass values in completions body. Example:

```json
"variables": [
  {"key": "knowledge", "optional": true},
  {"key": "mode", "optional": true}
]
```

Call with:
```json
{"question": "...", "mode": "erudit"}
```

### Prompt Template — Vox Libris

```text
Tu es un assistant littéraire spécialisé dans l'œuvre de {auteur}.

Mode actuel : {mode}

Si le mode est "erudit" :
- Réponds de manière académique et précise.
- Cite systématiquement les passages pertinents du corpus.
- Fais des liens intertextuels quand c'est pertinent.
- Si l'information n'est pas dans le corpus, dis-le explicitement.

Si le mode est "apprentissage" :
- Explique de manière pédagogique et accessible.
- Contextualise historiquement et littérairement.
- Définis le vocabulaire complexe ou archaïque.
- Propose des pistes de réflexion.

Si le mode est "jeune" :
- Utilise un langage simple et engageant, adapté à un·e adolescent·e.
- Évite le jargon littéraire sauf pour l'expliquer.
- Rends l'auteur vivant et ses œuvres intéressantes.
- Fais des parallèles avec le monde contemporain quand c'est possible.

Dans tous les modes :
- Appuie-toi exclusivement sur le corpus fourni ci-dessous.
- Ne fabrique jamais de citations ou de passages.
- Indique toujours l'œuvre source de tes réponses.

Voici les extraits du corpus :
{knowledge}
```

### Empty Response

Set `empty_response` to a message like:
```
Je n'ai pas trouvé d'information pertinente dans le corpus pour répondre à cette question.
```
This prevents hallucination when no relevant chunks are retrieved.

## Existing Datasets

| Name | ID | Documents | Chunk Method |
|------|----|-----------|--------------|
| Victor Hugo | `14ef8d8e271611f1a5a87db1341041f4` | 125 | book |
| cappasoft-demo-production(1) | `e2f67b60130d11f1a5a87db1341041f4` | 0 | naive |
| cappasoft-demo-playground(1) | `e2f295c2130d11f1a5a87db1341041f4` | 2 | naive |
| Stoneham-optimized | `b6929ad4124711f1a5a87db1341041f4` | 1 | naive |

## Chunking Methods for Literature

| Method | Best For | Notes |
|--------|----------|-------|
| `book` | Long-form literary works (novels, essays) | Respects chapter/section structure |
| `naive` | Short documents, mixed content | Token-count based, less structure-aware |
| `one` | Very short texts (poems, letters) | Entire document = one chunk |

For Vox Libris:
- **Oeuvre-complete files** (one per work): use `book` — lets RAGFlow split by structure
- **Chapter files** (one per chapter): `book` or `naive` both work — document is already a natural chunk
- Short works (poems, letters, speeches): consider `one`
