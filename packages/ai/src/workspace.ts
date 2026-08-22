/**
 * A thin interface describing every non-calendar action the AI agent can
 * perform. The API package supplies an implementation backed by SQLite;
 * the agent stays agnostic of the database.
 */

export type PaymentMethod =
  | "pix"
  | "dinheiro"
  | "cartao_credito"
  | "cartao_debito"
  | "transferencia"
  | "boleto"
  | "outro";

export interface WorkspaceService {
  // Clients
  listClients(search?: string): Promise<unknown[]> | unknown[];
  createClient(data: {
    name: string;
    phone?: string;
    email?: string;
    notes?: string;
  }): Promise<unknown> | unknown;
  updateClient(
    id: string,
    data: Partial<{ name: string; phone: string; email: string; notes: string }>
  ): Promise<unknown> | unknown;
  deleteClient(id: string): Promise<boolean> | boolean;

  // Catalog
  listCatalogItems(): Promise<unknown[]> | unknown[];
  createCatalogItem(data: {
    name: string;
    kind: "servico" | "produto";
    price: string | number;
    durationMinutes?: number;
    description?: string;
    active?: boolean;
  }): Promise<unknown> | unknown;
  updateCatalogItem(
    id: string,
    data: Partial<{
      name: string;
      kind: "servico" | "produto";
      price: string | number;
      durationMinutes: number | null;
      description: string;
      active: boolean;
    }>
  ): Promise<unknown> | unknown;
  deleteCatalogItem(id: string): Promise<boolean> | boolean;

  // Receivables
  listReceivables(status?: string): Promise<unknown[]> | unknown[];
  getReceivablesSummary(): Promise<unknown> | unknown;
  createReceivable(data: {
    clientName: string;
    itemName: string;
    amount: string | number;
    serviceDate: string;
    dueDate?: string;
    paymentMethod?: PaymentMethod;
    notes?: string;
  }): Promise<unknown> | unknown;
  markReceivablePaid(
    id: string,
    data: { paymentMethod: PaymentMethod; paidAt?: string; amount?: string | number }
  ): Promise<unknown> | unknown;
  deleteReceivable(id: string): Promise<boolean> | boolean;

  // Sales
  listSales(): Promise<unknown[]> | unknown[];
  createSale(data: {
    clientName: string;
    clientId?: string;
    createClient?: boolean;
    clientDocument?: string;
    clientEmail?: string;
    clientPhone?: string;
    itemName: string;
    catalogItemId?: string;
    amount: string | number;
    paymentMethod?: PaymentMethod;
    installments?: number;
    saleDate?: string;
    notes?: string;
  }): Promise<unknown> | unknown;
}
