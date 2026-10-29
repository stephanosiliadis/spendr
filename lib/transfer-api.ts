import { NextResponse } from "next/server";
import { TransferValidationError } from "./data-transfer";

/** Enforce the limit while reading, including requests without Content-Length. */
export async function readTransferJson(request: Request, maxBytes: number): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new TransferValidationError("File exceeds the upload size limit.", 413);
  }
  if (!request.body) {throw new TransferValidationError("Request body is required.");}
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {break;}
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        throw new TransferValidationError("File exceeds the upload size limit.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new TransferValidationError("Choose a valid JSON file or request body.");
  }
}

export function transferErrorResponse(error: unknown, message: string) {
  if (error instanceof TransferValidationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(message, error);
  return NextResponse.json({ error: message }, { status: 500 });
}
