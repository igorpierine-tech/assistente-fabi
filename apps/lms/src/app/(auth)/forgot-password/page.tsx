"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [tenantSlug, setTenantSlug] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api("/auth/forgot-password", {
        method: "POST",
        body: { email, tenantSlug },
      });
    } catch {
      // silent — always show success to avoid user enumeration
    }
    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-mid/10">
          <span className="text-2xl">✉️</span>
        </div>
        <h1 className="font-serif text-2xl font-semibold text-foreground">Verifique seu e-mail</h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          Se o endereço <strong>{email}</strong> estiver cadastrado, enviaremos as
          instruções de recuperação de senha.
        </p>
        <Link href="/login">
          <Button variant="outline" className="mt-8">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao login
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-10 lg:hidden text-center">
        <span className="text-primary font-serif text-3xl font-bold italic">Líder</span>
        <span className="text-gold-dark font-serif text-3xl font-light ml-1">Áurea</span>
      </div>

      <div className="mb-8">
        <h1 className="font-serif text-3xl font-semibold text-foreground">Recuperar senha</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Informe seu e-mail e enviaremos as instruções.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="tenant">Organização</Label>
          <Input
            id="tenant"
            type="text"
            placeholder="slug-da-organizacao"
            value={tenantSlug}
            onChange={(e) => setTenantSlug(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <Button type="submit" variant="gold" size="lg" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Enviar instruções
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-gold-dark hover:text-gold font-medium">
          <ArrowLeft className="inline mr-1 h-3 w-3" /> Voltar ao login
        </Link>
      </p>
    </div>
  );
}
