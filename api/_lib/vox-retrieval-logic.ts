/**
 * Corps JSON pour POST /api/v1/retrieval (RAGFlow) — injection rerank côté serveur.
 */

export const RAGFLOW_API_V1_BASE = "https://ragflow.cappasoft.cloud/api/v1"

export function buildRagflowRetrievalPayload(
  raw: unknown,
  env: NodeJS.ProcessEnv
):
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "JSON body must be an object" }
  }
  const o = raw as Record<string, unknown>
  const q = o.question
  if (typeof q !== "string" || !q.trim()) {
    return { ok: false, error: "question must be a non-empty string" }
  }
  const ids = o.dataset_ids
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    !ids.every((x) => typeof x === "string" && (x as string).trim())
  ) {
    return { ok: false, error: "dataset_ids must be a non-empty string array" }
  }
  const body: Record<string, unknown> = {
    question: q.trim(),
    dataset_ids: ids.map((x) => String(x).trim()),
    keyword: o.keyword !== false,
    highlight: o.highlight !== false,
    top_k: typeof o.top_k === "number" && Number.isFinite(o.top_k) ? o.top_k : 12,
    similarity_threshold:
      typeof o.similarity_threshold === "number" &&
      Number.isFinite(o.similarity_threshold)
        ? o.similarity_threshold
        : 0.2,
    vector_similarity_weight:
      typeof o.vector_similarity_weight === "number" &&
      Number.isFinite(o.vector_similarity_weight)
        ? o.vector_similarity_weight
        : 0.3,
  }
  if (
    o.metadata_condition !== undefined &&
    o.metadata_condition !== null &&
    typeof o.metadata_condition === "object" &&
    !Array.isArray(o.metadata_condition)
  ) {
    body.metadata_condition = o.metadata_condition
  }
  const rid = env.RAGFLOW_RERANK_ID?.trim()
  if (rid && (o.rerank_id === undefined || o.rerank_id === null)) {
    body.rerank_id = rid
  } else if (typeof o.rerank_id === "string" && o.rerank_id.trim()) {
    body.rerank_id = o.rerank_id.trim()
  }
  return { ok: true, body }
}
