import type { VercelRequest, VercelResponse } from "@vercel/node"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"

const RAGFLOW_BASE = "https://ragflow.cappasoft.cloud/api/v1"

function resolveRagflowPath(req: VercelRequest, pathname: string): string {
  const pathParam = req.query.path
  if (Array.isArray(pathParam)) {
    return pathParam.filter(Boolean).join("/")
  }
  if (typeof pathParam === "string" && pathParam.length > 0) {
    return pathParam
  }
  const prefix = "/api/ragflow/"
  const idx = pathname.indexOf(prefix)
  if (idx !== -1) {
    return decodeURIComponent(pathname.slice(idx + prefix.length))
  }
  return ""
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const apiKey = process.env.RAGFLOW_ADMIN_API_KEY
  if (!apiKey) {
    return res
      .status(500)
      .json({ error: "RAGFLOW_ADMIN_API_KEY not configured" })
  }

  const url = req.url ?? ""
  const [pathname, rawQs] = url.split("?", 2)

  const ragflowPath = resolveRagflowPath(req, pathname)
  const qs = new URLSearchParams(rawQs ?? "")
  qs.delete("path")
  const qsStr = qs.toString()

  const targetUrl = `${RAGFLOW_BASE}/${ragflowPath}${qsStr ? `?${qsStr}` : ""}`

  try {
    const method = (req.method ?? "GET").toUpperCase()
    const bodyStr =
      req.body == null
        ? ""
        : typeof req.body === "string"
          ? req.body
          : JSON.stringify(req.body)

    const streamRequest =
      method === "POST" &&
      ragflowPath.includes("/completions") &&
      bodyStr.includes('"stream":true')

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
    }
    if (bodyStr.length > 0) {
      headers["Content-Type"] = "application/json"
    }

    const response = await fetch(targetUrl, {
      method,
      headers,
      body: bodyStr.length > 0 ? bodyStr : undefined,
    })

    if (streamRequest && response.ok && response.body) {
      res.status(response.status)
      const ct = response.headers.get("content-type")
      if (ct) res.setHeader("Content-Type", ct)
      res.setHeader("Cache-Control", "no-cache")
      res.setHeader("X-Accel-Buffering", "no")
      try {
        await pipeline(
          Readable.fromWeb(response.body as import("stream/web").ReadableStream),
          res
        )
      } catch {
        if (!res.writableEnded) {
          try {
            res.end()
          } catch {
            /* ignore */
          }
        }
      }
      return
    }

    const data = Buffer.from(await response.arrayBuffer())
    const ct = response.headers.get("content-type") || "application/json"
    res.setHeader("Content-Type", ct)
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60")
    return res.status(response.status).send(data)
  } catch (err) {
    return res
      .status(502)
      .json({ error: "RAGFlow proxy error", detail: String(err) })
  }
}
