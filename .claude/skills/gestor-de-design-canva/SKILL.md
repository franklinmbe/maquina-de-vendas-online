---
name: gestor-de-design-canva
description: Cria/edita designs, sobe imagens como assets, e exporta arquivos prontos no Canva do Franklin via API oficial (Canva Connect API). Integração real, testada e funcionando.
---

Integração OAuth 2.0 com a Canva Connect API (oficial, `canva.dev/docs/connect`), configurada e testada em 2026-08-17.

## Credenciais

Em `.claude/settings.local.json`:
- `CANVA_CLIENT_ID`
- `CANVA_CLIENT_SECRET`
- `CANVA_REFRESH_TOKEN` — usar pra gerar novos access tokens (eles expiram em 4h/14400s)

## Como pegar um access token novo (o antigo expira em 4h)

```
POST https://api.canva.com/rest/v1/oauth/token
Headers: Authorization: Basic <base64(CLIENT_ID:CLIENT_SECRET)>
Content-Type: application/x-www-form-urlencoded
Body: grant_type=refresh_token&refresh_token=<CANVA_REFRESH_TOKEN>
```
Resposta traz um `access_token` novo (e às vezes um `refresh_token` novo também — se vier, atualizar o salvo no settings.local.json).

## Escopos concedidos

`asset:read asset:write brandtemplate:content:read brandtemplate:content:write brandtemplate:meta:read comment:read comment:write design:content:read design:content:write design:meta:read folder:permission:write folder:read folder:write profile:read`

## Endpoints úteis (base: `https://api.canva.com/rest/v1`)

- `GET /users/me` — confirma autenticação, retorna `user_id`/`team_id` (testado, funciona)
- `POST /designs` — criar design novo
- `POST /asset-uploads` — subir uma imagem/asset
- `POST /exports` — exportar um design finalizado (PNG/PDF/etc)
- `GET /brand-templates` — listar templates de marca salvos na conta

Ver documentação completa em `canva.dev/docs/connect/api-reference` pros parâmetros exatos de cada endpoint antes de implementar algo novo — não foi tudo testado ainda, só a autenticação básica.

## Histórico da configuração (só como referência, não repetir)

Processo de setup exigiu: MFA ativado na conta Canva (só funciona depois de ter senha própria, não só login Google), criar integração "Public" em `canva.com/developers`, habilitar escopos manualmente na tela de configuração da integração (senão dá erro `invalid_scope` mesmo pedindo certo na URL), e um fluxo OAuth PKCE com um listener HTTP local (`http://127.0.0.1:8787/callback`) rodando via PowerShell pra capturar o código de autorização. Foi trabalhoso (várias tentativas por causa de escopos não habilitados e links antigos reutilizados por engano) mas o resultado final funciona 100%.
