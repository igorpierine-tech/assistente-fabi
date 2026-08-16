import type OpenAI from "openai";

export const calendarTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "list_events",
      description:
        "Lista eventos do Google Calendar em um período. Use para consultar a agenda, verificar conflitos ou checar disponibilidade.",
      parameters: {
        type: "object",
        properties: {
          startDate: {
            type: "string",
            description:
              "Data/hora de início no formato ISO 8601 (ex: 2026-07-30T00:00:00-04:00)",
          },
          endDate: {
            type: "string",
            description:
              "Data/hora de fim no formato ISO 8601 (ex: 2026-07-30T23:59:59-04:00)",
          },
        },
        required: ["startDate", "endDate"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_event",
      description:
        "Cria um novo evento no Google Calendar. Use SOMENTE após a Fabiana confirmar o agendamento.",
      parameters: {
        type: "object",
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
            enum: [
              "constelacao",
              "consultoria_financeira",
              "planejamento",
              "reuniao",
              "bloqueio_pessoal",
              "evento_curso",
              "outro",
            ],
            description: "Tipo do compromisso para categorização",
          },
          clientName: {
            type: "string",
            description: "Nome do cliente (se aplicável)",
          },
          clientEmail: {
            type: "string",
            description: "Email do cliente para enviar convite do evento (opcional, será buscado automaticamente do cadastro se não informado)",
          },
        },
        required: ["title", "startTime", "endTime", "appointmentType"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_event",
      description:
        "Atualiza um evento existente. Use SOMENTE após a Fabiana confirmar a alteração.",
      parameters: {
        type: "object",
        properties: {
          eventId: {
            type: "string",
            description: "ID do evento no Google Calendar",
          },
          title: { type: "string", description: "Novo título (opcional)" },
          startTime: {
            type: "string",
            description: "Novo horário de início ISO 8601 (opcional)",
          },
          endTime: {
            type: "string",
            description: "Novo horário de fim ISO 8601 (opcional)",
          },
          description: {
            type: "string",
            description: "Nova descrição (opcional)",
          },
        },
        required: ["eventId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_event",
      description:
        "Remove um evento do Google Calendar. Use SOMENTE após a Fabiana confirmar o cancelamento.",
      parameters: {
        type: "object",
        properties: {
          eventId: {
            type: "string",
            description: "ID do evento a ser removido",
          },
        },
        required: ["eventId"],
      },
    },
  },
];

export type ToolName =
  | "list_events"
  | "create_event"
  | "update_event"
  | "delete_event";
