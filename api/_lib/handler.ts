import type { VercelRequest, VercelResponse } from "@vercel/node"
import { RequestTrace } from "./trace"

export { RequestTrace }

type HandlerFn = (
  req: VercelRequest,
  res: VercelResponse,
  trace: RequestTrace,
) => Promise<void>

interface HandlerOptions {
  methods?: string[]
}

/**
 * Enveloppe standard pour les fonctions Vercel :
 * - crée un RequestTrace automatiquement
 * - vérifie la méthode HTTP si opts.methods est défini
 * - attrape les erreurs non gérées → 500 avec debug
 */
export function defineHandler(fn: HandlerFn, opts?: HandlerOptions) {
  return async (req: VercelRequest, res: VercelResponse) => {
    const pathname = (req.url ?? "/").split("?")[0]
    const trace = new RequestTrace(`${req.method} ${pathname}`)

    if (opts?.methods && !opts.methods.includes(req.method ?? "")) {
      trace.log(`method not allowed: ${req.method}`)
      res.setHeader("Allow", opts.methods.join(", "))
      return sendJson(res, 405, { error: "Method not allowed" }, trace)
    }

    try {
      await fn(req, res, trace)
    } catch (err) {
      trace.log(`unhandled: ${err}`)
      if (!res.headersSent) {
        sendJson(res, 500, {
          error: "Internal server error",
          detail: String(err),
        }, trace)
      }
    }
  }
}

/**
 * Envoie une réponse JSON avec la clé `debug` injectée automatiquement.
 * Si `data` est un objet, `debug` est fusionné dedans.
 * Sinon `data` est enveloppé dans `{ data, debug }`.
 */
export function sendJson(
  res: VercelResponse,
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
  res.status(status).json(body)
}
