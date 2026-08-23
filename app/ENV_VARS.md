# Variáveis de ambiente necessárias

Configurar no painel do Vercel (Project Settings > Environment Variables), nunca commitar
valores reais no repositório.

| Variável | Valor | Onde conseguir |
|---|---|---|
| `GITHUB_TOKEN` | token pessoal do GitHub, escopo `repo` (ou fine-grained `Contents: Read and write`) | gerado por Franklin |
| `GITHUB_OWNER` | `franklinmbe` | fixo |
| `GITHUB_REPO` | `maquina-de-vendas-online` | fixo |
| `APP_PASSPHRASE` | senha simples escolhida por Franklin | escolher uma senha |
| `BLOB_READ_WRITE_TOKEN` | injetada automaticamente pelo Vercel quando o Blob Store é conectado ao projeto | automático (Vercel) |
| `USERS_BLOB_SECRET` | string aleatória longa, só pra dar um nome imprevisível ao arquivo de cadastro de usuários no Blob | gerar uma vez e nunca mudar (mudar apaga o acesso ao cadastro salvo) |
| `SIGNUP_ALLOWLIST` | lista de e-mails/telefones autorizados por Franklin a se cadastrar, formato `identificador:cliente:plano` separados por vírgula (o `:plano` é opcional, mas recomendado pra entrar na conta de cota do Postiz — ver `.claude/skills/postiz-cota/SKILL.md`) | Franklin edita toda vez que fecha um novo cliente, ex: `kleber@exemplo.com:kleber-construcao:pro,5511999998888:nova-empresa:basico` |

Para rodar local (`vercel dev`), usar `vercel env pull` pra baixar essas variáveis pra um
`.env.local` local (esse arquivo já cai nas regras de `.gitignore` do repo, não é
commitado).
