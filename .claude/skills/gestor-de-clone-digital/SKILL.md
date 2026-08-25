---
name: gestor-de-clone-digital
description: Gera vídeos com o clone humano realista (rosto + movimento) de um cliente do Plano Personalizado, a partir de UM vídeo de referência que ele manda — via API do HeyGen (Digital Twin / Avatar IV). É a "Opção A" da pesquisa de clone de vídeo (2026-08-25): mais realista que o cartoon, mais cara, cobrada à parte do plano. Usar só quando o Franklin pedir explicitamente esse clone realista pra um cliente Personalizado — nunca por padrão.
---

Cria o clone de vídeo mais realista possível do cliente (rosto e movimento praticamente idênticos ao vídeo original) e usa esse clone pra gerar vídeos novos, com roteiro/tema diferente, na mesma estrutura. Exclusivo do **Plano Personalizado**, cobrado **à parte** do plano (não incluso na mensalidade) — ver regra comercial e preço em `CLAUDE.md`.

**Não é a mesma coisa que o pipeline "slideshow narrado"** da skill `gestor-de-geracao-ia-google` (esse é cartoon/imagem estática, muito mais barato). Essa skill aqui é especificamente pro clone humano fotorrealista.

**Duração máxima: 90 segundos** (regra fixa do projeto pra todo vídeo, ver `CLAUDE.md`) — nunca gerar roteiro/áudio mais longo que isso aqui, já que o custo do HeyGen é por minuto de vídeo gerado. Cliente que pedir vídeo mais longo não recebe automaticamente — é caso à parte pra Franklin decidir/implementar sob demanda.

## Status

**Ainda não testado com chamada real** — endpoints e formato de body abaixo vêm da documentação pública do HeyGen (`docs.heygen.com`/`developers.heygen.com`), não foram validados com uma chamada de verdade ainda (sem `HEYGEN_API_KEY` configurada nesta sessão). Confirmar o formato exato na documentação atual antes do primeiro uso real — a API do HeyGen já teve mudança de versão (v2 → v3) recentemente.

## Credencial

`HEYGEN_API_KEY` em `.claude/settings.local.json` (mesmo padrão do `GEMINI_API_KEY`/`POSTIZ_API_KEY`) — **ainda não configurada**. Franklin precisa:
1. Criar conta em heygen.com.
2. Ativar a API "Pay-As-You-Go" (créditos avulsos, sem assinatura — começa em US$5, ver `developers.heygen.com/docs/pricing`).
3. Copiar a API key gerada pra `.claude/settings.local.json`.

**Custo de referência**: Avatar IV / Digital Twin em 1080p ≈ **US$4/minuto** de vídeo gerado. Pago **por vídeo (crédito avulso), não é assinatura** — no teto fixo de 90s do projeto, dá **US$6 ≈ R$33 por vídeo**. Só precisa carregar o saldo mínimo (US$5) na API Pay-As-You-Go, não precisa contratar nenhum dos planos normais do HeyGen (Creator/Team/Business — esses são pra quem usa pelo site, não pela API).

### ElevenLabs (voz clonada) — pendente, ver nota abaixo

Clonar a voz de verdade do cliente exige `ELEVENLABS_API_KEY` (plano Creator, ~US$22/mês, cobrado **por assinatura mensal fixa**, não por vídeo) — **Franklin ainda não assinou** (decisão de 2026-08-25: vai assinar depois, sem previsão exata). **Enquanto isso não acontece, usar a voz genérica do Gemini TTS** (mesma da skill `gestor-de-geracao-ia-google`) como narração — o pipeline abaixo já está desenhado pra trocar só essa peça (o arquivo de áudio) sem mexer no resto, assim que o ElevenLabs estiver pago.

**Vagas de voz clonada**: o plano Creator do ElevenLabs dá **30 vagas de voz customizada** — cada cliente que clonar a própria voz usa 1 vaga, então dá pra ter até 30 clientes com voz clonada ao mesmo tempo sem pagar nada a mais que a assinatura fixa. Cliente que **não** quiser clonar a própria voz pode escolher entre as **vozes prontas da biblioteca do ElevenLabs** — essas são ilimitadas pra usar e não gastam vaga nenhuma, é uma opção grátis dentro do mesmo plano. Só precisa de plano maior se passar de 30 clientes com voz própria clonada simultaneamente (dá pra liberar vaga excluindo o clone de quem saiu).

## Consentimento — obrigatório, nunca pular

