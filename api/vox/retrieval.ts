import type { VercelRequest } from "@vercel/node"
import { defineHandler, sendJson } from "../_lib/handler"
import {
  getGatewaySecret,
  parseCookieHeader,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "../_lib/ragflow-gateway"
import {
  buildRagflowRetrievalPayload,
  RAGFLOW_API_V1_BASE,
} from "../_lib/vox-retrieval-logic"

function parseJsonBody(req: VercelRequest): unknown {
  const b = req.body
  if (b == null) return null
  if (typeof b === "string") {
    try {
      return JSON.parse(b) as unknown
    } catch {
      return null
    }
  }
  return b
}

export default defineHandler(
  async (req, res, trace) => {
    const apiKey = process.env.RAGFLOW_ADMIN_API_KEY?.trim()
    trace.log(apiKey ? "RAGFLOW_ADMIN_API_KEY: OK" : "RAGFLOW_ADMIN_API_KEY: MISSING")
    if (!apiKey) {
      return sendJson(
        res,
        500,
        { error: "RAGFLOW_ADMIN_API_KEY not configured" },
        trace
      )
    }

    const gatewaySecret = getGatewaySecret()
    trace.log(gatewaySecret ? "gateway secret: OK" : "gateway secret: MISSING")
    if (!gatewaySecret) {
      return sendJson(
        res,
        500,
        {
          error: "Gateway misconfigured",
          detail: "VOX_GATEWAY_SECRET or RAGFLOW_ADMIN_API_KEY required",
        },
        trace
      )
    }

    const hdrCookie =
      typeof req.headers.cookie === "string" ? req.headers.cookie : undefined
    const cookieTok = parseCookieHeader(hdrCookie, SESSION_COOKIE_NAME)
    const sessionValid = verifySessionToken(cookieTok, gatewaySecret)
    trace.log(`session: ${sessionValid ? "valid" : "INVALID"}`)
    if (!sessionValid) {
      return sendJson(
        res,
        401,
        {
          error: "Session required",
          hint: "GET /api/session with credentials: include",
        },
        trace
      )
    }

    const raw = parseJsonBody(req)
    const built = buildRagflowRetrievalPayload(raw, process.env)
    if (!built.ok) {
      return sendJson(res, 400, { error: built.error }, trace)
    }

    trace.log(
      `retrieval: question ${built.body.question ? String((built.body.question as string).length) : 0} chars`
    )

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
        return sendJson(res, upstream.status, data, trace)
      } catch {
        trace.log("upstream JSON parse failed")
      }
    }

    return sendJson(
      res,
      upstream.status,
      { error: "RAGFlow retrieval", raw: text.slice(0, 2000) },
      trace
    )
  },
  { methods: ["POST"] }
)
