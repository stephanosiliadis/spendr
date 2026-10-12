require("./register.cjs")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { randomUUID } = require("node:crypto")
const { test, beforeEach, after } = require("node:test")
const { NextRequest } = require("next/server")

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "spendr-api-test-"))
process.env.DATA_DIR = directory
const db = require("../lib/db.ts")
const imports = require("../app/api/import/route.ts")
const backups = require("../app/api/backup/route.ts")
const undo = require("../app/api/transactions/undo/route.ts")
const transactions = require("../app/api/transactions/route.ts")
const transaction = require("../app/api/transactions/[id]/route.ts")
const exportRoute = require("../app/api/export/route.ts")
const { parseCsv, buildCsvTransactions } = require("../lib/csv.ts")
const { MAX_IMPORT_REQUEST_BYTES } = require("../lib/data-transfer.ts")
const filename = path.join(directory, "transactions.json")
const input = { type: "Expense", amount: 12.34, description: 'Rent, "monthly"\nPaid', date: "2026-10-12", category: "Housing", is_recurring: true }
const stored = { ...input, id: 1, is_recurring: 1 }
const request = (route, body, headers = {}) => new NextRequest(`http://localhost${route}`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) })
const read = () => JSON.parse(fs.readFileSync(filename, "utf8"))
const backup = () => ({ app: "spendr", version: 1, createdAt: "2026-10-12T10:00:00.000Z", settings: { theme: "dark" }, transactions: [{ ...stored, id: 10, description: "Restored" }] })
const restoreRequest = (value, extra = {}) => request("/api/backup", { backup: value, confirm: true, currentTheme: "system", operationId: randomUUID(), ...extra })

beforeEach(() => {
  for (const name of fs.readdirSync(directory)) fs.rmSync(path.join(directory, name), { recursive: true, force: true })
  fs.writeFileSync(filename, JSON.stringify([stored]))
})
after(() => fs.rmSync(directory, { recursive: true, force: true }))

test("DELETE returns an Undo token; the Undo endpoint preserves the original and supports replay", async () => {
  const deletion = await transaction.DELETE(new NextRequest("http://localhost/api/transactions/1", { method: "DELETE" }), { params: { id: "1" } })
  assert.equal(deletion.status, 200)
  const data = await deletion.json()
  assert.equal(data.success, true)
  assert.ok(data.undoToken)
  assert.ok(data.undoExpiresAt > Date.now())
  assert.deepEqual(read(), [])
  for (let i = 0; i < 2; i++) {
    const response = await undo.POST(request("/api/transactions/undo", { token: data.undoToken }))
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), stored)
  }
  assert.deepEqual(read(), [stored])
})

test("Undo endpoint rejects malformed and unknown tokens", async () => {
  assert.equal((await undo.POST(request("/api/transactions/undo", { token: "bad" }))).status, 400)
  assert.equal((await undo.POST(request("/api/transactions/undo", { token: randomUUID() }))).status, 410)
  assert.deepEqual(read(), [stored])
})

test("import endpoint imports validated data and returns duplicate counts", async () => {
  const response = await imports.POST(request("/api/import", { transactions: [input, { ...input, description: "Fresh entry" }], skipDuplicates: true, operationId: randomUUID() }))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { imported: 1, skipped: 1 })
  assert.equal(read().length, 2)
})

test("import endpoint safely replays without duplicates when duplicate skipping is off", async () => {
  const body = { transactions: [input], skipDuplicates: false, operationId: randomUUID() }
  for (let i = 0; i < 2; i++) {
    const response = await imports.POST(request("/api/import", body))
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { imported: 1, skipped: 0 })
  }
  assert.equal(read().length, 2)
  assert.equal((await imports.POST(request("/api/import", { ...body, skipDuplicates: true }))).status, 409)
})

