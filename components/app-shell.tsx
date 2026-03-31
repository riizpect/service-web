"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, PlusSquare, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Översikt", icon: LayoutDashboard },
  { href: "/cases/new", label: "Nytt", icon: PlusSquare },
  { href: "/dashboard", label: "Ärenden", icon: FileText }
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100">
      <div className="mx-auto w-full max-w-5xl px-3 pb-28 pt-4 md:px-6 md:pt-6">
        <header className="mb-5 rounded-3xl border border-white/70 bg-white/85 px-4 py-4 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.45)] backdrop-blur">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Ferno Serviceverktyg
          </p>
          <h1 className="mt-1 text-base font-semibold text-slate-900 md:text-lg">
            Preventivt underhåll
          </h1>
        </header>
        {children}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 pb-[max(env(safe-area-inset-bottom),10px)] md:hidden">
        <div className="mx-auto flex max-w-md items-center justify-around rounded-2xl border border-white/70 bg-white/90 px-2 py-2 shadow-[0_16px_45px_-25px_rgba(15,23,42,0.55)] backdrop-blur">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                className={cn(
                  "flex min-w-[86px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-[11px] font-medium transition-all",
                  active
                    ? "bg-primary text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

