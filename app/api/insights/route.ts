import { NextRequest, NextResponse } from "next/server";
import { getInsights } from "@/lib/db";

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {return false;}
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function GET(req: NextRequest) {
  try {
    const dateFrom = req.nextUrl.searchParams.get("dateFrom") || undefined;
    const dateTo = req.nextUrl.searchParams.get("dateTo") || undefined;
    if ((dateFrom && !isValidDate(dateFrom)) || (dateTo && !isValidDate(dateTo))) {
      return NextResponse.json({ error: "Dates must use YYYY-MM-DD format." }, { status: 400 });
    }
    if (dateFrom && dateTo && dateFrom > dateTo) {
      return NextResponse.json({ error: "Start date must be on or before end date." }, { status: 400 });
    }

    const insights = getInsights(dateFrom, dateTo);
    return NextResponse.json(insights);
  } catch (err) {
    console.error("[GET /api/insights]", err);
    return NextResponse.json(
      { error: "Failed to compute insights" },
      { status: 500 },
    );
  }
}
