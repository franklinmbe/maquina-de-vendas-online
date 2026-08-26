# Deploy na Hostinger (VPS com Node.js)

Este projeto rodava só na Vercel (funções serverless). Agora tem `server.js`,
um servidor Express normal que serve as mesmas rotas de `api/` e o site
estático de `public/` — dá pra rodar em qualquer VPS Node.js, incluindo Hostinger.

## 1. No servidor (via SSH)

```bash
git clone https://github.com/franklinmbe/maquina-de-vendas-online.git
cd maquina-de-vendas-online/app
npm ci --omit=dev
```

## 2. Variáveis de ambiente

Criar um arquivo `.env` dentro de `app/` (não é commitado, já cai no
`.gitignore`) com as mesmas variáveis que hoje estão na Vercel — ver
`ENV_VARS.md` nesta mesma pasta pra descrição de cada uma:

```
GITHUB_TOKEN=...
GITHUB_OWNER=franklinmbe
GITHUB_REPO=maquina-de-vendas-online
APP_PASSPHRASE=...
BLOB_READ_WRITE_TOKEN=...
USERS_BLOB_SECRET=...
SIGNUP_ALLOWLIST=...
META_APP_ID=...
META_APP_SECRET=...
OAUTH_STATE_SECRET=...
TOKEN_ENCRYPTION_KEY=...
TIKTOK_CLIENT_KEY=...
TIKTOK_CLIENT_SECRET=...
CRON_SECRET=...
PORT=3000
```

Como `server.js` não carrega `.env` sozinho, subir com:
```bash
npm install -g dotenv-cli   # só uma vez
dotenv -e .env -- npm start
```
(ou usar o suporte de env do próprio PM2, ver abaixo).

## 3. Manter o processo no ar (PM2)

```bash
npm install -g pm2
pm2 start server.js --name mvo --env-file .env
pm2 save
pm2 startup   # segue as instruções que ele imprimir, pra sobreviver a reboot
```

## 4. Nginx como proxy reverso + HTTPS

Apontar o domínio pra porta 3000 do Node e emitir certificado com Certbot —
configuração padrão de proxy reverso Nginx + Let's Encrypt, nada específico
deste projeto.

## 5. Cron da coleta de métricas diária

Na Vercel isso quebrava o deploy (ver CLAUDE.md) — na Hostinger é só um
crontab de verdade:
```
0 6 * * * curl -s -X POST -H "Authorization: Bearer <CRON_SECRET>" https://SEU_DOMINIO/api/cron/collect-social-snapshots
```

## 6. Callbacks do OAuth (Meta/TikTok)

Atualizar, nos painéis do Meta for Developers e do TikTok for Developers, a
URL de redirect autorizada pra:
- `https://SEU_DOMINIO/api/meta/oauth-callback`
- `https://SEU_DOMINIO/api/tiktok/oauth-callback`

Sem isso, o clique em "conectar rede social" volta com erro do próprio
Facebook/TikTok (redirect_uri não bate com o cadastrado).

## 7. Antes de trocar o DNS de produção

Testar direto no IP/domínio de teste da Hostinger: login, cadastro
("Liberar cliente"), envio de pedido com foto, e as duas conexões de rede
social (Facebook/Instagram e TikTok) ponta a ponta. Só depois apontar o
domínio real pra lá — manter a Vercel no ar até essa validação passar.
