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
  "Food & Dining": "#c4774f",
  Transport: "#557da5",
  Entertainment: "#8572a4",
  "Health & Medical": "#bd6262",
  Shopping: "#ad6881",
  "Bills & Utilities": "#a98a45",
  Salary: "#528565",
  Investment: "#4e8992",
  Housing: "#687789",
  Education: "#697ba3",
  Travel: "#4e8b7e",
  Other: "#8290a1",
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
