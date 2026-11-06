export interface CnpjData {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  situacao_cadastral: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone: string;
  email: string;
  atividade_principal: string;
  natureza_juridica: string;
}

export async function consultarCnpj(cnpj: string): Promise<CnpjData> {
  const clean = cnpj.replace(/\D/g, "");
  if (clean.length !== 14) {
    throw new Error("CNPJ deve ter 14 dígitos");
  }

  const headers = { "User-Agent": "AssistenteFabi/1.0", "Accept": "application/json" };

  // Try BrasilAPI first
  let data: Record<string, unknown> | null = null;
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`, { headers });
    if (res.ok) {
      data = await res.json() as Record<string, unknown>;
    } else if (res.status === 404) {
      throw new Error("CNPJ não encontrado na base da Receita Federal");
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("não encontrado")) throw err;
  }

  // Fallback to ReceitaWS
  if (!data) {
    try {
      const res2 = await fetch(`https://receitaws.com.br/v1/cnpj/${clean}`, { headers });
      if (res2.ok) {
        const rw = await res2.json() as Record<string, unknown>;
        if (rw.status === "ERROR") throw new Error((rw.message as string) || "CNPJ não encontrado");
        const atv = Array.isArray(rw.atividade_principal) ? (rw.atividade_principal as Array<{ text?: string }>)[0]?.text || "" : "";
        return {
          cnpj: clean,
          razao_social: (rw.nome as string) || "",
          nome_fantasia: (rw.fantasia as string) || "",
          situacao_cadastral: (rw.situacao as string) || "",
          logradouro: (rw.logradouro as string) || "",
          numero: (rw.numero as string) || "",
          complemento: (rw.complemento as string) || "",
          bairro: (rw.bairro as string) || "",
          municipio: (rw.municipio as string) || "",
          uf: (rw.uf as string) || "",
          cep: (rw.cep as string) || "",
          telefone: (rw.telefone as string) || "",
          email: (rw.email as string) || "",
          atividade_principal: atv,
          natureza_juridica: (rw.natureza_juridica as string) || "",
        };
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("não encontrado")) throw err;
    }
  }

  if (!data) {
    throw new Error("Não foi possível consultar o CNPJ. Tente novamente em alguns minutos.");
  }

  const cnaeDesc = data.cnae_fiscal_descricao as string || "";

  return {
    cnpj: clean,
    razao_social: (data.razao_social as string) || "",
    nome_fantasia: (data.nome_fantasia as string) || "",
    situacao_cadastral: (data.descricao_situacao_cadastral as string) || "",
    logradouro: (data.logradouro as string) || "",
    numero: (data.numero as string) || "",
    complemento: (data.complemento as string) || "",
    bairro: (data.bairro as string) || "",
    municipio: (data.municipio as string) || "",
    uf: (data.uf as string) || "",
    cep: (data.cep as string) || "",
    telefone: (data.ddd_telefone_1 as string) || "",
    email: (data.email as string) || "",
    atividade_principal: cnaeDesc,
    natureza_juridica: (data.natureza_juridica as string) || "",
  };
}
