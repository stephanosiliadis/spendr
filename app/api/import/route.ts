import { NextRequest, NextResponse } from "next/server";
import { importTransactions, previewImport } from "@/lib/db";
import { isRecord, MAX_IMPORT_REQUEST_BYTES, validateImportRequest } from "@/lib/data-transfer";
import { readTransferJson, transferErrorResponse } from "@/lib/transfer-api";

export async function POST(request: NextRequest) {
  try {
    const body = await readTransferJson(request, MAX_IMPORT_REQUEST_BYTES);
    if (isRecord(body) && body.previewOnly === true) {
      if (!Array.isArray(body.transactions)) { throw new Error("Provide transactions to preview."); }
      return NextResponse.json(previewImport(body.transactions));
    }
    const { transactions, skipDuplicates, operationId } = validateImportRequest(body);
    return NextResponse.json(importTransactions(transactions, skipDuplicates, operationId));
  } catch (error) {
    return transferErrorResponse(error, "Failed to import transactions.");
  }
}
