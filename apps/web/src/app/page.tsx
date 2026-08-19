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
import type { CalendarEvent } from "@/components/CalendarView";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function generateDemoEvents(): CalendarEvent[] {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();

  function makeEvent(
    id: string, title: string, type: string, dayOffset: number,
    startH: number, startM: number, durMin: number,
    status: CalendarEvent["status"], clientName?: string
  ): CalendarEvent {
    const start = new Date(y, m, today.getDate() + dayOffset, startH, startM);
    const end = new Date(start.getTime() + durMin * 60000);
    return {
      id, title, type, status, clientName,
      clientPhone: clientName ? "(65) 99" + Math.floor(Math.random() * 900 + 100) + "-" + Math.floor(Math.random() * 9000 + 1000) : undefined,
      clientEmail: clientName ? clientName.toLowerCase().replace(/\s/g, ".") + "@email.com" : undefined,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  }

  return [
    makeEvent("e1", "Constelação — Maria Valentina", "constelacao", 0, 9, 0, 90, "confirmado", "Maria Valentina"),
    makeEvent("e2", "Consultoria Financeira — Ana Paula", "consultoria_financeira", 0, 11, 0, 60, "confirmado", "Ana Paula"),
    makeEvent("e3", "Planejamento — Masterday Agosto", "planejamento", 0, 14, 0, 60, "previsto"),
    makeEvent("e4", "Constelação — Juliana Costa", "constelacao", 0, 15, 30, 90, "previsto", "Juliana Costa"),
    makeEvent("e5", "Reunião — Raízes e Riquezas", "reuniao", 0, 17, 30, 30, "previsto"),
    makeEvent("e6", "Constelação — Fernanda Lima", "constelacao", 1, 9, 0, 90, "previsto", "Fernanda Lima"),
    makeEvent("e7", "Consultoria Financeira — Roberto Silva", "consultoria_financeira", 1, 14, 0, 60, "previsto", "Roberto Silva"),
    makeEvent("e8", "Constelação — Patrícia Alves", "constelacao", 2, 10, 0, 90, "previsto", "Patrícia Alves"),
    makeEvent("e9", "Planejamento Financeiro", "planejamento", 3, 8, 0, 120, "previsto"),
    makeEvent("e10", "Constelação — Marcos Souza", "constelacao", 3, 14, 0, 90, "previsto", "Marcos Souza"),
    makeEvent("e11", "Evento — Masterday", "evento_curso", 5, 9, 0, 480, "confirmado"),
    makeEvent("e12", "Constelação — Luciana Ramos", "constelacao", -1, 9, 0, 90, "concluido", "Luciana Ramos"),
    makeEvent("e13", "Consultoria Financeira — Carla Dias", "consultoria_financeira", -1, 14, 0, 60, "concluido", "Carla Dias"),
    makeEvent("e14", "Constelação — Pedro Henrique", "constelacao", -3, 15, 0, 90, "concluido", "Pedro Henrique"),
    makeEvent("e15", "Reunião — Equipe RR", "reuniao", -5, 10, 0, 60, "concluido"),
    makeEvent("e16", "Bloqueio — Deslocamento Cuiabá", "bloqueio_pessoal", 4, 7, 0, 120, "previsto"),
    makeEvent("e17", "Constelação — Amanda Ferreira", "constelacao", 7, 9, 0, 90, "previsto", "Amanda Ferreira"),
    makeEvent("e18", "Consultoria Financeira — João Victor", "consultoria_financeira", 7, 14, 0, 60, "previsto", "João Victor"),
    makeEvent("e19", "Constelação — Beatriz Oliveira", "constelacao", 10, 10, 0, 90, "previsto", "Beatriz Oliveira"),
    makeEvent("e20", "Planejamento — Setembro", "planejamento", 14, 8, 0, 120, "previsto"),
  ];
}

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
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<View>("inicio");
  const [pendingBookingCount, setPendingBookingCount] = useState(0);

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [newEventDate, setNewEventDate] = useState("");

  const fetchAppointments = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/appointments`, { credentials: "include" });
      if (res.ok) {
        const rows: AppointmentRow[] = await res.json();
        setEvents(rows.map(appointmentToEvent));
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && !isDemo) {
      fetchAppointments();
    }
  }, [isAuthenticated, isDemo, fetchAppointments]);

  useEffect(() => {
    if (!isAuthenticated || isDemo) {
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
  }, [isAuthenticated, isDemo, activeView]);

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

  function handleDemo() {
    setUserId("demo");
    setUserName("Fabiana");
    setIsDemo(true);
    setIsAuthenticated(true);
    setEvents(generateDemoEvents());
  }

  async function handleLogout() {
    if (!isDemo) {
      await fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include" }).catch(() => undefined);
    }
    setUserId(null);
    setIsAuthenticated(false);
    setIsDemo(false);
    setPendingBookingCount(0);
    setActiveView("inicio");
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

  function handleSaveEvent(event: CalendarEvent) {
    setEvents((prev) => {
      const exists = prev.find((e) => e.id === event.id);
      if (exists) return prev.map((e) => (e.id === event.id ? event : e));
      return [...prev, event];
    });
    setSelectedEvent(null);
    setShowNewEvent(false);
  }

  function handleDeleteEvent(eventId: string) {
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
    setSelectedEvent(null);
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
    return <LoginScreen onLogin={handleLogin} onDemo={handleDemo} />;
  }

  function renderContent() {
    switch (activeView) {
      case "inicio":
        return (
          <Dashboard
            userName={userName}
            events={events}
            clients={[]}
            onNavigate={(v) => setActiveView(v as View)}
          />
        );
      case "assistente":
        return (
          <div className="main-chat">
            <div className="sidebar-summary">
              <DaySummary userId={userId!} isDemo={isDemo} events={events} onEventClick={handleEventClick} />
            </div>
            <div className="chat-area">
              <ChatPanel userId={userId!} isDemo={isDemo} />
            </div>
          </div>
        );
      case "agenda":
        return (
          <div className="main-calendar">
            <CalendarView
              events={events}
              isDemo={isDemo}
              onEventClick={handleEventClick}
              onNewEvent={handleNewEvent}
            />
          </div>
        );
      case "clientes":
        return (
          <div className="main-calendar">
            <ClientsPanel isDemo={isDemo} />
          </div>
        );
      case "agendamentos":
        return (
          <div className="main-calendar">
            <BookingRequestsPanel />
          </div>
        );
      case "financeiro":
        return (
          <div style={{ padding: "40px 32px" }}>
            <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "1.8rem", color: "var(--primary)", marginBottom: 8 }}>Financeiro</h2>
            <p style={{ color: "var(--text-muted)" }}>Em breve — controle de recebíveis e relatórios financeiros.</p>
          </div>
        );
      case "configuracoes":
        return (
          <div style={{ padding: "40px 32px" }}>
            <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "1.8rem", color: "var(--primary)", marginBottom: 8 }}>Configurações</h2>
            <p style={{ color: "var(--text-muted)" }}>Em breve — preferências, integrações e conta.</p>
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
        clientCount={42}
        pendingBookingCount={pendingBookingCount}
        isDemo={isDemo}
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
