# Plano de Ação — Avaliação Assistente Fabi

> Baseado nos achados de `AVALIACAO_COMPLETA.md`. Nenhuma correção foi implementada.

---

## Bloqueadores Antes de Qualquer Produção

Estes itens devem ser resolvidos **antes** de permitir qualquer empresa real na plataforma. Podem ser feitos em paralelo.

### B1. Autenticar webhook ZapSign [SEC-001]

- **Severidade:** P0
- **Benefício:** Impede fraude contratual (contratos forjados como "assinados")
- **Esforço:** P (1-2 dias)
- **Dependências:** Documentação ZapSign sobre webhook signatures
- **Perfil:** Backend sênior
- **Critério de aceite:** Webhook sem assinatura válida recebe 401. Teste automatizado cobre o cenário.
- **Testes de regressão:** Webhook legítimo continua atualizando status do contrato.
- **Arquivo:** `packages/api/src/routes/sales.ts` (zapSignWebhookRouter) e `packages/api/src/index.ts:52`

### B2. Sanitizar uploads SVG [SEC-002]

- **Severidade:** P0
- **Benefício:** Elimina vetor de XSS stored via logo/favicon
- **Esforço:** P (1 dia)
- **Dependências:** Biblioteca de sanitização (DOMPurify / svg-sanitize)
- **Perfil:** Backend
- **Critério de aceite:** SVG com `<script>`, `onload`, `javascript:` é limpo ou rejeitado. Teste automatizado.
- **Testes de regressão:** SVGs legítimos (paths, circles, gradients) passam normalmente.
- **Arquivo:** `packages/api/src/routes/tenant.ts:9-16`

### B3. Proteger rate limiting contra bypass [SEC-003]

- **Severidade:** P0
- **Benefício:** Impede brute force, abuso de IA, DDoS em endpoints públicos
- **Esforço:** M (2-3 dias)
- **Dependências:** Redis (pode ser mesmo da futura sessão) ou proxy/WAF
- **Perfil:** Backend / DevOps
- **Critério de aceite:** Rate limit idêntico independente da instância; teste com IPs distintos. Como mínimo viável: configurar rate limit no proxy (Railway/nginx).
- **Testes de regressão:** Limites atuais continuam valendo em single-instance.
- **Arquivo:** `packages/api/src/middleware/security.ts:32-65`

### B4. Completar deleteUserData — LGPD Art. 18 [SEC-004]

- **Severidade:** P0
- **Benefício:** Evita violação de LGPD por retenção ilegal de dados pessoais
- **Esforço:** M (2-3 dias)
- **Dependências:** Mapeamento de todas as tabelas com PII (9 identificadas: contracts, sales, receivables, appointments, bookings, nfse, google_tokens, conversations, messages)
- **Perfil:** Backend sênior
- **Critério de aceite:** `deleteUserData()` remove registros de TODAS as tabelas com PII do tenant. Teste automatizado verifica que nenhum registro pessoal permanece após exclusão. Log de auditoria da exclusão.
- **Testes de regressão:** Exclusão de um usuário não afeta dados de outros usuários do mesmo tenant.
- **Arquivo:** `packages/api/src/services/database.ts:1249-1298`

### B5. Completar exportUserData — Portabilidade LGPD Art. 18 [SEC-005]

- **Severidade:** P0
- **Benefício:** Garante direito de portabilidade conforme LGPD
- **Esforço:** M (2-3 dias)
- **Dependências:** B4 (mesmo mapeamento de tabelas)
- **Perfil:** Backend sênior
- **Critério de aceite:** `exportUserData()` inclui dados de TODAS as tabelas com PII do tenant. Formato JSON estruturado. Teste verifica que exportação contém todos os domínios.
- **Testes de regressão:** Exportação não altera dados; pode ser executada múltiplas vezes com mesmo resultado.
- **Arquivo:** `packages/api/src/services/database.ts:1300-1330`

---

## 0–7 Dias (Pós-bloqueadores)

