"use client";

import Image from "next/image";
import styles from "./LoginScreen.module.css";

interface LoginScreenProps {
  onLogin: () => void;
  onDemo: () => void;
}

export function LoginScreen({ onLogin, onDemo }: LoginScreenProps) {
  return (
    <div className={styles.container}>
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
          Bem-vinda,
          <br />
          <em>Fabiana.</em>
        </h1>

        <p className={styles.desc}>
          Sua agenda, seus clientes e um assistente de IA — tudo num só lugar,
          com uma linguagem quente e enraizada.
        </p>

        <button className={styles.primaryBtn} onClick={onLogin} type="button">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path
              d="M19.6 10.23c0-.68-.06-1.36-.18-2.02H10v3.83h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.89-1.74 2.98-4.3 2.98-7.33Z"
              fill="#4285F4"
            />
            <path
              d="M10 20c2.7 0 4.96-.89 6.62-2.42l-3.24-2.51c-.9.6-2.04.95-3.38.95-2.6 0-4.8-1.76-5.58-4.12H1.07v2.6A9.99 9.99 0 0 0 10 20Z"
              fill="#34A853"
            />
            <path
              d="M4.42 11.9a6.02 6.02 0 0 1 0-3.8V5.5H1.07a9.99 9.99 0 0 0 0 9l3.35-2.6Z"
              fill="#FBBC05"
            />
            <path
              d="M10 3.98a5.42 5.42 0 0 1 3.84 1.5l2.88-2.87A9.64 9.64 0 0 0 10 0 9.99 9.99 0 0 0 1.07 5.5l3.35 2.6C5.2 5.74 7.4 3.98 10 3.98Z"
              fill="#EA4335"
            />
          </svg>
          Entrar com Google
        </button>

        <button className={styles.secondaryBtn} onClick={onDemo} type="button">
          Explorar modo demonstração
        </button>

        <p className={styles.footer}>
          Conecte sua conta Google para acessar seu Calendar, ou explore a
          interface no modo demonstração.
        </p>
      </div>
    </div>
  );
}
