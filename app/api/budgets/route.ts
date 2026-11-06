import { NextRequest, NextResponse } from "next/server";

import { getCategoryBudgetStatus, getCategoryBudgets, saveCategoryBudgets } from "@/lib/db";
import { CATEGORIES, type Category, type CategoryBudget } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const month = request.nextUrl.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return NextResponse.json({ error: "Month must use YYYY-MM format." }, { status: 400 });
    }
    return NextResponse.json({ ...getCategoryBudgetStatus(month), categories: CATEGORIES });
  } catch (error) {
    console.error("[GET /api/budgets]", error);
    return NextResponse.json({ error: "Failed to load budgets." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("budgets" in body) || !Array.isArray(body.budgets)) {
      return NextResponse.json({ error: "Provide a budgets array." }, { status: 400 });
    }
    const budgets: CategoryBudget[] = [];
    const seen = new Set<string>();
    for (const entry of body.budgets) {
      if (!entry || typeof entry !== "object" || !("category" in entry) || !("monthlyLimit" in entry)) {
        return NextResponse.json({ error: "Each budget needs a category and monthly limit." }, { status: 400 });
      }
      const { category, monthlyLimit } = entry as { category: unknown; monthlyLimit: unknown };
      if (typeof category !== "string" || !CATEGORIES.includes(category as Category)) {
        return NextResponse.json({ error: "Choose a valid category." }, { status: 400 });
      }
      if (seen.has(category)) {
        return NextResponse.json({ error: "Each category can have one budget." }, { status: 400 });
      }
      if (typeof monthlyLimit !== "number" || !Number.isFinite(monthlyLimit) || monthlyLimit <= 0
        || Math.round(monthlyLimit * 100) / 100 !== monthlyLimit
        || !Number.isSafeInteger(Math.round(monthlyLimit * 100))) {
        return NextResponse.json({ error: "Budget limits must be positive amounts with up to two decimals." }, { status: 400 });
      }
      seen.add(category);
      budgets.push({ category: category as Category, monthlyLimit });
    }
    saveCategoryBudgets(budgets);
    return NextResponse.json({ budgets: getCategoryBudgets() });
  } catch (error) {
    console.error("[PUT /api/budgets]", error);
    return NextResponse.json({ error: "Failed to save budgets." }, { status: 500 });
  }
}
