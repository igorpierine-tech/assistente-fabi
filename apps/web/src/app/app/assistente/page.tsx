"use client";

import { ChatPanel } from "@/components/ChatPanel";
import { DaySummary } from "@/components/DaySummary";
import type { CalendarEvent } from "@/components/CalendarView";
import { useAuth } from "@/lib/auth-context";
import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";

type EventStatus = CalendarEvent["status"];

export default function AssistentePage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    apiFetch("/appointments").then(async (res) => {
      if (res.ok) {
        const rows = await res.json();
        setEvents(rows.map((r: Record<string, string | null>) => ({
          id: r.id,
          title: r.title,
          type: r.type,
          clientName: r.client_name || undefined,
          startDate: r.start_time,
          endDate: r.end_time,
          notes: r.notes || undefined,
          status: (r.status || "previsto") as EventStatus,
        })));
      }
    }).catch(() => {});
  }, []);

  if (!user) return null;

  return (
    <div className="main-chat">
      <div className="sidebar-summary">
        <DaySummary userId={user.id} events={events} onEventClick={() => {}} />
      </div>
      <div className="chat-area">
        <ChatPanel userId={user.id} />
      </div>
    </div>
  );
}
