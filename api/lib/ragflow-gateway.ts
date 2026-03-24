/**
 * Passerelle RAGFlow : allowlist + session signée (cookie HttpOnly).
 * Utilisé par api/ragflow (Vercel) et le middleware Vite — aucune clé dans le front.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

export const SESSION_COOKIE_NAME = "vox_gateway"

const SESSION_TTL_SEC = 60 * 60 * 24

export type PublicAssistant = {
  id: string
  label: string
  description: string
}

const DEFAULT_ASSISTANTS: PublicAssistant[] = [
  {
    id: "79a5a94a273c11f1a5a87db1341041f4",
    label: "Mode jeune",
    description: "Ton accessible, découverte des œuvres",
  },
  {
    id: "9c9b99a8272011f1a5a87db1341041f4",
    label: "Mode érudit",
    description: "Analyse précise et références au corpus",
  },
]

export function getGatewaySecret(): string {
  const a = process.env.VOX_GATEWAY_SECRET?.trim()
  const b = process.env.RAGFLOW_ADMIN_API_KEY?.trim()
  return a || b || ""
}

export function issueSessionToken(secret: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      v: 1,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SEC,
      iat: Math.floor(Date.now() / 1000),
      jti: randomBytes(16).toString("hex"),
    }),
    "utf-8"
  ).toString("base64url")
  const sig = createHmac("sha256", secret).update(payload).digest("base64url")
  return `${payload}.${sig}`
}

export function verifySessionToken(
  token: string | undefined,
  secret: string
): boolean {
  if (!secret || !token?.includes(".")) return false
  const dot = token.lastIndexOf(".")
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  if (!payload || !sig) return false
  const expected = createHmac("sha256", secret).update(payload).digest("base64url")
  try {
    if (expected.length !== sig.length) return false
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return false
  } catch {
    return false
  }
  try {
    const body = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf-8")
    ) as { exp?: number }
    if (typeof body.exp !== "number") return false
    if (body.exp < Math.floor(Date.now() / 1000)) return false
    return true
  } catch {
    return false
  }
}

export function parseCookieHeader(
  header: string | undefined,
  name: string
): string | undefined {
  if (!header) return undefined
  const parts = header.split(";")
  for (const p of parts) {
    const [k, ...rest] = p.trim().split("=")
    if (k === name) return rest.join("=").trim() || undefined
  }
  return undefined
}

/**
 * Seules les routes nécessaires au SPA sont exposées (pas d’admin arbitraire).
 */
export function isAllowedRagflowProxy(
  method: string,
  pathWithQuery: string
): boolean {
  const path = pathWithQuery.split("?")[0].replace(/\/+$/, "") || ""
  const m = method.toUpperCase()

  if (m === "GET" && path === "datasets") return true
  if (m === "GET" && /^datasets\/[^/]+\/documents$/.test(path)) return true
  if (m === "POST" && /^chats\/[^/]+\/sessions$/.test(path)) return true
  if (m === "POST" && /^chats\/[^/]+\/completions$/.test(path)) return true

  return false
}

export function getPublicAssistants(
  envJsonOverride?: string | null
): PublicAssistant[] {
  const raw =
    (envJsonOverride ?? process.env.RAGFLOW_PUBLIC_ASSISTANTS)?.trim() ?? ""
  if (!raw) return DEFAULT_ASSISTANTS
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_ASSISTANTS
    const out: PublicAssistant[] = []
    for (const row of parsed) {
      if (
        row &&
        typeof row === "object" &&
        typeof (row as PublicAssistant).id === "string" &&
        typeof (row as PublicAssistant).label === "string"
      ) {
        out.push({
          id: (row as PublicAssistant).id,
          label: (row as PublicAssistant).label,
          description:
            typeof (row as PublicAssistant).description === "string"
              ? (row as PublicAssistant).description
              : "",
        })
      }
    }
    return out.length > 0 ? out : DEFAULT_ASSISTANTS
  } catch {
    return DEFAULT_ASSISTANTS
  }
}

/** Alias Vercel : uniquement variables d’environnement hébergées. */
export function getPublicAssistantsFromEnv(): PublicAssistant[] {
  return getPublicAssistants()
}

export function buildSessionSetCookieHeader(
  token: string,
  secure: boolean
): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL_SEC}`,
  ]
  if (secure) parts.push("Secure")
  return parts.join("; ")
}
