import Anthropic from "@anthropic-ai/sdk";
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
  }): Promise<unknown>;
  updateEvent(eventId: string, params: Record<string, unknown>): Promise<unknown>;
  deleteEvent(eventId: string): Promise<unknown>;
}

interface ConversationMessage {
  role: "user" | "assistant";
  content: string | Anthropic.ContentBlock[];
}

const conversations = new Map<string, ConversationMessage[]>();

export class FabiAgent {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async chat(
    userMessage: string,
    conversationId: string,
    calendar: CalendarService
  ): Promise<{ message: string; conversationId: string }> {
    if (!conversations.has(conversationId)) {
      conversations.set(conversationId, []);
    }
    const history = conversations.get(conversationId)!;

    history.push({ role: "user", content: userMessage });

    const now = new Date().toLocaleString("pt-BR", { timeZone: TIMEZONE });
    const systemPrompt = buildSystemPrompt(now);

    let response = await this.client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      tools: calendarTools,
      messages: history.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    while (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      history.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        const result = await this.executeTool(
          toolUse.name as ToolName,
          toolUse.input as Record<string, string>,
          calendar
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }

      history.push({ role: "user", content: toolResults });

      response = await this.client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: systemPrompt,
        tools: calendarTools,
        messages: history.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });
    }

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );
    const assistantMessage = textBlock?.text ?? "Desculpe, não consegui processar sua solicitação.";

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
