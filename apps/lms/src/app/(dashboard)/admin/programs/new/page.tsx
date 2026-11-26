"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function NewProgramPage() {
  const router = useRouter();
  const { tokens } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    subtitle: "",
    description: "",
    published: false,
  });

  function update(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tokens || !form.title.trim()) return;
    setSaving(true);
    setError("");
    try {
      const created = await api<{ id: string }>("/programs", {
        method: "POST",
        token: tokens.accessToken,
        body: {
          title: form.title.trim(),
          subtitle: form.subtitle.trim() || undefined,
          description: form.description.trim() || undefined,
          published: form.published,
        },
      });
      router.push(`/admin/programs/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar programa.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/programs"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-gold-dark transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
      </div>

      <div>
        <h1 className="font-serif text-2xl font-semibold text-foreground">
          Novo Programa
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Preencha os dados básicos do programa. Depois você poderá adicionar módulos e aulas.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div>
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="Ex: Mentoria Líder Áurea"
              required
            />
          </div>

          <div>
            <Label htmlFor="subtitle">Subtítulo</Label>
            <Input
              id="subtitle"
              value={form.subtitle}
              onChange={(e) => update("subtitle", e.target.value)}
              placeholder="Ex: Programa de Liderança Executiva"
            />
          </div>

          <div>
            <Label htmlFor="description">Descrição</Label>
            <textarea
              id="description"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              rows={4}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Descreva o programa..."
            />
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
              Publicar imediatamente
            </Label>
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <div className="flex justify-end gap-3">
          <Link href="/admin/programs">
            <Button variant="outline" type="button">Cancelar</Button>
          </Link>
          <Button variant="gold" type="submit" disabled={saving || !form.title.trim()}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar Programa
          </Button>
        </div>
      </form>
    </div>
  );
}
