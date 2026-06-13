"use client";

import { useApp } from "@/lib/data";
import { AuthScreen } from "./AuthScreen";
import { AppShell } from "./AppShell";
import { BrandMark } from "./Brand";

export function App() {
  const { user, authLoading } = useApp();

  if (authLoading) {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <BrandMark size={48} />
          <p className="text-sm text-muted">Loading your life…</p>
        </div>
      </main>
    );
  }

  return user ? <AppShell /> : <AuthScreen />;
}
