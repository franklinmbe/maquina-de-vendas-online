# Máquina de Vendas Online — contexto do projeto

Negócio de Franklin (franklinmbe@gmail.com): posta conteúdo (vídeo/foto/banner) nas redes sociais da própria marca pessoal + empresas clientes, usando o **Postiz** (ferramenta de agendamento/publicação open-source) como backend.

## Autorização permanente pra mudanças de rotina neste repositório (definido por Franklin em 2026-08-24)

Franklin autorizou de forma permanente e ampla: **não precisa pedir aprovação nem confirmação pra nenhum passo do trabalho de rotina neste repositório** — edição de conteúdo/copy/imagens do app (`app/`), configuração do projeto, docs, e o fluxo git inteiro (commit → push na `claude/oi-tn5hb3` → PR → merge na `main`). Frases dele: "não precisa ficar pedindo a mesma autorização toda hora, tá tudo liberado" e depois, explicitamente mais amplo, "todas as autorizações coloca tudo automático sem me perguntar mais nada". Fazer o fluxo completo direto, sem pausar pra confirmação em cada etapa. Continua valendo mostrar o resultado (screenshot/preview) quando fizer sentido, mas isso é informativo, não um pedido de permissão bloqueante.

**Onde ainda faz sentido perguntar, mesmo com essa autorização**: quando o próprio *conteúdo* pedido está ambíguo o suficiente pra arriscar publicar algo errado (nesse caso, uma pergunta objetiva, uma vez só — não sendo sobre "posso prosseguir", e sim sobre "o que exatamente você quer"). Ações genuinamente destrutivas ou fora do escopo deste projeto (apagar o servidor Hetzner, mexer em billing/pagamento, etc.) continuam fora dessa autorização — não são o tipo de coisa que acontece nesse fluxo de conteúdo/app de qualquer forma.

## Hospedagem do app (Vercel)

- O app (`app/`) é publicado no **Vercel**, com deploy automático a cada push na `main`.
- **2026-08-24**: o volume de merges/deploys num único dia esgotou o limite de build do plano gratuito (Hobby) — vários PRs ficaram com status `Vercel: Deployment rate limited — retry in 24 hours` e não publicaram, mesmo com o código correto no GitHub. Franklin fez upgrade pro **plano Pro do Vercel** no mesmo dia pra resolver isso e evitar que o teste grátis (que pode trazer bastante gente de uma vez) trave o app.
- **Lição operacional**: evitar mesclar/disparar deploy a cada ajuste pequeno — agrupar várias mudanças antes de mesclar na `main`, pra não esgotar limite de build de novo (mesmo no Pro, que tem limite maior mas não é infinito).

## Arquitetura

- **Postiz self-hosted** rodando num servidor Hetzner (detalhes de acesso/senha na memória, não aqui). Migração em andamento para o **plano pago hospedado do Postiz** (postiz.com) — mais simples de conectar redes (apps já aprovados), sem precisar manter servidor. Não apagar o Hetzner até o plano pago estar validado.
- **API pública do Postiz** (`/api/public/v1/...`) é o jeito de publicar programaticamente — mesma API nas duas versões (self-hosted e paga). Auth via header `Authorization: <POSTIZ_API_KEY>`. A chave atual fica em `.claude/settings.local.json` (`env.POSTIZ_API_KEY`).
- **Estrutura de pastas por marca/empresa**: cada pasta em `.claude/skills/<nome>/` representa um cliente/marca. Arquivos soltos direto na pasta = conteúdo novo pra postar nos canais daquele cliente (definidos no `SKILL.md` da pasta). Depois de publicado, o arquivo é movido pra `processados/` dentro da mesma pasta. **Regra fixa: só publica o que Franklin colocou direto na pasta daquele cliente — nunca mover/reclassificar um arquivo de uma pasta de skill pra outra como "correção".** Se um arquivo parecer ser de outra marca/empresa, a skill deve parar e reportar, não mover nem publicar (incidente real em 2026-08-20: um flyer de terceiro foi movido pra `kleber-construcao/` por engano e publicado nas redes do Kleber).
  - `frank/` — marca pessoal do Franklin (Facebook + Instagram próprios). Skill já completa.
  - `kleber-construcao/` — empresa de construção (cliente). Skill completa. Canais conectados no Postiz desde 2026-08-20: Facebook, Instagram, TikTok Business.
  - Outras empresas: ainda não criadas.

