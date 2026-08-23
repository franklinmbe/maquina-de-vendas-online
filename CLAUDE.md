# Máquina de Vendas Online — contexto do projeto

Negócio de Franklin (franklinmbe@gmail.com): posta conteúdo (vídeo/foto/banner) nas redes sociais da própria marca pessoal + empresas clientes, usando o **Postiz** (ferramenta de agendamento/publicação open-source) como backend.

## Arquitetura

- **Postiz self-hosted** rodando num servidor Hetzner (detalhes de acesso/senha na memória, não aqui). Migração em andamento para o **plano pago hospedado do Postiz** (postiz.com) — mais simples de conectar redes (apps já aprovados), sem precisar manter servidor. Não apagar o Hetzner até o plano pago estar validado.
- **API pública do Postiz** (`/api/public/v1/...`) é o jeito de publicar programaticamente — mesma API nas duas versões (self-hosted e paga). Auth via header `Authorization: <POSTIZ_API_KEY>`. A chave atual fica em `.claude/settings.local.json` (`env.POSTIZ_API_KEY`).
- **Estrutura de pastas por marca/empresa**: cada pasta em `.claude/skills/<nome>/` representa um cliente/marca. Arquivos soltos direto na pasta = conteúdo novo pra postar nos canais daquele cliente (definidos no `SKILL.md` da pasta). Depois de publicado, o arquivo é movido pra `processados/` dentro da mesma pasta. **Regra fixa: só publica o que Franklin colocou direto na pasta daquele cliente — nunca mover/reclassificar um arquivo de uma pasta de skill pra outra como "correção".** Se um arquivo parecer ser de outra marca/empresa, a skill deve parar e reportar, não mover nem publicar (incidente real em 2026-08-20: um flyer de terceiro foi movido pra `kleber-construcao/` por engano e publicado nas redes do Kleber).
  - `frank/` — marca pessoal do Franklin (Facebook + Instagram próprios). Skill já completa.
  - `kleber-construcao/` — empresa de construção (cliente). Skill completa. Canais conectados no Postiz desde 2026-08-20: Facebook, Instagram, TikTok Business.
  - Outras empresas: ainda não criadas.

## Cadastro de clientes no app (`app/`) — processo temporário

O app de upload (`app/`) usa autorização manual + autoatendimento, até integrar pagamento automático:

1. Franklin autoriza manualmente um e-mail/telefone específico adicionando uma entrada em `SIGNUP_ALLOWLIST` (Vercel), no formato `identificador:cliente:plano` — o `plano` indica qual plano aquele cliente contratou (usado depois pra calcular a cota do Postiz, ver seção abaixo).
2. Só com aquele identificador autorizado o cliente consegue completar o cadastro (aba "Cadastrar" do app) — ninguém mais consegue, mesmo sabendo a URL.
3. O próprio cliente cria e confirma a própria senha na hora do cadastro (`app/api/register.js` valida que as duas batem) — o Franklin nunca vê nem participa dessa senha.
4. Depois de confirmar, o cliente já fica logado (o app preenche e-mail/senha automaticamente na aba "Entrar", sem precisar digitar de novo) e pode voltar depois de qualquer navegador ou aparelho, só com e-mail e senha dele (autenticação sem sessão/cookie — cada chamada à API manda identificador+senha).
5. Antes de contratar pagamento automático, é assim que qualquer cliente novo entra no sistema — não pular a autorização manual do Franklin em nenhuma hipótese.

## Cota do Postiz Ultimate

O Postiz Ultimate tem **teto fixo de 500 imagens e 60 vídeos por mês, somando todos os clientes daquela conta** — não existe pacote de créditos avulsos extras dentro do mesmo plano. Antes de a cota estourar de fato, o sistema deve avisar Franklin com antecedência, calculando com base nos planos contratados pelos clientes ativos (não no uso publicado dia a dia, que o Postiz não expõe via API). Esse cálculo e o aviso preventivo estão na skill `postiz-cota` (`.claude/skills/postiz-cota/SKILL.md`), configurada em `.claude/postiz-planos.json`.

Quando a cota estourar (ou estiver prestes a estourar), a solução é Franklin contratar uma **segunda conta Postiz Ultimate**, autorizando o Claude Code a acessar também essa segunda conta (nova API key + segunda entrada no `.mcp.json`) — passo a passo completo na skill `postiz-cota`.

## O que Claude consegue fazer neste projeto

- Rodar comandos reais no PC do usuário (PowerShell) e no servidor Hetzner via SSH (usando `plink.exe`/`pscp.exe` do PuTTY — ver memória pra credenciais).
- Ver/analisar imagens diretamente (usadas pra escrever legenda/título/hashtag).
- Chamar a API do Postiz pra fazer upload de mídia e criar/publicar posts.
- Editar arquivos de configuração do projeto (docker-compose.yaml, Caddyfile, SKILL.md, etc.)

## O que Claude NÃO consegue fazer

- **Assistir ou transcrever vídeo** — sem essa capacidade. Pra vídeo, a legenda vem de: uma imagem pareada (mesmo nome de arquivo) que Claude consegue ver, ou do próprio nome do arquivo de vídeo escrito de forma descritiva, ou perguntando ao Franklin como último recurso.
- **Acessar Canva ou CapCut** — nenhuma integração, nenhum login, em nenhuma hipótese. Produção de vídeo/design fica fora do Postiz e fora do Claude.
- **Clicar em telas/navegador** por conta própria — sem acesso à sessão logada do usuário no navegador (só o que é feito via API/SSH/arquivo).
- **Processar pagamentos** — assinaturas pagas (ex: plano Postiz) o próprio usuário precisa fazer.
- **Ouvir áudio diretamente** — Claude Code só lê texto (e imagens enviadas como arquivo); não há microfone do lado do Claude. Pra falar com o Claude por voz, Franklin usa o ditado do Windows (`Win + H`), que transcreve a fala pra texto na caixa de digitação.
- **Emitir áudio nativamente** — mas isso já está automatizado via hook: um hook `Stop` (`.claude/settings.local.json`, script em `.claude/scripts/speak-response.ps1`) lê a última resposta do Claude em voz alta toda vez que ele termina de responder, usando o Windows Speech (SAPI/System.Speech) com a voz pt-BR instalada (Microsoft Maria Desktop), sem custo. Isso é local à máquina do Franklin, não faz parte do "cérebro" do Claude — se ele mudar de PC ou reinstalar, precisa recriar o hook.

## Onde achar mais detalhes

Configuração técnica detalhada (servidor, senhas, IDs de integração, histórico de decisões) está na memória do Claude (`~/.claude/projects/.../memory/`), não repetida aqui. O processo exato de publicação de cada cliente está no `SKILL.md` da respectiva pasta.
