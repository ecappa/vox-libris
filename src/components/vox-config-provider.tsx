import * as React from "react"
import {
  FALLBACK_ASSISTANTS,
  type VoxPublicAssistant,
} from "@/lib/vox-public-config"

type VoxConfigState = {
  assistants: VoxPublicAssistant[]
  ready: boolean
}

const VoxConfigContext = React.createContext<VoxConfigState>({
  assistants: FALLBACK_ASSISTANTS,
  ready: false,
})

export function useVoxPublicConfig() {
  return React.useContext(VoxConfigContext)
}

async function establishSession(): Promise<void> {
  const res = await fetch("/api/session", {
    method: "GET",
    credentials: "include",
  })
  if (!res.ok && res.status !== 204) {
    throw new Error(`Session gateway: ${res.status}`)
  }
}

export function VoxConfigProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [assistants, setAssistants] =
    React.useState<VoxPublicAssistant[]>(FALLBACK_ASSISTANTS)
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await establishSession()
        const res = await fetch("/api/vox/config", { credentials: "include" })
        if (!res.ok) throw new Error(String(res.status))
        const data = (await res.json()) as { assistants?: VoxPublicAssistant[] }
        if (
          !cancelled &&
          Array.isArray(data.assistants) &&
          data.assistants.length > 0
        ) {
          setAssistants(data.assistants)
        }
      } catch {
        /* garde FALLBACK_ASSISTANTS */
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const value = React.useMemo(
    () => ({ assistants, ready }),
    [assistants, ready]
  )

  return (
    <VoxConfigContext.Provider value={value}>
      {children}
    </VoxConfigContext.Provider>
  )
}
