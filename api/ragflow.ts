import type { VercelRequest } from "@vercel/node"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { defineHandler, sendJson } from "./_lib/handler"
import {
  getGatewaySecret,
  isAllowedRagflowProxy,
  parseCookieHeader,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "./_lib/ragflow-gateway"

const RAGFLOW_BASE = "https://ragflow.cappasoft.cloud/api/v1"

function resolveRagflowPath(req: VercelRequest, pathname: string): string {
  const pathParam = req.query.path
  if (Array.isArray(pathParam)) return pathParam.filter(Boolean).join("/")
  if (typeof pathParam === "string" && pathParam.length > 0) return pathParam
  const prefix = "/api/ragflow/"
  const idx = pathname.indexOf(prefix)
  if (idx !== -1) return decodeURIComponent(pathname.slice(idx + prefix.length))
  return ""
}

export default defineHandler(async (req, res, trace) => {
  const apiKey = process.env.RAGFLOW_ADMIN_API_KEY
  trace.log(apiKey ? "RAGFLOW_ADMIN_API_KEY: OK" : "RAGFLOW_ADMIN_API_KEY: MISSING")

  if (!apiKey) {
    return sendJson(
      res, 500,
      { error: "RAGFLOW_ADMIN_API_KEY not configured" },
      trace,
    )
  }

  const gatewaySecret = getGatewaySecret()
  trace.log(gatewaySecret ? "gateway secret: OK" : "gateway secret: MISSING")

  if (!gatewaySecret) {
    return sendJson(res, 500, {
      error: "Gateway misconfigured",
      detail: "VOX_GATEWAY_SECRET or RAGFLOW_ADMIN_API_KEY required",
    }, trace)
  }

  const hdrCookie =
    typeof req.headers.cookie === "string" ? req.headers.cookie : undefined
  const cookieTok = parseCookieHeader(hdrCookie, SESSION_COOKIE_NAME)
  const sessionValid = verifySessionToken(cookieTok, gatewaySecret)
  trace.log(`session: ${sessionValid ? "valid" : "INVALID"}`)

  if (!sessionValid) {
    return sendJson(res, 401, {
      error: "Session required",
      hint: "GET /api/session with credentials: include",
    }, trace)
  }

  const url = req.url ?? ""
  const [pathname, rawQs] = url.split("?", 2)
  const ragflowPath = resolveRagflowPath(req, pathname)
  trace.log(`ragflow path: ${ragflowPath}`)

  const qs = new URLSearchParams(rawQs ?? "")
  qs.delete("path")
  const qsStr = qs.toString()
  const targetUrl = `${RAGFLOW_BASE}/${ragflowPath}${qsStr ? `?${qsStr}` : ""}`
  trace.log(`target: ${targetUrl}`)

  const method = (req.method ?? "GET").toUpperCase()
  const pathOnly = ragflowPath.split("?")[0].replace(/\/+$/, "") || ""
  const allowed = isAllowedRagflowProxy(method, pathOnly)
  trace.log(`allowlist ${method} ${pathOnly}: ${allowed ? "OK" : "DENIED"}`)

  if (!allowed) {
    return sendJson(res, 403, {
      error: "Forbidden",
      detail: "This RAGFlow route is not exposed through the gateway",
    }, trace)
  }

  const bodyStr =
    req.body == null
      ? ""
      : typeof req.body === "string"
        ? req.body
        : JSON.stringify(req.body)
  trace.log(`body: ${bodyStr.length} bytes`)

  const streamRequest =
    method === "POST" &&
    ragflowPath.includes("/completions") &&
    bodyStr.includes('"stream":true')
  trace.log(`stream: ${streamRequest}`)

  const fetchHeaders: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  }
  if (bodyStr.length > 0) fetchHeaders["Content-Type"] = "application/json"

  trace.log("fetching RAGFlow…")

  const response = await fetch(targetUrl, {
    method,
    headers: fetchHeaders,
    body: bodyStr.length > 0 ? bodyStr : undefined,
  })

  trace.log(`upstream: ${response.status} ${response.statusText}`)

  if (streamRequest && response.ok && response.body) {
    trace.log("piping SSE stream")
    res.status(response.status)
    const ct = response.headers.get("content-type")
    if (ct) res.setHeader("Content-Type", ct)
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("X-Accel-Buffering", "no")
    res.setHeader("X-Vox-Debug", JSON.stringify(trace.toJSON()))
    try {
      await pipeline(
        Readable.fromWeb(
          response.body as import("stream/web").ReadableStream,
        ),
        res,
      )
    } catch {
      if (!res.writableEnded) {
        try { res.end() } catch { /* closed */ }
      }
    }
    return
  }

  const ct = response.headers.get("content-type") || ""
  const text = await response.text()
  trace.log(`upstream body: ${text.length} chars, ct: ${ct}`)

  if (ct.includes("application/json")) {
    try {
      const upstream = JSON.parse(text) as unknown
      return sendJson(res, response.status, upstream, trace)
    } catch {
      trace.log("upstream JSON parse failed, forwarding raw")
    }
  }

  res.setHeader("Content-Type", ct || "application/octet-stream")
  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60")
  res.setHeader("X-Vox-Debug", JSON.stringify(trace.toJSON()))
  return res.status(response.status).send(text)
})
