"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "./LoginScreen.module.css";

interface LoginScreenProps {
  onPasswordLogin: (email: string, password: string) => Promise<string | null>;
}

export function LoginScreen({ onPasswordLogin }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError("");
    const err = await onPasswordLogin(email, password);
    if (err) {
      setError(err);
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <section className={styles.hero}>
        <h2 className={styles.brandName}>Raízes e Riquezas</h2>
        <p className={styles.heroDesc}>
          Plataforma de Gestão de Atendimentos
        </p>
        <ul className={styles.features}>
          <li>Agenda integrada ao Google Calendar</li>
          <li>Cadastro e histórico de clientes</li>
          <li>Assistente de IA para agendamentos</li>
          <li>Contratos e gestão financeira</li>
        </ul>
      </section>

      <div className={styles.card}>
        <div className={styles.logoWrap}>
          <Image
            src="/logo-raizes.png"
            alt="Raízes e Riquezas"
            width={220}
            height={220}
            priority
            className={styles.logo}
          />
        </div>

        <h1 className={styles.title}>
          Bem-vindo(a) ao seu
          <br />
          <em>Assistente de Agenda.</em>
        </h1>

        <p className={styles.desc}>
          Sua agenda, seus clientes e um assistente de IA — tudo num só lugar.
        </p>

        <form onSubmit={handleSubmit} className={styles.loginForm}>
          {error && <div className={styles.loginError}>{error}</div>}
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className={styles.loginInput}
            autoComplete="email"
            required
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className={styles.loginInput}
            autoComplete="current-password"
            required
            minLength={6}
          />
          <button className={styles.primaryBtn} type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className={styles.footer}>
          Use as credenciais fornecidas pelo administrador.
        </p>

        <nav className={styles.legalLinks}>
          <a href="/privacidade" target="_blank" rel="noopener noreferrer">
            Política de Privacidade
          </a>
          <span className={styles.legalSep}>|</span>
          <a href="/termos" target="_blank" rel="noopener noreferrer">
            Termos de Serviço
          </a>
        </nav>
      </div>
    </div>
  );
}
