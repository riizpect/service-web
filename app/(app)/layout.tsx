import type { ReactNode } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto w-full max-w-5xl px-3 py-4 md:px-6 md:py-6">
        {children}
      </div>
    </div>
  );
}

