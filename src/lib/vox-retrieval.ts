const API_RETRIEVAL = "/api/vox/retrieval"

export interface VoxRetrievalRequest {
  question: string
  dataset_ids: string[]
  metadata_condition?: {
    logic: "and" | "or"
    conditions: Array<{
      name: string
      comparison_operator: string
      value: string
    }>
  }
  top_k?: number
}

/** Fragment renvoyé par RAGFlow (forme variable selon version). */
export interface RetrievalChunkLike {
  content?: string
  content_ltks?: string
  document_id?: string
  document_name?: string
  /** Nom fichier / clé document (souvent renvoyé par RAGFlow v0.24). */
  document_keyword?: string
  docnm_kwd?: string
  similarity?: number
  highlight?: unknown
  [key: string]: unknown
}

interface ApiEnvelope {
  code: number
  message?: string
  data?: {
    chunks?: RetrievalChunkLike[]
    total?: number
    doc_aggs?: unknown
    [key: string]: unknown
  }
}

export async function fetchVoxRetrieval(
  body: VoxRetrievalRequest
): Promise<ApiEnvelope> {
  const res = await fetch(API_RETRIEVAL, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: body.question,
      dataset_ids: body.dataset_ids,
      metadata_condition: body.metadata_condition,
      top_k: body.top_k ?? 16,
      keyword: true,
      highlight: true,
    }),
  })
  const json = (await res.json()) as ApiEnvelope & {
    debug?: unknown
    error?: string
    detail?: string
  }
  if (!res.ok) {
    const msg =
      typeof json.error === "string"
        ? json.detail
          ? `${json.error}: ${json.detail}`
          : json.error
        : typeof json.message === "string"
          ? json.message
          : `HTTP ${res.status}`
    throw new Error(msg)
  }
  return json
}

export function pickChunkText(c: RetrievalChunkLike): string {
  const raw = c.content ?? c.content_ltks
  if (typeof raw === "string" && raw.trim()) return raw.trim()
  return ""
}

export function pickChunkDocName(c: RetrievalChunkLike): string {
  const n =
    c.document_name ?? c.document_keyword ?? c.docnm_kwd
  if (typeof n === "string" && n.trim()) return n.trim()
  return typeof c.document_id === "string" ? c.document_id : "Document"
}
