import { NextResponse } from "next/server";
import { getRecurringTransactions } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(getRecurringTransactions());
  } catch (err) {
    console.error("[GET /api/transactions/recurring]", err);
    return NextResponse.json(
      { error: "Failed to fetch recurring transactions" },
      { status: 500 }
    );
  }
}
