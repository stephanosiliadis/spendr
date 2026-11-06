"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Plus, Trash2, WandSparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES, type Category, type CategoryRule } from "@/lib/types";

export default function CategoryRulesPage() {
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [matchText, setMatchText] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/category-rules", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {throw new Error(data.error ?? "Could not load rules.");}
        setRules(data.rules);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          toast.error(error instanceof Error ? error.message : "Could not load rules.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {setLoading(false);}
      });
    return () => controller.abort();
  }, []);

  const addRule = async (event: FormEvent) => {
    event.preventDefault();
    if (!matchText.trim() || !category) {return;}
    setSaving(true);
    try {
      const response = await fetch("/api/category-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchText, category }),
      });
      const data = await response.json();
      if (!response.ok) {throw new Error(data.error ?? "Could not save this rule.");}
      setRules(data.rules);
      setMatchText("");
      setCategory("");
      toast.success("Category rule saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this rule.");
    } finally {
      setSaving(false);
    }
  };

  const removeRule = async (rule: CategoryRule) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/category-rules?id=${encodeURIComponent(rule.id)}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {throw new Error(data.error ?? "Could not remove this rule.");}
      setRules(data.rules);
      toast.success("Category rule removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove this rule.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 pt-20 lg:pt-6">
      <header>
        <h1 className="text-2xl font-bold">Category rules</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Automatically categorize new transactions when their descriptions match a phrase.
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your rules</CardTitle>
            <p className="text-sm text-muted-foreground">
              Rules apply when a transaction is set to Other. A category you choose yourself is kept.
              Longer matching phrases take priority. Existing entries change only when you edit and save them.
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading rules…
              </div>
            ) : rules.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center">
                <WandSparkles className="mx-auto h-7 w-7 text-accent" />
                <p className="mt-3 font-medium">No category rules yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  For example, match “Metro” to Transport or “Netflix” to Entertainment.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {rules.map((rule) => (
                  <div key={rule.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                      <WandSparkles className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">Description contains “{rule.matchText}”</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Assign to {rule.category}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove rule for ${rule.matchText}`}
                      disabled={saving}
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeRule(rule)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Add a rule</CardTitle>
            <p className="text-sm text-muted-foreground">Use a merchant name or a phrase found in the description.</p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={addRule}>
              <div className="space-y-1.5">
                <Label htmlFor="rule-match">Description contains</Label>
                <Input
                  id="rule-match"
                  value={matchText}
                  onChange={(event) => setMatchText(event.target.value)}
                  placeholder="e.g. Metro"
                  maxLength={80}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rule-category">Assign category</Label>
                <Select value={category} onValueChange={(value) => setCategory(value as Category)}>
                  <SelectTrigger id="rule-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((item) => (
                      <SelectItem key={item} value={item}>{item}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" type="submit" disabled={saving || loading || !matchText.trim() || !category}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Save rule
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
