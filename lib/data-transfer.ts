import { CATEGORIES, type Category, type CategoryBudget, type CategoryRule, type SavingsGoal, type Transaction, type TransactionInput, type TransactionSplit } from "./types";

export const MAX_TRANSFER_TRANSACTIONS = 10_000;
export const MAX_TRANSFER_BYTES = 5 * 1024 * 1024;
// Parsed CSV rows have additional JSON keys and escaping compared with the source file.
export const MAX_IMPORT_REQUEST_BYTES = 10 * 1024 * 1024;
export const MAX_BACKUP_TRANSACTIONS = 100_000;
export const MAX_BACKUP_BYTES = 100 * 1024 * 1024;
export const THEMES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEMES)[number]

export interface SpendrBackup {
  app: "spendr"
  version: 1
  createdAt: string
  settings: { theme: ThemePreference }
  transactions: Transaction[]
  budgets?: CategoryBudget[]
  categoryRules?: CategoryRule[]
  savingsGoals?: SavingsGoal[]
}

export class TransferValidationError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "TransferValidationError";
  }
}

function invalid(message: string): never {
  throw new TransferValidationError(message);
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && THEMES.includes(value as ThemePreference);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {return false;}
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) {return false;}
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1];
}

function validateSplits(value: unknown, total: number, type: string, label: string): TransactionSplit[] | undefined {
  if (value === undefined) {return undefined;}
  if (type !== "Expense") {return invalid(`${label}: only expenses can be split.`);}
  if (!Number.isSafeInteger(Math.round(total * 100)) || Math.round(total * 100) / 100 !== total) {
    return invalid(`${label}: split totals require a transaction amount with up to two decimals.`);
  }
  if (!Array.isArray(value) || value.length < 2 || value.length > CATEGORIES.length) {
    return invalid(`${label}: provide between 2 and ${CATEGORIES.length} allocations.`);
  }
  const seen = new Set<string>();
  let cents = 0;
  const splits = value.map((row, index): TransactionSplit => {
    if (!isRecord(row) || typeof row.category !== "string" || !CATEGORIES.includes(row.category as Category)) {
      return invalid(`${label}, allocation ${index + 1}: choose a valid category.`);
    }
    if (seen.has(row.category)) {return invalid(`${label}: split categories must be unique.`);}
    if (typeof row.amount !== "number" || !Number.isFinite(row.amount) || row.amount <= 0
      || !Number.isSafeInteger(Math.round(row.amount * 100))
      || Math.round(row.amount * 100) / 100 !== row.amount) {
      return invalid(`${label}, allocation ${index + 1}: enter a positive amount with up to two decimals.`);
    }
    seen.add(row.category);
    cents += Math.round(row.amount * 100);
    return { category: row.category as Category, amount: row.amount };
  });
  if (cents !== Math.round(total * 100)) {return invalid(`${label}: allocation amounts must add up to the transaction total.`);}
  return splits;
}

export function validateTransactionInput(value: unknown): TransactionInput {
  if (!isRecord(value)) {return invalid("Each transaction must be an object.");}
  if (value.type !== "Income" && value.type !== "Expense") {return invalid("Type must be Income or Expense.");}
  if (typeof value.amount !== "number" || !Number.isFinite(value.amount) || value.amount <= 0
    || !Number.isSafeInteger(Math.round(value.amount * 100))
    || Math.round(value.amount * 100) / 100 !== value.amount) {
    return invalid("Amount must be positive with at most 2 decimal places and within the supported range.");
  }
  if (typeof value.description !== "string" || !value.description.trim() || value.description.trim().length > 200) {
    return invalid("Description is required and must be at most 200 characters.");
  }
  if (!isCalendarDate(value.date)) {return invalid("Date must be a valid calendar date in YYYY-MM-DD format.");}
  if (typeof value.category !== "string" || !CATEGORIES.includes(value.category as Category)) {
    return invalid("Category must be a Spendr category.");
  }
  if (value.is_recurring !== undefined && typeof value.is_recurring !== "boolean") {
    return invalid("Recurring must be a boolean.");
  }
  const splits = validateSplits(value.splits, value.amount, value.type, "Split transaction");
  return {
    type: value.type,
    amount: value.amount,
    description: value.description.trim(),
    date: value.date,
    category: splits?.[0].category ?? value.category as Category,
    is_recurring: value.is_recurring === true,
    ...(splits ? { splits } : {}),
  };
}

