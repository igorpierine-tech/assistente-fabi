# Documentação da solução — Assistente Fabi / Raízes e Riquezas

> Leitura técnica e funcional realizada em 10/11/2026 diretamente sobre o código do repositório. Este documento distingue funcionalidades implementadas, integrações condicionadas a configuração externa e partes ainda demonstrativas.

## 1. Visão geral

A solução evoluiu de um assistente pessoal de agenda para uma plataforma SaaS multiempresa de gestão de pequenos negócios de serviços. Ela reúne agenda, clientes, atendimento por IA, agendamento público, catálogo, vendas, contratos, contas a receber, NFS-e, indicadores, usuários, perfis de acesso, planos e administração da plataforma.

Há três aplicações principais e dois pacotes compartilhados:

| Camada | Local | Responsabilidade |
|---|---|---|
| Portal web | `apps/web` | Aplicação administrativa e operacional em Next.js/React |
| Aplicativo móvel | `apps/mobile` | Aplicativo Android/iOS em Expo/React Native |
| API | `packages/api` | Regras de negócio, autenticação, integrações, persistência e endpoints Express |
| Motor de IA | `packages/ai` | Orquestração conversacional e ferramentas acionadas pelo modelo |
| Contratos comuns | `packages/shared` | Tipos, constantes e identidade visual padrão compartilhados |

O repositório é um monorepo gerenciado com pnpm e Turborepo. A API usa SQLite para dados operacionais por empresa e oferece uma camada de banco mestre em SQLite ou PostgreSQL para tenants, usuários, perfis, planos e assinaturas.

## 2. Arquitetura e fluxo principal

1. O usuário entra pelo portal ou aplicativo usando e-mail/senha ou o fluxo Google.
2. A API valida a identidade, resolve a empresa selecionada e monta a sessão com função, perfil e módulos permitidos.
3. Cada requisição autenticada passa por controles de origem, limite de chamadas, auditoria, tenant ativo e permissão do módulo.
4. O contexto do tenant direciona o acesso ao banco operacional daquela empresa.
5. Os módulos web e mobile consomem a mesma API.
6. Agenda e assistente usam credenciais Google Calendar armazenadas no servidor.
7. O assistente envia a conversa ao modelo OpenAI e permite que ele acione ferramentas do sistema.
8. Contratos, assinaturas e NFS-e acionam serviços externos quando as respectivas credenciais estão configuradas.

### Persistência

- **Banco mestre:** empresas, usuários, vínculos usuário-empresa, perfis de acesso, planos, assinaturas e tokens Google. Há implementação SQLite e implementação PostgreSQL parcial/alternativa.
- **Banco por tenant:** clientes, agenda, conversas, mensagens, agendamento público, catálogo, vendas, contas a receber, contratos, configurações, NFS-e, consentimentos e auditoria.
- **Sessões:** armazenamento criptografado com AES-256-GCM em arquivo persistente.
- **Produção:** exige diretório persistente; a documentação recomenda volume em `/data`, snapshots e somente uma instância gravando no mesmo SQLite.

## 3. Módulos funcionais

### 3.1 Autenticação, cadastro e seleção de empresa

- Login local por e-mail e senha.
- Login/cadastro com Google e associação da conta.
- Seleção de tenant quando o usuário participa de mais de uma empresa.
- Troca segura da autenticação web por token assinado para o aplicativo móvel.
- Logout, consulta de sessão e status do Google Calendar.
- Cadastro público de nova empresa com consulta auxiliar de CNPJ.
- Onboarding inicial para identidade e configuração do negócio.

### 3.2 Início e resumo diário

- Exibe compromissos e resumo operacional do dia.
- Consolida indicadores usados na visão inicial.
- Oferece acesso rápido às funções mais frequentes e ao assistente flutuante.

### 3.3 Agenda

- Lista compromissos por período e permite consultar um item.
- Cria, altera e exclui agendamentos.
- Integra eventos com o Google Calendar.
- Sincroniza eventos existentes do Google para o banco local.
- Relaciona agendamentos a clientes, tipo de atendimento, horários, observações e lembretes.
- Pode gerar conta a receber vinculada ao atendimento, conforme o fluxo utilizado.

### 3.4 Assistente de IA

- Conversa por texto e por áudio; o áudio é transcrito pelo Whisper/OpenAI.
- Mantém conversas e mensagens no banco, além de contexto curto em memória para o modelo.
- Usa prompt adaptado ao nome, profissão, negócio, fuso horário e instruções do tenant.
- Ferramentas disponíveis ao agente:
  - listar, criar, editar e excluir eventos;
  - listar, criar, editar e excluir clientes;
  - listar, criar, editar e excluir itens do catálogo;
  - consultar resumo financeiro, criar e quitar contas a receber;
  - listar e registrar vendas.
