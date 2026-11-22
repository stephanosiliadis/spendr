"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Minus,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/date-picker";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  CATEGORIES,
  type Category,
  type PaginatedTransactions,
  type Transaction,
  type TransactionType,
} from "@/lib/types";

// ─── Category decoration ────────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = {
  "Food & Dining": "🍽️",
  Transport: "🚗",
  Entertainment: "🎬",
  "Health & Medical": "💊",
  Shopping: "🛍️",
  "Bills & Utilities": "💡",
  Salary: "💰",
  Investment: "📈",
  Housing: "🏠",
  Education: "📚",
  Travel: "✈️",
  Other: "📦",
};

// ─── Types ───────────────────────────────────────────────────────────────────

type SortCol = "date" | "amount" | "type" | "category" | "id";
type SortOrder = "asc" | "desc";

interface Filters {
  search: string;
  type: TransactionType | "all";
  category: Category | "all";
  dateFrom: string;
  dateTo: string;
  minAmount: string;
  maxAmount: string;
  sort: SortCol;
  order: SortOrder;
}

interface TransactionsTableProps {
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  refreshKey?: number;
}

const LIMIT = 20;

const DEFAULT_FILTERS: Filters = {
  search: "",
  type: "all",
  category: "all",
  dateFrom: "",
  dateTo: "",
  minAmount: "",
  maxAmount: "",
  sort: "date",
  order: "desc",
};

// ─── Sort icon helper ─────────────────────────────────────────────────────────

