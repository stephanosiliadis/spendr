require('./register.cjs')

const assert = require('node:assert/strict')
const { test } = require('node:test')
const {
  CSV_FIELDS,
  MAX_CSV_BYTES,
  parseCsv,
  defaultCsvMapping,
  buildCsvTransactions,
} = require('../lib/csv.ts')
const {
  MAX_TRANSFER_TRANSACTIONS,
  isCalendarDate,
  validateTransactionInput,
} = require('../lib/data-transfer.ts')

const HEADER = 'Type,Amount,Description,Date,Category,Recurring'

function buildRow(overrides = {}) {
  const values = {
    type: 'Expense', amount: '12.34', description: 'Lunch',
    date: '2024-02-29', category: 'Food & Dining', recurring: 'no',
    ...overrides,
  }
  const row = CSV_FIELDS.map((field) => `"${String(values[field]).replace(/"/g, '""')}"`).join(',')
  return buildCsvTransactions(parseCsv(`${HEADER}\n${row}`))
}

function assertInvalid(result, message) {
  assert.equal(result.totalRows, 1)
  assert.equal(result.transactions.length, 0)
  assert.equal(result.errors.length, 1)
  assert.equal(result.errors[0].row, 2)
  assert.match(result.errors[0].message, message)
}

test('parses quoted commas, escaped quotes, empty fields, and a final record without newline', () => {
  const csv = parseCsv('A,B,C\n"comma, inside","He said ""hello""",""')
  assert.deepEqual(csv.headers, ['A', 'B', 'C'])
  assert.deepEqual(csv.rows, [['comma, inside', 'He said "hello"', '']])
  assert.deepEqual(csv.rowNumbers, [2])
  assert.equal(csv.delimiter, ',')
})

test('preserves embedded CRLF and LF while counting physical record starting lines', () => {
  const csv = parseCsv('A,B\r\n"first\r\nsecond",x\r\n\r\n"third\nfourth",y\r\nlast,z\r\n')
  assert.deepEqual(csv.rows, [['first\r\nsecond', 'x'], ['third\nfourth', 'y'], ['last', 'z']])
  assert.deepEqual(csv.rowNumbers, [2, 5, 7])
})

test('supports bare CR record separators and quoted bare CR newlines', () => {
  const csv = parseCsv('A,B\r"one\rtwo",x\rlast,y')
  assert.deepEqual(csv.rows, [['one\rtwo', 'x'], ['last', 'y']])
  assert.deepEqual(csv.rowNumbers, [2, 4])
})

test('removes a leading BOM, trims headers, and ignores whitespace-only physical lines', () => {
  const csv = parseCsv('\uFEFF Type , Amount \r\n \t\r\n Income , 1.20 \r\n')
  assert.deepEqual(csv.headers, ['Type', 'Amount'])
  assert.deepEqual(csv.rows, [[' Income ', ' 1.20 ']])
  assert.deepEqual(csv.rowNumbers, [3])
})

test('auto-detects semicolons without counting delimiters inside quoted headers or fields', () => {
  const csv = parseCsv('Type;Amount;"Description, with, commas";Date\r\nIncome;1;"comma, semicolon; and ""quote""";2024-01-01')
  assert.equal(csv.delimiter, ';')
  assert.equal(csv.rows[0][2], 'comma, semicolon; and "quote"')
  const result = buildCsvTransactions(csv, { type: 0, amount: 1, description: 2, date: 3, category: null, recurring: null })
  assert.equal(result.errors.length, 0)
  assert.equal(result.transactions.length, 1)
})

test('allows explicit delimiters and whitespace after a closing quote', () => {
  assert.deepEqual(parseCsv('A;B\n"x" \t;"y"', ';').rows, [['x', 'y']])
  assert.deepEqual(parseCsv('A,B\n"x;y",z', ',').rows, [['x;y', 'z']])
})

test('rejects malformed quotes with line-specific errors', () => {
  for (const [text, message] of [
    ['A\n"unfinished', /Line 2: unterminated quoted field/],
    ['A\ntext"quote', /Line 2: quotes must start/],
    ['A\n"closed"tail', /Line 2: unexpected text/],
    ['A,B\r\n"first\r\nsecond"oops,x', /Line 3: unexpected text/],
  ]) assert.throws(() => parseCsv(text), message)
})

test('rejects empty files and reports header-only files as having no transactions', () => {
  for (const text of ['', '\uFEFF', ' \t\r\n\n']) assert.throws(() => parseCsv(text), /empty/i)
  const result = buildCsvTransactions(parseCsv(HEADER))
  assert.equal(result.totalRows, 0)
  assert.deepEqual(result.transactions, [])
  assert.deepEqual(result.errors, [{ row: 1, message: 'The CSV has no transactions.' }])
})

