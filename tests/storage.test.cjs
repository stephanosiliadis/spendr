require("./register.cjs")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { randomUUID } = require("node:crypto")
const { test, beforeEach, after } = require("node:test")

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "spendr-storage-test-"))
process.env.DATA_DIR = directory
const db = require("../lib/db.ts")
const filename = path.join(directory, "transactions.json")
const metadataFile = path.join(directory, "transaction-meta.json")
const journalFile = path.join(directory, "transaction-journal.json")
const input = { type: "Expense", amount: 12.34, description: "Rent", date: "2026-10-12", category: "Housing", is_recurring: true }
const stored = { ...input, id: 1, is_recurring: 1 }
const replacement = () => ({ app: "spendr", version: 1, createdAt: "2026-10-12T10:00:00.000Z", settings: { theme: "light" }, transactions: [{ ...stored, id: 20, description: "Restored rent" }] })
const read = () => JSON.parse(fs.readFileSync(filename, "utf8"))

beforeEach(() => {
  for (const name of fs.readdirSync(directory)) fs.rmSync(path.join(directory, name), { recursive: true, force: true })
  fs.writeFileSync(filename, JSON.stringify([stored]))
})
after(() => fs.rmSync(directory, { recursive: true, force: true }))

test("delete and Undo preserve fields and ID; IDs stay reserved; retries do not duplicate", () => {
  const deleted = db.deleteTransaction(1)
  assert.ok(deleted.undoToken)
  assert.ok(deleted.undoExpiresAt > Date.now())
  assert.deepEqual(read(), [])
  assert.deepEqual(db.deleteTransaction(1), deleted)
  const fresh = db.createTransaction({ ...input, description: "New transaction" })
  assert.equal(fresh.id, 2)
  assert.deepEqual(db.undoDeleteTransaction(deleted.undoToken), stored)
  assert.deepEqual(db.undoDeleteTransaction(deleted.undoToken), stored)
  assert.equal(read().length, 2)
  assert.equal(db.deleteTransaction(999), null)
})

test("expired and unknown Undo tokens cannot restore transactions", () => {
  const deleted = db.deleteTransaction(1)
  const metadata = JSON.parse(fs.readFileSync(metadataFile, "utf8"))
  metadata.deletions[0].expiresAt = Date.now() - 1
  fs.writeFileSync(metadataFile, JSON.stringify(metadata))
  assert.throws(() => db.undoDeleteTransaction(deleted.undoToken), (error) => error.status === 410)
  assert.throws(() => db.undoDeleteTransaction(randomUUID()), (error) => error.status === 410)
  assert.deepEqual(read(), [])
})

test("Undo refuses to overwrite conflicting data", () => {
  const deleted = db.deleteTransaction(1)
  fs.writeFileSync(filename, JSON.stringify([{ ...stored, description: "Conflicting record" }]))
  assert.throws(() => db.undoDeleteTransaction(deleted.undoToken), (error) => error.status === 409)
  assert.equal(read()[0].description, "Conflicting record")
})

test("imports skip duplicates in storage and within the file, with fresh IDs", () => {
  const newInput = { ...input, description: "Groceries", is_recurring: false }
  assert.deepEqual(db.importTransactions([input, newInput, newInput], true, randomUUID()), { imported: 1, skipped: 2 })
  assert.deepEqual(read().map((transaction) => transaction.id), [1, 2])
  assert.equal(read()[1].is_recurring, 0)
})

test("imports retain intentional duplicates and replay once even after later changes", () => {
  const operationId = randomUUID()
  const result = db.importTransactions([input, input], false, operationId)
  assert.deepEqual(result, { imported: 2, skipped: 0 })
  db.createTransaction({ ...input, description: "Later change" })
  assert.deepEqual(db.importTransactions([input, input], false, operationId), result)
  assert.equal(read().length, 4)
  assert.throws(() => db.importTransactions([{ ...input, amount: 15 }], false, operationId), (error) => error.status === 409)
  assert.equal(read().length, 4)
})

