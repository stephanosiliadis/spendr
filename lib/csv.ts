import { MAX_TRANSFER_TRANSACTIONS, isCalendarDate, validateTransactionInput } from "@/lib/data-transfer";
import { CATEGORIES, type TransactionInput } from "./types";

export const MAX_CSV_BYTES = 5 * 1024 * 1024;
export const CSV_FIELDS = ["type", "amount", "description", "date", "category", "recurring"] as const;
export type CsvField = (typeof CSV_FIELDS)[number]
export type CsvDelimiter = "," | ";"
export type CsvMapping = Record<CsvField, number | null>

export interface ParsedCsv {
  headers: string[]
  rows: string[][]
  /** Physical starting line of each data record, including multiline records. */
  rowNumbers: number[]
  delimiter: CsvDelimiter
}

export interface CsvRowError {
  row: number
  message: string
}

export interface CsvBuildResult {
  /** Valid rows for preview only: do not import when errors is nonempty. */
  transactions: TransactionInput[]
  errors: CsvRowError[]
  totalRows: number
}

function detectDelimiter(text: string): CsvDelimiter {
  let quoted = false;
  let commas = 0;
  let semicolons = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {i++;}
      else {quoted = !quoted;}
    } else if (!quoted) {
      if (char === "\n" || char === "\r") {
        if (commas || semicolons) {break;}
      } else if (char === ",") {commas++;}
      else if (char === ";") {semicolons++;}
    }
  }
  return semicolons > commas ? ";" : ",";
}

/** Parses a header-first CSV. Syntax/size/record-limit failures throw Error. */
export function parseCsv(text: string, delimiter?: CsvDelimiter): ParsedCsv {
  if (new TextEncoder().encode(text).byteLength > MAX_CSV_BYTES) {
    throw new Error("CSV files must be 5 MiB or smaller.");
  }
  text = text.replace(/^\uFEFF/, "");
  const separator = delimiter ?? detectDelimiter(text);
  const records: string[][] = [];
  const lines: number[] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  let closedQuote = false;
  let touched = false;
  let line = 1;
  let recordLine = 1;

  function finishField() {
    record.push(field);
    field = "";
    closedQuote = false;
  }

  function finishRecord() {
    // Ignore empty physical lines, not empty quoted fields or delimiter-only rows.
    if (touched || record.length || field.trim()) {
      finishField();
      records.push(record);
      lines.push(recordLine);
      if (records.length > MAX_TRANSFER_TRANSACTIONS + 1) {
        throw new Error(`CSV files may contain at most ${MAX_TRANSFER_TRANSACTIONS.toLocaleString()} transactions.`);
      }
    }
    record = [];
    field = "";
    closedQuote = false;
    touched = false;
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else {
        field += char;
        if (char === "\n" || (char === "\r" && text[i + 1] !== "\n")) {line++;}
      }
      continue;
    }
    if (char === separator) {
      touched = true;
      finishField();
    } else if (char === "\r" || char === "\n") {
      finishRecord();
      if (char === "\r" && text[i + 1] === "\n") {i++;}
      line++;
      recordLine = line;
    } else if (closedQuote) {
      if (char !== " " && char !== "\t") {
        throw new Error(`Line ${line}: unexpected text after a closing quote.`);
      }
    } else if (char === '"') {
      if (field.length) {throw new Error(`Line ${line}: quotes must start at the beginning of a field.`);}
      quoted = true;
      touched = true;
    } else {
      field += char;
      if (char.trim()) {touched = true;}
    }
  }
  if (quoted) {throw new Error(`Line ${recordLine}: unterminated quoted field.`);}
  finishRecord();
  if (!records.length) {throw new Error("The CSV file is empty. Include a header row and transactions.");}
  return {
    headers: records[0].map((header) => header.trim()),
    rows: records.slice(1),
    rowNumbers: lines.slice(1),
    delimiter: separator,
  };
}

/** Normalizes Spendr export headers; ID and unrelated columns remain ignored. */
export function defaultCsvMapping(headers: readonly string[]): CsvMapping {
  const normalized = headers.map((header) => header.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[\s_-]+/g, ""));
  const mapping = {} as CsvMapping;
  for (const field of CSV_FIELDS) {
    const index = normalized.findIndex((header) => header === field || (field === "recurring" && header === "isrecurring"));
    mapping[field] = index < 0 ? null : index;
  }
  return mapping;
}


/** Collects validation errors without silently dropping invalid records. */
export function buildCsvTransactions(csv: ParsedCsv, mapping: CsvMapping = defaultCsvMapping(csv.headers)): CsvBuildResult {
  const result: CsvBuildResult = { transactions: [], errors: [], totalRows: csv.rows.length };
  const required: CsvField[] = ["type", "amount", "description", "date"];
  const selected = new Set<number>();
  for (const field of CSV_FIELDS) {
    const index = mapping[field];
    if (index === null) {
      if (required.includes(field)) {result.errors.push({ row: 1, message: `Map the ${field} column.` });}
    } else if (!Number.isInteger(index) || index < 0 || index >= csv.headers.length) {
      result.errors.push({ row: 1, message: `Invalid column mapping for ${field}.` });
    } else if (selected.has(index)) {
      result.errors.push({ row: 1, message: "Each source column can only be mapped once." });
    } else {selected.add(index);}
  }
  if (csv.rows.length > MAX_TRANSFER_TRANSACTIONS) {
    result.errors.push({ row: 1, message: `At most ${MAX_TRANSFER_TRANSACTIONS.toLocaleString()} transactions may be imported.` });
  }
  if (!csv.rows.length) {result.errors.push({ row: 1, message: "The CSV has no transactions." });}
  if (result.errors.length) {return result;}

  csv.rows.forEach((row, index) => {
    try {
      if (row.length !== csv.headers.length) {throw new Error(`Expected ${csv.headers.length} columns, found ${row.length}.`);}
      const cell = (field: CsvField) => mapping[field] === null ? "" : row[mapping[field]!].trim();
      const type = cell("type").toLowerCase();
      if (type !== "income" && type !== "expense") {throw new Error("Type must be Income or Expense.");}
      const amount = cell("amount");
      if (!/^\d+(\.\d{1,2})?$/.test(amount) || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
        throw new Error("Amount must be positive with at most 2 decimal places (use a decimal point).");
      }
      const date = cell("date");
      if (!isCalendarDate(date)) {throw new Error("Date must be a valid calendar date in YYYY-MM-DD format.");}
      const categoryValue = cell("category");
      const category = categoryValue
        ? CATEGORIES.find((category) => category.toLowerCase() === categoryValue.toLowerCase())
        : "Other";
      if (!category) {throw new Error(`Unknown category: ${categoryValue}. Use a Spendr category or leave Category unmapped for Other.`);}
      const recurring = cell("recurring").toLowerCase();
      if (!["", "yes", "no", "true", "false", "1", "0"].includes(recurring)) {
        throw new Error("Recurring must be yes/no, true/false, or 1/0 (or blank).");
      }
      result.transactions.push(validateTransactionInput({
        type: type === "income" ? "Income" : "Expense",
        amount: Number(amount),
        description: cell("description"),
        date,
        category,
        is_recurring: ["yes", "true", "1"].includes(recurring),
      }));
    } catch (error) {
      result.errors.push({ row: csv.rowNumbers[index] ?? index + 2, message: error instanceof Error ? error.message : "Invalid transaction." });
    }
  });
  return result;
}
