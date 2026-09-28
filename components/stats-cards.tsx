"use client"

import { Receipt, Scale, TrendingDown, TrendingUp } from "lucide-react"

import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { Insights } from "@/lib/types"
import { cn, formatCurrency } from "@/lib/utils"

interface StatsCardsProps {
  insights: Insights | null
  loading?: boolean
}

export function StatsCards({ insights, loading }: StatsCardsProps) {
  if (loading || !insights) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-5">
            <div className="flex items-start gap-4">
              <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2 pt-0.5">
                <Skeleton className="h-6 w-28" />
                <Skeleton className="h-3.5 w-20" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    )
  }

  const isPositive = insights.netBalance >= 0

  const cards = [
    {
      label: "Net Balance",
      value: formatCurrency(insights.netBalance),
      icon: Scale,
      iconBg: isPositive ? "bg-income/20" : "bg-expense/20",
      iconColor: isPositive ? "text-income" : "text-expense",
      valueColor: isPositive ? "text-income" : "text-expense",
    },
    {
      label: "Total Income",
      value: formatCurrency(insights.totalIncome),
      icon: TrendingUp,
      iconBg: "bg-income/20",
      iconColor: "text-income",
      valueColor: "text-income",
    },
    {
      label: "Total Expenses",
      value: formatCurrency(insights.totalExpenses),
      icon: TrendingDown,
      iconBg: "bg-expense/20",
      iconColor: "text-expense",
      valueColor: "text-expense",
    },
    {
      label: "Transactions",
      value: (insights.transactionCount ?? 0).toLocaleString(),
      icon: Receipt,
      iconBg: "bg-primary/20",
      iconColor: "text-primary",
      valueColor: "text-foreground",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map(({ label, value, icon: Icon, iconBg, iconColor, valueColor }) => (
        <Card
          key={label}
          className="p-5 transition-shadow hover:shadow-md"
        >
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                iconBg
              )}
            >
              <Icon className={cn("h-5 w-5", iconColor)} />
            </div>
            <div className="min-w-0">
              <p
                className={cn(
                  "truncate text-xl font-bold leading-tight tracking-tight",
                  valueColor
                )}
              >
                {value}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
