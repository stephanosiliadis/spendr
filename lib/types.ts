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

export interface CategoryBudget {
  category: Category;
  monthlyLimit: number;
}

export interface CategoryBudgetStatus extends CategoryBudget {
  spent: number;
  remaining: number;
  percentage: number;
}

export const CATEGORY_COLORS: Record<Category, string> = {
  "Food & Dining": "#E9825A",
  Transport: "#5BA4E6",
  Entertainment: "#8E7CE8",
  "Health & Medical": "#E5617C",
  Shopping: "#E8B04A",
  "Bills & Utilities": "#3FB8C9",
  Salary: "#3FB985",
  Investment: "#5B6EE8",
  Housing: "#B08968",
  Education: "#C46FD0",
  Travel: "#EC8FB5",
  Other: "#94A3B8",
};

export interface Transaction {
  id: number;
  type: TransactionType;
  amount: number;
  description: string;
  date: string; // YYYY-MM-DD
  category: Category;
  is_recurring: number; // 0 | 1 (SQLite boolean)
  splits?: TransactionSplit[];
}

export interface TransactionSplit {
  category: Category;
  amount: number;
}

export interface TransactionInput {
  type: TransactionType;
  amount: number;
  description: string;
  date: string;
  category: Category;
  is_recurring?: boolean;
  splits?: TransactionSplit[];
}

export interface CategoryRule {
  id: string;
  matchText: string;
  category: Category;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
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
