"use client";

import { useEffect, useState } from "react";
import { endOfMonth, endOfYear, format, isSameMonth, isSameYear, startOfMonth, startOfYear } from "date-fns";
import { type DateRange } from "react-day-picker";
import { ArrowDownCircle, ArrowUpCircle, CalendarDays, RefreshCw, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryDonut } from "@/components/category-donut";
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
      iconClass: "text-highlight",
      bgClass: "bg-highlight/15",
      value: formatCurrency(insights.averageAmount),
      sub: `Across ${insights.transactionCount} transaction${insights.transactionCount !== 1 ? "s" : ""}`,
    },
    {
      label: "Recurring",
      icon: RefreshCw,
      iconClass: "text-highlight",
      bgClass: "bg-highlight/15",
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
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [draftRange, setDraftRange] = useState<DateRange | undefined>();
  const [rangeOpen, setRangeOpen] = useState(false);
  const dateFrom = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : "";
  const dateTo = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : "";

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      try {
        const query = new URLSearchParams();
        if (dateFrom && dateTo) {
          query.set("dateFrom", dateFrom);
          query.set("dateTo", dateTo);
        }
        const queryString = query.toString();
        const res = await fetch(`/api/insights${queryString ? `?${queryString}` : ""}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        setInsights(res.ok ? data : null);
      } catch (err) {
        if (!controller.signal.aborted) {console.error("Failed to load insights", err);}
      } finally {
        if (!controller.signal.aborted) {setLoading(false);}
      }
    }
    load();
    return () => controller.abort();
  }, [dateFrom, dateTo]);

  const now = new Date();
  const isCurrentMonth = dateRange?.from && dateRange.to
    && isSameMonth(dateRange.from, now)
    && isSameMonth(dateRange.to, now)
    && dateRange.from.getDate() === 1
    && dateRange.to.getDate() === endOfMonth(now).getDate();
  const isCurrentYear = dateRange?.from && dateRange.to
    && isSameYear(dateRange.from, now)
    && isSameYear(dateRange.to, now)
    && dateRange.from.getMonth() === 0
    && dateRange.from.getDate() === 1
    && dateRange.to.getMonth() === 11
    && dateRange.to.getDate() === 31;
  const rangeLabel = dateRange?.from && dateRange.to
    ? dateRange.from.getTime() === dateRange.to.getTime()
      ? format(dateRange.from, "MMM d, yyyy")
      : `${format(dateRange.from, "MMM d, yyyy")} – ${format(dateRange.to, "MMM d, yyyy")}`
    : "Choose dates";

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 p-4 pt-20 sm:p-6 sm:pt-20 lg:p-8 animate-fade-in">
      {/* ── Page header ─────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Deep dive into your spending patterns and financial trends
        </p>
      </div>

      <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-highlight/10 text-highlight">
            <CalendarDays className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold">Analytics period</p>
            <p className="text-xs text-muted-foreground">
              {dateRange?.from && dateRange.to ? rangeLabel : "All available transactions"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={!dateRange ? "secondary" : "outline"}
            size="sm"
            onClick={() => setDateRange(undefined)}
          >
            All time
          </Button>
          <Button
            variant={isCurrentMonth ? "secondary" : "outline"}
            size="sm"
            onClick={() => setDateRange({ from: startOfMonth(now), to: endOfMonth(now) })}
          >
            This month
          </Button>
          <Button
            variant={isCurrentYear ? "secondary" : "outline"}
            size="sm"
            onClick={() => setDateRange({ from: startOfYear(now), to: endOfYear(now) })}
          >
            This year
          </Button>
          <Popover
            open={rangeOpen}
            onOpenChange={(open) => {
              setRangeOpen(open);
              if (open) {setDraftRange(dateRange);}
            }}
          >
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="min-w-36 justify-start">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                {rangeLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0">
              <Calendar
                mode="range"
                selected={draftRange}
                onSelect={setDraftRange}
                numberOfMonths={1}
                initialFocus
              />
              <div className="flex items-center justify-between border-t border-border p-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDraftRange(undefined);
                    setDateRange(undefined);
                    setRangeOpen(false);
                  }}
                >
                  Clear
                </Button>
                <Button
                  size="sm"
                  disabled={!draftRange?.from || !draftRange.to}
                  onClick={() => {
                    setDateRange(draftRange);
                    setRangeOpen(false);
                  }}
                >
                  Apply range
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </Card>

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
            <CategoryDonut
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
            <CategoryDonut
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