### 1. Health check e readiness probe [OPS-002]

- **Severidade:** P1
- **Benefício:** Railway detecta degradação e reinicia automaticamente
- **Esforço:** P (meio dia)
- **Dependências:** Nenhuma
- **Perfil:** Backend
- **Critério de aceite:** `GET /health` retorna 200. `GET /ready` verifica DB connection. Railway configurado.
- **Testes de regressão:** —
- **Grupo:** Pode ser combinado com B3 no mesmo deploy.

### 2. Testes unitários para auth e multi-tenant [OPS-001 parcial]

- **Severidade:** P1
- **Benefício:** Rede de segurança mínima para os fluxos mais críticos
- **Esforço:** M (3-4 dias)
- **Dependências:** Configurar Vitest ou manter node:test
- **Perfil:** Backend + QA
- **Critério de aceite:** ≥20 testes cobrindo: login, select-tenant, middleware auth, middleware tenant, ownerId isolation, role checks.
- **Testes de regressão:** Os 5 testes existentes continuam passando.

### 3. Verificação de IDOR nas rotas por ID [SEC-007]

- **Severidade:** P1
- **Benefício:** Garante isolamento de dados entre tenants
- **Esforço:** M (2-3 dias)
- **Dependências:** Testes unitários do item 2
- **Perfil:** Backend sênior + AppSec
- **Critério de aceite:** Para cada rota GET/PUT/DELETE com `:id`, teste comprova que tenant A não acessa recurso de tenant B. Verificação explícita no código de que o recurso pertence ao ownerId.
- **Testes de regressão:** Acesso legítimo continua funcionando para todos os papéis.

### 4. Expiração de token mobile [SEC-008]

- **Severidade:** P1
- **Benefício:** Limita janela de uso de token comprometido
- **Esforço:** P (1 dia)
- **Dependências:** Nenhuma
- **Perfil:** Backend
- **Critério de aceite:** Token com mais de 30 dias (configurável) é rejeitado. Teste automatizado.
- **Testes de regressão:** Token recente continua válido. Fluxo mobile de exchange continua funcionando.
- **Arquivo:** `packages/api/src/services/mobile-auth.ts`

### 5. Corrigir session fixation na troca de tenant [SEC-011]

- **Severidade:** P1
- **Benefício:** Impede que sessão capturada em tenant A seja reutilizada para acessar tenant B
- **Esforço:** P (meio dia)
- **Dependências:** Nenhuma
- **Perfil:** Backend
- **Critério de aceite:** `session.regenerate()` chamado antes de atribuir novo `selectedOwner`. Session ID muda a cada troca de tenant. Teste automatizado.
- **Testes de regressão:** Dados da sessão (userId, role) preservados após regeneração.
- **Arquivo:** `packages/api/src/routes/auth.ts:168-213`

### 6. Invalidar sessões após troca de senha [SEC-014]

- **Severidade:** P1
- **Benefício:** Sessão comprometida perde acesso ao trocar senha
- **Esforço:** P (1 dia)
- **Dependências:** Nenhuma
- **Perfil:** Backend
- **Critério de aceite:** Após super admin alterar senha de usuário, todas as sessões daquele usuário são destruídas. Teste automatizado.
- **Testes de regressão:** Sessão do próprio admin permanece ativa.
- **Arquivo:** `packages/api/src/routes/users.ts`

### 7. Cookie SameSite e proteção CSRF [SEC-015]

- **Severidade:** P1
- **Benefício:** Impede CSRF via requests cross-origin
- **Esforço:** P (1-2 dias)
- **Dependências:** Validar comportamento no mobile (que pode precisar de SameSite=None para API calls)
- **Perfil:** Backend
- **Critério de aceite:** SameSite=Lax em produção (com exceção controlada para mobile bearer token). CSRF token para requests de mutação em rotas de sessão. Teste automatizado.
- **Arquivo:** `packages/api/src/index.ts` (sessionMiddleware config)

---

## 8–30 Dias

### 8. Sandboxing do customPrompt [SEC-009]

