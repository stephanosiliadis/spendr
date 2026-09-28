"use client"

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { CATEGORY_COLORS, type CategoryData } from "@/lib/types"
import { formatCurrency } from "@/lib/utils"

interface CategoryChartProps {
  data: CategoryData[]
  title?: string
  loading?: boolean
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: CategoryData }>
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload

  return (
    <div className="min-w-[160px] rounded-lg border border-border bg-card p-3 shadow-xl">
      <p className="mb-1.5 text-sm font-semibold">{d.category}</p>
      <p className="text-sm text-muted-foreground">
        Amount:{" "}
        <span className="font-medium text-foreground">
          {formatCurrency(d.amount)}
        </span>
      </p>
      <p className="text-sm text-muted-foreground">
        Share:{" "}
        <span className="font-medium text-foreground">
          {d.percentage.toFixed(1)}%
        </span>
      </p>
      <p className="text-sm text-muted-foreground">
        Transactions:{" "}
        <span className="font-medium text-foreground">{d.count}</span>
      </p>
    </div>
  )
}

function LegendText({ value }: { value: string }) {
  return (
    <span className="text-xs text-muted-foreground">{value}</span>
  )
}

export function CategoryChart({
  data,
  title = "Category Breakdown",
  loading,
}: CategoryChartProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-44" />
        </CardHeader>
        <CardContent>
          <Skeleton className="mx-auto h-64 w-64 rounded-full" />
        </CardContent>
      </Card>
    )
  }

  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex h-64 items-center justify-center">
          <p className="text-sm text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={288}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="45%"
              innerRadius={64}
              outerRadius={100}
              dataKey="amount"
              nameKey="category"
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.category}
                  fill={
                    CATEGORY_COLORS[
                      entry.category as keyof typeof CATEGORY_COLORS
                    ] ?? "#94a3b8"
                  }
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(value) => <LegendText value={value} />}
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
