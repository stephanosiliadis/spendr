"use client"

import { useState } from "react"
import { DatabaseBackup, Download, FileJson, FileText, Plus, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TransactionsTable } from "@/components/transactions-table"
import { TransactionForm } from "@/components/transaction-form"
import { DeleteDialog } from "@/components/delete-dialog"
import { ImportDialog } from "@/components/import-dialog"
import { BackupDialog } from "@/components/backup-dialog"
import { type Transaction } from "@/lib/types"

export default function TransactionsPage() {
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null)
  const [deletingTransaction, setDeletingTransaction] =
    useState<Transaction | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [backupOpen, setBackupOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleEdit = (tx: Transaction) => {
    setEditingTransaction(tx)
    setFormOpen(true)
  }

  const handleDelete = (tx: Transaction) => {
    setDeletingTransaction(tx)
    setDeleteOpen(true)
  }

  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open)
    if (!open) setEditingTransaction(null)
  }

  const handleDeleteOpenChange = (open: boolean) => {
    setDeleteOpen(open)
    if (!open) setDeletingTransaction(null)
  }

  const handleSuccess = () => {
    setRefreshKey((k) => k + 1)
  }

  const exportAs = (format: "csv" | "json") => {
    window.open(`/api/export?format=${format}`, "_blank")
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Page header ────────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-border px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Transactions
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Manage your income and expenses
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Data management */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Download className="h-4 w-4" />
                  Data
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onSelect={() => setImportOpen(true)}>
                  <Upload className="h-4 w-4 mr-2 text-muted-foreground" />
                  Import CSV
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => exportAs("csv")}>
                  <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => exportAs("json")}>
                  <FileJson className="h-4 w-4 mr-2 text-muted-foreground" />
                  Export as JSON
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setBackupOpen(true)}>
                  <DatabaseBackup className="h-4 w-4 mr-2 text-muted-foreground" />
                  Backup &amp; restore
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Add transaction */}
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setEditingTransaction(null)
                setFormOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              Add Transaction
            </Button>
          </div>
        </div>
      </header>

      {/* ── Table area ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-6 scrollbar-thin">
        <TransactionsTable
          onEdit={handleEdit}
          onDelete={handleDelete}
          refreshKey={refreshKey}
        />
      </div>

      {/* ── Dialogs ────────────────────────────────────────────────────── */}
      <TransactionForm
        open={formOpen}
        onOpenChange={handleFormOpenChange}
        transaction={editingTransaction}
        onSuccess={handleSuccess}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={handleSuccess}
      />

      <BackupDialog
        open={backupOpen}
        onOpenChange={setBackupOpen}
        onSuccess={handleSuccess}
      />

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={handleDeleteOpenChange}
        transaction={deletingTransaction}
        onSuccess={handleSuccess}
      />
    </div>
  )
}
