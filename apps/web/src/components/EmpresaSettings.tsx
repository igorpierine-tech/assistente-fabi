"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./NfseSettings.module.css";
import { apiFetch, API_URL } from "@/lib/api";

interface EmpresaData {
  razaoSocial: string;
  cnpj: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  endereco: string;
  cep: string;
  telefone: string;
  email: string;
  representanteQualificacao: string;
}

const emptyData: EmpresaData = {
  razaoSocial: "",
  cnpj: "",
  inscricaoEstadual: "",
  inscricaoMunicipal: "",
  endereco: "",
  cep: "",
  telefone: "",
  email: "",
  representanteQualificacao: "",
};

export function EmpresaSettings() {
  const [form, setForm] = useState<EmpresaData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [cnpjLoading, setCnpjLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await apiFetch("/tenant/empresa");
      if (res.ok) {
        const data: EmpresaData = await res.json();
        setForm(data);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleCnpjLookup() {
    const clean = form.cnpj.replace(/\D/g, "");
    if (clean.length !== 14) {
      setMessage({ type: "error", text: "CNPJ deve ter 14 dígitos" });
      return;
    }
    setCnpjLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/platform/cnpj/${clean}`);
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Erro ao consultar CNPJ" });
        setCnpjLoading(false);
        return;
      }
      const addr = [data.logradouro, data.numero, data.complemento, data.bairro].filter(Boolean).join(", ");
      const municipioUf = data.municipio && data.uf ? `${data.municipio}/${data.uf}` : "";
      const fullAddr = [addr, municipioUf].filter(Boolean).join(" — ");
      setForm(f => ({
        ...f,
        razaoSocial: data.razao_social || f.razaoSocial,
        cnpj: data.cnpj ? data.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : f.cnpj,
        endereco: fullAddr || f.endereco,
        cep: data.cep || f.cep,
        telefone: data.telefone || f.telefone,
        email: data.email || f.email,
      }));
      setMessage({ type: "success", text: "Dados preenchidos. Revise e clique em Salvar." });
    } catch {
      setMessage({ type: "error", text: "Não foi possível consultar o CNPJ" });
    }
    setCnpjLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await apiFetch("/tenant/empresa", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Dados da empresa salvos com sucesso" });
        await fetchData();
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage({ type: "error", text: data.error || "Erro ao salvar" });
      }
    } catch {
      setMessage({ type: "error", text: "Erro de conexão" });
    }
    setSaving(false);
  }

  if (loading) return <div className={styles.wrap}>Carregando...</div>;

  const isComplete = !!(form.razaoSocial && form.cnpj && form.inscricaoMunicipal && form.endereco && form.cep);

  return (
    <div className={styles.wrap}>
      <h3 className={styles.heading}>Dados da Empresa</h3>
      <p className={styles.desc}>
        Dados cadastrais da empresa prestadora de serviços. Essas informações são utilizadas
        na emissão de NFS-e, contratos e demais documentos fiscais.
      </p>

      <div className={`${styles.statusBadge} ${isComplete ? styles.statusOk : styles.statusPending}`}>
        <span>{isComplete ? "Completo" : "Incompleto — preencha os campos obrigatórios"}</span>
      </div>

      {message && (
        <div className={`${styles.alert} ${message.type === "success" ? styles.alertSuccess : styles.alertError}`}>
          {message.text}
        </div>
      )}

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Identificação</h4>
        <div className={styles.fieldGrid}>
          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label>CNPJ *</label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                value={form.cnpj}
                onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={handleCnpjLookup}
                disabled={cnpjLoading}
                style={{ whiteSpace: "nowrap" }}
              >
                {cnpjLoading ? "..." : "Buscar"}
              </button>
            </div>
          </div>
          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label>Razão Social *</label>
            <input
              type="text"
              value={form.razaoSocial}
              onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })}
              placeholder="Razão social conforme CNPJ"
            />
          </div>
          <div className={styles.field}>
            <label>Inscrição Municipal *</label>
            <input
              type="text"
              value={form.inscricaoMunicipal}
              onChange={(e) => setForm({ ...form, inscricaoMunicipal: e.target.value })}
              placeholder="Número da IM"
            />
          </div>
          <div className={styles.field}>
            <label>Inscrição Estadual</label>
            <input
              type="text"
              value={form.inscricaoEstadual}
              onChange={(e) => setForm({ ...form, inscricaoEstadual: e.target.value })}
              placeholder="ISENTO ou número"
            />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Endereço</h4>
        <div className={styles.fieldGrid}>
          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label>Endereço completo *</label>
            <input
              type="text"
              value={form.endereco}
              onChange={(e) => setForm({ ...form, endereco: e.target.value })}
              placeholder="Rua, número, bairro — Cidade/UF"
            />
          </div>
          <div className={styles.field}>
            <label>CEP *</label>
            <input
              type="text"
              value={form.cep}
              onChange={(e) => setForm({ ...form, cep: e.target.value })}
              placeholder="00000-000"
              maxLength={10}
            />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Contato</h4>
        <div className={styles.fieldGrid}>
          <div className={styles.field}>
            <label>Telefone</label>
            <input
              type="text"
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              placeholder="(00) 00000-0000"
            />
          </div>
          <div className={styles.field}>
            <label>E-mail comercial</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="empresa@email.com"
            />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Representante legal</h4>
        <div className={styles.fieldGrid}>
          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label>Qualificação do representante</label>
            <input
              type="text"
              value={form.representanteQualificacao}
              onChange={(e) => setForm({ ...form, representanteQualificacao: e.target.value })}
              placeholder="Ex: Sócio-administrador, brasileiro, CPF 000.000.000-00"
            />
          </div>
        </div>
      </div>

      <div className={styles.btnRow}>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={handleSave}
          disabled={saving}
          type="button"
        >
          {saving ? "Salvando..." : "Salvar dados da empresa"}
        </button>
      </div>
    </div>
  );
}
