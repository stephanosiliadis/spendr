import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { getCategoryRules, saveCategoryRules } from "@/lib/db";
import { CATEGORIES, type Category, type CategoryRule } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ rules: getCategoryRules() });
  } catch (error) {
    console.error("[GET /api/category-rules]", error);
    return NextResponse.json({ error: "Failed to load category rules." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("matchText" in body) || !("category" in body)) {
      return NextResponse.json({ error: "Provide a phrase and category." }, { status: 400 });
    }
    const matchText = typeof body.matchText === "string" ? body.matchText.trim() : "";
    const category = body.category;
    if (!matchText || matchText.length > 80) {
      return NextResponse.json({ error: "The matching phrase must be between 1 and 80 characters." }, { status: 400 });
    }
    if (typeof category !== "string" || !CATEGORIES.includes(category as Category)) {
      return NextResponse.json({ error: "Choose a valid category." }, { status: 400 });
    }
    const current = getCategoryRules();
    const existing = current.find((rule) => rule.matchText.toLocaleLowerCase() === matchText.toLocaleLowerCase());
    const rule: CategoryRule = { id: existing?.id ?? randomUUID(), matchText, category: category as Category };
    const rules = [rule, ...current.filter((item) => item.id !== existing?.id)]
      .sort((a, b) => b.matchText.length - a.matchText.length);
    saveCategoryRules(rules);
    return NextResponse.json({ rules, rule }, { status: existing ? 200 : 201 });
  } catch (error) {
    console.error("[POST /api/category-rules]", error);
    return NextResponse.json({ error: "Failed to save category rule." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {return NextResponse.json({ error: "Provide a rule ID." }, { status: 400 });}
    const current = getCategoryRules();
    const rules = current.filter((rule) => rule.id !== id);
    if (rules.length === current.length) {
      return NextResponse.json({ error: "Category rule not found." }, { status: 404 });
    }
    saveCategoryRules(rules);
    return NextResponse.json({ rules });
  } catch (error) {
    console.error("[DELETE /api/category-rules]", error);
    return NextResponse.json({ error: "Failed to remove category rule." }, { status: 500 });
  }
}
