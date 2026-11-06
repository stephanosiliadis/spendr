"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { format } from "date-fns";
import { Loader2, Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES, type Category, type CategoryBudget, type CategoryBudgetStatus } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

interface BudgetResponse {
  month: string;
  totalSpent: number;
  totalBudget: number;
  budgets: CategoryBudgetStatus[];
}

const currentMonth = () => format(new Date(), "yyyy-MM");

export default function BudgetsPage() {
  const [month, setMonth] = useState(currentMonth);
  const [status, setStatus] = useState<BudgetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState<Category | "">("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/budgets?month=${month}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {throw new Error(data.error ?? "Could not load budgets.");}
        setStatus(data);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          toast.error(error instanceof Error ? error.message : "Could not load budgets.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {setLoading(false);}
      });
    return () => controller.abort();
  }, [month]);

  const budgetedCategories = useMemo(
    () => new Set(status?.budgets.map((budget) => budget.category) ?? []),
    [status],
  );

  const saveBudgets = async (budgets: CategoryBudget[]) => {
    setSaving(true);
    try {
      const response = await fetch("/api/budgets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budgets }),
      });
      const data = await response.json();
      if (!response.ok) {throw new Error(data.error ?? "Could not save budget.");}
      const reload = await fetch(`/api/budgets?month=${month}`, { cache: "no-store" });
      const nextStatus = await reload.json();
      if (!reload.ok) {throw new Error(nextStatus.error ?? "Could not refresh budgets.");}
      setStatus(nextStatus);
      toast.success("Budgets saved");
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save budget.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!status) {
      toast.error("Wait for the budget list to finish loading before making changes.");
      return;
    }
    const limit = Number(amount);
    if (!category || !Number.isFinite(limit) || limit <= 0) {
      toast.error("Choose a category and enter a positive monthly limit.");
      return;
    }
    const budgets = status?.budgets ?? [];
    const next = [
      ...budgets.filter((budget) => budget.category !== category),
      { category, monthlyLimit: Math.round(limit * 100) / 100 },
    ];
    if (await saveBudgets(next)) {
      setCategory("");
      setAmount("");
    }
  };

  const handleRemove = async (removed: Category) => {
    await saveBudgets((status?.budgets ?? [])
      .filter((budget) => budget.category !== removed)
      .map(({ category: budgetCategory, monthlyLimit }) => ({ category: budgetCategory, monthlyLimit })));
  };

  const displayMonth = new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-6 p-6 pt-20 lg:pt-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Budgets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Set monthly spending limits and see how your spending tracks against them.
          </p>
        </div>
        <div className="w-full sm:w-48">
          <Label htmlFor="budget-month" className="sr-only">Budget month</Label>
          <Input
            id="budget-month"
            type="month"
            value={month}
            max={currentMonth()}
            onChange={(event) => setMonth(event.target.value || currentMonth())}
          />
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-expense/10 text-expense">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Spent in {displayMonth}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(status?.totalSpent ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total budget limits</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(status?.totalBudget ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Category budgets</CardTitle>
            <p className="text-sm text-muted-foreground">Track spending against each monthly limit.</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading budgets…
              </div>
            ) : status?.budgets.length ? (
              <div className="space-y-6">
                {status.budgets.map((budget) => {
                  const overBudget = budget.spent > budget.monthlyLimit;
                  const progress = Math.min(budget.percentage, 100);
                  return (
                    <div key={budget.category} className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{budget.category}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(budget.spent)} spent of {formatCurrency(budget.monthlyLimit)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className={`text-xs font-semibold tabular-nums ${overBudget ? "text-expense" : "text-muted-foreground"}`}>
                            {overBudget ? `${formatCurrency(Math.abs(budget.remaining))} over` : `${formatCurrency(budget.remaining)} left`}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            aria-label={`Remove ${budget.category} budget`}
                            disabled={saving}
                            onClick={() => handleRemove(budget.category)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <Progress
                        value={progress}
                        indicatorClassName={overBudget ? "bg-expense" : budget.percentage >= 80 ? "bg-secondary" : "bg-accent"}
                      />
                      <p className="text-right text-[11px] text-muted-foreground">{budget.percentage}% used</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center">
                <p className="font-medium">No budgets for this month yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Add a category limit to start tracking your spending.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Set a monthly limit</CardTitle>
            <p className="text-sm text-muted-foreground">Limits repeat each month.</p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSave}>
              <div className="space-y-1.5">
                <Label htmlFor="budget-category">Category</Label>
                <Select value={category} onValueChange={(value) => setCategory(value as Category)}>
                  <SelectTrigger id="budget-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}{budgetedCategories.has(item) ? " · Update limit" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="budget-limit">Monthly limit</Label>
                <Input
                  id="budget-limit"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
              <Button className="w-full" type="submit" disabled={loading || saving || !status || !category || !amount}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {category && budgetedCategories.has(category) ? "Update budget" : "Add budget"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
