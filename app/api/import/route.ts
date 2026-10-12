import { NextRequest, NextResponse } from "next/server"
import { importTransactions } from "@/lib/db"
import { MAX_IMPORT_REQUEST_BYTES, validateImportRequest } from "@/lib/data-transfer"
import { readTransferJson, transferErrorResponse } from "@/lib/transfer-api"

export async function POST(request: NextRequest) {
  try {
    const { transactions, skipDuplicates, operationId } = validateImportRequest(await readTransferJson(request, MAX_IMPORT_REQUEST_BYTES))
    return NextResponse.json(importTransactions(transactions, skipDuplicates, operationId))
  } catch (error) {
    return transferErrorResponse(error, "Failed to import transactions.")
  }
}
