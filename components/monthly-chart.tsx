"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { MonthlyData } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

interface MonthlyChartProps {
  data: MonthlyData[];
  loading?: boolean;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="min-w-[180px] rounded-lg border border-border bg-card p-3 shadow-xl">
      <p className="mb-2 text-sm font-semibold">{label}</p>
      {payload.map((entry) => (
        <div
          key={entry.name}
          className="flex items-center justify-between gap-6 py-0.5 text-sm"
        >
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span className="font-medium tabular-nums">
            {formatCurrency(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function yAxisFormatter(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1000) {
    return `€${(v / 1000).toFixed(0)}k`;
  }
  return `€${v}`;
}

export function MonthlyChart({ data, loading }: MonthlyChartProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-1 h-3.5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-80 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Monthly Overview</CardTitle>
          <p className="text-sm text-muted-foreground">Income vs Expenses</p>
        </CardHeader>
        <CardContent className="flex h-80 items-center justify-center">
          <p className="text-sm text-muted-foreground">No monthly data yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Monthly Overview</CardTitle>
        <p className="text-sm text-muted-foreground">Income vs Expenses</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              dy={6}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={yAxisFormatter}
              width={52}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{
                fontSize: "12px",
                color: "hsl(var(--muted-foreground))",
                paddingTop: "12px",
              }}
            />
            <Bar
              dataKey="income"
              name="Income"
              fill="hsl(var(--income))"
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
            />
            <Bar
              dataKey="expenses"
              name="Expenses"
              fill="hsl(var(--expense))"
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
            />
            <Line
              type="monotone"
              dataKey="net"
              name="Net"
              stroke="hsl(var(--accent))"
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: "hsl(var(--accent))", strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
