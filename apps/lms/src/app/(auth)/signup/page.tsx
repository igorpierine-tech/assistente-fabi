"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    lgpdConsent: false,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.lgpdConsent) {
      setError("Você precisa aceitar os termos para continuar.");
      return;
    }

    setLoading(true);
    try {
      await signup(form);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Erro ao criar conta. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-10 lg:hidden text-center">
        <span className="text-primary font-serif text-3xl font-bold italic">Líder</span>
        <span className="text-gold-dark font-serif text-3xl font-light ml-1">Áurea</span>
      </div>

      <div className="mb-8">
        <h1 className="font-serif text-3xl font-semibold text-foreground">Criar conta</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Comece sua jornada de formação executiva.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="firstName">Nome</Label>
            <Input
              id="firstName"
              placeholder="Maria"
              value={form.firstName}
              onChange={(e) => update("firstName", e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Sobrenome</Label>
            <Input
              id="lastName"
              placeholder="Executiva"
              value={form.lastName}
              onChange={(e) => update("lastName", e.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            placeholder="seu@email.com"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            placeholder="Mín. 8 caracteres, maiúscula + número"
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.lgpdConsent}
            onChange={(e) => update("lgpdConsent", e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-input text-primary accent-gold focus:ring-ring"
          />
          <span className="text-xs text-muted-foreground leading-relaxed">
            Li e aceito os{" "}
            <Link href="/terms" className="text-gold-dark underline">
              Termos de Uso
            </Link>{" "}
            e a{" "}
            <Link href="/privacy" className="text-gold-dark underline">
              Política de Privacidade
            </Link>
            , incluindo o tratamento dos meus dados pessoais conforme a LGPD.
          </span>
        </label>

        <Button type="submit" variant="gold" size="lg" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Criar conta
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href="/login" className="text-gold-dark hover:text-gold font-medium">
          Entrar
        </Link>
      </p>
    </div>
  );
}