- Possui limite de oito ciclos de ferramentas por resposta, histórico em memória limitado e expiração de contexto após quatro horas.
- O provedor atual é **OpenAI**, com modelo padrão `gpt-4o-mini` ou valor de `OPENAI_MODEL`. O `SETUP.md` ainda contém referências antigas à Anthropic e deve ser atualizado.
- A tela principal do assistente no mobile contém eventos e respostas de demonstração para o modo não autenticado. Os fluxos autenticados e o assistente flutuante consomem a API real.

### 3.5 Clientes

- Cadastro, consulta, edição, exclusão e busca.
- Dados pessoais e empresariais: nome, contato, CPF/CNPJ/documento, tipo de pessoa, inscrição estadual e endereço estruturado.
- Histórico de compromissos por cliente.
- Reutilização dos dados em vendas, contratos e NFS-e.

### 3.6 Agendamento público

- Configuração de slug/link público, disponibilidade, antecedência, intervalo e regras de agenda.
- Tipos de sessão/serviço e duração.
- Página pública por empresa para consulta de horários e envio de solicitação.
- Painel interno de solicitações pendentes.
- Confirmação cria o compromisso no Google Calendar; rejeição registra o resultado.
- Link seguro para o próprio cliente consultar ou cancelar a solicitação.
- Limite de chamadas específico para submissões públicas.

### 3.7 Produtos e serviços

- Catálogo de produtos e serviços com nome, tipo, preço, duração, descrição, cor, ordem e status.
- Usado por agendamentos, vendas, financeiro e assistente.
- No backend, o catálogo está protegido pelo módulo `vendas`, embora a interface o apresente como cadastro próprio; isso deve ser validado contra a regra comercial dos planos.

### 3.8 Vendas

- Registro, consulta, atualização e exclusão de vendas.
- Associação a cliente e item do catálogo.
- Forma de pagamento, parcelamento, data, valor e observações.
- Criação opcional de cliente durante a venda.
- Geração automática de parcelas a receber.
- Geração de contrato relacionado à venda.
- Envio para assinatura eletrônica e acompanhamento de status via ZapSign.

### 3.9 Contratos

- Catálogo de definições de serviços/formatos contratuais.
- Criação de contrato com snapshot dos dados e composição de cláusulas.
- Versionamento por revisões, partes, artefatos e trilha própria de auditoria.
- Emissão e geração de PDF com identidade visual/papel timbrado.
- Download do PDF.
- Envio à ZapSign, consulta de assinatura, atualização por webhook e anulação.
- Exclusão controlada conforme estado do contrato.
- Há textos jurídicos extensos embutidos no código; precisam de revisão jurídica formal e estratégia de versionamento editorial.

### 3.10 Financeiro / contas a receber

- Lançamento, edição e exclusão de recebíveis.
- Situações pendente, pago e cancelado.
- Marcação como pago ou retorno para pendente.
- Forma de pagamento, vencimento, data de pagamento e observações.
- Resumo de valores a receber, atrasados e recebidos.
- Parcelas geradas a partir de vendas e vínculos com agendamento/venda.
- Integração do módulo com emissão de NFS-e.

### 3.11 NFS-e

- Configuração fiscal da empresa e status da integração.
- Upload e remoção de certificado digital.
- Emissão, consulta e cancelamento de NFS-e.
- Histórico de notas e vínculo com venda.
- Implementação voltada ao padrão nacional ADN/DPS e condicionada a certificado, dados fiscais e ambiente corretamente configurados.
- Por envolver obrigação fiscal, requer homologação real por município/cenário tributário antes de produção.

### 3.12 Dashboards

- Endpoint de KPIs operacionais e financeiros.
- Analytics consolidados para vendas, receita, clientes, agenda e desempenho.
- Filtros e visualizações no portal web.

### 3.13 Usuários e perfis de acesso

- Cadastro, edição e troca de senha de usuários.
- Papéis padrão: administrador, gestor, colaborador e visualizador.
- Perfis customizados por tenant, com lista de módulos permitidos.
- Interseção entre módulos do plano, perfil do usuário e tenant ativo.
- Navegação web adapta os itens ao acesso recebido; a API volta a validar o módulo em cada grupo de rotas.

### 3.14 Configurações, empresa e marca

- Nome do negócio, proprietário, profissão, tagline, fuso e locale.
- Cores, fontes, logotipo e favicon.
- Dados cadastrais, fiscais e endereço da empresa.
- Configuração do Google Calendar.
- Configuração de agendamento e NFS-e.
- Aplicação dinâmica da identidade do tenant no portal.

### 3.15 Administração da plataforma

- Painel separado para administradores da plataforma.
- Gestão de empresas, usuários das empresas, perfis, planos e assinaturas.
- Ativação/desativação de tenants e bloqueio por assinatura.
- Definição de módulos e limite de usuários por plano.
- Métricas gerais da plataforma.

### 3.16 Privacidade e LGPD

