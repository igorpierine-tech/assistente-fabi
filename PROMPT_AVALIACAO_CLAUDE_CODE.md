# Prompt para avaliação completa no Claude Code

Copie e envie todo o conteúdo abaixo ao Claude Code, executando-o na raiz deste repositório.

---

Você atuará como uma equipe sênior multidisciplinar composta por arquiteto de software, engenheiro backend, especialista web, especialista React Native/Expo, QA, AppSec, SRE/DevOps, especialista em IA, UX/acessibilidade, privacidade/LGPD e analista de produto.

Sua missão é realizar uma **avaliação completa, crítica, baseada em evidências e sem complacência** da solução existente neste repositório. Não presuma que uma funcionalidade está pronta porque há uma tela ou uma rota: confirme o fluxo ponta a ponta no código, a persistência, as permissões, os estados de erro e os testes.

## Contexto resumido

Esta é uma plataforma SaaS multiempresa de gestão de negócios de serviços, chamada Assistente Fabi / Raízes e Riquezas. O monorepo contém:

- `apps/web`: portal Next.js/React;
- `apps/mobile`: aplicativo Expo/React Native;
- `packages/api`: API Express, persistência e integrações;
- `packages/ai`: agente conversacional OpenAI com ferramentas;
- `packages/shared`: tipos e constantes comuns;
- `raizes-e-riquezas`: possível aplicativo Expo legado/protótipo.

Os domínios incluem autenticação, tenants, planos, perfis, agenda/Google Calendar, assistente por texto e voz, clientes, agendamento público, catálogo, vendas, contratos/PDF/ZapSign, contas a receber, NFS-e, dashboards, usuários, branding, administração da plataforma e LGPD.

Leia primeiro `DOCUMENTACAO_SOLUCAO.md`, mas trate-o apenas como mapa inicial. Valide cada afirmação diretamente no código.

## Regras de execução

1. Trabalhe inicialmente em modo somente leitura. **Não altere o código, não aplique correções, não formate arquivos e não atualize dependências.**
2. Preserve arquivos e mudanças locais do usuário. Verifique `git status` antes de qualquer comando.
3. Não leia nem exponha valores secretos de `.env`, credenciais, certificados, tokens, bancos reais ou arquivos persistentes. Use apenas `.env.example` e código-fonte.
4. Não chame APIs externas reais, não emita NFS-e, não envie documentos à ZapSign, não crie eventos Google e não execute ações que produzam custo ou dados reais.
5. Pode executar verificações locais seguras, testes, typecheck e builds. Registre exatamente comandos, ambiente, êxito, falha e limitações.
6. Antes de usar Expo, respeite as instruções de `AGENTS.md` aplicáveis e a versão efetivamente declarada no app. Aponte incompatibilidades entre instruções e dependências.
7. Toda constatação deve trazer evidência com caminho do arquivo e número de linha. Não inclua achados genéricos sem prova.
8. Diferencie claramente: confirmado, provável, não verificável sem credenciais/ambiente e falso positivo descartado.
9. Não use apenas busca textual. Leia os fluxos completos e acompanhe dados do frontend à rota, serviço, banco e integração.
10. Se uma verificação não puder ser concluída, informe o motivo e proponha o teste exato necessário.

## Etapa 1 — Inventário e arquitetura real

Mapeie:

- workspaces, pacotes, scripts, versões, dependências e artefatos de deploy;
- entradas das aplicações, layouts, navegação e todas as páginas/telas;
- todas as rotas da API, método, autenticação, módulo exigido, papel exigido, validação, serviço e tabelas afetadas;
- bancos, tabelas, índices, migrações, relações, ownership e estratégia multi-tenant;
- integrações externas e variáveis necessárias;
- fluxos síncronos, assíncronos, webhooks e efeitos colaterais;
- código legado, duplicado, morto, demonstrativo ou incompleto;
- diferenças entre documentação e implementação.

Produza um diagrama textual da arquitetura e uma matriz `módulo → web → mobile → API → persistência → integração → nível de maturidade`.

## Etapa 2 — Avaliação funcional ponta a ponta

Para cada módulo abaixo, confirme CRUD, regras, validação, autorização, persistência, feedback ao usuário, estados vazios, erro, carregamento e comportamento mobile/web:

1. autenticação local e Google;
2. cadastro de empresa e onboarding;
3. seleção e troca de tenant;
4. início/resumo diário;
5. agenda e sincronização Google Calendar;
6. assistente por texto, voz e assistente flutuante;
7. clientes;
8. agendamento público, disponibilidade, confirmação, rejeição e cancelamento;
9. catálogo;
10. vendas e parcelamento;
11. contratos, revisões, PDF, emissão, assinatura e anulação;
12. financeiro/recebíveis;
13. NFS-e;
14. dashboards e KPIs;
15. usuários, papéis e perfis;
16. configurações, empresa, branding e calendário;
17. planos, assinaturas e administração da plataforma;
18. consentimento, exportação e exclusão LGPD.

