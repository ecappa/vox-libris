import type { VercelRequest } from "@vercel/node"
import { timingSafeEqual } from "node:crypto"
import { defineHandler, sendJson } from "../_lib/handler"
import {
  buildAppGateSetCookieHeader,
  getAppAccessPassword,
  getGatewaySecret,
  issueAppGateToken,
} from "../_lib/ragflow-gateway"

function parseBody(req: VercelRequest): unknown {
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

function readPassword(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined
  const p = (body as Record<string, unknown>).password
  return typeof p === "string" ? p : undefined
}

function passwordOk(expected: string, given: string): boolean {
  const a = Buffer.from(expected, "utf8")
  const b = Buffer.from(given, "utf8")
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export default defineHandler(
  async (req: VercelRequest, res, trace) => {
    const expected = getAppAccessPassword()
    if (!expected) {
      trace.log("VOX_APP_ACCESS_PASSWORD: not set")
      return sendJson(
        res,
        400,
        { error: "App password not configured on server" },
        trace
      )
    }

    const secret = getGatewaySecret()
    trace.log(secret ? "gateway secret: OK" : "gateway secret: MISSING")
    if (!secret) {
      return sendJson(res, 500, {
        error: "Gateway misconfigured",
        detail:
          "VOX_GATEWAY_SECRET or RAGFLOW_ADMIN_API_KEY must be set server-side",
      }, trace)
    }

    const body = parseBody(req)
    const given = readPassword(body)
    trace.log(`body password field: ${given != null ? "present" : "missing"}`)

    if (given == null || !passwordOk(expected, given)) {
      trace.log("login: denied")
      return sendJson(res, 401, { error: "Invalid password" }, trace)
    }

    const token = issueAppGateToken(secret)
    trace.log("app gate cookie issued")

    const secure =
      process.env.VERCEL === "1" || process.env.NODE_ENV === "production"
    trace.log(`cookie: secure=${secure}`)

    res.setHeader("Set-Cookie", buildAppGateSetCookieHeader(token, secure))
    res.setHeader("Cache-Control", "no-store")
    return sendJson(res, 200, { ok: true }, trace)
  },
  { methods: ["POST"] },
)
