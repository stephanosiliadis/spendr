"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  BarChart3,
  LayoutDashboard,
  Menu,
  PiggyBank,
  Tags,
  Target,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const navLinks = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/transactions", icon: ArrowLeftRight, label: "Transactions" },
  { href: "/insights", icon: BarChart3, label: "Analytics" },
  { href: "/budgets", icon: PiggyBank, label: "Budgets" },
  { href: "/rules", icon: Tags, label: "Category rules" },
  { href: "/goals", icon: Target, label: "Savings goals" },
] as const;

const legalLinks = [
  { href: "/privacy-policy", label: "Privacy" },
  { href: "/terms-page", label: "Terms" },
] as const;

const allLinks = [
  ...navLinks,
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms-page", label: "Terms" },
];

/** Two ledger rules, one longer: the Spendr mark. */
function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={cn("h-5 w-5 shrink-0", className)}
      aria-hidden="true"
    >
      <rect width="20" height="20" rx="6" className="fill-secondary" />
      <rect x="5" y="6.5" width="10" height="1.75" rx=".875" className="fill-secondary-foreground" />
      <rect x="5" y="11.75" width="6.5" height="1.75" rx=".875" className="fill-secondary-foreground" />
    </svg>
  );
}

function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <Mark />
      <span className="font-brand text-xl font-semibold tracking-tight text-secondary">Spendr</span>
    </span>
  );
}

function NavItem({
  href,
  icon: Icon,
  label,
  onClick,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors",
        isActive
          ? "bg-secondary/10 font-medium text-secondary"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
      {label}
    </Link>
  );
}

function SidebarBody({
  onNavClick,
  showBrand = true,
}: {
  onNavClick?: () => void;
  showBrand?: boolean;
}) {
  const pathname = usePathname();
  return (
    <>
      {showBrand && (
        <div className="flex h-14 items-center px-5">
          <Link href="/" onClick={onNavClick} aria-label="Spendr dashboard">
            <Wordmark />
          </Link>
        </div>
      )}

      <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto px-3 pt-2">
        {navLinks.map((link) => (
          <NavItem
            key={link.href}
            href={link.href}
            icon={link.icon}
            label={link.label}
            onClick={onNavClick}
          />
        ))}
      </nav>

      <div className="space-y-2 border-t border-border px-3 py-3">
        <ThemeToggle />
        <div className="flex items-center gap-3 px-2.5 text-xs text-muted-foreground">
          {legalLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={onNavClick}
              aria-current={pathname.startsWith(link.href) ? "page" : undefined}
              className={cn(
                "transition-colors hover:text-foreground",
                pathname.startsWith(link.href) && "text-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}
          <span className="figure ml-auto">v1.1.0</span>
        </div>
      </div>
    </>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const currentPage =
    allLinks.find((l) =>
      l.href === "/" ? pathname === "/" : pathname.startsWith(l.href),
    )?.label ?? "Dashboard";

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
        <SidebarBody />
      </aside>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-card px-3 lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Open menu"
          aria-expanded={mobileOpen}
        >
          <Menu className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <Mark />
        <span className="text-sm font-medium">{currentPage}</span>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <div className="flex w-72 flex-col border-r border-border bg-card shadow-xl shadow-black/10">
            <div className="flex h-14 items-center justify-between pl-5 pr-3">
              <Wordmark />
              <button
                onClick={() => setMobileOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
            <SidebarBody showBrand={false} onNavClick={() => setMobileOpen(false)} />
          </div>
          <div
            className="flex-1 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
        </div>
      )}
    </>
  );
}
