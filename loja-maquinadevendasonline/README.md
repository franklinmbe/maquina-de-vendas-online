# Loja maquinadevendasonline.com.br

Cópia dos arquivos da loja (WordPress + WooCommerce) que roda na VPS da Hostinger, pra dar pra reconstruir se precisar. As senhas NÃO estão aqui: ficam só em `/opt/loja/.env` no servidor.

## Onde roda

- VPS Hostinger `179.199.132.109`, pasta `/opt/loja/` (containers `loja-wp` e `loja-db`, `docker compose up -d`).
- Atalho do WP-CLI no servidor: `wploja <comando>` (ex.: `wploja plugin list`).
- Domínio no Registro.br, registros A `@`, `www` e `app` → `179.199.132.109`. Cadeado (Let's Encrypt) pelo certbot, renova sozinho.
- Cópia da loja antiga (franklinmorais.com, 76 produtos + 362 fotos): `/opt/loja/backup-loja-antiga/`.

## Arquivos

- `mvo-design.php` + `mvo-design.css`: visual do app em todo o site. Vão em `/opt/loja/wp/wp-content/mu-plugins/`.
- `montar3.php`: monta o produto "Treinamento Máquina de Vendas Online" (5 planos) e a página de vendas. Rodar com `wploja eval-file /var/www/html/import/montar3.php` (as imagens ficam em `/opt/loja/wp/import/`). Pode rodar de novo, não duplica.
- `servidor/`: `docker-compose.yml`, `uploads.ini`, `cats.txt` (categorias), `wploja`, e os sites do Nginx da loja e do app (`app.maquinadevendasonline.com.br` → container `mvo`, porta 3000).

## Estado em 17/10/2026

- Loja no ar em https://maquinadevendasonline.com.br (página inicial = treinamento). Pagamento ainda não ligado.
- App no ar em https://app.maquinadevendasonline.com.br; o endereço antigo app.franklinmorais.com só redireciona (com o login).
- Hostnet: não pagar o vencimento de 20/10 se tudo continuar funcionando; o domínio franklinmorais.com fica até vencer (20/08/2027), sem renovar.
