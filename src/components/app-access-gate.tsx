import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type GateState = "checking" | "login" | "ready" | "error"

async function readJsonSafe(res: Response): Promise<Record<string, unknown>> {
  try {
    const data = (await res.json()) as unknown
    return data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

export function AppAccessGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<GateState>("checking")
  const [password, setPassword] = React.useState("")
  const [loginError, setLoginError] = React.useState<string | null>(null)
  const [blockMessage, setBlockMessage] = React.useState<string | null>(null)

  const trySession = React.useCallback(async () => {
    const res = await fetch("/api/session", { credentials: "include" })
    if (res.ok) {
      setState("ready")
      setBlockMessage(null)
      return
    }
    const body = await readJsonSafe(res)
    if (res.status === 401 && body.code === "APP_GATE") {
      setState("login")
      setBlockMessage(null)
      return
    }
    setState("error")
    const err =
      typeof body.error === "string" ? body.error : `Erreur ${res.status}`
    setBlockMessage(err)
  }, [])

  React.useEffect(() => {
    void trySession()
  }, [trySession])

  async function onLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginError(null)
    const res = await fetch("/api/vox/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })
    if (!res.ok) {
      const data = await readJsonSafe(res)
      setLoginError(
        typeof data.error === "string" ? data.error : "Mot de passe refusé"
      )
      return
    }
    setPassword("")
    await trySession()
  }

  if (state === "checking") {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <p className="text-muted-foreground text-sm font-medium">
          Vérification de l’accès…
        </p>
      </div>
    )
  }

  if (state === "error") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="font-heading text-xl">
              Accès impossible
            </CardTitle>
            <CardDescription>
              {blockMessage ?? "Une erreur est survenue."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (state === "login") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="font-heading text-2xl tracking-tight">
              Vox Libris
            </CardTitle>
            <CardDescription>
              Mot de passe requis pour ouvrir l’application et les appels au
              modèle de dialogue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="vox-app-pw">Mot de passe</Label>
                <Input
                  id="vox-app-pw"
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(ev) => setPassword(ev.target.value)}
                  required
                />
              </div>
              {loginError ? (
                <p className="text-destructive text-sm">{loginError}</p>
              ) : null}
              <Button type="submit" className="w-full rounded-full">
                Entrer
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}
