import fs from "node:fs"
import path from "node:path"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { Plugin } from "vite"

import {
  buildSessionSetCookieHeader,
  getPublicAssistants,
  isAllowedRagflowProxy,
  issueSessionToken,
  parseCookieHeader,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "../../api/_lib/ragflow-gateway"
import { RequestTrace } from "../../api/_lib/trace"

const RAGFLOW_BASE = "https://ragflow.cappasoft.cloud/api/v1"
const BODY_LIMIT = 12 * 1024 * 1024

function loadEnvLine(name: string): string | undefined {
  try {
    const envPath = path.resolve(process.cwd(), ".env.local")
    const content = fs.readFileSync(envPath, "utf-8")
    const re = new RegExp(`^${name}=(.+)$`, "m")
    const m = content.match(re)
    return m?.[1]?.trim()
  } catch {
    return undefined
  }
}

function resolveRagflowApiKey(): string {
  return (
    process.env.RAGFLOW_ADMIN_API_KEY?.trim() ||
    loadEnvLine("RAGFLOW_ADMIN_API_KEY") ||
    ""
  )
}

function resolveGatewaySecretForVite(): string {
  return (
    process.env.VOX_GATEWAY_SECRET?.trim() ||
    process.env.RAGFLOW_ADMIN_API_KEY?.trim() ||
    loadEnvLine("VOX_GATEWAY_SECRET") ||
    loadEnvLine("RAGFLOW_ADMIN_API_KEY") ||
    ""
  )
}

function readRequestBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = []
    let size = 0
    req.on("data", (chunk: Buffer | string) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      size += buf.length
      if (size > BODY_LIMIT) {
        reject(new Error("Request body too large"))
        req.destroy()
        return
      }
      chunks.push(new Uint8Array(buf))
    })
    req.on("end", () => resolve(Buffer.concat(chunks)))
    req.on("error", reject)
  })
}

function isCompletionStreamRequest(
  method: string,
  pathWithQuery: string,
  body: Uint8Array
): boolean {
  if (method !== "POST" || !pathWithQuery.includes("/completions")) return false
  if (body.length === 0) return false
  try {
    const s = new TextDecoder().decode(body)
    return /"stream"\s*:\s*true/.test(s)
  } catch {
    return false
  }
}

/**
 * Envoie une réponse JSON avec la clé `debug` (miroir de sendJson côté Vercel).
 */
function sendJsonDev(
  res: ServerResponse,
  status: number,
  data: unknown,
  trace: RequestTrace,
): void {
  trace.log(`← ${status}`)
  const debug = trace.toJSON()
  const body =
    typeof data === "object" && data !== null && !Array.isArray(data)
      ? { ...(data as Record<string, unknown>), debug }
      : { data, debug }
  res.statusCode = status
  res.setHeader("Content-Type", "application/json")
  res.end(JSON.stringify(body))
}

async function forwardToRagflow(
  res: ServerResponse,
  targetUrl: string,
  method: string,
  body: Uint8Array,
  apiKey: string,
  req: IncomingMessage,
  trace: RequestTrace,
): Promise<void> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  }
  if (body.length > 0) {
    const ct = req.headers["content-type"]
    headers["Content-Type"] =
      typeof ct === "string" && ct.length > 0 ? ct : "application/json"
  }

  const pathWithQuery = targetUrl.replace(`${RAGFLOW_BASE}/`, "")
  const streamRequest = isCompletionStreamRequest(method, pathWithQuery, body)
  trace.log(`stream: ${streamRequest}`)

  trace.log("fetching RAGFlow...")
  const response = await fetch(targetUrl, {
    method,
    headers,
    body: body.length > 0 ? Buffer.from(body) : undefined,
  })
  trace.log(`upstream: ${response.status} ${response.statusText}`)

  if (streamRequest && response.body && response.ok) {
    trace.log("piping SSE stream")
    res.statusCode = response.status
    const ct = response.headers.get("content-type")
    if (ct) res.setHeader("Content-Type", ct)
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("X-Accel-Buffering", "no")
    res.setHeader("X-Vox-Debug", trace.toHeaderValue())
    res.flushHeaders()
    try {
      await pipeline(
        Readable.fromWeb(response.body as import("stream/web").ReadableStream),
        res
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
      return sendJsonDev(res, response.status, upstream, trace)
    } catch {
      trace.log("upstream JSON parse failed, forwarding raw")
    }
  }

  res.statusCode = response.status
  res.setHeader("Content-Type", ct || "application/octet-stream")
  res.setHeader("Cache-Control", "no-cache")
  res.setHeader("X-Vox-Debug", JSON.stringify(trace.toJSON()))
  res.end(text)
}

function pathnameOnly(url: string | undefined): string {
  if (!url) return ""
  return url.split("?")[0] ?? ""
}

