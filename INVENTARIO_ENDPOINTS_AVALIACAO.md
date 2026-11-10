# Inventário de Endpoints — Assistente Fabi

> Gerado em 10/11/2026 por leitura direta do código-fonte.

## Convenções

- **Auth:** `session` = cookie de sessão | `bearer` = token mobile | `none` = sem autenticação
- **Tenant:** `sim` = requer tenant ativo na sessão | `não` = opera no master DB ou público
- **Módulo:** módulo exigido por `requireTenantModule` ou `requireModule`
- **Papel:** papel mínimo exigido por `requireRole` ou `requireMinRole`
- **Validação:** `zod` = schema Zod | `manual` = validação inline | `—` = sem validação de body (GET)
- **Efeito colateral:** integrações externas ou side effects além da persistência principal

---

## Autenticação (`/auth`)

| Método | Rota | Auth | Tenant | Módulo | Papel | Validação | Persistência | Efeito Colateral | Risco |
|---|---|---|---|---|---|---|---|---|---|
| POST | `/auth/login` | none | não | — | — | zod (loginSchema) | Master DB (read) | Rate limit login | — |
| POST | `/auth/select-tenant` | session | não | — | — | zod (selectTenantSchema) | Master DB (read), session (write) | — | — |
| POST | `/auth/mobile/exchange` | none | não | — | — | manual | Consome pending login | Gera token assinado | Token sem expiração (SEC-006) |
| GET | `/auth/status` | session | não | — | — | — | Master DB (read) | — | — |
| POST | `/auth/logout` | session | não | — | — | — | Session (destroy) | — | — |
| GET | `/auth/google-calendar` | session | não | — | — | — | — | Redirect para Google OAuth | HMAC state sem TTL |
| GET | `/auth/google-calendar/callback` | none | não | — | — | — | Master DB (write: google_tokens) | Troca code por tokens Google | — |
| POST | `/auth/google-calendar/disconnect` | session | não | — | — | — | Master DB (delete: google_tokens) | — | — |
| GET | `/auth/google-calendar/status` | session | não | — | — | — | Master DB (read) | — | — |

## Clientes (`/clients`)

| Método | Rota | Auth | Tenant | Módulo | Papel | Validação | Persistência | Efeito Colateral | Risco |
|---|---|---|---|---|---|---|---|---|---|
| GET | `/clients` | session/bearer | sim | clientes | — | — | Tenant DB (read) | — | Sem paginação |
| GET | `/clients/:id` | session/bearer | sim | clientes | — | — | Tenant DB (read) | — | IDOR potencial (SEC-005) |
| POST | `/clients` | session/bearer | sim | clientes | — | manual | Tenant DB (write) | — | — |
| PUT | `/clients/:id` | session/bearer | sim | clientes | — | manual | Tenant DB (write) | — | IDOR potencial |
| DELETE | `/clients/:id` | session/bearer | sim | clientes | — | — | Tenant DB (delete) | — | IDOR potencial |
| GET | `/clients/:id/appointments` | session/bearer | sim | clientes | — | — | Tenant DB (read) | — | — |

## Agenda (`/appointments`)

| Método | Rota | Auth | Tenant | Módulo | Papel | Validação | Persistência | Efeito Colateral | Risco |
|---|---|---|---|---|---|---|---|---|---|
| GET | `/appointments` | session/bearer | sim | agenda | — | — | Tenant DB (read) | Auto-import Google (se vazio) | Sem paginação |
| GET | `/appointments/:id` | session/bearer | sim | agenda | — | — | Tenant DB (read) | — | — |
| POST | `/appointments` | session/bearer | sim | agenda | — | zod | Tenant DB (write) | Cria evento Google Calendar | — |
| PUT | `/appointments/:id` | session/bearer | sim | agenda | — | zod | Tenant DB (write) | Atualiza evento Google; Cria receivable se "concluido" | — |
| DELETE | `/appointments/:id` | session/bearer | sim | agenda | — | — | Tenant DB (delete) | Deleta evento Google | — |
| POST | `/appointments/sync-from-google` | session/bearer | sim | agenda | — | — | Tenant DB (write) | Lê eventos Google Calendar | — |

## Chat / Assistente (`/chat`)

