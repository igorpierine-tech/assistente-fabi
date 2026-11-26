"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { BookOpen, Users, ChevronRight, Loader2 } from "lucide-react";

interface Program {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  coverUrl: string | null;
  published: boolean;
  _count: { modules: number; enrollments: number };
}

interface Enrollment {
  id: string;
  enrolledAt: string;
  program: Program;
}

export default function ProgramsPage() {
  const { tokens, user } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [allPrograms, setAllPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === "OWNER" || user?.role === "ADMIN" || user?.role === "MENTOR";

  useEffect(() => {
    if (!tokens) return;

    async function load() {
      try {
        const [enrolled, all] = await Promise.all([
          api<Enrollment[]>("/programs/my", { token: tokens!.accessToken }),
          isAdmin
            ? api<Program[]>("/programs", { token: tokens!.accessToken })
            : Promise.resolve([]),
        ]);
        setEnrollments(enrolled);
        setAllPrograms(all);
      } catch {
        // handle silently
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [tokens, isAdmin]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-foreground">Programas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Seus programas de formação executiva.
        </p>
      </div>

      {/* Enrolled programs */}
      {enrollments.length > 0 && (
        <section>
          <h2 className="font-serif text-xl font-semibold text-foreground mb-4">
            Meus Programas
          </h2>
          <div className="grid gap-4">
            {enrollments.map((e) => (
              <Link
                key={e.id}
                href={`/programs/${e.program.slug}`}
                className="group rounded-xl border border-border bg-card p-6 transition-all hover:shadow-md hover:border-gold/30"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gold/15">
                      <BookOpen className="h-6 w-6 text-gold-dark" />
                    </div>
                    <div>
                      <h3 className="font-serif text-lg font-semibold text-foreground group-hover:text-gold-dark transition-colors">
                        {e.program.title}
                      </h3>
                      {e.program.subtitle && (
                        <p className="text-sm text-muted-foreground">{e.program.subtitle}</p>
                      )}
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{e.program._count.modules} módulos</span>
                        <span>·</span>
                        <span>Matriculado em {new Date(e.enrolledAt).toLocaleDateString("pt-BR")}</span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-gold-dark transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {enrollments.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm text-muted-foreground">
            Você ainda não está matriculado em nenhum programa.
          </p>
        </div>
      )}

      {/* Admin: all programs */}
      {isAdmin && allPrograms.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl font-semibold text-foreground">
              Todos os Programas
            </h2>
            <Link
              href="/admin/programs/new"
              className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-primary hover:bg-gold-dark transition-colors"
            >
              + Novo Programa
            </Link>
          </div>
          <div className="grid gap-3">
            {allPrograms.map((p) => (
              <Link
                key={p.id}
                href={`/admin/programs/${p.id}`}
                className="group flex items-center justify-between rounded-lg border border-border bg-card px-5 py-4 hover:border-gold/30 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <h3 className="font-medium text-foreground">{p.title}</h3>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span>{p._count.modules} módulos</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> {p._count.enrollments}
                      </span>
                      <span>·</span>
                      <span className={p.published ? "text-emerald-600" : "text-amber-600"}>
                        {p.published ? "Publicado" : "Rascunho"}
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
