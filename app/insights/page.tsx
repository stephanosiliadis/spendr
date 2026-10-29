"use client";

import { useEffect, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, RefreshCw, Wallet } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryChart } from "@/components/category-chart";
import { MonthlyChart } from "@/components/monthly-chart";
import { StatsCards } from "@/components/stats-cards";
import type { CategoryData, Insights } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

// ── Category list with progress bars ──────────────────────────────────────────

function CategoryList({
  data,
  indicatorColor,
  loading,
}: {
  data: CategoryData[]
  indicatorColor: string
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="flex h-40 items-center justify-center">
        <p className="text-sm text-muted-foreground">No data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.map((cat) => (
        <div key={cat.category} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-medium">{cat.category}</span>
            <span className="shrink-0 text-sm font-semibold tabular-nums">
              {formatCurrency(cat.amount)}
            </span>
          </div>
          <Progress
            value={cat.percentage}
            indicatorClassName={indicatorColor}
          />
          <p className="text-xs text-muted-foreground">
            {cat.percentage.toFixed(1)}%
            {" · "}
            {cat.count} transaction{cat.count !== 1 ? "s" : ""}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Key insights section ───────────────────────────────────────────────────────

function KeyInsights({
  insights,
  loading,
}: {
  insights: Insights | null
  loading: boolean
}) {
  if (loading || !insights) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="mb-3 h-8 w-8 rounded-full" />
            <Skeleton className="mb-1.5 h-4 w-24" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="mt-1 h-3 w-20" />
          </Card>
        ))}
      </div>
    );
  }

  const items = [
    {
      label: "Highest Income",
      icon: ArrowUpCircle,
      iconClass: "text-income",
      bgClass: "bg-income/15",
      value: insights.highestIncome
        ? formatCurrency(insights.highestIncome.amount)
        : "—",
      sub: insights.highestIncome
        ? `${insights.highestIncome.description} · ${formatDate(insights.highestIncome.date)}`
        : "No income recorded",
    },
    {
      label: "Highest Expense",
      icon: ArrowDownCircle,
      iconClass: "text-expense",
      bgClass: "bg-expense/15",
      value: insights.highestExpense
        ? formatCurrency(insights.highestExpense.amount)
        : "—",
      sub: insights.highestExpense
        ? `${insights.highestExpense.description} · ${formatDate(insights.highestExpense.date)}`
        : "No expenses recorded",
    },
    {
      label: "Average Amount",
      icon: Wallet,
      iconClass: "text-primary",
      bgClass: "bg-primary/15",
      value: formatCurrency(insights.averageAmount),
      sub: `Across ${insights.transactionCount} transaction${insights.transactionCount !== 1 ? "s" : ""}`,
    },
    {
      label: "Recurring",
      icon: RefreshCw,
      iconClass: "text-amber-500",
      bgClass: "bg-amber-500/15",
      value: `${insights.recurringCount}`,
      sub:
        insights.recurringCount === 1
          ? "Recurring transaction"
          : "Recurring transactions",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(({ label, icon: Icon, iconClass, bgClass, value, sub }) => (
        <Card key={label} className="p-5">
          <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-full ${bgClass}`}>
            <Icon className={`h-4 w-4 ${iconClass}`} />
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>
        </Card>
      ))}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/insights");
        const data = await res.json();
        setInsights(res.ok ? data : null);
      } catch (err) {
        console.error("Failed to load insights", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="flex flex-col gap-6 p-6 pt-20 lg:pt-6 animate-fade-in">
      {/* ── Page header ─────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Deep dive into your spending patterns and financial trends
        </p>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────── */}
      <Tabs defaultValue="overview">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="overview" className="flex-1 sm:flex-none">
            Overview
          </TabsTrigger>
          <TabsTrigger value="income" className="flex-1 sm:flex-none">
            Income
          </TabsTrigger>
          <TabsTrigger value="expenses" className="flex-1 sm:flex-none">
            Expenses
          </TabsTrigger>
        </TabsList>

        {/* Overview tab */}
        <TabsContent value="overview" className="space-y-6">
          <StatsCards insights={insights} loading={loading} />
          <MonthlyChart
            data={insights?.monthlyData ?? []}
            loading={loading}
          />
        </TabsContent>

        {/* Income tab */}
        <TabsContent value="income" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <CategoryChart
              data={insights?.incomeCategoryData ?? []}
              title="Income by Category"
              loading={loading}
            />
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">
                  Income Breakdown
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {insights?.incomeCount ?? 0} income transaction
                  {(insights?.incomeCount ?? 0) !== 1 ? "s" : ""} recorded
                </p>
              </CardHeader>
              <CardContent>
                <CategoryList
                  data={insights?.incomeCategoryData ?? []}
                  indicatorColor="bg-income"
                  loading={loading}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Expenses tab */}
        <TabsContent value="expenses" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <CategoryChart
              data={insights?.expenseCategoryData ?? []}
              title="Expenses by Category"
              loading={loading}
            />
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">
                  Expense Breakdown
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {insights?.expenseCount ?? 0} expense transaction
                  {(insights?.expenseCount ?? 0) !== 1 ? "s" : ""} recorded
                </p>
              </CardHeader>
              <CardContent>
                <CategoryList
                  data={insights?.expenseCategoryData ?? []}
                  indicatorColor="bg-expense"
                  loading={loading}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Key insights (always visible) ───────────────────────────── */}
      <div>
        <h2 className="mb-4 text-base font-semibold">Key Insights</h2>
        <KeyInsights insights={insights} loading={loading} />
      </div>
    </div>
  );
}