| Método | Rota | Auth | Tenant | Módulo | Papel | Validação | Persistência | Efeito Colateral | Risco |
|---|---|---|---|---|---|---|---|---|---|
| POST | `/chat/message` | session/bearer | sim | assistente | — | manual | Tenant DB (write) | Chamada OpenAI + tool calls | Custo OpenAI; prompt injection (SEC-007) |
| POST | `/chat/voice` | session/bearer | sim | assistente | — | multer (25MB) | Tenant DB (write) | OpenAI Whisper + Chat | Upload sem scan |
| GET | `/chat/conversations` | session/bearer | sim | assistente | — | — | Tenant DB (read) | — | — |
| GET | `/chat/conversations/:id` | session/bearer | sim | assistente | — | — | Tenant DB (read) | — | — |
| DELETE | `/chat/conversations/:id` | session/bearer | sim | assistente | — | — | Tenant DB (delete) | — | — |

## Vendas (`/sales`)

| Método | Rota | Auth | Tenant | Módulo | Papel | Validação | Persistência | Efeito Colateral | Risco |
|---|---|---|---|---|---|---|---|---|---|
| GET | `/sales` | session/bearer | sim | vendas | — | — | Tenant DB (read) | — | Sem paginação |
| GET | `/sales/:id` | session/bearer | sim | vendas | — | — | Tenant DB (read) | — | — |
| POST | `/sales` | session/bearer | sim | vendas | — | manual | Tenant DB (write) | Cria parcelas e opcionalmente cliente | — |
| PUT | `/sales/:id` | session/bearer | sim | vendas | — | manual | Tenant DB (write) | Recalcula parcelas | — |
| DELETE | `/sales/:id` | session/bearer | sim | vendas | — | — | Tenant DB (delete) | — | Deleta parcelas vinculadas |
| GET | `/sales/:id/contract` | session/bearer | sim | vendas | — | — | — | Gera PDF em memória | — |
| GET | `/sales/zapsign/status` | session/bearer | sim | vendas | — | — | — | — | — |
| POST | `/sales/:id/send-signature` | session/bearer | sim | vendas | — | manual | Tenant DB (write) | Envia PDF à ZapSign | Custo ZapSign |
| GET | `/sales/:id/signature-status` | session/bearer | sim | vendas | — | — | — | Consulta ZapSign | — |

## Contratos (`/contracts`)

| Método | Rota | Auth | Tenant | Módulo | Papel | Validação | Persistência | Efeito Colateral | Risco |
|---|---|---|---|---|---|---|---|---|---|
| GET | `/contracts/zapsign/status` | session/bearer | sim | contratos | — | — | — | — | — |
| GET | `/contracts/services` | session/bearer | sim | contratos | — | — | Tenant DB (read) | — | — |
| GET | `/contracts/services/:code` | session/bearer | sim | contratos | — | — | Tenant DB (read) | — | — |
| GET | `/contracts` | session/bearer | sim | contratos | — | — | Tenant DB (read) | — | Sem paginação |
| GET | `/contracts/:id` | session/bearer | sim | contratos | — | — | Tenant DB (read) | — | — |
| POST | `/contracts` | session/bearer | sim | contratos | — | manual | Tenant DB (write) | — | Textos hardcoded (DAT-001) |
| PUT | `/contracts/:id/snapshot` | session/bearer | sim | contratos | — | manual | Tenant DB (write) | — | — |
| POST | `/contracts/:id/issue` | session/bearer | sim | contratos | — | manual | Tenant DB (write) | Gera PDF | — |
| GET | `/contracts/:id/pdf` | session/bearer | sim | contratos | — | — | Tenant DB (read) | — | — |
| POST | `/contracts/:id/send-signature` | session/bearer | sim | contratos | — | manual | Tenant DB (write) | Envia à ZapSign | Custo ZapSign |
| GET | `/contracts/:id/signature-status` | session/bearer | sim | contratos | — | — | — | Consulta ZapSign | — |
| POST | `/contracts/:id/void` | session/bearer | sim | contratos | — | — | Tenant DB (write) | — | — |
| DELETE | `/contracts/:id` | session/bearer | sim | contratos | — | — | Tenant DB (delete) | — | Bloqueado p/ completed |

## Agendamento Público (`/booking` + `/agendar`)

