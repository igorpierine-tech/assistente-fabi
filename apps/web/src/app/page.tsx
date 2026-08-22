"use client";

import { useState, useEffect, useCallback } from "react";
import { Sidebar, type View } from "@/components/Sidebar";
import { Dashboard } from "@/components/Dashboard";
import { ChatPanel } from "@/components/ChatPanel";
import { DaySummary } from "@/components/DaySummary";
import { CalendarView } from "@/components/CalendarView";
import { AppointmentCard } from "@/components/AppointmentCard";
import { LoginScreen } from "@/components/LoginScreen";
import { ClientsPanel } from "@/components/ClientsPanel";
import { BookingRequestsPanel } from "@/components/BookingRequestsPanel";
import { SettingsView } from "@/components/SettingsView";
import { FinanceiroView } from "@/components/FinanceiroView";
import { VendasView } from "@/components/VendasView";
import type { CalendarEvent } from "@/components/CalendarView";
import { isoToLocalInput, localInputToIso } from "@/lib/timezone";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface AppointmentRow {
  id: string;
  title: string;
  type: string;
  client_id: string | null;
  client_name: string | null;
  start_time: string;
  end_time: string;
  notes: string | null;
  google_event_id: string | null;
  status: string;
}

interface ClientRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface DashboardClient {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  origin?: string;
  sessions?: number;
  lastDate?: string;
  isNew?: boolean;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d
    .toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
    .replace(".", "");
}

function buildDashboardClients(
  rows: ClientRow[],
  appointments: AppointmentRow[]
): DashboardClient[] {
  const now = Date.now();
  const NEW_MS = 30 * 24 * 60 * 60 * 1000;

  const statsByClient = new Map<
    string,
    { count: number; lastDate: string | null }
  >();
  for (const appt of appointments) {
    const key = appt.client_id || (appt.client_name || "").toLowerCase();
    if (!key) continue;
    const prev = statsByClient.get(key) || { count: 0, lastDate: null };
    prev.count += 1;
    if (!prev.lastDate || appt.start_time > prev.lastDate) {
      prev.lastDate = appt.start_time;
    }
    statsByClient.set(key, prev);
  }

  return rows.map((row) => {
    const key = row.id;
    const nameKey = row.name.toLowerCase();
    const stats =
      statsByClient.get(key) || statsByClient.get(nameKey) || { count: 0, lastDate: null };
    const createdAt = row.created_at ? Date.parse(row.created_at) : NaN;
    const isNew =
      Number.isFinite(createdAt) && now - createdAt < NEW_MS && stats.count === 0;
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      notes: row.notes,
      sessions: stats.count,
      lastDate: stats.lastDate ? formatShortDate(stats.lastDate) : "—",
      isNew,
    };
  });
}

function appointmentToEvent(row: AppointmentRow): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    clientName: row.client_name || undefined,
    startDate: row.start_time,
    endDate: row.end_time,
    notes: row.notes || undefined,
    status: (row.status as CalendarEvent["status"]) || "previsto",
  };
}