test('reports short and extra-column rows without losing their physical line numbers', () => {
  const result = buildCsvTransactions(parseCsv(
    'Type,Amount,Description,Date\r\nIncome,1,"two\r\nlines",2024-01-01\r\nExpense,2,missing\r\nExpense,3,extra,2024-01-01,column',
  ))
  assert.equal(result.totalRows, 3)
  assert.equal(result.transactions.length, 1)
  assert.deepEqual(result.errors.map((error) => error.row), [4, 5])
  assert.match(result.errors[0].message, /Expected 4 columns, found 3/)
  assert.match(result.errors[1].message, /Expected 4 columns, found 5/)
})

test('normalizes default export headers and ignores ID', () => {
  const csv = parseCsv('\uFEFF ID , TYPE , Amount , Description , Date , Category , Is_Recurring\n999,income,25,Salary,2024-01-01,Salary,1')
  const mapping = defaultCsvMapping(csv.headers)
  assert.deepEqual(mapping, { type: 1, amount: 2, description: 3, date: 4, category: 5, recurring: 6 })
  const result = buildCsvTransactions(csv)
  assert.equal(result.errors.length, 0)
  assert.equal(Object.hasOwn(result.transactions[0], 'id'), false)
  for (const header of ['Recurring', ' is recurring ', 'IS-RECURRING', '\uFEFFis_recurring']) {
    assert.equal(defaultCsvMapping([header]).recurring, 0)
  }
})

test('supports custom mapping of reordered nonstandard headers and ignores unused columns', () => {
  const csv = parseCsv('Memo,Ignored,When,Value,Kind\nCoffee,anything,2024-01-01,2.50,expense')
  const result = buildCsvTransactions(csv, { type: 4, amount: 3, description: 0, date: 2, category: null, recurring: null })
  assert.deepEqual(result.errors, [])
  assert.deepEqual(result.transactions, [{ type: 'Expense', amount: 2.5, description: 'Coffee', date: '2024-01-01', category: 'Other', is_recurring: false }])
})

test('defaults unmapped or blank Category and Recurring to Other and false', () => {
  const unmapped = buildCsvTransactions(parseCsv('Type,Amount,Description,Date\nIncome,1,Gift,2024-01-01'))
  const blank = buildRow({ category: '  ', recurring: '  ' })
  for (const result of [unmapped, blank]) {
    assert.deepEqual(result.errors, [])
    assert.equal(result.transactions[0].category, 'Other')
    assert.equal(result.transactions[0].is_recurring, false)
  }
  const csv = parseCsv(`${HEADER}\nIncome,1,Gift,2024-01-01,Unknown,maybe`)
  const mapping = { ...defaultCsvMapping(csv.headers), category: null, recurring: null }
  assert.equal(buildCsvTransactions(csv, mapping).errors.length, 0)
})

test('normalizes type and category case and trims transaction fields through shared validation', () => {
  for (const [type, canonical] of [[' income ', 'Income'], ['eXpEnSe', 'Expense']]) {
    const result = buildRow({ type, category: ' food & DINING ', description: '  Lunch  ', amount: ' 12.34 ', date: ' 2024-02-29 ' })
    assert.deepEqual(result.errors, [])
    const transaction = result.transactions[0]
    assert.equal(transaction.type, canonical)
    assert.equal(transaction.category, 'Food & Dining')
    assert.equal(transaction.description, 'Lunch')
    assert.deepEqual(validateTransactionInput(transaction), transaction)
  }
  assertInvalid(buildRow({ type: 'credit' }), /Type/)
  assertInvalid(buildRow({ category: 'Groceries' }), /Unknown category/)
})

test('collects every invalid record alongside preview rows so the entire import can be blocked', () => {
  const result = buildCsvTransactions(parseCsv(
    `${HEADER}\nIncome,1,Good,2024-01-01,Other,no\nExpense,0,Bad amount,2024-01-01,Other,no\nExpense,1,Bad date,2023-02-29,Other,no\nExpense,1,Bad recurring,2024-01-01,Other,maybe`,
  ))
  assert.equal(result.totalRows, 4)
  assert.equal(result.transactions.length, 1)
  assert.deepEqual(result.errors.map((error) => error.row), [3, 4, 5])
  assert.equal(result.errors.length === 0, false, 'Preview rows must not be imported when any errors remain')
})

test('validates strict calendar dates including leap-year century rules', () => {
  for (const date of ['2024-02-29', '2000-02-29', '2023-02-28', '0001-01-01', '9999-12-31']) {
    assert.equal(isCalendarDate(date), true, date)
    assert.equal(buildRow({ date }).errors.length, 0, date)
  }
  for (const date of ['2023-02-29', '1900-02-29', '2100-02-29', '2024-04-31', '2024-00-01', '2024-13-01', '2024-01-00', '0000-01-01', '2024-1-01', '01/01/2024', '2024-01-01T00:00:00Z', '']) {
    assert.equal(isCalendarDate(date), false, date)
    assertInvalid(buildRow({ date }), /YYYY-MM-DD/)
  }
})

