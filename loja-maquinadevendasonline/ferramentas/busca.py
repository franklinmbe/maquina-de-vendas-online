"""Busca no AliExpress e lista os anúncios: id, título, preço, nota, vendidos. Uso: python busca.py "termo" """
import sys, re, json
from playwright.sync_api import sync_playwright
termo = sys.argv[1]
url = 'https://pt.aliexpress.com/w/wholesale-' + termo.replace(' ', '-') + '.html?sortType=total_tranpro_desc'
with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome', headless=True)
    pg = b.new_page(locale='pt-BR', viewport={'width': 1366, 'height': 2400},
                    user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36')
    pg.goto(url, wait_until='domcontentloaded', timeout=60000); pg.wait_for_timeout(6000)
    for _ in range(3): pg.mouse.wheel(0, 2000); pg.wait_for_timeout(1200)
    out = []
    for a in pg.query_selector_all('a[href*="/item/"], a[href*="productIds="]'):
        href = a.get_attribute('href') or ''
        m = re.search(r'(?:item/|productIds=)(\d{16})', href)
        if not m: continue
        txt = a.inner_text().replace('\n', ' | ')
        if len(txt) < 20: continue
        pid = m.group(1)
        if any(o['id'] == pid for o in out): continue
        price = re.search(r'R\$\s?([\d.,]+)', txt); star = re.search(r'\|\s*(\d,\d)\s*\|', txt); sold = re.search(r'([\d.]+\+?)\s*vendido', txt)
        out.append({'id': pid, 'preco': price.group(1) if price else None, 'nota': star.group(1) if star else None,
                    'vendidos': sold.group(1) if sold else None, 'titulo': txt[:120]})
    b.close()
print(json.dumps(out[:25], ensure_ascii=False, indent=0))
