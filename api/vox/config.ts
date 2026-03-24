import { defineHandler, sendJson } from "../_lib/handler"
import { getPublicAssistantsFromEnv } from "../_lib/ragflow-gateway"

export default defineHandler(
  async (_req, res, trace) => {
    const assistants = getPublicAssistantsFromEnv()
    trace.log(`loaded ${assistants.length} assistant(s)`)

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300",
    )
    return sendJson(res, 200, { assistants }, trace)
  },
  { methods: ["GET"] },
)
