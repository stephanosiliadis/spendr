import { isRecord, isThemePreference, type ThemePreference } from "./data-transfer";

export interface ClientOperation {
  id: string
  digest: string
  kind: "import" | "restore"
  currentTheme?: ThemePreference
}

type PendingOperations = Record<string, { id: string; currentTheme?: ThemePreference }>
const fallback = new Map<string, PendingOperations>();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** getRandomValues is available on HTTP origins where randomUUID is not. */
export function createOperationId(): string {
  if (typeof crypto.randomUUID === "function") {return crypto.randomUUID();}
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function payloadDigest(payload: string): Promise<string> {
  if (crypto.subtle) {
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
    return `sha256:${Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  }
  // Only a retry lookup key, never a security check: the server verifies a SHA-256 payload hash.
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let i = 0; i < payload.length; i++) {
    first = Math.imul(first ^ payload.charCodeAt(i), 0x01000193);
    second = Math.imul(second ^ payload.charCodeAt(i), 0x85ebca6b);
  }
  return `lookup:${payload.length}:${first >>> 0}:${second >>> 0}`;
}

function load(key: string): PendingOperations {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(key) ?? "{}");
    if (isRecord(raw)) {
      const result: PendingOperations = {};
      for (const [digest, entry] of Object.entries(raw)) {
        if (isRecord(entry) && typeof entry.id === "string" && uuidPattern.test(entry.id)
          && (entry.currentTheme === undefined || isThemePreference(entry.currentTheme))) {
          result[digest] = { id: entry.id, currentTheme: entry.currentTheme };
        }
      }
      fallback.set(key, result);
      return result;
    }
  } catch { /* Private browsing/storage restrictions still allow in-memory retries. */ }
  return fallback.get(key) ?? {};
}

function save(key: string, operations: PendingOperations) {
  fallback.set(key, operations);
  try {
    if (Object.keys(operations).length) {sessionStorage.setItem(key, JSON.stringify(operations));}
    else {sessionStorage.removeItem(key);}
  } catch { /* Keep the in-memory receipt when browser storage is unavailable. */ }
}

/** Only fingerprints and operation IDs are stored, not the financial payload. */
export async function beginClientOperation(kind: ClientOperation["kind"], payload: string, currentTheme?: ThemePreference): Promise<ClientOperation> {
  const digest = await payloadDigest(payload);
  const key = `spendr.pending.${kind}`;
  const operations = load(key);
  const existing = operations[digest];
  if (existing) {return { ...existing, kind, digest };}
  const entry = { id: createOperationId(), currentTheme };
  operations[digest] = entry;
  save(key, operations);
  return { ...entry, kind, digest };
}

export function completeClientOperation(operation: ClientOperation): void {
  const key = `spendr.pending.${operation.kind}`;
  const operations = load(key);
  if (operations[operation.digest]?.id === operation.id) {
    delete operations[operation.digest];
    save(key, operations);
  }
}