## Planos de venda e roteamento de produção de vídeo

O app (`app/`) vende 4 planos pro cliente final (ver cards em `app/public/index.html`, atrás do botão "Ver Planos"): Iniciante em Social Mídia (R$100), Profissional em Social Mídia (R$200), Especialista em Social Media + Gestor de Tráfego (R$300), e Projeto Personalizado (sob consulta). Cada plano promete uma quantidade de imagens/vídeos por IA por mês.

**Regra fixa (definida por Franklin em 2026-08-24, revisada no mesmo dia) pra qual tecnologia gera cada vídeo e imagem:**
- **Iniciante, Profissional e Especialista** → tudo (fotos e vídeos) pelo caminho barato: pipeline da skill `gestor-de-geracao-ia-google` — imagens via Nano Banana, vídeo via "slideshow narrado" (Nano Banana + Gemini TTS + FFmpeg, custo real por vídeo bem abaixo de R$5, sem cota mensal fixa). Não é vídeo com movimento — é slideshow de imagens + narração + legenda.
- **Somente Projeto Personalizado** → design/vídeo de qualidade melhor: geração com movimento real via Postiz (modelo Veo 3), consumindo a cota mensal de vídeos IA do plano pago do Postiz. Justificativa: é o plano mais caro/sob consulta, então usa a tecnologia de vídeo melhor.

Franklin (`frank/`) e o Kleber (`kleber-construcao/`) estão classificados como plano Personalizado — ou seja, continuam usando vídeo/design via Postiz/Veo3, o caminho de melhor qualidade. A regra do caminho barato só entra em uso quando o primeiro cliente real de Iniciante/Profissional/Especialista assinar.

**Custo de referência pra orçamento/margem: R$3/vídeo** (definido por Franklin em 2026-08-24) — número arredondado com margem de segurança sobre o custo real medido do pipeline "slideshow narrado" (Nano Banana + Gemini TTS + FFmpeg, ~R$1,20/vídeo). Usar esse valor em qualquer cálculo de custo/margem dos planos Iniciante/Profissional/Especialista daqui pra frente. O custo das imagens por IA (~R$0,19/imagem, cota própria de cada plano) entra à parte, somado ao custo de vídeo — não está incluído dentro do R$3.

### Clone de vídeo do próprio cliente — Opção A implementada, cobrada à parte (decidido por Franklin em 2026-08-25)

Pesquisa de 2026-08-25 comparou 3 jeitos de gerar vídeo com a cara/voz do próprio cliente a partir de UM vídeo que ele manda (pedido: "clonar ele mesmo" pra gerar outros vídeos, mesma estrutura, temas diferentes): **Opção A** (clone humano fotorrealista, via HeyGen), **Opção B1** (clone em desenho animado, sem lip-sync, reaproveitando o pipeline "slideshow narrado"), **Opção B2** (desenho animado com lip-sync real, ainda não testado). Franklin decidiu implementar a **Opção A agora** — skill `gestor-de-clone-digital` (ver `SKILL.md` da pasta), ainda não testada com chamada real (falta a API key).

**Regra comercial**: exclusiva do Plano Personalizado (que parte de R$500/mês). **1 vídeo clonado por semana incluso** (4-5/mês), o cliente pode pedir ajuste/reedição nesse vídeo durante a semana. Vídeo extra além desse, o cliente **paga à parte** — preço final ainda não decidido por Franklin. **Não escrever nada disso em `app/public/index.html` ainda** — ele decide depois o que entra no texto do plano.

**Pendências pra funcionar de verdade**:
- `HEYGEN_API_KEY` — Franklin ainda precisa criar a conta HeyGen e ativar o pay-as-you-go (a partir de US$5). Custo de referência: ~US$4/min de vídeo gerado (Avatar IV/Digital Twin 1080p) ≈ R$10-25 por vídeo de 30-60s — é esse número que embasa "dar 4 vídeos de ~R$25/mês não é problema" dentro de um plano de R$500+.
- `ELEVENLABS_API_KEY` — pra clonar a voz de verdade do cliente (plano Creator, ~US$22/mês). **Franklin ainda não assinou** (sem dinheiro sobrando no momento, cogita assinar numa sexta-feira próxima, sem data fechada). **Enquanto isso, usar a voz genérica do Gemini TTS** como narração (já configurada) — o pipeline da skill já está desenhado pra trocar só essa peça depois, sem mexer no resto.
- Cada cliente precisa gravar um vídeo de consentimento pelo fluxo oficial do HeyGen antes de qualquer clone ser criado (mesmo sendo autoclonagem) — não é opcional, a API não libera sem isso.

