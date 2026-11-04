"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./NfseSettings.module.css";
import { apiFetch } from "@/lib/api";

interface NfseConfig {
  codigoMunicipio: string | null;
  codigoTributacaoNacional: string | null;
  aliquotaIss: number | null;
  itemListaServico: string | null;
  regimeEspecial: number | null;
  optanteSimples: number | null;
  ambiente: string;
  certificateLoaded: boolean;
  cnpj: string | null;
  inscricaoMunicipal: string | null;
}

export function NfseSettings() {
  const [config, setConfig] = useState<NfseConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [certPassword, setCertPassword] = useState("");
  const [uploadingCert, setUploadingCert] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    codigoMunicipio: "",
    codigoTributacaoNacional: "",
    aliquotaIss: "",
    itemListaServico: "",
    regimeEspecial: "",
    optanteSimples: "1",
    ambiente: "homologacao",
  });

  const fetchConfig = useCallback(async () => {
    try {
      const res = await apiFetch("/nfse/config");
      if (res.ok) {
        const data: NfseConfig = await res.json();
        setConfig(data);
        setForm({
          codigoMunicipio: data.codigoMunicipio || "",
          codigoTributacaoNacional: data.codigoTributacaoNacional || "",
          aliquotaIss: data.aliquotaIss != null ? String(data.aliquotaIss) : "",
          itemListaServico: data.itemListaServico || "",
          regimeEspecial: data.regimeEspecial != null ? String(data.regimeEspecial) : "",
          optanteSimples: String(data.optanteSimples ?? 1),
          ambiente: data.ambiente || "homologacao",
        });
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await apiFetch("/nfse/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigoMunicipio: form.codigoMunicipio || null,
          codigoTributacaoNacional: form.codigoTributacaoNacional || null,
          aliquotaIss: form.aliquotaIss ? parseFloat(form.aliquotaIss) : null,
          itemListaServico: form.itemListaServico || null,
          regimeEspecial: form.regimeEspecial ? parseInt(form.regimeEspecial) : null,
          optanteSimples: parseInt(form.optanteSimples) || 1,
          ambiente: form.ambiente,
        }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Configuracao salva com sucesso" });
        await fetchConfig();
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage({ type: "error", text: data.error || "Erro ao salvar" });
      }
    } catch {
      setMessage({ type: "error", text: "Erro de conexao" });
    }
    setSaving(false);
  }

  async function handleCertUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !certPassword) return;

    setUploadingCert(true);
    setMessage(null);

    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), "")
      );

      const res = await apiFetch("/nfse/certificate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          certificateBase64: base64,
          password: certPassword,
        }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Certificado salvo com sucesso" });
        setCertPassword("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        await fetchConfig();
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage({ type: "error", text: data.error || "Erro ao salvar certificado" });
      }
    } catch {
      setMessage({ type: "error", text: "Erro ao enviar certificado" });
    }
    setUploadingCert(false);
  }

  async function handleRemoveCert() {
    if (!confirm("Remover o certificado digital?")) return;
    try {
      await apiFetch("/nfse/certificate", { method: "DELETE" });
      setMessage({ type: "success", text: "Certificado removido" });
      await fetchConfig();
    } catch {}
  }

  if (loading) return <div className={styles.wrap}>Carregando...</div>;

  const isConfigured = !!(
    form.codigoMunicipio &&
    form.codigoTributacaoNacional &&
    form.itemListaServico &&
    form.aliquotaIss &&
    config?.certificateLoaded
  );

  return (
    <div className={styles.wrap}>
      <h3 className={styles.heading}>NFS-e Nacional</h3>
      <p className={styles.desc}>
        Configure a emissao de Nota Fiscal de Servico Eletronica pelo Portal Nacional.
        Rondonopolis/MT utiliza o sistema nacional unificado.
      </p>

      <div className={`${styles.statusBadge} ${isConfigured ? styles.statusOk : styles.statusPending}`}>
        <span>{isConfigured ? "Configurado" : "Pendente"}</span>
      </div>

      {message && (
        <div className={`${styles.alert} ${message.type === "success" ? styles.alertSuccess : styles.alertError}`}>
          {message.text}
        </div>
      )}

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Dados fiscais</h4>
        <p className={styles.desc}>
          CNPJ: {config?.cnpj || "Nao configurado"} | IM: {config?.inscricaoMunicipal || "Nao configurada"}
          {" "}(edite em Configuracoes &gt; Empresa)
        </p>
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Parametros de emissao</h4>
        <div className={styles.fieldGrid}>
          <div className={styles.field}>
            <label>Codigo municipio (IBGE)</label>
            <input
              type="text"
              value={form.codigoMunicipio}
              onChange={(e) => setForm({ ...form, codigoMunicipio: e.target.value })}
              placeholder="5107602"
              maxLength={7}
            />
          </div>
          <div className={styles.field}>
            <label>Codigo tributacao nacional</label>
            <input
              type="text"
              value={form.codigoTributacaoNacional}
              onChange={(e) => setForm({ ...form, codigoTributacaoNacional: e.target.value })}
              placeholder="010601"
            />
          </div>
          <div className={styles.field}>
            <label>Item lista servico (LC 116)</label>
            <input
              type="text"
              value={form.itemListaServico}
              onChange={(e) => setForm({ ...form, itemListaServico: e.target.value })}
              placeholder="17.01"
            />
          </div>
          <div className={styles.field}>
            <label>Aliquota ISS (decimal)</label>
            <input
              type="text"
              value={form.aliquotaIss}
              onChange={(e) => setForm({ ...form, aliquotaIss: e.target.value })}
              placeholder="0.05"
            />
          </div>
          <div className={styles.field}>
            <label>Optante Simples Nacional</label>
            <select
              value={form.optanteSimples}
              onChange={(e) => setForm({ ...form, optanteSimples: e.target.value })}
            >
              <option value="1">Nao optante</option>
              <option value="2">MEI</option>
              <option value="3">ME/EPP</option>
            </select>
          </div>
          <div className={styles.field}>
            <label>Regime especial</label>
            <input
              type="text"
              value={form.regimeEspecial}
              onChange={(e) => setForm({ ...form, regimeEspecial: e.target.value })}
              placeholder="(opcional)"
            />
          </div>
          <div className={styles.field}>
            <label>Ambiente</label>
            <select
              value={form.ambiente}
              onChange={(e) => setForm({ ...form, ambiente: e.target.value })}
            >
              <option value="homologacao">Homologacao (testes)</option>
              <option value="producao">Producao</option>
            </select>
          </div>
        </div>
        <div className={styles.btnRow}>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handleSave}
            disabled={saving}
            type="button"
          >
            {saving ? "Salvando..." : "Salvar parametros"}
          </button>
        </div>
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Certificado digital A1</h4>
        <p className={styles.desc}>
          Envie o arquivo .pfx do certificado digital ICP-Brasil A1 para autenticacao com o Portal Nacional.
        </p>
        {config?.certificateLoaded ? (
          <div>
            <p className={`${styles.certInfo} ${styles.certLoaded}`}>
              Certificado carregado
            </p>
            <div className={styles.btnRow}>
              <button
                className={`${styles.btn} ${styles.btnDanger}`}
                onClick={handleRemoveCert}
                type="button"
              >
                Remover certificado
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className={styles.fieldGrid}>
              <div className={`${styles.field} ${styles.fieldFull}`}>
                <label>Arquivo .pfx</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pfx,.p12"
                  className={styles.field}
                />
              </div>
              <div className={styles.field}>
                <label>Senha do certificado</label>
                <input
                  type="password"
                  value={certPassword}
                  onChange={(e) => setCertPassword(e.target.value)}
                  placeholder="Senha do .pfx"
                />
              </div>
            </div>
            <div className={styles.btnRow}>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={handleCertUpload}
                disabled={uploadingCert || !certPassword}
                type="button"
              >
                {uploadingCert ? "Enviando..." : "Enviar certificado"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
