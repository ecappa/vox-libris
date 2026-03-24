import fs from "node:fs"
import path from "node:path"
import type { Plugin } from "vite"

function loadApiKey(): string {
  const envPath = path.resolve(process.cwd(), ".env.local")
  const content = fs.readFileSync(envPath, "utf-8")
  const match = content.match(/^RAGFLOW_ADMIN_API_KEY=(.+)$/m)
  if (!match) throw new Error("RAGFLOW_ADMIN_API_KEY not found in .env.local")
  return match[1].trim()
}

const RAGFLOW_BASE = "https://ragflow.cappasoft.cloud/api/v1"

export function ragflowProxy(): Plugin {
  let apiKey: string

  return {
    name: "ragflow-proxy",
    configureServer(server) {
      apiKey = loadApiKey()

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/ragflow/")) return next()

        const ragflowPath = req.url.replace("/api/ragflow/", "")
        const targetUrl = `${RAGFLOW_BASE}/${ragflowPath}`

        try {
          const response = await fetch(targetUrl, {
            method: req.method,
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
          })

          const data = await response.text()
          res.setHeader("Content-Type", "application/json")
          res.setHeader("Cache-Control", "no-cache")
          res.statusCode = response.status
          res.end(data)
        } catch (err) {
          res.statusCode = 502
          res.end(
            JSON.stringify({
              error: "RAGFlow proxy error",
              detail: String(err),
            })
          )
        }
      })
    },
  }
}
