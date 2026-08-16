# MVP backend — Login Google e agenda de hoje

## Configuração local

1. No Google Cloud, ative a **Google Calendar API**.
2. Crie um cliente OAuth 2.0 do tipo **Aplicativo da Web**.
3. Cadastre exatamente esta URI de redirecionamento: `http://localhost:3001/auth/google/callback`.
4. Se a tela de consentimento estiver em teste, adicione a conta da Fabiana como usuária de teste.
5. Copie `.env.example` para `.env` e preencha as credenciais localmente. Nunca compartilhe nem versione esse arquivo.
6. Gere o segredo de sessão sem compartilhar o resultado:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use o resultado como `SESSION_SECRET`. Mantenha `SESSION_FILE=./data/sessions.enc.json`.

## Executar

Em terminais separados, na raiz do projeto:

```powershell
pnpm install
pnpm dev:api
```

```powershell
pnpm dev:web
```

## Validar Login Google → agenda de hoje

1. Abra `http://localhost:3000`.
2. Clique em **Entrar com Google** e autorize o calendário.
3. Depois do redirecionamento, digite **Qual minha agenda de hoje?**.
4. A resposta deve listar eventos reais do calendário principal, no dia corrente de `America/Cuiaba`, ordenados por horário e formatados em `pt-BR`.

O caminho mínimo não depende da API Anthropic: essa frase é reconhecida pelo backend e consulta diretamente o Google Calendar. Os demais comandos continuam usando o orquestrador existente.

## Segurança

- O navegador recebe apenas o cookie `fabi.sid`, com `HttpOnly` e `SameSite=Lax`.
- Tokens, `refresh_token` e `expiry_date` permanecem no servidor.
- Sessões são persistidas em `data/sessions.enc.json` usando AES-256-GCM.
- A renovação automática salva tokens atualizados e preserva o `refresh_token`.
- `.env` e `data/` são ignorados pelo Git.
- Em produção, use HTTPS, `NODE_ENV=production`, um gerenciador de segredos e um armazenamento de sessão gerenciado.

## Diagnóstico

- `redirect_uri_mismatch`: compare a URI do Google Cloud e do `.env`, caractere por caractere.
- Estado OAuth inválido: reinicie o login pela tela inicial e mantenha cookies habilitados.
- Google não forneceu `refresh_token`: revogue o acesso anterior do aplicativo na Conta Google e faça login novamente.
- Agenda vazia: confirme que os eventos estão no calendário principal da mesma conta e na data atual de Cuiabá.
