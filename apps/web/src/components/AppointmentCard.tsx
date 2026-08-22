"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./AppointmentCard.module.css";
import type { CalendarEvent } from "./CalendarView";
import {
  isoToLocalInput,
  localInputToIso,
  formatDateCuiaba,
  APP_TIMEZONE,
} from "@/lib/timezone";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface AppointmentCardProps {
  event: CalendarEvent | null;
  isNew?: boolean;
  initialDate?: string;
  onClose: () => void;
  onSave: (event: CalendarEvent) => void;
  onDelete?: (eventId: string) => void;
}

interface ClientRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
}

interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  kind: "produto" | "servico";
  price_cents: number;
  duration_minutes: number | null;
  active: number;
}

// Non-catalog internal types (always available)
const INTERNAL_TYPES = [
  { value: "bloqueio_pessoal", label: "Bloqueio pessoal" },
  { value: "reuniao", label: "Reunião" },
  { value: "planejamento", label: "Planejamento" },
  { value: "evento_curso", label: "Evento / Curso" },
  { value: "outro", label: "Outro" },
];

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function addMinutesLocalInput(local: string, minutes: number): string {
  // `local` is a `YYYY-MM-DDTHH:mm` string in Cuiabá local time (from the
  // datetime-local input). Convert it to UTC, add minutes, convert back.
  const iso = localInputToIso(local);
  if (!iso) return local;
  const shifted = new Date(new Date(iso).getTime() + minutes * 60000);
  return isoToLocalInput(shifted.toISOString());
}

const STATUS_OPTIONS: Array<{ value: CalendarEvent["status"]; label: string; color: string }> = [
  { value: "previsto", label: "Previsto", color: "#FFA726" },
  { value: "confirmado", label: "Confirmado", color: "#66BB6A" },
  { value: "em_andamento", label: "Em andamento", color: "#42A5F5" },
  { value: "concluido", label: "Concluído", color: "#78909C" },
  { value: "cancelado", label: "Cancelado", color: "#EF5350" },
];

