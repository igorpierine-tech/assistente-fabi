"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Users,
  Plus,
  Loader2,
  Mail,
  Shield,
  Trash2,
  X,
} from "lucide-react";

interface Member {
  id: string;
  email: string;
  role: string;
  emailVerified: boolean;
  createdAt: string;
  profile: {
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  } | null;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Proprietário",
  ADMIN: "Administrador",
  MENTOR: "Mentor",
  STUDENT: "Aluno",
};

const ROLE_COLORS: Record<string, string> = {
  OWNER: "bg-amber-100 text-amber-800",
  ADMIN: "bg-blue-100 text-blue-800",
  MENTOR: "bg-purple-100 text-purple-800",
  STUDENT: "bg-gray-100 text-gray-700",
};

const ASSIGNABLE_ROLES = ["ADMIN", "MENTOR", "STUDENT"] as const;

export default function UsersPage() {
  const { tokens, user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    role: "STUDENT" as string,
  });

  const canManage = user?.role === "OWNER" || user?.role === "ADMIN";
  const isOwner = user?.role === "OWNER";

  const loadMembers = useCallback(async () => {
    if (!tokens) return;
    try {
      const data = await api<Member[]>("/tenant/members", {
        token: tokens.accessToken,
      });
      setMembers(data);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [tokens]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!tokens) return;
    setInviting(true);
    setInviteError("");
    try {
      await api("/tenant/members", {
        method: "POST",
        token: tokens.accessToken,
        body: {
          email: form.email.trim(),
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          role: form.role,
        },
      });
      setForm({ email: "", firstName: "", lastName: "", role: "STUDENT" });
      setShowInvite(false);
      await loadMembers();
    } catch (err) {
      setInviteError(
        err instanceof ApiError ? err.message : "Erro ao convidar membro."
      );
    } finally {
      setInviting(false);
    }
  }

  async function handleDelete(memberId: string) {
    if (!tokens || !confirm("Tem certeza que deseja remover este membro?"))
      return;
    setDeleting(memberId);
    try {
      await api(`/tenant/members/${memberId}`, {
        method: "DELETE",
        token: tokens.accessToken,
      });
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err) {
      alert(
        err instanceof ApiError ? err.message : "Erro ao remover membro."
      );
    } finally {
      setDeleting(null);
    }
  }

  async function handleRoleChange(memberId: string, newRole: string) {
    if (!tokens) return;
    setChangingRole(memberId);
    try {
      await api(`/tenant/members/${memberId}/role`, {
        method: "PATCH",
        token: tokens.accessToken,
        body: { role: newRole },
      });
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      );
    } catch (err) {
      alert(
        err instanceof ApiError
          ? err.message
          : "Erro ao alterar função do membro."
      );
    } finally {
      setChangingRole(null);
    }
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
            Usuários
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie os membros da sua organização.
          </p>
        </div>
        {canManage && (
          <Button variant="gold" onClick={() => setShowInvite(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Convidar Membro
          </Button>
        )}
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div className="rounded-xl border border-gold/30 bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold text-foreground">
              Convidar Novo Membro
            </h2>
            <button
              onClick={() => setShowInvite(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={handleInvite} className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="firstName">Nome</Label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={(e) =>
                  setForm((p) => ({ ...p, firstName: e.target.value }))
                }
                placeholder="Nome"
                required
              />
            </div>
            <div>
              <Label htmlFor="lastName">Sobrenome</Label>
              <Input
                id="lastName"
                value={form.lastName}
                onChange={(e) =>
                  setForm((p) => ({ ...p, lastName: e.target.value }))
                }
                placeholder="Sobrenome"
                required
              />
            </div>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((p) => ({ ...p, email: e.target.value }))
                }
                placeholder="email@exemplo.com"
                required
              />
            </div>
            <div>
              <Label htmlFor="role">Função</Label>
              <select
                id="role"
                value={form.role}
                onChange={(e) =>
                  setForm((p) => ({ ...p, role: e.target.value }))
                }
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            {inviteError && (
              <p className="text-sm text-destructive sm:col-span-2">
                {inviteError}
              </p>
            )}
            <div className="sm:col-span-2 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowInvite(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="gold" disabled={inviting}>
                {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Convidar
              </Button>
            </div>
          </form>
        </div>
      )}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-10 text-center">
          <p className="text-sm text-red-800">
            Erro ao carregar membros. Tente recarregar a página.
          </p>
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhum membro encontrado.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((m) => {
            const name = m.profile
              ? `${m.profile.firstName} ${m.profile.lastName}`
              : m.email;
            const initials = m.profile
              ? `${m.profile.firstName[0] || ""}${m.profile.lastName[0] || ""}`
              : m.email[0]?.toUpperCase() || "?";
            const isSelf = m.id === user?.id;
            const isMemberOwner = m.role === "OWNER";

            return (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 hover:border-gold/30 transition-all"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/15 font-medium text-gold-dark text-sm">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {m.email}
                      </span>
                      {!m.emailVerified && (
                        <span className="text-xs text-amber-600">
                          (pendente)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 ml-4 shrink-0">
                  {isOwner && !isSelf && !isMemberOwner ? (
                    <select
                      value={m.role}
                      onChange={(e) =>
                        handleRoleChange(m.id, e.target.value)
                      }
                      disabled={changingRole === m.id}
                      className="rounded-full border border-input bg-background px-3 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                        ROLE_COLORS[m.role] || ROLE_COLORS.STUDENT
                      }`}
                    >
                      <Shield className="h-3 w-3" />
                      {ROLE_LABELS[m.role] || m.role}
                    </span>
                  )}

                  {canManage && !isSelf && !isMemberOwner && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(m.id)}
                      disabled={deleting === m.id}
                      className="text-destructive hover:text-destructive"
                    >
                      {deleting === m.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
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
