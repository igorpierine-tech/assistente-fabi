import OpenAI from "openai";
import { buildSystemPrompt } from "./system-prompt";
import { calendarTools, type ToolName } from "./tools";
import { TIMEZONE } from "@assistente-fabi/shared";

export interface CalendarService {
  listEvents(startDate: string, endDate: string): Promise<unknown[]>;
  createEvent(params: {
    title: string;
    startTime: string;
    endTime: string;
    description?: string;
    appointmentType: string;
    clientName?: string;
    clientEmail?: string;
  }): Promise<unknown>;
  updateEvent(eventId: string, params: Record<string, unknown>): Promise<unknown>;
  deleteEvent(eventId: string): Promise<unknown>;
}

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

const MAX_CONVERSATIONS = 200;
const CONVERSATION_TTL_MS = 4 * 60 * 60 * 1000; // 4 horas
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

interface ConversationEntry {
  messages: ChatMessage[];
  lastAccess: number;
}

const conversations = new Map<string, ConversationEntry>();

function pruneConversations(): void {
  const now = Date.now();
  for (const [id, entry] of conversations) {
    if (now - entry.lastAccess > CONVERSATION_TTL_MS) {
      conversations.delete(id);
    }
  }
  if (conversations.size > MAX_CONVERSATIONS) {
    const sorted = [...conversations.entries()].sort(
      (a, b) => a[1].lastAccess - b[1].lastAccess
    );
    for (let i = 0; i < sorted.length - MAX_CONVERSATIONS; i++) {
      conversations.delete(sorted[i][0]);
    }
  }
}

export class FabiAgent {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async chat(
    userMessage: string,
    conversationId: string,
    calendar: CalendarService,
    userName?: string
  ): Promise<{ message: string; conversationId: string }> {
    pruneConversations();

    if (!conversations.has(conversationId)) {
      conversations.set(conversationId, { messages: [], lastAccess: Date.now() });
    }
    const entry = conversations.get(conversationId)!;
    entry.lastAccess = Date.now();
    const history = entry.messages;

    history.push({ role: "user", content: userMessage });

    const now = new Date().toLocaleString("pt-BR", { timeZone: TIMEZONE });
    const systemPrompt = buildSystemPrompt(now, userName);

    const buildMessages = (): ChatMessage[] => [
      { role: "system", content: systemPrompt },
      ...history,
    ];

    let response = await this.client.chat.completions.create({
      model: MODEL,
      max_tokens: 2048,
      messages: buildMessages(),
      tools: calendarTools,
    });

    let choice = response.choices[0];
    let loopGuard = 0;

    while (
      choice.finish_reason === "tool_calls" &&
      choice.message.tool_calls &&
      choice.message.tool_calls.length > 0 &&
      loopGuard < 8
    ) {
      loopGuard++;
      const assistantMsg = choice.message;

      history.push({
        role: "assistant",
        content: assistantMsg.content ?? null,
        tool_calls: assistantMsg.tool_calls,
      });

      for (const toolCall of assistantMsg.tool_calls!) {
        if (toolCall.type !== "function") continue;

        let args: Record<string, string> = {};
        try {
          args = JSON.parse(toolCall.function.arguments || "{}");
        } catch {
          args = {};
        }

        let result: unknown;
        try {
          result = await this.executeTool(
            toolCall.function.name as ToolName,
            args,
            calendar
          );
        } catch (error) {
          result = {
            error:
              error instanceof Error ? error.message : "Erro ao executar ferramenta",
          };
        }

        history.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }

      response = await this.client.chat.completions.create({
        model: MODEL,
        max_tokens: 2048,
        messages: buildMessages(),
        tools: calendarTools,
      });
      choice = response.choices[0];
    }

    const assistantMessage =
      choice.message.content ?? "Desculpe, não consegui processar sua solicitação.";

    history.push({ role: "assistant", content: assistantMessage });

    if (history.length > 40) {
      history.splice(0, history.length - 30);
    }

    return { message: assistantMessage, conversationId };
  }

  private async executeTool(
    name: ToolName,
    input: Record<string, string>,
    calendar: CalendarService
  ): Promise<unknown> {
    switch (name) {
      case "list_events":
        return calendar.listEvents(input.startDate, input.endDate);
      case "create_event":
        return calendar.createEvent({
          title: input.title,
          startTime: input.startTime,
          endTime: input.endTime,
          description: input.description,
          appointmentType: input.appointmentType,
          clientName: input.clientName,
          clientEmail: input.clientEmail,
        });
      case "update_event": {
        const { eventId, ...updates } = input;
        return calendar.updateEvent(eventId, updates);
      }
      case "delete_event":
        return calendar.deleteEvent(input.eventId);
    }
  }

  clearConversation(conversationId: string): void {
    conversations.delete(conversationId);
  }
}