test('accepts positive finite amounts with zero, one, or two decimal places', () => {
  for (const amount of ['1', '1.2', '1.23', '0.01', '0001.20', '12.00']) {
    const result = buildRow({ amount })
    assert.deepEqual(result.errors, [], amount)
    assert.equal(result.transactions[0].amount, Number(amount))
  }
})

test('rejects nonpositive, nonfinite, excessive-precision, and unsafe amounts', () => {
  for (const amount of ['', '0', '0.00', '-1', '+1', '1.234', '0.001', '1.000', '1e2', 'NaN', 'Infinity', '1,23', '1.', '.50', '9'.repeat(309), '9007199254740992']) {
    assertInvalid(buildRow({ amount }), /Amount/)
  }
})

test('accepts all recurring boolean spellings case-insensitively', () => {
  for (const [recurring, expected] of [['yes', true], ['YES', true], ['true', true], [' True ', true], ['1', true], ['no', false], ['NO', false], ['false', false], [' False ', false], ['0', false], ['', false]]) {
    const result = buildRow({ recurring })
    assert.deepEqual(result.errors, [], recurring)
    assert.equal(result.transactions[0].is_recurring, expected, recurring)
  }
  for (const recurring of ['maybe', '2', '-1', 'on', 'off']) assertInvalid(buildRow({ recurring }), /Recurring/)
})

test('uses shared description validation rather than accepting blank or overlong descriptions', () => {
  for (const description of ['', ' \t ', 'x'.repeat(201)]) assertInvalid(buildRow({ description }), /Description/)
  assert.equal(buildRow({ description: 'x'.repeat(200) }).errors.length, 0)
})

test('enforces the transaction limit at parsing and building boundaries', () => {
  assert.equal(MAX_TRANSFER_TRANSACTIONS, 10000)
  const text = 'Type,Amount,Description,Date\n' + 'Income,1,x,2024-01-01\n'.repeat(MAX_TRANSFER_TRANSACTIONS)
  const csv = parseCsv(text)
  assert.equal(csv.rows.length, MAX_TRANSFER_TRANSACTIONS)
  const result = buildCsvTransactions(csv)
  assert.equal(result.transactions.length, MAX_TRANSFER_TRANSACTIONS)
  assert.deepEqual(result.errors, [])
  assert.throws(() => parseCsv(text + 'Income,1,x,2024-01-01'), /at most 10,000 transactions/)
  const oversized = { ...csv, rows: [...csv.rows, csv.rows[0]] }
  const rejected = buildCsvTransactions(oversized)
  assert.deepEqual(rejected.transactions, [])
  assert.match(rejected.errors[0].message, /At most 10,000/)
})

test('accepts exactly 5 MiB and rejects oversized ASCII or multibyte UTF-8 files', () => {
  assert.equal(MAX_CSV_BYTES, 5 * 1024 * 1024)
  const boundary = 'A\n' + 'x'.repeat(MAX_CSV_BYTES - 2)
  assert.equal(Buffer.byteLength(boundary, 'utf8'), MAX_CSV_BYTES)
  assert.equal(parseCsv(boundary).rows.length, 1)
  assert.throws(() => parseCsv(boundary + 'x'), /5 MiB/)
  const multibyte = 'é'.repeat(MAX_CSV_BYTES / 2) + 'x'
  assert.equal(Buffer.byteLength(multibyte, 'utf8'), MAX_CSV_BYTES + 1)
  assert.throws(() => parseCsv(multibyte), /5 MiB/)
})

test('rejects duplicate column mapping, missing required mappings, and invalid indexes', () => {
  const csv = parseCsv(`${HEADER}\nExpense,1,Lunch,2024-01-01,Other,no`)
  const defaults = defaultCsvMapping(csv.headers)
  for (const [mapping, message] of [
    [{ ...defaults, amount: defaults.type }, /only be mapped once/],
    [{ ...defaults, category: defaults.description }, /only be mapped once/],
    [{ ...defaults, date: null }, /Map the date column/],
    [{ ...defaults, amount: -1 }, /Invalid column mapping/],
    [{ ...defaults, amount: 0.5 }, /Invalid column mapping/],
    [{ ...defaults, amount: csv.headers.length }, /Invalid column mapping/],
  ]) {
    const result = buildCsvTransactions(csv, mapping)
    assert.deepEqual(result.transactions, [])
    assert.equal(result.errors.length, 1)
    assert.equal(result.errors[0].row, 1)
    assert.match(result.errors[0].message, message)
  }
})
