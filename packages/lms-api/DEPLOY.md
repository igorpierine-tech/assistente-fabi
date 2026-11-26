# Deploy — Líder Áurea LMS API

## Arquitetura

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   Vercel     │────▶│   Railway    │────▶│  PostgreSQL   │
│  (Frontend)  │     │   (API)      │     │  (Railway)    │
│  Next.js 15  │     │  Express     │     │              │
└─────────────┘     └─────────────┘     └──────────────┘
                           │
                     ┌─────┴─────┐
                     │   Resend   │
                     │  (E-mail)  │
                     └───────────┘
```

## 1. PostgreSQL (Railway)

1. Crie um novo projeto no [Railway](https://railway.app)
2. Adicione um serviço PostgreSQL
3. Copie a `DATABASE_URL` fornecida

## 2. API — Railway

1. No mesmo projeto, adicione um novo serviço a partir do GitHub repo
2. Configure o **Root Directory**: `/` (raiz do monorepo)
3. O Railway detectará o `Dockerfile` em `packages/lms-api/Dockerfile`
4. Configure as variáveis de ambiente:

| Variável | Valor |
|---|---|
| `LMS_DATABASE_URL` | URL do PostgreSQL do Railway |
| `JWT_ACCESS_SECRET` | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_REFRESH_SECRET` | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `NODE_ENV` | `production` |
| `LMS_PORT` | `3002` |
| `LMS_WEB_URL` | URL do frontend no Vercel (ex: `https://lider-aurea.vercel.app`) |
| `RESEND_API_KEY` | Chave da API do Resend |
| `EMAIL_FROM` | `Líder Áurea <noreply@seudominio.com.br>` |

5. O container roda `prisma migrate deploy` automaticamente no boot

### Seed inicial (uma vez)

Após o primeiro deploy, rode o seed via Railway CLI:

```bash
railway run --service lms-api -- npx tsx src/scripts/seed.ts
```

## 3. Frontend — Vercel

1. Importe o repositório no [Vercel](https://vercel.com)
2. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/lms`
3. Variáveis de ambiente:

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_LMS_API_URL` | URL da API no Railway (ex: `https://lms-api-production.up.railway.app`) |

## 4. Resend (E-mail)

1. Crie uma conta no [Resend](https://resend.com)
2. Adicione e verifique seu domínio
3. Gere uma API key
4. Configure `RESEND_API_KEY` e `EMAIL_FROM` no Railway

## 5. Domínio personalizado (opcional)

- **Frontend**: Configure em Vercel → Settings → Domains
- **API**: Configure em Railway → Service → Settings → Custom Domain
- Atualize `LMS_WEB_URL` no Railway para o novo domínio do frontend

## Verificação pós-deploy

1. Acesse `https://sua-api.railway.app/health` → deve retornar `{"status":"ok"}`
2. Acesse o frontend e faça login com as credenciais do seed:
   - Organização: `raizes-e-riquezas`
   - Owner: `admin@lideraurea.com.br` / `Admin@2024`
   - Mentora: `fabiana@lideraurea.com.br` / `Mentor@2024`
   - Aluna: `aluno@exemplo.com.br` / `Aluno@2024`
