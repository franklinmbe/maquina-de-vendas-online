"""Lê as variações (SKUs) de produtos do AliExpress: para cada combinação clica nas opções
e anota nome, imagem, preço e imposto estimado. Uso: python skus.py ID1 ID2 ... > out.json"""
import sys, json, re, itertools, time
from playwright.sync_api import sync_playwright

def num(s):
    m = re.search(r'R\$\s?([\d.]+,\d{2})', s or '')
    return float(m.group(1).replace('.', '').replace(',', '.')) if m else None

def read_price(page):
    txt = page.inner_text('body')
    i = txt.find('impostos estimados')
    tax = None
    if i > 0:
        m = re.findall(r'R\$\s?([\d.]+,\d{2})\+?\s*em impostos', txt[max(0, i - 80):i + 20])
        tax = float(m[-1].replace('.', '').replace(',', '.')) if m else None
    price = None
    for sel in ['[class*="price-default--current"]', '[class*="product-price-current"]', '[class*="price--current"]']:
        el = page.query_selector(sel)
        if el:
            price = num(el.inner_text())
            if price: break
    if not price:
        j = txt.find('vendido')
        price = num(txt[j:j + 300]) if j > 0 else None
    return price, tax

def livre(page, s=300):
    """Se o AliExpress abrir o "não sou um robô", espera o Franklin clicar (até 5 min)."""
    for _ in range(s // 3):
        vis = False
        for sel in ['.baxia-dialog', '.J_MIDDLEWARE_FRAME_WIDGET', 'iframe[src*="punish"]']:
            d = page.query_selector(sel)
            if d and d.is_visible(): vis = True
        if not vis: return
        page.bring_to_front(); page.wait_for_timeout(3000)

import os
SAIDA = os.environ.get('SKUS_SAIDA')
out = json.load(open(SAIDA, encoding='utf8')) if SAIDA and os.path.exists(SAIDA) else {}
with sync_playwright() as p:
    # perfil próprio do robô: se o AliExpress pedir "não sou um robô", a janela fica aberta para o Franklin clicar (5 min)
    ctx = p.chromium.launch_persistent_context('C:/Users/rjino/.mvo-aliexpress-perfil', channel='chrome', headless=False,
                                               locale='pt-BR', viewport={'width': 1366, 'height': 900})
    b = ctx
    for pid in sys.argv[1:]:
        if pid in out and 'erro' not in out[pid]: continue
        page = ctx.new_page()
        try:
            page.goto(f'https://pt.aliexpress.com/item/{pid}.html', wait_until='domcontentloaded', timeout=60000)
            page.bring_to_front()
            page.wait_for_selector('[data-sku-col], [class*="price-default--current"], [class*="product-price-current"]', timeout=300000)
        except Exception as e:
            out[pid] = {'erro': str(e)[:120]}; page.close(); continue
        page.wait_for_timeout(3000)
        gal = []
        for im in page.query_selector_all('[class*="slider--img"] img, [class*="slider--item"] img'):
            u = (im.get_attribute('src') or '').split('_220x220')[0].split('_80x80')[0].split('.jpg_')[0]
            if u.startswith('http') and 'kf/' in u:
                if not re.search(r'\.(jpg|png|webp)$', u): u += '.jpg'
                if u not in gal: gal.append(u)
        ptitle = page.title().replace(' - AliExpress', '')
        rows = page.query_selector_all('[class*="sku-item--property"]')
        props = []
        for r in rows:
            t = r.query_selector('[class*="sku-item--title"]')
            title = (t.inner_text().split(':')[0].strip() if t else 'Opção')
            items = r.query_selector_all('[data-sku-col]')
            opts = []
            for it in items:
                cls = it.get_attribute('class') or ''
                img = it.query_selector('img')
                name = (img.get_attribute('alt') if img else it.inner_text()).strip()
                src = img.get_attribute('src').split('_220x220')[0] if img else None
                opts.append({'col': it.get_attribute('data-sku-col'), 'name': name, 'img': src, 'soldout': 'soldOut' in cls})
            props.append({'title': title, 'opts': opts})
        # Só clica nas opções da 1ª linha (cor): cada clique pode chamar o "não sou um robô".
        # As outras linhas (tamanho etc.) herdam o preço da cor e entram só se não estiverem esgotadas.
        combos = []
        if props:
            for o in props[0]['opts']:
                if o['soldout']:
                    combos.append({'names': [o['name']], 'soldout': True}); continue
                el = page.query_selector(f'[data-sku-col="{o["col"]}"]')
                if el and 'selected' not in (el.get_attribute('class') or ''):
                    livre(page)
                    try: el.click(timeout=8000)
                    except Exception: livre(page); el.click(timeout=60000)
                    page.wait_for_timeout(2500)
                livre(page)
                price, tax = read_price(page)
                resto = []
                for pr in props[1:]:
                    ok = []
                    for o2 in pr['opts']:
                        e2 = page.query_selector(f'[data-sku-col="{o2["col"]}"]')
                        if e2 and 'soldOut' not in (e2.get_attribute('class') or ''): ok.append(o2['name'])
                    resto.append(ok)
                for rest in itertools.product(*resto) if resto else [()]:
                    combos.append({'names': [o['name'], *rest], 'img': o['img'], 'price': price, 'tax': tax})
        if not props:
            pr, tx = read_price(page); combos = [{'names': [], 'price': pr, 'tax': tx}]
        body = page.inner_text('body'); k = body.find('vendido')
        out[pid] = {'novo_usuario': re.findall(r'[Nn]ovo usu[áa]rio[^\n]{0,40}', body[k:k + 600]), 'title': ptitle, 'gallery': gal[:8], 'props': [{'title': pr['title'], 'n': len(pr['opts'])} for pr in props], 'combos': combos}
        page.close()
        print(pid, len(combos), file=sys.stderr)
        if SAIDA: json.dump(out, open(SAIDA, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
        time.sleep(int(os.environ.get('SKUS_PAUSA', '15')))  # devagar: menos "não sou um robô"
    b.close()
print(json.dumps(out, ensure_ascii=False, indent=1))
