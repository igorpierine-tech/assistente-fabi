"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./ContratosView.module.css";
import { apiFetch } from "@/lib/api";

interface ServiceDef {
  code: string;
  name: string;
  family: string;
}

interface ContractRow {
  id: string;
  contract_number: string;
  service_code: string;
  service_name: string;
  client_name: string | null;
  status: string;
  current_revision: number;
  created_at: string;
}

interface Sale {
  id: string;
  client_name: string;
  item_name: string;
  amount_cents: number;
  client_email: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  issued: "Emitido",
  awaiting_signature: "Aguardando assinatura",
  completed: "Concluído",
  voided: "Cancelado",
  expired: "Expirado",
  superseded: "Substituído",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "#6b6152",
  issued: "#2563eb",
  awaiting_signature: "#d97706",
  completed: "#16a34a",
  voided: "#dc2626",
  expired: "#9ca3af",
  superseded: "#9ca3af",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

async function api(path: string, opts?: RequestInit) {
  const res = await apiFetch(path, opts);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Erro desconhecido" }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res;
}

export function ContratosView() {
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [services, setServices] = useState<ServiceDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState<"servico" | "venda">("servico");
  const [selectedService, setSelectedService] = useState("");
  const [selectedSaleId, setSelectedSaleId] = useState("");
  const [sales, setSales] = useState<Sale[]>([]);
  const [creating, setCreating] = useState(false);

  const [issuingId, setIssuingId] = useState("");

  const fetchAll = useCallback(async () => {
    try {
      const [cRes, sRes] = await Promise.all([
        api("/contracts"),
        api("/contracts/services"),
      ]);
      setContracts(await cRes.json());
      setServices(await sRes.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fetchSales = useCallback(async () => {
    try {
      const res = await api("/sales");
      setSales(await res.json());
    } catch (_) { /* ignore */ }
  }, []);

  const openCreate = () => {
    setShowCreate(true);
    setCreateMode("servico");
    setSelectedService(services[0]?.code || "");
    setSelectedSaleId("");
    fetchSales();
  };

  const handleCreate = async () => {
    setCreating(true);
    setError("");
    try {
      const body: Record<string, unknown> = {};
      if (createMode === "venda" && selectedSaleId) {
        body.saleId = selectedSaleId;
      } else if (selectedService) {
        body.serviceCode = selectedService;
      }
      await api("/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setShowCreate(false);
      await fetchAll();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleIssue = async (id: string) => {
    setIssuingId(id);
    setError("");
    try {
      await api(`/contracts/${id}/issue`, { method: "POST" });
      await fetchAll();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIssuingId("");
    }
  };

  const handleDownload = async (id: string, contractNumber: string) => {
    try {
      const res = await apiFetch(`/contracts/${id}/pdf`);
      if (!res.ok) throw new Error("Falha ao baixar PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Contrato-${contractNumber.replace("/", "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleVoid = async (id: string) => {
    if (!confirm("Tem certeza que deseja cancelar este contrato?")) return;
    setError("");
    try {
      await api(`/contracts/${id}/void`, { method: "POST" });
      await fetchAll();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (loading) return <div className={styles.container}><p>Carregando...</p></div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Contratos</h2>
          <p className={styles.subtitle}>
            Motor de contratos com {services.length} tipos de serviço
          </p>
        </div>
        <button className={styles.addBtn} onClick={openCreate}>+ Novo Contrato</button>
      </div>

      {error && <div className={styles.errorBanner}>{error}<button onClick={() => setError("")}>×</button></div>}

      {contracts.length === 0 ? (
        <div className={styles.empty}>
          Nenhum contrato criado ainda. Clique em &quot;+ Novo Contrato&quot; para começar.
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nº</th>
                <th>Serviço</th>
                <th>Cliente</th>
                <th>Status</th>
                <th>Rev.</th>
                <th>Data</th>
                <th style={{ textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map(c => (
                <tr key={c.id}>
                  <td className={styles.numberCol}>{c.contract_number}</td>
                  <td>{c.service_name || c.service_code}</td>
                  <td className={styles.clientCol}>{c.client_name || "—"}</td>
                  <td>
                    <span
                      className={styles.statusBadge}
                      style={{ color: STATUS_COLORS[c.status] || "#6b6152", borderColor: STATUS_COLORS[c.status] || "#6b6152" }}
                    >
                      {STATUS_LABELS[c.status] || c.status}
                    </span>
                  </td>
                  <td style={{ textAlign: "center" }}>{c.current_revision}</td>
                  <td>{formatDate(c.created_at)}</td>
                  <td>
                    <div className={styles.actions}>
                      <button
                        className={styles.iconOnly}
                        onClick={() => handleDownload(c.id, c.contract_number)}
                        title="Baixar PDF"
                      >
                        PDF
                      </button>
                      {c.status === "draft" && (
                        <button
                          className={styles.issueBtn}
                          onClick={() => handleIssue(c.id)}
                          disabled={issuingId === c.id}
                        >
                          {issuingId === c.id ? "Emitindo..." : "Emitir"}
                        </button>
                      )}
                      {c.status !== "voided" && c.status !== "completed" && (
                        <button
                          className={`${styles.iconOnly} ${styles.iconBtnDanger}`}
                          onClick={() => handleVoid(c.id)}
                          title="Cancelar contrato"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <div className={styles.overlay} onClick={() => setShowCreate(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Novo Contrato</h3>

            <div className={styles.modeToggle}>
              <button
                className={`${styles.modeBtn} ${createMode === "servico" ? styles.modeBtnActive : ""}`}
                onClick={() => setCreateMode("servico")}
              >
                Por serviço
              </button>
              <button
                className={`${styles.modeBtn} ${createMode === "venda" ? styles.modeBtnActive : ""}`}
                onClick={() => setCreateMode("venda")}
              >
                A partir de venda
              </button>
            </div>

            <div className={styles.formGrid}>
              {createMode === "servico" ? (
                <div className={styles.field}>
                  <label>Tipo de serviço</label>
                  <select
                    value={selectedService}
                    onChange={e => setSelectedService(e.target.value)}
                  >
                    {services.map(s => (
                      <option key={s.code} value={s.code}>{s.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className={styles.field}>
                  <label>Venda</label>
                  <select
                    value={selectedSaleId}
                    onChange={e => setSelectedSaleId(e.target.value)}
                  >
                    <option value="">Selecione uma venda...</option>
                    {sales.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.client_name} — {s.item_name} ({(s.amount_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={() => setShowCreate(false)}>Cancelar</button>
              <button
                className={styles.btnPrimary}
                onClick={handleCreate}
                disabled={creating || (createMode === "venda" && !selectedSaleId) || (createMode === "servico" && !selectedService)}
              >
                {creating ? "Criando..." : "Criar contrato"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