function generateId() {
  return "evt_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function AppointmentCard({ event, isNew, initialDate, onClose, onSave, onDelete }: AppointmentCardProps) {
  const [activeTab, setActiveTab] = useState<"dados" | "prontuario" | "historico">("dados");

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);

  const [title, setTitle] = useState(event?.title || "");
  const [type, setType] = useState(event?.type || "");
  const [status, setStatus] = useState(event?.status || "previsto");
  const [clientName, setClientName] = useState(event?.clientName || "");
  const [clientPhone, setClientPhone] = useState(event?.clientPhone || "");
  const [clientEmail, setClientEmail] = useState(event?.clientEmail || "");
  const [startDate, setStartDate] = useState(
    event?.startDate
      ? isoToLocalInput(event.startDate)
      : initialDate
      ? `${initialDate}T09:00`
      : ""
  );
  const [endDate, setEndDate] = useState(
    event?.endDate
      ? isoToLocalInput(event.endDate)
      : initialDate
      ? `${initialDate}T10:30`
      : ""
  );
  const [notes, setNotes] = useState(event?.notes || "");

  // Fetch clients and catalog on mount
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`${API_URL}/clients`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      fetch(`${API_URL}/catalog`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    ]).then(([c, k]: [ClientRow[], CatalogItem[]]) => {
      if (cancelled) return;
      setClients(c);
      const activeItems = k.filter((i) => i.active === 1);
      setCatalogItems(activeItems);
      // Default type: first catalog item if nothing set yet
      if (!event?.type && activeItems.length > 0 && !type) {
        setType(slugify(activeItems[0].name));
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Map from type value → catalog item
  const catalogByType = useMemo(() => {
    const map = new Map<string, CatalogItem>();
    for (const item of catalogItems) map.set(slugify(item.name), item);
    return map;
  }, [catalogItems]);

  // Client-name → client match (case-insensitive exact)
  function findClientByName(name: string): ClientRow | undefined {
    const trimmed = name.trim().toLowerCase();
    if (!trimmed) return undefined;
    return clients.find((c) => c.name.toLowerCase() === trimmed);
  }

  function handleClientNameChange(name: string) {
    setClientName(name);
    const match = findClientByName(name);
    if (match) {
      setClientPhone(match.phone || "");
      setClientEmail(match.email || "");
    }
  }

  function handleTypeChange(newType: string) {
    setType(newType);
    // If catalog item selected, adjust end time based on its duration
    const item = catalogByType.get(newType);
    if (item && item.duration_minutes && startDate) {
      setEndDate(addMinutesLocalInput(startDate, item.duration_minutes));
    }
  }

  function handleStartChange(newStart: string) {
    setStartDate(newStart);
    // If catalog item is selected, keep end synced with duration
    const item = catalogByType.get(type);
    if (item && item.duration_minutes && newStart) {
      setEndDate(addMinutesLocalInput(newStart, item.duration_minutes));
    }
  }

  const [queixaPrincipal, setQueixaPrincipal] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [encaminhamentos, setEncaminhamentos] = useState("");
  const [proximaSessao, setProximaSessao] = useState("");

  function handleSave() {
    if (!startDate || !endDate) return;

    // Resolve a friendly label from catalog or internal fallback
    const catalogItem = catalogByType.get(type);
    const internal = INTERNAL_TYPES.find((t) => t.value === type);
    const typeLabel = catalogItem?.name || internal?.label || "Atendimento";
    const finalTitle = title || `${typeLabel}${clientName ? ` — ${clientName}` : ""}`;

    const prontuarioNotes = [
      notes,
      queixaPrincipal ? `\n--- PRONTUÁRIO ---\nQueixa principal: ${queixaPrincipal}` : "",
      observacoes ? `Observações da sessão: ${observacoes}` : "",
      encaminhamentos ? `Encaminhamentos: ${encaminhamentos}` : "",
      proximaSessao ? `Próxima sessão: ${proximaSessao}` : "",
    ].filter(Boolean).join("\n");

    onSave({
      id: event?.id || generateId(),
      title: finalTitle,
      type,
      status: status as CalendarEvent["status"],
      clientName,
      clientPhone,
      clientEmail,
      startDate: localInputToIso(startDate),
      endDate: localInputToIso(endDate),
      notes: prontuarioNotes,
    });
  }

  function formatDateDisplay(iso: string) {
    if (!iso) return "";
    return formatDateCuiaba(iso);
  }
  void APP_TIMEZONE; // referenced to keep import used across the file

  const currentStatus = STATUS_OPTIONS.find((s) => s.value === status);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h2 className={styles.headerTitle}>
              {isNew ? "Novo Agendamento" : "Detalhes do Agendamento"}
            </h2>
            {!isNew && event && (
              <span className={styles.eventId}>#{event.id.slice(0, 8)}</span>
            )}
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Status bar */}
        <div className={styles.statusBar}>
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s.value}
              className={`${styles.statusBtn} ${status === s.value ? styles.statusActive : ""}`}
              style={status === s.value ? { background: s.color, borderColor: s.color, color: "white" } : {}}
              onClick={() => setStatus(s.value)}
            >
              <span className={styles.statusDot} style={{ background: s.color }} />
              {s.label}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === "dados" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("dados")}
          >
            Dados do Atendimento
          </button>
          <button
            className={`${styles.tab} ${activeTab === "prontuario" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("prontuario")}
          >
            Prontuário
          </button>
          <button
            className={`${styles.tab} ${activeTab === "historico" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("historico")}
          >
            Histórico
          </button>
        </div>

        {/* Tab content */}
        <div className={styles.body}>
          {activeTab === "dados" && (
            <div className={styles.formGrid}>
              {/* Tipo de atendimento */}
              <div className={styles.fieldFull}>
                <label className={styles.label}>Tipo de Atendimento</label>
                <select
                  className={styles.select}
                  value={type}
                  onChange={(e) => handleTypeChange(e.target.value)}
                >
                  {catalogItems.length === 0 && (
                    <option value="">— nenhum produto/serviço cadastrado —</option>
                  )}
                  {catalogItems.length > 0 && (
                    <optgroup label="Produtos e serviços">
                      {catalogItems.map((item) => {
                        const value = slugify(item.name);
                        const dur = item.duration_minutes
                          ? ` · ${item.duration_minutes} min`
                          : "";
                        return (
                          <option key={item.id} value={value}>
                            {item.name}
                            {dur}
                          </option>
                        );
                      })}
                    </optgroup>
                  )}
                  <optgroup label="Outros">
                    {INTERNAL_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
                {catalogItems.length === 0 && (
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 6 }}>
                    Cadastre produtos e serviços em Configurações → Produtos e serviços
                    para vê-los aqui.
                  </p>
                )}
              </div>

              {/* Título */}
              <div className={styles.fieldFull}>
                <label className={styles.label}>Título do Evento</label>
                <input
                  className={styles.input}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`Ex: Constelação — ${clientName || "Nome do Cliente"}`}
                />
              </div>

              {/* Data e horários */}
              <div className={styles.fieldHalf}>
                <label className={styles.label}>Início</label>
                <input
                  className={styles.input}
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => handleStartChange(e.target.value)}
                />
              </div>

              <div className={styles.fieldHalf}>
                <label className={styles.label}>Término</label>
                <input
                  className={styles.input}
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              {/* Separador Cliente */}
              <div className={styles.sectionDivider}>
                <span>Dados do Cliente</span>
              </div>

              {/* Cliente */}
              <div className={styles.fieldFull}>
                <label className={styles.label}>
                  Nome completo
                  {clients.length > 0 && (
                    <span
                      style={{
                        fontSize: "0.7rem",
                        color: "var(--text-muted)",
                        marginLeft: 8,
                        textTransform: "none",
                        letterSpacing: 0,
                        fontWeight: 400,
                      }}
                    >
                      · escolha um cadastrado ou digite um novo
                    </span>
                  )}
                </label>
                <input
                  className={styles.input}
                  value={clientName}
                  onChange={(e) => handleClientNameChange(e.target.value)}
                  placeholder="Nome do cliente"
                  list="appointment-clients-list"
                  autoComplete="off"
                />
                <datalist id="appointment-clients-list">
                  {clients.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </div>

              <div className={styles.fieldHalf}>
                <label className={styles.label}>Telefone</label>
                <input
                  className={styles.input}
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="(65) 99999-9999"
                />
              </div>

              <div className={styles.fieldHalf}>
                <label className={styles.label}>E-mail</label>
                <input
                  className={styles.input}
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </div>

              {/* Observações gerais */}
              <div className={styles.fieldFull}>
                <label className={styles.label}>Observações gerais</label>
                <textarea
                  className={styles.textarea}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Informações adicionais sobre o atendimento..."
                  rows={3}
                />
              </div>
            </div>
          )}

          {activeTab === "prontuario" && (
            <div className={styles.formGrid}>
              <div className={styles.prontuarioHeader}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <rect x="3" y="1" width="14" height="18" rx="2" stroke="#b8873a" strokeWidth="1.5" />
                  <line x1="7" y1="5" x2="13" y2="5" stroke="#b8873a" strokeWidth="1" />
                  <line x1="7" y1="8" x2="13" y2="8" stroke="#b8873a" strokeWidth="1" />
                  <line x1="7" y1="11" x2="11" y2="11" stroke="#b8873a" strokeWidth="1" />
                </svg>
                <span>Prontuário da Sessão</span>
              </div>

              <div className={styles.fieldFull}>
                <label className={styles.label}>Queixa / Demanda Principal</label>
                <textarea
                  className={styles.textarea}
                  value={queixaPrincipal}
                  onChange={(e) => setQueixaPrincipal(e.target.value)}
                  placeholder="Descreva a queixa ou demanda principal do cliente nesta sessão..."
                  rows={3}
                />
              </div>

              <div className={styles.fieldFull}>
                <label className={styles.label}>Observações da Sessão</label>
                <textarea
                  className={styles.textarea}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Anotações sobre o que foi trabalhado, dinâmicas observadas, movimentos do campo..."
                  rows={5}
                />
              </div>

              <div className={styles.fieldFull}>
                <label className={styles.label}>Encaminhamentos</label>
                <textarea
                  className={styles.textarea}
                  value={encaminhamentos}
                  onChange={(e) => setEncaminhamentos(e.target.value)}
                  placeholder="Indicações, exercícios, orientações para o cliente..."
                  rows={3}
                />
              </div>

              <div className={styles.fieldFull}>
                <label className={styles.label}>Próxima Sessão / Acompanhamento</label>
                <textarea
                  className={styles.textarea}
                  value={proximaSessao}
                  onChange={(e) => setProximaSessao(e.target.value)}
                  placeholder="Sugestão de retorno, pontos a acompanhar..."
                  rows={2}
                />
              </div>
            </div>
          )}

          {activeTab === "historico" && (
            <div className={styles.historicoContent}>
              <div className={styles.historicoEmpty}>
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="24" r="20" stroke="var(--border)" strokeWidth="2" strokeDasharray="4 4" />
                  <path d="M16 20h16M16 28h10" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <p>O histórico de atendimentos deste cliente aparecerá aqui quando houver sessões anteriores registradas.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          {!isNew && onDelete && event && (
            <button className={styles.deleteBtn} onClick={() => onDelete(event.id)}>
              Cancelar atendimento
            </button>
          )}
          <div className={styles.footerRight}>
            <button className={styles.cancelBtn} onClick={onClose}>Fechar</button>
            <button className={styles.saveBtn} onClick={handleSave}>
              {isNew ? "Criar Agendamento" : "Salvar Alterações"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
