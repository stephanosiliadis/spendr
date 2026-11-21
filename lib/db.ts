import fs from "fs";
import path from "path";
import { createHash, randomUUID } from "crypto";
import {
  transactionFingerprint,
  TransferValidationError,
  MAX_BACKUP_BYTES,
  MAX_BACKUP_TRANSACTIONS,
  validateBackup,
  validateImportRequest,
  validateOperationId,
  validateTransactionInput,
  type SpendrBackup,
  type ThemePreference,
} from "./data-transfer";
import type {
  Transaction,
  TransactionInput,
  TransactionFilters,
  PaginatedTransactions,
  Insights,
  MonthlyData,
  CategoryData,
  Category,
  CategoryBudget,
  CategoryBudgetStatus,
  CategoryRule,
  SavingsGoal,
} from "./types";

// ──────────────────────────────────────────────
// File path resolution
// ──────────────────────────────────────────────
const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const JSON_PATH = path.join(DATA_DIR, "transactions.json");
const METADATA_PATH = path.join(DATA_DIR, "transaction-meta.json");
const JOURNAL_PATH = path.join(DATA_DIR, "transaction-journal.json");
const BUDGETS_PATH = path.join(DATA_DIR, "category-budgets.json");
const CATEGORY_RULES_PATH = path.join(DATA_DIR, "category-rules.json");
const SAVINGS_GOALS_PATH = path.join(DATA_DIR, "savings-goals.json");
export const UNDO_WINDOW_MS = 60_000;

interface DeletedTransaction {
  token: string;
  expiresAt: number;
  transaction: Transaction;
  restored?: boolean;
}

type ImportResult = { imported: number; skipped: number };
type RestoreResult = { restored: number; recoveryFile: string };
interface OperationReceipt {
  id: string;
  kind: "import" | "restore";
  hash: string;
  result: ImportResult | RestoreResult;
}
interface TransactionMetadata {
  deletions: DeletedTransaction[];
  operations: OperationReceipt[];
}

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ──────────────────────────────────────────────
// Read / write helpers
// ──────────────────────────────────────────────
function readAll(): Transaction[] {
  recoverPendingWrite();
  if (!fs.existsSync(JSON_PATH)) {return [];}
  const transactions: unknown = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
  if (!Array.isArray(transactions)) {throw new Error("Transaction storage must be an array.");}
  return transactions as Transaction[];
}

function syncDirectory(directory: string): void {
  let descriptor: number | undefined;
  try {
    descriptor = fs.openSync(directory, "r");
    fs.fsyncSync(descriptor);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    // Windows and some mounted filesystems cannot open/fsync directory handles.
    if (!["EINVAL", "ENOTSUP", "EOPNOTSUPP", "EBADF"].includes(code ?? "")
      && !(process.platform === "win32" && ["EPERM", "EACCES", "EISDIR"].includes(code ?? ""))) {throw error;}
  } finally {
    if (descriptor !== undefined) {fs.closeSync(descriptor);}
  }
}

