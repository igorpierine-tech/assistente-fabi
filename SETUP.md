# Guia de Configuração — Raízes e Riquezas

## Pré-requisitos

- Node.js 20+ instalado
- Conta Google (Gmail)
- Conta na Anthropic (Claude API)
- Conta na OpenAI (Whisper API) — opcional, só para transcrição de áudio

---

## 1. Google Calendar API

### Passo a passo:

1. Acesse o [Google Cloud Console](https://console.cloud.google.com)
2. Crie um novo projeto:
   - Clique em **"Selecionar projeto"** → **"Novo projeto"**
   - Nome: `Assistente da Fabi`
   - Clique **"Criar"**
3. Ative a API do Google Calendar:
   - Menu lateral → **"APIs e Serviços"** → **"Biblioteca"**
   - Pesquise **"Google Calendar API"**
   - Clique e depois **"Ativar"**
4. Configure a tela de consentimento OAuth:
   - Menu lateral → **"APIs e Serviços"** → **"Tela de consentimento OAuth"**
   - Tipo: **Externo**
   - Preencha o nome do app: `Assistente da Fabi`
   - E-mail de suporte: seu email
   - Domínios autorizados: pode deixar vazio por enquanto
   - **Salvar e continuar**
   - Em Escopos, adicione:
     - `https://www.googleapis.com/auth/calendar`
     - `https://www.googleapis.com/auth/calendar.events`
     - `https://www.googleapis.com/auth/userinfo.email`
     - `https://www.googleapis.com/auth/userinfo.profile`
   - **Salvar e continuar**
   - Em Usuários de teste, adicione o email da Fabiana
   - **Salvar**
5. Crie as credenciais OAuth:
   - Menu lateral → **"APIs e Serviços"** → **"Credenciais"**
   - **"Criar credenciais"** → **"ID do cliente OAuth"**
   - Tipo: **Aplicativo da Web**
   - Nome: `Assistente da Fabi Web`
   - URIs de redirecionamento autorizados: `http://localhost:3001/auth/google/callback`
   - **Criar**
   - Copie o **Client ID** e o **Client Secret**

### Resultado:
```
GOOGLE_CLIENT_ID=seu-client-id-aqui.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=seu-client-secret-aqui
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback
```

---

## 2. Anthropic API (Claude)

### Passo a passo:

1. Acesse [console.anthropic.com](https://console.anthropic.com)
2. Crie uma conta ou faça login
3. Vá em **"API Keys"** no menu lateral
4. Clique em **"Create Key"**
5. Dê um nome: `Assistente da Fabi`
6. Copie a chave gerada (começa com `sk-ant-`)

### Resultado:
```
ANTHROPIC_API_KEY=sk-ant-sua-chave-aqui
```

### Custo estimado:
- Claude Sonnet: ~$3 por milhão de tokens de entrada, ~$15 por milhão de saída
- Uso moderado (20 interações/dia): ~R$ 20-40/mês

---

## 3. OpenAI API (Whisper — transcrição de áudio)

> Opcional: só necessário se quiser usar comandos de voz

### Passo a passo:

1. Acesse [platform.openai.com](https://platform.openai.com)
2. Crie uma conta ou faça login
3. Vá em **"API Keys"** no menu lateral
4. Clique em **"Create new secret key"**
5. Nome: `Assistente da Fabi`
6. Copie a chave

### Resultado:
```
OPENAI_API_KEY=sk-sua-chave-aqui
```

### Custo estimado:
- Whisper: $0.006 por minuto de áudio
- Uso moderado (20 áudios de 30s/dia): ~R$ 5-10/mês

---

## 4. Configurar o arquivo .env

Na pasta `assistente-fabi/`, copie o arquivo de exemplo e preencha:

```bash
cp .env.example .env
```

Abra o `.env` e preencha com as chaves obtidas acima:

```env
GOOGLE_CLIENT_ID=seu-client-id
GOOGLE_CLIENT_SECRET=seu-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback

ANTHROPIC_API_KEY=sk-ant-sua-chave

OPENAI_API_KEY=sk-sua-chave

API_PORT=3001
WEB_URL=http://localhost:3000
API_URL=http://localhost:3001
```

---

## 5. Instalar e rodar

```bash
# Instalar dependências
cd assistente-fabi
npm install

# Rodar a API (terminal 1)
npm run dev:api

# Rodar o site (terminal 2)
npm run dev:web

# Rodar o app mobile (terminal 3)
npm run dev:mobile
```

O site abrirá em `http://localhost:3000` e a API em `http://localhost:3001`.

### Ambientes do aplicativo Expo

O aplicativo lê a API exclusivamente de `EXPO_PUBLIC_API_URL`. Essa variável é
pública e não deve conter tokens, senhas ou chaves privadas.

- Desenvolvimento local: copie `apps/mobile/.env.example` para
  `apps/mobile/.env.local` e ajuste a URL para o emulador ou para o IP local do
  computador.
- Builds EAS `development`, `preview` e `production`: a URL é definida em
  `apps/mobile/eas.json`.
- Homologação: altere somente o valor do perfil `preview` para a URL HTTPS do
  ambiente de homologação.

Em builds que não sejam de desenvolvimento, o app recusa URLs sem HTTPS. Depois
de alterar uma variável `EXPO_PUBLIC_*`, gere um novo bundle/build, pois o valor é
incorporado ao aplicativo.

### Persistência em produção

A API não inicia em produção sem `PERSISTENCE_DIR`. No Railway, crie um volume,
monte-o em `/data` e configure:

```env
PERSISTENCE_DIR=/data
AUDIT_RETENTION_DAYS=365
PRIVACY_POLICY_VERSION=2026-08-18
```

O banco SQLite e o arquivo criptografado de sessões serão gravados nesse volume.
Configure snapshots/backups do volume no provedor e teste periodicamente a
restauração em um ambiente separado. Nunca monte dois processos da API escrevendo
simultaneamente no mesmo arquivo SQLite; para escalar horizontalmente, migre a
persistência para um banco gerenciado.

### LGPD e auditoria

- `POST /privacy/consent`: registra aceite explícito da versão vigente.
- `GET /privacy/status`: informa a situação do consentimento.
- `GET /privacy/export`: exporta os dados da conta autenticada em JSON.
- `DELETE /privacy/account`: exige `{"confirmation":"EXCLUIR"}`, remove os dados
  da conta e tenta revogar a autorização Google.

A auditoria registra somente usuário, ação, tipo de rota, status e data; corpos de
requisição, prontuários e mensagens não são copiados. O prazo padrão é 365 dias,
ajustável por `AUDIT_RETENTION_DAYS` entre 30 e 3650 dias.

---

## 6. Primeiro uso

1. Abra `http://localhost:3000` no navegador
2. Clique em **"Entrar com Google"**
3. Autorize o acesso ao Google Calendar
4. Pronto! Comece falando ou digitando:
   - "Qual minha agenda de hoje?"
   - "Agende Constelação com Maria amanhã às 14h"

---

## Problemas comuns

| Problema | Solução |
|---|---|
| "redirect_uri_mismatch" | Verifique se o URI no Google Cloud bate exatamente com `GOOGLE_REDIRECT_URI` |
| "ANTHROPIC_API_KEY não configurada" | Verifique se o `.env` está na raiz do projeto |
| Microfone não funciona | O navegador exige HTTPS para microfone em produção. Em localhost funciona |
| "Token expirado" | Clique em "Sair" e faça login novamente |
