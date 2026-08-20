"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./BookingRequestsPanel.module.css";
import extraStyles from "./BookingSettingsPanel.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type WorkHours = Record<string, [string, string][]>;

interface Settings {
  slug: string;
  title: string;
  intro: string | null;
  timezone: string;
  min_notice_hours: number;
  max_advance_days: number;
  buffer_minutes: number;
  work_hours: WorkHours;
}

interface SessionType {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  active: number;
}

interface PublicUrl {
  slug: string;
  url: string;
}

const DAY_LABELS: { key: string; label: string }[] = [
  { key: "1", label: "Segunda" },
  { key: "2", label: "Terça" },
  { key: "3", label: "Quarta" },
  { key: "4", label: "Quinta" },
  { key: "5", label: "Sexta" },
  { key: "6", label: "Sábado" },
  { key: "0", label: "Domingo" },
];

const DEFAULT_WORK_HOURS: WorkHours = {
  "0": [],
  "1": [["09:00", "18:00"]],
  "2": [["09:00", "18:00"]],
  "3": [["09:00", "18:00"]],
  "4": [["09:00", "18:00"]],
  "5": [["09:00", "18:00"]],
  "6": [],
};

function normalizeWorkHours(input: WorkHours | undefined | null): WorkHours {
  const out: WorkHours = { "0": [], "1": [], "2": [], "3": [], "4": [], "5": [], "6": [] };
  if (!input) return { ...DEFAULT_WORK_HOURS };
  for (const key of Object.keys(out)) {
    const arr = input[key];
    out[key] = Array.isArray(arr) ? arr.filter((w) => Array.isArray(w) && w.length === 2) : [];
  }
  return out;
}