/**
 * Middleware dev : session signée, config publique, proxy RAGFlow allowlisté.
 * Aucune clé RAGFlow n'est servie au navigateur.
 * Chaque réponse JSON contient une clé `debug` avec le log-trace complet.
 */
export function voxBackendGateway(): Plugin {
  let apiKey = ""
  let gatewaySecret = ""

  return {
    name: "vox-backend-gateway",
    configureServer(server) {
      apiKey = resolveRagflowApiKey()
      gatewaySecret = resolveGatewaySecretForVite()

      server.middlewares.use(async (req, res, next) => {
        const basePath = pathnameOnly(req.url)

        if (basePath === "/api/session" && req.method === "GET") {
          const trace = new RequestTrace(`GET /api/session`)

          if (!gatewaySecret) {
            trace.log("gateway secret: MISSING")
            return sendJsonDev(res, 500, {
              error: "Gateway misconfigured",
              detail:
                "Définir RAGFLOW_ADMIN_API_KEY ou VOX_GATEWAY_SECRET dans .env.local",
            }, trace)
          }

          trace.log("gateway secret: OK")
          const token = issueSessionToken(gatewaySecret)
          trace.log("session token issued")
          res.setHeader(
            "Set-Cookie",
            buildSessionSetCookieHeader(token, false)
          )
          res.setHeader("Cache-Control", "no-store")
          return sendJsonDev(res, 200, { ok: true }, trace)
        }

        if (basePath === "/api/vox/config" && req.method === "GET") {
          const trace = new RequestTrace(`GET /api/vox/config`)
          const assistants = getPublicAssistants(
            loadEnvLine("RAGFLOW_PUBLIC_ASSISTANTS")
          )
          trace.log(`loaded ${assistants.length} assistant(s)`)
          res.setHeader(
            "Cache-Control",
            "public, max-age=60, stale-while-revalidate=300"
          )
          return sendJsonDev(res, 200, { assistants }, trace)
        }

        if (!req.url?.startsWith("/api/ragflow/")) return next()

        const trace = new RequestTrace(
          `${req.method} ${basePath}`
        )

        if (!apiKey) {
          trace.log("RAGFLOW_ADMIN_API_KEY: MISSING")
          return sendJsonDev(res, 500, {
            error: "RAGFLOW_ADMIN_API_KEY not configured",
          }, trace)
        }
        trace.log("RAGFLOW_ADMIN_API_KEY: OK")

        if (!gatewaySecret) {
          trace.log("gateway secret: MISSING")
          return sendJsonDev(res, 500, {
            error: "Gateway misconfigured",
            detail:
              "VOX_GATEWAY_SECRET or RAGFLOW_ADMIN_API_KEY required for session",
          }, trace)
        }
        trace.log("gateway secret: OK")

        const cookieTok = parseCookieHeader(
          req.headers.cookie,
          SESSION_COOKIE_NAME
        )
        const sessionValid = verifySessionToken(cookieTok, gatewaySecret)
        trace.log(`session: ${sessionValid ? "valid" : "INVALID"}`)

        if (!sessionValid) {
          return sendJsonDev(res, 401, {
            error: "Session required",
            hint: "Call GET /api/session with credentials: 'include' first",
          }, trace)
        }

        const method = (req.method ?? "GET").toUpperCase()
        const pathWithQuery = req.url.replace(/^\/api\/ragflow\/?/, "")
        const pathOnly =
          pathWithQuery.split("?")[0].replace(/\/+$/, "") || ""

        const allowed = isAllowedRagflowProxy(method, pathOnly)
        trace.log(
          `allowlist ${method} ${pathOnly}: ${allowed ? "OK" : "DENIED"}`
        )

        if (!allowed) {
          return sendJsonDev(res, 403, {
            error: "Forbidden",
            detail:
              "This RAGFlow route is not exposed through the gateway",
          }, trace)
        }

        let body: Uint8Array = Buffer.alloc(0)
        if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
          try {
            body = new Uint8Array(await readRequestBody(req))
            trace.log(`body: ${body.length} bytes`)
          } catch (err) {
            trace.log(`body read error: ${err}`)
            return sendJsonDev(res, 413, {
              error: "RAGFlow proxy",
              detail: String(err),
            }, trace)
          }
        }

        const targetUrl = `${RAGFLOW_BASE}/${pathWithQuery}`
        trace.log(`target: ${targetUrl}`)

        try {
          await forwardToRagflow(
            res, targetUrl, method, body, apiKey, req, trace,
          )
        } catch (err) {
          trace.log(`proxy error: ${err}`)
          if (!res.headersSent) {
            sendJsonDev(res, 502, {
              error: "RAGFlow proxy error",
              detail: String(err),
            }, trace)
          }
        }
      })
    },
  }
}