- **Severidade:** P1
- **Benefício:** Previne prompt injection via configuração de tenant
- **Esforço:** P (1-2 dias)
- **Dependências:** Nenhuma
- **Perfil:** Backend + IA
- **Critério de aceite:** customPrompt com "ignore as regras" não altera comportamento de segurança do agente. Teste adversarial documentado.
- **Arquivo:** `packages/ai/src/system-prompt.ts:10-12`

### 9. Confirmação de ações destrutivas no agente IA [SEC-010]

- **Severidade:** P1
- **Benefício:** Previne exclusão acidental de dados pelo modelo
- **Esforço:** M (3-5 dias — frontend + backend)
- **Dependências:** Acordo de UX para fluxo de confirmação
- **Perfil:** Full-stack + UX
- **Critério de aceite:** Ferramentas destrutivas (delete_*, create_event, update_event) requerem flag `confirmed: true` no segundo request. Frontend exibe confirmação ao usuário.

### 10. Verificação de permissões nas ferramentas da IA [SEC-016]

- **Severidade:** P1
- **Benefício:** Impede que IA execute ações além das permissões do usuário (papel/perfil/módulo)
- **Esforço:** M (2-3 dias)
- **Dependências:** Nenhuma
- **Perfil:** Backend + IA
- **Critério de aceite:** Cada ferramenta do FabiAgent verifica `session.role`, `session.profile` e módulos habilitados antes de executar. Profissional sem acesso a NFS-e não consegue emitir via chat. Teste automatizado por papel.
- **Arquivo:** `packages/api/src/services/workspace-service.ts:73-174`

### 11. Criptografar Google OAuth tokens [SEC-013]

- **Severidade:** P1
- **Benefício:** Protege tokens OAuth em repouso; reduz impacto de vazamento de banco
- **Esforço:** P (1-2 dias)
- **Dependências:** Nenhuma
- **Perfil:** Backend
- **Critério de aceite:** `access_token` e `refresh_token` armazenados com AES-256-GCM (mesma chave da sessão ou derivada). Leitura descriptografa transparentemente. Migração para tokens existentes.
- **Arquivo:** `packages/api/src/services/google-tokens-db.ts:22-38`

### 12. Upload com verificação de conteúdo real [SEC-012]

- **Severidade:** P1
- **Benefício:** Impede upload de executáveis/scripts disfarçados com MIME inofensivo
- **Esforço:** P (1 dia)
- **Dependências:** Biblioteca de detecção (file-type / mmmagic)
- **Perfil:** Backend
- **Critério de aceite:** MIME type verificado por magic bytes, não apenas pelo Content-Type do request. Teste: .exe renomeado para .png é rejeitado.
- **Arquivo:** `packages/api/src/routes/tenant.ts`

### 13. Certificado digital PFX — controles de acesso [DAT-003]

- **Severidade:** P1
- **Benefício:** Protege certificado digital A1 contra acesso indevido
- **Esforço:** M (2-3 dias)
- **Dependências:** Nenhuma
- **Perfil:** Backend + Segurança
- **Critério de aceite:** PFX criptografado em repouso. Acesso restrito ao serviço NFS-e. Senha do certificado não armazenada em texto claro. Auditoria de acesso.
- **Arquivo:** `packages/api/src/routes/nfse.ts:106-121`

### 14. Reconciliação ZapSign após falha [DAT-004]

- **Severidade:** P1
- **Benefício:** Detecta e recupera contratos cujo status ficou desatualizado por falha do webhook
- **Esforço:** M (2-3 dias)
- **Dependências:** B1 (autenticação webhook)
- **Perfil:** Backend
- **Critério de aceite:** Job periódico consulta status dos contratos pendentes na ZapSign. Divergências logadas e corrigidas. Alerta se contrato permanece pendente >48h.

### 15. Reconciliação NFS-e após falha [DAT-005]