test("invalid import row cannot partially append data", () => {
  const original = fs.readFileSync(filename, "utf8")
  assert.throws(() => db.importTransactions([input, { ...input, date: "2026-02-30" }], false, randomUUID()), /Transaction 2/)
  assert.equal(fs.readFileSync(filename, "utf8"), original)
  assert.equal(fs.existsSync(metadataFile), false)
})

test("backup contains full history rather than a table page and preserves legacy precision", () => {
  const transactions = Array.from({ length: 30 }, (_, index) => ({ ...stored, id: index + 1 }))
  transactions[0].amount = 12.345
  fs.writeFileSync(filename, JSON.stringify(transactions))
  const backup = db.createBackup("dark")
  assert.equal(backup.version, 1)
  assert.deepEqual(backup.settings, { theme: "dark" })
  assert.deepEqual(backup.transactions, transactions)
})

test("restore replaces data, snapshots previous data/theme, clears Undo, and safely replays", () => {
  const deleted = db.deleteTransaction(1)
  const later = db.createTransaction({ ...input, description: "Before restore" })
  const operationId = randomUUID()
  const backup = replacement()
  const result = db.restoreBackup(backup, "dark", operationId)
  assert.equal(result.restored, 1)
  assert.deepEqual(read(), backup.transactions)
  const recovery = db.getRecoveryBackup(result.recoveryFile)
  assert.deepEqual(recovery.transactions, [later])
  assert.deepEqual(recovery.settings, { theme: "dark" })
  assert.throws(() => db.undoDeleteTransaction(deleted.undoToken), (error) => error.status === 410)
  db.createTransaction({ ...input, description: "After restore" })
  assert.deepEqual(db.restoreBackup(backup, "dark", operationId), result)
  assert.equal(read().length, 2)
  assert.equal(read()[1].description, "After restore")
  assert.equal(fs.readdirSync(path.join(directory, "backups")).length, 1)
  assert.throws(() => db.restoreBackup({ ...backup, settings: { theme: "system" } }, "dark", operationId), (error) => error.status === 409)
})

test("restore supports an explicitly selected empty backup", () => {
  const backup = replacement()
  backup.transactions = []
  assert.equal(db.restoreBackup(backup, "system", randomUUID()).restored, 0)
  assert.deepEqual(read(), [])
})

test("invalid backup leaves all data and Undo information untouched", () => {
  const deleted = db.deleteTransaction(1)
  const beforeData = fs.readFileSync(filename, "utf8")
  const beforeMetadata = fs.readFileSync(metadataFile, "utf8")
  const backup = replacement()
  backup.transactions.push({ ...backup.transactions[0] })
  assert.throws(() => db.restoreBackup(backup, "system", randomUUID()), /unique positive integers/)
  assert.equal(fs.readFileSync(filename, "utf8"), beforeData)
  assert.equal(fs.readFileSync(metadataFile, "utf8"), beforeMetadata)
  assert.equal(fs.existsSync(path.join(directory, "backups")), false)
  assert.deepEqual(db.undoDeleteTransaction(deleted.undoToken), stored)
})

test("recovery snapshots are downloadable even for incompatible legacy records", () => {
  const legacy = { ...stored, date: "legacy date needing correction" }
  fs.writeFileSync(filename, JSON.stringify([legacy]))
  assert.deepEqual(db.createBackup("system").transactions, [legacy])
  const result = db.restoreBackup(replacement(), "system", randomUUID())
  assert.deepEqual(db.getRecoveryBackup(result.recoveryFile).transactions, [legacy])
})

test("recovery filenames cannot traverse the filesystem", () => {
  for (const name of ["../transactions.json", "transactions.json", "../../secret", "pre-restore-invalid.json"]) assert.throws(() => db.getRecoveryBackup(name), /Invalid recovery filename/)
  assert.throws(() => db.getRecoveryBackup(`pre-restore-1-${randomUUID()}.json`), (error) => error.status === 404)
})

