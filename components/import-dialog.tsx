"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CSV_FIELDS,
  MAX_CSV_BYTES,
  buildCsvTransactions,
  defaultCsvMapping,
  parseCsv,
  type CsvMapping,
  type ParsedCsv,
} from "@/lib/csv";
import { formatCurrency } from "@/lib/utils";
import {
  beginClientOperation,
  completeClientOperation,
} from "@/lib/client-operation";

export interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const FIELD_LABELS = {
  type: "Type",
  amount: "Amount",
  description: "Description",
  date: "Date",
  category: "Category",
  recurring: "Recurring",
};

export function ImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: ImportDialogProps) {
  const [csv, setCsv] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<CsvMapping>(() =>
    defaultCsvMapping([]),
  );
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const [serverError, setServerError] = useState("");
  const [reading, setReading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);
  const readVersion = useRef(0);
  const session = useRef(0);
  const submitLock = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    session.current++;
    readVersion.current++;
    if (open) {
      setCsv(null);
      setMapping(defaultCsvMapping([]));
      setFileName("");
      setFileError("");
      setServerError("");
      setReading(false);
      setSkipDuplicates(true);
      if (fileInput.current) {
        fileInput.current.value = "";
      }
    }
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      session.current++;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      readVersion.current++;
    };
  }, [open]);

  const preview = useMemo(
    () => (csv ? buildCsvTransactions(csv, mapping) : null),
    [csv, mapping],
  );
  const canImport =
    !!preview?.transactions.length &&
    preview.errors.length === 0 &&
    !reading &&
    !submitting;

  function changeOpen(next: boolean) {
    if (submitLock.current) {
      return;
    }
    if (!next) {
      readVersion.current++;
    }
    onOpenChange(next);
  }

  async function readFile(file: File | undefined) {
    if (submitLock.current) {
      return;
    }
    const version = ++readVersion.current;
    setCsv(null);
    setFileName(file?.name ?? "");
    setFileError("");
    setServerError("");
    setReading(false);
    if (!file) {
      return;
    }
    if (file.size > MAX_CSV_BYTES) {
      setFileError("Choose a CSV file that is 5 MiB or smaller.");
      return;
    }
    setReading(true);
    try {
      const text = await file.text();
      if (version !== readVersion.current) {
        return;
      }
      const parsed = parseCsv(text);
      setCsv(parsed);
      setMapping(defaultCsvMapping(parsed.headers));
    } catch (error) {
      if (version === readVersion.current) {
        setFileError(
          error instanceof Error
            ? error.message
            : "Could not read this CSV file.",
        );
      }
    } finally {
      if (version === readVersion.current) {
        setReading(false);
      }
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canImport || !preview || submitLock.current) {
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    setServerError("");
    const currentSession = session.current;
    let summary: string;
    try {
      const payload = JSON.stringify({
        transactions: preview.transactions,
        skipDuplicates,
      });
      const operation = await beginClientOperation("import", payload);
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactions: preview.transactions,
          skipDuplicates,
          operationId: operation.id,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : `Import failed (HTTP ${response.status}).`,
        );
      }
      if (
        !Number.isInteger(data?.imported) ||
        data.imported < 0 ||
        !Number.isInteger(data?.skipped) ||
        data.skipped < 0
      ) {
        throw new Error(
          "The server returned an unexpected result. Refresh your transactions before retrying.",
        );
      }
      completeClientOperation(operation);
      summary = `Imported ${data.imported} transaction${data.imported === 1 ? "" : "s"}; skipped ${data.skipped} duplicate${data.skipped === 1 ? "" : "s"}.`;
    } catch (error) {
      if (mounted.current && currentSession === session.current) {
        const message =
          error instanceof Error
            ? error.message
            : "Import failed. Please try again.";
        setServerError(message);
        toast.error(message);
      }
      return;
    } finally {
      submitLock.current = false;
      if (mounted.current) {
        setSubmitting(false);
      }
    }
    if (mounted.current && currentSession === session.current) {
      toast.success(summary);
      onOpenChange(false);
      onSuccess();
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent
        className={`max-h-[90dvh] overflow-y-auto sm:max-w-2xl ${submitting ? "[&>button]:pointer-events-none [&>button]:opacity-30" : ""}`}
        onEscapeKeyDown={(event) => {
          if (submitLock.current) {
            event.preventDefault();
          }
        }}
        onInteractOutside={(event) => {
          if (submitLock.current) {
            event.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Import transactions</DialogTitle>
          <DialogDescription>
            Choose a header-first CSV (comma or semicolon separated), up to 5
            MiB and 10,000 transactions. Dates must be YYYY-MM-DD; amounts must
            be positive with at most 2 decimal places.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          className="min-w-0 space-y-5"
          aria-busy={reading || submitting}
        >
          <div className="space-y-1.5">
            <Label htmlFor="import-file">CSV file</Label>
            <Input
              ref={fileInput}
              id="import-file"
              type="file"
              accept=".csv,text/csv"
              disabled={submitting}
              aria-describedby="import-file-help"
              onChange={(event) => {
                void readFile(event.target.files?.[0]);
              }}
              className="file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground"
            />
            <p id="import-file-help" className="text-xs text-muted-foreground">
              Spendr export headers are mapped automatically. ID and unused
              columns are ignored.
            </p>
            {reading && (
              <p role="status" className="text-sm text-muted-foreground">
                Reading CSV…
              </p>
            )}
            {fileError && (
              <p role="alert" className="text-sm text-destructive">
                {fileError}
              </p>
            )}
          </div>

          {csv && (
            <section
              aria-labelledby="import-mapping-title"
              className="space-y-3"
            >
              <h3 id="import-mapping-title" className="text-sm font-medium">
                Map columns
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {CSV_FIELDS.map((field) => (
                  <div key={field} className="min-w-0 space-y-1.5">
                    <Label htmlFor={`import-${field}`}>
                      {FIELD_LABELS[field]}
                      {field === "category" || field === "recurring"
                        ? " (optional)"
                        : " (required)"}
                    </Label>
                    <Select
                      value={
                        mapping[field] === null
                          ? "unmapped"
                          : String(mapping[field])
                      }
                      disabled={submitting}
                      onValueChange={(value) => {
                        setMapping((previous) => ({
                          ...previous,
                          [field]: value === "unmapped" ? null : Number(value),
                        }));
                        setServerError("");
                      }}
                    >
                      <SelectTrigger
                        id={`import-${field}`}
                        className="[&>span]:truncate"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unmapped">
                          {field === "category"
                            ? "Not mapped — Other"
                            : field === "recurring"
                              ? "Not mapped — No"
                              : "Select a column"}
                        </SelectItem>
                        {csv.headers.map((header, index) => (
                          <SelectItem key={index} value={String(index)}>
                            Column {index + 1}: {header || "(empty header)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Type: Income or Expense. Category: a Spendr category
                (case-insensitive). Recurring: yes/no, true/false, or 1/0; blank
                means No.
              </p>
            </section>
          )}

          {preview && (
            <section
              aria-labelledby="import-preview-title"
              className="min-w-0 space-y-3"
            >
              <h3
                id="import-preview-title"
                className="text-sm font-medium"
                aria-live="polite"
              >
                {preview.transactions.length} of {preview.totalRows}{" "}
                transactions valid
              </h3>
              {preview.errors.length > 0 && (
                <div
                  role="alert"
                  className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
                >
                  <p className="font-medium">
                    Fix all {preview.errors.length} error
                    {preview.errors.length === 1 ? "" : "s"} before importing.
                    Nothing will be imported with invalid rows.
                  </p>
                  <ul className="mt-2 max-h-36 list-disc space-y-1 overflow-y-auto pl-5">
                    {preview.errors.slice(0, 50).map((error, index) => (
                      <li key={index}>
                        Line {error.row}: {error.message}
                      </li>
                    ))}
                  </ul>
                  {preview.errors.length > 50 && (
                    <p className="mt-2">Showing the first 50 errors.</p>
                  )}
                </div>
              )}
              {preview.transactions.length > 0 && (
                <>
                  <p className="text-xs text-muted-foreground">
                    {fileName} · Preview of the first{" "}
                    {Math.min(5, preview.transactions.length)} valid rows
                  </p>
                  <div className="min-w-0 rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {CSV_FIELDS.map((field) => (
                            <TableHead key={field}>
                              {FIELD_LABELS[field]}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.transactions
                          .slice(0, 5)
                          .map((transaction, index) => (
                            <TableRow key={index}>
                              <TableCell>{transaction.type}</TableCell>
                              <TableCell className="whitespace-nowrap">
                                {formatCurrency(transaction.amount)}
                              </TableCell>
                              <TableCell className="min-w-40 max-w-64 break-words whitespace-pre-wrap">
                                {transaction.description}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {transaction.date}
                              </TableCell>
                              <TableCell>{transaction.category}</TableCell>
                              <TableCell>
                                {transaction.is_recurring ? "Yes" : "No"}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </section>
          )}

          <div className="flex items-start gap-3 rounded-md border p-3">
            <input
              id="import-skip-duplicates"
              type="checkbox"
              checked={skipDuplicates}
              disabled={submitting}
              onChange={(event) => {
                setSkipDuplicates(event.target.checked);
                setServerError("");
              }}
              aria-describedby="import-duplicate-help"
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <div className="space-y-1">
              <Label
                htmlFor="import-skip-duplicates"
                className="cursor-pointer"
              >
                Skip exact duplicates
              </Label>
              <p
                id="import-duplicate-help"
                className="text-xs text-muted-foreground"
              >
                Match type, amount, description, date, category, and recurring
                status.
              </p>
            </div>
          </div>
          {serverError && (
            <p role="alert" className="text-sm text-destructive">
              {serverError} Your file and mappings have been kept.
            </p>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => changeOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canImport}>
              {submitting && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {submitting
                ? "Importing…"
                : `Import${canImport ? ` ${preview!.transactions.length} transactions` : " transactions"}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