function writeJsonAtomically(filename: string, value: unknown): void {
  const temporaryPath = `${filename}.${randomUUID()}.tmp`;
  try {
    const descriptor = fs.openSync(temporaryPath, "wx");
    try {
      fs.writeFileSync(descriptor, JSON.stringify(value, null, 2), "utf8");
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    fs.renameSync(temporaryPath, filename);
    syncDirectory(path.dirname(filename));
  } finally {
    if (fs.existsSync(temporaryPath)) {fs.unlinkSync(temporaryPath);}
  }
}

function recoverPendingWrite(): void {
  if (!fs.existsSync(JOURNAL_PATH)) {return;}
  const journal = JSON.parse(fs.readFileSync(JOURNAL_PATH, "utf8")) as {
    transactions: Transaction[]; metadata: TransactionMetadata;
  };
  writeJsonAtomically(JSON_PATH, journal.transactions);
  writeJsonAtomically(METADATA_PATH, journal.metadata);
  fs.unlinkSync(JOURNAL_PATH);
  syncDirectory(DATA_DIR);
}

function readMetadata(): TransactionMetadata {
  recoverPendingWrite();
  if (!fs.existsSync(METADATA_PATH)) {return { deletions: [], operations: [] };}
  const metadata = JSON.parse(fs.readFileSync(METADATA_PATH, "utf8")) as TransactionMetadata;
  if (!Array.isArray(metadata.deletions) || !Array.isArray(metadata.operations)) {
    throw new Error("Transaction metadata is invalid.");
  }
  return { ...metadata, deletions: metadata.deletions.filter((entry) => entry.expiresAt > Date.now()) };
}

function commitTransactions(transactions: Transaction[], metadata = readMetadata()): void {
  if (transactions.length > MAX_BACKUP_TRANSACTIONS
    || Buffer.byteLength(JSON.stringify({
      app: "spendr", version: 1, createdAt: new Date().toISOString(), settings: { theme: "system" }, transactions,
    }, null, 2), "utf8") > MAX_BACKUP_BYTES) {
    throw new TransferValidationError("Dataset exceeds the supported backup limit (100,000 transactions / 100 MiB).", 413);
  }
  // A durable journal makes data and Undo/import/restore receipts one recoverable operation.
  // Every subsequent read completes an interrupted commit before exposing its data.
  writeJsonAtomically(JOURNAL_PATH, { transactions, metadata });
  recoverPendingWrite();
}

function operationHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function previousOperation(metadata: TransactionMetadata, id: string, kind: OperationReceipt["kind"], hash: string): OperationReceipt | undefined {
  const receipt = metadata.operations.find((item) => item.id === id);
  if (receipt && (receipt.kind !== kind || receipt.hash !== hash)) {
    throw new TransferValidationError("This operation ID was already used with different data. Choose a new file or start a new import.", 409);
  }
  return receipt;
}

function nextId(transactions: Transaction[]): number {
  // Reserve IDs while Undo is available, even when the highest ID was deleted.
  const reserved = readMetadata().deletions.filter((entry) => !entry.restored).map((entry) => entry.transaction);
  const maximum = [...transactions, ...reserved].reduce((max, transaction) => Math.max(max, transaction.id), 0);
  if (maximum >= Number.MAX_SAFE_INTEGER) {throw new Error("Transaction ID range exhausted.");}
  return maximum + 1;
}

// ──────────────────────────────────────────────
// CRUD
// ──────────────────────────────────────────────

export function getTransactions(
  filters: TransactionFilters = {},
): PaginatedTransactions {
  const {
    type,
    dateFrom,
    dateTo,
    minAmount,
    maxAmount,
    category,
    search,
    sort = "date",
    order = "desc",
    page = 1,
    limit = 20,
  } = filters;

  let all = readAll();

  // Filtering
  if (type && type !== "all") {all = all.filter((t) => t.type === type);}
  if (dateFrom) {all = all.filter((t) => t.date >= dateFrom);}
  if (dateTo) {all = all.filter((t) => t.date <= dateTo);}
  if (minAmount !== undefined) {all = all.filter((t) => t.amount >= minAmount);}
  if (maxAmount !== undefined) {all = all.filter((t) => t.amount <= maxAmount);}
  if (category && category !== "all")
  {all = all.filter((t) => t.category === category || t.splits?.some((split) => split.category === category));}
  if (search) {
    const q = search.toLowerCase();
    all = all.filter((t) => t.description.toLowerCase().includes(q));
  }

  // Sorting
  const validSorts = ["date", "amount", "type", "category", "id"] as const;
  const safeSort = (
    validSorts.includes(sort as (typeof validSorts)[number]) ? sort : "date"
  ) as keyof Transaction;
  const asc = order === "asc";

  all.sort((a, b) => {
    const av = a[safeSort];
    const bv = b[safeSort];
    let cmp = 0;
    if (typeof av === "number" && typeof bv === "number") {cmp = av - bv;}
    else {cmp = String(av).localeCompare(String(bv));}
    // Secondary sort: id DESC (matches original SQL behaviour)
    if (cmp === 0) {cmp = b.id - a.id;}
    return asc ? cmp : -cmp;
  });

  const total = all.length;
  const offset = (page - 1) * limit;
  const data = all.slice(offset, offset + limit);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export function getRecurringTransactions(): Transaction[] {
  return readAll()
    .filter((t) => t.is_recurring === 1)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
}

export function getCategoryBudgets(): CategoryBudget[] {
  if (!fs.existsSync(BUDGETS_PATH)) {return [];}
  const value: unknown = JSON.parse(fs.readFileSync(BUDGETS_PATH, "utf8"));
  if (!Array.isArray(value)) {throw new Error("Category budget storage must be an array.");}
  return value as CategoryBudget[];
}

export function saveCategoryBudgets(budgets: CategoryBudget[]): CategoryBudget[] {
  writeJsonAtomically(BUDGETS_PATH, budgets);
  return budgets;
}

export function getCategoryRules(): CategoryRule[] {
  if (!fs.existsSync(CATEGORY_RULES_PATH)) {return [];}
  const value: unknown = JSON.parse(fs.readFileSync(CATEGORY_RULES_PATH, "utf8"));
  if (!Array.isArray(value)) {throw new Error("Category rule storage must be an array.");}
  return (value as CategoryRule[]).sort((a, b) => b.matchText.length - a.matchText.length);
}

export function saveCategoryRules(rules: CategoryRule[]): CategoryRule[] {
  writeJsonAtomically(CATEGORY_RULES_PATH, rules);
  return rules;
}

export function getSavingsGoals(): SavingsGoal[] {
  if (!fs.existsSync(SAVINGS_GOALS_PATH)) {return [];}
  const value: unknown = JSON.parse(fs.readFileSync(SAVINGS_GOALS_PATH, "utf8"));
  if (!Array.isArray(value)) {throw new Error("Savings goal storage must be an array.");}
  return value as SavingsGoal[];
}

export function saveSavingsGoals(goals: SavingsGoal[]): SavingsGoal[] {
  writeJsonAtomically(SAVINGS_GOALS_PATH, goals);
  return goals;
}

function resolveCategory(description: string, category: Category, rules = getCategoryRules()): Category {
  if (category !== "Other") {return category;}
  const normalizedDescription = description.toLocaleLowerCase();
  const match = rules
    .find((rule) => normalizedDescription.includes(rule.matchText.toLocaleLowerCase()));
  return match?.category ?? category;
}

export function getCategoryBudgetStatus(month: string): {
  month: string;
  totalSpent: number;
  totalBudget: number;
  budgets: CategoryBudgetStatus[];
} {
  const spending = new Map<Category, number>();
  readAll().forEach((transaction) => {
    if (transaction.type !== "Expense" || transaction.date.slice(0, 7) !== month) {return;}
    const allocations = transaction.splits ?? [{ category: transaction.category, amount: transaction.amount }];
    allocations.forEach(({ category, amount }) => {
      spending.set(category, (spending.get(category) ?? 0) + amount);
    });
  });
  const budgets = getCategoryBudgets().map((budget) => {
    const spent = round2(spending.get(budget.category) ?? 0);
    return {
      ...budget,
      spent,
      remaining: round2(budget.monthlyLimit - spent),
      percentage: budget.monthlyLimit > 0 ? Math.round((spent / budget.monthlyLimit) * 100) : 0,
    };
  });
  return {
    month,
    totalSpent: round2(Array.from(spending.values()).reduce((sum, amount) => sum + amount, 0)),
    totalBudget: round2(budgets.reduce((sum, budget) => sum + budget.monthlyLimit, 0)),
    budgets,
  };
}

export function getTransactionById(id: number): Transaction | null {
  return readAll().find((t) => t.id === id) ?? null;
}

export function createTransaction(input: TransactionInput): Transaction {
  input = validateTransactionInput(input);
  const all = readAll();
  const tx: Transaction = {
    id: nextId(all),
    type: input.type,
    amount: input.amount,
    description: input.description,
    date: input.date,
    category: input.splits?.[0].category ?? resolveCategory(input.description, input.category),
    is_recurring: input.is_recurring ? 1 : 0,
    ...(input.splits ? { splits: input.splits } : {}),
  };
  all.push(tx);
  commitTransactions(all);
  return tx;
}

export function updateTransaction(
  id: number,
  input: TransactionInput,
): Transaction | null {
  input = validateTransactionInput(input);
  const all = readAll();
  const idx = all.findIndex((t) => t.id === id);
  if (idx === -1) {return null;}
  all[idx] = {
    id,
    type: input.type,
    amount: input.amount,
    description: input.description,
    date: input.date,
    category: input.splits?.[0].category ?? resolveCategory(input.description, input.category),
    is_recurring: input.is_recurring ? 1 : 0,
    ...(input.splits ? { splits: input.splits } : {}),
  };
  commitTransactions(all);
  return all[idx];
}

export function deleteTransaction(id: number): { undoToken: string; undoExpiresAt: number } | null {
  const all = readAll();
  const transaction = all.find((t) => t.id === id);
  if (!transaction) {
    const previous = readMetadata().deletions.find((item) => item.transaction.id === id && !item.restored);
    return previous ? { undoToken: previous.token, undoExpiresAt: previous.expiresAt } : null;
  }
  const entry: DeletedTransaction = {
    token: randomUUID(),
    expiresAt: Date.now() + UNDO_WINDOW_MS,
    transaction,
  };
  const metadata = readMetadata();
  metadata.deletions.push(entry);
  commitTransactions(all.filter((t) => t.id !== id), metadata);
  return { undoToken: entry.token, undoExpiresAt: entry.expiresAt };
}

export function undoDeleteTransaction(token: string): Transaction {
  const metadata = readMetadata();
  const entry = metadata.deletions.find((item) => item.token === token);
  if (!entry) {throw new TransferValidationError("Undo has expired or this transaction was already restored.", 410);}
  if (entry.restored) {return entry.transaction;}
  const all = readAll();
  if (all.some((transaction) => transaction.id === entry.transaction.id)) {
    throw new TransferValidationError("This ID is already in use. Undo will not overwrite an existing transaction.", 409);
  }
  entry.restored = true;
  commitTransactions([...all, entry.transaction], metadata);
  return entry.transaction;
}

export function importTransactions(inputs: TransactionInput[], skipDuplicates: boolean, operationId: string): ImportResult {
  const { transactions } = validateImportRequest({ transactions: inputs, skipDuplicates, operationId });
  const metadata = readMetadata();
  const hash = operationHash({ transactions, skipDuplicates });
  const previous = previousOperation(metadata, operationId, "import", hash);
  if (previous) {return previous.result as ImportResult;}
  const all = readAll();
  const categoryRules = getCategoryRules();
  const seen = new Set(all.map(transactionFingerprint));
  let id = nextId(all);
  let imported = 0;
  let skipped = 0;
  for (const input of transactions) {
    const category = input.splits?.[0].category ?? resolveCategory(input.description, input.category, categoryRules);
    const key = transactionFingerprint({ ...input, category });
    if (skipDuplicates && seen.has(key)) {
      skipped++;
      continue;
    }
    if (!Number.isSafeInteger(id)) {throw new Error("Transaction ID range exhausted.");}
    all.push({
      ...input,
      id: id++,
      category,
      is_recurring: input.is_recurring ? 1 : 0,
      ...(input.splits ? { splits: input.splits } : {}),
    });
    seen.add(key);
    imported++;
  }
  const result = { imported, skipped };
  metadata.operations.push({ id: operationId, kind: "import", hash, result });
  commitTransactions(all, metadata);
  return result;
}

export function createBackup(theme: ThemePreference): SpendrBackup {
  return {
    app: "spendr",
    version: 1,
    createdAt: new Date().toISOString(),
    settings: { theme },
    transactions: readAll(),
    budgets: getCategoryBudgets(),
    categoryRules: getCategoryRules(),
    savingsGoals: getSavingsGoals(),
  };
}

export function getRecoveryBackup(filename: string): SpendrBackup {
  if (!/^pre-restore-\d+-[0-9a-f-]{36}\.json$/.test(filename)) {
    throw new TransferValidationError("Invalid recovery filename.");
  }
  const recoveryPath = path.join(DATA_DIR, "backups", filename);
  if (!fs.existsSync(recoveryPath)) {throw new TransferValidationError("Recovery backup not found.", 404);}
  return JSON.parse(fs.readFileSync(recoveryPath, "utf8")) as SpendrBackup;
}

export function restoreBackup(backup: SpendrBackup, currentTheme: ThemePreference, operationId: string): RestoreResult {
  validateOperationId(operationId);
  const validated = validateBackup(backup);
  const metadata = readMetadata();
  const hash = operationHash({ backup: validated, currentTheme });
  const previous = previousOperation(metadata, operationId, "restore", hash);
  if (previous) {return previous.result as RestoreResult;}
  // Preserve even legacy records that fail the stricter import validator.
  const recovery: SpendrBackup = {
    app: "spendr", version: 1, createdAt: new Date().toISOString(),
    settings: { theme: currentTheme }, transactions: readAll(), budgets: getCategoryBudgets(), categoryRules: getCategoryRules(), savingsGoals: getSavingsGoals(),
  };
  const backupDirectory = path.join(DATA_DIR, "backups");
  fs.mkdirSync(backupDirectory, { recursive: true });
  const recoveryFile = `pre-restore-${Date.now()}-${randomUUID()}.json`;
  writeJsonAtomically(path.join(backupDirectory, recoveryFile), recovery);
  // Old Undo tokens must never insert transactions into the restored dataset.
  metadata.deletions = [];
  const result = { restored: validated.transactions.length, recoveryFile };
  metadata.operations.push({ id: operationId, kind: "restore", hash, result });
  commitTransactions(validated.transactions, metadata);
  saveCategoryBudgets(validated.budgets ?? []);
  saveCategoryRules(validated.categoryRules ?? []);
  saveSavingsGoals(validated.savingsGoals ?? []);
  return result;
}

// ──────────────────────────────────────────────
// Insights / analytics
// ──────────────────────────────────────────────

export function getInsights(dateFrom?: string, dateTo?: string): Insights {
  const all = readAll()
    .filter((transaction) =>
      (!dateFrom || transaction.date >= dateFrom)
      && (!dateTo || transaction.date <= dateTo),
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  const income = all.filter((t) => t.type === "Income");
  const expenses = all.filter((t) => t.type === "Expense");

  const totalIncome = income.reduce((s, t) => s + t.amount, 0);
  const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0);
  const netBalance = totalIncome - totalExpenses;

  const highestIncome =
    income.length > 0
      ? income.reduce((max, t) => (t.amount > max.amount ? t : max))
      : null;
  const highestExpense =
    expenses.length > 0
      ? expenses.reduce((max, t) => (t.amount > max.amount ? t : max))
      : null;

  const averageAmount =
    all.length > 0 ? all.reduce((s, t) => s + t.amount, 0) / all.length : 0;

  const recurringCount = all.filter((t) => t.is_recurring === 1).length;

  // ── Monthly breakdown (last 12 months) ──
  const monthlyMap = new Map<string, { income: number; expenses: number }>();
  all.forEach((t) => {
    const d = new Date(`${t.date  }T00:00:00`);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthlyMap.has(key)) {monthlyMap.set(key, { income: 0, expenses: 0 });}
    const entry = monthlyMap.get(key)!;
    if (t.type === "Income") {entry.income += t.amount;}
    else {entry.expenses += t.amount;}
  });

  const monthlyEntries = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b));
  const monthlyData: MonthlyData[] = (dateFrom || dateTo
    ? monthlyEntries
    : monthlyEntries.slice(-12))
    .map(([key, { income: inc, expenses: exp }]) => {
      const [year, month] = key.split("-");
      const label = new Date(
        parseInt(year),
        parseInt(month) - 1,
      ).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      return {
        month: label,
        income: round2(inc),
        expenses: round2(exp),
        net: round2(inc - exp),
      };
    });

  // ── Category breakdown ──
  const expenseCategoryData = buildCategoryData(expenses, totalExpenses);
  const incomeCategoryData = buildCategoryData(income, totalIncome);

  return {
    totalIncome: round2(totalIncome),
    totalExpenses: round2(totalExpenses),
    netBalance: round2(netBalance),
    highestIncome,
    highestExpense,
    averageAmount: round2(averageAmount),
    transactionCount: all.length,
    incomeCount: income.length,
    expenseCount: expenses.length,
    monthlyData,
    expenseCategoryData,
    incomeCategoryData,
    recurringCount,
  };
}

function buildCategoryData(
  transactions: Transaction[],
  total: number,
): CategoryData[] {
  const map = new Map<string, { amount: number; count: number }>();
  transactions.forEach((t) => {
    const allocations = t.splits ?? [{ category: t.category ?? "Other", amount: t.amount }];
    allocations.forEach(({ category, amount }) => {
      if (!map.has(category)) {map.set(category, { amount: 0, count: 0 });}
      const entry = map.get(category)!;
      entry.amount += amount;
      entry.count++;
    });
  });
  return Array.from(map.entries())
    .map(([category, { amount, count }]) => ({
      category,
      amount: round2(amount),
      count,
      percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ──────────────────────────────────────────────
// Export
// ──────────────────────────────────────────────

export function getAllTransactionsForExport(type?: string): Transaction[] {
  const all = readAll().sort((a, b) => b.date.localeCompare(a.date));
  if (type && type !== "all") {return all.filter((t) => t.type === type);}
  return all;
}