export default function Home() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<View>("inicio");
  const [pendingBookingCount, setPendingBookingCount] = useState(0);

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [newEventDate, setNewEventDate] = useState("");
  const [clients, setClients] = useState<DashboardClient[]>([]);
  const [appointmentRows, setAppointmentRows] = useState<AppointmentRow[]>([]);
  const [clientRows, setClientRows] = useState<ClientRow[]>([]);

  const fetchAppointments = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/appointments`, { credentials: "include" });
      if (res.ok) {
        const rows: AppointmentRow[] = await res.json();
        setEvents(rows.map(appointmentToEvent));
        setAppointmentRows(rows);
      }
    } catch {
      // silently fail
    }
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/clients`, { credentials: "include" });
      if (res.ok) {
        const rows: ClientRow[] = await res.json();
        setClientRows(rows);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    setClients(buildDashboardClients(clientRows, appointmentRows));
  }, [clientRows, appointmentRows]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAppointments();
      fetchClients();
    }
  }, [isAuthenticated, fetchAppointments, fetchClients]);

  useEffect(() => {
    if (!isAuthenticated) {
      setPendingBookingCount(0);
      return;
    }
    let cancelled = false;
    async function loadCount() {
      try {
        const res = await fetch(`${API_URL}/booking/requests/pending-count`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data: { count?: number } = await res.json();
        if (!cancelled) setPendingBookingCount(data.count ?? 0);
      } catch {
        // silent
      }
    }
    loadCount();
    const interval = setInterval(loadCount, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isAuthenticated, activeView]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("authenticated")) {
      window.history.replaceState({}, "", "/");
    }
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const res = await fetch(`${API_URL}/auth/status`, { credentials: "include" });
      const data = await res.json();
      setIsAuthenticated(data.authenticated);
      if (data.authenticated && data.user?.id) {
        setUserId(data.user.id);
        setUserName(data.user.name || "");
        fetchAppointments();
        fetchClients();
      }
    } catch {
      setIsAuthenticated(false);
    }
    setLoading(false);
  }

  function handleLogin() {
    // Top-level navigation ensures the session cookie is first-party
    // (avoids third-party cookie blocking in Chrome incognito).
    window.location.href = `${API_URL}/auth/google?redirect=1`;
  }

  async function handleLogout() {
    await fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include" }).catch(() => undefined);
    setUserId(null);
    setIsAuthenticated(false);
    setPendingBookingCount(0);
    setActiveView("inicio");
    setClientRows([]);
    setAppointmentRows([]);
  }

  function handleEventClick(event: CalendarEvent) {
    setSelectedEvent(event);
    setShowNewEvent(false);
  }

  function handleNewEvent(date: string) {
    setNewEventDate(date);
    setSelectedEvent(null);
    setShowNewEvent(true);
  }

  async function handleSaveEvent(event: CalendarEvent) {
    // Locally-generated ids start with "evt_"; persisted rows use uuid.
    const isNew = event.id.startsWith("evt_") || !appointmentRows.find((r) => r.id === event.id);
    const body = {
      title: event.title,
      type: event.type,
      clientName: event.clientName || undefined,
      startTime: event.startDate,
      endTime: event.endDate,
      notes: event.notes || undefined,
      status: event.status,
    };
    try {
      const url = isNew
        ? `${API_URL}/appointments`
        : `${API_URL}/appointments/${event.id}`;
      const method = isNew ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Não foi possível salvar o agendamento.");
        return;
      }
      // Refresh from server so the persisted id shows up
      await fetchAppointments();
      setSelectedEvent(null);
      setShowNewEvent(false);
    } catch {
      alert("Erro de rede ao salvar o agendamento.");
    }
  }

  async function handleMoveEvent(event: CalendarEvent, newDayStr: string) {
    // Preserve time-of-day: replace only the YYYY-MM-DD part (in Cuiabá TZ)
    function shiftToDay(iso: string): string {
      const local = isoToLocalInput(iso); // "YYYY-MM-DDTHH:mm" in Cuiabá
      if (!local) return iso;
      const time = local.split("T")[1] || "00:00";
      return localInputToIso(`${newDayStr}T${time}`);
    }
    const newStart = shiftToDay(event.startDate);
    const newEnd = shiftToDay(event.endDate);

    // Optimistic UI: reflect the move immediately
    setEvents((prev) =>
      prev.map((e) =>
        e.id === event.id ? { ...e, startDate: newStart, endDate: newEnd } : e
      )
    );

    try {
      const res = await fetch(`${API_URL}/appointments/${event.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: newStart,
          endTime: newEnd,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Não foi possível mover o agendamento.");
      }
      await fetchAppointments();
    } catch {
      alert("Erro de rede ao mover o agendamento.");
      await fetchAppointments();
    }
  }

  async function handleDeleteEvent(eventId: string) {
    try {
      const res = await fetch(`${API_URL}/appointments/${eventId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok && res.status !== 404) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Não foi possível excluir o agendamento.");
        return;
      }
      await fetchAppointments();
      setSelectedEvent(null);
    } catch {
      alert("Erro de rede ao excluir o agendamento.");
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "var(--bg)" }}>
        <div style={{ fontFamily: "var(--font-heading)", fontSize: "1.5rem", color: "var(--primary)" }}>
          Carregando...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  function renderContent() {
    switch (activeView) {
      case "inicio":
        return (
          <Dashboard
            userName={userName}
            events={events}
            clients={clients}
            onNavigate={(v) => setActiveView(v as View)}
          />
        );
      case "assistente":
        return (
          <div className="main-chat">
            <div className="sidebar-summary">
              <DaySummary userId={userId!} events={events} onEventClick={handleEventClick} />
            </div>
            <div className="chat-area">
              <ChatPanel userId={userId!} />
            </div>
          </div>
        );
      case "agenda":
        return (
          <div className="main-calendar">
            <CalendarView
              events={events}
              onEventClick={handleEventClick}
              onNewEvent={handleNewEvent}
              onEventMove={handleMoveEvent}
            />
          </div>
        );
      case "clientes":
        return (
          <div className="main-calendar">
            <ClientsPanel />
          </div>
        );
      case "agendamentos":
        return (
          <div className="main-calendar">
            <BookingRequestsPanel />
          </div>
        );
      case "vendas":
        return (
          <div className="main-calendar">
            <VendasView />
          </div>
        );
      case "financeiro":
        return (
          <div className="main-calendar">
            <FinanceiroView />
          </div>
        );
      case "configuracoes":
        return (
          <div className="main-calendar">
            <SettingsView />
          </div>
        );
    }
  }

  return (
    <div className="app-layout">
      <Sidebar
        activeView={activeView}
        onChangeView={setActiveView}
        userName={userName || "Fabiana"}
        clientCount={clients.length}
        pendingBookingCount={pendingBookingCount}
        onLogout={handleLogout}
      />
      <main className="app-main">
        {renderContent()}
      </main>

      {(selectedEvent || showNewEvent) && (
        <AppointmentCard
          event={selectedEvent}
          isNew={showNewEvent}
          initialDate={newEventDate}
          onClose={() => { setSelectedEvent(null); setShowNewEvent(false); }}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
        />
      )}
    </div>
  );
}
