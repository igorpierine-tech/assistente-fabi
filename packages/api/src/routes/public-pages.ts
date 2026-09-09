import { Router, type Router as ExpressRouter } from "express";

const router: ExpressRouter = Router();

const PAGE_STYLE = `
  body { font-family: 'Segoe UI', system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem 1rem; color: #333; line-height: 1.7; }
  h1 { color: #7c3aed; border-bottom: 2px solid #7c3aed; padding-bottom: 0.5rem; }
  h2 { color: #6d28d9; margin-top: 2rem; }
  a { color: #7c3aed; }
  footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #e5e7eb; font-size: 0.9rem; color: #6b7280; }
`;

router.get("/", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Raízes e Riquezas — Assistente de Agenda</title><style>${PAGE_STYLE}</style></head><body>
<h1>Raízes e Riquezas</h1>
<p><strong>Assistente de Agenda Inteligente</strong> para gestão de atendimentos, agendamentos e organização profissional.</p>
<h2>Sobre o aplicativo</h2>
<p>O Raízes e Riquezas é um assistente pessoal que integra com o Google Calendar para facilitar a gestão de agenda de profissionais. Com ele você pode:</p>
<ul>
  <li>Gerenciar agendamentos de atendimentos</li>
  <li>Consultar sua agenda por voz ou texto</li>
  <li>Receber solicitações de agendamento de clientes</li>
  <li>Organizar clientes e sessões</li>
</ul>
<h2>Links importantes</h2>
<ul>
  <li><a href="/privacidade">Política de Privacidade</a></li>
  <li><a href="/termos">Termos de Serviço</a></li>
</ul>
<footer><p>&copy; ${new Date().getFullYear()} Raízes e Riquezas. Todos os direitos reservados.</p></footer>
</body></html>`);
});

router.get("/privacidade", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Política de Privacidade — Raízes e Riquezas</title><style>${PAGE_STYLE}</style></head><body>
<h1>Política de Privacidade</h1>
<p><strong>Última atualização:</strong> ${new Date().toLocaleDateString("pt-BR")}</p>
<p>Esta Política de Privacidade descreve como o aplicativo <strong>Raízes e Riquezas</strong> ("nós", "nosso") coleta, utiliza e protege as informações pessoais dos usuários ("você").</p>

<h2>1. Dados que coletamos</h2>
<p>Ao utilizar o Raízes e Riquezas, coletamos os seguintes dados:</p>
<ul>
  <li><strong>Informações da conta Google:</strong> nome, endereço de e-mail e identificador do usuário, obtidos via autenticação Google OAuth 2.0.</li>
  <li><strong>Dados do Google Calendar:</strong> acesso aos eventos da sua agenda para leitura, criação, edição e exclusão de compromissos, conforme suas instruções.</li>
  <li><strong>Mensagens de chat:</strong> textos e transcrições de áudio enviados ao assistente de agenda, armazenados para manter o histórico de conversas.</li>
  <li><strong>Dados de clientes e agendamentos:</strong> informações de clientes e sessões que você registra no sistema.</li>
</ul>

<h2>2. Como utilizamos seus dados</h2>
<p>Utilizamos os dados coletados exclusivamente para:</p>
<ul>
  <li>Autenticar sua identidade e manter sua sessão ativa.</li>
  <li>Gerenciar sua agenda do Google Calendar conforme suas instruções via chat ou voz.</li>
  <li>Armazenar o histórico de conversas para continuidade do atendimento.</li>
  <li>Processar solicitações de agendamento de seus clientes.</li>
</ul>

<h2>3. Compartilhamento de dados</h2>
<p>Não vendemos, alugamos ou compartilhamos seus dados pessoais com terceiros, exceto:</p>
<ul>
  <li><strong>Google APIs:</strong> para acessar e gerenciar seu Google Calendar conforme autorizado.</li>
  <li><strong>OpenAI:</strong> mensagens de chat são processadas pela API da OpenAI para gerar respostas do assistente. Nenhum dado pessoal além do conteúdo da mensagem é enviado.</li>
</ul>

<h2>4. Armazenamento e segurança</h2>
<p>Seus dados são armazenados em servidores seguros com criptografia. As sessões são protegidas com tokens criptografados. Adotamos medidas técnicas para proteger seus dados contra acesso não autorizado.</p>

<h2>5. Seus direitos</h2>
<p>Você pode, a qualquer momento:</p>
<ul>
  <li>Exportar todos os seus dados armazenados no aplicativo.</li>
  <li>Solicitar a exclusão completa de sua conta e todos os dados associados.</li>
  <li>Revogar o acesso do aplicativo à sua conta Google nas <a href="https://myaccount.google.com/permissions">configurações de segurança do Google</a>.</li>
</ul>

<h2>6. Cookies e sessões</h2>
<p>Utilizamos cookies de sessão estritamente necessários para manter sua autenticação. Não utilizamos cookies de rastreamento ou publicidade.</p>

<h2>7. Contato</h2>
<p>Para dúvidas sobre esta política ou sobre seus dados, entre em contato pelo e-mail disponível na página de suporte do aplicativo.</p>

<footer><p><a href="/">← Voltar à página inicial</a></p>
<p>&copy; ${new Date().getFullYear()} Raízes e Riquezas. Todos os direitos reservados.</p></footer>
</body></html>`);
});

router.get("/termos", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Termos de Serviço — Raízes e Riquezas</title><style>${PAGE_STYLE}</style></head><body>
<h1>Termos de Serviço</h1>
<p><strong>Última atualização:</strong> ${new Date().toLocaleDateString("pt-BR")}</p>
<p>Ao utilizar o aplicativo <strong>Raízes e Riquezas</strong>, você concorda com os seguintes termos.</p>

<h2>1. Descrição do serviço</h2>
<p>O Raízes e Riquezas é um assistente de agenda que se integra ao Google Calendar para ajudar profissionais a gerenciar atendimentos, agendamentos e clientes por meio de chat com inteligência artificial.</p>

<h2>2. Uso autorizado</h2>
<p>O serviço é destinado a profissionais autorizados para gestão de suas agendas. Você é responsável por manter a segurança de sua conta e por todas as atividades realizadas com ela.</p>

<h2>3. Dados e privacidade</h2>
<p>O uso de seus dados é regido pela nossa <a href="/privacidade">Política de Privacidade</a>. Ao utilizar o serviço, você autoriza o acesso à sua agenda do Google Calendar conforme descrito.</p>

<h2>4. Limitações</h2>
<p>O serviço é fornecido "como está". Não garantimos disponibilidade ininterrupta. O assistente de IA pode cometer erros — sempre verifique as ações realizadas na sua agenda.</p>

<h2>5. Modificações</h2>
<p>Podemos atualizar estes termos a qualquer momento. Continuando a utilizar o serviço após alterações, você aceita os novos termos.</p>

<h2>6. Encerramento</h2>
<p>Você pode encerrar sua conta a qualquer momento, solicitando a exclusão dos seus dados através do aplicativo.</p>

<footer><p><a href="/">← Voltar à página inicial</a></p>
<p>&copy; ${new Date().getFullYear()} Raízes e Riquezas. Todos os direitos reservados.</p></footer>
</body></html>`);
});

export { router as publicPagesRouter };