export function BookingSettingsPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [types, setTypes] = useState<SessionType[]>([]);
  const [publicUrl, setPublicUrl] = useState<PublicUrl | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [newType, setNewType] = useState({
    name: "",
    description: "",
    durationMinutes: 60,
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [setRes, typRes, urlRes] = await Promise.all([
        fetch(`${API_URL}/booking/settings`, { credentials: "include" }),
        fetch(`${API_URL}/booking/types`, { credentials: "include" }),
        fetch(`${API_URL}/booking/public-url`, { credentials: "include" }),
      ]);
      if (!setRes.ok || !typRes.ok || !urlRes.ok) {
        throw new Error("load");
      }
      const s: Settings = await setRes.json();
      s.work_hours = normalizeWorkHours(s.work_hours);
      setSettings(s);
      setTypes(await typRes.json());
      setPublicUrl(await urlRes.json());
      setError(null);
    } catch {
      setError("Não foi possível carregar. Verifique se você está logado.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function saveSettings(patch: Partial<Settings>) {
    const res = await fetch(`${API_URL}/booking/settings`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Falha ao salvar");
      return;
    }
    await fetchAll();
  }

  async function addType() {
    if (!newType.name.trim()) return;
    const res = await fetch(`${API_URL}/booking/types`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newType),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Falha ao criar tipo");
      return;
    }
    setNewType({ name: "", description: "", durationMinutes: 60 });
    await fetchAll();
  }

  async function toggleType(t: SessionType) {
    await fetch(`${API_URL}/booking/types/${t.id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !t.active }),
    });
    await fetchAll();
  }

  async function removeType(t: SessionType) {
    if (!confirm(`Remover "${t.name}"?`)) return;
    await fetch(`${API_URL}/booking/types/${t.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    await fetchAll();
  }

  function copyLink() {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl.url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) return <div className={styles.loading}>Carregando…</div>;
  if (error) return <div className={styles.error}>{error}</div>;
  if (!settings) return null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <div className={styles.kicker}>Página de agendamento</div>
          <h1 className={styles.title}>Configurações</h1>
        </div>
        {publicUrl && (
          <div className={styles.linkBox}>
            <div className={styles.linkLabel}>Sua página pública</div>
            <div className={styles.linkRow}>
              <code className={styles.linkText}>{publicUrl.url}</code>
              <button type="button" className={styles.copyBtn} onClick={copyLink}>
                {copied ? "Copiado ✓" : "Copiar"}
              </button>
            </div>
          </div>
        )}
      </div>

      <SettingsForm
        settings={settings}
        types={types}
        newType={newType}
        onNewTypeChange={setNewType}
        onAddType={addType}
        onToggleType={toggleType}
        onRemoveType={removeType}
        onSave={saveSettings}
      />
    </div>
  );
}

function SettingsForm({
  settings,
  types,
  newType,
  onNewTypeChange,
  onAddType,
  onToggleType,
  onRemoveType,
  onSave,
}: {
  settings: Settings;
  types: SessionType[];
  newType: { name: string; description: string; durationMinutes: number };
  onNewTypeChange: (v: {
    name: string;
    description: string;
    durationMinutes: number;
  }) => void;
  onAddType: () => void;
  onToggleType: (t: SessionType) => void;
  onRemoveType: (t: SessionType) => void;
  onSave: (patch: Partial<Settings>) => void;
}) {
  const [local, setLocal] = useState<Settings>(settings);
  useEffect(() => setLocal(settings), [settings]);

  function submitGeneral() {
    onSave({
      slug: local.slug,
      title: local.title,
      intro: local.intro,
      buffer_minutes: local.buffer_minutes,
      max_advance_days: local.max_advance_days,
      min_notice_hours: local.min_notice_hours,
    });
  }

  function submitHours() {
    onSave({ work_hours: local.work_hours });
  }

  function addWindow(dayKey: string) {
    const wh = { ...local.work_hours };
    wh[dayKey] = [...(wh[dayKey] || []), ["09:00", "18:00"]];
    setLocal({ ...local, work_hours: wh });
  }

  function removeWindow(dayKey: string, index: number) {
    const wh = { ...local.work_hours };
    wh[dayKey] = (wh[dayKey] || []).filter((_, i) => i !== index);
    setLocal({ ...local, work_hours: wh });
  }

  function updateWindow(dayKey: string, index: number, which: 0 | 1, value: string) {
    const wh = { ...local.work_hours };
    const arr = [...(wh[dayKey] || [])];
    const win: [string, string] = [...(arr[index] || ["09:00", "18:00"])] as [string, string];
    win[which] = value;
    arr[index] = win;
    wh[dayKey] = arr;
    setLocal({ ...local, work_hours: wh });
  }

  function toggleDay(dayKey: string, enabled: boolean) {
    const wh = { ...local.work_hours };
    wh[dayKey] = enabled ? [["09:00", "18:00"]] : [];
    setLocal({ ...local, work_hours: wh });
  }

  return (
    <div className={styles.settingsGrid}>
      <div className={styles.settingsCard}>
        <h2 className={styles.sectionTitle}>Página pública</h2>
        <label className={styles.field}>
          <span>Endereço (slug)</span>
          <input
            type="text"
            value={local.slug}
            onChange={(e) => setLocal({ ...local, slug: e.target.value })}
          />
        </label>
        <label className={styles.field}>
          <span>Título</span>
          <input
            type="text"
            value={local.title}
            onChange={(e) => setLocal({ ...local, title: e.target.value })}
          />
        </label>
        <label className={styles.field}>
          <span>Texto de boas-vindas</span>
          <textarea
            rows={3}
            value={local.intro ?? ""}
            onChange={(e) => setLocal({ ...local, intro: e.target.value })}
          />
        </label>
        <div className={styles.row3}>
          <label className={styles.field}>
            <span>Antecedência mínima (h)</span>
            <input
              type="number"
              min={0}
              max={168}
              value={local.min_notice_hours}
              onChange={(e) =>
                setLocal({ ...local, min_notice_hours: Number(e.target.value) })
              }
            />
          </label>
          <label className={styles.field}>
            <span>Janela máxima (dias)</span>
            <input
              type="number"
              min={1}
              max={365}
              value={local.max_advance_days}
              onChange={(e) =>
                setLocal({ ...local, max_advance_days: Number(e.target.value) })
              }
            />
          </label>
          <label className={styles.field}>
            <span>Intervalo entre sessões (min)</span>
            <input
              type="number"
              min={0}
              max={180}
              value={local.buffer_minutes}
              onChange={(e) =>
                setLocal({ ...local, buffer_minutes: Number(e.target.value) })
              }
            />
          </label>
        </div>
        <button type="button" className={styles.saveBtn} onClick={submitGeneral}>
          Salvar
        </button>
      </div>

      <div className={styles.settingsCard}>
        <h2 className={styles.sectionTitle}>Horários disponíveis</h2>
        <p className={extraStyles.hint}>
          Marque os dias e defina as janelas de horário em que você aceita agendamentos.
          Você pode adicionar mais de uma janela por dia (ex: manhã e tarde).
        </p>
        <div className={extraStyles.daysList}>
          {DAY_LABELS.map(({ key, label }) => {
            const windows = local.work_hours[key] || [];
            const enabled = windows.length > 0;
            return (
              <div key={key} className={extraStyles.dayRow}>
                <label className={extraStyles.dayToggle}>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => toggleDay(key, e.target.checked)}
                  />
                  <span>{label}</span>
                </label>
                <div className={extraStyles.windows}>
                  {!enabled && <span className={extraStyles.closed}>Fechado</span>}
                  {windows.map((win, idx) => (
                    <div key={idx} className={extraStyles.windowRow}>
                      <input
                        type="time"
                        value={win[0]}
                        onChange={(e) => updateWindow(key, idx, 0, e.target.value)}
                      />
                      <span>até</span>
                      <input
                        type="time"
                        value={win[1]}
                        onChange={(e) => updateWindow(key, idx, 1, e.target.value)}
                      />
                      <button
                        type="button"
                        className={extraStyles.removeWin}
                        onClick={() => removeWindow(key, idx)}
                        aria-label="Remover janela"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {enabled && (
                    <button
                      type="button"
                      className={extraStyles.addWin}
                      onClick={() => addWindow(key)}
                    >
                      + Adicionar janela
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <button type="button" className={styles.saveBtn} onClick={submitHours}>
          Salvar horários
        </button>
      </div>

      <div className={styles.settingsCard}>
        <h2 className={styles.sectionTitle}>Tipos de sessão</h2>
        {types.length === 0 && (
          <div className={styles.empty}>
            Nenhum tipo cadastrado ainda. Adicione ao lado para começar.
          </div>
        )}
        <div className={styles.typeList}>
          {types.map((t) => (
            <div key={t.id} className={styles.typeRow}>
              <div>
                <div className={styles.typeName}>
                  {t.name}
                  {!t.active && <span className={styles.typeInactive}>inativo</span>}
                </div>
                <div className={styles.typeMeta}>
                  {t.duration_minutes} min · /{t.slug}
                </div>
              </div>
              <div className={styles.typeActions}>
                <button type="button" onClick={() => onToggleType(t)}>
                  {t.active ? "Desativar" : "Ativar"}
                </button>
                <button
                  type="button"
                  className={styles.typeDelete}
                  onClick={() => onRemoveType(t)}
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className={styles.newType}>
          <div className={styles.newTypeTitle}>Novo tipo</div>
          <input
            type="text"
            placeholder="Nome (ex: Consultoria financeira)"
            value={newType.name}
            onChange={(e) => onNewTypeChange({ ...newType, name: e.target.value })}
          />
          <input
            type="text"
            placeholder="Descrição breve (opcional)"
            value={newType.description}
            onChange={(e) =>
              onNewTypeChange({ ...newType, description: e.target.value })
            }
          />
          <label className={styles.field}>
            <span>Duração (min)</span>
            <input
              type="number"
              min={15}
              max={600}
              value={newType.durationMinutes}
              onChange={(e) =>
                onNewTypeChange({
                  ...newType,
                  durationMinutes: Number(e.target.value),
                })
              }
            />
          </label>
          <button type="button" className={styles.saveBtn} onClick={onAddType}>
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}
