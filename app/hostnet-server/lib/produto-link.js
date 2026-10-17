// "Link do produto → anúncio" do Cut Estúdio (Franklin, 2026-10-17): lê a
// página do produto (loja do cliente, Shopee, Mercado Livre...) e devolve
// nome, descrição e as fotos principais, pra virar banner e vídeo.
// Só busca endereços públicos (nunca rede interna do servidor) e com limite
// de tamanho e de tempo.
const dns = require('dns').promises;
const net = require('net');

const MAX_HTML = 3 * 1024 * 1024;
const MAX_IMG = 6 * 1024 * 1024;
const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';

function privateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return privateIp(v.slice(7));
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
}

async function assertPublic(url) {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol)) throw new Error('Use um link que comece com http:// ou https://.');
  const addrs = await dns.lookup(u.hostname, { all: true }).catch(() => []);
  if (!addrs.length) throw new Error('Não encontrei esse site. Confira o link.');
  if (addrs.some((a) => privateIp(a.address))) throw new Error('Esse link não pode ser aberto.');
  return u;
}

// fetch seguindo redirecionamento na mão, conferindo cada endereço.
async function safeFetch(url, max) {
  let current = url;
  for (let i = 0; i < 4; i++) {
    await assertPublic(current);
    const res = await fetch(current, { redirect: 'manual', headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9' }, signal: AbortSignal.timeout(15000) });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { current = new URL(res.headers.get('location'), current).href; continue; }
    if (!res.ok) throw new Error(`O site respondeu com erro (${res.status}).`);
    const len = Number(res.headers.get('content-length') || 0);
    if (len > max) throw new Error('Arquivo grande demais.');
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > max) throw new Error('Arquivo grande demais.');
    return { buf, type: res.headers.get('content-type') || '', url: current };
  }
  throw new Error('Esse link redireciona demais.');
}

// Tipo da foto pelo conteúdo (tem site que não manda o Content-Type).
function sniffImage(b) {
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50) return 'image/png';
  if (b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}

const decode = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;|&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(n)).replace(/\s+/g, ' ').trim();
function meta(html, prop) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, 'i');
  const tag = (html.match(re) || [])[0] || '';
  return decode((tag.match(/content=["']([^"']*)["']/i) || [])[1]);
}

// Produto em JSON-LD (padrão de quase toda loja: WooCommerce, Shopify, ML...).
function jsonLdProduct(html) {
  const blocks = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const b of blocks) {
    try {
      const data = JSON.parse(b.replace(/^<script[^>]*>|<\/script>$/gi, ''));
      const list = [].concat(data['@graph'] || data);
      const p = list.find((x) => x && /Product/i.test([].concat(x['@type']).join(',')));
      if (p) return p;
    } catch (e) { /* bloco inválido, tenta o próximo */ }
  }
  return null;
}

async function readProductLink(link) {
  const { buf, url } = await safeFetch(String(link || '').trim(), MAX_HTML);
  const html = buf.toString('utf8');
  const ld = jsonLdProduct(html) || {};
  const h1 = decode(((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '').replace(/<[^>]+>/g, ' '));
  const pageTitle = decode((html.match(/<title[^>]*>([^<]*)/i) || [])[1]).split(/ [–|-] /)[0];
  const titulo = decode(ld.name) || meta(html, 'og:title') || pageTitle || h1;
  // WooCommerce sem plugin de SEO: descrição curta fica numa div própria.
  const wooShort = decode(((html.match(/woocommerce-product-details__short-description[^>]*>([\s\S]*?)<\/div>/i) || [])[1] || '').replace(/<[^>]+>/g, ' '));
  const descricao = (decode(ld.description) || meta(html, 'og:description') || wooShort || meta(html, 'description')).replace(/<[^>]+>/g, ' ').slice(0, 700);
  let imgs = [].concat(ld.image || []).map((i) => (typeof i === 'string' ? i : i && (i.url || i.contentUrl))).filter(Boolean);
  if (!imgs.length) imgs = [meta(html, 'og:image'), meta(html, 'og:image:secure_url'), meta(html, 'twitter:image')].filter(Boolean);
  // Galeria do WooCommerce (as outras fotos do produto) e, por último, as
  // fotos grandes da página.
  imgs = imgs.concat([...html.matchAll(/data-large_image=["']([^"']+)["']/gi)].map((m) => decode(m[1])));
  if (!imgs.length) {
    imgs = [...html.matchAll(/<img[^>]+src=["']([^"']+\.(?:jpe?g|png|webp)[^"']*)["'][^>]*>/gi)]
      .filter((m) => !/logo|icon|avatar|sprite|placeholder/i.test(m[0])).map((m) => decode(m[1]));
  }
  imgs = [...new Set(imgs.map((i) => new URL(i, url).href))].slice(0, 4);
  if (!titulo) throw new Error('Não consegui ler o produto nesse link.');

  const imagens = [];
  for (const src of imgs) {
    if (imagens.length >= 3) break;
    try {
      const r = await safeFetch(src, MAX_IMG);
      const mime = sniffImage(r.buf);
      if (!mime || r.buf.length < 5000) continue;
      imagens.push({ mime, base64: r.buf.toString('base64') });
    } catch (e) { /* foto que não abriu fica de fora */ }
  }
  return { titulo: titulo.slice(0, 160), descricao, imagens, url };
}

module.exports = { readProductLink };
