"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  BarChart3,
  LayoutDashboard,
  Menu,
  FileText,
  Shield,
  Wallet,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const navLinks = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/transactions", icon: ArrowLeftRight, label: "Transactions" },
  { href: "/insights", icon: BarChart3, label: "Analytics" },
  { href: "/privacy-policy", icon: Shield, label: "Privacy Policy" },
  { href: "/terms-page", icon: FileText, label: "Terms" },
] as const;

function NavItem({
  href,
  icon: Icon,
  label,
  onClick,
}: {
  href: string
  icon: React.ElementType
  label: string
  onClick?: () => void
}) {
  const pathname = usePathname();
  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
        isActive
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5 shrink-0 transition-colors",
          isActive ? "text-primary" : "",
        )}
      />
      {label}
    </Link>
  );
}

function SidebarBody({ onNavClick }: { onNavClick?: () => void }) {
  return (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/20">
          <Wallet className="h-5 w-5 text-primary" />
        </div>
<span className="font-xl font-bold text-primary">
                Spendr
              </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          Menu
        </p>
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

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <ThemeToggle />
        <span className="text-xs text-muted-foreground">v1.0.0</span>
      </div>
    </>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const currentPage =
    navLinks.find((l) =>
      l.href === "/" ? pathname === "/" : pathname.startsWith(l.href),
    )?.label ?? "Dashboard";

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────── */}
      <aside className="hidden h-screen w-64 shrink-0 flex-col bg-card lg:flex sticky top-0 border-r border-border">
        <SidebarBody />
      </aside>

      {/* ── Mobile top bar ───────────────────────────────────────── */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur-sm lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20">
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          <span className="font-semibold">{currentPage}</span>
        </div>

        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>

      {/* ── Mobile drawer overlay ─────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          {/* Panel */}
          <div className="flex w-72 flex-col bg-card shadow-2xl">
            {/* Drawer header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20">
                  <Wallet className="h-4 w-4 text-primary" />
                </div>
                <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text font-bold text-transparent">
                  Spendr
                </span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Drawer nav */}
            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {navLinks.map((link) => (
                <NavItem
                  key={link.href}
                  href={link.href}
                  icon={link.icon}
                  label={link.label}
                  onClick={() => setMobileOpen(false)}
                />
              ))}
            </nav>

            {/* Drawer footer */}
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <ThemeToggle />
              <span className="text-xs text-muted-foreground">v1.0.0</span>
            </div>
          </div>

          {/* Backdrop */}
          <div
            className="flex-1 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
        </div>
      )}
    </>
  );
}
