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

Para rodar local (`vercel dev`), usar `vercel env pull` pra baixar essas variáveis pra um
`.env.local` local (esse arquivo já cai nas regras de `.gitignore` do repo, não é
commitado).
