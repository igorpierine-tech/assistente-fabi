import type { CalendarService } from "@assistente-fabi/ai";
import { GoogleCalendarService } from "./google-calendar";
import {
  createAppointment,
  updateAppointment,
  getAppointmentByGoogleId,
  deleteAppointment,
  getClientByName,
} from "./database";

export class SyncedCalendarService implements CalendarService {
  constructor(private calendar: GoogleCalendarService) {}

  async listToday() {
    return this.calendar.listToday();
  }

  async listEvents(startDate: string, endDate: string) {
    return this.calendar.listEvents(startDate, endDate);
  }

  async createEvent(params: {
    title: string;
    startTime: string;
    endTime: string;
    description?: string;
    appointmentType: string;
    clientName?: string;
    clientEmail?: string;
  }) {
    let clientId: string | undefined;
    let clientEmail = params.clientEmail;

    if (params.clientName) {
      const client = getClientByName(params.clientName);
      if (client) {
        clientId = client.id;
        if (!clientEmail && client.email) {
          clientEmail = client.email;
        }
      }
    }

    const result = await this.calendar.createEvent({
      ...params,
      clientEmail,
    });
    const googleEventId = (result as any).id;

    createAppointment({
      title: params.title,
      type: params.appointmentType,
      clientId,
      clientName: params.clientName,
      startTime: params.startTime,
      endTime: params.endTime,
      notes: params.description,
      googleEventId,
      status: "confirmado",
    });

    return result;
  }

  async updateEvent(eventId: string, params: Record<string, unknown>) {
    const result = await this.calendar.updateEvent(eventId, params);

    const existing = getAppointmentByGoogleId(eventId);
    if (existing) {
      const updates: Record<string, string> = {};
      if (params.title) updates.title = params.title as string;
      if (params.startTime) updates.startTime = params.startTime as string;
      if (params.endTime) updates.endTime = params.endTime as string;
      if (params.description) updates.notes = params.description as string;
      updateAppointment(existing.id, updates);
    }

    return result;
  }

  async deleteEvent(eventId: string) {
    const result = await this.calendar.deleteEvent(eventId);

    const existing = getAppointmentByGoogleId(eventId);
    if (existing) {
      deleteAppointment(existing.id);
    }

    return result;
  }
}
