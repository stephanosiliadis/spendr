import { NextRequest, NextResponse } from "next/server";
import { getTransactions, createTransaction } from "@/lib/db";
import type { TransactionFilters, TransactionInput } from "@/lib/types";
import { TransferValidationError } from "@/lib/data-transfer";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;

    const filters: TransactionFilters = {
      type: (searchParams.get("type") as TransactionFilters["type"]) || undefined,
      dateFrom: searchParams.get("dateFrom") || undefined,
      dateTo: searchParams.get("dateTo") || undefined,
      minAmount: searchParams.get("minAmount")
        ? parseFloat(searchParams.get("minAmount")!)
        : undefined,
      maxAmount: searchParams.get("maxAmount")
        ? parseFloat(searchParams.get("maxAmount")!)
        : undefined,
      category:
        (searchParams.get("category") as TransactionFilters["category"]) ||
        undefined,
      search: searchParams.get("search") || undefined,
      sort:
        (searchParams.get("sort") as TransactionFilters["sort"]) || "date",
      order:
        (searchParams.get("order") as TransactionFilters["order"]) || "desc",
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!) : 1,
      limit: searchParams.get("limit")
        ? parseInt(searchParams.get("limit")!)
        : 20,
    };

    const result = getTransactions(filters);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/transactions]", err);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: TransactionInput = await req.json();

    if (!body.type || !["Income", "Expense"].includes(body.type)) {
      return NextResponse.json(
        { error: "type must be 'Income' or 'Expense'" },
        { status: 400 }
      );
    }
    if (!body.amount || body.amount <= 0) {
      return NextResponse.json(
        { error: "amount must be a positive number" },
        { status: 400 }
      );
    }
    if (!body.description?.trim()) {
      return NextResponse.json(
        { error: "description is required" },
        { status: 400 }
      );
    }
    if (!body.date) {
      return NextResponse.json({ error: "date is required" }, { status: 400 });
    }

    const transaction = createTransaction(body);
    return NextResponse.json(transaction, { status: 201 });
  } catch (err) {
    if (err instanceof TransferValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[POST /api/transactions]", err);
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }
}