- **Severidade:** P1
- **Benefício:** Previne duplicatas fiscais e detecta notas cujo status divergiu
- **Esforço:** M (2-3 dias)
- **Dependências:** Nenhuma
- **Perfil:** Backend + fiscal
- **Critério de aceite:** Endpoint de consulta de status implementado. NFS-e com status divergente entre banco local e API Nacional logada com alerta. Flag de idempotência para evitar reemissão.

### 16. CI/CD pipeline mínimo [OPS-004]

- **Severidade:** P2
- **Benefício:** Gate de qualidade automático; impossibilidade de deploy sem build+test
- **Esforço:** M (2-3 dias)
- **Dependências:** Corrigir ESLint do web (ou excluir do gate inicialmente)
- **Perfil:** DevOps
- **Critério de aceite:** PR para main roda: `pnpm install` → `pnpm lint` → `pnpm test` → `pnpm build`. Falha bloqueia merge.

### 17. Logs estruturados [OPS-003]

- **Severidade:** P2
- **Benefício:** Debugging em produção viável; busca por tenant/request
- **Esforço:** M (2-3 dias)
- **Dependências:** Escolha de logger (recomendação: pino)
- **Perfil:** Backend
- **Critério de aceite:** Toda request logada com: timestamp ISO, requestId, tenantId, userId, method, path, status, duration. Nenhum `console.log/error` remanescente.

### 18. Backup automatizado de SQLite [OPS-005]

- **Severidade:** P2
- **Benefício:** RPO ≤ 1h; recuperação possível em caso de perda
- **Esforço:** M (2-3 dias)
- **Dependências:** Acesso ao volume Railway ou equivalente
- **Perfil:** DevOps / SRE
- **Critério de aceite:** Backup diário executando. Restauração testada. Alerta se backup falha 2x consecutivas.

### 19. Paginação nos endpoints de listagem [ARQ-004]

- **Severidade:** P2
- **Benefício:** Performance previsível com crescimento de dados
- **Esforço:** M (3-5 dias — API + frontend)
- **Dependências:** Nenhuma
- **Perfil:** Full-stack
- **Critério de aceite:** Endpoints `/clients`, `/appointments`, `/sales`, `/contracts`, `/receivables` aceitam `?limit=N&cursor=X`. Dashboard queries filtram no SQL, não em JS.

### 20. Observabilidade de custo OpenAI [AI-002]

- **Severidade:** P2
- **Benefício:** Visibilidade de custo por tenant; alerta de abuso
- **Esforço:** P (1-2 dias)
- **Dependências:** Logger estruturado (item 17)
- **Perfil:** Backend
- **Critério de aceite:** Cada chamada OpenAI logada com: tokens prompt/completion, modelo, latência, tenantId. Métrica acumulada por tenant acessível em admin.

### 21. Preservar status de pagamento ao atualizar venda [DAT-006]

- **Severidade:** P2
- **Benefício:** Impede perda de dados de pagamento ao editar uma venda
- **Esforço:** P (1-2 dias)
- **Dependências:** Nenhuma
- **Perfil:** Backend
- **Critério de aceite:** Update de venda preserva `status` e `paidAt` de parcelas já pagas. Teste: atualizar venda com 3 parcelas (1 paga) não reseta a paga.
- **Arquivo:** `packages/api/src/routes/sales.ts:186-187`

### 22. Ampliar cobertura de testes para ≥40% [OPS-001]

- **Severidade:** P1
- **Benefício:** Confiança para refatorar; detecção precoce de regressões
- **Esforço:** G (10-15 dias)
- **Dependências:** CI pipeline (item 16)
- **Perfil:** Backend + QA
- **Critério de aceite:** Cobertura medida por c8v/istanbul ≥40% nas packages/api e packages/ai. Casos críticos: auth, tenant isolation, vendas+parcelas, contratos lifecycle, NFS-e validation.
- **Testes de regressão:** Coverage report no CI.

---

## 31–90 Dias

### 23. Migrar session store para Redis/PostgreSQL [SEC-006]

