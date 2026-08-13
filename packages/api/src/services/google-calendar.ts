import { google, calendar_v3 } from "googleapis";
import type { CalendarService } from "@assistente-fabi/ai";
import { TIMEZONE, DEFAULT_REMINDERS, CALENDAR_COLORS, APPOINTMENT_LABELS } from "@assistente-fabi/shared";
import type { AppointmentType } from "@assistente-fabi/shared";

export class GoogleCalendarService implements CalendarService {
  private calendar: calendar_v3.Calendar;

  constructor(accessToken: string) {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    this.calendar = google.calendar({ version: "v3", auth });
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

    const response = await this.calendar.events.insert({
      calendarId: "primary",
      requestBody: event,
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
