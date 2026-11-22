"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { format, parseISO } from "date-fns";
import { CheckCircle2, Loader2, Plus, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/date-picker";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import type { SavingsGoal } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function SavingsGoalsPage() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [contributions, setContributions] = useState<Record<string, string>>({});
  const [goalToDelete, setGoalToDelete] = useState<SavingsGoal | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/savings-goals", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {throw new Error(data.error ?? "Could not load savings goals.");}
        setGoals(data.goals);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          toast.error(error instanceof Error ? error.message : "Could not load savings goals.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {setLoading(false);}
      });
    return () => controller.abort();
  }, []);

  const totals = useMemo(() => goals.reduce(
    (summary, goal) => ({
      saved: summary.saved + goal.currentAmount,
      target: summary.target + goal.targetAmount,
    }),
    { saved: 0, target: 0 },
  ), [goals]);

  const createGoal = async (event: FormEvent) => {
    event.preventDefault();
    const target = Number(targetAmount);
    if (!name.trim() || !Number.isFinite(target) || target <= 0) {
      toast.error("Enter a goal name and a positive target amount.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/savings-goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, targetAmount: Math.round(target * 100) / 100, targetDate: targetDate || undefined }),
      });
      const data = await response.json();
      if (!response.ok) {throw new Error(data.error ?? "Could not create goal.");}
      setGoals(data.goals);
      setName("");
      setTargetAmount("");
      setTargetDate("");
      toast.success("Savings goal created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create goal.");
    } finally {
      setSaving(false);
    }
  };

  const addContribution = async (goal: SavingsGoal) => {
    const contribution = Number(contributions[goal.id]);
    if (!Number.isFinite(contribution) || contribution <= 0) {
      toast.error("Enter a positive contribution amount.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/savings-goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: goal.id, contribution: Math.round(contribution * 100) / 100 }),
      });
      const data = await response.json();
      if (!response.ok) {throw new Error(data.error ?? "Could not add contribution.");}
      setGoals(data.goals);
      setContributions((current) => ({ ...current, [goal.id]: "" }));
      toast.success("Contribution recorded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add contribution.");
    } finally {
      setSaving(false);
    }
  };

  const deleteGoal = async (goal: SavingsGoal) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/savings-goals?id=${encodeURIComponent(goal.id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {throw new Error(data.error ?? "Could not delete goal.");}
      setGoals(data.goals);
      toast.success("Savings goal deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete goal.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 pt-20 lg:pt-6">
      <header>
        <h1 className="text-2xl font-bold">Savings goals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track progress toward the things you&apos;re saving for.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total saved toward goals</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(totals.saved)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Combined goal targets</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(totals.target)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your goals</CardTitle>
            <p className="text-sm text-muted-foreground">Contributions are tracked manually and don&apos;t move money.</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading goals…
              </div>
            ) : goals.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center">
                <Target className="mx-auto h-7 w-7 text-accent" />
                <p className="mt-3 font-medium">Start with a savings goal</p>
                <p className="mt-1 text-sm text-muted-foreground">Create a target and record contributions as you save.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {goals.map((goal) => {
                  const percentage = Math.min(Math.round((goal.currentAmount / goal.targetAmount) * 100), 100);
                  const complete = goal.currentAmount >= goal.targetAmount;
                  return (
                    <Card key={goal.id} className="border-border/80 shadow-none">
                      <CardContent className="space-y-4 p-4 sm:p-5">
                        <div className="flex items-start gap-3">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${complete ? "bg-income/10 text-income" : "bg-accent/10 text-accent"}`}>
                            {complete ? <CheckCircle2 className="h-4 w-4" /> : <Target className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">{goal.name}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {goal.targetDate ? `Target date ${formatDate(goal.targetDate)}` : "No target date"}
                              {complete ? " · Goal reached" : ""}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="-mr-2 -mt-2 h-8 w-8 text-muted-foreground hover:text-destructive"
                            aria-label={`Delete ${goal.name} goal`}
                            disabled={saving}
                            onClick={() => setGoalToDelete(goal)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-sm font-semibold tabular-nums">{formatCurrency(goal.currentAmount)} <span className="font-normal text-muted-foreground">saved</span></p>
                          <p className="text-xs tabular-nums text-muted-foreground">Target {formatCurrency(goal.targetAmount)}</p>
                        </div>
                        <Progress value={percentage} indicatorClassName={complete ? "bg-income" : "bg-accent"} />
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-medium text-muted-foreground">{percentage}% complete</span>
                          <form
                            className="flex w-full max-w-[250px] items-center gap-2"
                            onSubmit={(event) => {
                              event.preventDefault();
                              void addContribution(goal);
                            }}
                          >
                            <Label htmlFor={`contribution-${goal.id}`} className="sr-only">Contribution amount for {goal.name}</Label>
                            <Input
                              id={`contribution-${goal.id}`}
                              type="number"
                              min="0.01"
                              step="0.01"
                              inputMode="decimal"
                              placeholder="Add contribution"
                              value={contributions[goal.id] ?? ""}
                              onChange={(event) => setContributions((current) => ({ ...current, [goal.id]: event.target.value }))}
                              disabled={saving}
                            />
                            <Button type="submit" size="icon" aria-label={`Add contribution to ${goal.name}`} disabled={saving || !contributions[goal.id]}>
                              <Plus className="h-4 w-4" />
                            </Button>
                          </form>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Create a goal</CardTitle>
            <p className="text-sm text-muted-foreground">Set a target and optionally choose when you hope to reach it.</p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={createGoal}>
              <div className="space-y-1.5">
                <Label htmlFor="goal-name">Goal name</Label>
                <Input id="goal-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Emergency fund" maxLength={80} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="goal-target">Target amount</Label>
                <Input id="goal-target" type="number" min="0.01" step="0.01" inputMode="decimal" value={targetAmount} onChange={(event) => setTargetAmount(event.target.value)} placeholder="0.00" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="goal-date">Target date <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <DatePicker
                  id="goal-date"
                  date={targetDate ? parseISO(targetDate) : undefined}
                  onSelect={(date) => setTargetDate(date ? format(date, "yyyy-MM-dd") : "")}
                  placeholder="Choose target date"
                  className="w-full"
                />
              </div>
              <Button type="submit" className="w-full" disabled={saving || loading || !name.trim() || !targetAmount}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create savings goal
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!goalToDelete} onOpenChange={(open) => !open && setGoalToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete savings goal?</AlertDialogTitle>
            <AlertDialogDescription>
              {goalToDelete
                ? `“${goalToDelete.name}” and its recorded progress will be permanently removed.`
                : "This goal and its progress will be permanently removed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={saving || !goalToDelete}
              onClick={(event) => {
                event.preventDefault();
                if (goalToDelete) {void deleteGoal(goalToDelete);}
                setGoalToDelete(null);
              }}
            >
              Delete goal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
