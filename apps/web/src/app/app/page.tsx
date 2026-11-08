"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Dashboard } from "@/components/Dashboard";
import type { CalendarEvent } from "@/components/CalendarView";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";

interface AppointmentRow {
  id: string;
  title: string;
  type: string;
  client_id: string | null;
  client_name: string | null;
  start_time: string;
  end_time: string;
  notes: string | null;
  status: string;
}

interface ClientRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
}

function buildDashboardClients(rows: ClientRow[], appointments: AppointmentRow[]) {
  const now = Date.now();
  const NEW_MS = 30 * 24 * 60 * 60 * 1000;
  const statsByClient = new Map<string, { count: number; lastDate: string | null }>();
  for (const appt of appointments) {
    const key = appt.client_id || (appt.client_name || "").toLowerCase();
    if (!key) continue;
    const prev = statsByClient.get(key) || { count: 0, lastDate: null };
    prev.count += 1;
    if (!prev.lastDate || appt.start_time > prev.lastDate) prev.lastDate = appt.start_time;
    statsByClient.set(key, prev);
  }
  return rows.map((row) => {
    const stats = statsByClient.get(row.id) || statsByClient.get(row.name.toLowerCase()) || { count: 0, lastDate: null };
    const createdAt = row.created_at ? Date.parse(row.created_at) : NaN;
    const isNew = Number.isFinite(createdAt) && now - createdAt < NEW_MS && stats.count === 0;
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

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [clients, setClients] = useState<ReturnType<typeof buildDashboardClients>>([]);

  const load = useCallback(async () => {
    try {
      const [apptRes, clientRes] = await Promise.all([
        apiFetch("/appointments"),
        apiFetch("/clients"),
      ]);
      const apptRows: AppointmentRow[] = apptRes.ok ? await apptRes.json() : [];
      const clientRows: ClientRow[] = clientRes.ok ? await clientRes.json() : [];
      setEvents(apptRows.map(r => ({
        id: r.id,
        title: r.title,
        type: r.type,
        clientName: r.client_name || undefined,
        startDate: r.start_time,
        endDate: r.end_time,
        notes: r.notes || undefined,
        status: (r.status || "previsto") as CalendarEvent["status"],
      })));
      setClients(buildDashboardClients(clientRows, apptRows));
    } catch { /* silent */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const VIEW_TO_PATH: Record<string, string> = {
    agenda: "/app/agenda",
    clientes: "/app/clientes",
    agendamentos: "/app/agendamentos",
    vendas: "/app/vendas",
    contratos: "/app/contratos",
    financeiro: "/app/financeiro",
  };

  return (
    <Dashboard
      userName={user?.name || ""}
      events={events}
      clients={clients}
      onNavigate={(v) => {
        const path = VIEW_TO_PATH[v] || "/app";
        router.push(path);
      }}
    />
  );
}
