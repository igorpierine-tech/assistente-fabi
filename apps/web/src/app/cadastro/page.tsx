"use client";

import { useState } from "react";
import styles from "./cadastro.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface CnpjData {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  situacao_cadastral: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone: string;
  email: string;
  atividade_principal: string;
}

function formatCnpj(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export default function CadastroPage() {
  const [step, setStep] = useState<"cnpj" | "form" | "success">("cnpj");
  const [cnpjInput, setCnpjInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [cnpjData, setCnpjData] = useState<CnpjData | null>(null);
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [endereco, setEndereco] = useState("");
  const [cep, setCep] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [uf, setUf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [emailEmpresa, setEmailEmpresa] = useState("");

  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState("");

  async function handleCnpjSearch(e: React.FormEvent) {
    e.preventDefault();
    const clean = cnpjInput.replace(/\D/g, "");
    if (clean.length !== 14) {
      setError("CNPJ deve ter 14 dígitos");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/platform/cnpj/${clean}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao consultar CNPJ");
        setLoading(false);
        return;
      }
      setCnpjData(data);
      setRazaoSocial(data.razao_social);
      setNomeFantasia(data.nome_fantasia || "");
      const addr = [data.logradouro, data.numero, data.complemento, data.bairro]
        .filter(Boolean)
        .join(", ");
      setEndereco(addr);
      setCep(data.cep || "");
      setMunicipio(data.municipio || "");
      setUf(data.uf || "");
      setTelefone(data.telefone || "");
      setEmailEmpresa(data.email || "");
      setStep("form");
    } catch {
      setError("Não foi possível consultar o CNPJ. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (adminPassword !== adminPasswordConfirm) {
      setError("As senhas não coincidem");
      return;
    }
    if (adminPassword.length < 6) {
      setError("Senha deve ter no mínimo 6 caracteres");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/platform/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cnpj: cnpjInput.replace(/\D/g, ""),
          razaoSocial,
          nomeFantasia,
          endereco,
          cep,
          municipio,
          uf,
          telefone,
          emailEmpresa,
          adminName,
          adminEmail,
          adminPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao cadastrar empresa");
        setLoading(false);
        return;
      }
      setStep("success");
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "success") {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.successIcon}>✓</div>
          <h1 className={styles.title}>Empresa cadastrada!</h1>
          <p className={styles.desc}>
            <strong>{nomeFantasia || razaoSocial}</strong> foi cadastrada com sucesso na plataforma.
          </p>
          <p className={styles.desc}>
            Acesse com o e-mail <strong>{adminEmail}</strong> e a senha que você definiu.
          </p>
          <a href="/" className={styles.btnPrimary}>
            Ir para o login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Cadastro de Empresa</h1>
        <p className={styles.subtitle}>
          {step === "cnpj"
            ? "Informe o CNPJ para buscar os dados automaticamente"
            : "Confira os dados e crie o administrador"}
        </p>

        {error && <div className={styles.alert}>{error}</div>}

        {step === "cnpj" && (
          <form onSubmit={handleCnpjSearch}>
            <label className={styles.label}>CNPJ</label>
            <input
              className={styles.input}
              type="text"
              placeholder="00.000.000/0000-00"
              value={formatCnpj(cnpjInput)}
              onChange={(e) => setCnpjInput(e.target.value.replace(/\D/g, ""))}
              maxLength={18}
              autoFocus
            />
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={loading || cnpjInput.replace(/\D/g, "").length !== 14}
            >
              {loading ? "Consultando..." : "Buscar dados"}
            </button>
          </form>
        )}

        {step === "form" && (
          <form onSubmit={handleRegister}>
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Dados da Empresa</h2>

              {cnpjData?.situacao_cadastral && (
                <div className={
                  cnpjData.situacao_cadastral === "ATIVA"
                    ? styles.badgeOk
                    : styles.badgeWarn
                }>
                  Situação: {cnpjData.situacao_cadastral}
                </div>
              )}

              <label className={styles.label}>CNPJ</label>
              <input className={styles.input} value={formatCnpj(cnpjInput)} disabled />

              <label className={styles.label}>Razão Social</label>
              <input
                className={styles.input}
                value={razaoSocial}
                onChange={(e) => setRazaoSocial(e.target.value)}
                required
              />

              <label className={styles.label}>Nome Fantasia</label>
              <input
                className={styles.input}
                value={nomeFantasia}
                onChange={(e) => setNomeFantasia(e.target.value)}
              />

              <div className={styles.row}>
                <div className={styles.flex2}>
                  <label className={styles.label}>Endereço</label>
                  <input
                    className={styles.input}
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                  />
                </div>
                <div className={styles.flex1}>
                  <label className={styles.label}>CEP</label>
                  <input
                    className={styles.input}
                    value={cep}
                    onChange={(e) => setCep(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.row}>
                <div className={styles.flex2}>
                  <label className={styles.label}>Município</label>
                  <input
                    className={styles.input}
                    value={municipio}
                    onChange={(e) => setMunicipio(e.target.value)}
                  />
                </div>
                <div className={styles.flex1}>
                  <label className={styles.label}>UF</label>
                  <input
                    className={styles.input}
                    value={uf}
                    onChange={(e) => setUf(e.target.value)}
                    maxLength={2}
                  />
                </div>
              </div>

              <div className={styles.row}>
                <div className={styles.flex1}>
                  <label className={styles.label}>Telefone</label>
                  <input
                    className={styles.input}
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                  />
                </div>
                <div className={styles.flex1}>
                  <label className={styles.label}>E-mail da empresa</label>
                  <input
                    className={styles.input}
                    type="email"
                    value={emailEmpresa}
                    onChange={(e) => setEmailEmpresa(e.target.value)}
                  />
                </div>
              </div>

              {cnpjData?.atividade_principal && (
                <p className={styles.hint}>
                  Atividade: {cnpjData.atividade_principal}
                </p>
              )}
            </div>

            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Administrador da Conta</h2>

              <label className={styles.label}>Nome completo</label>
              <input
                className={styles.input}
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                required
              />

              <label className={styles.label}>E-mail de acesso</label>
              <input
                className={styles.input}
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                required
              />

              <div className={styles.row}>
                <div className={styles.flex1}>
                  <label className={styles.label}>Senha</label>
                  <input
                    className={styles.input}
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>
                <div className={styles.flex1}>
                  <label className={styles.label}>Confirmar senha</label>
                  <input
                    className={styles.input}
                    type="password"
                    value={adminPasswordConfirm}
                    onChange={(e) => setAdminPasswordConfirm(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>
              </div>
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setStep("cnpj")}
              >
                Voltar
              </button>
              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={loading}
              >
                {loading ? "Cadastrando..." : "Cadastrar empresa"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
