"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Video,
  Radio,
  FileText,
  ClipboardCheck,
  Save,
} from "lucide-react";

interface Lesson {
  id: string;
  title: string;
  type: "VIDEO" | "LIVE" | "TEXT" | "ASSESSMENT";
  sortOrder: number;
  xpReward: number;
}

interface Module {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  lessons: Lesson[];
}

interface Program {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  published: boolean;
  modules: Module[];
}

const LESSON_TYPES = [
  { value: "VIDEO", label: "Vídeo", icon: Video },
  { value: "LIVE", label: "Ao Vivo", icon: Radio },
  { value: "TEXT", label: "Texto", icon: FileText },
  { value: "ASSESSMENT", label: "Avaliação", icon: ClipboardCheck },
];

export default function EditProgramPage() {
  const params = useParams();
  const router = useRouter();
  const programId = typeof params.id === "string" ? params.id : "";
  const { tokens } = useAuth();

  const [program, setProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    subtitle: "",
    description: "",
    published: false,
  });

  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [addingModule, setAddingModule] = useState(false);

  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [newLessonType, setNewLessonType] = useState("VIDEO");
  const [addingLessonFor, setAddingLessonFor] = useState<string | null>(null);
  const [savingLesson, setSavingLesson] = useState(false);

  const loadProgram = useCallback(async () => {
    if (!tokens || !programId) return;
    try {
      const p = await api<Program>(`/programs/${programId}/admin`, {
        token: tokens.accessToken,
      });
      setProgram(p);
      setForm({
        title: p.title,
        subtitle: p.subtitle || "",
        description: p.description || "",
        published: p.published,
      });
      if (p.modules.length > 0 && !expandedModule) {
        setExpandedModule(p.modules[0].id);
      }
    } catch {
      // handle
    } finally {
      setLoading(false);
    }
  }, [tokens, programId]);

  useEffect(() => {
    loadProgram();
  }, [loadProgram]);

  async function handleSaveProgram(e: React.FormEvent) {
    e.preventDefault();
    if (!tokens || !programId) return;
    setSaving(true);
    setError("");
    try {
      await api(`/programs/${programId}`, {
        method: "PATCH",
        token: tokens.accessToken,
        body: {
          title: form.title.trim(),
          subtitle: form.subtitle.trim() || null,
          description: form.description.trim() || null,
          published: form.published,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddModule() {
    if (!tokens || !programId || !newModuleTitle.trim()) return;
    setAddingModule(true);
    try {
      await api(`/programs/${programId}/modules`, {
        method: "POST",
        token: tokens.accessToken,
        body: { title: newModuleTitle.trim() },
      });
      setNewModuleTitle("");
      await loadProgram();
    } catch {
      alert("Erro ao criar módulo.");
    } finally {
      setAddingModule(false);
    }
  }

  async function handleDeleteModule(moduleId: string) {
    if (!tokens || !confirm("Excluir este módulo e todas as suas aulas?")) return;
    try {
      await api(`/programs/${programId}/modules/${moduleId}`, {
        method: "DELETE",
        token: tokens.accessToken,
      });
      await loadProgram();
    } catch {
      alert("Erro ao excluir módulo.");
    }
  }

  async function handleAddLesson(moduleId: string) {
    if (!tokens || !newLessonTitle.trim()) return;
    setSavingLesson(true);
    try {
      await api(`/lessons/program/${programId}/module/${moduleId}`, {
        method: "POST",
        token: tokens.accessToken,
        body: {
          title: newLessonTitle.trim(),
          type: newLessonType,
        },
      });
      setNewLessonTitle("");
      setAddingLessonFor(null);
      await loadProgram();
    } catch {
      alert("Erro ao criar aula.");
    } finally {
      setSavingLesson(false);
    }
  }

  async function handleDeleteLesson(lessonId: string) {
    if (!tokens || !confirm("Excluir esta aula?")) return;
    try {
      await api(`/lessons/${lessonId}`, {
        method: "DELETE",
        token: tokens.accessToken,
      });
      await loadProgram();
    } catch {
      alert("Erro ao excluir aula.");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  if (!program) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center">
        <p className="text-muted-foreground">Programa não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/programs"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-gold-dark transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
      </div>

      {/* Program details */}
      <form onSubmit={handleSaveProgram} className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-2xl font-semibold text-foreground">
            Editar Programa
          </h1>
          <Button variant="gold" type="submit" disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div>
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
          </div>
          <div>
            <Label htmlFor="subtitle">Subtítulo</Label>
            <Input
              id="subtitle"
              value={form.subtitle}
              onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="description">Descrição</Label>
            <textarea
              id="description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="published"
              checked={form.published}
              onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))}
              className="h-4 w-4 rounded border-border text-gold focus:ring-gold"
            />
            <Label htmlFor="published" className="cursor-pointer">
              Publicado
            </Label>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </form>

      {/* Modules */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold text-foreground">Módulos</h2>
        </div>

        {program.modules.map((mod) => {
          const isExpanded = expandedModule === mod.id;
          return (
            <div
              key={mod.id}
              className="rounded-xl border border-border bg-card overflow-hidden"
            >
              {/* Module header */}
              <div
                className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setExpandedModule(isExpanded ? null : mod.id)}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground">{mod.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {mod.lessons.length} aula{mod.lessons.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteModule(mod.id);
                  }}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>

              {/* Lessons */}
              {isExpanded && (
                <div className="border-t border-border">
                  {mod.lessons.length > 0 && (
                    <div className="divide-y divide-border">
                      {mod.lessons.map((lesson) => {
                        const typeInfo = LESSON_TYPES.find((t) => t.value === lesson.type);
                        const Icon = typeInfo?.icon || Video;
                        return (
                          <div
                            key={lesson.id}
                            className="flex items-center gap-3 px-5 py-3 pl-12"
                          >
                            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                            <Link
                              href={`/admin/lessons/${lesson.id}`}
                              className="flex-1 min-w-0 group"
                            >
                              <p className="text-sm font-medium text-foreground truncate group-hover:text-gold-dark transition-colors">
                                {lesson.title}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {typeInfo?.label} · {lesson.xpReward} XP
                              </p>
                            </Link>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteLesson(lesson.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add lesson form */}
                  {addingLessonFor === mod.id ? (
                    <div className="border-t border-border px-5 py-4 space-y-3 bg-muted/30">
                      <div className="flex gap-3">
                        <Input
                          value={newLessonTitle}
                          onChange={(e) => setNewLessonTitle(e.target.value)}
                          placeholder="Título da aula"
                          className="flex-1"
                          autoFocus
                        />
                        <select
                          value={newLessonType}
                          onChange={(e) => setNewLessonType(e.target.value)}
                          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                        >
                          {LESSON_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setAddingLessonFor(null)}
                        >
                          Cancelar
                        </Button>
                        <Button
                          variant="gold"
                          size="sm"
                          onClick={() => handleAddLesson(mod.id)}
                          disabled={savingLesson || !newLessonTitle.trim()}
                        >
                          {savingLesson && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                          Adicionar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-t border-border px-5 py-3">
                      <button
                        onClick={() => {
                          setAddingLessonFor(mod.id);
                          setNewLessonTitle("");
                          setNewLessonType("VIDEO");
                        }}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-gold-dark transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                        Adicionar Aula
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Add module */}
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-5">
          <div className="flex gap-3">
            <Input
              value={newModuleTitle}
              onChange={(e) => setNewModuleTitle(e.target.value)}
              placeholder="Nome do novo módulo"
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleAddModule()}
            />
            <Button
              variant="gold"
              onClick={handleAddModule}
              disabled={addingModule || !newModuleTitle.trim()}
            >
              {addingModule ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Adicionar Módulo
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
