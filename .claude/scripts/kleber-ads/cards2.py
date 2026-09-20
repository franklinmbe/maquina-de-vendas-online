from PIL import Image, ImageDraw, ImageFont, ImageEnhance, ImageFilter
import math, os
D = os.path.join(os.environ['TEMP'], 'kleber-carrossel')
K = 'C:/Users/rjino/OneDrive/Desktop/Franklin/MAESTROS DA IA/MÁQUINA DE VENDAS ONLINE/.claude/skills/kleber-construcao/'
S = 1080
ORANGE, YELLOW, DARK, WHITE, GREEN, DGREEN = (255, 106, 0), (255, 200, 0), (22, 22, 22), (255, 255, 255), (37, 211, 102), (7, 94, 84)
IMP, ARB, ARI = 'C:/Windows/Fonts/impact.ttf', 'C:/Windows/Fonts/arialbd.ttf', 'C:/Windows/Fonts/arial.ttf'
def F(path, size): return ImageFont.truetype(path, size)
_d = ImageDraw.Draw(Image.new('RGB', (10, 10)))
def fit(text, path, maxw, start):
    s = start
    while s > 24 and _d.textlength(text, font=F(path, s)) > maxw: s -= 4
    return F(path, s)
def otext(d, xy, text, f, fill, stroke=DARK, sw=8, shadow=(7, 9), center_w=None):
    x, y = xy
    if center_w: x = x + (center_w - d.textlength(text, font=f)) / 2
    d.text((x + shadow[0], y + shadow[1]), text, font=f, fill=(0, 0, 0), stroke_width=sw, stroke_fill=(0, 0, 0))
    d.text((x, y), text, font=f, fill=fill, stroke_width=sw, stroke_fill=stroke)
def cover(im, w, h):
    im = im.convert('RGB'); r = max(w / im.width, h / im.height)
    im = im.resize((int(im.width * r) + 1, int(im.height * r) + 1), Image.LANCZOS); x = (im.width - w) // 2; y = (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))
def boost(im, c=1.28, k=1.12): return ImageEnhance.Contrast(ImageEnhance.Color(im).enhance(c)).enhance(k)
def vignette(im, strength=170):
    mask = Image.radial_gradient('L').resize((S, S)).point(lambda v: int(max(0, v - 90) * strength / 165))
    dark = Image.new('RGB', (S, S), (0, 0, 0)); return Image.composite(dark, im, mask)
def bottom_shade(im, h, amax=245):
    ov = Image.new('RGBA', (S, h)); px = ov.load()
    for y in range(h):
        a = int(amax * (y / h) ** 1.3)
        for x in range(S): px[x, y] = (10, 10, 10, a)
    im.paste(ov, (0, S - h), ov)
def starburst(diam, pts, inner, fill, edge):
    L = Image.new('RGBA', (diam, diam), (0, 0, 0, 0)); d = ImageDraw.Draw(L); c = diam / 2; poly = []
    for i in range(pts * 2):
        r = c - 6 if i % 2 == 0 else (c - 6) * inner; a = math.pi * i / pts
        poly.append((c + r * math.cos(a), c + r * math.sin(a)))
    d.polygon(poly, fill=fill, outline=edge, width=8); return L
def paste_rot(base, layer, center, angle):
    r = layer.rotate(angle, expand=True, resample=Image.BICUBIC); base.paste(r, (int(center[0] - r.width / 2), int(center[1] - r.height / 2)), r)
def brand_chip(im, x=36, y=34):
    d = ImageDraw.Draw(im); f1, f2 = F(IMP, 44), F(ARB, 24); w = int(d.textlength('KLEBER', font=f1)) + int(d.textlength('MATERIAIS DE CONSTRUÇÃO', font=f2)) + 70
    d.rounded_rectangle([x + 4, y + 6, x + w + 4, y + 76], 35, fill=(0, 0, 0)); d.rounded_rectangle([x, y, x + w, y + 70], 35, fill=YELLOW, outline=DARK, width=4)
    d.text((x + 26, y + 9), 'KLEBER', font=f1, fill=DARK); d.text((x + 40 + d.textlength('KLEBER', font=f1), y + 26), 'MATERIAIS DE CONSTRUÇÃO', font=f2, fill=DARK)
