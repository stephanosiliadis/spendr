"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn, formatCurrency, formatDateInput } from "@/lib/utils";
import {
  CATEGORIES,
  type Category,
  type Transaction,
  type TransactionInput,
  type TransactionSplit,
  type TransactionType,
} from "@/lib/types";

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction | null;
  onSuccess: () => void;
}

export function TransactionForm({
  open,
  onOpenChange,
  transaction,
  onSuccess,
}: TransactionFormProps) {
  const isEditing = !!transaction;

  const [type, setType] = useState<TransactionType>("Expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [category, setCategory] = useState<Category>("Other");
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splits, setSplits] = useState<
    Array<{ category: Category; amount: string }>
  >([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [recurringTransactions, setRecurringTransactions] = useState<
    Transaction[]
  >([]);
  const [selectedRecurring, setSelectedRecurring] = useState("new");
  const [recurringLoading, setRecurringLoading] = useState(false);
  const [recurringError, setRecurringError] = useState(false);

  // Pre-fill when editing; reset when opening for a new transaction
  useEffect(() => {
    if (open) {
      if (transaction) {
        setType(transaction.type);
        setAmount(String(transaction.amount));
        setDescription(transaction.description);
        setDate(new Date(`${transaction.date}T00:00:00`));
        setCategory(transaction.category);
        setSplitEnabled(!!transaction.splits?.length);
        setSplits(
          (transaction.splits ?? []).map((split) => ({
            ...split,
            amount: String(split.amount),
          })),
        );
        setIsRecurring(transaction.is_recurring === 1);
      } else {
        setType("Expense");
        setAmount("");
        setDescription("");
        setDate(new Date());
        setCategory("Other");
        setSplitEnabled(false);
        setSplits([]);
        setIsRecurring(false);
      }
      setErrors({});
      setSelectedRecurring("new");
    }
  }, [open, transaction]);

  useEffect(() => {
    if (!open || isEditing) {
      return;
    }

    const controller = new AbortController();
    setRecurringTransactions([]);
    setRecurringLoading(true);
    setRecurringError(false);

    async function loadRecurringTransactions() {
      try {
        const res = await fetch("/api/transactions/recurring", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error("Failed to fetch recurring transactions");
        }
        const data: Transaction[] = await res.json();
        // Repeated occurrences with identical details need only one template.
        const seen = new Set<string>();
        const templates = data.filter((tx) => {
          const key = JSON.stringify([
            tx.type,
            tx.amount,
            tx.description,
            tx.category,
          ]);
          if (seen.has(key)) {
            return false;
          }
          seen.add(key);
          return true;
        });
        if (!controller.signal.aborted) {
          setRecurringTransactions(templates);
        }
      } catch {
        if (!controller.signal.aborted) {
          setRecurringError(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setRecurringLoading(false);
        }
      }
    }

    loadRecurringTransactions();
    return () => controller.abort();
  }, [open, isEditing]);

  const handleRecurringChange = (value: string) => {
    const template = recurringTransactions.find(
      (tx) => String(tx.id) === value,
    );
    setSelectedRecurring(value);
    setType(template?.type ?? "Expense");
    setAmount(template ? String(template.amount) : "");
    setDescription(template?.description ?? "");
    setCategory(template?.category ?? "Other");
    setSplitEnabled(!!template?.splits?.length);
    setSplits(
      (template?.splits ?? []).map((split) => ({
        ...split,
        amount: String(split.amount),
      })),
    );
    setIsRecurring(!!template);
    setErrors({});
  };

  const splitAllocatedCents = splits.reduce(
    (sum, split) => sum + Math.round((Number(split.amount) || 0) * 100),
    0,
  );
  const transactionCents = Math.round((Number(amount) || 0) * 100);
  const unallocatedCents = transactionCents - splitAllocatedCents;

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      next.amount = "Enter a positive amount";
    } else if (!/^\d+(\.\d{1,2})?$/.test(amount.trim())) {
      next.amount = "Maximum 2 decimal places";
    }
    if (!description.trim()) {
      next.description = "Description is required";
    } else if (description.trim().length > 200) {
      next.description = "Maximum 200 characters";
    }
    if (splitEnabled) {
      const categories = splits.map((split) => split.category);
      const validAmounts = splits.every(
        (split) =>
          /^\d+(\.\d{1,2})?$/.test(split.amount.trim()) &&
          Number(split.amount) > 0,
      );
      const splitTotalCents = splits.reduce(
        (sum, split) => sum + Math.round((Number(split.amount) || 0) * 100),
        0,
      );
      if (splits.length < 2 || categories.length !== new Set(categories).size) {
        next.splits = "Choose a different category for each allocation.";
      } else if (!validAmounts) {
        next.splits =
          "Enter a positive amount with up to two decimal places for each category.";
      } else if (splitTotalCents !== Math.round(parsed * 100)) {
        next.splits = "Split amounts must add up to the transaction total.";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      return;
    }

    setLoading(true);
    const body: TransactionInput = {
      type,
      amount: parseFloat(parseFloat(amount).toFixed(2)),
      description: description.trim(),
      date: formatDateInput(date),
      category: splitEnabled ? splits[0].category : category,
      is_recurring: isRecurring,
      ...(splitEnabled
        ? {
          splits: splits.map(
            (split): TransactionSplit => ({
              category: split.category,
              amount: Number(split.amount),
            }),
          ),
        }
        : {}),
    };

    try {
      const url = isEditing
        ? `/api/transactions/${transaction!.id}`
        : "/api/transactions";
      const res = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? `HTTP ${res.status}`);
      }
      toast.success(isEditing ? "Transaction updated" : "Transaction added");
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Transaction" : "Add Transaction"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the details for this transaction."
              : "Fill in the details to record a new transaction."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-1">
          {!isEditing && (
            <div className="space-y-1.5">
              <Label htmlFor="txn-template">Use a recurring transaction</Label>
              <Select
                value={selectedRecurring}
                onValueChange={handleRecurringChange}
                disabled={
                  recurringLoading ||
                  loading ||
                  recurringTransactions.length === 0
                }
              >
                <SelectTrigger id="txn-template">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Start from scratch</SelectItem>
                  {recurringTransactions.map((tx) => (
                    <SelectItem key={tx.id} value={String(tx.id)}>
                      {tx.description} · {formatCurrency(tx.amount)} · {tx.type}{" "}
                      · {tx.category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p
                className={cn(
                  "text-xs text-muted-foreground",
                  recurringError && "text-destructive",
                )}
              >
                {recurringLoading
                  ? "Loading recurring transactions…"
                  : recurringError
                    ? "Could not load recurring transactions. You can still enter details manually."
                    : recurringTransactions.length === 0
                      ? "Mark a transaction as recurring to reuse its details here."
                      : "Reuse saved details with a new date. You can change any field before saving."}
              </p>
            </div>
          )}

          {/* Type */}
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select
              value={type}
              onValueChange={(value) => {
                const nextType = value as TransactionType;
                setType(nextType);
                if (nextType === "Income") {
                  setSplitEnabled(false);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Income">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-income shrink-0" />
                    Income
                  </span>
                </SelectItem>
                <SelectItem value="Expense">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-expense shrink-0" />
                    Expense
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="txn-amount">Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground select-none text-sm">
                €
              </span>
              <Input
                id="txn-amount"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                className={cn(
                  "pl-7",
                  errors.amount &&
                    "border-destructive focus-visible:ring-destructive",
                )}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            {errors.amount && (
              <p className="text-xs text-destructive">{errors.amount}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="txn-desc">Description</Label>
            <Input
              id="txn-desc"
              placeholder="What was this for?"
              className={cn(
                errors.description &&
                  "border-destructive focus-visible:ring-destructive",
              )}
              value={description}
              maxLength={200}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="flex items-center justify-between gap-2">
              {errors.description ? (
                <p className="text-xs text-destructive">{errors.description}</p>
              ) : (
                <span />
              )}
              <p className="text-xs text-muted-foreground ml-auto">
                {description.length}/200
              </p>
            </div>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label>Date</Label>
            <DatePicker
              date={date}
              onSelect={(selected) => selected && setDate(selected)}
              placeholder="Pick a date"
              className="w-full text-foreground"
            />
          </div>

          {type === "Expense" && (
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
              <div className="space-y-0.5">
                <Label
                  htmlFor="txn-split"
                  className="cursor-pointer text-sm font-medium"
                >
                  Split across categories
                </Label>
                <p className="text-xs text-muted-foreground">
                  Allocate this expense to more than one category
                </p>
              </div>
              <Switch
                id="txn-split"
                checked={splitEnabled}
                onCheckedChange={(checked) => {
                  setSplitEnabled(checked);
                  if (checked && splits.length === 0) {
                    const cents = Math.round((Number(amount) || 0) * 100);
                    const first = Math.floor(cents / 2);
                    const second = cents - first;
                    setSplits([
                      {
                        category: "Other",
                        amount: first ? (first / 100).toFixed(2) : "",
                      },
                      {
                        category: "Food & Dining",
                        amount: second ? (second / 100).toFixed(2) : "",
                      },
                    ]);
                  }
                  setErrors((current) => ({ ...current, splits: "" }));
                }}
              />
            </div>
          )}

          {!splitEnabled ? (
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as Category)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {category === "Other" && (
                <p className="text-xs text-muted-foreground">
                  Matching category rules can assign a category when you save.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border border-border p-4">
              <div>
                <p className="text-sm font-medium">Category allocations</p>
                <p className="text-xs text-muted-foreground">
                  Split amounts must total {formatCurrency(Number(amount) || 0)}
                  .
                </p>
              </div>
              {splits.map((split, index) => (
                <div
                  key={`${index}-${split.category}`}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_auto] items-end gap-2"
                >
                  <div className="min-w-0 space-y-1.5">
                    <Label htmlFor={`txn-split-category-${index}`}>
                      Category
                    </Label>
                    <Select
                      value={split.category}
                      onValueChange={(value) =>
                        setSplits((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, category: value as Category }
                              : item,
                          ),
                        )
                      }
                    >
                      <SelectTrigger id={`txn-split-category-${index}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem
                            key={cat}
                            value={cat}
                            disabled={splits.some(
                              (item, itemIndex) =>
                                itemIndex !== index && item.category === cat,
                            )}
                          >
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <Label htmlFor={`txn-split-amount-${index}`}>Amount</Label>
                    <Input
                      id={`txn-split-amount-${index}`}
                      type="number"
                      min="0.01"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={split.amount}
                      onChange={(event) =>
                        setSplits((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, amount: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-muted-foreground hover:text-destructive"
                    aria-label={`Remove ${split.category} allocation`}
                    disabled={splits.length <= 2}
                    onClick={() =>
                      setSplits((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={splits.length >= CATEGORIES.length}
                onClick={() => {
                  const nextCategory = CATEGORIES.find(
                    (cat) => !splits.some((split) => split.category === cat),
                  );
                  if (nextCategory) {
                    setSplits((current) => [
                      ...current,
                      { category: nextCategory, amount: "" },
                    ]);
                  }
                }}
              >
                <Plus className="h-4 w-4" /> Add category
              </Button>
              {amount && (
                <p
                  className={`text-xs ${unallocatedCents === 0 ? "text-income" : "text-muted-foreground"}`}
                >
                  {unallocatedCents === 0
                    ? "Fully allocated"
                    : unallocatedCents > 0
                      ? `${formatCurrency(unallocatedCents / 100)} left to allocate`
                      : `${formatCurrency(Math.abs(unallocatedCents) / 100)} over the total`}
                </p>
              )}
              {errors.splits && (
                <p className="text-xs text-destructive">{errors.splits}</p>
              )}
            </div>
          )}

          {/* Recurring */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
            <div className="space-y-0.5">
              <Label
                htmlFor="txn-recurring"
                className="text-sm font-medium cursor-pointer"
              >
                Recurring transaction
              </Label>
              <p className="text-xs text-muted-foreground">
                Mark if this happens regularly
              </p>
            </div>
            <Switch
              id="txn-recurring"
              checked={isRecurring}
              onCheckedChange={setIsRecurring}
            />
          </div>

          <DialogFooter className="pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Add Transaction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
