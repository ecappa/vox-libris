import { defineHandler, sendJson } from "./_lib/handler"
import type { VercelRequest } from "@vercel/node"
import {
  APP_GATE_COOKIE_NAME,
  buildSessionSetCookieHeader,
  getAppAccessPassword,
  getGatewaySecret,
  issueSessionToken,
  parseCookieHeader,
  verifyAppGateToken,
} from "./_lib/ragflow-gateway"

export default defineHandler(
  async (req: VercelRequest, res, trace) => {
    const secret = getGatewaySecret()
    trace.log(secret ? "gateway secret: OK" : "gateway secret: MISSING")

    if (!secret) {
      return sendJson(res, 500, {
        error: "Gateway misconfigured",
        detail:
          "VOX_GATEWAY_SECRET or RAGFLOW_ADMIN_API_KEY must be set server-side",
      }, trace)
    }

    const appPwd = getAppAccessPassword()
    if (appPwd) {
      const hdr =
        typeof req.headers.cookie === "string" ? req.headers.cookie : undefined
      const gateTok = parseCookieHeader(hdr, APP_GATE_COOKIE_NAME)
      const gateOk = verifyAppGateToken(gateTok, secret)
      trace.log(`app gate: ${gateOk ? "valid" : "required"}`)
      if (!gateOk) {
        res.setHeader("Cache-Control", "no-store")
        return sendJson(
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

    const token = issueSessionToken(secret)
    trace.log("session token issued")

    const secure =
      process.env.VERCEL === "1" || process.env.NODE_ENV === "production"
    trace.log(`cookie: secure=${secure}`)

    res.setHeader("Set-Cookie", buildSessionSetCookieHeader(token, secure))
    res.setHeader("Cache-Control", "no-store")
    return sendJson(res, 200, { ok: true }, trace)
  },
  { methods: ["GET"] },
)