def cta(im, x, y, w, h, text, size=58):
    d = ImageDraw.Draw(im); d.rounded_rectangle([x + 7, y + 9, x + w + 7, y + h + 9], h // 2, fill=(0, 0, 0))
    d.rounded_rectangle([x, y, x + w, y + h], h // 2, fill=GREEN, outline=WHITE, width=6)
    cx, cy, r = x + h // 2 + 8, y + h // 2, h // 2 - 16; d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=WHITE)
    b = r * 0.58; d.rounded_rectangle([cx - b, cy - b * 0.8, cx + b, cy + b * 0.55], 12, fill=GREEN)
    d.polygon([(cx - b * 0.55, cy + b * 0.5), (cx - b * 0.95, cy + b * 1.05), (cx - b * 0.05, cy + b * 0.5)], fill=GREEN)
    for k in (-1, 0, 1): d.ellipse([cx + k * b * 0.5 - 6, cy - b * 0.15 - 6, cx + k * b * 0.5 + 6, cy - b * 0.15 + 6], fill=WHITE)
    f = fit(text, IMP, w - h - 110, size); tx = x + h + 4; otext(d, (tx, y + (h - f.size) / 2 - 6), text, f, WHITE, DARK, 4, (3, 4))
    ax = x + w - 64
    for o in (0, 26): d.line([(ax + o, y + h // 2 - 20), (ax + o + 20, y + h // 2), (ax + o, y + h // 2 + 20)], fill=WHITE, width=9, joint='curve')

# ---------- Card 1: capa ----------
im = boost(cover(Image.open(os.path.join(D, 'laje_a.png')), S, S)); im = vignette(im, 190); bottom_shade(im, 560)
brand_chip(im); d = ImageDraw.Draw(im)
bl = starburst(340, 16, 0.82, YELLOW, DARK); bd = ImageDraw.Draw(bl)
for i, t in enumerate(['PEÇA O', 'PREÇO', 'DE HOJE']): bd.text((170 - bd.textlength(t, font=F(IMP, 66)) / 2, 62 + i * 76), t, font=F(IMP, 66), fill=DARK)
paste_rot(im, bl, (890, 245), -12)
f1 = fit("SUA CAIXA D'ÁGUA", IMP, 1000, 128); otext(d, (40, 590), "SUA CAIXA D'ÁGUA", f1, WHITE, DARK, 9)
otext(d, (40, 590 + f1.size + 4), '2000 LITROS', fit('2000 LITROS', IMP, 1000, 190), YELLOW, DARK, 10)
cta(im, 40, 925, 700, 108, 'CHAMAR NO WHATSAPP', 56); otext(d, (790, 950), 'ARRASTE', F(IMP, 44), WHITE, DARK, 5, (3, 4)); d.polygon([(985, 952), (1040, 977), (985, 1002)], fill=YELLOW, outline=DARK)
im.save(os.path.join(D, 'v2card1.png'))

# ---------- Card 2: conversa no WhatsApp ----------
bg = cover(Image.open(os.path.join(D, 'laje_b.png')), S, S).filter(ImageFilter.GaussianBlur(9)); bg = boost(bg, 1.15, 1.0)
im = Image.blend(bg, Image.new('RGB', (S, S), (10, 20, 40)), 0.5); d = ImageDraw.Draw(im); brand_chip(im)
otext(d, (0, 130), 'É SÓ CHAMAR', fit('É SÓ CHAMAR', IMP, 1000, 150), WHITE, DARK, 9, center_w=S)
otext(d, (0, 262), 'NO WHATSAPP', fit('NO WHATSAPP', IMP, 1000, 150), YELLOW, DARK, 9, center_w=S)
px, py, pw, ph = 110, 445, 860, 445
d.rounded_rectangle([px + 8, py + 10, px + pw + 8, py + ph + 10], 34, fill=(0, 0, 0)); d.rounded_rectangle([px, py, px + pw, py + ph], 34, fill=(236, 229, 221))
d.rounded_rectangle([px, py, px + pw, py + 92], 34, fill=DGREEN); d.rectangle([px, py + 50, px + pw, py + 92], fill=DGREEN)
d.ellipse([px + 22, py + 14, px + 86, py + 78], fill=ORANGE); d.text((px + 40, py + 20), 'K', font=F(IMP, 44), fill=WHITE)
d.text((px + 104, py + 12), 'Kleber Materiais de Construção', font=F(ARB, 30), fill=WHITE); d.text((px + 104, py + 52), 'online', font=F(ARI, 24), fill=(180, 235, 210))
def bubble(x, y, text, mine):
    f = F(ARI, 37); lines = []; cur = ''
    for w in text.split():
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=f) <= 560: cur = t
        else: lines.append(cur); cur = w
    lines.append(cur); bw = max(d.textlength(l, font=f) for l in lines) + 44; bh = len(lines) * 46 + 30
    x0 = x if not mine else x - bw; d.rounded_rectangle([x0, y, x0 + bw, y + bh], 24, fill=(220, 248, 198) if mine else WHITE)
    for i, l in enumerate(lines): d.text((x0 + 22, y + 14 + i * 46), l, font=f, fill=(20, 20, 20))
    return y + bh + 22
y = bubble(px + 30, py + 120, "Oi! Quanto tá a caixa d'água de 2000 litros?", False)
y = bubble(px + pw - 30, y, 'Oi! Tenho sim. Te passo o preço de hoje agora mesmo!', True)
d.rounded_rectangle([px + 30, y, px + 160, y + 58], 28, fill=WHITE)
for k in range(3): d.ellipse([px + 58 + k * 34, y + 22, px + 74 + k * 34, y + 38], fill=(150, 150, 150))
cta(im, 130, 930, 820, 108, 'CHAMAR AGORA', 60); im.save(os.path.join(D, 'v2card2.png'))

# ---------- Card 3: tudo pra sua obra ----------
im = Image.new('RGB', (S, S), ORANGE); ov = Image.new('RGBA', (S, S), (0, 0, 0, 0)); od = ImageDraw.Draw(ov)
for i in range(-2, 14): od.polygon([(i * 120, 0), (i * 120 + 60, 0), (i * 120 + 60 - 500, S), (i * 120 - 500, S)], fill=(255, 150, 0, 120))
im.paste(ov, (0, 0), ov); d = ImageDraw.Draw(im); brand_chip(im)
otext(d, (0, 130), 'TUDO PRA', fit('TUDO PRA', IMP, 1000, 150), WHITE, DARK, 9, center_w=S)
otext(d, (0, 262), 'SUA OBRA', fit('SUA OBRA', IMP, 1000, 190), YELLOW, DARK, 10, center_w=S)
photos = [('1000377092.jpg', 'app-20260914-220839', 'TIJOLO', -8, 200, 700), ('1000378003.jpg', 'app-20260915-195319', 'AREIA', 3, 540, 730), ('1000378707.jpg', 'app-20260916-161021', 'BRITA', 9, 880, 700)]
for fn, folder, label, ang, cx, cy in photos:
    card = Image.new('RGBA', (320, 380), (0, 0, 0, 0)); cd = ImageDraw.Draw(card)
    sh = Image.new('RGBA', (320, 380), (0, 0, 0, 0)); ImageDraw.Draw(sh).rounded_rectangle([10, 16, 316, 376], 16, fill=(0, 0, 0, 150)); card.alpha_composite(sh.filter(ImageFilter.GaussianBlur(8)))
    cd.rounded_rectangle([0, 0, 306, 362], 16, fill=WHITE); ph = cover(Image.open(K + folder + '/' + fn), 274, 274); card.paste(ph.convert('RGBA'), (16, 16))
    lf = F(IMP, 46); cd.text((16 + (274 - cd.textlength(label, font=lf)) / 2, 298), label, font=lf, fill=DARK); paste_rot(im, card, (cx, cy), ang)
cta(im, 90, 935, 900, 104, 'PEÇA SEU ORÇAMENTO NO WHATSAPP', 52); im.save(os.path.join(D, 'v2card3.png'))

# ---------- Card 4: chamada com raios ----------
im = Image.new('RGB', (S, S), YELLOW); d = ImageDraw.Draw(im); c = (S / 2, 470)
for i in range(0, 32, 2):
    a0, a1 = 2 * math.pi * i / 32, 2 * math.pi * (i + 1) / 32; d.polygon([c, (c[0] + 1600 * math.cos(a0), c[1] + 1600 * math.sin(a0)), (c[0] + 1600 * math.cos(a1), c[1] + 1600 * math.sin(a1))], fill=ORANGE)
brand_chip(im)
otext(d, (0, 150), 'CHAMA', F(IMP, 250), WHITE, DARK, 14, (9, 12), center_w=S); otext(d, (0, 385), 'AGORA!', F(IMP, 250), (215, 30, 0), WHITE, 14, (9, 12), center_w=S)
d.rounded_rectangle([90, 682, 990, 780], 30, fill=WHITE, outline=DARK, width=5); f = fit("Peça o preço de hoje da caixa d'água", ARB, 800, 48)
d.text((90 + (900 - d.textlength("Peça o preço de hoje da caixa d'água", font=f)) / 2, 706), "Peça o preço de hoje da caixa d'água", font=f, fill=DARK)
cta(im, 90, 820, 900, 130, 'CHAMAR NO WHATSAPP', 70)
d.text((S / 2 - d.textlength('Kleber Materiais de Construção · Madureira, RJ', font=F(ARB, 34)) / 2, 990), 'Kleber Materiais de Construção · Madureira, RJ', font=F(ARB, 34), fill=DARK)
im.save(os.path.join(D, 'v2card4.png'))

grid = Image.new('RGB', (1080, 1080), 'white')
for i in range(4): grid.paste(Image.open(os.path.join(D, f'v2card{i+1}.png')).resize((535, 535), Image.LANCZOS), ((i % 2) * 545, (i // 2) * 545))
grid.save(os.path.join(D, 'v2-preview.jpg'), quality=85); print('ok')
