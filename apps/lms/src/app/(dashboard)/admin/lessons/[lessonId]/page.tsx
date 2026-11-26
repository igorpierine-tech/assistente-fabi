"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Loader2,
  Save,
  Video,
  Radio,
  FileText,
  ClipboardCheck,
  Eye,
} from "lucide-react";

interface Lesson {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  type: "VIDEO" | "LIVE" | "TEXT" | "ASSESSMENT";
  videoUrl: string | null;
  videoDuration: number | null;
  liveUrl: string | null;
  liveStartsAt: string | null;
  content: string | null;
  xpReward: number;
  sortOrder: number;
  published: boolean;
  module: {
    id: string;
    title: string;
    programId: string;
    program: { slug: string; title: string };
  };
}

const LESSON_TYPES = [
  { value: "VIDEO", label: "Vídeo", icon: Video },
  { value: "LIVE", label: "Ao Vivo", icon: Radio },
  { value: "TEXT", label: "Texto", icon: FileText },
  { value: "ASSESSMENT", label: "Avaliação", icon: ClipboardCheck },
] as const;

function formatDateTimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditLessonPage() {
  const params = useParams();
  const router = useRouter();
  const lessonId = typeof params.lessonId === "string" ? params.lessonId : "";
  const { tokens } = useAuth();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "VIDEO" as string,
    videoUrl: "",
    videoDuration: "",
    liveUrl: "",
    liveStartsAt: "",
    content: "",
    xpReward: "10",
    published: false,
  });

  const loadLesson = useCallback(async () => {
    if (!tokens || !lessonId) return;
    try {
      const l = await api<Lesson>(`/lessons/${lessonId}`, {
        token: tokens.accessToken,
      });
      setLesson(l);
      setForm({
        title: l.title,
        description: l.description || "",
        type: l.type,
        videoUrl: l.videoUrl || "",
        videoDuration: l.videoDuration ? String(l.videoDuration) : "",
        liveUrl: l.liveUrl || "",
        liveStartsAt: formatDateTimeLocal(l.liveStartsAt),
        content: l.content || "",
        xpReward: String(l.xpReward),
        published: l.published,
      });
    } catch {
      setError("Aula não encontrada.");
    } finally {
      setLoading(false);
    }
  }, [tokens, lessonId]);

  useEffect(() => {
    loadLesson();
  }, [loadLesson]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!tokens || !lessonId) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const body: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        type: form.type,
        xpReward: parseInt(form.xpReward, 10) || 10,
        published: form.published,
      };

      if (form.type === "VIDEO") {
        body.videoUrl = form.videoUrl.trim() || null;
        body.videoDuration = form.videoDuration
          ? parseInt(form.videoDuration, 10)
          : null;
      }
      if (form.type === "LIVE") {
        body.liveUrl = form.liveUrl.trim() || null;
        body.liveStartsAt = form.liveStartsAt || null;
      }
      if (form.type === "TEXT" || form.type === "ASSESSMENT") {
        body.content = form.content.trim() || null;
      }

      await api(`/lessons/${lessonId}`, {
        method: "PATCH",
        token: tokens.accessToken,
        body,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Erro ao salvar aula."
      );
    } finally {
      setSaving(false);
    }
  }

  function update(field: string, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
    setSaved(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center">
        <p className="text-muted-foreground">{error || "Aula não encontrada."}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href={`/admin/programs/${lesson.module.programId}`}
          className="hover:text-gold-dark transition-colors flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          {lesson.module.program.title}
        </Link>
        <span>/</span>
        <span>{lesson.module.title}</span>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-2xl font-semibold text-foreground">
            Editar Aula
          </h1>
          <div className="flex items-center gap-3">
            <Link
              href={`/lessons/${lessonId}`}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gold-dark transition-colors"
            >
              <Eye className="h-4 w-4" />
              Visualizar
            </Link>
            <Button variant="gold" type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {saved ? "Salvo!" : "Salvar"}
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Basic info */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-serif text-lg font-semibold text-foreground">
            Informações Básicas
          </h2>
          <div>
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="description">Descrição</Label>
            <textarea
              id="description"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              rows={3}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Descrição da aula (opcional)"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="type">Tipo</Label>
              <select
                id="type"
                value={form.type}
                onChange={(e) => update("type", e.target.value)}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {LESSON_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="xpReward">XP por conclusão</Label>
              <Input
                id="xpReward"
                type="number"
                min="0"
                value={form.xpReward}
                onChange={(e) => update("xpReward", e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="published"
              checked={form.published}
              onChange={(e) => update("published", e.target.checked)}
              className="h-4 w-4 rounded border-border text-gold focus:ring-gold"
            />
            <Label htmlFor="published" className="cursor-pointer">
              Publicada (visível para alunos)
            </Label>
          </div>
        </div>

        {/* Type-specific content */}
        {form.type === "VIDEO" && (
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h2 className="font-serif text-lg font-semibold text-foreground">
              Configurações de Vídeo
            </h2>
            <div>
              <Label htmlFor="videoUrl">URL do vídeo (embed)</Label>
              <Input
                id="videoUrl"
                value={form.videoUrl}
                onChange={(e) => update("videoUrl", e.target.value)}
                placeholder="https://www.youtube.com/embed/..."
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Use a URL de embed do YouTube, Vimeo ou outra plataforma.
              </p>
            </div>
            <div>
              <Label htmlFor="videoDuration">Duração (segundos)</Label>
              <Input
                id="videoDuration"
                type="number"
                min="0"
                value={form.videoDuration}
                onChange={(e) => update("videoDuration", e.target.value)}
                placeholder="Ex: 600 (10 minutos)"
              />
            </div>
            {form.videoUrl && (
              <div>
                <Label>Preview</Label>
                <div className="mt-2 aspect-video rounded-lg overflow-hidden border border-border bg-black">
                  <iframe
                    src={form.videoUrl}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {form.type === "LIVE" && (
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h2 className="font-serif text-lg font-semibold text-foreground">
              Configurações do Encontro ao Vivo
            </h2>
            <div>
              <Label htmlFor="liveUrl">URL da sala (Zoom, Meet, etc.)</Label>
              <Input
                id="liveUrl"
                value={form.liveUrl}
                onChange={(e) => update("liveUrl", e.target.value)}
                placeholder="https://zoom.us/j/..."
              />
            </div>
            <div>
              <Label htmlFor="liveStartsAt">Data e horário</Label>
              <Input
                id="liveStartsAt"
                type="datetime-local"
                value={form.liveStartsAt}
                onChange={(e) => update("liveStartsAt", e.target.value)}
              />
            </div>
          </div>
        )}

        {(form.type === "TEXT" || form.type === "ASSESSMENT") && (
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h2 className="font-serif text-lg font-semibold text-foreground">
              {form.type === "TEXT" ? "Conteúdo da Aula" : "Conteúdo da Avaliação"}
            </h2>
            <div>
              <Label htmlFor="content">Conteúdo (HTML)</Label>
              <textarea
                id="content"
                value={form.content}
                onChange={(e) => update("content", e.target.value)}
                rows={15}
                className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder={
                  form.type === "TEXT"
                    ? "<h2>Título</h2>\n<p>Conteúdo da aula...</p>"
                    : "<p>Instruções da avaliação...</p>"
                }
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Use HTML para formatar o conteúdo. Tags suportadas: h2, h3, p,
                strong, em, ul, ol, li, a, blockquote.
              </p>
            </div>
            {form.content && (
              <div>
                <Label>Preview</Label>
                <div className="mt-2 rounded-lg border border-border bg-background p-4 prose prose-sm max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: form.content }} />
                </div>
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
