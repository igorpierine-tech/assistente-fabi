"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Crown,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Users,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Layers,
  FileText,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

type PlanPeriodicity = "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL" | "LIFETIME";

interface PlanContent {
  id: string;
  programId: string | null;
  moduleId: string | null;
  lessonId: string | null;
  program: { id: string; title: string; slug: string } | null;
  module: { id: string; title: string; slug: string } | null;
  lesson: { id: string; title: string; slug: string } | null;
}

interface Plan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  periodicity: PlanPeriodicity;
  priceInCents: number | null;
  active: boolean;
  sortOrder: number;
  contents: PlanContent[];
  _count: { subscriptions: number };
}

interface Program {
  id: string;
  title: string;
  slug: string;
  modules: {
    id: string;
    title: string;
    slug: string;
    lessons: { id: string; title: string; slug: string }[];
  }[];
}

interface Subscription {
  id: string;
  status: string;
  startsAt: string;
  expiresAt: string | null;
  user: {
    id: string;
    email: string;
    profile: { firstName: string | null; lastName: string | null } | null;
  };
  plan: { id: string; name: string; slug: string };
}

interface UserOption {
  id: string;
  email: string;
  profile: { firstName: string | null; lastName: string | null } | null;
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

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function AdminPlansPage() {
  const { tokens } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [contentPlanId, setContentPlanId] = useState<string | null>(null);
  const [subsPlanId, setSubsPlanId] = useState<string | null>(null);

  const loadPlans = useCallback(async () => {
    if (!tokens) return;
    try {
      const data = await api<Plan[]>("/plans", { token: tokens.accessToken });
      setPlans(data);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [tokens]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  async function handleDelete(id: string) {
    if (!tokens || !confirm("Tem certeza que deseja excluir este plano?")) return;
    setDeleting(id);
    try {
      await api(`/plans/${id}`, { method: "DELETE", token: tokens.accessToken });
      setPlans((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao excluir plano.");
    } finally {
      setDeleting(null);
    }
  }

  function handleEditClick(plan: Plan) {
    setEditingPlan(plan);
    setShowForm(true);
  }

  function handleFormClose() {
    setShowForm(false);
    setEditingPlan(null);
  }

  async function handleFormSaved() {
    handleFormClose();
    await loadPlans();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-foreground">
            Gestão de Planos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie e gerencie planos de acesso, conteúdos vinculados e assinaturas.
          </p>
        </div>
        <Button variant="gold" onClick={() => { setEditingPlan(null); setShowForm(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Plano
        </Button>
      </div>

      {showForm && (
        <PlanForm
          plan={editingPlan}
          token={tokens!.accessToken}
          onSaved={handleFormSaved}
          onCancel={handleFormClose}
        />
      )}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-10 text-center">
          <p className="text-sm text-red-800">
            Erro ao carregar planos. Tente recarregar a página.
          </p>
        </div>
      ) : plans.length === 0 && !showForm ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <Crown className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhum plano criado ainda.
          </p>
          <Button
            variant="gold"
            size="sm"
            className="mt-4"
            onClick={() => setShowForm(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Criar Primeiro Plano
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <div key={plan.id}>
              <div className="group flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 hover:border-gold/30 transition-all">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold/15">
                      <Crown className="h-5 w-5 text-gold-dark" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground truncate">
                          {plan.name}
                        </h3>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            plan.active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {plan.active ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span>{formatPrice(plan.priceInCents)}</span>
                        <span>·</span>
                        <span>{PERIODICITY_LABELS[plan.periodicity]}</span>
                        <span>·</span>
                        <span>{plan.contents.length} conteúdos</span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" /> {plan._count.subscriptions} assinaturas
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setContentPlanId(contentPlanId === plan.id ? null : plan.id)}
                    title="Gerenciar conteúdos"
                  >
                    <BookOpen className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSubsPlanId(subsPlanId === plan.id ? null : plan.id)}
                    title="Gerenciar assinaturas"
                  >
                    <Users className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleEditClick(plan)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(plan.id)}
                    disabled={deleting === plan.id}
                    className="text-destructive hover:text-destructive"
                  >
                    {deleting === plan.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {contentPlanId === plan.id && (
                <ContentManager
                  plan={plan}
                  token={tokens!.accessToken}
                  onUpdated={loadPlans}
                />
              )}

              {subsPlanId === plan.id && (
                <SubscriptionManager
                  plan={plan}
                  token={tokens!.accessToken}
                  onUpdated={loadPlans}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Plan Form ──────────────────────────────────────────────────────────────

function PlanForm({
  plan,
  token,
  onSaved,
  onCancel,
}: {
  plan: Plan | null;
  token: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(plan?.name || "");
  const [slug, setSlug] = useState(plan?.slug || "");
  const [description, setDescription] = useState(plan?.description || "");
  const [periodicity, setPeriodicity] = useState<PlanPeriodicity>(plan?.periodicity || "ANNUAL");
  const [priceInCents, setPriceInCents] = useState(
    plan?.priceInCents !== null && plan?.priceInCents !== undefined
      ? String(plan.priceInCents / 100)
      : ""
  );
  const [active, setActive] = useState(plan?.active ?? true);
  const [sortOrder, setSortOrder] = useState(String(plan?.sortOrder ?? 0));
  const [formError, setFormError] = useState("");

  function autoSlug(val: string) {
    return val
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function handleNameChange(val: string) {
    setName(val);
    if (!plan) setSlug(autoSlug(val));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      setFormError("Nome e slug são obrigatórios.");
      return;
    }
    setFormError("");
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        periodicity,
        priceInCents: priceInCents ? Math.round(parseFloat(priceInCents) * 100) : null,
        active,
        sortOrder: parseInt(sortOrder) || 0,
      };
      if (plan) {
        await api(`/plans/${plan.id}`, { method: "PATCH", body, token });
      } else {
        await api("/plans", { method: "POST", body, token });
      }
      onSaved();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-gold/30 bg-card p-6 space-y-4"
    >
      <h2 className="font-serif text-xl font-semibold text-foreground">
        {plan ? "Editar Plano" : "Novo Plano"}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="plan-name">Nome</Label>
          <Input
            id="plan-name"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Ex: Plano Premium Anual"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="plan-slug">Slug</Label>
          <Input
            id="plan-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="Ex: premium-anual"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="plan-description">Descrição</Label>
        <textarea
          id="plan-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          placeholder="Descrição do plano..."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="plan-periodicity">Periodicidade</Label>
          <select
            id="plan-periodicity"
            value={periodicity}
            onChange={(e) => setPeriodicity(e.target.value as PlanPeriodicity)}
            className="flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {Object.entries(PERIODICITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="plan-price">Preço (R$)</Label>
          <Input
            id="plan-price"
            type="number"
            step="0.01"
            min="0"
            value={priceInCents}
            onChange={(e) => setPriceInCents(e.target.value)}
            placeholder="0,00 = Gratuito"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="plan-sort">Ordem</Label>
          <Input
            id="plan-sort"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="rounded border-input h-4 w-4 accent-gold"
        />
        <span className="text-sm text-foreground">Plano ativo</span>
      </label>

      {formError && (
        <p className="text-sm text-red-600">{formError}</p>
      )}

      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" variant="gold" disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
          {plan ? "Salvar Alterações" : "Criar Plano"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          <X className="mr-2 h-4 w-4" />
          Cancelar
        </Button>
      </div>
    </form>
  );
}

// ─── Content Manager ────────────────────────────────────────────────────────

function ContentManager({
  plan,
  token,
  onUpdated,
}: {
  plan: Plan;
  token: string;
  onUpdated: () => void;
}) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedPrograms, setSelectedPrograms] = useState<Set<string>>(new Set());
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
  const [selectedLessons, setSelectedLessons] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    const currentProgramIds = new Set(plan.contents.filter((c) => c.programId).map((c) => c.programId!));
    const currentModuleIds = new Set(plan.contents.filter((c) => c.moduleId).map((c) => c.moduleId!));
    const currentLessonIds = new Set(plan.contents.filter((c) => c.lessonId).map((c) => c.lessonId!));
    setSelectedPrograms(currentProgramIds);
    setSelectedModules(currentModuleIds);
    setSelectedLessons(currentLessonIds);

    api<Program[]>("/programs/tree", { token })
      .then(setPrograms)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [plan, token]);

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleProgram(id: string) {
    setSelectedPrograms((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleModule(id: string) {
    setSelectedModules((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleLesson(id: string) {
    setSelectedLessons((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api(`/plans/${plan.id}/contents`, {
        method: "PUT",
        token,
        body: {
          programIds: Array.from(selectedPrograms),
          moduleIds: Array.from(selectedModules),
          lessonIds: Array.from(selectedLessons),
        },
      });
      onUpdated();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao salvar conteúdos.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="ml-13 mt-1 rounded-b-xl border border-t-0 border-border bg-card/50 p-6 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="mt-1 rounded-b-xl border border-t-0 border-border bg-card/50 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Conteúdos do Plano
        </h3>
        <Button variant="gold" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Check className="mr-2 h-3 w-3" />}
          Salvar Conteúdos
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Selecione programas inteiros ou módulos/aulas avulsos para incluir neste plano.
        Ao selecionar um programa, todos os seus módulos e aulas ficam inclusos.
      </p>

      {programs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum programa disponível.</p>
      ) : (
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {programs.map((program) => (
            <div key={program.id} className="rounded-lg border border-border">
              <div className="flex items-center gap-2 px-3 py-2">
                <button
                  type="button"
                  onClick={() => toggleExpanded(program.id)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {expanded.has(program.id) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                <input
                  type="checkbox"
                  checked={selectedPrograms.has(program.id)}
                  onChange={() => toggleProgram(program.id)}
                  className="rounded border-input h-4 w-4 accent-gold"
                />
                <BookOpen className="h-4 w-4 text-gold-dark" />
                <span className="text-sm font-medium text-foreground">{program.title}</span>
              </div>

              {expanded.has(program.id) && program.modules && (
                <div className="border-t border-border pl-10 py-2 space-y-1">
                  {program.modules.map((mod) => (
                    <div key={mod.id}>
                      <div className="flex items-center gap-2 px-3 py-1">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(mod.id)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {expanded.has(mod.id) ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                        </button>
                        <input
                          type="checkbox"
                          checked={selectedPrograms.has(program.id) || selectedModules.has(mod.id)}
                          disabled={selectedPrograms.has(program.id)}
                          onChange={() => toggleModule(mod.id)}
                          className="rounded border-input h-3.5 w-3.5 accent-gold"
                        />
                        <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-foreground">{mod.title}</span>
                      </div>

                      {expanded.has(mod.id) && mod.lessons && (
                        <div className="pl-10 py-1 space-y-0.5">
                          {mod.lessons.map((lesson) => (
                            <div key={lesson.id} className="flex items-center gap-2 px-3 py-0.5">
                              <input
                                type="checkbox"
                                checked={
                                  selectedPrograms.has(program.id) ||
                                  selectedModules.has(mod.id) ||
                                  selectedLessons.has(lesson.id)
                                }
                                disabled={selectedPrograms.has(program.id) || selectedModules.has(mod.id)}
                                onChange={() => toggleLesson(lesson.id)}
                                className="rounded border-input h-3.5 w-3.5 accent-gold"
                              />
                              <FileText className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{lesson.title}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Subscription Manager ───────────────────────────────────────────────────

function SubscriptionManager({
  plan,
  token,
  onUpdated,
}: {
  plan: Plan;
  token: string;
  onUpdated: () => void;
}) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [adding, setAdding] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<Subscription[]>(`/plans/subscriptions/all?planId=${plan.id}`, { token }),
      api<UserOption[]>("/tenant/members", { token }).catch(() => []),
    ])
      .then(([subs, userList]) => {
        setSubscriptions(subs);
        setUsers(Array.isArray(userList) ? userList : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [plan.id, token]);

  async function handleAddSubscription() {
    if (!selectedUserId) return;
    setAdding(true);
    try {
      await api("/plans/subscriptions", {
        method: "POST",
        token,
        body: { planId: plan.id, userId: selectedUserId },
      });
      setShowAddForm(false);
      setSelectedUserId("");
      const subs = await api<Subscription[]>(`/plans/subscriptions/all?planId=${plan.id}`, { token });
      setSubscriptions(subs);
      onUpdated();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao criar assinatura.");
    } finally {
      setAdding(false);
    }
  }

  async function handleStatusChange(subId: string, status: string) {
    setUpdating(subId);
    try {
      await api(`/plans/subscriptions/${subId}`, {
        method: "PATCH",
        token,
        body: { status },
      });
      const subs = await api<Subscription[]>(`/plans/subscriptions/all?planId=${plan.id}`, { token });
      setSubscriptions(subs);
      onUpdated();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao atualizar.");
    } finally {
      setUpdating(null);
    }
  }

  function getUserName(user: Subscription["user"]) {
    if (user.profile?.firstName) {
      return `${user.profile.firstName}${user.profile.lastName ? ` ${user.profile.lastName}` : ""}`;
    }
    return user.email;
  }

  const STATUS_COLORS: Record<string, string> = {
    ACTIVE: "bg-emerald-50 text-emerald-700",
    CANCELED: "bg-red-50 text-red-700",
    EXPIRED: "bg-gray-100 text-gray-600",
    PAST_DUE: "bg-amber-50 text-amber-700",
  };

  if (loading) {
    return (
      <div className="mt-1 rounded-b-xl border border-t-0 border-border bg-card/50 p-6 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="mt-1 rounded-b-xl border border-t-0 border-border bg-card/50 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Assinaturas ({subscriptions.length})
        </h3>
        <Button variant="gold" size="sm" onClick={() => setShowAddForm(!showAddForm)}>
          <Plus className="mr-2 h-3 w-3" />
          Adicionar Assinante
        </Button>
      </div>

      {showAddForm && (
        <div className="flex items-end gap-3 p-3 rounded-lg border border-border bg-background">
          <div className="flex-1 space-y-1.5">
            <Label>Selecione o Usuário</Label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Selecione...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.profile?.firstName
                    ? `${u.profile.firstName}${u.profile.lastName ? ` ${u.profile.lastName}` : ""} (${u.email})`
                    : u.email}
                </option>
              ))}
            </select>
          </div>
          <Button
            variant="gold"
            size="sm"
            onClick={handleAddSubscription}
            disabled={adding || !selectedUserId}
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {subscriptions.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhuma assinatura neste plano.
        </p>
      ) : (
        <div className="space-y-2">
          {subscriptions.map((sub) => (
            <div
              key={sub.id}
              className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {getUserName(sub.user)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {sub.user.email} · Desde {new Date(sub.startsAt).toLocaleDateString("pt-BR")}
                  {sub.expiresAt && ` · Expira ${new Date(sub.expiresAt).toLocaleDateString("pt-BR")}`}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[sub.status] || "bg-gray-100 text-gray-600"}`}>
                  {sub.status}
                </span>
                {updating === sub.id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : sub.status === "ACTIVE" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStatusChange(sub.id, "CANCELED")}
                    className="text-destructive hover:text-destructive text-xs"
                  >
                    Cancelar
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStatusChange(sub.id, "ACTIVE")}
                    className="text-emerald-600 hover:text-emerald-700 text-xs"
                  >
                    Reativar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
