import { NextResponse } from "next/server";
import { getInsights } from "@/lib/db";

export async function GET() {
  try {
    const insights = getInsights();
    return NextResponse.json(insights);
  } catch (err) {
    console.error("[GET /api/insights]", err);
    return NextResponse.json(
      { error: "Failed to compute insights" },
      { status: 500 },
    );
  }
}
