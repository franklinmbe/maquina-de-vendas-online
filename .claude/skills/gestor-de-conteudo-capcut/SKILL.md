---
name: gestor-de-conteudo-capcut
description: Monta projetos de vídeo (cortes, texto, efeitos, legendas) programaticamente usando o CapCut instalado no PC do Franklin, via o projeto open-source CapCutAPI/VectCutAPI. Não é oficial da CapCut, é uma ferramenta de terceiros.
---

Esta skill dá a capacidade de montar um projeto de vídeo do CapCut via código, sem precisar editar manualmente na interface — cortes, texto, efeitos, transições, legendas. **Não é uma integração oficial da CapCut** (eles não têm API pública pra isso), é a ferramenta open-source [VectCutAPI/CapCutAPI](https://github.com/sun-guannan/CapCutAPI).

## O que essa skill NÃO faz

- Não exporta o vídeo final sozinha. Gera um **rascunho** que o Franklin precisa abrir no app do CapCut e exportar manualmente no final.
- Não roda "na nuvem" — depende do CapCut instalado neste PC (`C:\Users\rjino\AppData\Local\CapCut\`).

## Onde está instalado

- Código do projeto: `.claude/skills/gestor-de-conteudo-capcut/VectCutAPI-1.5.0/` (versão travada na tag v1.5.0 — a branch "main" do projeto tinha um bug de import quebrado em 2026-08-17, `TextStyleRange` não existe em `pyJianYingDraft/text_segment.py` daquela branch; v1.5.0 funciona, testado e confirmado)
- Dependências: Python 3.12, Git, FFmpeg — todos instalados no PATH do usuário deste PC nesta sessão (2026-08-17)
- Config: `config.json` (copiado de `config.json.example`, valores padrão — `is_upload_draft: false`, então o `oss_config` do Alibaba Cloud não é usado e pode ficar com os placeholders)

## Como usar

**1. Subir o servidor local** (fica ouvindo em `http://127.0.0.1:9001`):
```powershell
cd ".claude/skills/gestor-de-conteudo-capcut/VectCutAPI-1.5.0"
python capcut_server.py
```
Isso bloqueia o terminal (roda em primeiro plano) — usar `run_in_background: true` na tool do PowerShell, ou `Start-Process` redirecionando output.

**2. Montar o projeto via chamadas HTTP** (exemplos testados/confirmados: `POST /create_draft` funciona e retorna `draft_id` + `draft_url`):
```
POST /create_draft   {width, height} -> retorna draft_id
POST /add_video      {draft_id, video_url, start, end, ...}
POST /add_text       {draft_id, text, start, end, font_size, ...}
POST /add_audio, /add_image, /add_subtitle, /add_effect, /add_sticker
POST /save_draft      {draft_id} -> gera pasta local "dfd_..."
```
Ver `example.py` e `rest_client_test.http` dentro da pasta do projeto pra exemplos completos de cada endpoint.

**3. Entregar pro Franklin**: a pasta gerada (prefixo `dfd_`) precisa ser copiada pro diretório de rascunhos do CapCut no PC dele. Depois disso, ele abre o app do CapCut, encontra o rascunho, revisa e clica em exportar.

## Observações

- Servidor Flask de desenvolvimento (não é produção) — não deixar rodando 24/7 sem necessidade, subir só quando for usar.
- Existe também um `mcp_server.py` no projeto (protocolo MCP) que daria acesso a essas mesmas funções como tools nativas do Claude, em vez de eu precisar chamar HTTP manualmente — não configurado ainda nesta sessão (precisaria registrar em `.mcp.json` na raiz do projeto e reiniciar a sessão do Claude Code pra carregar). Vale fazer isso se essa skill virar uso frequente.
- Projeto é comunidade (~85 estrelas no fork antigo CapCutAPI, agora renomeado pra VectCutAPI), não é backed por empresa grande — testar bem antes de confiar em produção real.
