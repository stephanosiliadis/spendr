export type TransactionType = "Income" | "Expense";

export const CATEGORIES = [
  "Food & Dining",
  "Transport",
  "Entertainment",
  "Health & Medical",
  "Shopping",
  "Bills & Utilities",
  "Salary",
  "Investment",
  "Housing",
  "Education",
  "Travel",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_COLORS: Record<Category, string> = {
  "Food & Dining": "#f97316",
  Transport: "#3b82f6",
  Entertainment: "#a855f7",
  "Health & Medical": "#ef4444",
  Shopping: "#ec4899",
  "Bills & Utilities": "#eab308",
  Salary: "#22c55e",
  Investment: "#06b6d4",
  Housing: "#64748b",
  Education: "#8b5cf6",
  Travel: "#14b8a6",
  Other: "#94a3b8",
};

export interface Transaction {
  id: number;
  type: TransactionType;
  amount: number;
  description: string;
  date: string; // YYYY-MM-DD
  category: Category;
  is_recurring: number; // 0 | 1 (SQLite boolean)
}

export interface TransactionInput {
  type: TransactionType;
  amount: number;
  description: string;
  date: string;
  category: Category;
  is_recurring?: boolean;
}

export interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

export interface CategoryData {
  category: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface Insights {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  highestIncome: Transaction | null;
  highestExpense: Transaction | null;
  averageAmount: number;
  transactionCount: number;
  incomeCount: number;
  expenseCount: number;
  monthlyData: MonthlyData[];
  expenseCategoryData: CategoryData[];
  incomeCategoryData: CategoryData[];
  recurringCount: number;
}

export interface TransactionFilters {
  type?: TransactionType | "all";
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  category?: Category | "all";
  search?: string;
  sort?: "date" | "amount" | "type" | "category" | "id";
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface PaginatedTransactions {
  data: Transaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
