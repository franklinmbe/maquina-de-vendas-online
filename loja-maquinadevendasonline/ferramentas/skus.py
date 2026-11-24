"""Lê as variações (SKUs) de produtos do AliExpress: para cada combinação clica nas opções
e anota nome, imagem, preço e imposto estimado. Uso: python skus.py ID1 ID2 ... > out.json"""
import sys, json, re, itertools
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
    return price, tax

out = {}
with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome', headless=True)
    ctx = b.new_context(locale='pt-BR', viewport={'width': 1366, 'height': 900},
                        user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36')
    for pid in sys.argv[1:]:
        page = ctx.new_page()
        try:
            page.goto(f'https://pt.aliexpress.com/item/{pid}.html', wait_until='domcontentloaded', timeout=60000)
            page.wait_for_selector('[class*="price-default--current"], [class*="product-price-current"]', timeout=40000)
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
        combos = []
        for combo in itertools.product(*[pr['opts'] for pr in props]) if props else [()]:
            if any(o['soldout'] for o in combo):
                combos.append({'names': [o['name'] for o in combo], 'soldout': True}); continue
            for o in combo:
                el = page.query_selector(f'[data-sku-col="{o["col"]}"]')
                if el and 'selected' not in (el.get_attribute('class') or ''):
                    el.click(); page.wait_for_timeout(900)
            price, tax = read_price(page)
            combos.append({'names': [o['name'] for o in combo], 'img': next((o['img'] for o in combo if o['img']), None), 'price': price, 'tax': tax})
            if len(combos) >= 30: break
        if not props:
            pr, tx = read_price(page); combos = [{'names': [], 'price': pr, 'tax': tx}]
        out[pid] = {'title': ptitle, 'gallery': gal[:8], 'props': [{'title': pr['title'], 'n': len(pr['opts'])} for pr in props], 'combos': combos}
        page.close()
        print(pid, len(combos), file=sys.stderr)
    b.close()
print(json.dumps(out, ensure_ascii=False, indent=1))
