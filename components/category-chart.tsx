"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_COLORS, type CategoryData } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

interface CategoryChartProps {
  data: CategoryData[];
  title?: string;
  loading?: boolean;
}

const MAX_ROWS = 8;

/**
 * Ranked list with thin bars. A share-of-total reads better as a sorted list
 * than as a donut, and it stays legible at any category count.
 */
export function CategoryChart({
  data,
  title = "Categories",
  loading,
}: CategoryChartProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex h-48 items-center justify-center">
          <p className="text-sm text-muted-foreground">Nothing to rank yet</p>
        </CardContent>
      </Card>
    );
  }

  const rows = data.slice(0, MAX_ROWS);
  const rest = data.slice(MAX_ROWS);
  const restAmount = rest.reduce((sum, row) => sum + row.amount, 0);
  const top = rows[0].amount || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.category}>
              <div className="flex items-baseline text-sm">
                <span
                  className="mr-2 h-2 w-2 shrink-0 self-center rounded-full"
                  style={{
                    backgroundColor:
                      CATEGORY_COLORS[row.category as keyof typeof CATEGORY_COLORS] ?? "hsl(var(--muted-foreground))",
                  }}
                  aria-hidden="true"
                />
                <span className="truncate">{row.category}</span>
                <span className="leader" aria-hidden="true" />
                <span className="figure">{formatCurrency(row.amount)}</span>
                <span className="figure w-11 text-right text-xs text-muted-foreground">
                  {row.percentage}%
                </span>
              </div>
              <div
                className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={`${row.category}: ${row.percentage}% of total, ${row.count} transactions`}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(2, (row.amount / top) * 100)}%`,
                    backgroundColor:
                      CATEGORY_COLORS[row.category as keyof typeof CATEGORY_COLORS] ?? "hsl(var(--muted-foreground))",
                  }}
                />
              </div>
            </li>
          ))}
          {rest.length > 0 && (
            <li className="flex items-baseline pt-1 text-sm text-muted-foreground">
              <span>{rest.length} more</span>
              <span className="leader" aria-hidden="true" />
              <span className="figure">{formatCurrency(restAmount)}</span>
              <span className="w-11" />
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
