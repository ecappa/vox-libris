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
    handlers.onError(new Error("Empty response body"))
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let eventCount = 0

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
          console.warn("[vox-sse] JSON parse failed:", raw.slice(0, 120))
          continue
        }

        if (msg.code !== undefined && msg.code !== 0) {
          console.error("[vox-sse] error from RAGFlow:", msg.message)
          handlers.onError(new Error(msg.message ?? `code ${msg.code}`))
          return
        }

        const d = msg.data
        if (d === true || d === undefined) continue

        eventCount++
        if (typeof d.answer === "string" && d.answer.length > 0) {
          console.log(
            `[vox-sse] #${eventCount} delta (${d.answer.length} chars)`,
            d.answer.slice(0, 80),
            d.final ? "[FINAL]" : ""
          )
          handlers.onDelta(d.answer)
        }
        if (d.final === true) {
          console.log(
            `[vox-sse] final event, ref chunks:`,
            d.reference?.total ?? 0
          )
          handlers.onFinal(d.reference ?? null)
        }
      }
    }
    console.log(`[vox-sse] stream ended, ${eventCount} events processed`)
  } catch (e) {
    console.error("[vox-sse] stream error:", e)
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
