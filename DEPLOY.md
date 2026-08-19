# Deploy de produção

## Requisitos

- Node.js 22 e pnpm 11.21.0.
- Projeto Railway com volume persistente montado em `/data`.
- Projeto Expo/EAS `129b9e36-4c78-426a-a51c-1b9500414e5f`.
- OAuth Google configurado para a URL HTTPS definitiva da API.

## Variáveis da API

Configure no Railway, sem incluir os valores no repositório:

```env
NODE_ENV=production
PERSISTENCE_DIR=/data
SESSION_SECRET=<64 caracteres hexadecimais>
GOOGLE_CLIENT_ID=<cliente OAuth web>
GOOGLE_CLIENT_SECRET=<segredo OAuth>
GOOGLE_REDIRECT_URI=https://SUA-API/auth/google/callback
WEB_URL=https://SEU-WEB
EXTRA_WEB_ORIGINS=https://OUTRA-ORIGEM-CONFIAVEL
OPENAI_API_KEY=<chave>
ADMIN_TOKEN=<token aleatório com no mínimo 16 caracteres>
PRIVACY_POLICY_VERSION=2026-08-18
AUDIT_RETENTION_DAYS=365
```

`EXTRA_WEB_ORIGINS` é opcional e aceita valores separados por vírgula. Não use
curingas. O servidor recusa iniciar sem `PERSISTENCE_DIR` em produção.

## Google OAuth

No Google Cloud, cadastre exatamente:

- URI de redirecionamento: `https://SUA-API/auth/google/callback`.
- Origem JavaScript: `https://SEU-WEB`.

Após alterar domínios, atualize `GOOGLE_REDIRECT_URI`, `WEB_URL` e a configuração
do Google no mesmo deploy.

## API e web

Antes de publicar:

```powershell
pnpm test
pnpm lint
pnpm build
```

No Railway, use o `Dockerfile` da raiz. Monte o volume antes do primeiro deploy e
confirme no log que a API iniciou. O endpoint de saúde deve responder em
`GET /health` com status `200`.

Configure `NEXT_PUBLIC_API_URL=https://SUA-API` no ambiente de build do site e
publique `apps/web`.

## Aplicativo Expo/EAS

Confira a URL HTTPS da API nos perfis `preview` e `production` de
`apps/mobile/eas.json`. Depois execute:

```powershell
cd apps/mobile
npx expo-doctor
npx expo export --platform android --output-dir .expo-build
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform android --profile production
```

O perfil `preview` produz APK interno. O perfil `production` produz AAB para a
Play Store e incrementa a versão remotamente. O build remoto requer login EAS e
pode consumir cota; confirme o projeto e a conta exibidos antes de iniciá-lo.

## Smoke test

Depois do deploy:

1. Verifique `/health` e uma rota inexistente (`404`).
2. Entre pelo Google no web e no aplicativo.
3. Crie dois usuários de teste e confirme que um não vê clientes, agendas ou
   conversas do outro.
4. Crie, edite e exclua cliente e agendamento.
5. Envie mensagem e áudio; confira a conversa e o evento no Google Calendar.
6. Teste a página pública de agendamento e aprove/rejeite uma solicitação.
7. Registre consentimento, exporte os dados e valide o JSON.
8. Em uma conta descartável, execute a exclusão com `EXCLUIR` e confirme que o
   login e os dados deixaram de existir.
9. Reinicie o serviço e confirme que dados e sessões persistiram no volume.

## Backup e rollback

- Habilite snapshots do volume e mantenha cópia fora do serviço.
- Antes de mudanças de esquema, gere um snapshot verificável.
- Para rollback de código, republique a imagem anterior sem substituir o volume.
- Para rollback de dados, pare todas as instâncias antes de restaurar o SQLite,
  restaure banco e arquivos WAL/SHM de um snapshot consistente e depois reinicie.
- Não execute mais de uma instância da API sobre o mesmo arquivo SQLite.
