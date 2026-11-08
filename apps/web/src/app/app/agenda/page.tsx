"use client";

import { useState, useEffect, useCallback } from "react";
import { CalendarView, type CalendarEvent } from "@/components/CalendarView";
import { AppointmentCard } from "@/components/AppointmentCard";
import { apiFetch } from "@/lib/api";
import { isoToLocalInput, localInputToIso } from "@/lib/timezone";

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

function toEvent(row: AppointmentRow): CalendarEvent {
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

export default function AgendaPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [newEventDate, setNewEventDate] = useState("");

  const fetchAppointments = useCallback(async () => {
    try {
      const res = await apiFetch("/appointments");
      if (res.ok) setEvents((await res.json()).map(toEvent));
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  async function handleSaveEvent(event: CalendarEvent) {
    const isNew = event.id.startsWith("evt_");
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
      const res = await apiFetch(isNew ? "/appointments" : `/appointments/${event.id}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Não foi possível salvar o agendamento.");
        return;
      }
      await fetchAppointments();
      setSelectedEvent(null);
      setShowNewEvent(false);
    } catch {
      alert("Erro de rede ao salvar o agendamento.");
    }
  }

  async function handleMoveEvent(event: CalendarEvent, newDayStr: string) {
    function shiftToDay(iso: string): string {
      const local = isoToLocalInput(iso);
      if (!local) return iso;
      const time = local.split("T")[1] || "00:00";
      return localInputToIso(`${newDayStr}T${time}`);
    }
    const newStart = shiftToDay(event.startDate);
    const newEnd = shiftToDay(event.endDate);
    setEvents((prev) => prev.map((e) => e.id === event.id ? { ...e, startDate: newStart, endDate: newEnd } : e));
    try {
      await apiFetch(`/appointments/${event.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startTime: newStart, endTime: newEnd }),
      });
    } catch { /* silent */ }
    await fetchAppointments();
  }

  async function handleDeleteEvent(eventId: string) {
    try {
      await apiFetch(`/appointments/${eventId}`, { method: "DELETE" });
      await fetchAppointments();
      setSelectedEvent(null);
    } catch {
      alert("Erro de rede ao excluir o agendamento.");
    }
  }

  return (
    <>
      <div className="main-calendar">
        <CalendarView
          events={events}
          onEventClick={(e) => { setSelectedEvent(e); setShowNewEvent(false); }}
          onNewEvent={(date) => { setNewEventDate(date); setSelectedEvent(null); setShowNewEvent(true); }}
          onEventMove={handleMoveEvent}
        />
      </div>
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
    </>
  );
}
