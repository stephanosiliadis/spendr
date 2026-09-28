"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, TriangleAlert } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { cn, formatCurrency, formatDate } from "@/lib/utils"
import { type Transaction } from "@/lib/types"

interface DeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction: Transaction | null
  onSuccess: () => void
}

export function DeleteDialog({
  open,
  onOpenChange,
  transaction,
  onSuccess,
}: DeleteDialogProps) {
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!transaction) return
    setLoading(true)
    try {
      const res = await fetch(`/api/transactions/${transaction.id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success("Transaction deleted")
      onSuccess()
      onOpenChange(false)
    } catch {
      toast.error("Failed to delete transaction. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (!transaction) return null

  const isIncome = transaction.type === "Income"

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/15">
              <TriangleAlert className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            This action is permanent and cannot be undone. The following
            transaction will be removed from your records.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Transaction preview */}
        <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3 my-1">
          <div className="flex items-center justify-between gap-2">
            <Badge
              variant="outline"
              className={cn(
                "text-xs font-semibold",
                isIncome
                  ? "border-income/30 bg-income-muted text-income"
                  : "border-expense/30 bg-expense-muted text-expense"
              )}
            >
              {transaction.type}
            </Badge>
            <span
              className={cn(
                "text-base font-bold tabular-nums",
                isIncome ? "text-income" : "text-expense"
              )}
            >
              {isIncome ? "+" : "−"}
              {formatCurrency(transaction.amount)}
            </span>
          </div>

          <div>
            <p className="text-sm font-medium leading-snug">
              {transaction.description}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatDate(transaction.date)}&ensp;·&ensp;{transaction.category}
              {transaction.is_recurring ? "\u00a0· Recurring" : ""}
            </p>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleDelete()
            }}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
