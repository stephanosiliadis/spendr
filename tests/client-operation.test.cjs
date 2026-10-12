require("./register.cjs")
const assert = require("node:assert/strict")
const { test, beforeEach, after } = require("node:test")
const { webcrypto } = require("node:crypto")
const operations = require("../lib/client-operation.ts")
const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, "crypto")
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage")
const storage = new Map()
const fakeStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
}

beforeEach(() => {
  storage.clear()
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: webcrypto })
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: fakeStorage })
})
after(() => {
  if (originalCrypto) Object.defineProperty(globalThis, "crypto", originalCrypto)
  else delete globalThis.crypto
  if (originalStorage) Object.defineProperty(globalThis, "sessionStorage", originalStorage)
  else delete globalThis.sessionStorage
})

test("an unresolved import reuses its operation ID after dialogs reopen and the module reloads", async () => {
  const first = await operations.beginClientOperation("import", "same financial payload")
  const second = await operations.beginClientOperation("import", "same financial payload")
  assert.equal(first.id, second.id)
  delete require.cache[require.resolve("../lib/client-operation.ts")]
  const reloaded = require("../lib/client-operation.ts")
  assert.equal((await reloaded.beginClientOperation("import", "same financial payload")).id, first.id)
  assert.ok(!JSON.stringify(Array.from(storage.values())).includes("same financial payload"))
})

test("distinct unresolved payloads retain separate receipts, and success permits a genuinely new operation", async () => {
  const first = await operations.beginClientOperation("import", "first payload")
  const other = await operations.beginClientOperation("import", "other payload")
  assert.notEqual(other.id, first.id)
  assert.equal((await operations.beginClientOperation("import", "first payload")).id, first.id)
  operations.completeClientOperation(first)
  assert.notEqual((await operations.beginClientOperation("import", "first payload")).id, first.id)
  assert.equal((await operations.beginClientOperation("import", "other payload")).id, other.id)
})

test("restore retries retain the original recovery theme even after the current theme changes", async () => {
  const first = await operations.beginClientOperation("restore", "backup payload", "dark")
  const retry = await operations.beginClientOperation("restore", "backup payload", "light")
  assert.equal(retry.id, first.id)
  assert.equal(retry.currentTheme, "dark")
  operations.completeClientOperation(retry)
  const next = await operations.beginClientOperation("restore", "backup payload", "light")
  assert.notEqual(next.id, first.id)
  assert.equal(next.currentTheme, "light")
})

test("non-secure HTTP origins use getRandomValues rather than requiring randomUUID or subtle", async () => {
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) } })
  const first = await operations.beginClientOperation("import", "http-origin payload")
  assert.match(first.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.equal((await operations.beginClientOperation("import", "http-origin payload")).id, first.id)
  assert.notEqual(operations.createOperationId(), first.id)
})

test("blocked browser storage still supports in-memory retries", async () => {
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, get() { throw new Error("Storage blocked") } })
  const first = await operations.beginClientOperation("import", "blocked-storage payload")
  assert.equal((await operations.beginClientOperation("import", "blocked-storage payload")).id, first.id)
  operations.completeClientOperation(first)
  assert.notEqual((await operations.beginClientOperation("import", "blocked-storage payload")).id, first.id)
})

test("malformed browser receipts are ignored without exposing financial content", async () => {
  storage.set("spendr.pending.import", '{"bad":{"id":"invalid"}}')
  const first = await operations.beginClientOperation("import", "valid payload")
  assert.match(first.id, /^[0-9a-f-]{36}$/)
  assert.equal((await operations.beginClientOperation("import", "valid payload")).id, first.id)
})
