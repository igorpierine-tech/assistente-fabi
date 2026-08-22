import OpenAI from "openai";
import { buildSystemPrompt } from "./system-prompt";
import { calendarTools, type ToolName } from "./tools";
import type { WorkspaceService } from "./workspace";
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
    userName?: string,
    workspace?: WorkspaceService
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
            calendar,
            workspace
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
    input: Record<string, unknown>,
    calendar: CalendarService,
    workspace?: WorkspaceService
  ): Promise<unknown> {
    const requireWorkspace = (): WorkspaceService => {
      if (!workspace) {
        throw new Error(
          "Ferramenta indisponível: workspace não configurado neste servidor."
        );
      }
      return workspace;
    };
    const s = (k: string) => (typeof input[k] === "string" ? (input[k] as string) : undefined);
    const n = (k: string) => (typeof input[k] === "number" ? (input[k] as number) : undefined);
    const b = (k: string) => (typeof input[k] === "boolean" ? (input[k] as boolean) : undefined);

    switch (name) {
      case "list_events":
        return calendar.listEvents(s("startDate")!, s("endDate")!);
      case "create_event":
        return calendar.createEvent({
          title: s("title")!,
          startTime: s("startTime")!,
          endTime: s("endTime")!,
          description: s("description"),
          appointmentType: s("appointmentType")!,
          clientName: s("clientName"),
          clientEmail: s("clientEmail"),
        });
      case "update_event": {
        const eventId = s("eventId")!;
        const updates: Record<string, unknown> = {};
        for (const key of ["title", "startTime", "endTime", "description"]) {
          if (input[key] !== undefined) updates[key] = input[key];
        }
        return calendar.updateEvent(eventId, updates);
      }
      case "delete_event":
        return calendar.deleteEvent(s("eventId")!);

      // ----- Clients -----
      case "list_clients":
        return requireWorkspace().listClients(s("search"));
      case "create_client":
        return requireWorkspace().createClient({
          name: s("name")!,
          phone: s("phone"),
          email: s("email"),
          notes: s("notes"),
        });
      case "update_client": {
        const id = s("clientId")!;
        const patch: Record<string, string> = {};
        for (const key of ["name", "phone", "email", "notes"]) {
          const v = s(key);
          if (v !== undefined) patch[key] = v;
        }
        return requireWorkspace().updateClient(id, patch);
      }
      case "delete_client":
        return requireWorkspace().deleteClient(s("clientId")!);

      // ----- Catalog -----
      case "list_catalog_items":
        return requireWorkspace().listCatalogItems();
      case "create_catalog_item":
        return requireWorkspace().createCatalogItem({
          name: s("name")!,
          kind: (s("kind") as "servico" | "produto") || "servico",
          price: (s("price") ?? n("price") ?? 0) as string | number,
          durationMinutes: n("durationMinutes"),
          description: s("description"),
          active: b("active"),
        });
      case "update_catalog_item": {
        const id = s("itemId")!;
        const patch: Record<string, unknown> = {};
        if (s("name") !== undefined) patch.name = s("name");
        if (s("kind") !== undefined) patch.kind = s("kind");
        if (input.price !== undefined) patch.price = input.price;
        if (n("durationMinutes") !== undefined) patch.durationMinutes = n("durationMinutes");
        if (s("description") !== undefined) patch.description = s("description");
        if (b("active") !== undefined) patch.active = b("active");
        return requireWorkspace().updateCatalogItem(id, patch);
      }
      case "delete_catalog_item":
        return requireWorkspace().deleteCatalogItem(s("itemId")!);

      // ----- Receivables -----
      case "list_receivables":
        return requireWorkspace().listReceivables(s("status"));
      case "get_receivables_summary":
        return requireWorkspace().getReceivablesSummary();
      case "create_receivable":
        return requireWorkspace().createReceivable({
          clientName: s("clientName")!,
          itemName: s("itemName")!,
          amount: (input.amount as string) ?? "0",
          serviceDate: s("serviceDate")!,
          dueDate: s("dueDate"),
          paymentMethod: s("paymentMethod") as
            | "pix"
            | "dinheiro"
            | "cartao_credito"
            | "cartao_debito"
            | "transferencia"
            | "boleto"
            | "outro"
            | undefined,
          notes: s("notes"),
        });
      case "mark_receivable_paid":
        return requireWorkspace().markReceivablePaid(s("receivableId")!, {
          paymentMethod: s("paymentMethod") as
            | "pix"
            | "dinheiro"
            | "cartao_credito"
            | "cartao_debito"
            | "transferencia"
            | "boleto"
            | "outro",
          paidAt: s("paidAt"),
          amount: input.amount as string | number | undefined,
        });
      case "delete_receivable":
        return requireWorkspace().deleteReceivable(s("receivableId")!);

      // ----- Sales -----
      case "list_sales":
        return requireWorkspace().listSales();
      case "create_sale":
        return requireWorkspace().createSale({
          clientName: s("clientName")!,
          clientId: s("clientId"),
          createClient: b("createClient"),
          clientDocument: s("clientDocument"),
          clientEmail: s("clientEmail"),
          clientPhone: s("clientPhone"),
          itemName: s("itemName")!,
          catalogItemId: s("catalogItemId"),
          amount: (input.amount as string) ?? "0",
          paymentMethod: s("paymentMethod") as
            | "pix"
            | "dinheiro"
            | "cartao_credito"
            | "cartao_debito"
            | "transferencia"
            | "boleto"
            | "outro"
            | undefined,
          installments: n("installments"),
          saleDate: s("saleDate"),
          notes: s("notes"),
        });
    }
  }

  clearConversation(conversationId: string): void {
    conversations.delete(conversationId);
  }
}
