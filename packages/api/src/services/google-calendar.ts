import { google, calendar_v3 } from "googleapis";
import type { CalendarService } from "@assistente-fabi/ai";
import { TIMEZONE, DEFAULT_REMINDERS, CALENDAR_COLORS, APPOINTMENT_LABELS } from "@assistente-fabi/shared";
import type { AppointmentType } from "@assistente-fabi/shared";
import type { Credentials } from "google-auth-library";
import { DateTime } from "luxon";

export class GoogleCalendarService implements CalendarService {
  private calendar: calendar_v3.Calendar;

  constructor(credentials: Credentials, onTokens?: (tokens: Credentials) => void) {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    auth.setCredentials(credentials);
    auth.on("tokens", (tokens) => onTokens?.(tokens));
    this.calendar = google.calendar({ version: "v3", auth });
  }

  static todayBounds(now = DateTime.now().setZone(TIMEZONE)) {
    return {
      start: now.startOf("day").toUTC().toISO()!,
      end: now.endOf("day").toUTC().toISO()!,
    };
  }

  async listToday() {
    const bounds = GoogleCalendarService.todayBounds();
    return this.listEvents(bounds.start, bounds.end);
  }

  async listEvents(startDate: string, endDate: string) {
    const response = await this.calendar.events.list({
      calendarId: "primary",
      timeMin: startDate,
      timeMax: endDate,
      singleEvents: true,
      orderBy: "startTime",
      timeZone: TIMEZONE,
    });

    return (response.data.items || []).map((event) => ({
      id: event.id,
      title: event.summary || "Sem título",
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      description: event.description || "",
      location: event.location || "",
    }));
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
    const colorId = this.getColorId(params.appointmentType as AppointmentType);

    const event: calendar_v3.Schema$Event = {
      summary: params.title,
      start: { dateTime: params.startTime, timeZone: TIMEZONE },
      end: { dateTime: params.endTime, timeZone: TIMEZONE },
      description: params.description || "",
      colorId,
      reminders: {
        useDefault: false,
        overrides: DEFAULT_REMINDERS.map((minutes) => ({
          method: "popup",
          minutes,
        })),
      },
    };

    if (params.clientEmail) {
      event.attendees = [
        { email: params.clientEmail, displayName: params.clientName },
      ];
    }

    const response = await this.calendar.events.insert({
      calendarId: "primary",
      requestBody: event,
      sendUpdates: params.clientEmail ? "all" : "none",
    });

    return {
      id: response.data.id,
      title: response.data.summary,
      start: response.data.start?.dateTime,
      end: response.data.end?.dateTime,
      status: "created",
    };
  }

  async updateEvent(eventId: string, params: Record<string, unknown>) {
    const updateData: calendar_v3.Schema$Event = {};
    if (params.title) updateData.summary = params.title as string;
    if (params.startTime) updateData.start = { dateTime: params.startTime as string, timeZone: TIMEZONE };
    if (params.endTime) updateData.end = { dateTime: params.endTime as string, timeZone: TIMEZONE };
    if (params.description) updateData.description = params.description as string;

    const response = await this.calendar.events.patch({
      calendarId: "primary",
      eventId,
      requestBody: updateData,
    });

    return {
      id: response.data.id,
      title: response.data.summary,
      start: response.data.start?.dateTime,
      end: response.data.end?.dateTime,
      status: "updated",
    };
  }

  async deleteEvent(eventId: string) {
    await this.calendar.events.delete({
      calendarId: "primary",
      eventId,
    });

    return { id: eventId, status: "deleted" };
  }

  private getColorId(type: AppointmentType): string {
    const colorMap: Record<string, string> = {
      constelacao: "6",
      consultoria_financeira: "5",
      planejamento: "2",
      reuniao: "1",
      bloqueio_pessoal: "8",
      evento_curso: "3",
      outro: "7",
    };
    return colorMap[type] || "7";
  }
}
