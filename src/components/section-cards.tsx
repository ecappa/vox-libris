"use client"

import { AnimatePresence, motion } from "motion/react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  BookOpenIcon,
  LayersIcon,
  DatabaseIcon,
  RefreshCwIcon,
} from "lucide-react"
import type { RagflowDataset } from "@/lib/ragflow"

const EASE_OUT = [0.22, 1, 0.36, 1] as const
const EASE_IN = [0.4, 0, 0.2, 1] as const

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.04,
    },
  },
}

const item = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: EASE_OUT },
  },
}

interface SectionCardsProps {
  dataset: RagflowDataset | null
  authorId: string
  authorName: string
  statusCounts: Record<string, number>
  totalDocs: number
  readyCount: number
  totalAuthors: number
  loading: boolean
  onRefresh: () => void
}

function formatNumber(n: number) {
  return n.toLocaleString("fr-FR")
}

export function SectionCards({
  dataset,
  authorId,
  authorName,
  statusCounts,
  totalDocs,
  readyCount,
  totalAuthors,
  loading,
  onRefresh,
}: SectionCardsProps) {
  const docCount = dataset?.document_count ?? 0
  const chunkCount = dataset?.chunk_count ?? 0
  const tokenCount = dataset?.token_num ?? 0
  const doneCount = statusCounts["DONE"] ?? 0
  const runningCount = statusCounts["RUNNING"] ?? 0
  const failCount = statusCounts["FAIL"] ?? 0

  const gridClass =
    "grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:shadow-xs md:grid-cols-2 lg:px-6"

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={authorId}
        className={gridClass}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{
          opacity: 0,
          y: -10,
          transition: { duration: 0.32, ease: EASE_IN },
        }}
        transition={{ duration: 0.4, ease: EASE_OUT }}
      >
        <motion.div
          className="contents"
          variants={container}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={item}>
            <Card className="@container/card">
              <CardHeader>
                <CardDescription>Documents</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                  {formatNumber(docCount)}
                </CardTitle>
                <CardAction>
                  <Badge variant="outline">
                    <BookOpenIcon className="size-3" />
                    {authorName}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardFooter className="flex-col items-start gap-1.5 text-sm">
                <p className="text-xs leading-snug text-muted-foreground">
                  Fichiers sources (œuvre ou chapitre) enregistrés dans le jeu
                  de données RAGFlow pour l’auteur affiché.
                </p>
                <div className="line-clamp-1 flex gap-2 font-medium">
                  Dataset « {dataset?.name ?? "..."} »
                </div>
                <div className="text-muted-foreground">
                  Méthode : {dataset?.chunk_method ?? "..."} ·{" "}
                  {dataset?.language ?? "..."}
                </div>
              </CardFooter>
            </Card>
          </motion.div>
          <motion.div variants={item}>
            <Card className="@container/card">
              <CardHeader>
                <CardDescription>Statut d'indexation</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                  {totalDocs > 0 ? `${doneCount}/${totalDocs}` : "—"}
                </CardTitle>
                <CardAction>
                  <Badge variant="outline">
                    <DatabaseIcon className="size-3" />
                    {totalDocs === 0
                      ? "vide"
                      : doneCount === totalDocs
                        ? "terminé"
                        : "en cours"}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardFooter className="flex-col items-start gap-1.5 text-sm">
                <p className="text-xs leading-snug text-muted-foreground">
                  Avancement du traitement des documents : découpage, embeddings
                  et mise à jour de l’index pour la recherche.
                </p>
                <div className="flex w-full items-center justify-between">
                  <div className="line-clamp-1 flex gap-2 font-medium">
                    {totalDocs > 0
                      ? `${doneCount} terminés · ${runningCount} en cours · ${failCount} erreurs`
                      : "Aucun document uploadé"}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    onClick={onRefresh}
                    disabled={loading}
                  >
                    <RefreshCwIcon
                      className={`size-3.5 ${loading ? "animate-spin" : ""}`}
                    />
                    <span className="sr-only">Rafraîchir</span>
                  </Button>
                </div>
                <div className="text-muted-foreground">
                  Progression de l'indexation
                </div>
              </CardFooter>
            </Card>
          </motion.div>
          <motion.div variants={item}>
            <Card className="@container/card">
              <CardHeader>
                <CardDescription>Chunks</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                  {formatNumber(chunkCount)}
                </CardTitle>
                <CardAction>
                  <Badge variant="outline">
                    <LayersIcon className="size-3" />
                    {dataset?.chunk_method ?? "..."}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardFooter className="flex-col items-start gap-1.5 text-sm">
                <p className="text-xs leading-snug text-muted-foreground">
                  Segments de texte issus du découpage : ce sont eux que le
                  moteur interroge quand vous posez une question.
                </p>
                <div className="line-clamp-1 flex gap-2 font-medium">
                  {formatNumber(tokenCount)} tokens
                </div>
                <div className="text-muted-foreground">
                  Embedding : {dataset?.embedding_model ?? "..."}
                </div>
              </CardFooter>
            </Card>
          </motion.div>
          <motion.div variants={item}>
            <Card className="@container/card">
              <CardHeader>
                <CardDescription>Datasets RAGFlow</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                  {`${readyCount} / ${totalAuthors}`}
                </CardTitle>
                <CardAction>
                  <Badge variant="outline">
                    {readyCount === totalAuthors ? "complet" : "en attente"}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardFooter className="flex-col items-start gap-1.5 text-sm">
                <p className="text-xs leading-snug text-muted-foreground">
                  Vue d’ensemble des trois corpus : chaque auteur a son propre
                  jeu de données dans RAGFlow.
                </p>
                <div className="line-clamp-1 flex gap-2 font-medium">
                  {readyCount === totalAuthors
                    ? "Tous les auteurs sont prêts"
                    : `${totalAuthors - readyCount} auteur(s) sans documents`}
                </div>
                <div className="text-muted-foreground">
                  {totalAuthors} auteurs au total dans le corpus
                </div>
              </CardFooter>
            </Card>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
