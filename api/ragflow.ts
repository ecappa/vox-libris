import type { VercelRequest, VercelResponse } from "@vercel/node"

const RAGFLOW_BASE = "https://ragflow.cappasoft.cloud/api/v1"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const apiKey = process.env.RAGFLOW_ADMIN_API_KEY
  if (!apiKey) {
    return res
      .status(500)
      .json({ error: "RAGFLOW_ADMIN_API_KEY not configured" })
  }

  const url = req.url ?? ""
  const [pathname, rawQs] = url.split("?", 2)

  // Le rewrite envoie /api/ragflow/datasets/xxx → /api/ragflow?path=datasets/xxx
  // Extraire le chemin RAGFlow soit depuis le query param `path`, soit depuis l'URL.
  let ragflowPath = ""
  const pathParam = req.query.path
  if (Array.isArray(pathParam)) {
    ragflowPath = pathParam.filter(Boolean).join("/")
  } else if (typeof pathParam === "string" && pathParam.length > 0) {
    ragflowPath = pathParam
  } else {
    const prefix = "/api/ragflow/"
    const idx = pathname.indexOf(prefix)
    if (idx !== -1) {
      ragflowPath = decodeURIComponent(pathname.slice(idx + prefix.length))
    }
  }

  // Query string nettoyée (sans le param `path` injecté par le rewrite)
  const qs = new URLSearchParams(rawQs ?? "")
  qs.delete("path")
  const qsStr = qs.toString()

  const targetUrl = `${RAGFLOW_BASE}/${ragflowPath}${qsStr ? `?${qsStr}` : ""}`

  try {
    const method = (req.method ?? "GET").toUpperCase()
    const init: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    }
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && req.body) {
      init.body =
        typeof req.body === "string" ? req.body : JSON.stringify(req.body)
    }

    const response = await fetch(targetUrl, init)
    const data = await response.text()

    res.setHeader("Content-Type", "application/json")
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60")
    return res.status(response.status).send(data)
  } catch (err) {
    return res
      .status(502)
      .json({ error: "RAGFlow proxy error", detail: String(err) })
  }
}