| Método | Rota | Auth | Tenant | Módulo | Papel | Validação | Persistência | Efeito Colateral | Risco |
|---|---|---|---|---|---|---|---|---|---|
| GET | `/booking/settings` | session/bearer | sim | agendamentos | — | — | Tenant DB (read) | — | — |
| PUT | `/booking/settings` | session/bearer | sim | agendamentos | — | manual | Tenant DB (write) | — | — |
| GET | `/booking/types` | session/bearer | sim | agendamentos | — | — | Tenant DB (read) | — | — |
| GET | `/booking/requests` | session/bearer | sim | agendamentos | — | — | Tenant DB (read) | — | — |
| GET | `/booking/requests/pending-count` | session/bearer | sim | agendamentos | — | — | Tenant DB (read) | — | — |
| POST | `/booking/requests/:id/confirm` | session/bearer | sim | agendamentos | — | manual | Tenant DB (write) | Google Calendar | — |
| POST | `/booking/requests/:id/reject` | session/bearer | sim | agendamentos | — | — | Tenant DB (write) | — | — |
| GET | `/booking/public-url` | session/bearer | sim | agendamentos | — | — | — | — | — |
| GET | `/agendar/:slug` | none | não | — | — | — | Tenant DB (read) | — | — |
| GET | `/agendar/:slug/availability` | none | não | — | — | — | Tenant DB (read) | — | — |
| POST | `/agendar/:slug/request` | none | não | — | — | zod | Tenant DB (write) | — | Rate limit público |
| GET | `/agendar/manage/:token` | none | não | — | — | — | Tenant DB (read) | — | — |
| POST | `/agendar/manage/:token/cancel` | none | não | — | — | — | Tenant DB (write) | — | — |

## Catálogo (`/catalog`)

| Método | Rota | Auth | Tenant | Módulo | Papel | Validação | Persistência | Efeito Colateral | Risco |
|---|---|---|---|---|---|---|---|---|---|
| GET | `/catalog` | session/bearer | sim | vendas | — | — | Tenant DB (read) | — | Módulo=vendas |
| GET | `/catalog/:id` | session/bearer | sim | vendas | — | — | Tenant DB (read) | — | — |
| POST | `/catalog` | session/bearer | sim | vendas | — | manual | Tenant DB (write) | — | — |
| PUT | `/catalog/:id` | session/bearer | sim | vendas | — | manual | Tenant DB (write) | — | — |
| DELETE | `/catalog/:id` | session/bearer | sim | vendas | — | — | Tenant DB (delete) | — | — |

## Financeiro (`/receivables`)

| Método | Rota | Auth | Tenant | Módulo | Papel | Validação | Persistência | Efeito Colateral | Risco |
|---|---|---|---|---|---|---|---|---|---|
| GET | `/receivables` | session/bearer | sim | financeiro | — | — | Tenant DB (read) | — | Sem paginação |
| GET | `/receivables/summary` | session/bearer | sim | financeiro | — | — | Tenant DB (read) | — | — |
| GET | `/receivables/:id` | session/bearer | sim | financeiro | — | — | Tenant DB (read) | — | — |
| POST | `/receivables` | session/bearer | sim | financeiro | — | manual | Tenant DB (write) | — | — |
| PUT | `/receivables/:id` | session/bearer | sim | financeiro | — | manual | Tenant DB (write) | — | — |
| DELETE | `/receivables/:id` | session/bearer | sim | financeiro | — | — | Tenant DB (delete) | — | — |
| POST | `/receivables/:id/mark-paid` | session/bearer | sim | financeiro | — | manual | Tenant DB (write) | — | — |
| POST | `/receivables/:id/mark-pending` | session/bearer | sim | financeiro | — | — | Tenant DB (write) | — | — |

## NFS-e (`/nfse`)

| Método | Rota | Auth | Tenant | Módulo | Papel | Validação | Persistência | Efeito Colateral | Risco |
|---|---|---|---|---|---|---|---|---|---|
| GET | `/nfse/status` | session/bearer | sim | financeiro | — | — | Tenant DB (read) | — | — |
| GET | `/nfse/config` | session/bearer | sim | financeiro | — | — | Tenant DB (read) | — | — |
| PUT | `/nfse/config` | session/bearer | sim | financeiro | — | manual | Tenant DB (write) | — | — |
| POST | `/nfse/certificate` | session/bearer | sim | financeiro | — | manual | Tenant DB (write) | — | Cert criptografado |
| DELETE | `/nfse/certificate` | session/bearer | sim | financeiro | — | — | Tenant DB (write) | — | — |
| GET | `/nfse/invoices` | session/bearer | sim | financeiro | — | — | Tenant DB (read) | — | — |
| GET | `/nfse/invoices/:id` | session/bearer | sim | financeiro | — | — | Tenant DB (read) | — | — |
| POST | `/nfse/emitir` | session/bearer | sim | financeiro | — | manual | Tenant DB (write) | **Emite NFS-e** | Requer homologação |
| POST | `/nfse/invoices/:id/consultar` | session/bearer | sim | financeiro | — | — | Tenant DB (write) | Consulta NFS-e | — |
| POST | `/nfse/invoices/:id/cancelar` | session/bearer | sim | financeiro | — | manual | Tenant DB (write) | **Cancela NFS-e** | Irreversível |
| GET | `/nfse/sale/:saleId` | session/bearer | sim | financeiro | — | — | Tenant DB (read) | — | — |

