"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { useTheme } from "next-themes";
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
  isThemePreference,
  MAX_BACKUP_BYTES,
  validateBackup,
  type SpendrBackup,
  type ThemePreference,
} from "@/lib/data-transfer";
import {
  beginClientOperation,
  completeClientOperation,
} from "@/lib/client-operation";

interface BackupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

async function downloadBackup(theme: ThemePreference, recovery?: string) {
  const query = recovery
    ? `recovery=${encodeURIComponent(recovery)}`
    : `theme=${theme}`;
  const response = await fetch(`/api/backup?${query}`, { cache: "no-store" });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to download backup.");
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download =
    recovery ?? `spendr-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function BackupDialog({
  open,
  onOpenChange,
  onSuccess,
}: BackupDialogProps) {
  const { theme, setTheme } = useTheme();
  const currentTheme = isThemePreference(theme) ? theme : "system";
  const [backup, setBackup] = useState<SpendrBackup | null>(null);
  const [fileError, setFileError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [reading, setReading] = useState(false);
  const [operation, setOperation] = useState<"download" | "restore" | null>(
    null,
  );
  const fileInput = useRef<HTMLInputElement>(null);
  const readVersion = useRef(0);
  const locked = useRef(false);

  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => {
      mounted.current = false;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      readVersion.current++;
    };
  }, []);

  useEffect(() => {
    readVersion.current++;
    if (open) {
      setBackup(null);

      setFileError("");
      setConfirmed(false);
      setReading(false);
      if (fileInput.current) {
        fileInput.current.value = "";
      }
    }
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      readVersion.current++;
    };
  }, [open]);

  function changeOpen(next: boolean) {
    if (locked.current) {
      return;
    }
    if (!next) {
      readVersion.current++;
    }
    onOpenChange(next);
  }

  async function readFile(file?: File) {
    if (locked.current) {
      return;
    }
    const version = ++readVersion.current;

    setBackup(null);
    setConfirmed(false);
    setFileError("");
    setReading(false);
    if (!file) {
      return;
    }
    if (file.size > MAX_BACKUP_BYTES) {
      setFileError("Choose a backup of 100 MiB or smaller.");
      return;
    }
    setReading(true);
    try {
      const text = await file.text();
      if (version !== readVersion.current) {
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(text.replace(/^\uFEFF/, ""));
      } catch {
        throw new Error("This file is not valid JSON.");
      }
      setBackup(validateBackup(parsed));
    } catch (error) {
      if (version === readVersion.current) {
        setFileError(
          error instanceof Error ? error.message : "Invalid backup.",
        );
      }
    } finally {
      if (version === readVersion.current) {
        setReading(false);
      }
    }
  }

  async function handleDownload() {
    if (locked.current) {
      return;
    }
    locked.current = true;
    setOperation("download");
    try {
      await downloadBackup(currentTheme);
      toast.success("Backup downloaded");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to download backup.",
      );
    } finally {
      locked.current = false;
      if (mounted.current) {
        setOperation(null);
      }
    }
  }

  async function handleRestore() {
    if (!backup || !confirmed || reading || locked.current) {
      return;
    }
    locked.current = true;
    setOperation("restore");
    setFileError("");
    let result: { restored: number; recoveryFile: string };
    try {
      const operation = await beginClientOperation(
        "restore",
        JSON.stringify(backup),
        currentTheme,
      );
      const response = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          backup,
          confirm: true,
          currentTheme: operation.currentTheme ?? currentTheme,
          operationId: operation.id,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to restore backup.");
      }
      if (
        !Number.isInteger(data.restored) ||
        data.restored < 0 ||
        typeof data.recoveryFile !== "string"
      ) {
        throw new Error(
          "Unexpected restore result. Retry to retrieve the original result safely.",
        );
      }
      completeClientOperation(operation);
      result = data;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to restore backup.";
      if (mounted.current) {
        setFileError(message);
      }
      toast.error(message);
      return;
    } finally {
      locked.current = false;
      if (mounted.current) {
        setOperation(null);
      }
    }
    if (!mounted.current) {
      return;
    }
    setTheme(backup.settings.theme);
    toast.success(
      `Restored ${result.restored} transaction${result.restored === 1 ? "" : "s"}`,
      {
        duration: 15_000,
        description:
          "Your previous data was saved in a recovery backup on the server.",
        action: {
          label: "Download previous data",
          onClick: () => {
            downloadBackup(currentTheme, result.recoveryFile).catch(
              (error: unknown) => {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Failed to download recovery backup.",
                );
              },
            );
          },
        },
      },
    );
    onOpenChange(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent
        className={`max-h-[90dvh] overflow-y-auto sm:max-w-lg ${operation ? "[&>button]:pointer-events-none [&>button]:opacity-30" : ""}`}
        onEscapeKeyDown={(event) => {
          if (locked.current) {
            event.preventDefault();
          }
        }}
        onInteractOutside={(event) => {
          if (locked.current) {
            event.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Backup &amp; restore</DialogTitle>
          <DialogDescription>
            Back up all transactions, including recurring flags and IDs, this
            browser&apos;s theme preference, budgets, category rules, and
            savings goals.
          </DialogDescription>
        </DialogHeader>

        <section
          className="space-y-3 rounded-lg border p-4"
          aria-labelledby="backup-download-title"
        >
          <h3 id="backup-download-title" className="text-sm font-medium">
            Create a backup
          </h3>
          <p className="text-xs text-muted-foreground">
            Download a versioned JSON backup. Keep it somewhere safe; it
            contains your financial data.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={!!operation}
            onClick={handleDownload}
          >
            {operation === "download" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download backup
          </Button>
        </section>

        <section
          className="space-y-3"
          aria-labelledby="backup-restore-title"
          aria-busy={reading || operation === "restore"}
        >
          <h3 id="backup-restore-title" className="text-sm font-medium">
            Restore a backup
          </h3>
          <p className="text-xs text-muted-foreground">
            Restore replaces all current transactions and applies the saved
            theme. To add transactions without replacing them, use CSV Import
            instead.
          </p>
          <Label htmlFor="backup-file">
            Spendr backup file (up to 100 MiB)
          </Label>
          <Input
            ref={fileInput}
            id="backup-file"
            type="file"
            accept=".json,application/json"
            disabled={!!operation}
            onChange={(event) => {
              void readFile(event.target.files?.[0]);
            }}
            className="file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground"
          />
          {reading && (
            <p role="status" className="text-sm text-muted-foreground">
              Validating backup…
            </p>
          )}
          {fileError && (
            <p role="alert" className="text-sm text-destructive">
              {fileError}
            </p>
          )}
          {backup && (
            <>
              <div className="rounded-md bg-muted/40 p-3 text-sm">
                <p>
                  {backup.transactions.length.toLocaleString()} transactions ·
                  Theme: {backup.settings.theme}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Created {new Date(backup.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <p className="mb-3">
                  A recovery snapshot of your current data will be saved before
                  replacement. Any pending Undo actions will be invalidated.
                </p>
                <label
                  htmlFor="backup-confirm"
                  className="flex cursor-pointer items-start gap-2"
                >
                  <input
                    id="backup-confirm"
                    type="checkbox"
                    checked={confirmed}
                    disabled={!!operation}
                    onChange={(event) => setConfirmed(event.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 accent-primary"
                  />
                  <span>
                    I understand this will replace current transactions,
                    budgets, category rules, savings goals, and the saved theme.
                  </span>
                </label>
              </div>
            </>
          )}
        </section>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={!!operation}
            onClick={() => changeOpen(false)}
          >
            Close
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!backup || !confirmed || reading || !!operation}
            onClick={handleRestore}
          >
            {operation === "restore" && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            Replace &amp; restore
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
