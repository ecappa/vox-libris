const API_BASE = "/api/ragflow"

export interface RagflowDataset {
  id: string
  name: string
  document_count: number
  chunk_count: number
  token_num: number
  chunk_method: string
  language: string
  embedding_model: string
  create_date: string
  update_date: string
}

export interface RagflowDocument {
  id: string
  name: string
  dataset_id: string
  chunk_count: number
  token_count: number
  run: "UNSTART" | "RUNNING" | "DONE" | "FAIL" | "CANCEL"
  progress: number
  size: number
  create_date: string
  update_date: string
  meta_fields: Record<string, unknown>
}

interface ApiResponse<T> {
  code: number
  data: T
}

export async function fetchDatasets(): Promise<RagflowDataset[]> {
  const res = await fetch(`${API_BASE}/datasets?page=1&page_size=100`, {
    credentials: "include",
  })
  const json: ApiResponse<RagflowDataset[]> = await res.json()
  if (json.code !== 0) throw new Error(`RAGFlow error code ${json.code}`)
  return json.data
}

export async function fetchDocuments(
  datasetId: string,
  page = 1,
  pageSize = 200
): Promise<{ docs: RagflowDocument[]; total: number }> {
  const res = await fetch(
    `${API_BASE}/datasets/${datasetId}/documents?page=${page}&page_size=${pageSize}`,
    { credentials: "include" }
  )
  const json: ApiResponse<{ docs: RagflowDocument[]; total: number }> =
    await res.json()
  if (json.code !== 0) throw new Error(`RAGFlow error code ${json.code}`)
  return json.data
}