## Dashboard (`/dashboard`)

| Método | Rota | Auth | Tenant | Módulo | Papel | Validação | Persistência | Efeito Colateral | Risco |
|---|---|---|---|---|---|---|---|---|---|
| GET | `/dashboard/kpis` | session/bearer | sim | inicio | — | — | Tenant DB (read) | — | Carrega tudo em memória |
| GET | `/dashboard/analytics` | session/bearer | sim | inicio | — | — | Tenant DB (read) | — | Carrega tudo em memória |

## Usuários (`/users`)

| Método | Rota | Auth | Tenant | Módulo | Papel | Validação | Persistência | Efeito Colateral | Risco |
|---|---|---|---|---|---|---|---|---|---|
| GET | `/users` | session/bearer | sim | usuarios | admin | — | Master DB (read) | — | — |
| GET | `/users/:id` | session/bearer | sim | usuarios | admin | — | Master DB (read) | — | — |
| POST | `/users` | session/bearer | sim | usuarios | admin | manual | Master DB (write) | — | — |
| PUT | `/users/:id` | session/bearer | sim | usuarios | admin | manual | Master DB (write) | — | — |
| PUT | `/users/:id/password` | session/bearer | sim | usuarios | admin | manual | Master DB (write) | — | — |

## Tenant / Config (`/tenant`)

| Método | Rota | Auth | Tenant | Módulo | Papel | Validação | Persistência | Efeito Colateral | Risco |
|---|---|---|---|---|---|---|---|---|---|
| GET | `/tenant/config` | session/bearer | sim | — | — | — | Tenant DB (read) | — | — |
| PUT | `/tenant/config` | session/bearer | sim | — | — | manual | Tenant DB (write) | — | — |
| GET | `/tenant/branding/logo` | session/bearer | sim | — | — | — | Tenant DB (read) | — | — |
| POST | `/tenant/branding/logo` | session/bearer | sim | — | — | multer | Tenant DB (write) | — | **SVG XSS** |
| DELETE | `/tenant/branding/logo` | session/bearer | sim | — | — | — | Tenant DB (write) | — | — |
| GET | `/tenant/branding/favicon` | session/bearer | sim | — | — | — | Tenant DB (read) | — | — |
| POST | `/tenant/branding/favicon` | session/bearer | sim | — | — | multer | Tenant DB (write) | — | SVG XSS |
| GET | `/tenant/empresa` | session/bearer | sim | — | — | — | Tenant DB (read) | — | — |
| PUT | `/tenant/empresa` | session/bearer | sim | — | — | manual | Tenant DB (write) | — | — |

## Privacidade (`/privacy`)

| Método | Rota | Auth | Tenant | Módulo | Papel | Validação | Persistência | Efeito Colateral | Risco |
|---|---|---|---|---|---|---|---|---|---|
| GET | `/privacy/status` | session/bearer | não | — | — | — | Tenant DB (read) | — | — |
| POST | `/privacy/consent` | session/bearer | não | — | — | manual | Tenant DB (write) | — | — |
| GET | `/privacy/export` | session/bearer | não | — | — | — | Tenant DB (read) | — | Exporta PII |
| DELETE | `/privacy/account` | session/bearer | não | — | — | manual | Ambos (delete) | Revoga Google token | Irreversível |

## Plataforma / Cadastro (`/platform`)

| Método | Rota | Auth | Tenant | Módulo | Papel | Validação | Persistência | Efeito Colateral | Risco |
|---|---|---|---|---|---|---|---|---|---|
| GET | `/platform/cnpj/:cnpj` | none | não | — | — | — | — | API CNPJ externa | Rate limit |
| POST | `/platform/register` | none | não | — | — | zod | Master + Tenant DB | Cria tenant + admin | Rate limit |

