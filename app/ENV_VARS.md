# Variáveis de ambiente necessárias

Configurar no painel do Vercel (Project Settings > Environment Variables), nunca commitar
valores reais no repositório.

| Variável | Valor | Onde conseguir |
|---|---|---|
| `GITHUB_TOKEN` | token pessoal do GitHub, escopo `repo` (ou fine-grained `Contents: Read and write`) | gerado por Franklin |
| `GITHUB_OWNER` | `franklinmbe` | fixo |
| `GITHUB_REPO` | `maquina-de-vendas-online` | fixo |
| `APP_PASSPHRASE` | senha pessoal do Franklin — só serve pro login dele mesmo (aba "Entrar"), nunca é usada no cadastro de cliente | escolher uma senha |
| `BLOB_READ_WRITE_TOKEN` | injetada automaticamente pelo Vercel quando o Blob Store é conectado ao projeto | automático (Vercel) |
| `USERS_BLOB_SECRET` | string aleatória qualquer, usada só pra compor um nome de arquivo imprevisível no Blob (`data/users-<secret>.json`) onde ficam os cadastros | gerar uma string aleatória (ex: `openssl rand -hex 16`) |
| `SIGNUP_ALLOWLIST` | lista de e-mails/telefones que Franklin autorizou a se cadastrar, separados por vírgula, no formato `identificador:cliente:plano` (plano é opcional). Ex: `kleber@exemplo.com:kleber-construcao:profissional,5511912345678:kleber-construcao:profissional` | Franklin edita esta variável no Vercel toda vez que fecha um cliente novo — é a autorização manual do cadastro, sem envolver nenhuma senha do Franklin |
| `META_APP_ID` | ID do app criado no Meta for Developers (Facebook + Instagram) | painel do Meta for Developers, depois de criar o app |
| `META_APP_SECRET` | segredo do mesmo app do Meta for Developers | painel do Meta for Developers, aba de configurações básicas do app |
| `OAUTH_STATE_SECRET` | string aleatória qualquer, usada só pra assinar o `state` do fluxo OAuth de conexão de redes sociais (garante que o retorno do Facebook é do mesmo cliente que iniciou) | gerar uma string aleatória (ex: `openssl rand -hex 32`) |
| `TOKEN_ENCRYPTION_KEY` | chave de 32 bytes em hexadecimal (64 caracteres), usada pra cifrar os tokens de acesso das redes sociais dos clientes antes de salvar no Blob | gerar com `openssl rand -hex 32` |

Para rodar local (`vercel dev`), usar `vercel env pull` pra baixar essas variáveis pra um
`.env.local` local (esse arquivo já cai nas regras de `.gitignore` do repo, não é
commitado).