test("corrupt storage is never silently replaced by an import", () => {
  fs.writeFileSync(filename, "{ corrupt }")
  assert.throws(() => db.importTransactions([input], true, randomUUID()))
  assert.equal(fs.readFileSync(filename, "utf8"), "{ corrupt }")
})

test("an interrupted import commit recovers data and the retry receipt together", () => {
  const operationId = randomUUID()
  const originalRename = fs.renameSync
  fs.renameSync = function (source, destination) {
    if (destination === metadataFile) throw new Error("Simulated metadata write failure")
    return originalRename.call(this, source, destination)
  }
  try {
    assert.throws(() => db.importTransactions([input], false, operationId), /Simulated metadata/)
    assert.equal(fs.existsSync(journalFile), true)
  } finally { fs.renameSync = originalRename }
  assert.deepEqual(db.importTransactions([input], false, operationId), { imported: 1, skipped: 0 })
  assert.equal(read().length, 2)
  assert.equal(fs.existsSync(journalFile), false)
})

test("an interrupted restore commit recovers without losing Undo or replaying replacement", () => {
  const deleted = db.deleteTransaction(1)
  const operationId = randomUUID()
  const originalRename = fs.renameSync
  fs.renameSync = function (source, destination) {
    if (destination === filename) throw new Error("Simulated data write failure")
    return originalRename.call(this, source, destination)
  }
  try {
    assert.throws(() => db.restoreBackup(replacement(), "system", operationId), /Simulated data/)
    // Before recovery, neither original data nor original Undo metadata was changed.
    assert.deepEqual(read(), [])
    assert.equal(JSON.parse(fs.readFileSync(metadataFile, "utf8")).deletions[0].token, deleted.undoToken)
    assert.equal(fs.existsSync(journalFile), true)
  } finally { fs.renameSync = originalRename }
  const result = db.restoreBackup(replacement(), "system", operationId)
  assert.equal(result.restored, 1)
  assert.deepEqual(read(), replacement().transactions)
  assert.equal(fs.readdirSync(path.join(directory, "backups")).length, 1)
  assert.throws(() => db.undoDeleteTransaction(deleted.undoToken), (error) => error.status === 410)
})

test("deletion retry recovers its original Undo token after an interrupted commit", () => {
  const originalRename = fs.renameSync
  fs.renameSync = function (source, destination) {
    if (destination === metadataFile) throw new Error("Simulated deletion metadata failure")
    return originalRename.call(this, source, destination)
  }
  let token
  try {
    assert.throws(() => db.deleteTransaction(1), /Simulated deletion/)
    token = JSON.parse(fs.readFileSync(journalFile, "utf8")).metadata.deletions[0].token
  } finally { fs.renameSync = originalRename }
  const replay = db.deleteTransaction(1)
  assert.equal(replay.undoToken, token)
  assert.deepEqual(db.undoDeleteTransaction(token), stored)
  assert.deepEqual(read(), [stored])
})

test("writes cannot silently exceed the supported backup transaction limit", () => {
  const { MAX_BACKUP_TRANSACTIONS } = require("../lib/data-transfer.ts")
  const original = JSON.stringify(Array.from({ length: MAX_BACKUP_TRANSACTIONS }, (_, index) => ({ ...stored, id: index + 1 })))
  fs.writeFileSync(filename, original)
  assert.throws(() => db.createTransaction(input), (error) => error.status === 413)
  assert.equal(fs.readFileSync(filename, "utf8"), original)
  assert.equal(fs.existsSync(journalFile), false)
})

test("new and edited transactions obey the same validation as imports", () => {
  const before = fs.readFileSync(filename, "utf8")
  assert.throws(() => db.createTransaction({ ...input, amount: 1.001 }))
  assert.throws(() => db.updateTransaction(1, { ...input, date: "2026-02-30" }))
  assert.equal(fs.readFileSync(filename, "utf8"), before)
})
