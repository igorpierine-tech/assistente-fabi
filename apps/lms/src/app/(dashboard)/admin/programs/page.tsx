"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Plus,
  Users,
  ChevronRight,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";

interface Program {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  published: boolean;
  _count: { modules: number; enrollments: number };
}

export default function AdminProgramsPage() {
  const { tokens } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!tokens) return;
    api<Program[]>("/programs", { token: tokens.accessToken })
      .then(setPrograms)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [tokens]);

  async function handleDelete(id: string) {
    if (!tokens || !confirm("Tem certeza que deseja excluir este programa?")) return;
    setDeleting(id);
    try {
      await api(`/programs/${id}`, { method: "DELETE", token: tokens.accessToken });
      setPrograms((prev) => prev.filter((p) => p.id !== id));
    } catch {
      alert("Erro ao excluir programa.");
    } finally {
      setDeleting(null);
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
            Gerenciar Programas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie e edite programas de formação, módulos e aulas.
          </p>
        </div>
        <Link href="/admin/programs/new">
          <Button variant="gold">
            <Plus className="mr-2 h-4 w-4" />
            Novo Programa
          </Button>
        </Link>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-10 text-center">
          <p className="text-sm text-red-800">
            Erro ao carregar programas. Tente recarregar a página.
          </p>
        </div>
      ) : programs.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhum programa criado ainda.
          </p>
          <Link href="/admin/programs/new" className="mt-4 inline-block">
            <Button variant="gold" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Criar Primeiro Programa
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {programs.map((p) => (
            <div
              key={p.id}
              className="group flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 hover:border-gold/30 transition-all"
            >
              <Link href={`/admin/programs/${p.id}`} className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold/15">
                    <BookOpen className="h-5 w-5 text-gold-dark" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-medium text-foreground truncate group-hover:text-gold-dark transition-colors">
                      {p.title}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span>{p._count.modules} módulos</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> {p._count.enrollments} alunos
                      </span>
                      <span>·</span>
                      <span className={p.published ? "text-emerald-600" : "text-amber-600"}>
                        {p.published ? "Publicado" : "Rascunho"}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
              <div className="flex items-center gap-2 ml-4">
                <Link href={`/admin/programs/${p.id}`}>
                  <Button variant="ghost" size="sm">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(p.id)}
                  disabled={deleting === p.id}
                  className="text-destructive hover:text-destructive"
                >
                  {deleting === p.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
