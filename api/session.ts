import type { VercelRequest, VercelResponse } from "@vercel/node"
import {
  buildSessionSetCookieHeader,
  getGatewaySecret,
  issueSessionToken,
} from "./lib/ragflow-gateway"

/**
 * Émet un cookie de session signé (aucune clé RAGFlow exposée au client).
 * Le navigateur doit appeler cette route avec credentials: 'include' avant le proxy RAGFlow.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const secret = getGatewaySecret()
  if (!secret) {
    return res.status(500).json({
      error: "Gateway misconfigured",
      detail: "VOX_GATEWAY_SECRET or RAGFLOW_ADMIN_API_KEY must be set server-side",
    })
  }

  const token = issueSessionToken(secret)
  const secure = process.env.VERCEL === "1" || process.env.NODE_ENV === "production"
  res.setHeader("Set-Cookie", buildSessionSetCookieHeader(token, secure))
  res.setHeader("Cache-Control", "no-store")
  return res.status(204).end()
}
