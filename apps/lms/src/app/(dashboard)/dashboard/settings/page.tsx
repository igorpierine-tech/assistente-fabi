"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  User,
  Mail,
  Shield,
  Building2,
  CreditCard,
  KeyRound,
  ChevronRight,
} from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Proprietário",
  ADMIN: "Administrador",
  MENTOR: "Mentor",
  STUDENT: "Aluno",
};

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-foreground">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie seu perfil e preferências da conta.
        </p>
      </div>

      {/* Profile */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
        <h2 className="font-serif text-lg font-semibold text-foreground">Perfil</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-4">
            <User className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Nome</p>
              <p className="text-sm font-medium text-foreground truncate">
                {user?.firstName} {user?.lastName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-4">
            <Mail className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">E-mail</p>
              <p className="text-sm font-medium text-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-4">
            <Shield className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Função</p>
              <p className="text-sm font-medium text-foreground">
                {ROLE_LABELS[user?.role ?? ""] ?? user?.role}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-4">
            <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Organização</p>
              <p className="text-sm font-medium text-foreground truncate">{user?.tenantSlug}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="space-y-3">
        <h2 className="font-serif text-lg font-semibold text-foreground">Ações</h2>
        <Link
          href="/dashboard/settings/billing"
          className="flex items-center justify-between rounded-xl border border-border bg-card p-5 hover:border-gold/30 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/15">
              <CreditCard className="h-5 w-5 text-gold-dark" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Plano & Billing</p>
              <p className="text-xs text-muted-foreground">Gerencie seu plano e acompanhe o uso</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-gold-dark transition-colors" />
        </Link>
        <Link
          href="/forgot-password"
          className="flex items-center justify-between rounded-xl border border-border bg-card p-5 hover:border-gold/30 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5">
              <KeyRound className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Alterar Senha</p>
              <p className="text-xs text-muted-foreground">Redefina sua senha de acesso</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-gold-dark transition-colors" />
        </Link>
      </div>
    </div>
  );
}
