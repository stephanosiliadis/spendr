"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
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
  title?: string;
  subtitle?: string;
}

const TICK = {
  fontSize: 11,
  fill: "hsl(var(--muted-foreground))",
  fontFamily: '"DM Sans Variable", system-ui, sans-serif',
};

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: MonthlyData }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const d = payload[0].payload;
  const rows: Array<[string, number]> = [
    ["Income", d.income],
    ["Expenses", d.expenses],
    ["Net", d.net],
  ];

  return (
    <div className="min-w-[184px] rounded-lg border border-border bg-popover p-3 shadow-lg shadow-black/5">
      <p className="mb-2 text-sm font-medium">{label}</p>
      {rows.map(([name, value]) => (
        <div key={name} className="flex items-baseline justify-between gap-6 py-0.5 text-sm">
          <span className="text-muted-foreground">{name}</span>
          <span className="figure">{formatCurrency(value)}</span>
        </div>
      ))}
    </div>
  );
}

function yAxisFormatter(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1000) {
    return `€${(abs / 1000).toFixed(abs % 1000 === 0 ? 0 : 1)}k`;
  }
  return `€${abs}`;
}

function Key({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={`h-2 w-2 rounded-[2px] ${swatch}`} aria-hidden="true" />
      {label}
    </span>
  );
}

/**
 * Cash flow, drawn as a mirror: income rises above the axis, expenses fall
 * below it, and the net line carries the single accent.
 */
export function MonthlyChart({
  data,
  loading,
  title = "Cash flow",
  subtitle = "Income above the line, expenses below",
}: MonthlyChartProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-52" />
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
          <CardTitle>{title}</CardTitle>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </CardHeader>
        <CardContent className="flex h-80 items-center justify-center">
          <p className="text-sm text-muted-foreground">
            Add a transaction to see monthly cash flow
          </p>
        </CardContent>
      </Card>
    );
  }

  const mirrored = data.map((d) => ({ ...d, expensesBelow: -d.expenses }));

  return (
    <Card>
      <CardHeader className="flex-col items-start justify-between gap-3 space-y-0 sm:flex-row sm:gap-4">
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-4 sm:pt-1">
          <Key swatch="bg-income" label="Income" />
          <Key swatch="bg-expense/60" label="Expenses" />
          <Key swatch="bg-secondary" label="Net" />
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart
            data={mirrored}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            stackOffset="sign"
          >
            <CartesianGrid
              stroke="hsl(var(--border))"
              strokeDasharray="1 4"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tickFormatter={(v: string) => v.replace(/ (\d{2})$/, " \u2019$1")}
              tick={TICK}
              axisLine={false}
              tickLine={false}
              dy={8}
            />
            <YAxis
              domain={["auto", "auto"]}
              tick={TICK}
              axisLine={false}
              tickLine={false}
              tickFormatter={yAxisFormatter}
              width={48}
            />
            <ReferenceLine y={0} stroke="hsl(var(--foreground))" strokeOpacity={0.35} />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "hsl(var(--foreground))", fillOpacity: 0.04 }}
            />
            <Bar
              dataKey="income"
              stackId="flow"
              name="Income"
              fill="hsl(var(--income))"
              fillOpacity={0.9}
              radius={[3, 3, 0, 0]}
              maxBarSize={32}
              isAnimationActive={false}
            />
            <Bar
              dataKey="expensesBelow"
              stackId="flow"
              name="Expenses"
              fill="hsl(var(--expense))"
              fillOpacity={0.6}
              radius={[0, 0, 3, 3]}
              maxBarSize={32}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="net"
              name="Net"
              stroke="hsl(var(--secondary))"
              strokeWidth={2}
              dot={{ r: 3, fill: "hsl(var(--card))", stroke: "hsl(var(--secondary))", strokeWidth: 2 }}
              activeDot={{ r: 4.5, strokeWidth: 0, fill: "hsl(var(--secondary))" }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
