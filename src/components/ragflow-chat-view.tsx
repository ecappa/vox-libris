import * as React from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  ArrowLeftIcon,
  MessageSquareIcon,
  RotateCcwIcon,
  SendIcon,
  ChevronDownIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useVoxPublicConfig } from "@/components/vox-config-provider"
import { cn } from "@/lib/utils"
import { resolvePresetForChatId } from "@/lib/vox-public-config"
import {
  chatCompletionStream,
  createChatSession,
  uniqueSourceLabels,
  type CompletionExtras,
  type RagflowReference,
} from "@/lib/ragflow-chat"

const SESSION_PREFIX = "voxlibris.ragflow.session.v1."

function sessionStorageKey(chatId: string) {
  return `${SESSION_PREFIX}${chatId}`
}

type ChatMessage =
  | { role: "user"; id: string; text: string }
  | {
      role: "assistant"
      id: string
      text: string
      sources: string[]
      streaming?: boolean
    }

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function AnswerBody({ text }: { text: string }) {
  const parts = text.split(/(\[ID:\d+\])/g)
  return (
    <>
      {parts.map((part, i) =>
        /^\[ID:\d+\]$/.test(part) ? (
          <span
            key={i}
            className="ml-px align-super text-[0.62rem] text-muted-foreground/40 font-mono tabular-nums"
            aria-hidden
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

/**
 * Révèle progressivement le texte pour un effet de typing naturel.
 * Le texte cumulatif arrive via props ; l'affichage rattrape progressivement.
 * Quand streaming passe à false, tout le texte restant est révélé.
 */
function TypewriterText({
  text,
  streaming,
}: {
  text: string
  streaming: boolean
}) {
  const [revealed, setRevealed] = React.useState(streaming ? 0 : text.length)
  const revealedRef = React.useRef(revealed)
  const targetRef = React.useRef(text)
  const rafRef = React.useRef(0)

  targetRef.current = text

  React.useEffect(() => {
    if (!streaming) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
      revealedRef.current = text.length
      setRevealed(text.length)
      return
    }

    function tick() {
      const cur = revealedRef.current
      const target = targetRef.current.length
      if (cur < target) {
        const gap = target - cur
        const step = Math.max(1, Math.min(5, Math.ceil(gap / 10)))
        const next = Math.min(cur + step, target)
        revealedRef.current = next
        setRevealed(next)
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }, [streaming, text.length])

  const display = streaming ? text.slice(0, revealed) : text

  return (
    <>
      <AnswerBody text={display} />
      {streaming && revealed < text.length && (
        <span className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[0.15em] animate-pulse bg-foreground/60" />
      )}
    </>
  )
}

function ThinkingBubble() {
  return (
    <motion.div
      className="flex max-w-[min(100%,42rem)] gap-3"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        className="shrink-0 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm"
        aria-live="polite"
        aria-busy
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="size-1.5 rounded-full bg-muted-foreground/45"
                animate={{ opacity: [0.25, 1, 0.25], scale: [0.92, 1, 0.92] }}
                transition={{
                  duration: 1.1,
                  repeat: Infinity,
                  delay: i * 0.14,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            Lecture du corpus…
          </span>
        </div>
        <div className="mt-2.5 h-0.5 overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full w-2/5 rounded-full bg-foreground/18"
            initial={{ x: "-120%" }}
            animate={{ x: "280%" }}
            transition={{
              duration: 1.35,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>
      </div>
    </motion.div>
  )
}

interface RagflowChatViewProps {
  chatId: string
  onClose: () => void
  onChangeChat: (id: string) => void
}

export function RagflowChatView({
  chatId,
  onClose,
  onChangeChat,
}: RagflowChatViewProps) {
  const { assistants } = useVoxPublicConfig()
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [input, setInput] = React.useState("")
  const [slugFilter, setSlugFilter] = React.useState("")
  const [oeuvreHint, setOeuvreHint] = React.useState("")
  const [customChatId, setCustomChatId] = React.useState("")
  const [thinking, setThinking] = React.useState(false)
  const [sending, setSending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  React.useEffect(() => {
    setMessages([])
    setError(null)
  }, [chatId])

  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }, [messages, thinking])

  const preset = resolvePresetForChatId(assistants, chatId)

  const buildExtras = React.useCallback((): CompletionExtras => {
    const out: CompletionExtras = {}
    const hint = oeuvreHint.trim()
    if (hint) out.oeuvre = hint
    const slug = slugFilter.trim()
    if (slug) {
      out.metadata_condition = {
        logic: "and",
        conditions: [
          {
            name: "slug_oeuvre",
            comparison_operator: "=",
            value: slug,
          },
        ],
      }
    }
    return out
  }, [oeuvreHint, slugFilter])

  const ensureSession = React.useCallback(async () => {
    const key = sessionStorageKey(chatId)
    const existing = localStorage.getItem(key)
    if (existing) return existing
    const sid = await createChatSession(chatId, "Vox Libris")
    localStorage.setItem(key, sid)
    return sid
  }, [chatId])

  const sendMessage = React.useCallback(async () => {
    const text = input.trim()
    if (!text || sending) return

    setInput("")
    setError(null)
    setSending(true)
    setThinking(true)

    const userMsg: ChatMessage = {
      role: "user",
      id: newId(),
      text,
    }
    const assistantId = newId()
    setMessages((m) => [...m, userMsg])

    try {
      const sid = await ensureSession()
      const extras = buildExtras()

      await chatCompletionStream(
        chatId,
        sid,
        text,
        {
          onDelta: (fullText) => {
            setThinking(false)
            setMessages((m) => {
              const has = m.some(
                (msg) => msg.role === "assistant" && msg.id === assistantId
              )
              if (!has) {
                return [
                  ...m,
                  {
                    role: "assistant",
                    id: assistantId,
                    text: fullText,
                    sources: [],
                    streaming: true,
                  },
                ]
              }
              return m.map((msg) =>
                msg.role === "assistant" && msg.id === assistantId
                  ? { ...msg, text: fullText, streaming: true }
                  : msg
              )
            })
          },
          onFinal: (ref: RagflowReference | null) => {
            setThinking(false)
            const sources = uniqueSourceLabels(ref)
            setMessages((m) =>
              m.map((msg) =>
                msg.role === "assistant" && msg.id === assistantId
                  ? { ...msg, sources, streaming: false }
                  : msg
              )
            )
          },
          onError: (err) => {
            setThinking(false)
            setError(err.message)
            setMessages((m) =>
              m.filter(
                (msg) => !(msg.role === "assistant" && msg.id === assistantId)
              )
            )
          },
        },
        extras
      )

      setMessages((m) =>
        m.map((msg) =>
          msg.role === "assistant" && msg.id === assistantId
            ? { ...msg, streaming: false }
            : msg
        )
      )
    } catch (e) {
      setThinking(false)
      setError(e instanceof Error ? e.message : String(e))
      setMessages((m) => m.filter((msg) => msg.id !== userMsg.id))
    } finally {
      setSending(false)
      setThinking(false)
      textareaRef.current?.focus()
    }
  }, [input, sending, chatId, ensureSession, buildExtras])

  const resetConversation = React.useCallback(() => {
    localStorage.removeItem(sessionStorageKey(chatId))
    setMessages([])
    setError(null)
  }, [chatId])

  const applyCustomChatId = React.useCallback(() => {
    const id = customChatId.trim()
    if (id) onChangeChat(id)
  }, [customChatId, onChangeChat])

  return (
    <div className="flex h-[calc(100dvh-0px)] min-h-0 flex-col bg-background">
      <header className="flex shrink-0 flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0 rounded-full"
            onClick={onClose}
            aria-label="Retour au tableau de bord"
          >
            <ArrowLeftIcon className="size-4" />
          </Button>
          <div className="min-w-0">
            <h1
              className="truncate text-lg font-medium leading-tight sm:text-xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Dialogue
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {preset?.description ?? "Assistant RAGFlow personnalisé"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Select
            value={
              assistants.some((p) => p.id === chatId) ? chatId : "__custom__"
            }
            onValueChange={(v) => {
              if (v !== "__custom__") onChangeChat(v)
            }}
          >
            <SelectTrigger className="h-9 w-[min(100%,240px)] rounded-xl border-border bg-card text-left text-sm">
              <SelectValue placeholder="Choisir un assistant" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {assistants.map((p) => (
                <SelectItem key={p.id} value={p.id} className="rounded-lg">
                  {p.label}
                </SelectItem>
              ))}
              <SelectItem
                value="__custom__"
                disabled
                className="rounded-lg opacity-60"
              >
                ID personnalisé (options avancées)
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 gap-1 rounded-full text-muted-foreground"
            onClick={resetConversation}
          >
            <RotateCcwIcon className="size-3.5" />
            Nouvelle conversation
          </Button>
        </div>
      </header>

      <div className="border-b border-border/80 bg-muted/30 px-4 py-2.5 sm:px-6">
        <details className="group text-sm">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-muted-foreground transition-colors hover:text-foreground">
            <ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" />
            Options avancées
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="slug-filter" className="text-xs">
                Filtre slug œuvre
              </Label>
              <Input
                id="slug-filter"
                className="h-9 rounded-xl font-mono text-xs"
                placeholder="ex. les-miserables"
                value={slugFilter}
                onChange={(e) => setSlugFilter(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="oeuvre-hint" className="text-xs">
                Indice titre (prompt)
              </Label>
              <Input
                id="oeuvre-hint"
                className="h-9 rounded-xl text-xs"
                placeholder="ex. Les Misérables"
                value={oeuvreHint}
                onChange={(e) => setOeuvreHint(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <Label htmlFor="custom-chat" className="text-xs">
                ID assistant RAGFlow
              </Label>
              <div className="flex gap-2">
                <Input
                  id="custom-chat"
                  className="h-9 rounded-xl font-mono text-xs"
                  placeholder="UUID…"
                  value={customChatId}
                  onChange={(e) => setCustomChatId(e.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-9 shrink-0 rounded-full"
                  onClick={applyCustomChatId}
                >
                  OK
                </Button>
              </div>
            </div>
          </div>
        </details>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto scroll-smooth px-4 py-6 sm:px-6"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {messages.length === 0 && !thinking && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl border border-dashed border-border bg-card/50 px-5 py-8 text-center"
            >
              <MessageSquareIcon className="mx-auto mb-3 size-9 text-muted-foreground/60" />
              <p
                className="text-base font-medium"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Parlez avec le corpus
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Les réponses s’appuient sur les textes indexés dans RAGFlow.
                Le flux s’affiche au fil de la génération.
              </p>
            </motion.div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((msg) =>
              msg.role === "user" ? (
                <motion.div
                  key={msg.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-end"
                >
                  <div className="max-w-[min(100%,85%)] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground shadow-sm">
                    {msg.text}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key={msg.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="max-w-[min(100%,90%)] space-y-2">
                    <div
                      className={cn(
                        "rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3 text-sm leading-relaxed text-card-foreground shadow-sm",
                        msg.streaming && "border-foreground/10"
                      )}
                    >
                      {msg.text ? (
                        <TypewriterText
                          text={msg.text}
                          streaming={!!msg.streaming}
                        />
                      ) : msg.streaming ? (
                        <span className="text-muted-foreground">...</span>
                      ) : null}
                    </div>
                    {msg.sources.length > 0 && !msg.streaming && (
                      <details className="text-[11px] text-muted-foreground/80">
                        <summary className="cursor-pointer select-none text-muted-foreground/70 hover:text-muted-foreground">
                          Sources ({msg.sources.length})
                        </summary>
                        <ul className="mt-1.5 list-inside list-disc pl-0.5 opacity-90">
                          {msg.sources.map((s) => (
                            <li key={s} className="truncate font-mono text-[10px]">
                              {s}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                </motion.div>
              )
            )}
          </AnimatePresence>

          {thinking && <ThinkingBubble />}

          {error && (
            <div
              className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm text-destructive"
              role="alert"
            >
              {error}
            </div>
          )}
        </div>
      </div>

      <footer className="shrink-0 border-t border-border bg-card/80 px-4 py-3 backdrop-blur-sm sm:px-6">
        <div className="mx-auto flex max-w-3xl gap-2">
          <textarea
            ref={textareaRef}
            rows={1}
            className="min-h-11 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm shadow-sm outline-none transition-[box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            placeholder="Votre question…"
            value={input}
            disabled={sending}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                void sendMessage()
              }
            }}
          />
          <Button
            type="button"
            size="icon"
            className="h-11 w-11 shrink-0 rounded-full"
            disabled={sending || !input.trim()}
            onClick={() => void sendMessage()}
            aria-label="Envoyer"
          >
            <SendIcon className="size-4" />
          </Button>
        </div>
      </footer>
    </div>
  )
}
