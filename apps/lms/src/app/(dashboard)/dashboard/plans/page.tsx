"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import {
  Crown,
  Check,
  Zap,
  BookOpen,
  Loader2,
  Star,
} from "lucide-react";

type PlanPeriodicity = "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL" | "LIFETIME";

interface PlanContent {
  id: string;
  program: { id: string; title: string } | null;
  module: { id: string; title: string } | null;
  lesson: { id: string; title: string } | null;
}

interface Plan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  periodicity: PlanPeriodicity;
  priceInCents: number | null;
  active: boolean;
  contents: PlanContent[];
  _count: { subscriptions: number };
}

interface Subscription {
  id: string;
  status: string;
  planId: string;
  startsAt: string;
  expiresAt: string | null;
}

const PERIODICITY_LABELS: Record<PlanPeriodicity, string> = {
  MONTHLY: "Mensal",
  QUARTERLY: "Trimestral",
  SEMIANNUAL: "Semestral",
  ANNUAL: "Anual",
  LIFETIME: "Vitalício",
};

function formatPrice(cents: number | null) {
  if (cents === null || cents === undefined) return "Gratuito";
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export default function StudentPlansPage() {
  const { tokens } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokens) return;

    async function load() {
      try {
        const [plansData, subsData] = await Promise.all([
          api<Plan[]>("/plans", { token: tokens!.accessToken }),
          api<Subscription[]>("/plans/subscriptions/all", { token: tokens!.accessToken }).catch(() => []),
        ]);
        setPlans(plansData.filter((p) => p.active));
        setSubscriptions(Array.isArray(subsData) ? subsData : []);
      } catch {
        // handle
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [tokens]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  const activeSubPlanIds = new Set(
    subscriptions.filter((s) => s.status === "ACTIVE").map((s) => s.planId)
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-foreground">Planos de Acesso</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conheça os planos disponíveis e os conteúdos incluídos em cada um.
        </p>
      </div>

      {plans.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <Crown className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhum plano disponível no momento.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const isSubscribed = activeSubPlanIds.has(plan.id);
            const programContents = plan.contents.filter((c) => c.program);

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border-2 overflow-hidden transition-all ${
                  isSubscribed
                    ? "border-gold bg-gold/5 shadow-lg"
                    : "border-border bg-card hover:border-gold/30 hover:shadow-md"
                }`}
              >
                {isSubscribed && (
                  <div className="absolute top-0 right-0 bg-gold text-green-dark text-xs font-bold px-3 py-1 rounded-bl-lg">
                    Ativo
                  </div>
                )}

                <div className="p-6 space-y-4">
                  {/* Header */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Crown className="h-5 w-5 text-gold-dark" />
                      <h3 className="font-serif text-xl font-semibold text-foreground">
                        {plan.name}
                      </h3>
                    </div>
                    {plan.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {plan.description}
                      </p>
                    )}
                  </div>

                  {/* Price */}
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-foreground">
                      {formatPrice(plan.priceInCents)}
                    </span>
                    {plan.priceInCents && (
                      <span className="text-sm text-muted-foreground">
                        /{PERIODICITY_LABELS[plan.periodicity].toLowerCase()}
                      </span>
                    )}
                  </div>

                  {/* Contents */}
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                      Conteúdos incluídos
                    </p>
                    {programContents.length > 0 ? (
                      <ul className="space-y-1.5">
                        {programContents.map((c) => (
                          <li key={c.id} className="flex items-center gap-2 text-sm text-foreground">
                            <BookOpen className="h-3.5 w-3.5 text-gold-dark shrink-0" />
                            <span>{c.program!.title}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Conteúdos em breve.
                      </p>
                    )}

                    {plan.contents.filter((c) => c.module && !c.program).length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        + {plan.contents.filter((c) => c.module).length} módulos avulsos
                      </p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-1.5">
                    <li className="flex items-center gap-2 text-sm text-foreground">
                      <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span>Acesso a aulas e materiais</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm text-foreground">
                      <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span>Avaliações e certificados</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm text-foreground">
                      <Zap className="h-3.5 w-3.5 text-gold-dark shrink-0" />
                      <span>Sistema de XP e conquistas</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm text-foreground">
                      <Star className="h-3.5 w-3.5 text-gold-dark shrink-0" />
                      <span>Ranking e gamificação</span>
                    </li>
                  </ul>

                  {/* CTA */}
                  {isSubscribed ? (
                    <div className="rounded-lg bg-gold/10 border border-gold/20 px-4 py-3 text-center">
                      <p className="text-sm font-medium text-gold-dark">
                        Você já tem acesso a este plano
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-muted/50 border border-border px-4 py-3 text-center">
                      <p className="text-sm text-muted-foreground">
                        Fale com a administração para adquirir este plano
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