test("import rejects invalid rows, missing operation IDs, malformed JSON, and oversized requests", async () => {
  const original = fs.readFileSync(filename, "utf8")
  assert.equal((await imports.POST(request("/api/import", { transactions: [input, { ...input, amount: -1 }], skipDuplicates: true, operationId: randomUUID() }))).status, 400)
  assert.equal((await imports.POST(request("/api/import", { transactions: [input], skipDuplicates: true }))).status, 400)
  assert.equal((await imports.POST(new NextRequest("http://localhost/api/import", { method: "POST", body: "{" }))).status, 400)
  assert.equal((await imports.POST(request("/api/import", {}, { "Content-Length": String(MAX_IMPORT_REQUEST_BYTES + 1) }))).status, 413)
  assert.equal(fs.readFileSync(filename, "utf8"), original)
})

test("CSV export with commas, quotes, and newlines can be imported without data changes", async () => {
  const exported = await exportRoute.GET(new NextRequest("http://localhost/api/export?format=csv"))
  assert.equal(exported.status, 200)
  const preview = buildCsvTransactions(parseCsv(await exported.text()))
  assert.deepEqual(preview.errors, [])
  assert.deepEqual(preview.transactions, [input])
  const imported = await imports.POST(request("/api/import", { transactions: preview.transactions, skipDuplicates: true, operationId: randomUUID() }))
  assert.deepEqual(await imported.json(), { imported: 0, skipped: 1 })
  assert.deepEqual(read(), [stored])
})

test("backup download is versioned, includes selected theme, and is not cached", async () => {
  const response = await backups.GET(new NextRequest("http://localhost/api/backup?theme=light"))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("Cache-Control"), "no-store")
  assert.match(response.headers.get("Content-Disposition"), /spendr-backup-.*\.json/)
  const value = await response.json()
  assert.equal(value.app, "spendr")
  assert.equal(value.version, 1)
  assert.deepEqual(value.settings, { theme: "light" })
  assert.deepEqual(value.transactions, [stored])
  assert.equal((await backups.GET(new NextRequest("http://localhost/api/backup?theme=auto"))).status, 400)
})

test("restore endpoint requires confirmation and validates all records before writing", async () => {
  const original = fs.readFileSync(filename, "utf8")
  assert.equal((await backups.POST(restoreRequest(backup(), { confirm: false }))).status, 400)
  assert.equal((await backups.POST(restoreRequest(backup(), { operationId: "invalid" }))).status, 400)
  assert.equal((await backups.POST(restoreRequest(backup(), { currentTheme: "auto" }))).status, 400)
  assert.equal((await backups.POST(restoreRequest([stored]))).status, 400)
  const invalid = backup()
  invalid.transactions[0].date = "2026-02-30"
  assert.equal((await backups.POST(restoreRequest(invalid))).status, 400)
  assert.equal(fs.readFileSync(filename, "utf8"), original)
})

test("restore endpoint provides a downloadable recovery snapshot and never replaces data twice", async () => {
  const value = backup()
  const operationId = randomUUID()
  const response = await backups.POST(restoreRequest(value, { operationId }))
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.restored, 1)
  assert.deepEqual(result.settings, { theme: "dark" })
  assert.deepEqual(read(), value.transactions)
  const recovery = await backups.GET(new NextRequest(`http://localhost/api/backup?recovery=${result.recoveryFile}`))
  assert.equal(recovery.status, 200)
  const recovered = await recovery.json()
  assert.deepEqual(recovered.transactions, [stored])
  assert.deepEqual(recovered.settings, { theme: "system" })
  db.createTransaction({ ...input, description: "Later entry" })
  const replay = await backups.POST(restoreRequest(value, { operationId }))
  assert.deepEqual(await replay.json(), result)
  assert.equal(read().length, 2)
  const traversal = await backups.GET(new NextRequest("http://localhost/api/backup?recovery=..%2Ftransactions.json"))
  assert.equal(traversal.status, 400)
})

test("ordinary creation and editing reject values incompatible with portable backups", async () => {
  assert.equal((await transactions.POST(request("/api/transactions", { ...input, date: "not a date" }))).status, 400)
  const edited = await transaction.PUT(new NextRequest("http://localhost/api/transactions/1", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, amount: 12.345 }) }), { params: { id: "1" } })
  assert.equal(edited.status, 400)
  assert.deepEqual(read(), [stored])
})