## Admin Sistema (`/system`)

| Método | Rota | Auth | Tenant | Módulo | Papel | Validação | Persistência | Efeito Colateral | Risco |
|---|---|---|---|---|---|---|---|---|---|
| GET | `/system/my-modules` | session | não | — | — | — | Master DB (read) | — | — |
| GET | `/system/modules` | session | não | — | super_admin | — | — | — | — |
| GET | `/system/profiles` | session | sim | — | super_admin | — | Master DB (read) | — | — |
| POST | `/system/profiles` | session | sim | — | super_admin | zod | Master DB (write) | — | — |
| PUT | `/system/profiles/:id` | session | sim | — | super_admin | zod | Master DB (write) | — | — |
| DELETE | `/system/profiles/:id` | session | sim | — | super_admin | — | Master DB (delete) | — | — |
| GET | `/system/tenants` | session | não | — | super_admin | — | Master DB (read) | — | — |
| GET | `/system/tenants/:id` | session | não | — | super_admin | — | Master DB (read) | — | — |
| POST | `/system/tenants` | session | não | — | super_admin | zod | Master + Tenant DB | Cria tenant DB | — |
| GET | `/system/tenants/:id/empresa` | session | não | — | super_admin | — | Tenant DB (read) | — | — |
| PUT | `/system/tenants/:id` | session | não | — | super_admin | zod | Master + Tenant DB | — | — |
| DELETE | `/system/tenants/:id` | session | não | — | super_admin | — | Master DB (delete) | — | Não apaga tenant DB |
| GET | `/system/tenants/:id/users` | session | não | — | super_admin | — | Master DB (read) | — | — |
| POST | `/system/tenants/:id/users` | session | não | — | super_admin | zod | Master DB (write) | — | — |
| PUT | `/system/tenants/:tId/users/:uId/profile` | session | não | — | super_admin | — | Master DB (write) | — | — |
| PUT | `/system/tenants/:tId/users/:uId` | session | não | — | super_admin | zod | Master DB (write) | — | — |
| DELETE | `/system/tenants/:tId/users/:uId` | session | não | — | super_admin | — | Master DB (delete) | — | — |
| GET | `/system/plans` | session | não | — | super_admin | — | Master DB (read) | — | — |
| POST | `/system/plans` | session | não | — | super_admin | zod | Master DB (write) | — | — |
| PUT | `/system/plans/:id` | session | não | — | super_admin | zod | Master DB (write) | — | — |
| GET | `/system/subscriptions` | session | não | — | super_admin | — | Master DB (read) | — | — |
| GET | `/system/subscriptions/:tenantId` | session | não | — | super_admin | — | Master DB (read) | — | — |
| POST | `/system/subscriptions` | session | não | — | super_admin | zod | Master DB (write) | — | — |
| PUT | `/system/subscriptions/:id` | session | não | — | super_admin | zod | Master DB (write) | — | — |
| POST | `/system/set-password` | session | não | — | super_admin | zod | Master DB (write) | — | — |
| GET | `/system/metrics` | session | não | — | super_admin | — | Master DB (read) | — | — |

## Webhooks

| Método | Rota | Auth | Tenant | Módulo | Papel | Validação | Persistência | Efeito Colateral | Risco |
|---|---|---|---|---|---|---|---|---|---|
| POST | `/webhooks/zapsign` | **none** | não | — | — | nenhuma | Tenant DB (write) | Atualiza status contratos | **P0 — SEM AUTH** |

## Páginas Públicas

| Método | Rota | Auth | Tenant | Módulo | Papel | Validação | Persistência | Efeito Colateral | Risco |
|---|---|---|---|---|---|---|---|---|---|
| GET | `/` | none | não | — | — | — | — | — | — |
| GET | `/privacidade` | none | não | — | — | — | — | — | — |
| GET | `/termos` | none | não | — | — | — | — | — | — |

---

## Resumo

| Métrica | Valor |
|---|---|
| Total de endpoints | ~90 |
| Endpoints autenticados | ~75 |
| Endpoints públicos | ~15 |
| Com validação Zod | ~20 |
| Com validação manual | ~25 |
| Sem validação body | ~45 (maioria GET) |
| Com efeito externo | ~12 |
| Com risco identificado | ~15 |
