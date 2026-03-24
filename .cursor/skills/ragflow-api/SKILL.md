---
name: ragflow-api
description: >-
  Interact with the RAGFlow v0.24 instance via REST API: manage datasets,
  documents, metadata, chat assistants, retrieval, and sessions. Use when
  working with RAGFlow, uploading documents, creating assistants, running
  retrieval tests, managing metadata, or checking indexing status.
---

# RAGFlow API — Vox Libris

## Instance

| Key | Value |
|-----|-------|
| Base URL | `https://ragflow.cappasoft.cloud` |
| API root | `https://ragflow.cappasoft.cloud/api/v1/` |
| Version | `v0.24.0` |
| Auth header | `Authorization: Bearer $RAGFLOW_ADMIN_API_KEY` |
| Credentials | `.env.local` (never versioned) |

Load the API key safely (avoid `source .env.local` — `!` in other vars breaks bash history expansion):

```bash
export RAGFLOW_ADMIN_API_KEY=$(grep '^RAGFLOW_ADMIN_API_KEY=' .env.local | cut -d= -f2-)
```

## API Quick Reference

All endpoints below are relative to `https://ragflow.cappasoft.cloud/api/v1/`.
Success responses have `"code": 0`. Any other code is an error.

### Datasets

```bash
# List all datasets
curl -sS -G "$BASE/datasets" \
  --data-urlencode "page=1" --data-urlencode "page_size=100" \
  -H "Authorization: Bearer $KEY"

# Create dataset
curl -X POST "$BASE/datasets" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"name":"My Dataset","chunk_method":"book","language":"French"}'

# Update dataset
curl -X PUT "$BASE/datasets/{dataset_id}" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"name":"New Name"}'

# Delete datasets
curl -X DELETE "$BASE/datasets" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"ids":["id1","id2"]}'
```

**Chunk methods**: `naive`, `book`, `qa`, `manual`, `paper`, `laws`, `presentation`, `table`, `one`, `tag`.
For literary text, use `book`.

### Documents

```bash
# List documents in dataset
curl -sS -G "$BASE/datasets/{dataset_id}/documents" \
  --data-urlencode "page=1" --data-urlencode "page_size=200" \
  -H "Authorization: Bearer $KEY"

# Upload documents
curl -X POST "$BASE/datasets/{dataset_id}/documents" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: multipart/form-data" \
  --form "file=@./data/markdown-rag/victor-hugo/les-miserables.txt"

# Update document metadata/settings
curl -X PUT "$BASE/datasets/{dataset_id}/documents/{document_id}" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"name":"new-name.txt","chunk_method":"book"}'

# Delete all documents in dataset
curl -X DELETE "$BASE/datasets/{dataset_id}/documents" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"delete_all":true}'

# Delete specific documents
curl -X DELETE "$BASE/datasets/{dataset_id}/documents" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"ids":["doc_id_1","doc_id_2"]}'
```

**Document `run` field values**: `UNSTART`, `RUNNING`, `DONE`, `FAIL`, `CANCEL`.
To check indexing progress, list documents and count by `run` status.

### Metadata

Documents have a `meta_fields` object. Set metadata via document update or the metadata management API.
Metadata enables per-query filtering during retrieval and chat.

For details on auto-extraction and management, see [reference.md](reference.md).

### Chat Assistants

```bash
# Create assistant
curl -X POST "$BASE/chats" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{
    "name": "Victor Hugo — Érudit",
    "dataset_ids": ["dataset_id"],
    "llm": {
      "model_name": "gpt-4",
      "temperature": 0.1,
      "top_p": 0.3,
      "frequency_penalty": 0.7
    },
    "prompt": {
      "prompt": "System prompt with {knowledge} and {mode}...",
      "variables": [
        {"key": "knowledge", "optional": true},
        {"key": "mode", "optional": true}
      ],
      "similarity_threshold": 0.2,
      "keywords_similarity_weight": 0.7,
      "top_n": 6,
      "empty_response": "Je ne trouve pas cette information dans le corpus.",
      "opener": "Bienvenue. Interrogez-moi sur les œuvres de Victor Hugo.",
      "show_quote": true
    }
  }'

# List assistants
curl -sS -G "$BASE/chats" \
  --data-urlencode "page=1" --data-urlencode "page_size=30" \
  -H "Authorization: Bearer $KEY"

# Update assistant
curl -X PUT "$BASE/chats/{chat_id}" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"prompt":{"prompt":"Updated prompt..."}}'

# Delete assistants
curl -X DELETE "$BASE/chats" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"ids":["chat_id"]}'
```

### Conversations

```bash
# Create session
curl -X POST "$BASE/chats/{chat_id}/sessions" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"name":"Session 1"}'

# Chat (with optional metadata filter and custom variables)
curl -X POST "$BASE/chats/{chat_id}/completions" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{
    "question": "Qui est Jean Valjean ?",
    "stream": true,
    "session_id": "session_id_here",
    "mode": "erudit",
    "metadata_condition": {
      "logic": "and",
      "conditions": [
        {"name": "oeuvre", "comparison_operator": "=", "value": "Les Misérables"}
      ]
    }
  }'
```

Custom variables declared in the assistant's `prompt.variables` (e.g. `mode`) are passed as top-level fields in the completions body.

### Retrieval (standalone search)

```bash
curl -X POST "$BASE/retrieval" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{
    "question": "la barricade de la rue de la Chanvrerie",
    "dataset_ids": ["dataset_id"],
    "keyword": true,
    "top_k": 10,
    "similarity_threshold": 0.2,
    "vector_similarity_weight": 0.3,
    "highlight": true,
    "metadata_condition": {
      "logic": "and",
      "conditions": [
        {"name": "oeuvre", "comparison_operator": "=", "value": "Les Misérables"}
      ]
    }
  }'
```

Additional retrieval options: `use_kg` (knowledge graph), `toc_enhance`, `rerank_id`, `cross_languages`.

## v0.24.0 Quirks

- `include_parsing_status=true` on `GET /datasets` is **rejected** (code 101). Check indexing by listing documents and reading their `run` field instead.
- `token_num` on documents may remain `0` even after successful parsing.
- `meta_fields` defaults to `{}` on upload — metadata must be set explicitly after upload.
- The API docs reference both `/chats` and `/assistants` — on v0.24, use `/chats`.

## Additional Resources

- For detailed metadata schema, retrieval tuning, and prompt templates: [reference.md](reference.md)
- RAGFlow official docs: https://ragflow.io/docs/dev/
- Instance deployment/SSH details: `docs/instruction-ragflow.md`