Procure fluxos parcialmente conectados, divergência de payloads, telas que simulam sucesso, operações sem rollback, filtros incorretos, dados desatualizados, problemas de datas/fuso/moeda, concorrência, duplicidade e falta de idempotência.

## Etapa 3 — Arquitetura e qualidade de código

Avalie:

- limites entre pacotes e acoplamento;
- consistência de tipos compartilhados e contratos frontend/API;
- organização, responsabilidades, duplicação e complexidade;
- tratamento de erros e padronização de respostas;
- validação de entrada e saída;
- transações e consistência entre agregados;
- migrações e evolução de schema;
- estratégia SQLite por tenant e alternativa PostgreSQL;
- cache, memória, vazamentos e crescimento sem limite;
- compatibilidade das versões Node, Next, React, Expo e React Native;
- código legado e plano seguro de remoção/migração;
- documentação operacional e de desenvolvimento.

## Etapa 4 — Segurança e privacidade

Faça threat modeling por superfície e revise, no mínimo:

- autenticação, fixação/roubo de sessão, cookies e logout;
- tokens móveis, replay, expiração, revogação e armazenamento;
- OAuth Google, `state`, redirects, associação de conta e tokens;
- isolamento multi-tenant e IDOR/BOLA em toda rota por ID;
- autorização por papel, perfil, módulo e assinatura;
- mass assignment, validação, injeção SQL, XSS, CSRF, CORS e SSRF;
- uploads de logo, favicon, áudio e certificado digital;
- caminhos de arquivo, MIME, tamanho, extensão e conteúdo malicioso;
- webhooks ZapSign: autenticação, assinatura, replay e idempotência;
- rate limiting distribuído, brute force e abuso de IA;
- exposição de PII em logs, erros, prompts e respostas do modelo;
- gestão de segredos, criptografia, rotação e backups;
- headers/CSP e diferenças entre API, web e app;
- dependências vulneráveis, executando auditoria local apenas se não exigir rede ou mudança de lockfile;
- LGPD: base legal, consentimento, minimização, retenção, portabilidade, exclusão, operadores externos e trilha de auditoria.

Para cada ameaça, informe ativo, atacante, vetor, impacto, controle existente, falha residual e recomendação.

## Etapa 5 — Avaliação específica da IA

Analise:

- modelo/provedor real versus documentação;
- system prompt, contexto do tenant e instruções customizadas;
- catálogo de ferramentas e validação de argumentos;
- confirmação humana antes de ações destrutivas ou financeiras;
- prompt injection e instruções vindas de clientes/eventos/dados externos;
- autorização das ferramentas e isolamento por tenant;
- alucinação, datas, timezone, valores e seleção de registros ambíguos;
- persistência e privacidade das conversas;
- custo, limites, retries, timeouts e indisponibilidade do provedor;
- consistência entre histórico em memória e histórico no banco;
- transcrição de áudio, formato, tamanho e tratamento de erro;
- observabilidade e avaliação da qualidade das respostas.

Crie uma matriz de risco por ferramenta da IA e proponha casos de teste adversariais.

## Etapa 6 — UX, acessibilidade e paridade

Revise o portal e o aplicativo quanto a:

- arquitetura de informação e consistência de navegação;
- responsividade, teclado, leitor de tela, foco, labels, contraste e alvos de toque;
- estados loading/empty/error/offline e recuperação;
- mensagens, confirmações destrutivas e prevenção de erro;
- formulários, máscaras, validação e datas/moeda brasileiras;
- paridade web/mobile e funcionalidades ocultas ou demonstrativas;
- onboarding e descoberta de recursos;
- personalização de marca sem comprometer contraste/acessibilidade.

Classifique problemas segundo WCAG 2.1 AA quando aplicável.

## Etapa 7 — Dados, contratos e fiscal

Avalie tecnicamente, sem substituir parecer jurídico ou contábil:

- integridade entre cliente, venda, parcelas, contrato, assinatura e NFS-e;
- snapshots e imutabilidade de documentos emitidos;
- numeração, revisão, cancelamento e auditoria;
- valores monetários, arredondamento, parcelas e datas;
- textos contratuais hardcoded, versionamento e rastreabilidade;
- certificado digital, armazenamento e ciclo de vida;
- particularidades municipais/tributárias que a implementação não cobre;
- reconciliação após falhas parciais de serviços externos.

Marque explicitamente tudo que exige validação jurídica, contábil ou homologação externa.

