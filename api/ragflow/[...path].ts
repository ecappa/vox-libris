import type { VercelRequest, VercelResponse } from "@vercel/node"

const RAGFLOW_BASE = "https://ragflow.cappasoft.cloud/api/v1"

function ragflowPathFromRequest(req: VercelRequest): string {
  const pathParam = req.query.path
  if (Array.isArray(pathParam)) return pathParam.filter(Boolean).join("/")
  if (typeof pathParam === "string" && pathParam.length > 0) return pathParam

  // Vercel ne remplit pas toujours `query.path` pour les routes catch-all ; même logique que le proxy Vite.
  const pathname = (req.url ?? "").split("?")[0] ?? ""
  const prefix = "/api/ragflow/"
  if (pathname.startsWith(prefix)) {
    return decodeURIComponent(pathname.slice(prefix.length)).replace(/^\/+/, "")
  }
  // Certaines invocations Vercel ne préfixent pas l’URL (ex. relatif à la fonction).
  const trimmed = pathname.replace(/^\/+/, "")
  if (trimmed && !trimmed.includes("..")) return trimmed
  return ""
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const apiKey = process.env.RAGFLOW_ADMIN_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: "RAGFLOW_ADMIN_API_KEY not configured" })
  }

  const ragflowPath = ragflowPathFromRequest(req)

  // Ne pas utiliser req.query : Vercel y injecte `path` (catch-all) → RAGFlow renvoie 101 « Extra inputs ».
  const qs = (() => {
    const full = req.url ?? ""
    const qIdx = full.indexOf("?")
    if (qIdx === -1) return ""
    return full.slice(qIdx + 1)
  })()
  const targetUrl = `${RAGFLOW_BASE}/${ragflowPath}${qs ? `?${qs}` : ""}`

  try {
    const method = (req.method ?? "GET").toUpperCase()
    const init: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    }
    // Vercel peut fournir un body sur GET ; RAGFlow rejette alors des champs « path » / extra inputs.
    if (
      ["POST", "PUT", "PATCH", "DELETE"].includes(method) &&
      req.body !== undefined &&
      req.body !== ""
    ) {
      init.body =
        typeof req.body === "string" ? req.body : JSON.stringify(req.body)
    }

    const response = await fetch(targetUrl, init)

    const data = await response.text()
    res.setHeader("Content-Type", "application/json")
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60")
    return res.status(response.status).send(data)
  } catch (err) {
    return res.status(502).json({ error: "RAGFlow proxy error", detail: String(err) })
  }
}
