import type { VercelRequest, VercelResponse } from "@vercel/node"

const RAGFLOW_BASE = "https://ragflow.cappasoft.cloud/api/v1"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const apiKey = process.env.RAGFLOW_ADMIN_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: "RAGFLOW_ADMIN_API_KEY not configured" })
  }

  const pathSegments = req.query.path
  const ragflowPath = Array.isArray(pathSegments)
    ? pathSegments.join("/")
    : pathSegments ?? ""

  const queryString = new URLSearchParams(
    req.query as Record<string, string>
  )
  queryString.delete("path")
  const qs = queryString.toString()
  const targetUrl = `${RAGFLOW_BASE}/${ragflowPath}${qs ? `?${qs}` : ""}`

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      ...(req.method !== "GET" && req.body ? { body: JSON.stringify(req.body) } : {}),
    })

    const data = await response.text()
    res.setHeader("Content-Type", "application/json")
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60")
    return res.status(response.status).send(data)
  } catch (err) {
    return res.status(502).json({ error: "RAGFlow proxy error", detail: String(err) })
  }
}
