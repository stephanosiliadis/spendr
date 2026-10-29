"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn, formatCurrency, formatDateInput } from "@/lib/utils";
import {
  CATEGORIES,
  type Category,
  type Transaction,
  type TransactionInput,
  type TransactionType,
} from "@/lib/types";

interface TransactionFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction?: Transaction | null
  onSuccess: () => void
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
  const [isRecurring, setIsRecurring] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [recurringTransactions, setRecurringTransactions] = useState<Transaction[]>([]);
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
        setDate(new Date(`${transaction.date  }T00:00:00`));
        setCategory(transaction.category);
        setIsRecurring(transaction.is_recurring === 1);
      } else {
        setType("Expense");
        setAmount("");
        setDescription("");
        setDate(new Date());
        setCategory("Other");
        setIsRecurring(false);
      }
      setErrors({});
      setSelectedRecurring("new");
    }
  }, [open, transaction]);

  useEffect(() => {
    if (!open || isEditing) {return;}

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
        if (!res.ok) {throw new Error("Failed to fetch recurring transactions");}
        const data: Transaction[] = await res.json();
        // Repeated occurrences with identical details need only one template.
        const seen = new Set<string>();
        const templates = data.filter((tx) => {
          const key = JSON.stringify([tx.type, tx.amount, tx.description, tx.category]);
          if (seen.has(key)) {return false;}
          seen.add(key);
          return true;
        });
        if (!controller.signal.aborted) {setRecurringTransactions(templates);}
      } catch {
        if (!controller.signal.aborted) {setRecurringError(true);}
      } finally {
        if (!controller.signal.aborted) {setRecurringLoading(false);}
      }
    }

    loadRecurringTransactions();
    return () => controller.abort();
  }, [open, isEditing]);

  const handleRecurringChange = (value: string) => {
    const template = recurringTransactions.find((tx) => String(tx.id) === value);
    setSelectedRecurring(value);
    setType(template?.type ?? "Expense");
    setAmount(template ? String(template.amount) : "");
    setDescription(template?.description ?? "");
    setCategory(template?.category ?? "Other");
    setIsRecurring(!!template);
    setErrors({});
  };

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
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {return;}

    setLoading(true);
    const body: TransactionInput = {
      type,
      amount: parseFloat(parseFloat(amount).toFixed(2)),
      description: description.trim(),
      date: formatDateInput(date),
      category,
      is_recurring: isRecurring,
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
                disabled={recurringLoading || loading || recurringTransactions.length === 0}
              >
                <SelectTrigger id="txn-template">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Start from scratch</SelectItem>
                  {recurringTransactions.map((tx) => (
                    <SelectItem key={tx.id} value={String(tx.id)}>
                      {tx.description} · {formatCurrency(tx.amount)} · {tx.type} · {tx.category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className={cn("text-xs text-muted-foreground", recurringError && "text-destructive")}>
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
              onValueChange={(v) => setType(v as TransactionType)}
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
                className={cn("pl-7", errors.amount && "border-destructive focus-visible:ring-destructive")}
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
              className={cn(errors.description && "border-destructive focus-visible:ring-destructive")}
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
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start text-left font-normal text-foreground"
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                  {date ? format(date, "dd MMM yyyy") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    if (d) {
                      setDate(d);
                      setCalendarOpen(false);
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as Category)}
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
          </div>

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
