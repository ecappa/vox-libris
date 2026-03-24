import * as React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SectionCards } from "@/components/section-cards"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { RagflowChatView } from "@/components/ragflow-chat-view"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useAppChatRoute } from "@/hooks/use-app-chat-route"
import { useDatasets, useDocuments } from "@/hooks/use-ragflow"
import { AUTHORS, resolveTitle } from "@/lib/authors"
import { FadeIn } from "@/components/fade-in"

export function App() {
  const { chatId, setChatId, isChatRoute } = useAppChatRoute()
  const [selectedAuthorId, setSelectedAuthorId] = React.useState("victor-hugo")
  const [tableRevealEpoch, setTableRevealEpoch] = React.useState(0)
  const selectedAuthor =
    AUTHORS.find((a) => a.id === selectedAuthorId) ?? AUTHORS[0]

  const {
    datasets,
    loading: datasetsLoading,
    refresh: refreshDatasets,
  } = useDatasets()
  const {
    docs,
    total: totalDocs,
    loading: docsLoading,
    refresh: refreshDocs,
  } = useDocuments(selectedAuthor.datasetId)

  const handleRefresh = React.useCallback(() => {
    refreshDatasets()
    refreshDocs()
  }, [refreshDatasets, refreshDocs])

  const activeDataset = datasets.find((d) => d.id === selectedAuthor.datasetId)

  const datasetsWithDocs = AUTHORS.map((a) => {
    const ds = datasets.find((d) => d.id === a.datasetId)
    return { author: a, dataset: ds }
  })
  const readyCount = datasetsWithDocs.filter(
    (d) => d.dataset && d.dataset.document_count > 0
  ).length

  const statusCounts = docs.reduce(
    (acc, d) => {
      acc[d.run] = (acc[d.run] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const sidebarProps = {
    selectedAuthorId,
    onSelectAuthor: setSelectedAuthorId,
    onDashboard: () => setChatId(null),
    onOpenDialogue: (id: string) => setChatId(id),
  }

  if (isChatRoute && chatId) {
    return (
      <SidebarProvider>
        <AppSidebar {...sidebarProps} />
        <SidebarInset className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <RagflowChatView
            chatId={chatId}
            onClose={() => setChatId(null)}
            onChangeChat={setChatId}
          />
        </SidebarInset>
      </SidebarProvider>
    )
  }

  const tableData = docs.map((doc, i) => ({
    id: i + 1,
    header: resolveTitle(selectedAuthor.id, doc.name),
    type: "Œuvre",
    status:
      doc.run === "DONE"
        ? "Indexé"
        : doc.run === "RUNNING"
          ? "En cours"
          : doc.run === "FAIL"
            ? "Erreur"
            : "En attente",
    target: "1",
    limit: String(doc.chunk_count),
    reviewer: selectedAuthor.name,
  }))

  return (
    <SidebarProvider>
      <AppSidebar {...sidebarProps} />
      <SidebarInset>
        <SiteHeader
          selectedAuthorId={selectedAuthorId}
          onSelectAuthor={setSelectedAuthorId}
        />
        <div className="flex flex-1 flex-col gap-8 p-8">
          <SectionCards
            dataset={activeDataset ?? null}
            authorId={selectedAuthorId}
            authorName={selectedAuthor.name}
            statusCounts={statusCounts}
            totalDocs={totalDocs}
            readyCount={readyCount}
            totalAuthors={AUTHORS.length}
            loading={datasetsLoading || docsLoading}
            onRefresh={handleRefresh}
          />
          <FadeIn
            delay={450}
            duration={600}
            triggerKey={selectedAuthorId}
            onEntered={() => setTableRevealEpoch((e) => e + 1)}
          >
            <div className="px-4 lg:px-6">
              <DataTable
                data={tableData}
                loading={docsLoading}
                rowRevealEpoch={tableRevealEpoch}
              />
            </div>
          </FadeIn>
          <FadeIn delay={600} duration={600} triggerKey={selectedAuthorId}>
            <div className="px-4 lg:px-6">
              <ChartAreaInteractive
                dataset={activeDataset ?? null}
                loading={datasetsLoading}
              />
            </div>
          </FadeIn>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
