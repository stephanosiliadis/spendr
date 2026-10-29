import { NextRequest, NextResponse } from "next/server";
import { createBackup, getRecoveryBackup, restoreBackup } from "@/lib/db";
import { isRecord, isThemePreference, MAX_BACKUP_BYTES, TransferValidationError, validateBackup, validateOperationId } from "@/lib/data-transfer";
import { readTransferJson, transferErrorResponse } from "@/lib/transfer-api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const recovery = request.nextUrl.searchParams.get("recovery");
    const theme = request.nextUrl.searchParams.get("theme") ?? "system";
    if (!isThemePreference(theme)) {throw new TransferValidationError("Invalid theme preference.");}
    const backup = recovery ? getRecoveryBackup(recovery) : createBackup(theme);
    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${recovery ?? `spendr-backup-${new Date().toISOString().slice(0, 10)}.json`}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return transferErrorResponse(error, "Failed to create backup.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readTransferJson(request, MAX_BACKUP_BYTES + 1024);
    if (!isRecord(body) || body.confirm !== true) {throw new TransferValidationError("Confirm that you want to replace all transactions.");}
    if (!isThemePreference(body.currentTheme)) {throw new TransferValidationError("Invalid current theme preference.");}
    const backup = validateBackup(body.backup);
    const result = restoreBackup(backup, body.currentTheme, validateOperationId(body.operationId));
    return NextResponse.json({ ...result, settings: backup.settings });
  } catch (error) {
    return transferErrorResponse(error, "Failed to restore backup.");
  }
}
