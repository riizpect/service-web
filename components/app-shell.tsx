"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, PlusSquare, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { createClientSupabaseBrowser } from "@/lib/supabaseClient";

const navItems = [
  { href: "/dashboard", label: "Översikt", icon: LayoutDashboard },
  { href: "/cases/new", label: "Nytt", icon: PlusSquare },
  { href: "/dashboard", label: "Ärenden", icon: FileText }
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadUser = async () => {
      const supabase = createClientSupabaseBrowser();
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!mounted) return;
      setUserEmail(user?.email ?? null);
    };
    void loadUser();
    return () => {
      mounted = false;
    };
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    const supabase = createClientSupabaseBrowser();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto w-full max-w-5xl px-3 pb-24 pt-4 md:px-6 md:pt-6">
        <header className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Ferno Serviceverktyg
              </p>
              <h1 className="mt-1 text-base font-semibold text-slate-900">
                Preventivt underhåll
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                Inloggad: {userEmail ?? "Laddar..."}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut ? "Loggar ut..." : "Logga ut"}
            </Button>
          </div>
        </header>
        {children}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white md:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-around px-2 py-2 pb-[max(env(safe-area-inset-bottom),8px)]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                className={cn(
                  "flex min-w-[86px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-[11px] font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-slate-500 hover:text-slate-900"
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

