---
name: vercel-backend
description: >-
  Write and maintain Vercel serverless functions with debug trace, CommonJS compatibility,
  and shared utilities in api/_lib/. Use when creating, editing, or debugging backend
  API routes in api/, writing Vite dev middleware in src/server/, or troubleshooting
  Vercel deployment errors (ERR_MODULE_NOT_FOUND, FUNCTION_INVOCATION_FAILED).
---

# Vercel Backend Functions

## Architecture

```
api/
  package.json          ← { "type": "commonjs" }  OBLIGATOIRE
  _lib/                 ← préfixe _ = Vercel ignore (pas une function)
    trace.ts            ← RequestTrace
    handler.ts          ← defineHandler + sendJson
    ragflow-gateway.ts  ← session HMAC, allowlist, assistants
  session.ts            ← GET /api/session
  ragflow.ts            ← proxy RAGFlow
  vox/config.ts         ← GET /api/vox/config
src/server/
  vox-backend-gateway.ts ← middleware Vite (même contrat)
```

## Créer une nouvelle function

### 1. Créer le fichier dans `api/`

```typescript
import { defineHandler, sendJson } from "./_lib/handler"

export default defineHandler(
  async (req, res, trace) => {
    trace.log("description de l'étape")
    const result = doSomething()
    trace.log(`result: ${result.length} items`)
    return sendJson(res, 200, { items: result }, trace)
  },
  { methods: ["GET"] },
)
```

### 2. Règles obligatoires

- **Toujours** utiliser `defineHandler()` — il crée le `RequestTrace`, vérifie la méthode HTTP, attrape les erreurs
- **Toujours** utiliser `sendJson()` pour les réponses JSON — injecte automatiquement la clé `debug`
- **Jamais** appeler `res.json()` directement
- **Jamais** retourner 204 (no content) — retourner 200 avec body JSON pour inclure le `debug`
- **Jamais** créer un fichier dans `api/` sans préfixe `_` s'il ne doit pas être une function

### 3. Imports

Pas d'extension de fichier dans les imports :

```typescript
// Correct
import { sendJson } from "./_lib/handler"
import { getGatewaySecret } from "./_lib/ragflow-gateway"

// INCORRECT — provoque ERR_MODULE_NOT_FOUND sur Vercel
import { sendJson } from "./_lib/handler.ts"
import { sendJson } from "./_lib/handler.js"
```

### 4. Sous-répertoires

Pour `api/vox/config.ts`, ajuster le chemin relatif :

```typescript
import { defineHandler, sendJson } from "../_lib/handler"
```

## Debug trace

Chaque réponse JSON contient une clé `debug` :

```json
{
  "ok": true,
  "debug": {
    "route": "GET /api/session",
    "total_ms": 12,
    "ts": "2026-03-24T10:00:00.000Z",
    "entries": [
      { "t": 0, "msg": "→ GET /api/session" },
      { "t": 1, "msg": "gateway secret: OK" },
      { "t": 5, "msg": "session token issued" },
      { "t": 12, "msg": "← 200" }
    ]
  }
}
```

Pour le streaming SSE (impossible d'ajouter une clé JSON) :

```typescript
res.setHeader("X-Vox-Debug", JSON.stringify(trace.toJSON()))
await pipeline(Readable.fromWeb(response.body), res)
```

### Bonnes pratiques trace

- Logger l'existence des secrets, pas leur valeur : `trace.log(apiKey ? "KEY: OK" : "KEY: MISSING")`
- Logger la taille des données, pas le contenu : `trace.log(`body: ${bodyStr.length} bytes`)`
- Logger chaque décision de branchement : `trace.log(`allowlist: ${allowed ? "OK" : "DENIED"}`)`
- **ASCII uniquement** dans les messages — pas de `→`, `←`, `…`. Utiliser `->`, `<-`, `...`. Le header `X-Vox-Debug` rejette tout caractère hors `\x20-\x7E`
- Utiliser `trace.toHeaderValue()` pour le header (sanitise automatiquement)

## Middleware Vite local

Le fichier `src/server/vox-backend-gateway.ts` est le miroir local des functions Vercel.
Même contrat :

- Créer un `new RequestTrace(route)` par requête
- Utiliser `sendJsonDev()` au lieu de `sendJson()` (même signature, mais écrit sur `ServerResponse` brut)
- Même format `debug` dans chaque réponse

```typescript
function sendJsonDev(
  res: ServerResponse,
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
  res.statusCode = status
  res.setHeader("Content-Type", "application/json")
  res.end(JSON.stringify(body))
}
```

## Erreurs fréquentes Vercel

| Erreur | Cause | Fix |
|--------|-------|-----|
| `ERR_MODULE_NOT_FOUND` | Import avec extension ou sans `api/package.json` | Ajouter `{"type":"commonjs"}` dans `api/package.json`, retirer les extensions des imports |
| `FUNCTION_INVOCATION_FAILED` | Crash au runtime (secret manquant, import cassé) | Lire les logs Vercel (`vercel logs <url>`), vérifier les env vars |
| Fichier `_lib` déployé comme function | Pas de préfixe `_` | Renommer le dossier/fichier avec `_` |
| Timeout sur streaming | Function dépasse 10s (plan free) | Plan Pro (60s) ou déplacer vers un serveur long-lived |

## Checklist nouvelle function

- [ ] Fichier dans `api/` (ou sous-dossier)
- [ ] Utilise `defineHandler()` + `sendJson()`
- [ ] Imports sans extension depuis `_lib/`
- [ ] `trace.log()` à chaque étape significative
- [ ] Secrets jamais dans les traces
- [ ] `api/package.json` existe avec `{"type": "commonjs"}`
- [ ] Equivalent local dans le middleware Vite si nécessaire
- [ ] `tsconfig.node.json` inclut `api/_lib/**/*.ts`
