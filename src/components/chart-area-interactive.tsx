"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { motion } from "motion/react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { LoaderIcon } from "lucide-react"
import type { RagflowDataset } from "@/lib/ragflow"

const chartConfig = {
  value: {
    label: "Valeur",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

const EASE_OUT = [0.22, 1, 0.36, 1] as const

interface ChartProps {
  dataset: RagflowDataset | null
  loading: boolean
}

export function ChartAreaInteractive({ dataset, loading }: ChartProps) {
  const chartData = dataset
    ? [
        { label: "Documents", value: dataset.document_count },
        { label: "Chunks", value: dataset.chunk_count },
        { label: "Tokens (k)", value: Math.round(dataset.token_num / 1000) },
      ]
    : []

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_OUT }}
    >
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{dataset ? dataset.name : "Chargement..."}</CardTitle>
          <CardDescription>Vue d'ensemble du dataset RAGFlow</CardDescription>
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          {loading ? (
            <div className="flex h-[250px] items-center justify-center">
              <LoaderIcon className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-[250px] w-full"
            >
              <BarChart data={chartData} barCategoryGap="20%">
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      indicator="dot"
                      labelFormatter={(value) => `${value}`}
                    />
                  }
                />
                <Bar
                  dataKey="value"
                  fill="var(--color-value)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
