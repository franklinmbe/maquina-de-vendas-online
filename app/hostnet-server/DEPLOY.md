# Deploy na Hostnet (App Cloud)

Versão self-hosted do app, pronta pra rodar fora do Vercel — feita porque o cartão
de Franklin não foi aceito no checkout do Vercel Pro e a Hostnet aceita
pagamento nacional (boleto/Pix/cartão nacional). Ver CLAUDE.md (seção Vercel)
pro histórico completo dessa decisão.

## O que mudou em relação à versão Vercel (`app/api` + `app/public`)

- **Sem `@vercel/blob`**: o cadastro de usuários agora fica num arquivo JSON local
  (`lib/users.js`), guardado no caminho de `DATA_DIR`. Upload de foto/vídeo vai
  direto no multipart pro próprio servidor (`/api/commit`), sem passar por
  nenhum serviço externo — isso também elimina a dependência do `esm.sh` (CDN
  externo que causava a página inteira travar quando ficava indisponível).
- **Sem deploy automático por push no GitHub**: aqui é preciso construir a
  imagem Docker e publicar manualmente (ou configurar isso no painel da
  Hostnet, se o App Cloud oferecer integração com Git — checar lá).
- **Cron interno**: a coleta diária de seguidores (antes um "cron" do Vercel,
  removido por quebrar o deploy) agora roda dentro do próprio processo Node
  (`node-cron`, todo dia às 03:00), sem depender de nenhum recurso específico
  da plataforma de hospedagem.

## Antes de publicar

1. **Contratar o App Cloud da Hostnet** (a conta que Franklin já tem lá é
   hospedagem/VPS tradicional PHP — não roda Node.js, precisa ser esse produto
   à parte).
2. **Configurar um volume persistente** montado em `/data` (ou o caminho que
   for, ajustando `DATA_DIR`) — é onde fica `users.json`, o cadastro de todos
   os clientes. Sem isso, todo cadastro some quando o contêiner reiniciar.
3. Configurar as variáveis de ambiente abaixo no painel da Hostnet.

## Variáveis de ambiente

Iguais às do Vercel (ver `app/ENV_VARS.md`), com estas diferenças:

| Variável | O que muda |
|---|---|
| `DATA_DIR` | **Nova.** Caminho do volume persistente onde fica `users.json` (ex: `/data`). |
| `PORT` | **Nova**, opcional. Porta que o servidor escuta (padrão 3000). |
| `BLOB_READ_WRITE_TOKEN` | **Não existe mais** — não precisa configurar. |
| `USERS_BLOB_SECRET` | **Não existe mais** — não precisa configurar. |
| `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO` | Iguais. |
| `APP_PASSPHRASE` | Igual. |
| `SIGNUP_ALLOWLIST` | Igual. |
| `META_APP_ID`, `META_APP_SECRET` | Iguais — **mas precisa atualizar a Redirect URI cadastrada no Meta for Developers pro novo domínio** (era `https://maquina-de-vendas-online-five.vercel.app/api/meta/oauth-callback`, passa a ser `https://<domínio-novo>/api/meta/oauth-callback`). |
| `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | Iguais — mesma observação de Redirect URI, no painel do TikTok for Developers. |
| `OAUTH_STATE_SECRET`, `TOKEN_ENCRYPTION_KEY` | Iguais — **usar os mesmos valores já configurados no Vercel**, senão as conexões de redes sociais já feitas (tokens cifrados salvos no cadastro) ficam ilegíveis e os clientes precisam reconectar tudo de novo. |

## Como publicar

```bash
cd app/hostnet-server
docker build -t maquina-de-vendas-online .
# depois, seguir o fluxo específico do App Cloud da Hostnet pra publicar essa
# imagem (push pro registro deles, ou like conectar o repositório Git, conforme
# o que o painel oferecer — checar a documentação/central de ajuda da Hostnet
# quando chegar nessa etapa, os detalhes exatos variam por plano).
```

## Migrar os cadastros já existentes

Os clientes já cadastrados hoje (Vercel Blob) precisam ser copiados pro
`users.json` novo antes de trocar o domínio de produção — senão todo mundo
perde login e precisa se cadastrar de novo. Passos, quando chegar a hora:

1. Baixar o JSON atual do Vercel Blob (`data/users-<USERS_BLOB_SECRET>.json`).
2. Colocar esse arquivo como `users.json` dentro do volume `DATA_DIR` do novo
   servidor, antes de apontar o domínio final pra ele.

## Validar antes de trocar o domínio final

Testar tudo isso no domínio temporário da Hostnet antes de apontar
`maquina-de-vendas-online-five.vercel.app` (ou domínio próprio, se houver)
pra cá: login (senha mestra e cliente cadastrado), cadastro novo, envio de
pedido com foto e vídeo (confere se chega em `.claude/skills/<cliente>/` no
GitHub), relatório administrativo, relatório de redes sociais, e reconectar
uma rede social de teste (OAuth do Meta/TikTok, com a Redirect URI já
atualizada).

Só depois de validar tudo isso, seguir o plano combinado com Franklin: não
apagar o Vercel/Hetzner até o novo servidor estar validado (mesmo padrão já
usado na migração do Postiz).
