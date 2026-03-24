import * as React from "react"
import { AUTHORS, type AuthorConfig } from "@/lib/authors"
import {
  fetchVoxRetrieval,
  pickChunkDocName,
  pickChunkText,
  type RetrievalChunkLike,
} from "@/lib/vox-retrieval"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SearchIcon, Loader2Icon } from "lucide-react"

export function AdvancedSearchView({
  initialAuthorId,
}: {
  initialAuthorId: string
}) {
  const [authorId, setAuthorId] = React.useState(initialAuthorId)
  const [question, setQuestion] = React.useState("")
  const [oeuvreFilter, setOeuvreFilter] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [chunks, setChunks] = React.useState<RetrievalChunkLike[]>([])

  React.useEffect(() => {
    setAuthorId(initialAuthorId)
  }, [initialAuthorId])

  const author: AuthorConfig =
    AUTHORS.find((a) => a.id === authorId) ?? AUTHORS[0]

  const runSearch = React.useCallback(async () => {
    const q = question.trim()
    if (!q) {
      setError("Saisissez une requête.")
      return
    }
    setLoading(true)
    setError(null)
    setChunks([])
    try {
      const metadata_condition =
        oeuvreFilter.trim().length > 0
          ? {
              logic: "and" as const,
              conditions: [
                {
                  name: "oeuvre",
                  comparison_operator: "=",
                  value: oeuvreFilter.trim(),
                },
              ],
            }
          : undefined

      const res = await fetchVoxRetrieval({
        question: q,
        dataset_ids: [author.datasetId],
        metadata_condition,
        top_k: 16,
      })
      if (res.code !== 0) {
        throw new Error(res.message ?? `Code ${res.code}`)
      }
      const list = res.data?.chunks
      setChunks(Array.isArray(list) ? list : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [author.datasetId, oeuvreFilter, question])

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <Card className="max-w-3xl">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <SearchIcon className="mt-0.5 size-7 shrink-0 text-primary" />
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-lg">Recherche dans le corpus</CardTitle>
            <p className="text-sm text-muted-foreground">
              Requête hybride (mots-clés + sémantique), surlignage et rerank
              côté serveur lorsque{" "}
              <code className="rounded bg-muted px-1 text-xs">
                RAGFLOW_RERANK_ID
              </code>{" "}
              est défini. Filtre par titre d&apos;œuvre si les métadonnées
              RAGFlow sont renseignées.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="adv-author">Auteur / jeu de données</Label>
              <Select value={authorId} onValueChange={setAuthorId}>
                <SelectTrigger id="adv-author">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUTHORS.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adv-oeuvre">
                Filtre œuvre (optionnel, métadonnée{" "}
                <span className="font-mono text-xs">oeuvre</span>)
              </Label>
              <Input
                id="adv-oeuvre"
                placeholder="ex. Les Misérables"
                value={oeuvreFilter}
                onChange={(e) => setOeuvreFilter(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="adv-q">Requête</Label>
            <Input
              id="adv-q"
              placeholder="ex. barricade rue de la Chanvrerie"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) void runSearch()
              }}
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="button" disabled={loading} onClick={() => void runSearch()}>
            {loading ? (
              <>
                <Loader2Icon className="mr-2 size-4 animate-spin" />
                Recherche...
              </>
            ) : (
              <>
                <SearchIcon className="mr-2 size-4" />
                Chercher
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {chunks.length > 0 ? (
        <div className="flex max-w-3xl flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            {chunks.length} passage{chunks.length > 1 ? "s" : ""}
          </h2>
          <ul className="flex flex-col gap-3">
            {chunks.map((c, i) => {
              const text = pickChunkText(c)
              const title = pickChunkDocName(c)
              const sim =
                typeof c.similarity === "number"
                  ? c.similarity.toFixed(4)
                  : null
              return (
                <li key={`${title}-${i}`}>
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm font-medium leading-snug">
                        {title}
                        {sim ? (
                          <span className="ml-2 font-normal text-muted-foreground">
                            (score {sim})
                          </span>
                        ) : null}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 font-sans text-xs leading-relaxed">
                        {text || JSON.stringify(c, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
