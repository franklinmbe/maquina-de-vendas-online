import requests, json, base64, os, time

settings_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "settings.local.json")
with open(settings_path, "r", encoding="utf-8") as f:
    settings = json.load(f)
GEMINI_API_KEY = settings["env"]["GEMINI_API_KEY"]

MODEL = "gemini-3.1-flash-image"
URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={GEMINI_API_KEY}"

STYLE = (
    "Vertical mobile Reels/Story format, 1080x1920 (9:16). Flat 2D illustrated style, friendly "
    "and approachable, bright colorful palette (orange, green, teal, blue), simple modern vector "
    "illustration with a light/white background and large soft organic color blob shapes. Bold "
    "rounded sans-serif white title text sitting on a colored rounded banner/pill shape. Clean "
    "flat design, no photorealism, no dark corporate look, energetic, warm and friendly, "
    "consistent character design (young adult, friendly expression) across the whole set. "
    "IMPORTANT: pure illustration only, no fake phone/app screenshot UI chrome, no progress bars, no close buttons."
)

banners = [
    ("01-capa", f"{STYLE} Cover slide. Title text 'PROPOSTA DE PARCERIA' with 'Marketing Digital' below in smaller text on a teal pill shape. Illustration: a friendly person in business casual clothes giving a thumbs up next to a laptop showing a colorful marketing dashboard."),
    ("02-o-que-e", f"{STYLE} Title text 'MÁQUINA DE VENDAS ONLINE' with 'O que é?' below. Illustration: a friendly character standing next to a big flat-illustration gear/engine machine with icons of leads, charts and coins flowing out of it, like a sales engine."),
    ("03-trafego-organico", f"{STYLE} Title text 'TRÁFEGO ORGÂNICO'. Illustration: friendly person holding a smartphone, surrounded by floating icons of a magnifying glass, growth chart, heart/like, and lightbulb with 'SEO' text, big smile."),
    ("04-trafego-pago", f"{STYLE} Title text 'TRÁFEGO PAGO'. Illustration: friendly person pointing at a floating megaphone with a target/bullseye and upward arrow icons around it, representing paid ads reaching an audience."),
    ("05-midias-sociais", f"{STYLE} Title text 'MÍDIAS SOCIAIS'. Illustration: friendly person holding a smartphone with speech bubbles, heart, thumbs-up and share icons floating around them, big warm smile, social engagement theme."),
    ("06-loja-virtual", f"{STYLE} Title text 'LOJA VIRTUAL'. Illustration: friendly person happily pushing a shopping cart full of boxes, with a laptop showing an online store icon nearby."),
    ("07-dropshipping", f"{STYLE} Title text 'DROPSHIPPING'. Illustration: friendly person standing next to stacked delivery boxes and a small delivery truck, with a world map/globe icon in the background suggesting shipping without stock."),
    ("08-produto-digital", f"{STYLE} Title text 'PRODUTO DIGITAL'. Illustration: friendly person sitting with a laptop showing a play button (course) and an ebook icon and a download arrow floating around them."),
    ("09-marca-forte", f"{STYLE} Title text 'MARCA FORTE'. Illustration: friendly person painting/holding a paintbrush next to a big flat-illustration logo mark shape and color swatches, representing branding."),
    ("10-fechamento", f"{STYLE} Title text 'VAMOS CRESCER JUNTOS' with 'Fale com a gente' below. Illustration: two friendly people shaking hands warmly, smiling, small confetti/stars around them, optimistic partnership feeling."),
]

out_dir = os.path.dirname(__file__)

for name, prompt in banners:
    print(f"Gerando {name}...")
    body = {"contents": [{"parts": [{"text": prompt}]}]}
    r = requests.post(URL, headers={"Content-Type": "application/json"}, data=json.dumps(body), timeout=120)
    if r.status_code != 200:
        print(f"  ERRO {r.status_code}: {r.text[:500]}")
        continue
    data = r.json()
    try:
        parts = data["candidates"][0]["content"]["parts"]
        img_b64 = next(p["inlineData"]["data"] for p in parts if "inlineData" in p)
    except (KeyError, IndexError, StopIteration):
        print(f"  Resposta sem imagem: {json.dumps(data)[:500]}")
        continue
    img_bytes = base64.b64decode(img_b64)
    out_path = os.path.join(out_dir, f"{name}.png")
    with open(out_path, "wb") as f:
        f.write(img_bytes)
    print(f"  Salvo: {out_path} ({len(img_bytes)} bytes)")
    time.sleep(1)

print("Concluido.")
