import fs from "fs";
import path from "path";
import type {
  Transaction,
  TransactionInput,
  TransactionFilters,
  PaginatedTransactions,
  Insights,
  MonthlyData,
  CategoryData,
} from "./types";

// ──────────────────────────────────────────────
// File path resolution
// ──────────────────────────────────────────────
const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const JSON_PATH = path.join(DATA_DIR, "transactions.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ──────────────────────────────────────────────
// Read / write helpers
// ──────────────────────────────────────────────
function readAll(): Transaction[] {
  if (!fs.existsSync(JSON_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(JSON_PATH, "utf8")) as Transaction[];
  } catch {
    return [];
  }
}

function writeAll(transactions: Transaction[]): void {
  fs.writeFileSync(JSON_PATH, JSON.stringify(transactions, null, 2), "utf8");
}

function nextId(transactions: Transaction[]): number {
  return transactions.length === 0
    ? 1
    : Math.max(...transactions.map((t) => t.id)) + 1;
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
  if (type && type !== "all") all = all.filter((t) => t.type === type);
  if (dateFrom) all = all.filter((t) => t.date >= dateFrom);
  if (dateTo) all = all.filter((t) => t.date <= dateTo);
  if (minAmount !== undefined) all = all.filter((t) => t.amount >= minAmount);
  if (maxAmount !== undefined) all = all.filter((t) => t.amount <= maxAmount);
  if (category && category !== "all")
    all = all.filter((t) => t.category === category);
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
    if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
    else cmp = String(av).localeCompare(String(bv));
    // Secondary sort: id DESC (matches original SQL behaviour)
    if (cmp === 0) cmp = b.id - a.id;
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

export function getTransactionById(id: number): Transaction | null {
  return readAll().find((t) => t.id === id) ?? null;
}

export function createTransaction(input: TransactionInput): Transaction {
  const all = readAll();
  const tx: Transaction = {
    id: nextId(all),
    type: input.type,
    amount: input.amount,
    description: input.description,
    date: input.date,
    category: input.category,
    is_recurring: input.is_recurring ? 1 : 0,
  };
  all.push(tx);
  writeAll(all);
  return tx;
}

export function updateTransaction(
  id: number,
  input: TransactionInput,
): Transaction | null {
  const all = readAll();
  const idx = all.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  all[idx] = {
    id,
    type: input.type,
    amount: input.amount,
    description: input.description,
    date: input.date,
    category: input.category,
    is_recurring: input.is_recurring ? 1 : 0,
  };
  writeAll(all);
  return all[idx];
}

export function deleteTransaction(id: number): boolean {
  const all = readAll();
  const next = all.filter((t) => t.id !== id);
  if (next.length === all.length) return false;
  writeAll(next);
  return true;
}

// ──────────────────────────────────────────────
// Insights / analytics
// ──────────────────────────────────────────────

export function getInsights(): Insights {
  const all = readAll().sort((a, b) => a.date.localeCompare(b.date));

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
    const d = new Date(t.date + "T00:00:00");
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthlyMap.has(key)) monthlyMap.set(key, { income: 0, expenses: 0 });
    const entry = monthlyMap.get(key)!;
    if (t.type === "Income") entry.income += t.amount;
    else entry.expenses += t.amount;
  });

  const monthlyData: MonthlyData[] = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
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
    const cat = t.category ?? "Other";
    if (!map.has(cat)) map.set(cat, { amount: 0, count: 0 });
    const entry = map.get(cat)!;
    entry.amount += t.amount;
    entry.count++;
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
  if (type && type !== "all") return all.filter((t) => t.type === type);
  return all;
}
