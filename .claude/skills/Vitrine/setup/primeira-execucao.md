# Primeira execucao — configurar a sua marca (faca uma vez)

A Vitrine coloca a **sua identidade** em todo painel que gera. Antes do primeiro relatorio,
configure isso. Leva 1 minuto.

## O que perguntar ao usuario

Pergunte (de forma simples, uma de cada vez ou tudo junto):

1. **Qual o nome do seu negocio / da sua marca?** (aparece no cabecalho de todo relatorio)
2. **Qual a sua cor de destaque?** Aceita nome ("azul", "verde", "vermelho", "roxo", "laranja")
   ou um codigo hex (ex.: `#3B6CFF`). Se nao souber, use `#3B6CFF` (azul). Converta nomes para hex:
   - azul `#3B6CFF` · verde `#0E9F6E` · vermelho `#E0344B` · roxo `#7A5AF8`
   - laranja `#F4860C` · rosa `#E0607E` · preto `#1A1D24` · teal `#0FB5BA`
3. **Tem um logo?** (opcional) Se sim, peca o **caminho do arquivo** (PNG/JPG/SVG). Sem logo,
   a Vitrine usa um selo com a inicial do negocio — fica elegante do mesmo jeito.
4. **Seu nome (profissional/responsavel)?** (opcional) Aparece no rodape como "Preparado por...".
5. **Algum contato pro rodape?** (opcional — e-mail, telefone ou site)

## O que fazer com as respostas

Crie o arquivo `.vitrine/config.md` **na raiz do projeto do usuario** (a pasta onde ele roda o
Claude Code, NAO dentro desta skill) com este conteudo, preenchendo os valores:

```
# Configuracao da marca — Vitrine
negocio: <nome do negocio>
cor: <hex da cor, ex. #3B6CFF>
logo: <caminho do logo ou deixe vazio>
profissional: <nome do responsavel ou vazio>
rodape: <contato ou vazio>
```

Crie a pasta `.vitrine/` se nao existir. Confirme ao usuario que a marca foi salva.

> Se o ambiente for **headless / automatico** e os valores ja vierem no pedido, apenas grave o
> config com eles e pule as perguntas interativas.

## Autodestruicao (importante)

Depois de gravar `.vitrine/config.md` com sucesso, **apague esta etapa de setup** para a skill
instalada ficar limpa:

```bash
rm -rf setup
```

(Execute a partir da pasta da skill `vitrine/`.) A partir daqui a marca esta salva e os proximos
relatorios ja saem com a identidade do usuario — sem repetir este passo.