- **Severidade:** P1
- **Benefício:** Sessões persistentes entre instâncias; escalabilidade horizontal
- **Esforço:** M (3-5 dias)
- **Dependências:** Redis ou PostgreSQL em produção
- **Perfil:** Backend + DevOps
- **Critério de aceite:** Sessão criada na instância A é reconhecida na instância B. Zero downtime em deploy.

### 24. Migrar rate limit para Redis [SEC-003 complemento]

- **Severidade:** P2
- **Benefício:** Rate limit correto com múltiplas instâncias
- **Esforço:** P (1-2 dias — se Redis já disponível do item 23)
- **Dependências:** Redis (item 23)
- **Perfil:** Backend
- **Critério de aceite:** Rate limit idêntico entre instâncias. Teste de carga confirma.

### 25. Refatorar database.ts [ARQ-001]

- **Severidade:** P2
- **Benefício:** Manutenibilidade; reduz risco de regressão em mudanças de schema
- **Esforço:** M (3-5 dias)
- **Dependências:** Cobertura de testes ≥40% (item 22)
- **Perfil:** Backend sênior
- **Critério de aceite:** `database.ts` com ≤400 linhas (init + migrations). CRUD em arquivos de domínio separados. Todos os testes passam.

### 26. Sistema de migrações numeradas [ARQ-005]

- **Severidade:** P2
- **Benefício:** Versionamento de schema por tenant; rollback possível
- **Esforço:** M (3-5 dias)
- **Dependências:** Refatoração database.ts (item 25)
- **Perfil:** Backend sênior
- **Critério de aceite:** Tabela `schema_version` em cada tenant DB. Migrações numeradas e idempotentes. Script de verificação de versão.

### 27. Minimização de PII no agente IA [AI-003]

- **Severidade:** P2
- **Benefício:** Reduz risco de vazamento de PII via resposta do modelo
- **Esforço:** P (1-2 dias)
- **Dependências:** Nenhuma
- **Perfil:** Backend + IA
- **Critério de aceite:** Ferramentas de listagem retornam apenas nome e ID para o modelo. Documento e telefone mascarados.

### 28. Textos contratuais configuráveis [DAT-001]

- **Severidade:** P1
- **Benefício:** Cláusulas editáveis sem deploy; rastreabilidade; adequação jurídica
- **Esforço:** G (5-10 dias — backend + frontend + revisão jurídica)
- **Dependências:** **Revisão jurídica formal** ⚠️
- **Perfil:** Full-stack + jurídico
- **Critério de aceite:** Cláusulas armazenadas em banco, versionadas, editáveis pelo admin. Revisão jurídica aprovada.

### 29. Homologação NFS-e por município [DAT-002]

- **Severidade:** P1
- **Benefício:** Emissão fiscal válida; compliance tributário
- **Esforço:** G (variável — 5-15 dias por município)
- **Dependências:** Certificado de teste, acesso ao ambiente de homologação, **parecer contábil** ⚠️
- **Perfil:** Backend + fiscal/contábil
- **Critério de aceite:** Emissão, consulta e cancelamento bem-sucedidos no ambiente de homologação do município-alvo.

### 30. Reconstrução de contexto IA a partir do banco [AI-001]

- **Severidade:** P2
- **Benefício:** Conversas sobrevivem a restarts do servidor
- **Esforço:** M (2-3 dias)
- **Dependências:** Nenhuma
- **Perfil:** Backend
- **Critério de aceite:** Após restart, conversa retomada mantém contexto das últimas N mensagens do banco.

### 31. Exclusão de venda com verificação de dependências [DAT-010]

- **Severidade:** P2
- **Benefício:** Impede exclusão de vendas vinculadas a contratos ou NFS-e emitidas
- **Esforço:** P (1-2 dias)
- **Dependências:** Nenhuma
- **Perfil:** Backend
- **Critério de aceite:** DELETE de venda verifica existência de contratos ou NFS-e vinculados. Se existirem, retorna 409 Conflict com mensagem clara.

### 32. Corrigir race condition na numeração de contratos [DAT-007]

