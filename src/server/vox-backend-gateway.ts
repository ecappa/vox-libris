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
} from "../../api/lib/ragflow-gateway"

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

async function forwardToRagflow(
  res: ServerResponse,
  targetUrl: string,
  method: string,
  body: Uint8Array,
  apiKey: string,
  req: IncomingMessage
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

  const response = await fetch(targetUrl, {
    method,
    headers,
    body: body.length > 0 ? Buffer.from(body) : undefined,
  })

  if (streamRequest && response.body && response.ok) {
    res.statusCode = response.status
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

  const buf = Buffer.from(await response.arrayBuffer())
  res.statusCode = response.status
  const ct = response.headers.get("content-type") || "application/json"
  res.setHeader("Content-Type", ct)
  res.setHeader("Cache-Control", "no-cache")
  res.end(buf)
}

function pathnameOnly(url: string | undefined): string {
  if (!url) return ""
  return url.split("?")[0] ?? ""
}

/**
 * Middleware dev : session signée, config publique, proxy RAGFlow allowlisté.
 * Aucune clé RAGFlow n’est servie au navigateur.
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
          if (!gatewaySecret) {
            res.statusCode = 500
            res.setHeader("Content-Type", "application/json")
            res.end(
              JSON.stringify({
                error: "Gateway misconfigured",
                detail: "Définir RAGFLOW_ADMIN_API_KEY ou VOX_GATEWAY_SECRET dans .env.local",
              })
            )
            return
          }
          const token = issueSessionToken(gatewaySecret)
          res.statusCode = 204
          res.setHeader(
            "Set-Cookie",
            buildSessionSetCookieHeader(token, false)
          )
          res.setHeader("Cache-Control", "no-store")
          res.end()
          return
        }

        if (basePath === "/api/vox/config" && req.method === "GET") {
          const assistants = getPublicAssistants(
            loadEnvLine("RAGFLOW_PUBLIC_ASSISTANTS")
          )
          res.statusCode = 200
          res.setHeader("Content-Type", "application/json")
          res.setHeader(
            "Cache-Control",
            "public, max-age=60, stale-while-revalidate=300"
          )
          res.end(JSON.stringify({ assistants }))
          return
        }

        if (!req.url?.startsWith("/api/ragflow/")) return next()

        if (!apiKey) {
          res.statusCode = 500
          res.setHeader("Content-Type", "application/json")
          res.end(
            JSON.stringify({
              error: "RAGFLOW_ADMIN_API_KEY not configured",
            })
          )
          return
        }

        if (!gatewaySecret) {
          res.statusCode = 500
          res.setHeader("Content-Type", "application/json")
          res.end(
            JSON.stringify({
              error: "Gateway misconfigured",
              detail: "VOX_GATEWAY_SECRET or RAGFLOW_ADMIN_API_KEY required for session",
            })
          )
          return
        }

        const cookieTok = parseCookieHeader(
          req.headers.cookie,
          SESSION_COOKIE_NAME
        )
        if (!verifySessionToken(cookieTok, gatewaySecret)) {
          res.statusCode = 401
          res.setHeader("Content-Type", "application/json")
          res.end(
            JSON.stringify({
              error: "Session required",
              hint: "Call GET /api/session with credentials: 'include' first",
            })
          )
          return
        }

        const method = (req.method ?? "GET").toUpperCase()
        const pathWithQuery = req.url.replace(/^\/api\/ragflow\/?/, "")
        const pathOnly = pathWithQuery.split("?")[0].replace(/\/+$/, "") || ""

        if (!isAllowedRagflowProxy(method, pathOnly)) {
          res.statusCode = 403
          res.setHeader("Content-Type", "application/json")
          res.end(
            JSON.stringify({
              error: "Forbidden",
              detail: "This RAGFlow route is not exposed through the gateway",
            })
          )
          return
        }

        let body: Uint8Array = Buffer.alloc(0)
        if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
          try {
            body = new Uint8Array(await readRequestBody(req))
          } catch (err) {
            res.statusCode = 413
            res.setHeader("Content-Type", "application/json")
            res.end(
              JSON.stringify({
                error: "RAGFlow proxy",
                detail: String(err),
              })
            )
            return
          }
        }

        const targetUrl = `${RAGFLOW_BASE}/${pathWithQuery}`

        try {
          await forwardToRagflow(res, targetUrl, method, body, apiKey, req)
        } catch (err) {
          if (!res.headersSent) {
            res.statusCode = 502
            res.setHeader("Content-Type", "application/json")
            res.end(
              JSON.stringify({
                error: "RAGFlow proxy error",
                detail: String(err),
              })
            )
          }
        }
      })
    },
  }
}
