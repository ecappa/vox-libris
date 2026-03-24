import * as React from "react"
import {
  fetchDatasets,
  fetchDocuments,
  type RagflowDataset,
  type RagflowDocument,
} from "@/lib/ragflow"

export function useDatasets() {
  const [datasets, setDatasets] = React.useState<RagflowDataset[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [tick, setTick] = React.useState(0)

  const refresh = React.useCallback(() => setTick((t) => t + 1), [])

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchDatasets()
      .then((data) => {
        if (!cancelled) setDatasets(data)
      })
      .catch((err) => {
        if (!cancelled) setError(String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tick])

  return { datasets, loading, error, refresh }
}

export function useDocuments(datasetId: string | null) {
  const [docs, setDocs] = React.useState<RagflowDocument[]>([])
  const [total, setTotal] = React.useState(0)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [tick, setTick] = React.useState(0)

  const refresh = React.useCallback(() => setTick((t) => t + 1), [])

  React.useEffect(() => {
    if (!datasetId) return
    let cancelled = false
    setLoading(true)

    fetchDocuments(datasetId)
      .then((data) => {
        if (!cancelled) {
          setDocs(data.docs)
          setTotal(data.total)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [datasetId, tick])

  return { docs, total, loading, error, refresh }
}
