import fs from "node:fs"
import path from "node:path"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { Plugin } from "vite"

import { timingSafeEqual } from "node:crypto"
import {
  APP_GATE_COOKIE_NAME,
  buildAppGateClearCookieHeader,
  buildAppGateSetCookieHeader,
  buildSessionClearCookieHeader,
  buildSessionSetCookieHeader,
  getPublicAssistants,
  isAllowedRagflowProxy,
  issueAppGateToken,
  issueSessionToken,
  parseCookieHeader,
  SESSION_COOKIE_NAME,
  verifyAppGateToken,
  verifySessionToken,
} from "../../api/_lib/ragflow-gateway"
import { RequestTrace } from "../../api/_lib/trace"
import {
  buildRagflowRetrievalPayload,
  RAGFLOW_API_V1_BASE,
} from "../../api/_lib/vox-retrieval-logic"

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

function resolveAppAccessPasswordForVite(): string {
  return (
    process.env.VOX_APP_ACCESS_PASSWORD?.trim() ||
    loadEnvLine("VOX_APP_ACCESS_PASSWORD") ||
    ""
  )
}

function appPasswordOkLocal(expected: string, given: string): boolean {
  const a = Buffer.from(expected, "utf8")
  const b = Buffer.from(given, "utf8")
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
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
        const appAccessPwd = resolveAppAccessPasswordForVite()

        if (basePath === "/api/vox/login" && req.method === "POST") {
          const trace = new RequestTrace("POST /api/vox/login")
          if (!appAccessPwd) {
            trace.log("VOX_APP_ACCESS_PASSWORD: not set")
            return sendJsonDev(
              res,
              400,
              { error: "App password not configured on server" },
              trace
            )
          }
          if (!gatewaySecret) {
            trace.log("gateway secret: MISSING")
            return sendJsonDev(res, 500, {
              error: "Gateway misconfigured",
              detail:
                "Définir RAGFLOW_ADMIN_API_KEY ou VOX_GATEWAY_SECRET dans .env.local",
            }, trace)
          }
          let raw: Uint8Array
          try {
            raw = new Uint8Array(await readRequestBody(req))
            trace.log(`body: ${raw.length} bytes`)
          } catch (err) {
            trace.log(`body read error: ${err}`)
            return sendJsonDev(res, 413, {
              error: "Request body too large",
              detail: String(err),
            }, trace)
          }
          let given: string | undefined
          try {
            const obj = JSON.parse(Buffer.from(raw).toString("utf-8")) as unknown
            given =
              obj &&
              typeof obj === "object" &&
              typeof (obj as { password?: unknown }).password === "string"
                ? (obj as { password: string }).password
                : undefined
          } catch {
            given = undefined
          }
          trace.log(`password field: ${given != null ? "present" : "missing"}`)
          if (given == null || !appPasswordOkLocal(appAccessPwd, given)) {
            trace.log("login: denied")
            return sendJsonDev(res, 401, { error: "Invalid password" }, trace)
          }
          const gateTok = issueAppGateToken(gatewaySecret)
          trace.log("app gate cookie issued")
          res.setHeader(
            "Set-Cookie",
            buildAppGateSetCookieHeader(gateTok, false)
          )
          res.setHeader("Cache-Control", "no-store")
          return sendJsonDev(res, 200, { ok: true }, trace)
        }

        if (basePath === "/api/vox/logout" && req.method === "POST") {
          const trace = new RequestTrace("POST /api/vox/logout")
          trace.log("clear session cookies")
          res.setHeader("Set-Cookie", [
            buildAppGateClearCookieHeader(false),
            buildSessionClearCookieHeader(false),
          ])
          res.setHeader("Cache-Control", "no-store")
          return sendJsonDev(res, 200, { ok: true }, trace)
        }

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
          if (appAccessPwd) {
            const gateTok = parseCookieHeader(
              req.headers.cookie,
              APP_GATE_COOKIE_NAME
            )
            const gateOk = verifyAppGateToken(gateTok, gatewaySecret)
            trace.log(`app gate: ${gateOk ? "valid" : "required"}`)
            if (!gateOk) {
              res.setHeader("Cache-Control", "no-store")
              return sendJsonDev(
                res,
                401,
                {
                  error: "App login required",
                  code: "APP_GATE",
                },
                trace
              )
            }
          }

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

        if (basePath === "/api/vox/retrieval" && req.method === "POST") {
          const trace = new RequestTrace("POST /api/vox/retrieval")

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

          const cookieTokR = parseCookieHeader(
            req.headers.cookie,
            SESSION_COOKIE_NAME
          )
          const sessionOk = verifySessionToken(cookieTokR, gatewaySecret)
          trace.log(`session: ${sessionOk ? "valid" : "INVALID"}`)
          if (!sessionOk) {
            return sendJsonDev(res, 401, {
              error: "Session required",
              hint: "Call GET /api/session with credentials: 'include' first",
            }, trace)
          }

          let rawBody: Uint8Array
          try {
            rawBody = new Uint8Array(await readRequestBody(req))
            trace.log(`body: ${rawBody.length} bytes`)
          } catch (err) {
            trace.log(`body read error: ${err}`)
            return sendJsonDev(res, 413, {
              error: "Request body too large",
              detail: String(err),
            }, trace)
          }

          let parsed: unknown
          try {
            parsed = JSON.parse(
              Buffer.from(rawBody).toString("utf-8")
            ) as unknown
          } catch {
            return sendJsonDev(res, 400, { error: "Invalid JSON body" }, trace)
          }

          const mergedEnv = { ...process.env } as NodeJS.ProcessEnv
          const rr = loadEnvLine("RAGFLOW_RERANK_ID")
          if (rr) mergedEnv.RAGFLOW_RERANK_ID = rr

          const built = buildRagflowRetrievalPayload(parsed, mergedEnv)
          if (!built.ok) {
            return sendJsonDev(res, 400, { error: built.error }, trace)
          }

          trace.log("forwarding retrieval to RAGFlow")
          const upstream = await fetch(`${RAGFLOW_API_V1_BASE}/retrieval`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(built.body),
          })
          const text = await upstream.text()
          trace.log(`upstream: ${upstream.status}, body ${text.length} chars`)
          const ct = upstream.headers.get("content-type") || ""
          if (ct.includes("application/json")) {
            try {
              const data = JSON.parse(text) as unknown
              return sendJsonDev(res, upstream.status, data, trace)
            } catch {
              trace.log("upstream JSON parse failed")
            }
          }
          return sendJsonDev(
            res,
            upstream.status,
            { error: "RAGFlow retrieval", raw: text.slice(0, 2000) },
            trace
          )
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

        const rerankId =
          loadEnvLine("RAGFLOW_RERANK_ID") ||
          process.env.RAGFLOW_RERANK_ID?.trim() ||
          ""
        if (
          rerankId &&
          method === "POST" &&
          /^chats\/[^/]+\/completions$/.test(pathOnly) &&
          body.length > 0
        ) {
          try {
            const s = Buffer.from(body).toString("utf-8")
            const obj = JSON.parse(s) as Record<string, unknown>
            if (obj.rerank_id === undefined || obj.rerank_id === null) {
              obj.rerank_id = rerankId
              body = new Uint8Array(Buffer.from(JSON.stringify(obj), "utf-8"))
              trace.log("injected rerank_id for completions")
            }
          } catch {
            /* keep body */
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