## Etapa 8 — Testes, DevOps e operação

Execute, quando seguros e disponíveis:

```powershell
git status --short
node --version
pnpm --version
pnpm test
pnpm lint
pnpm build
```

Se `pnpm lint` abrir configuração interativa, cancele sem criar arquivos e registre a dívida. Não use flags que modifiquem o projeto.

Avalie:

- cobertura atual por domínio e lacunas críticas;
- testes unitários, integração, contrato, E2E, segurança e migração necessários;
- pipeline CI/CD, qualidade obrigatória e artefatos;
- Docker/Railway/EAS, variáveis e separação de ambientes;
- health/readiness, logs estruturados, métricas, tracing e alertas;
- backup, restauração, RPO/RTO e disaster recovery;
- rollback de código e dados;
- escalabilidade horizontal e limitações do SQLite/sessões/rate limit em memória;
- timeouts, retries, circuit breaker e idempotência para integrações.

## Severidade e pontuação

Use estas severidades:

- **P0 — Crítico:** exploração, perda/exposição ampla de dados, fraude, quebra multi-tenant ou indisponibilidade total iminente;
- **P1 — Alto:** falha grave de segurança/regra, corrupção de dados ou fluxo central inutilizável;
- **P2 — Médio:** defeito relevante, risco operacional ou degradação importante com contorno;
- **P3 — Baixo:** melhoria, consistência, manutenção ou problema localizado.

Pontue de 0 a 10, justificando com evidências:

- produto e completude funcional;
- arquitetura;
- backend/API;
- web;
- mobile;
- IA;
- segurança;
- privacidade/LGPD;
- qualidade e testes;
- DevOps/observabilidade;
- UX/acessibilidade;
- prontidão para produção.

Não use média simples para declarar prontidão: um P0 ou P1 de segurança, isolamento, fiscal ou integridade pode bloquear produção independentemente da nota média.

## Entregáveis obrigatórios

Crie, sem alterar código de produção, os seguintes arquivos Markdown na raiz:

### 1. `AVALIACAO_COMPLETA.md`

Deve conter:

1. resumo executivo para direção, em linguagem não técnica;
2. veredito de prontidão: `não pronto`, `piloto controlado`, `homologação` ou `produção`, com condições;
3. arquitetura real e inventário;
4. matriz de módulos e maturidade;
5. scorecard justificado;
6. achados detalhados por área;
7. lista consolidada de achados P0/P1/P2/P3;
8. evidências com arquivo e linha;
9. riscos não verificáveis e dependências externas;
10. conclusão.

### 2. `PLANO_DE_ACAO_AVALIACAO.md`

Organize recomendações em:

- bloqueadores antes de qualquer produção;
- 0–7 dias;
- 8–30 dias;
- 31–90 dias;
- evolução posterior.

Para cada item, informe severidade, benefício, esforço (`P/M/G`), dependências, perfil responsável, critério de aceite verificável e testes de regressão necessários. Agrupe itens que devem ser corrigidos juntos e indique a ordem causal.

### 3. `MATRIZ_TESTES_AVALIACAO.md`

Inclua casos positivos, negativos, limites, concorrência e segurança. Para cada caso: ID, módulo, pré-condição, passos, resultado esperado, prioridade, tipo de teste e possibilidade de automação. Dê atenção especial a dois tenants, quatro papéis, módulos bloqueados, integrações indisponíveis e falhas parciais.

### 4. `INVENTARIO_ENDPOINTS_AVALIACAO.md`

Tabela completa com método, rota, autenticação, tenant, módulo, papel/perfil, validação, efeito colateral, persistência, integração externa e observações de risco.

## Formato de cada achado

Use este modelo:

```markdown
### [P1][SEC-001] Título objetivo

- Área: Segurança / Multi-tenant
- Evidência: `caminho/arquivo.ts:123`
- Estado: Confirmado | Provável | Não verificável no ambiente
- Cenário: descrição reproduzível
- Impacto: consequência para usuário/negócio
- Causa raiz: causa técnica
- Recomendação: correção específica, sem implementá-la
- Critério de aceite: teste objetivo que prova a correção
- Testes de regressão: casos relacionados
```

## Critérios de qualidade da avaliação

- Seja específico e rastreável.
- Priorize riscos reais em vez de volume de observações cosméticas.
- Procure contradições entre camadas.
- Não confunda compilação com correção funcional.
- Não declare segurança ou conformidade sem testes/evidências.
- Registre também os controles bem implementados, para preservar o que funciona.
- Ao final, informe os comandos executados, seus resultados e todos os arquivos criados.
- Encerre após entregar a avaliação. Não implemente correções até receber autorização explícita em uma etapa posterior.

---