export function validateOperationId(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    return invalid("Provide a valid operation ID.");
  }
  return value;
}

export function validateImportRequest(value: unknown): { transactions: TransactionInput[]; skipDuplicates: boolean; operationId: string } {
  if (!isRecord(value) || !Array.isArray(value.transactions)) {return invalid("Provide a transactions array.");}
  if (value.transactions.length === 0 || value.transactions.length > MAX_TRANSFER_TRANSACTIONS) {
    return invalid(`Import between 1 and ${MAX_TRANSFER_TRANSACTIONS.toLocaleString()} transactions at a time.`);
  }
  if (typeof value.skipDuplicates !== "boolean") {return invalid("Choose whether to skip duplicates.");}
  const transactions = value.transactions.map((row, index) => {
    try {
      return validateTransactionInput(row);
    } catch (error) {
      return invalid(`Transaction ${index + 1}: ${error instanceof Error ? error.message : "Invalid transaction."}`);
    }
  });
  return { transactions, skipDuplicates: value.skipDuplicates, operationId: validateOperationId(value.operationId) };
}

export function validateBackup(value: unknown): SpendrBackup {
  if (!isRecord(value) || value.app !== "spendr" || value.version !== 1) {
    return invalid("Choose a Spendr version 1 backup, not a transaction export.");
  }
  if (typeof value.createdAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value.createdAt)
    || !Number.isFinite(Date.parse(value.createdAt))) {return invalid("Backup creation date is invalid.");}
  if (!isRecord(value.settings) || !isThemePreference(value.settings.theme)) {return invalid("Backup theme preference is invalid.");}
  if (!Array.isArray(value.transactions) || value.transactions.length > MAX_BACKUP_TRANSACTIONS) {
    return invalid(`Backup must contain a transactions array with at most ${MAX_BACKUP_TRANSACTIONS.toLocaleString()} entries.`);
  }
  const ids = new Set<number>();
  const transactions = value.transactions.map((row, index): Transaction => {
    if (!isRecord(row) || typeof row.id !== "number" || !Number.isSafeInteger(row.id) || row.id <= 0 || ids.has(row.id)) {
      return invalid(`Transaction ${index + 1}: IDs must be unique positive integers.`);
    }
    if (row.is_recurring !== 0 && row.is_recurring !== 1) {return invalid(`Transaction ${index + 1}: recurring must be 0 or 1.`);}
    // Backups preserve legacy precision and description lengths; CSV/new entries use stricter input rules.
    if (row.type !== "Income" && row.type !== "Expense") {return invalid(`Transaction ${index + 1}: invalid type.`);}
    if (typeof row.amount !== "number" || !Number.isFinite(row.amount) || row.amount <= 0) {return invalid(`Transaction ${index + 1}: invalid amount.`);}
    if (typeof row.description !== "string" || !row.description.trim()) {return invalid(`Transaction ${index + 1}: invalid description.`);}
    if (!isCalendarDate(row.date)) {return invalid(`Transaction ${index + 1}: invalid calendar date.`);}
    if (typeof row.category !== "string" || !CATEGORIES.includes(row.category as Category)) {return invalid(`Transaction ${index + 1}: invalid category.`);}
    const splits = validateSplits(row.splits, row.amount, row.type, `Transaction ${index + 1}`);
    ids.add(row.id);
    return {
      id: row.id, type: row.type, amount: row.amount, description: row.description,
      date: row.date, category: splits?.[0].category ?? row.category as Category, is_recurring: row.is_recurring,
      ...(splits ? { splits } : {}),
    };
  });
  let budgets: CategoryBudget[] | undefined;
  if (value.budgets !== undefined) {
    if (!Array.isArray(value.budgets)) {return invalid("Backup budgets must be an array.");}
    const seenCategories = new Set<string>();
    budgets = value.budgets.map((row, index): CategoryBudget => {
      if (!isRecord(row) || typeof row.category !== "string" || !CATEGORIES.includes(row.category as Category)) {
        return invalid(`Budget ${index + 1}: invalid category.`);
      }
      if (seenCategories.has(row.category)) {return invalid(`Budget ${index + 1}: duplicate category.`);}
      if (typeof row.monthlyLimit !== "number" || !Number.isFinite(row.monthlyLimit)
        || row.monthlyLimit <= 0 || Math.round(row.monthlyLimit * 100) / 100 !== row.monthlyLimit) {
        return invalid(`Budget ${index + 1}: invalid monthly limit.`);
      }
      seenCategories.add(row.category);
      return { category: row.category as Category, monthlyLimit: row.monthlyLimit };
    });
  }
  let categoryRules: CategoryRule[] | undefined;
  if (value.categoryRules !== undefined) {
    if (!Array.isArray(value.categoryRules)) {return invalid("Backup category rules must be an array.");}
    const ids = new Set<string>();
    const phrases = new Set<string>();
    categoryRules = value.categoryRules.map((row, index): CategoryRule => {
      if (!isRecord(row)
        || typeof row.id !== "string"
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.id)) {
        return invalid(`Category rule ${index + 1}: invalid ID.`);
      }
      if (ids.has(row.id)) {return invalid(`Category rule ${index + 1}: duplicate ID.`);}
      if (typeof row.matchText !== "string" || !row.matchText.trim() || row.matchText.trim().length > 80) {
        return invalid(`Category rule ${index + 1}: invalid matching phrase.`);
      }
      const phrase = row.matchText.trim().toLocaleLowerCase();
      if (phrases.has(phrase)) {return invalid(`Category rule ${index + 1}: duplicate matching phrase.`);}
      if (typeof row.category !== "string" || !CATEGORIES.includes(row.category as Category)) {
        return invalid(`Category rule ${index + 1}: invalid category.`);
      }
      ids.add(row.id);
      phrases.add(phrase);
      return { id: row.id, matchText: row.matchText.trim(), category: row.category as Category };
    });
  }
  let savingsGoals: SavingsGoal[] | undefined;
  if (value.savingsGoals !== undefined) {
    if (!Array.isArray(value.savingsGoals)) {return invalid("Backup savings goals must be an array.");}
    const ids = new Set<string>();
    savingsGoals = value.savingsGoals.map((row, index): SavingsGoal => {
      if (!isRecord(row)
        || typeof row.id !== "string"
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.id)) {
        return invalid(`Savings goal ${index + 1}: invalid ID.`);
      }
      if (ids.has(row.id)) {return invalid(`Savings goal ${index + 1}: duplicate ID.`);}
      if (typeof row.name !== "string" || !row.name.trim() || row.name.trim().length > 80) {
        return invalid(`Savings goal ${index + 1}: invalid name.`);
      }
      const validMoney = (amount: unknown, allowZero: boolean): amount is number => typeof amount === "number"
        && Number.isFinite(amount)
        && (allowZero ? amount >= 0 : amount > 0)
        && Number.isSafeInteger(Math.round(amount * 100))
        && Math.round(amount * 100) / 100 === amount;
      if (!validMoney(row.targetAmount, false) || !validMoney(row.currentAmount, true)) {
        return invalid(`Savings goal ${index + 1}: invalid amount.`);
      }
      if (row.targetDate !== undefined && !isCalendarDate(row.targetDate)) {
        return invalid(`Savings goal ${index + 1}: invalid target date.`);
      }
      ids.add(row.id);
      return {
        id: row.id,
        name: row.name.trim(),
        targetAmount: row.targetAmount,
        currentAmount: row.currentAmount,
        ...(row.targetDate ? { targetDate: row.targetDate } : {}),
      };
    });
  }
  return {
    app: "spendr", version: 1, createdAt: value.createdAt,
    settings: { theme: value.settings.theme }, transactions,
    ...(budgets === undefined ? {} : { budgets }),
    ...(categoryRules === undefined ? {} : { categoryRules }),
    ...(savingsGoals === undefined ? {} : { savingsGoals }),
  };
}

/** Includes all user-entered fields, but not IDs assigned by Spendr. */
export function transactionFingerprint(transaction: Transaction | TransactionInput): string {
  const fields = [
    transaction.type, transaction.amount, transaction.description.trim(), transaction.date,
    transaction.category, !!transaction.is_recurring,
  ];
  return JSON.stringify(transaction.splits ? [...fields, transaction.splits] : fields);
}
