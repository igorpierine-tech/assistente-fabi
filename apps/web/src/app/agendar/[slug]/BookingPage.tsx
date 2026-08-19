"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import styles from "./BookingPage.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface SessionType {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  color: string | null;
}

interface PageMeta {
  slug: string;
  title: string;
  intro: string | null;
  timezone: string;
  maxAdvanceDays: number;
  minNoticeHours: number;
}

interface RequestResponse {
  id: string;
  manageToken: string;
  status: string;
  requestedStart: string;
  requestedEnd: string;
  typeName: string;
}

type Step = "type" | "date" | "slot" | "form" | "confirmed";

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function formatDateBR(iso: string, timezone: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: timezone,
  }).format(date);
}

function formatTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(iso));
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function BookingPage({ slug }: { slug: string }) {
  const [page, setPage] = useState<PageMeta | null>(null);
  const [types, setTypes] = useState<SessionType[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [step, setStep] = useState<Step>("type");
  const [chosenType, setChosenType] = useState<SessionType | null>(null);

  const [month, setMonth] = useState<Date>(() => new Date());
  const [availableDays, setAvailableDays] = useState<Set<string>>(new Set());
  const [loadingDays, setLoadingDays] = useState(false);

  const [chosenDate, setChosenDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [chosenSlot, setChosenSlot] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [confirmation, setConfirmation] = useState<RequestResponse | null>(null);

  // Load page metadata + session types
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/public/booking/${slug}`);
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error("load");
        const data = await res.json();
        if (cancelled) return;
        setPage(data.page as PageMeta);
        setTypes(data.types as SessionType[]);
      } catch {
        if (!cancelled) setError("Não foi possível carregar a página.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const monthKey = useMemo(
    () => `${month.getFullYear()}-${pad(month.getMonth() + 1)}`,
    [month]
  );

  // Load available days when type or month changes
  useEffect(() => {
    if (!chosenType || !page) return;
    let cancelled = false;
    setLoadingDays(true);
    fetch(
      `${API_URL}/public/booking/${slug}/availability?type=${chosenType.slug}&month=${monthKey}`
    )
      .then((r) => r.json())
      .then((data: { availableDays?: string[] }) => {
        if (cancelled) return;
        setAvailableDays(new Set(data.availableDays || []));
      })
      .catch(() => {
        if (cancelled) return;
        setAvailableDays(new Set());
      })
      .finally(() => {
        if (!cancelled) setLoadingDays(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, chosenType, page, monthKey]);

  // Load slots for chosen day
  useEffect(() => {
    if (!chosenType || !chosenDate) return;
    let cancelled = false;
    setLoadingSlots(true);
    fetch(
      `${API_URL}/public/booking/${slug}/availability?type=${chosenType.slug}&date=${chosenDate}`
    )
      .then((r) => r.json())
      .then((data: { slots?: { start: string }[] }) => {
        if (cancelled) return;
        setSlots((data.slots || []).map((s) => s.start));
      })
      .catch(() => {
        if (cancelled) return;
        setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, chosenType, chosenDate]);

  const handleTypeChoice = (t: SessionType) => {
    setChosenType(t);
    setStep("date");
  };

  const handleDateChoice = (date: string) => {
    setChosenDate(date);
    setStep("slot");
  };

  const handleSlotChoice = (iso: string) => {
    setChosenSlot(iso);
    setStep("form");
  };

  const handleSubmit = useCallback(async () => {
    if (!chosenType || !chosenSlot) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`${API_URL}/public/booking/${slug}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typeSlug: chosenType.slug,
          startISO: chosenSlot,
          name: form.name,
          email: form.email,
          phone: form.phone,
          notes: form.notes,
        }),
      });
      const data = (await res.json()) as RequestResponse & { error?: string };
      if (!res.ok) {
        setSubmitError(data.error || "Não foi possível enviar. Tente outro horário.");
        return;
      }
      setConfirmation(data);
      setStep("confirmed");
    } catch {
      setSubmitError("Erro de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }, [chosenType, chosenSlot, form, slug]);

  const canGoBack = step !== "type" && step !== "confirmed";
  const goBack = () => {
    if (step === "form") setStep("slot");
    else if (step === "slot") setStep("date");
    else if (step === "date") {
      setStep("type");
      setChosenType(null);
    }
  };

  if (notFound) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.title}>Página não encontrada</h1>
          <p className={styles.desc}>
            O endereço <code>{slug}</code> não existe ou foi desativado.
          </p>
        </div>
      </div>
    );
  }

  if (!page || !types) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.loading}>{error || "Carregando…"}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <Image
            src="/logo-raizes.png"
            alt="Raízes e Riquezas"
            width={72}
            height={72}
            priority
          />
          <div>
            <div className={styles.brandKicker}>Raízes e Riquezas</div>
            <h1 className={styles.title}>{page.title}</h1>
          </div>
        </div>

        {page.intro && <p className={styles.desc}>{page.intro}</p>}

        {canGoBack && (
          <button className={styles.back} type="button" onClick={goBack}>
            ← Voltar
          </button>
        )}

        {step === "type" && (
          <TypePicker types={types} onPick={handleTypeChoice} />
        )}

        {step === "date" && chosenType && (
          <>
            <StepHeader title="Escolha um dia" subtitle={chosenType.name} />
            <MonthCalendar
              month={month}
              availableDays={availableDays}
              loading={loadingDays}
              onChangeMonth={setMonth}
              onPick={handleDateChoice}
              timezone={page.timezone}
            />
          </>
        )}

        {step === "slot" && chosenType && chosenDate && (
          <>
            <StepHeader
              title="Escolha um horário"
              subtitle={formatDateBR(`${chosenDate}T12:00:00`, page.timezone)}
            />
            <SlotList
              slots={slots}
              loading={loadingSlots}
              onPick={handleSlotChoice}
              timezone={page.timezone}
            />
          </>
        )}

        {step === "form" && chosenSlot && chosenType && (
          <FormStep
            summary={{
              typeName: chosenType.name,
              start: chosenSlot,
              timezone: page.timezone,
              duration: chosenType.durationMinutes,
            }}
            form={form}
            onChange={(next) => setForm({ ...form, ...next })}
            onSubmit={handleSubmit}
            submitting={submitting}
            error={submitError}
          />
        )}

        {step === "confirmed" && confirmation && (
          <ConfirmationView
            confirmation={confirmation}
            timezone={page.timezone}
          />
        )}
      </div>
    </div>
  );
}

function StepHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className={styles.stepHead}>
      <div className={styles.stepTitle}>{title}</div>
      {subtitle && <div className={styles.stepSub}>{subtitle}</div>}
    </div>
  );
}

function TypePicker({
  types,
  onPick,
}: {
  types: SessionType[];
  onPick: (t: SessionType) => void;
}) {
  if (types.length === 0) {
    return (
      <div className={styles.empty}>
        Nenhum tipo de sessão disponível no momento.
      </div>
    );
  }
  return (
    <>
      <StepHeader title="Escolha o tipo de sessão" />
      <div className={styles.typeList}>
        {types.map((t) => (
          <button
            key={t.id}
            className={styles.typeCard}
            type="button"
            onClick={() => onPick(t)}
          >
            <div className={styles.typeName}>{t.name}</div>
            {t.description && (
              <div className={styles.typeDesc}>{t.description}</div>
            )}
            <div className={styles.typeDuration}>
              {t.durationMinutes} min
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

function MonthCalendar({
  month,
  availableDays,
  loading,
  onChangeMonth,
  onPick,
  timezone,
}: {
  month: Date;
  availableDays: Set<string>;
  loading: boolean;
  onChangeMonth: (m: Date) => void;
  onPick: (dateStr: string) => void;
  timezone: string;
}) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const first = new Date(year, monthIndex, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });

  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return (
    <div className={styles.calendar}>
      <div className={styles.calendarHead}>
        <button
          type="button"
          className={styles.calendarNav}
          onClick={() =>
            onChangeMonth(new Date(year, monthIndex - 1, 1))
          }
          aria-label="Mês anterior"
        >
          ‹
        </button>
        <div className={styles.calendarTitle}>
          {MONTHS[monthIndex]} {year}
        </div>
        <button
          type="button"
          className={styles.calendarNav}
          onClick={() => onChangeMonth(new Date(year, monthIndex + 1, 1))}
          aria-label="Próximo mês"
        >
          ›
        </button>
      </div>

      <div className={styles.calendarGrid}>
        {WEEKDAYS.map((w) => (
          <div key={w} className={styles.weekday}>
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
          const inMonth = d.getMonth() === monthIndex;
          const available = availableDays.has(key);
          const isPast = key < todayKey;
          const disabled = !inMonth || !available || isPast;
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              className={`${styles.day} ${!inMonth ? styles.dayOut : ""} ${available && inMonth ? styles.dayAvailable : ""}`}
              onClick={() => onPick(key)}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
      {loading && <div className={styles.loading}>Consultando…</div>}
    </div>
  );
}

function SlotList({
  slots,
  loading,
  onPick,
  timezone,
}: {
  slots: string[];
  loading: boolean;
  onPick: (iso: string) => void;
  timezone: string;
}) {
  if (loading) return <div className={styles.loading}>Consultando…</div>;
  if (slots.length === 0) {
    return (
      <div className={styles.empty}>
        Sem horários disponíveis nesse dia. Escolha outro.
      </div>
    );
  }
  return (
    <div className={styles.slotList}>
      {slots.map((iso) => (
        <button
          key={iso}
          type="button"
          className={styles.slotBtn}
          onClick={() => onPick(iso)}
        >
          {formatTime(iso, timezone)}
        </button>
      ))}
    </div>
  );
}

function FormStep({
  summary,
  form,
  onChange,
  onSubmit,
  submitting,
  error,
}: {
  summary: { typeName: string; start: string; timezone: string; duration: number };
  form: { name: string; email: string; phone: string; notes: string };
  onChange: (patch: Partial<typeof form>) => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
}) {
  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className={styles.summary}>
        <div className={styles.summaryTitle}>{summary.typeName}</div>
        <div className={styles.summarySub}>
          {formatDateBR(summary.start, summary.timezone)}
        </div>
        <div className={styles.summarySub}>
          às {formatTime(summary.start, summary.timezone)} · {summary.duration} min
        </div>
      </div>

      <label className={styles.field}>
        <span>Nome completo *</span>
        <input
          type="text"
          required
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </label>

      <label className={styles.field}>
        <span>E-mail *</span>
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => onChange({ email: e.target.value })}
        />
      </label>

      <label className={styles.field}>
        <span>WhatsApp / telefone</span>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => onChange({ phone: e.target.value })}
        />
      </label>

      <label className={styles.field}>
        <span>Observação (opcional)</span>
        <textarea
          rows={3}
          value={form.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
        />
      </label>

      {error && <div className={styles.error}>{error}</div>}

      <button
        type="submit"
        className={styles.primaryBtn}
        disabled={submitting}
      >
        {submitting ? "Enviando…" : "Solicitar horário"}
      </button>
      <p className={styles.finePrint}>
        A Fabi ainda precisa confirmar. Você recebe a resposta por e-mail.
      </p>
    </form>
  );
}

function ConfirmationView({
  confirmation,
  timezone,
}: {
  confirmation: RequestResponse;
  timezone: string;
}) {
  return (
    <div className={styles.confirmed}>
      <div className={styles.checkMark}>✓</div>
      <h2 className={styles.confirmedTitle}>Solicitação enviada</h2>
      <p className={styles.confirmedText}>
        <strong>{confirmation.typeName}</strong>
        <br />
        {formatDateBR(confirmation.requestedStart, timezone)}
        <br />
        às {formatTime(confirmation.requestedStart, timezone)}
      </p>
      <p className={styles.finePrint}>
        Assim que a Fabi confirmar, você recebe o convite no e-mail com o
        Google Calendar. Se precisar alterar, guarde este link:
      </p>
      <div className={styles.manageLink}>
        <code>/agendar/manage/{confirmation.manageToken}</code>
      </div>
    </div>
  );
}