### Teste grátis — 7 dias (definido por Franklin em 2026-08-24)

O botão "Testar Grátis — 7 Dias" (presente em todos os 4 cards de plano em `app/public/index.html`) ainda não tem link/ação — falta implementar o cadastro do cliente pro teste. Mas a regra de uso já está definida, pra quando isso for implementado:

- Quem se cadastra no teste grátis recebe acesso às ferramentas do **plano Iniciante em Social Mídia**, mas **não** a cota cheia mensal desse plano (30 imagens / 4 vídeos) — o teste de 7 dias tem uma cota própria, menor:
  - **2 vídeos** durante os 7 dias
  - **10 imagens** durante os 7 dias
  - O resto dos recursos do plano Iniciante (posts ilimitados, preenchimento automático com IA, copiloto de IA, autocompletar com IA, editor de imagem avançado) fica liberado normalmente, sem redução.
- Geração de imagem/vídeo do teste grátis segue o mesmo caminho barato do plano Iniciante (ver regra de roteamento acima — pipeline `gestor-de-geracao-ia-google`).
- **Ainda não implementado**: depois dos 7 dias, o plano é pra pedir cadastro de cartão de crédito do cliente e começar a cobrar automaticamente. Essa parte (captura de cartão, cobrança recorrente) fica pra depois — por enquanto só a regra de cota do teste está definida.

### Conectar redes sociais do cliente direto no app (decidido em 2026-08-25, substitui a ideia original via Postiz)

Objetivo: hoje é o Franklin quem conecta manualmente a rede social de cada cliente no Postiz. A ideia é o próprio cliente conectar sozinho, direto pelo app, depois de já estar cadastrado/liberado (ver fluxo de liberação de acesso acima) — sem nunca precisar do Franklin nem do Claude tocando na senha dele.

**Pesquisa feita em 2026-08-24/25 sobre fazer isso via Postiz — descartada**: investigamos conectar via conta paga do Postiz (postiz.com) e não dá pra fazer com segurança hoje: (1) conectar uma rede nova só existe pela tela do próprio Postiz, não pela API pública; (2) o Postiz ainda não garante isolamento entre clientes diferentes dentro da mesma conta (um cliente logado poderia enxergar contas de outro) — é um pedido em aberto no GitHub deles (`gitroomhq/postiz-app`, ver issues sobre multi-tenant/permissão por grupo), não implementado; (3) o programa Enterprise/white-label do Postiz (que resolveria isso de vez) não está aceitando novas inscrições no momento.

**Arquitetura decidida (a fazer)**: em vez de Postiz, criar **apps próprios registrados direto em cada rede social** (Meta for Developers pra Facebook/Instagram, TikTok for Developers, etc.), registrados em nome da Máquina de Vendas Online:
1. Cliente logado clica no ícone da rede (Facebook, Instagram, TikTok...) → abre a tela **oficial daquela rede** (nunca uma tela nossa fingindo ser a rede, nunca um formulário nosso pedindo a senha dele) → ele autoriza "Máquina de Vendas Online" a postar em nome dele, uma única vez.
2. Isso gera um **token de acesso** (OAuth) que fica guardado com segurança do lado do servidor — nunca a senha do cliente, só esse token, revogável a qualquer momento por ele.
3. Daí em diante, é tudo automatizado: cliente manda o pedido (texto/áudio/fotos, como já funciona hoje), e a publicação em si (criar título/legenda, decidir formato, publicar) é feita via **API oficial de cada rede** (Graph API do Meta, API do TikTok, etc.), usando aquele token — sem precisar do Postiz pra essas contas.
4. Postiz continua sendo usado como está hoje pras contas já conectadas manualmente (`frank/`, `kleber-construcao/`) — essa nova arquitetura é só pra clientes novos que forem se conectando pelo app daqui pra frente.

