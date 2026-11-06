import { NextRequest, NextResponse } from "next/server";
import { getAllTransactionsForExport } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const format = searchParams.get("format") ?? "json";
    const type = searchParams.get("type") ?? "all";

    const transactions = getAllTransactionsForExport(
      type === "all" ? undefined : type,
    );

    if (format === "csv") {
      const header = "ID,Type,Amount,Description,Date,Category,Recurring,Splits";
      const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
      const rows = transactions.map((t) =>
        [
          t.id,
          t.type,
          t.amount,
          t.description,
          t.date,
          t.category,
          t.is_recurring ? "Yes" : "No",
          t.splits ? JSON.stringify(t.splits) : "",
        ].map(csvCell).join(","),
      );
      const csv = [header, ...rows].join("\n");

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="spendr-export-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    // JSON export
    return new NextResponse(JSON.stringify(transactions, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="spendr-export-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (err) {
    console.error("[GET /api/export]", err);
    return NextResponse.json(
      { error: "Failed to export transactions" },
      { status: 500 },
    );
  }
}
