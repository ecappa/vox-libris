import fs from "node:fs"
import path from "node:path"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { Plugin } from "vite"

function loadApiKey(): string {
  const envPath = path.resolve(process.cwd(), ".env.local")
  const content = fs.readFileSync(envPath, "utf-8")
  const match = content.match(/^RAGFLOW_ADMIN_API_KEY=(.+)$/m)
  if (!match) throw new Error("RAGFLOW_ADMIN_API_KEY not found in .env.local")
  return match[1].trim()
}

const RAGFLOW_BASE = "https://ragflow.cappasoft.cloud/api/v1"

const BODY_LIMIT = 12 * 1024 * 1024

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
  req: IncomingMessage,
  res: ServerResponse,
  targetUrl: string,
  method: string,
  body: Uint8Array,
  apiKey: string
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
    body: body.length > 0 ? body : undefined,
  })

  if (
    streamRequest &&
    response.body &&
    response.ok
  ) {
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

export function ragflowProxy(): Plugin {
  let apiKey = ""
  return {
    name: "ragflow-proxy",
    configureServer(server) {
      apiKey = loadApiKey()
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/ragflow/")) return next()

        const method = (req.method ?? "GET").toUpperCase()
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

        const pathWithQuery = req.url.replace(/^\/api\/ragflow\/?/, "")
        const targetUrl = `${RAGFLOW_BASE}/${pathWithQuery}`

        try {
          await forwardToRagflow(req, res, targetUrl, method, body, apiKey)
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
