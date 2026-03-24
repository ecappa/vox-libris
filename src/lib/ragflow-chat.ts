const API_BASE = "/api/ragflow"

export interface RagflowRefChunk {
  id?: string
  document_id?: string
  document_name?: string
  content?: string
  similarity?: number
}

export interface RagflowReference {
  chunks?: RagflowRefChunk[]
  total?: number
  doc_aggs?: { doc_name: string; doc_id?: string; count?: number }[]
}

interface ApiEnvelope<T> {
  code: number
  message?: string
  data: T
}

export async function createChatSession(
  chatId: string,
  name = "Vox Libris"
): Promise<string> {
  const res = await fetch(`${API_BASE}/chats/${chatId}/sessions`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  })
  const json: ApiEnvelope<{ id: string }> = await res.json()
  if (json.code !== 0) {
    throw new Error(json.message ?? `RAGFlow sessions code ${json.code}`)
  }
  return json.data.id
}

export interface CompletionExtras {
  oeuvre?: string
  metadata_condition?: Record<string, unknown>
}

export async function chatCompletionNonStream(
  chatId: string,
  sessionId: string,
  question: string,
  extras?: CompletionExtras
): Promise<{ answer: string; reference: RagflowReference | null }> {
  const res = await fetch(`${API_BASE}/chats/${chatId}/completions`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      stream: false,
      session_id: sessionId,
      ...extras,
    }),
  })
  const json: ApiEnvelope<{
    answer?: string
    reference?: RagflowReference
  }> = await res.json()
  if (json.code !== 0) {
    throw new Error(json.message ?? `RAGFlow completions code ${json.code}`)
  }
  return {
    answer: json.data.answer ?? "",
    reference: json.data.reference ?? null,
  }
}

export interface StreamHandlers {
  onDelta: (delta: string) => void
  onFinal: (reference: RagflowReference | null) => void
  onError: (err: Error) => void
}

/**
 * Consomme le flux SSE RAGFlow (`data: {...}` par ligne).
 * Les deltas `answer` sont concaténés côté appelant via onDelta.
 */
export async function chatCompletionStream(
  chatId: string,
  sessionId: string,
  question: string,
  handlers: StreamHandlers,
  extras?: CompletionExtras
): Promise<void> {
  const res = await fetch(`${API_BASE}/chats/${chatId}/completions`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      stream: true,
      session_id: sessionId,
      ...extras,
    }),
  })

  if (!res.ok) {
    const t = await res.text()
    handlers.onError(new Error(t || `HTTP ${res.status}`))
    return
  }

  const ct = res.headers.get("content-type") ?? ""

  if (ct.includes("application/json")) {
    const json: ApiEnvelope<{
      answer?: string
      reference?: RagflowReference
    }> = await res.json()
    if (json.code !== 0) {
      handlers.onError(new Error(json.message ?? `code ${json.code}`))
      return
    }
    const a = json.data.answer ?? ""
    if (a) handlers.onDelta(a)
    handlers.onFinal(json.data.reference ?? null)
    return
  }

  if (!res.body) {
    handlers.onError(new Error("Réponse vide"))
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let prevAnswer = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith("data:")) continue
        const raw = trimmed.slice(5).trim()
        if (!raw || raw === "[DONE]") continue

        let msg: {
          code?: number
          message?: string
          data?:
            | true
            | {
                answer?: string
                final?: boolean
                reference?: RagflowReference
              }
        }
        try {
          msg = JSON.parse(raw) as typeof msg
        } catch {
          continue
        }

        if (msg.code !== undefined && msg.code !== 0) {
          handlers.onError(new Error(msg.message ?? `code ${msg.code}`))
          return
        }

        const d = msg.data
        if (d === true || d === undefined) continue
        if (typeof d.answer === "string" && d.answer.length > 0 && !d.final) {
          // RAGFlow sends cumulative text — extract the actual delta
          const delta = d.answer.slice(prevAnswer.length)
          prevAnswer = d.answer
          if (delta.length > 0) {
            handlers.onDelta(delta)
          }
        }
        if (d.final === true) {
          handlers.onFinal(d.reference ?? null)
        }
      }
    }
  } catch (e) {
    handlers.onError(e instanceof Error ? e : new Error(String(e)))
  }
}

export function uniqueSourceLabels(ref: RagflowReference | null): string[] {
  if (!ref?.chunks?.length) {
    const aggs = ref?.doc_aggs ?? []
    return [...new Set(aggs.map((a) => a.doc_name).filter(Boolean))] as string[]
  }
  const names = ref.chunks
    .map((c) => c.document_name)
    .filter((n): n is string => Boolean(n))
  return [...new Set(names)]
}
