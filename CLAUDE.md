# Máquina de Vendas Online — contexto do projeto

Negócio de Franklin (franklinmbe@gmail.com): posta conteúdo (vídeo/foto/banner) nas redes sociais da própria marca pessoal + empresas clientes, usando o **Postiz** (ferramenta de agendamento/publicação open-source) como backend.

## Arquitetura

- **Postiz self-hosted** rodando num servidor Hetzner (detalhes de acesso/senha na memória, não aqui). Migração em andamento para o **plano pago hospedado do Postiz** (postiz.com) — mais simples de conectar redes (apps já aprovados), sem precisar manter servidor. Não apagar o Hetzner até o plano pago estar validado.
- **API pública do Postiz** (`/api/public/v1/...`) é o jeito de publicar programaticamente — mesma API nas duas versões (self-hosted e paga). Auth via header `Authorization: <POSTIZ_API_KEY>`. A chave atual fica em `.claude/settings.local.json` (`env.POSTIZ_API_KEY`).
- **Estrutura de pastas por marca/empresa**: cada pasta em `.claude/skills/<nome>/` representa um cliente/marca. Arquivos soltos direto na pasta = conteúdo novo pra postar nos canais daquele cliente (definidos no `SKILL.md` da pasta). Depois de publicado, o arquivo é movido pra `processados/` dentro da mesma pasta. **Regra fixa: só publica o que Franklin colocou direto na pasta daquele cliente — nunca mover/reclassificar um arquivo de uma pasta de skill pra outra como "correção".** Se um arquivo parecer ser de outra marca/empresa, a skill deve parar e reportar, não mover nem publicar (incidente real em 2026-08-20: um flyer de terceiro foi movido pra `kleber-construcao/` por engano e publicado nas redes do Kleber).
  - `frank/` — marca pessoal do Franklin (Facebook + Instagram próprios). Skill já completa.
  - `kleber-construcao/` — empresa de construção (cliente). Skill completa. Canais conectados no Postiz desde 2026-08-20: Facebook, Instagram, TikTok Business.
  - Outras empresas: ainda não criadas.

## Planos de venda e roteamento de produção de vídeo

O app (`app/`) vende 4 planos pro cliente final (ver cards em `app/public/index.html`, atrás do botão "Ver Planos"): Iniciante em Social Mídia (R$100), Profissional em Social Mídia (R$200), Especialista em Social Media + Gestor de Tráfego (R$300), e Projeto Personalizado (sob consulta). Cada plano promete uma quantidade de imagens/vídeos por IA por mês.

**Regra fixa (definida por Franklin em 2026-08-24) pra qual tecnologia gera cada vídeo:**
- **Iniciante e Profissional** → vídeo pelo caminho barato: pipeline "slideshow narrado" da skill `gestor-de-geracao-ia-google` (Nano Banana + Gemini TTS + FFmpeg, custo real por vídeo bem abaixo de R$5, sem cota mensal fixa). Não é vídeo com movimento — é slideshow de imagens + narração + legenda.
- **Especialista e Personalizado** → vídeo de qualidade melhor: geração de vídeo com movimento real via Postiz (modelo Veo 3), consumindo a cota mensal de vídeos IA do plano pago do Postiz. Justificativa: são os planos mais caros, então usam a tecnologia de vídeo melhor.

Franklin (`frank/`) e o Kleber (`kleber-construcao/`) estão, por enquanto, classificados como plano Especialista — ou seja, continuam usando vídeo via Postiz/Veo3, não o caminho barato. A regra do Iniciante/Profissional só entra em uso quando o primeiro cliente real desses planos assinar.

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
