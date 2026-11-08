"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import styles from "./NfseSettings.module.css";
import { apiFetch, API_URL } from "@/lib/api";

interface BrandingData {
  businessName: string;
  tagline: string;
  logoUrl: string | null;
  colors: { primary: string; secondary: string; accent: string };
  fonts: { heading: string; body: string };
}

const FONT_OPTIONS = [
  { label: "Instrument Serif", value: "'Instrument Serif', serif" },
  { label: "Playfair Display", value: "'Playfair Display', serif" },
  { label: "Lora", value: "'Lora', serif" },
  { label: "Merriweather", value: "'Merriweather', serif" },
  { label: "Inter", value: "'Inter', sans-serif" },
  { label: "Poppins", value: "'Poppins', sans-serif" },
  { label: "Roboto", value: "'Roboto', sans-serif" },
  { label: "Open Sans", value: "'Open Sans', sans-serif" },
  { label: "Montserrat", value: "'Montserrat', sans-serif" },
];

export function BrandingSettings() {
  const [form, setForm] = useState<BrandingData>({
    businessName: "",
    tagline: "",
    logoUrl: null,
    colors: { primary: "#1a2e18", secondary: "#b8873a", accent: "#d9b268" },
    fonts: { heading: "'Instrument Serif', serif", body: "'Inter', sans-serif" },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await apiFetch("/tenant/config");
      if (res.ok) {
        const data = await res.json();
        setForm({
          businessName: data.businessName || "",
          tagline: data.tagline || "",
          logoUrl: data.logoUrl,
          colors: data.colors || { primary: "#1a2e18", secondary: "#b8873a", accent: "#d9b268" },
          fonts: data.fonts || { heading: "'Instrument Serif', serif", body: "'Inter', sans-serif" },
        });
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await apiFetch("/tenant/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: form.businessName,
          tagline: form.tagline,
          colors: form.colors,
          fonts: form.fonts,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessage({ type: "error", text: err.error || "Erro ao salvar" });
      } else {
        setMessage({ type: "success", text: "Identidade visual atualizada! Recarregue a página para ver as mudanças." });
      }
    } catch {
      setMessage({ type: "error", text: "Erro de rede" });
    }
    setSaving(false);
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: "error", text: "Arquivo muito grande. Máximo 2MB." });
      return;
    }
    setUploading(true);
    setMessage(null);
    const fd = new FormData();
    fd.append("logo", file);
    try {
      const res = await apiFetch("/tenant/branding/logo", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        setForm((f) => ({ ...f, logoUrl: data.logoUrl }));
        setMessage({ type: "success", text: "Logo atualizado!" });
      } else {
        const err = await res.json().catch(() => ({}));
        setMessage({ type: "error", text: err.error || "Erro ao enviar logo" });
      }
    } catch {
      setMessage({ type: "error", text: "Erro de rede ao enviar logo" });
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleRemoveLogo() {
    try {
      await apiFetch("/tenant/branding/logo", { method: "DELETE" });
      setForm((f) => ({ ...f, logoUrl: null }));
      setMessage({ type: "success", text: "Logo removido" });
    } catch {
      setMessage({ type: "error", text: "Erro ao remover logo" });
    }
  }

  async function handleFaviconUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage(null);
    const fd = new FormData();
    fd.append("favicon", file);
    try {
      const res = await apiFetch("/tenant/branding/favicon", { method: "POST", body: fd });
      if (res.ok) {
        setMessage({ type: "success", text: "Favicon atualizado!" });
      } else {
        const err = await res.json().catch(() => ({}));
        setMessage({ type: "error", text: err.error || "Erro ao enviar favicon" });
      }
    } catch {
      setMessage({ type: "error", text: "Erro de rede" });
    }
    setUploading(false);
    if (faviconRef.current) faviconRef.current.value = "";
  }

  if (loading) return <div className={styles.wrap}><p>Carregando...</p></div>;

  return (
    <div className={styles.wrap}>
      <h2 className={styles.heading}>Identidade Visual</h2>
      <p className={styles.desc}>
        Personalize as cores, fontes e logo da sua plataforma. Estas configurações são aplicadas para todos os usuários da sua empresa.
      </p>

      {message && (
        <div className={`${styles.statusBadge} ${message.type === "success" ? styles.statusOk : styles.statusPending}`}>
          {message.text}
        </div>
      )}

      {/* Logo */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Logo</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
          {form.logoUrl ? (
            <div style={{ width: 80, height: 80, borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
              <img
                src={`${API_URL}${form.logoUrl}`}
                alt="Logo atual"
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
              />
            </div>
          ) : (
            <div style={{ width: 80, height: 80, borderRadius: 12, border: "2px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "0.8rem" }}>
              Sem logo
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label className={styles.btn} style={{ background: "var(--primary)", color: "#fff", cursor: "pointer", textAlign: "center" }}>
              {uploading ? "Enviando..." : "Enviar Logo"}
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoUpload} style={{ display: "none" }} />
            </label>
            {form.logoUrl && (
              <button type="button" className={styles.btn} style={{ background: "transparent", color: "#dc2626", border: "1px solid #dc2626" }} onClick={handleRemoveLogo}>
                Remover
              </button>
            )}
          </div>
        </div>
        <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0 }}>
          PNG, JPG, WebP ou SVG. Máximo 2MB. Recomendado: 200x200px ou maior.
        </p>
      </div>

      {/* Favicon */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Favicon</h3>
        <label className={styles.btn} style={{ background: "var(--primary)", color: "#fff", cursor: "pointer", display: "inline-block", textAlign: "center" }}>
          {uploading ? "Enviando..." : "Enviar Favicon"}
          <input ref={faviconRef} type="file" accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml" onChange={handleFaviconUpload} style={{ display: "none" }} />
        </label>
        <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 8 }}>
          PNG, ICO ou SVG. Recomendado: 32x32px ou 64x64px.
        </p>
      </div>

      {/* Cores */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Cores</h3>
        <div className={styles.fieldGrid}>
          <div className={styles.field}>
            <label>Cor Primária</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="color"
                value={form.colors.primary}
                onChange={(e) => setForm((f) => ({ ...f, colors: { ...f.colors, primary: e.target.value } }))}
                style={{ width: 40, height: 36, padding: 2, border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer" }}
              />
              <input
                type="text"
                value={form.colors.primary}
                onChange={(e) => setForm((f) => ({ ...f, colors: { ...f.colors, primary: e.target.value } }))}
                maxLength={7}
                style={{ flex: 1 }}
              />
            </div>
          </div>
          <div className={styles.field}>
            <label>Cor Secundária</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="color"
                value={form.colors.secondary}
                onChange={(e) => setForm((f) => ({ ...f, colors: { ...f.colors, secondary: e.target.value } }))}
                style={{ width: 40, height: 36, padding: 2, border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer" }}
              />
              <input
                type="text"
                value={form.colors.secondary}
                onChange={(e) => setForm((f) => ({ ...f, colors: { ...f.colors, secondary: e.target.value } }))}
                maxLength={7}
                style={{ flex: 1 }}
              />
            </div>
          </div>
          <div className={styles.field}>
            <label>Cor de Destaque</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="color"
                value={form.colors.accent}
                onChange={(e) => setForm((f) => ({ ...f, colors: { ...f.colors, accent: e.target.value } }))}
                style={{ width: 40, height: 36, padding: 2, border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer" }}
              />
              <input
                type="text"
                value={form.colors.accent}
                onChange={(e) => setForm((f) => ({ ...f, colors: { ...f.colors, accent: e.target.value } }))}
                maxLength={7}
                style={{ flex: 1 }}
              />
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <div style={{ width: 40, height: 24, borderRadius: 4, background: form.colors.primary, border: "1px solid var(--border)" }} title="Primária" />
          <div style={{ width: 40, height: 24, borderRadius: 4, background: form.colors.secondary, border: "1px solid var(--border)" }} title="Secundária" />
          <div style={{ width: 40, height: 24, borderRadius: 4, background: form.colors.accent, border: "1px solid var(--border)" }} title="Destaque" />
        </div>
      </div>

      {/* Fontes */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Fontes</h3>
        <div className={styles.fieldGrid}>
          <div className={styles.field}>
            <label>Fonte de Títulos</label>
            <select
              value={form.fonts.heading}
              onChange={(e) => setForm((f) => ({ ...f, fonts: { ...f.fonts, heading: e.target.value } }))}
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label>Fonte de Corpo</label>
            <select
              value={form.fonts.body}
              onChange={(e) => setForm((f) => ({ ...f, fonts: { ...f.fonts, body: e.target.value } }))}
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Nome e tagline */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Marca</h3>
        <div className={styles.fieldGrid}>
          <div className={styles.field}>
            <label>Nome do Negócio</label>
            <input
              type="text"
              value={form.businessName}
              onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
              maxLength={100}
            />
          </div>
          <div className={styles.field}>
            <label>Tagline / Slogan</label>
            <input
              type="text"
              value={form.tagline}
              onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
              maxLength={200}
              placeholder="Ex: Transformando vidas através do atendimento"
            />
          </div>
        </div>
      </div>

      <div className={styles.btnRow}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Salvando..." : "Salvar Identidade Visual"}
        </button>
      </div>
    </div>
  );
}