- **Severidade:** P2
- **Benefício:** Previne contratos com mesmo número em acessos concorrentes
- **Esforço:** P (1 dia)
- **Dependências:** Nenhuma
- **Perfil:** Backend
- **Critério de aceite:** Numeração via `INSERT ... RETURNING` ou lock de advisory. Teste de concorrência com 10 requests simultâneos gera 10 números distintos.
- **Arquivo:** `packages/api/src/services/contracts-db.ts:176-187`

---

## Evolução Posterior (90+ dias)

| # | Item | Severidade | Esforço | Perfil |
|---|---|---|---|---|
| 33 | Alinhar React 18→19 no mobile (quando Expo suportar) | P2 | M | Mobile |
| 34 | Telas mobile para dashboards e NFS-e | P2 | G | Mobile + UX |
| 35 | Remover conteúdo demonstrativo residual do mobile | P2 | P | Mobile |
| 36 | Tratamento de estado offline/rede instável | P3 | G | Full-stack |
| 37 | Remover/arquivar diretório legado raizes-e-riquezas | P3 | P | DevOps |
| 38 | Audit de dependências (npm audit) | P2 | P | DevOps |
| 39 | Métricas e tracing (OpenTelemetry) | P2 | G | SRE |
| 40 | Testes E2E com Playwright (web) e Detox (mobile) | P2 | G | QA |
| 41 | Disaster recovery e runbook operacional | P2 | M | SRE |
| 42 | Atualizar .env.example (remover ANTHROPIC_API_KEY) | P3 | P | Backend |
| 43 | Migração gradual para PostgreSQL completo | P2 | G | Backend + DBA |
| 44 | Acessibilidade WCAG 2.1 AA audit completo | P2 | G | UX + Frontend |
| 45 | Timezone configurável por tenant (atualmente -03:00 fixo) | P2 | P | Backend |
| 46 | Validação de schema para argumentos das ferramentas IA | P2 | P | Backend + IA |
| 47 | Circuit breaker e retry para chamadas OpenAI | P2 | P | Backend |
| 48 | Restringir leitura de conversas IA por admin | P2 | P | Backend + LGPD |

---

## Ordem Causal Recomendada

```
BLOQUEADORES (B1, B2, B3, B4, B5) — em paralelo
        │
        ▼
SEMANA 1 (1, 2, 3, 4, 5, 6, 7) — em paralelo
        │
        ▼
SEMANA 2-4 (8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21) — em paralelo
        │
        ▼
MÊS 2 (22) ← depende de 16
        │
        ▼
MÊS 2-3 (23, 24) — em paralelo ← 24 depende de 23
        │
        ▼
MÊS 2-3 (25, 26) — em sequência ← 26 depende de 25; ambos dependem de 22
        │
        ▼
MÊS 2-3 (27, 28, 29, 30, 31, 32) — em paralelo
        │
        ▼
90+ DIAS (33-48) — priorizar conforme necessidade do negócio
```

---

## Perfis Necessários

| Perfil | Itens | Alocação Estimada |
|---|---|---|
| Backend sênior | B1-B5, 1-7, 8, 10-15, 20-21, 23, 25-27, 30-32 | Dedicação integral 45 dias |
| DevOps / SRE | B3, 1, 16, 18, 23, 24 | Parcial 30 dias |
| Full-stack | 9, 19, 28 | 20 dias |
| QA | 2, 3, 22, 40 | 25 dias |
| AppSec | 3, revisão de 8, 10, 13 | 7 dias |
| IA | 8, 9, 10, 27, 46, 47 | 10 dias |
| Mobile | 34, 35 | 10 dias |
| UX | 9, 34, 44 | 5 dias |
| **Jurídico** ⚠️ | 28 | Externo — revisão de cláusulas contratuais |
| **Contábil** ⚠️ | 29 | Externo — homologação NFS-e por município |
| **Compliance** ⚠️ | 13, B4, B5 | Externo — validação de controles LGPD e certificado digital |
