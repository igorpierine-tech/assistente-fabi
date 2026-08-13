# Guia de Configuração — Assistente da Fabi

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
