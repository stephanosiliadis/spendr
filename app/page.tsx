"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatsCards } from "@/components/stats-cards";
import type { Insights, Transaction } from "@/lib/types";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

// Recharts is the heaviest dependency on this page and the charts are below the
// fold of the stats row, so load them in a separate chunk instead of blocking
// the dashboard's first compile/paint. The form is only needed once opened.
function ChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-1 h-3.5 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-80 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

const MonthlyChart = dynamic(
  () => import("@/components/monthly-chart").then((m) => m.MonthlyChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);
const CategoryChart = dynamic(
  () => import("@/components/category-chart").then((m) => m.CategoryChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);
const TransactionForm = dynamic(
  () => import("@/components/transaction-form").then((m) => m.TransactionForm),
  { ssr: false },
);

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) {
    return "Good morning";
  }
  if (hour < 17) {
    return "Good afternoon";
  }
  return "Good evening";
}

export default function DashboardPage() {
  const [insights, setInsights] = useState<Insights | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formMounted, setFormMounted] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const [insRes, txRes] = await Promise.all([
          fetch("/api/insights"),
          fetch("/api/transactions?limit=5&sort=id&order=desc"),
        ]);
        const [insData, txData] = await Promise.all([
          insRes.json(),
          txRes.json(),
        ]);
        setInsights(insRes.ok ? insData : null);
        setTransactions(txData.data ?? []);
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [refreshKey]);

  function openForm() {
    setFormMounted(true);
    setFormOpen(true);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 p-4 pt-20 sm:p-6 sm:pt-20 lg:p-8 animate-fade-in">
      {/* ── Page header ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{getGreeting()} 👋</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here&apos;s your financial overview for today
          </p>
        </div>
        <Button onClick={openForm}>
          <Plus className="h-4 w-4" />
          Add Transaction
        </Button>
      </div>

      {/* ── Stats row ─────────────────────────────────────────────── */}
      <StatsCards insights={insights} loading={loading} />

      {/* ── Charts grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <MonthlyChart data={insights?.monthlyData ?? []} loading={loading} />
        <CategoryChart
          data={insights?.expenseCategoryData ?? []}
          title="Where it went"
          loading={loading}
        />
      </div>

      {/* ── Recent transactions ───────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base font-semibold">
            Recent Transactions
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link
              href="/transactions"
              className="text-xs text-muted-foreground"
            >
              View all →
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No transactions yet. Add one to get started!
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={openForm}
              >
                <Plus className="h-3.5 w-3.5" />
                Add your first transaction
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                >
                  {/* Type indicator */}
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                      tx.type === "Income"
                        ? "bg-income/15 text-income"
                        : "bg-expense/15 text-expense",
                    )}
                  >
                    {tx.type === "Income" ? "+" : "−"}
                  </div>

                  {/* Description + meta */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {tx.description}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{formatDate(tx.date)}</span>
                      <span>·</span>
                      <Badge
                        variant="outline"
                        className="rounded-full border-border bg-muted px-1.5 py-0 text-[10px] font-normal text-muted-foreground"
                      >
                        {tx.splits?.length ? `Split · ${tx.splits.length} categories` : tx.category}
                      </Badge>
                      {tx.is_recurring === 1 && (
                        <>
                          <span>·</span>
                          <span className="text-highlight">Recurring</span>
                        </>
                      )}
                    </p>
                  </div>

                  {/* Amount */}
                  <p
                    className={cn(
                      "shrink-0 text-sm font-semibold tabular-nums",
                      tx.type === "Income" ? "text-income" : "text-expense",
                    )}
                  >
                    {tx.type === "Income" ? "+" : "−"}
                    {formatCurrency(tx.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {formMounted && (
        <TransactionForm
          open={formOpen}
          onOpenChange={setFormOpen}
          onSuccess={() => setRefreshKey((key) => key + 1)}
        />
      )}
    </div>
  );
}