**Plano de migração futura (decidido por Franklin em 2026-08-25)**: Franklin e o Kleber continuam no Postiz por enquanto, servindo de teste/validação de cada rede nova (Facebook, Instagram, e as demais que forem sendo configuradas, seguindo o mesmo padrão do TikTok que já funciona). Conforme cada rede for validada nesse esquema por fora, migrar Franklin e o Kleber pra ela também. **Condição fixa pra cancelar o Postiz**: só cancelar a assinatura paga quando **todas** as redes sociais estiverem conectando pelo esquema OAuth próprio (por fora do Postiz) **e** isso estiver confirmado funcionando de verdade em produção — não é pra cancelar com só algumas redes migradas, nem antes de validar. Até lá, **não cancelar**, o mês pago continua ativo e sendo usado.

**Regra fixa, não muda nunca**: nunca pedir, coletar, digitar ou guardar a senha real de login de nenhuma rede social de nenhum cliente, em nenhuma hipótese, nem "por fora", nem "só de passagem". A única forma de autorização aceitável é o fluxo oficial de OAuth de cada rede (o cliente autoriza na tela deles, a gente só recebe o token).

**Antes de implementar, cada rede social exige**:
- Registrar um app de desenvolvedor na plataforma (Meta for Developers, TikTok for Developers, Google Cloud/YouTube, etc.).
- Passar pelo processo de revisão/aprovação de permissões da própria rede (o Meta, por exemplo, exige App Review pra permissões de publicar em nome de terceiros — leva alguns dias e exige demonstrar o caso de uso funcionando).
- Guardar os tokens dos clientes de forma segura (nunca em texto puro no GitHub — hoje o app grava pedidos em `.claude/skills/<client>/.../instrucoes.txt` no GitHub via `app/api/commit.js`, então tokens **não podem** seguir esse mesmo caminho).

**Por onde começar**: Facebook + Instagram primeiro (mesma API do Meta, cobre a maioria dos clientes hoje). TikTok, Google/YouTube, LinkedIn e X viriam depois, cada um com seu próprio registro/revisão.

**Limite de redes sociais por plano (definido por Franklin em 2026-08-25)**, já refletido como item de destaque em cada card de plano em `app/public/index.html`:
- Iniciante em Social Mídia: **3 redes sociais**
- Profissional em Social Mídia: **5 redes sociais**
- Especialista em Social Media + Gestor de Tráfego: **10 redes sociais**
- Projeto Personalizado: **todas as redes sociais disponíveis no app** (sem limite)

**Pendente — não implementar ainda**: falta bloquear de verdade no código a quantidade de conexões de acordo com o plano do cliente (campo `plan` já existe no cadastro, ver `app/api/register.js`/`_lib/users.js`, mas hoje não trava nada) — por enquanto os números acima são só o que está anunciado na tela de planos.

**Estado atual do código**: os ícones de rede social já ficam clicáveis — se o cliente não estiver logado, abrem a tela "Ver Planos" (força resolver o plano antes de cadastrar rede social); se já estiver logado, hoje só mostram uma mensagem "em breve" — falta implementar de fato a arquitetura descrita acima.

## Evolução futura do projeto (ideias aprovadas, ainda não implementadas)

Itens que Franklin já aprovou como direção, mas que ficam pra depois — perguntar aqui quando quiser retomar.

- **Benefício exclusivo do Projeto Personalizado — Ads avançado sem teto de verba (definido em 2026-08-25)**: hoje o Especialista promete "gestor de tráfego" mas capado em até R$200 de crédito de impulsionamento (ver card em `app/public/index.html`). A ideia é o Personalizado ganhar uma camada de tráfego pago claramente acima disso, exclusiva desse plano: sem teto de verba fixo (o cliente define o orçamento de anúncio dele) + recursos avançados que nenhum outro plano oferece — público customizado, teste A/B de anúncios, catálogo de produtos dinâmico. Tecnicamente viável com o MCP do Meta Ads já conectado nesta sessão (ferramentas de custom audience, `ads_experiment_abtest_*`, catálogo/`ads_catalog_*` já existem). Pendências antes de implementar: definir quem configura a conta de anúncio do cliente, como acompanhar o orçamento real dele (billing continua sendo do cliente, não da Máquina de Vendas Online), e atualizar o card do Personalizado em `app/public/index.html` com esse recurso.

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