function SortIcon({
  col,
  active,
  order,
}: {
  col: SortCol;
  active: SortCol;
  order: SortOrder;
}) {
  if (active !== col) {
    return <ArrowUpDown className="h-3 w-3 opacity-40" />;
  }
  return order === "asc" ? (
    <ArrowUp className="h-3 w-3 text-accent" />
  ) : (
    <ArrowDown className="h-3 w-3 text-accent" />
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TransactionsTable({
  onEdit,
  onDelete,
  refreshKey,
}: TransactionsTableProps) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedTransactions | null>(null);
  const [loading, setLoading] = useState(true);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input
  useEffect(() => {
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
    }
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(filters.search);
      setPage(1);
    }, 300);
    return () => {
      if (searchTimer.current) {
        clearTimeout(searchTimer.current);
      }
    };
  }, [filters.search]);

  // Fetch data whenever relevant state changes
  const fetchData = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams();
    q.set("page", String(page));
    q.set("limit", String(LIMIT));
    q.set("sort", filters.sort);
    q.set("order", filters.order);
    if (debouncedSearch) {
      q.set("search", debouncedSearch);
    }
    if (filters.type !== "all") {
      q.set("type", filters.type);
    }
    if (filters.category !== "all") {
      q.set("category", filters.category);
    }
    if (filters.dateFrom) {
      q.set("dateFrom", filters.dateFrom);
    }
    if (filters.dateTo) {
      q.set("dateTo", filters.dateTo);
    }
    if (filters.minAmount) {
      q.set("minAmount", filters.minAmount);
    }
    if (filters.maxAmount) {
      q.set("maxAmount", filters.maxAmount);
    }

    try {
      const res = await fetch(`/api/transactions?${q.toString()}`);
      if (!res.ok) {
        throw new Error();
      }
      setData(await res.json());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    debouncedSearch,
    filters.sort,
    filters.order,
    filters.type,
    filters.category,
    filters.dateFrom,
    filters.dateTo,
    filters.minAmount,
    filters.maxAmount,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  // ─── Filter helpers ─────────────────────────────────────────────────────

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    if (key !== "search") {
      setPage(1);
    }
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setDebouncedSearch("");
    setPage(1);
  };

  const toggleSort = (col: SortCol) => {
    setFilters((prev) => ({
      ...prev,
      sort: col,
      order: prev.sort === col && prev.order === "desc" ? "asc" : "desc",
    }));
    setPage(1);
  };

  const hasActiveFilters =
    filters.search !== "" ||
    filters.type !== "all" ||
    filters.category !== "all" ||
    filters.dateFrom !== "" ||
    filters.dateTo !== "" ||
    filters.minAmount !== "" ||
    filters.maxAmount !== "";

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Filter bar ─────────────────────────────────────────────────── */}
      <div className="space-y-2.5">
        {/* Row 1: search + type + category + clear */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search transactions…"
              className="h-9 pl-9"
              value={filters.search}
              onChange={(e) => update("search", e.target.value)}
            />
          </div>

          <Select
            value={filters.type}
            onValueChange={(v) => update("type", v as Filters["type"])}
          >
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="Income">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-income" />
                  Income
                </span>
              </SelectItem>
              <SelectItem value="Expense">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-expense" />
                  Expense
                </span>
              </SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.category}
            onValueChange={(v) => update("category", v as Filters["category"])}
          >
            <SelectTrigger className="h-9 w-[170px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {CATEGORY_EMOJI[cat]} {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-muted-foreground hover:text-foreground"
              onClick={clearFilters}
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>

        {/* Row 2: date range + amount range */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Date:
            </span>
            <DatePicker
              date={filters.dateFrom ? parseISO(filters.dateFrom) : undefined}
              onSelect={(date) =>
                update("dateFrom", date ? format(date, "yyyy-MM-dd") : "")
              }
              placeholder="From date"
              className="h-9 w-36"
            />
            <span className="text-xs text-muted-foreground">–</span>
            <DatePicker
              date={filters.dateTo ? parseISO(filters.dateTo) : undefined}
              onSelect={(date) =>
                update("dateTo", date ? format(date, "yyyy-MM-dd") : "")
              }
              placeholder="To date"
              className="h-9 w-36"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Amount:
            </span>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Min"
              className="h-9 w-24"
              value={filters.minAmount}
              onChange={(e) => update("minAmount", e.target.value)}
            />
            <span className="text-xs text-muted-foreground">–</span>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Max"
              className="h-9 w-24"
              value={filters.maxAmount}
              onChange={(e) => update("maxAmount", e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b-border">
              <TableHead className="w-14">
                <button
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                  onClick={() => toggleSort("id")}
                >
                  #{" "}
                  <SortIcon
                    col="id"
                    active={filters.sort}
                    order={filters.order}
                  />
                </button>
              </TableHead>
              <TableHead className="w-28">
                <button
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                  onClick={() => toggleSort("type")}
                >
                  Type{" "}
                  <SortIcon
                    col="type"
                    active={filters.sort}
                    order={filters.order}
                  />
                </button>
              </TableHead>
              <TableHead className="w-36">
                <button
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                  onClick={() => toggleSort("amount")}
                >
                  Amount{" "}
                  <SortIcon
                    col="amount"
                    active={filters.sort}
                    order={filters.order}
                  />
                </button>
              </TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-44">
                <button
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                  onClick={() => toggleSort("category")}
                >
                  Category{" "}
                  <SortIcon
                    col="category"
                    active={filters.sort}
                    order={filters.order}
                  />
                </button>
              </TableHead>
              <TableHead className="w-32">
                <button
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                  onClick={() => toggleSort("date")}
                >
                  Date{" "}
                  <SortIcon
                    col="date"
                    active={filters.sort}
                    order={filters.order}
                  />
                </button>
              </TableHead>
              <TableHead className="w-24 text-center">Recurring</TableHead>
              <TableHead className="w-20 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              // Skeleton rows
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  <TableCell>
                    <Skeleton className="h-4 w-8" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-48" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-28 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell className="text-center">
                    <Skeleton className="h-4 w-4 mx-auto rounded-full" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-7 w-16 ml-auto rounded-md" />
                  </TableCell>
                </TableRow>
              ))
            ) : !data || data.data.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={8}
                  className="h-40 text-center text-muted-foreground"
                >
                  {hasActiveFilters
                    ? "No transactions match your filters."
                    : "No transactions yet. Add one to get started!"}
                </TableCell>
              </TableRow>
            ) : (
              data.data.map((tx) => {
                const isIncome = tx.type === "Income";
                return (
                  <TableRow key={tx.id} className="group">
                    {/* ID */}
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {tx.id}
                    </TableCell>

                    {/* Type badge */}
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs font-semibold",
                          isIncome
                            ? "border-income/30 bg-income-muted text-income"
                            : "border-expense/30 bg-expense-muted text-expense",
                        )}
                      >
                        {tx.type}
                      </Badge>
                    </TableCell>

                    {/* Amount */}
                    <TableCell>
                      <span
                        className={cn(
                          "font-semibold tabular-nums text-sm",
                          isIncome ? "text-income" : "text-expense",
                        )}
                      >
                        {isIncome ? "+" : "−"}
                        {formatCurrency(tx.amount)}
                      </span>
                    </TableCell>

                    {/* Description with tooltip if truncated */}
                    <TableCell>
                      <TooltipProvider delayDuration={400}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-default text-sm">
                              {tx.description.length > 40
                                ? `${tx.description.slice(0, 40)}…`
                                : tx.description}
                            </span>
                          </TooltipTrigger>
                          {tx.description.length > 40 && (
                            <TooltipContent side="bottom" className="max-w-xs">
                              {tx.description}
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>

                    {/* Category pill */}
                    <TableCell>
                      <span
                        title={tx.splits
                          ?.map(
                            (split) =>
                              `${split.category}: ${formatCurrency(split.amount)}`,
                          )
                          .join(" · ")}
                        className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                      >
                        <span className="leading-none">
                          {CATEGORY_EMOJI[tx.category] ?? "📦"}
                        </span>
                        {tx.splits?.length
                          ? `Split · ${tx.splits.length} categories`
                          : tx.category}
                      </span>
                    </TableCell>

                    {/* Date */}
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(tx.date)}
                    </TableCell>

                    {/* Recurring */}
                    <TableCell className="text-center">
                      {tx.is_recurring ? (
                        <TooltipProvider delayDuration={400}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <RefreshCw className="h-3.5 w-3.5 text-accent mx-auto" />
                            </TooltipTrigger>
                            <TooltipContent>Recurring</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <Minus className="h-3.5 w-3.5 text-muted-foreground/30 mx-auto" />
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => onEdit(tx)}
                          aria-label="Edit transaction"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => onDelete(tx)}
                          aria-label="Delete transaction"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Pagination ─────────────────────────────────────────────────── */}
      {data && (
        <div className="flex items-center justify-between gap-4 pt-1">
          <p className="text-sm text-muted-foreground">
            {data.total === 0
              ? "No results"
              : `Page ${data.page} of ${data.totalPages} · ${data.total} total`}
          </p>

          {data.totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