- Registro versionado de consentimento.
- Consulta do status do aceite.
- Exportação dos dados do usuário em JSON.
- Exclusão de conta mediante confirmação explícita e tentativa de revogação Google.
- Auditoria registra identidade, ação, recurso, status e data, sem copiar corpos, mensagens ou prontuários.
- Retenção configurável entre 30 e 3.650 dias.

## 4. Aplicações de interface

### Portal web

O portal Next.js é a interface mais completa. Possui login, cadastro, onboarding, layout responsivo, navegação por permissões, assistente flutuante e páginas para todos os módulos operacionais, além do painel de administração da plataforma e da página pública de agendamento.

### Aplicativo móvel

O aplicativo Expo oferece login, início, agenda, clientes, assistente, agendamentos, catálogo, vendas, financeiro, contratos, usuários e configurações. As telas secundárias ficam agrupadas em “Mais”. A autenticação é armazenada no SecureStore. O conjunto móvel merece avaliação específica de paridade: não há tela móvel de dashboards nem administração da plataforma, e partes da experiência do assistente ainda usam conteúdo demonstrativo quando não há autenticação.

### Diretório legado

`raizes-e-riquezas/` é uma aplicação Expo anterior/separada, com poucas telas e instruções próprias. Ela não participa do workspace principal definido na raiz. Deve ser classificada formalmente como legado, protótipo ou removida para evitar manutenção e avaliação duplicadas.

## 5. Integrações externas

| Integração | Uso | Condição |
|---|---|---|
| Google OAuth | Identidade e vínculo da conta | Client ID, secret e redirect URI |
| Google Calendar | Agenda, disponibilidade e confirmações | Consentimento e tokens válidos |
| OpenAI Chat Completions | Assistente e tool calling | `OPENAI_API_KEY` |
| OpenAI Whisper | Transcrição de áudio | `OPENAI_API_KEY` |
| ZapSign | Assinatura eletrônica de contratos | Credenciais e webhook |
| CNPJ | Preenchimento de dados de empresa | Serviço externo acessível |
| NFS-e nacional | Emissão/consulta/cancelamento | Certificado e configuração fiscal |
| Railway | Hospedagem da API e volume | Variáveis e volume persistente |
| Expo EAS | Builds Android/iOS | Projeto/conta EAS configurados |

## 6. Segurança implementada

- Cookies `HttpOnly`, `SameSite=Lax` e `Secure` em produção.
- Sessões criptografadas e tokens externos mantidos no servidor.
- Tokens móveis assinados e validação temporal.
- CORS por allowlist e verificação de origem em operações mutáveis.
- Rate limiting geral e limites específicos para autenticação, IA, cadastro e páginas públicas.
- Cabeçalhos de segurança, HSTS em produção e CSP restritiva na API.
- Validação com Zod em partes sensíveis e validadores de domínio em outras rotas.
- Isolamento por tenant, status da assinatura, módulo e papel/perfil.
- Auditoria e rotinas de privacidade.

Esses controles existem no código, mas a eficácia — especialmente isolamento multi-tenant, autorização por objeto, webhook ZapSign, uploads, certificados e exclusão LGPD — precisa ser confirmada por testes adversariais.

## 7. Estado técnico observado

- Os 5 testes automatizados existentes passaram.
- O build de produção passou para API, web, IA e pacote compartilhado.
- A verificação completa `pnpm check` não conclui porque `apps/web` usa `next lint`; o Next solicita configuração interativa de ESLint. Isso é dívida de configuração, não erro de compilação.
- O ambiente usado na leitura estava em Node 24.15.0, enquanto o projeto declara suporte a Node `>=20 <24` e a documentação de deploy recomenda Node 22.
- A cobertura de testes é muito pequena para o tamanho da solução: hoje cobre apenas validação básica e autenticação móvel.
- A documentação está parcialmente desatualizada: Anthropic é citado, mas o código utiliza OpenAI; também há diferenças entre orientações antigas de instalação e o `packageManager` atual.

## 8. Pontos que a avaliação deve tratar como prioritários

1. Isolamento real entre tenants e ausência de IDOR em todas as rotas.
2. Coerência entre papéis, perfis, módulos do plano e permissões de leitura/escrita.
3. Segurança dos fluxos Google, sessão móvel, ZapSign, NFS-e, uploads e webhooks.
4. Integridade transacional entre vendas, parcelas, contratos, assinaturas e notas.
5. Paridade e consistência funcional entre web e mobile.
6. Conteúdo demonstrativo/hardcoded no mobile e diretório Expo legado.
7. Conformidade LGPD, minimização, retenção, exportação e exclusão completa.
8. Adequação jurídica dos contratos e fiscal da NFS-e.
9. Persistência/escala: SQLite por tenant, uma única instância, backup, migração e PostgreSQL.
10. Observabilidade, recuperação de falhas externas, idempotência e reconciliação.
11. Acessibilidade, responsividade, estados vazios, erros e experiência offline/rede instável.
12. Ampliação forte de testes unitários, integração, contrato, E2E e segurança.

