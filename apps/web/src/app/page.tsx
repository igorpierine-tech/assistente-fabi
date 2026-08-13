"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { ChatPanel } from "@/components/ChatPanel";
import { DaySummary } from "@/components/DaySummary";
import { CalendarView } from "@/components/CalendarView";
import { AppointmentCard } from "@/components/AppointmentCard";
import { LoginScreen } from "@/components/LoginScreen";
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

export default function Home() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"chat" | "calendario">("chat");

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [newEventDate, setNewEventDate] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("userId") || localStorage.getItem("fabi_userId");
    const name = params.get("name") || localStorage.getItem("fabi_userName") || "";

    if (id) {
      localStorage.setItem("fabi_userId", id);
      if (name) localStorage.setItem("fabi_userName", name);
      setUserId(id);
      setUserName(name);
      window.history.replaceState({}, "", "/");
      checkAuth(id);
    } else {
      setLoading(false);
    }
  }, []);

  async function checkAuth(id: string) {
    try {
      const res = await fetch(`${API_URL}/auth/status/${id}`);
      const data = await res.json();
      setIsAuthenticated(data.authenticated);
    } catch {
      setIsAuthenticated(false);
    }
    setLoading(false);
  }

  async function handleLogin() {
    try {
      const res = await fetch(`${API_URL}/auth/google`);
      const data = await res.json();
      window.location.href = data.url;
    } catch {
      alert("API não disponível. Use o modo demonstração para visualizar a interface.");
    }
  }

  function handleDemo() {
    setUserId("demo");
    setUserName("Fabiana");
    setIsDemo(true);
    setIsAuthenticated(true);
    setEvents(generateDemoEvents());
  }

  function handleLogout() {
    localStorage.removeItem("fabi_userId");
    localStorage.removeItem("fabi_userName");
    setUserId(null);
    setIsAuthenticated(false);
    setIsDemo(false);
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
      if (exists) {
        return prev.map((e) => (e.id === event.id ? event : e));
      }
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
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        background: "var(--bg)",
      }}>
        <div style={{
          fontFamily: "var(--font-heading)",
          fontSize: "1.5rem",
          color: "var(--primary)",
        }}>
          Carregando...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} onDemo={handleDemo} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <Header
        userName={userName}
        onLogout={handleLogout}
        isDemo={isDemo}
        activeView={activeView}
        onChangeView={setActiveView}
      />

      {activeView === "chat" ? (
        <main style={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
          maxWidth: "1400px",
          width: "100%",
          margin: "0 auto",
          padding: "0 24px",
          gap: "24px",
        }}>
          <div style={{ flex: "0 0 340px", paddingTop: "24px", overflowY: "auto" }}>
            <DaySummary userId={userId!} isDemo={isDemo} events={events} onEventClick={handleEventClick} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <ChatPanel userId={userId!} isDemo={isDemo} />
          </div>
        </main>
      ) : (
        <main style={{
          flex: 1,
          overflow: "hidden",
          padding: "16px 24px",
          maxWidth: "1600px",
          width: "100%",
          margin: "0 auto",
        }}>
          <CalendarView
            events={events}
            isDemo={isDemo}
            onEventClick={handleEventClick}
            onNewEvent={handleNewEvent}
          />
        </main>
      )}

      {/* Modal de prontuário */}
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
