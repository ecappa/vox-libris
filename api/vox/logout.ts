import { defineHandler, sendJson } from "../_lib/handler"
import {
  buildAppGateClearCookieHeader,
  buildSessionClearCookieHeader,
} from "../_lib/ragflow-gateway"

export default defineHandler(
  async (_req, res, trace) => {
    const secure =
      process.env.VERCEL === "1" || process.env.NODE_ENV === "production"
    trace.log(`clear cookies: secure=${secure}`)

    res.setHeader("Set-Cookie", [
      buildAppGateClearCookieHeader(secure),
      buildSessionClearCookieHeader(secure),
    ])
    res.setHeader("Cache-Control", "no-store")
    return sendJson(res, 200, { ok: true }, trace)
  },
  { methods: ["POST"] },
)