O HeyGen exige um **vídeo de consentimento** gravado pela própria pessoa antes de criar qualquer Digital Twin, mesmo sendo autoclonagem — é uma etapa hospedada na própria página do HeyGen (não uma tela nossa, não um formulário nosso). O cliente grava esse consentimento seguindo o link que o HeyGen fornece; só depois disso a API libera a criação do avatar. Sem essa etapa, a API rejeita a criação — não existe atalho.

## Pipeline

### 1. Criar o avatar (Digital Twin) a partir do vídeo do cliente

Requisitos do vídeo de treino: MP4, pelo menos 2 minutos, 720p ou mais, pessoa falando claramente. Tanto o vídeo de treino quanto o vídeo de consentimento precisam estar em uma URL pública (ex: subir pro storage do projeto ou um bucket temporário) antes da chamada.

```
POST https://api.heygen.com/v2/photo_avatar/... (ou endpoint "Digital Twin" — confirmar path exato em docs.heygen.com/docs/video-avatars-api antes do primeiro uso)
Headers: X-Api-Key: <HEYGEN_API_KEY>
Body: {
  "training_footage_url": "<URL pública do vídeo do cliente>",
  "video_consent_url": "<URL do vídeo de consentimento gravado pelo cliente>",
  "avatar_name": "<nome/identificador do cliente>"
}
```

Resposta traz um `avatar_id` (ou ID de job pra consultar status até o avatar ficar pronto — checar endpoint de status). Guardar esse `avatar_id` associado ao cliente (não regenerar o avatar a cada vídeo novo — um clone serve pra vários vídeos).

### 2. Roteiro dos vídeos novos

Escrever o roteiro de cada vídeo novo (mesma estrutura do vídeo original, tema diferente por vídeo) — mesmo processo de copy já usado nas outras skills (linguagem natural, curta, adequada ao tema pedido pelo cliente).

### 3. Narração (áudio)

**Hoje** (sem ElevenLabs pago): gerar o áudio com Gemini TTS, mesmo endpoint/processo já documentado em `gestor-de-geracao-ia-google/SKILL.md` (`gemini-3.1-flash-tts-preview`), voz genérica — não é a voz do cliente ainda, avisar isso se for relevante pro cliente saber.

**Depois** (quando `ELEVENLABS_API_KEY` existir): trocar por Instant/Professional Voice Cloning do ElevenLabs, usando uma amostra da voz do próprio cliente (extraída do vídeo de referência) — gera o áudio final na voz clonada. Essa troca não muda o passo 4 abaixo, só a origem do arquivo de áudio.

Salvar o áudio gerado como arquivo (MP3/WAV) acessível por URL pública ou fazer upload direto pro asset do HeyGen (`audio_asset_id` — ver endpoint de upload de asset na doc do HeyGen).

### 4. Gerar o vídeo final com o avatar + áudio

```
POST https://api.heygen.com/v3/videos
Headers: X-Api-Key: <HEYGEN_API_KEY>
Content-Type: application/json
Body: {
  "type": "avatar",
  "avatar_id": "<avatar_id do passo 1>",
  "voice": {
    "type": "audio",
    "audio_url": "<URL do áudio do passo 3>"
    // ou "audio_asset_id": "<id do asset já enviado>"
  },
  "resolution": "1080p",
  "aspect_ratio": "9:16"
}
```

Exatamente um entre `audio_url`/`audio_asset_id` deve ser passado — nunca os dois, nunca nenhum. A duração do vídeo final segue a duração do áudio.

Resposta traz um `video_id` — consultar o endpoint de status até o vídeo ficar pronto (processamento é assíncrono, não sai na hora) e baixar o arquivo final.

### 5. Entregar/publicar

Repetir os passos 2-4 pra cada vídeo novo pedido (mesma estrutura, tema diferente, mesmo `avatar_id` do passo 1 — não recriar o avatar). Depois de pronto, o vídeo final segue o mesmo destino de sempre: cai na pasta do cliente correspondente (`frank/`, `kleber-construcao/`, ou a pasta do cliente Personalizado em questão) pra ser publicado pela skill daquele cliente via Postiz — **nunca publicar direto daqui**, sempre entregar pra pasta certa do cliente primeiro, seguindo a regra fixa de nunca mover conteúdo entre pastas de clientes.

## Regra de negócio (ver também `CLAUDE.md`)

- Exclusivo do Plano Personalizado.
- **Cobrado à parte** — não incluso na mensalidade do plano, preço final ainda não definido/anunciado por Franklin (não escrever isso em `app/public/index.html` até ele decidir).
- Custo interno de referência: ~R$10-25 por vídeo gerado (30-60s), fora a fatia da assinatura do ElevenLabs quando estiver ativa.
