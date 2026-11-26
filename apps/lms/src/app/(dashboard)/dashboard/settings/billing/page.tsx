"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import {
  Users,
  BookOpen,
  Zap,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  Loader2,
  Crown,
  Sparkles,
  Building2,
  ExternalLink,
} from "lucide-react";

interface BillingInfo {
  plan: string;
  limits: { maxStudents: number; maxPrograms: number; maxStorageMb: number };
  usage: { students: number; programs: number };
  trialEndsAt: string | null;
  hasSubscription: boolean;
  checkoutUrls: { STARTER: string | null; PRO: string | null; ENTERPRISE: string | null };
}

const PLAN_DETAILS: Record<string, { label: string; icon: typeof Crown; color: string; bgColor: string }> = {
  FREE: { label: "Gratuito", icon: Zap, color: "text-muted-foreground", bgColor: "bg-muted" },
  STARTER: { label: "Starter", icon: Sparkles, color: "text-blue-600", bgColor: "bg-blue-50" },
  PRO: { label: "Pro", icon: Crown, color: "text-gold-dark", bgColor: "bg-gold/10" },
  ENTERPRISE: { label: "Enterprise", icon: Building2, color: "text-purple-600", bgColor: "bg-purple-50" },
};

const UPGRADE_PLANS = [
  {
    plan: "STARTER" as const,
    label: "Starter",
    description: "Para equipes pequenas em crescimento",
    features: ["50 alunos", "5 programas", "2 GB armazenamento"],
  },
  {
    plan: "PRO" as const,
    label: "Pro",
    highlight: true,
    description: "Para organizações em expansão",
    features: ["200 alunos", "20 programas", "10 GB armazenamento"],
  },
  {
    plan: "ENTERPRISE" as const,
    label: "Enterprise",
    description: "Para grandes empresas",
    features: ["10.000 alunos", "100 programas", "50 GB armazenamento"],
  },
];

function UsageBar({ label, icon: Icon, current, max }: { label: string; icon: typeof Users; current: number; max: number }) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const isNearLimit = pct >= 80;
  const isAtLimit = pct >= 100;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>
        <span className={`text-sm font-semibold ${isAtLimit ? "text-red-600" : isNearLimit ? "text-amber-600" : "text-foreground"}`}>
          {current} / {max}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isAtLimit ? "bg-red-500" : isNearLimit ? "bg-amber-500" : "bg-gradient-to-r from-gold-dark to-gold"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>}>
      <BillingContent />
    </Suspense>
  );
}

function BillingContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const { tokens } = useAuth();

  const success = searchParams.get("success") === "true";
  const canceled = searchParams.get("canceled") === "true";

  const isAdmin = user?.role === "OWNER" || user?.role === "ADMIN";

  useEffect(() => {
    if (!tokens) return;
    api<BillingInfo>("/billing/info", { token: tokens.accessToken })
      .then(setBilling)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tokens]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  if (!billing) {
    return (
      <div className="max-w-4xl mx-auto py-10 text-center">
        <p className="text-muted-foreground">Não foi possível carregar informações de billing.</p>
      </div>
    );
  }

  const planInfo = PLAN_DETAILS[billing.plan] ?? PLAN_DETAILS.FREE;
  const PlanIcon = planInfo.icon;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-2xl font-semibold text-foreground">Plano & Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie seu plano e acompanhe o uso da sua organização.
        </p>
      </div>

      {/* Success / Cancel banners */}
      {success && (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          <p className="text-sm text-green-800">Assinatura ativada com sucesso! Seu plano foi atualizado.</p>
        </div>
      )}
      {canceled && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <XCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">Checkout cancelado. Nenhuma alteração foi feita no seu plano.</p>
        </div>
      )}

      {/* Current Plan */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${planInfo.bgColor}`}>
              <PlanIcon className={`h-6 w-6 ${planInfo.color}`} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Plano atual</p>
              <p className={`text-xl font-semibold ${planInfo.color}`}>{planInfo.label}</p>
            </div>
          </div>
          {billing.hasSubscription && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1 text-xs font-medium text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Assinatura ativa
            </span>
          )}
        </div>

        {billing.trialEndsAt && (
          <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2">
            <p className="text-sm text-amber-800">
              Período de teste termina em{" "}
              <strong>{new Date(billing.trialEndsAt).toLocaleDateString("pt-BR")}</strong>
            </p>
          </div>
        )}
      </div>

      {/* Usage */}
      <div>
        <h2 className="font-serif text-lg font-semibold text-foreground mb-4">Uso Atual</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <UsageBar icon={Users} label="Alunos" current={billing.usage.students} max={billing.limits.maxStudents} />
          <UsageBar icon={BookOpen} label="Programas" current={billing.usage.programs} max={billing.limits.maxPrograms} />
        </div>
      </div>

      {/* Upgrade Plans */}
      {billing.plan !== "ENTERPRISE" && isAdmin && (
        <div>
          <h2 className="font-serif text-lg font-semibold text-foreground mb-4">Upgrade de Plano</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {UPGRADE_PLANS.filter((p) => {
              const order = ["FREE", "STARTER", "PRO", "ENTERPRISE"];
              return order.indexOf(p.plan) > order.indexOf(billing.plan);
            }).map((p) => {
              const checkoutUrl = billing.checkoutUrls[p.plan];
              return (
                <div
                  key={p.plan}
                  className={`rounded-xl border p-5 flex flex-col ${
                    p.highlight ? "border-gold bg-gold/5" : "border-border bg-card"
                  }`}
                >
                  {p.highlight && (
                    <span className="inline-block self-start rounded-full bg-gold/20 px-3 py-0.5 text-xs font-semibold text-gold-dark mb-3">
                      Mais popular
                    </span>
                  )}
                  <h3 className="font-serif text-lg font-semibold text-foreground">{p.label}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                  <ul className="mt-4 space-y-2 flex-1">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                        <CheckCircle2 className="h-4 w-4 text-gold-dark shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {checkoutUrl ? (
                    <a
                      href={checkoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`mt-5 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                        p.highlight
                          ? "bg-gold-dark text-white hover:bg-gold-dark/90"
                          : "bg-primary text-primary-foreground hover:bg-primary/90"
                      }`}
                    >
                      Assinar {p.label}
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : (
                    <button
                      disabled
                      className="mt-5 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold bg-muted text-muted-foreground cursor-not-allowed"
                    >
                      Em breve
                      <ArrowUpRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {billing.plan === "ENTERPRISE" && (
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-6 text-center">
          <Building2 className="mx-auto h-8 w-8 text-purple-600" />
          <p className="mt-3 font-serif text-lg font-semibold text-purple-900">Plano Enterprise</p>
          <p className="mt-1 text-sm text-purple-700">
            Você está no plano mais completo. Para personalizar limites, entre em contato com nosso time.
          </p>
        </div>
      )}
    </div>
  );
}
