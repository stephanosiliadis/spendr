import { NextRequest, NextResponse } from "next/server"
import { undoDeleteTransaction } from "@/lib/db"
import { isRecord, TransferValidationError } from "@/lib/data-transfer"
import { readTransferJson, transferErrorResponse } from "@/lib/transfer-api"

export async function POST(request: NextRequest) {
  try {
    const body = await readTransferJson(request, 1024)
    if (!isRecord(body) || typeof body.token !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.token)) {
      throw new TransferValidationError("Provide a valid Undo token.")
    }
    return NextResponse.json(undoDeleteTransaction(body.token))
  } catch (error) {
    return transferErrorResponse(error, "Failed to restore transaction.")
  }
}
