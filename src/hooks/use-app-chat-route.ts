import * as React from "react"

export type ShellView = "reglages" | "aide"

function parseShellFromSearch(search: string): {
  chatId: string
  shellView: ShellView | null
} {
  const q = new URLSearchParams(search)
  const chat = (q.get("chat") ?? "").trim()
  if (chat) return { chatId: chat, shellView: null }
  const v = (q.get("view") ?? "").trim().toLowerCase()
  if (v === "reglages") return { chatId: "", shellView: "reglages" }
  if (v === "aide") return { chatId: "", shellView: "aide" }
  return { chatId: "", shellView: null }
}

export function useAppChatRoute() {
  const [state, setState] = React.useState(() =>
    typeof window === "undefined"
      ? { chatId: "", shellView: null as ShellView | null }
      : parseShellFromSearch(window.location.search)
  )

  const setChatId = React.useCallback((id: string | null) => {
    const u = new URL(window.location.href)
    u.searchParams.delete("view")
    const next = (id ?? "").trim()
    if (next) u.searchParams.set("chat", next)
    else u.searchParams.delete("chat")
    window.history.pushState({}, "", u)
    setState(parseShellFromSearch(u.search))
  }, [])

  const setShellView = React.useCallback(
    (view: "dashboard" | ShellView) => {
      const u = new URL(window.location.href)
      u.searchParams.delete("chat")
      if (view === "dashboard") u.searchParams.delete("view")
      else u.searchParams.set("view", view)
      window.history.pushState({}, "", u)
      setState(parseShellFromSearch(u.search))
    },
    []
  )

  React.useEffect(() => {
    const onPop = () =>
      setState(parseShellFromSearch(window.location.search))
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])

  return {
    chatId: state.chatId,
    setChatId,
    isChatRoute: Boolean(state.chatId),
    shellView: state.shellView,
    setShellView,
  }
}
