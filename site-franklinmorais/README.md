# Site franklinmorais.com (Hostnet)

Site pessoal do Franklin: Franklin Morais, empreendedor digital, agência de marketing digital, com os treinamentos dele. A loja WooCommerce (dropshipping AliExpress) continua no mesmo WordPress e não é mexida por aqui.

## Como funciona

- Hospedagem Hostnet (plano Start, 1 GB, PHP 7.4). Acesso só por FTP (`ftp.franklinmorais.com`, usuário `franklinmorais`; a senha fica na memória do Claude, não aqui). Não tem SSH nem wp-cli.
- Visual = o mesmo da loja maquinadevendasonline.com.br: tema Twenty Twenty-Five + `../loja-maquinadevendasonline/mvo-design.php` e `mvo-design.css` em `www/wp-content/mu-plugins/`.
- `montar-inicio.php`: monta a página inicial, o cabeçalho e o rodapé, e troca o tema. Sobe como `www/mvo-montar.php` com uma linha `define('MVO_KEY', '<chave>')` no topo, abre `https://www.franklinmorais.com/mvo-montar.php?k=<chave>` e apaga o arquivo logo depois. Pode rodar de novo, não duplica.
- Para voltar ao tema antigo (Gradiant) e à página inicial antiga: mesma URL com `&voltar=1`.
- Imagens da página vêm da loja maquinadevendasonline.com.br (a Hostnet está com o espaço estourado), menos a foto do Franklin, que já estava no site.
- Botões de comprar levam ao pagamento da maquinadevendasonline (mesma conta Mercado Pago).

## Cópia de segurança (20/10/2026)

Na VPS da Hostinger: `/opt/backup-franklinmorais/www` (todos os arquivos, 2 GB) e `/opt/backup-franklinmorais/db-20261020.sql.gz` (banco inteiro, 101 tabelas).
