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
          title: { type: "string", description: "Título do evento (ex: 'Constelação — Maria Silva')" },
          startTime: { type: "string", description: "Horário de início ISO 8601" },
          endTime: { type: "string", description: "Horário de fim ISO 8601" },
          description: { type: "string", description: "Descrição/observações do evento (opcional)" },
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
          clientName: { type: "string", description: "Nome do cliente (se aplicável)" },
          clientEmail: {
            type: "string",
            description:
              "Email do cliente (opcional; é buscado do cadastro se não informado)",
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
        "Atualiza um evento existente. Use SOMENTE após confirmação da Fabiana.",
      parameters: {
        type: "object",
        properties: {
          eventId: { type: "string", description: "ID do evento no Google Calendar" },
          title: { type: "string", description: "Novo título (opcional)" },
          startTime: { type: "string", description: "Novo horário de início ISO 8601 (opcional)" },
          endTime: { type: "string", description: "Novo horário de fim ISO 8601 (opcional)" },
          description: { type: "string", description: "Nova descrição (opcional)" },
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
        "Remove um evento do Google Calendar. Use SOMENTE após confirmação da Fabiana.",
      parameters: {
        type: "object",
        properties: {
          eventId: { type: "string", description: "ID do evento a remover" },
        },
        required: ["eventId"],
      },
    },
  },

  // ---------- Clientes ----------
  {
    type: "function",
    function: {
      name: "list_clients",
      description: "Lista clientes cadastrados. Use `search` opcional para filtrar por nome/email/telefone.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Termo de busca (opcional)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_client",
      description:
        "Cadastra um novo cliente. Peça confirmação antes se o dado foi inferido.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nome completo (obrigatório)" },
          phone: { type: "string", description: "Telefone (opcional)" },
          email: { type: "string", description: "E-mail (opcional)" },
          notes: { type: "string", description: "Anotações/prontuário (opcional)" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_client",
      description: "Atualiza dados de um cliente existente.",
      parameters: {
        type: "object",
        properties: {
          clientId: { type: "string", description: "ID do cliente" },
          name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          notes: { type: "string" },
        },
        required: ["clientId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_client",
      description: "Remove um cliente. Peça confirmação antes.",
      parameters: {
        type: "object",
        properties: {
          clientId: { type: "string", description: "ID do cliente" },
        },
        required: ["clientId"],
      },
    },
  },

  // ---------- Catálogo (produtos e serviços) ----------
  {
    type: "function",
    function: {
      name: "list_catalog_items",
      description: "Lista os produtos e serviços cadastrados no catálogo.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "create_catalog_item",
      description:
        "Cria um novo produto ou serviço no catálogo. Preço em reais (aceita '150' ou '150,00').",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nome do item (obrigatório)" },
          kind: { type: "string", enum: ["servico", "produto"], description: "Tipo do item" },
          price: { type: "string", description: "Preço em reais (ex: '150,00')" },
          durationMinutes: {
            type: "number",
            description: "Duração em minutos (só para serviços)",
          },
          description: { type: "string", description: "Descrição opcional" },
          active: { type: "boolean", description: "Se está ativo (default true)" },
        },
        required: ["name", "kind", "price"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_catalog_item",
      description: "Atualiza um item do catálogo (nome, preço, duração, ativo etc.).",
      parameters: {
        type: "object",
        properties: {
          itemId: { type: "string", description: "ID do item" },
          name: { type: "string" },
          kind: { type: "string", enum: ["servico", "produto"] },
          price: { type: "string" },
          durationMinutes: { type: "number" },
          description: { type: "string" },
          active: { type: "boolean" },
        },
        required: ["itemId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_catalog_item",
      description: "Remove um item do catálogo. Peça confirmação antes.",
      parameters: {
        type: "object",
        properties: {
          itemId: { type: "string", description: "ID do item" },
        },
        required: ["itemId"],
      },
    },
  },

  // ---------- Financeiro (contas a receber) ----------
  {
    type: "function",
    function: {
      name: "list_receivables",
      description:
        "Lista lançamentos financeiros (contas a receber). `status` opcional filtra por pendente/pago/cancelado.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["pendente", "pago", "cancelado"] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_receivables_summary",
      description: "Resumo financeiro: total a receber, em atraso e recebido no mês.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "create_receivable",
      description:
        "Cria uma nova conta a receber. Use quando a Fabiana quiser registrar um valor a receber de um cliente.",
      parameters: {
        type: "object",
        properties: {
          clientName: { type: "string", description: "Nome do cliente" },
          itemName: { type: "string", description: "Nome do produto/serviço" },
          amount: { type: "string", description: "Valor em reais (ex: '250,00')" },
          serviceDate: { type: "string", description: "Data do serviço (YYYY-MM-DD ou ISO)" },
          dueDate: { type: "string", description: "Data de vencimento (opcional)" },
          paymentMethod: {
            type: "string",
            enum: ["pix", "dinheiro", "cartao_credito", "cartao_debito", "transferencia", "boleto", "outro"],
          },
          notes: { type: "string" },
        },
        required: ["clientName", "itemName", "amount", "serviceDate"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mark_receivable_paid",
      description: "Marca um lançamento como pago, com forma de pagamento e data.",
      parameters: {
        type: "object",
        properties: {
          receivableId: { type: "string", description: "ID do lançamento" },
          paymentMethod: {
            type: "string",
            enum: ["pix", "dinheiro", "cartao_credito", "cartao_debito", "transferencia", "boleto", "outro"],
          },
          paidAt: { type: "string", description: "Data do pagamento (opcional, default hoje)" },
          amount: { type: "string", description: "Valor pago em reais (opcional se igual ao lançamento)" },
        },
        required: ["receivableId", "paymentMethod"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_receivable",
      description: "Remove um lançamento financeiro. Peça confirmação.",
      parameters: {
        type: "object",
        properties: { receivableId: { type: "string" } },
        required: ["receivableId"],
      },
    },
  },

  // ---------- Vendas ----------
  {
    type: "function",
    function: {
      name: "list_sales",
      description: "Lista todas as vendas registradas.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "create_sale",
      description:
        "Registra uma venda. Se o cliente ainda não existe no cadastro e `createClient` for true, cria também.",
      parameters: {
        type: "object",
        properties: {
          clientName: { type: "string", description: "Nome do cliente" },
          clientId: { type: "string", description: "ID de cliente existente (opcional)" },
          createClient: { type: "boolean", description: "Se true, cria o cliente também no cadastro" },
          clientDocument: { type: "string", description: "CPF/Documento (opcional)" },
          clientEmail: { type: "string" },
          clientPhone: { type: "string" },
          itemName: { type: "string", description: "Nome do produto/serviço vendido" },
          catalogItemId: { type: "string", description: "ID do item do catálogo (opcional)" },
          amount: { type: "string", description: "Valor em reais" },
          paymentMethod: {
            type: "string",
            enum: ["pix", "dinheiro", "cartao_credito", "cartao_debito", "transferencia", "boleto", "outro"],
          },
          installments: { type: "number", description: "Número de parcelas (default 1)" },
          saleDate: { type: "string", description: "Data da venda (opcional, default hoje)" },
          notes: { type: "string", description: "Observações (aparecem no contrato)" },
        },
        required: ["clientName", "itemName", "amount"],
      },
    },
  },
];

export type ToolName =
  | "list_events"
  | "create_event"
  | "update_event"
  | "delete_event"
  | "list_clients"
  | "create_client"
  | "update_client"
  | "delete_client"
  | "list_catalog_items"
  | "create_catalog_item"
  | "update_catalog_item"
  | "delete_catalog_item"
  | "list_receivables"
  | "get_receivables_summary"
  | "create_receivable"
  | "mark_receivable_paid"
  | "delete_receivable"
  | "list_sales"
  | "create_sale";
