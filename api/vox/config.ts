import type { VercelRequest, VercelResponse } from "@vercel/node"
import { getPublicAssistantsFromEnv } from "../lib/ragflow-gateway"

/**
 * Configuration lisible par le front (IDs d’assistants, libellés) — pas de secrets.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    return res.status(405).json({ error: "Method not allowed" })
  }

  res.setHeader("Content-Type", "application/json")
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300")
  return res.status(200).json({
    assistants: getPublicAssistantsFromEnv(),
  })
}
