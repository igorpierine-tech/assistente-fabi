const ZAPSIGN_API = "https://api.zapsign.com.br/api/v1";

function getToken(): string {
  const token = process.env.ZAPSIGN_API_TOKEN;
  if (!token) throw new Error("ZAPSIGN_API_TOKEN não configurado");
  return token;
}

function headers() {
  return {
    Authorization: `Bearer ${getToken()}`,
    "Content-Type": "application/json",
  };
}

interface CreateDocResponse {
  open_id: number;
  token: string;
  name: string;
  status: string;
  signers: Array<{
    token: string;
    name: string;
    email: string;
    sign_url: string;
  }>;
}

interface Signer {
  name: string;
  email: string;
  phone?: string;
  lock_name?: boolean;
  lock_email?: boolean;
}

export async function createDocumentFromPdf(
  pdfBuffer: Buffer,
  name: string,
  signers: Signer[]
): Promise<CreateDocResponse> {
  const base64 = pdfBuffer.toString("base64");

  const body = {
    name,
    lang: "pt-br",
    signers: signers.map((s) => ({
      name: s.name,
      email: s.email,
      phone_country: "55",
      phone_number: s.phone?.replace(/\D/g, "") || "",
      lock_name: s.lock_name ?? true,
      lock_email: s.lock_email ?? true,
      auth_mode: "assinaturaTela",
      send_automatic_email: true,
      send_automatic_whatsapp: false,
    })),
    base64_pdf: base64,
  };

  const res = await fetch(`${ZAPSIGN_API}/docs/`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ZapSign createDocument failed (${res.status}): ${text}`);
  }

  return res.json();
}

interface DocStatusResponse {
  token: string;
  name: string;
  status: string;
  signers: Array<{
    token: string;
    name: string;
    email: string;
    status: string;
    sign_url: string;
    signed?: boolean;
  }>;
  signed_file?: string;
}

export async function getDocumentStatus(docToken: string): Promise<DocStatusResponse> {
  const res = await fetch(`${ZAPSIGN_API}/docs/${docToken}/`, {
    headers: headers(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ZapSign getDocument failed (${res.status}): ${text}`);
  }

  return res.json();
}

export function isConfigured(): boolean {
  return !!process.env.ZAPSIGN_API_TOKEN;
}
