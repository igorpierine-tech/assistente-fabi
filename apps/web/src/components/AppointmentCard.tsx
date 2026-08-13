"use client";

import { useState } from "react";
import styles from "./AppointmentCard.module.css";
import type { CalendarEvent } from "./CalendarView";

interface AppointmentCardProps {
  event: CalendarEvent | null;
  isNew?: boolean;
  initialDate?: string;
  onClose: () => void;
  onSave: (event: CalendarEvent) => void;
  onDelete?: (eventId: string) => void;
}

const APPOINTMENT_TYPES = [
  { value: "constelacao", label: "Constelação Familiar" },
  { value: "consultoria_financeira", label: "Consultoria Financeira" },
  { value: "planejamento", label: "Planejamento" },
  { value: "reuniao", label: "Reunião" },
  { value: "bloqueio_pessoal", label: "Bloqueio Pessoal" },
  { value: "evento_curso", label: "Evento / Curso" },
  { value: "outro", label: "Outro" },
];

const STATUS_OPTIONS = [
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

  const [title, setTitle] = useState(event?.title || "");
  const [type, setType] = useState(event?.type || "constelacao");
  const [status, setStatus] = useState(event?.status || "previsto");
  const [clientName, setClientName] = useState(event?.clientName || "");
  const [clientPhone, setClientPhone] = useState(event?.clientPhone || "");
  const [clientEmail, setClientEmail] = useState(event?.clientEmail || "");
  const [startDate, setStartDate] = useState(
    event?.startDate ? event.startDate.slice(0, 16) : initialDate ? `${initialDate}T09:00` : ""
  );
  const [endDate, setEndDate] = useState(
    event?.endDate ? event.endDate.slice(0, 16) : initialDate ? `${initialDate}T10:30` : ""
  );
  const [notes, setNotes] = useState(event?.notes || "");

  const [queixaPrincipal, setQueixaPrincipal] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [encaminhamentos, setEncaminhamentos] = useState("");
  const [proximaSessao, setProximaSessao] = useState("");

  function handleSave() {
    if (!startDate || !endDate) return;

    const finalTitle = title || `${APPOINTMENT_TYPES.find((t) => t.value === type)?.label || "Atendimento"}${clientName ? ` — ${clientName}` : ""}`;

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
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      notes: prontuarioNotes,
    });
  }

  function formatDateDisplay(iso: string) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

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
                <select className={styles.select} value={type} onChange={(e) => setType(e.target.value)}>
                  {APPOINTMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
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
                  onChange={(e) => setStartDate(e.target.value)}
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
                <label className={styles.label}>Nome completo</label>
                <input
                  className={styles.input}
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Nome do cliente"
                />
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
                  <rect x="3" y="1" width="14" height="18" rx="2" stroke="#C4A265" strokeWidth="1.5" />
                  <line x1="7" y1="5" x2="13" y2="5" stroke="#C4A265" strokeWidth="1" />
                  <line x1="7" y1="8" x2="13" y2="8" stroke="#C4A265" strokeWidth="1" />
                  <line x1="7" y1="11" x2="11" y2="11" stroke="#C4A265" strokeWidth="1" />
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
