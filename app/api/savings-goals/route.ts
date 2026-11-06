import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { isCalendarDate } from "@/lib/data-transfer";
import { getSavingsGoals, saveSavingsGoals } from "@/lib/db";
import type { SavingsGoal } from "@/lib/types";

function isValidMoney(value: unknown, allowZero = false): value is number {
  return typeof value === "number"
    && Number.isFinite(value)
    && (allowZero ? value >= 0 : value > 0)
    && Number.isSafeInteger(Math.round(value * 100))
    && Math.round(value * 100) / 100 === value;
}

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ goals: getSavingsGoals() });
  } catch (error) {
    console.error("[GET /api/savings-goals]", error);
    return NextResponse.json({ error: "Failed to load savings goals." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("name" in body) || !("targetAmount" in body)) {
      return NextResponse.json({ error: "Provide a goal name and target amount." }, { status: 400 });
    }
    const payload = body as Record<string, unknown>;
    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    if (!name || name.length > 80) {
      return NextResponse.json({ error: "Goal names must be between 1 and 80 characters." }, { status: 400 });
    }
    const targetAmount = payload.targetAmount;
    if (!isValidMoney(targetAmount)) {
      return NextResponse.json({ error: "Enter a positive target with up to two decimal places." }, { status: 400 });
    }
    const targetDate = payload.targetDate;
    if (targetDate !== undefined && targetDate !== "" && !isCalendarDate(targetDate)) {
      return NextResponse.json({ error: "Choose a valid target date." }, { status: 400 });
    }
    const goal: SavingsGoal = {
      id: randomUUID(),
      name,
      targetAmount,
      currentAmount: 0,
      ...(typeof targetDate === "string" && targetDate ? { targetDate } : {}),
    };
    const goals = [...getSavingsGoals(), goal];
    saveSavingsGoals(goals);
    return NextResponse.json({ goals, goal }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/savings-goals]", error);
    return NextResponse.json({ error: "Failed to create savings goal." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("id" in body) || !("contribution" in body)
      || typeof body.id !== "string" || !isValidMoney(body.contribution)) {
      return NextResponse.json({ error: "Provide a goal ID and a positive contribution." }, { status: 400 });
    }
    const goals = getSavingsGoals();
    const goalIndex = goals.findIndex((goal) => goal.id === body.id);
    if (goalIndex < 0) {return NextResponse.json({ error: "Savings goal not found." }, { status: 404 });}
    const currentAmount = Math.round((goals[goalIndex].currentAmount + body.contribution) * 100) / 100;
    if (!Number.isSafeInteger(Math.round(currentAmount * 100))) {
      return NextResponse.json({ error: "Contribution exceeds the supported amount." }, { status: 400 });
    }
    goals[goalIndex] = { ...goals[goalIndex], currentAmount };
    saveSavingsGoals(goals);
    return NextResponse.json({ goals, goal: goals[goalIndex] });
  } catch (error) {
    console.error("[PATCH /api/savings-goals]", error);
    return NextResponse.json({ error: "Failed to record contribution." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {return NextResponse.json({ error: "Provide a goal ID." }, { status: 400 });}
    const current = getSavingsGoals();
    const goals = current.filter((goal) => goal.id !== id);
    if (goals.length === current.length) {
      return NextResponse.json({ error: "Savings goal not found." }, { status: 404 });
    }
    saveSavingsGoals(goals);
    return NextResponse.json({ goals });
  } catch (error) {
    console.error("[DELETE /api/savings-goals]", error);
    return NextResponse.json({ error: "Failed to delete savings goal." }, { status: 500 });
  }
}
