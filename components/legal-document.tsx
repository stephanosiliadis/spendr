import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export interface LegalSection {
  title: string;
  body: string;
}

interface LegalDocumentProps {
  title: string;
  description: string;
  icon: LucideIcon;
  sections: LegalSection[];
}

export function LegalDocument({
  title,
  description,
  icon: Icon,
  sections,
}: LegalDocumentProps) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-12 pt-20 sm:px-6 lg:px-10 lg:py-10">
      <header className="relative mb-8 overflow-hidden rounded-2xl border border-border bg-card px-6 py-8 shadow-sm sm:px-9 sm:py-10">
        <div className="pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative max-w-3xl">
          <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <Icon className="h-6 w-6" aria-hidden="true" />
          </div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
            Spendr · Legal
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            {description}
          </p>
          <p className="mt-5 text-xs text-muted-foreground">
            A quick guide to the terms that apply when using Spendr.
          </p>
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <Card className="lg:sticky lg:top-6">
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold">On this page</h2>
            <nav aria-label="Document sections" className="mt-3">
              <ol className="space-y-1">
                {sections.map((section, index) => (
                  <li key={section.title}>
                    <Link
                      href={`#section-${index + 1}`}
                      className="group flex items-start gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <span className="mt-0.5 w-5 shrink-0 text-[11px] font-semibold tabular-nums text-accent">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span>{section.title}</span>
                      <ArrowUpRight className="ml-auto mt-0.5 h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
                    </Link>
                  </li>
                ))}
              </ol>
            </nav>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {sections.map((section, index) => (
            <Card
              key={section.title}
              id={`section-${index + 1}`}
              className="scroll-mt-6 transition-shadow hover:shadow-md"
            >
              <CardContent className="flex gap-4 p-5 sm:gap-5 sm:p-7">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-semibold tabular-nums text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className="min-w-0 pt-1">
                  <h2 className="text-lg font-semibold tracking-tight">{section.title}</h2>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground sm:text-[15px]">
                    {section.body}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
