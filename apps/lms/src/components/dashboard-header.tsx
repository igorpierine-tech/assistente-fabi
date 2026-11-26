"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { LogOut, User } from "lucide-react";

export function DashboardHeader() {
  const router = useRouter();
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  const initials =
    user?.firstName && user.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`
      : "U";

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
      <div />

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-green-mid to-gold-dark">
            <span className="text-xs font-semibold italic text-white font-serif">
              {initials}
            </span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-foreground">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-muted-foreground capitalize">
              {user?.role?.toLowerCase()}
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-secondary transition-colors"
          title="Sair"
        >
          <LogOut className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </header>
  );
}
