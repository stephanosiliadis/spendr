import { NextRequest, NextResponse } from "next/server";
import {
  getTransactionById,
  updateTransaction,
  deleteTransaction,
} from "@/lib/db";
import type { TransactionInput } from "@/lib/types";
import { TransferValidationError } from "@/lib/data-transfer";

type Params = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }
    const transaction = getTransactionById(id);
    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(transaction);
  } catch (err) {
    console.error("[GET /api/transactions/:id]", err);
    return NextResponse.json(
      { error: "Failed to fetch transaction" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

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

    const updated = updateTransaction(id, body);
    if (!updated) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof TransferValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[PUT /api/transactions/:id]", err);
    return NextResponse.json(
      { error: "Failed to update transaction" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }
    const deleted = deleteTransaction(id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, ...deleted });
  } catch (err) {
    if (err instanceof TransferValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[DELETE /api/transactions/:id]", err);
    return NextResponse.json(
      { error: "Failed to delete transaction" },
      { status: 500 }
    );
  }
}
