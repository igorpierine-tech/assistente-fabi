export const calendarTools = [
  {
    name: "list_events" as const,
    description: "Lista eventos do Google Calendar em um período. Use para consultar a agenda, verificar conflitos ou checar disponibilidade.",
    input_schema: {
      type: "object" as const,
      properties: {
        startDate: {
          type: "string",
          description: "Data/hora de início no formato ISO 8601 (ex: 2026-07-30T00:00:00-04:00)",
        },
        endDate: {
          type: "string",
          description: "Data/hora de fim no formato ISO 8601 (ex: 2026-07-30T23:59:59-04:00)",
        },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "create_event" as const,
    description: "Cria um novo evento no Google Calendar. Use SOMENTE após a Fabiana confirmar o agendamento.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description: "Título do evento (ex: 'Constelação — Maria Silva')",
        },
        startTime: {
          type: "string",
          description: "Horário de início no formato ISO 8601",
        },
        endTime: {
          type: "string",
          description: "Horário de fim no formato ISO 8601",
        },
        description: {
          type: "string",
          description: "Descrição/observações do evento (opcional)",
        },
        appointmentType: {
          type: "string",
          enum: ["constelacao", "consultoria_financeira", "planejamento", "reuniao", "bloqueio_pessoal", "evento_curso", "outro"],
          description: "Tipo do compromisso para categorização",
        },
        clientName: {
          type: "string",
          description: "Nome do cliente (se aplicável)",
        },
      },
      required: ["title", "startTime", "endTime", "appointmentType"],
    },
  },
  {
    name: "update_event" as const,
    description: "Atualiza um evento existente. Use SOMENTE após a Fabiana confirmar a alteração.",
    input_schema: {
      type: "object" as const,
      properties: {
        eventId: {
          type: "string",
          description: "ID do evento no Google Calendar",
        },
        title: { type: "string", description: "Novo título (opcional)" },
        startTime: { type: "string", description: "Novo horário de início ISO 8601 (opcional)" },
        endTime: { type: "string", description: "Novo horário de fim ISO 8601 (opcional)" },
        description: { type: "string", description: "Nova descrição (opcional)" },
      },
      required: ["eventId"],
    },
  },
  {
    name: "delete_event" as const,
    description: "Remove um evento do Google Calendar. Use SOMENTE após a Fabiana confirmar o cancelamento.",
    input_schema: {
      type: "object" as const,
      properties: {
        eventId: {
          type: "string",
          description: "ID do evento a ser removido",
        },
      },
      required: ["eventId"],
    },
  },
];

export type ToolName = (typeof calendarTools)[number]["name"];
