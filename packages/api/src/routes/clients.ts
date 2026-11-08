import { Router, type Router as ExpressRouter } from "express";
import {
  listClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  getClientAppointments,
} from "../services/database";
import "../session-types";
import { requireUser, sharedOwnerId, readOwnerId } from "../middleware/auth";
import { optionalEmail, optionalId, optionalString, requiredString } from "../services/validation";

const router: ExpressRouter = Router();
router.use(requireUser);
router.param("id", (req, _res, next, value) => {
  optionalId(value, "ID do cliente");
  next();
});

router.get("/", (req, res) => {
  const userId = readOwnerId(req);
  const search = optionalString(req.query.search, "Busca", 100);
  const clients = listClients(userId, search);
  res.json(clients);
});

router.get("/:id", (req, res) => {
  const client = getClient(readOwnerId(req), req.params.id);
  if (!client) {
    res.status(404).json({ error: "Cliente não encontrado" });
    return;
  }
  res.json(client);
});

router.post("/", (req, res) => {
  const name = requiredString(req.body?.name, "Nome", 160);
  const phone = optionalString(req.body?.phone, "Telefone", 32);
  const email = optionalEmail(req.body?.email);
  const notes = optionalString(req.body?.notes, "Prontuário", 10_000);
  const document = optionalString(req.body?.document, "Documento", 20);
  const tipo_pessoa = optionalString(req.body?.tipo_pessoa, "Tipo de pessoa", 2);
  const address = optionalString(req.body?.address, "Endereço", 500);
  const inscricao_estadual = optionalString(req.body?.inscricao_estadual, "Inscrição Estadual", 20);
  const endereco_logradouro = optionalString(req.body?.endereco_logradouro, "Logradouro", 200);
  const endereco_numero = optionalString(req.body?.endereco_numero, "Número", 20);
  const endereco_complemento = optionalString(req.body?.endereco_complemento, "Complemento", 100);
  const endereco_bairro = optionalString(req.body?.endereco_bairro, "Bairro", 100);
  const endereco_cidade = optionalString(req.body?.endereco_cidade, "Cidade", 100);
  const endereco_uf = optionalString(req.body?.endereco_uf, "UF", 2);
  const endereco_cep = optionalString(req.body?.endereco_cep, "CEP", 10);
  const endereco_codigo_municipio = optionalString(req.body?.endereco_codigo_municipio, "Código Município", 7);
  const client = createClient(sharedOwnerId(req), { name, phone, email, notes, document, tipo_pessoa, address, inscricao_estadual, endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_uf, endereco_cep, endereco_codigo_municipio });
  res.status(201).json(client);
});

router.put("/:id", (req, res) => {
  const userId = sharedOwnerId(req);
  const existing = getClient(userId, req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Cliente não encontrado" });
    return;
  }
  const name = optionalString(req.body?.name, "Nome", 160);
  const phone = optionalString(req.body?.phone, "Telefone", 32);
  const email = optionalEmail(req.body?.email);
  const notes = optionalString(req.body?.notes, "Prontuário", 10_000);
  const document = optionalString(req.body?.document, "Documento", 20);
  const tipo_pessoa = optionalString(req.body?.tipo_pessoa, "Tipo de pessoa", 2);
  const address = optionalString(req.body?.address, "Endereço", 500);
  const inscricao_estadual = optionalString(req.body?.inscricao_estadual, "Inscrição Estadual", 20);
  const endereco_logradouro = optionalString(req.body?.endereco_logradouro, "Logradouro", 200);
  const endereco_numero = optionalString(req.body?.endereco_numero, "Número", 20);
  const endereco_complemento = optionalString(req.body?.endereco_complemento, "Complemento", 100);
  const endereco_bairro = optionalString(req.body?.endereco_bairro, "Bairro", 100);
  const endereco_cidade = optionalString(req.body?.endereco_cidade, "Cidade", 100);
  const endereco_uf = optionalString(req.body?.endereco_uf, "UF", 2);
  const endereco_cep = optionalString(req.body?.endereco_cep, "CEP", 10);
  const endereco_codigo_municipio = optionalString(req.body?.endereco_codigo_municipio, "Código Município", 7);
  const updated = updateClient(userId, req.params.id, { name, phone, email, notes, document, tipo_pessoa, address, inscricao_estadual, endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_uf, endereco_cep, endereco_codigo_municipio });
  res.json(updated);
});

router.delete("/:id", (req, res) => {
  const deleted = deleteClient(sharedOwnerId(req), req.params.id);
  if (!deleted) {
    res.status(404).json({ error: "Cliente não encontrado" });
    return;
  }
  res.status(204).end();
});

router.get("/:id/appointments", (req, res) => {
  const userId = readOwnerId(req);
  const client = getClient(userId, req.params.id);
  if (!client) {
    res.status(404).json({ error: "Cliente não encontrado" });
    return;
  }
  const appointments = getClientAppointments(userId, req.params.id);
  res.json(appointments);
});

export { router as clientsRouter };
