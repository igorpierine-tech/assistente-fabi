export type AppointmentType =
  | "constelacao"
  | "consultoria_financeira"
  | "planejamento"
  | "reuniao"
  | "bloqueio_pessoal"
  | "evento_curso"
  | "outro";

export interface Appointment {
  id: string;
  title: string;
  type: AppointmentType;
  clientName?: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  notes?: string;
  calendarId?: string;
  reminders: number[]; // minutos antes (ex: [1440, 60] = 24h e 1h)
  googleEventId?: string;
}

export interface TimeSlot {
  start: string;
  end: string;
}

export interface ConflictCheck {
  hasConflict: boolean;
  conflictingEvents: Appointment[];
  suggestedSlots?: TimeSlot[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  audioUrl?: string;
}

export interface ChatRequest {
  message: string;
  conversationId?: string;
}

export interface VoiceRequest {
  audioBase64: string;
  mimeType: string;
  conversationId?: string;
}

export interface ChatResponse {
  message: string;
  action?: AgentAction;
  conversationId: string;
}

export type AgentAction =
  | { type: "list_events"; events: Appointment[] }
  | { type: "confirm_create"; appointment: Omit<Appointment, "id" | "googleEventId"> }
  | { type: "confirm_update"; appointmentId: string; changes: Partial<Appointment> }
  | { type: "confirm_delete"; appointmentId: string; appointment: Appointment }
  | { type: "event_created"; appointment: Appointment }
  | { type: "event_updated"; appointment: Appointment }
  | { type: "event_deleted"; appointmentId: string }
  | { type: "available_slots"; date: string; slots: TimeSlot[] }
  | { type: "none" };

export interface DailySummary {
  date: string;
  totalAppointments: number;
  firstAppointment?: string;
  lastAppointment?: string;
  appointments: Appointment[];
  isBusy: boolean;
}

export interface Client {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  appointmentHistory: string[];
  createdAt: string;
  updatedAt: string;
}
