require("./register.cjs")
const assert = require("node:assert/strict")
const { test } = require("node:test")
const { randomUUID } = require("node:crypto")
const {
  validateTransactionInput, validateImportRequest, validateBackup, transactionFingerprint,
  isCalendarDate, isThemePreference, MAX_TRANSFER_TRANSACTIONS, TransferValidationError,
} = require("../lib/data-transfer.ts")
const { readTransferJson } = require("../lib/transfer-api.ts")

const input = { type: "Expense", amount: 12.34, description: "Rent", date: "2026-10-12", category: "Housing", is_recurring: true }
const backup = () => ({ app: "spendr", version: 1, createdAt: "2026-10-12T10:00:00.000Z", settings: { theme: "system" }, transactions: [{ ...input, id: 1, is_recurring: 1 }] })

test("input validation normalizes description and defaults recurring", () => {
  assert.deepEqual(validateTransactionInput({ ...input, description: " Rent ", is_recurring: undefined }), { ...input, description: "Rent", is_recurring: false })
  for (const amount of [0.01, 0.29, 1.01, 12.34, 100]) assert.equal(validateTransactionInput({ ...input, amount }).amount, amount)
})

test("invalid transfer values are rejected before any mutation", () => {
  for (const amount of [0, -1, NaN, Infinity, 1.001, "12", Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => validateTransactionInput({ ...input, amount }), TransferValidationError)
  }
  for (const value of [null, [], {}, { ...input, type: "Transfer" }, { ...input, description: " " }, { ...input, description: "a".repeat(201) }, { ...input, category: "Invalid" }, { ...input, is_recurring: 1 }, { ...input, date: "2026-02-29" }]) {
    assert.throws(() => validateTransactionInput(value), TransferValidationError)
  }
})

test("calendar dates and theme preferences are explicit", () => {
  for (const date of ["2024-02-29", "2000-02-29", "2026-12-31", "0001-01-01"]) assert.equal(isCalendarDate(date), true)
  for (const date of ["1900-02-29", "2026-04-31", "2026-00-01", "0000-01-01", "2026-1-1", "2026-01-01T00:00:00Z"]) assert.equal(isCalendarDate(date), false)
  for (const theme of ["system", "light", "dark"]) assert.equal(isThemePreference(theme), true)
  assert.equal(isThemePreference("auto"), false)
})

test("imports require a bounded nonempty array, a duplicate policy, and an operation ID", () => {
  const operationId = randomUUID()
  assert.deepEqual(validateImportRequest({ transactions: [input], skipDuplicates: true, operationId }), { transactions: [input], skipDuplicates: true, operationId })
  for (const body of [null, {}, { transactions: [], skipDuplicates: true, operationId }, { transactions: [input], skipDuplicates: "yes", operationId }, { transactions: [input], skipDuplicates: true }, { transactions: Array(MAX_TRANSFER_TRANSACTIONS + 1).fill(input), skipDuplicates: true, operationId }]) {
    assert.throws(() => validateImportRequest(body), TransferValidationError)
  }
  assert.throws(() => validateImportRequest({ transactions: [input, { ...input, amount: -1 }], skipDuplicates: true, operationId }), /Transaction 2/)
})

test("backup round-trip preserves IDs, recurring flags, settings, and legacy precision", () => {
  for (const theme of ["system", "light", "dark"]) {
    const value = backup()
    value.settings.theme = theme
    value.transactions[0].amount = 12.345
    value.transactions[0].description = " Legacy precision " + "a".repeat(250)
    assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(value))), value)
  }
  const empty = backup()
  empty.transactions = []
  assert.deepEqual(validateBackup(empty), empty)
})

test("backup validation rejects exports, wrong versions, duplicates, and malformed records", () => {
  for (const value of [[], { ...backup(), version: 2 }, { ...backup(), app: "other" }, { ...backup(), createdAt: "invalid" }, { ...backup(), settings: { theme: "auto" } }]) assert.throws(() => validateBackup(value), TransferValidationError)
  const duplicate = backup()
  duplicate.transactions.push({ ...duplicate.transactions[0] })
  assert.throws(() => validateBackup(duplicate), /unique positive integers/)
  for (const patch of [{ id: 0 }, { id: 1.5 }, { is_recurring: true }, { amount: -1 }, { type: "Transfer" }, { date: "2026-02-30" }, { category: "Unknown" }, { description: "" }]) {
    const value = backup()
    Object.assign(value.transactions[0], patch)
    assert.throws(() => validateBackup(value), TransferValidationError)
  }
})

test("duplicate fingerprint excludes IDs and includes every user-entered field", () => {
  const stored = { ...input, id: 5, is_recurring: 1 }
  assert.equal(transactionFingerprint(stored), transactionFingerprint({ ...input, description: " Rent " }))
  for (const patch of [{ type: "Income" }, { amount: 13 }, { date: "2026-10-13" }, { description: "Other rent" }, { category: "Other" }, { is_recurring: false }]) {
    assert.notEqual(transactionFingerprint(stored), transactionFingerprint({ ...input, ...patch }))
  }
})

test("request JSON reader handles missing lengths and rejects oversized or malformed bodies", async () => {
  assert.deepEqual(await readTransferJson(new Request("http://localhost", { method: "POST", body: '{"ok":true}' }), 32), { ok: true })
  await assert.rejects(readTransferJson(new Request("http://localhost", { method: "POST", body: "x".repeat(33) }), 32), (error) => error.status === 413)
  await assert.rejects(readTransferJson(new Request("http://localhost", { method: "POST", body: "{}", headers: { "Content-Length": "100" } }), 32), (error) => error.status === 413)
  await assert.rejects(readTransferJson(new Request("http://localhost", { method: "POST", body: "{" }), 32), TransferValidationError)
  await assert.rejects(readTransferJson(new Request("http://localhost", { method: "POST" }), 32), TransferValidationError)
})
