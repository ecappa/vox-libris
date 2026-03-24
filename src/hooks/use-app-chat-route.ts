import * as React from "react"

function readChatParam(): string {
  const q = new URLSearchParams(window.location.search)
  const id = (q.get("chat") ?? "").trim()
  return id
}

export function useAppChatRoute() {
  const [chatId, setChatIdState] = React.useState<string>(() =>
    typeof window === "undefined" ? "" : readChatParam()
  )

  const setChatId = React.useCallback((id: string | null) => {
    const u = new URL(window.location.href)
    const next = (id ?? "").trim()
    if (next) u.searchParams.set("chat", next)
    else u.searchParams.delete("chat")
    window.history.pushState({}, "", u)
    setChatIdState(next)
  }, [])

  React.useEffect(() => {
    const onPop = () => setChatIdState(readChatParam())
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])

  return {
    chatId,
    setChatId,
    isChatRoute: Boolean(chatId),
  }
}
