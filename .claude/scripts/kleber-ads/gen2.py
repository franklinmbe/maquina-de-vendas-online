import os, sys, json, base64, urllib.request
key = os.environ.get('GEMINI_API_KEY')
out = os.path.join(os.environ['TEMP'], 'kleber-carrossel')
common = 'Photorealistic, high quality photograph. A large plain blue polyethylene water tank (caixa d\'água) with a lid, with NO brand, NO logo, NO text and NO markings on it, sitting on the flat concrete roof slab (laje) of a simple brick house in a Brazilian neighborhood, with plain grey PVC pipes. '
prompts = {
 'laje_a': common + 'Low-angle shot from the street looking up at the roof, dramatic golden hour sunset sky with intense orange, pink and purple clouds, warm rim light on the tank, other rooftops in the background, very vibrant saturated colors, cinematic, the tank is big and is clearly the hero of the frame, square composition, the bottom third of the image slightly darker and simple.',
 'laje_b': common + 'Eye-level shot from a neighboring rooftop, bright sunny day with an intense deep blue sky and big white clouds, vivid colors, the tank on the right two thirds of the frame with the neighborhood and hills behind, sharp and crisp, square composition.',
}
for name, prompt in prompts.items():
    body = {'contents': [{'parts': [{'text': prompt}]}], 'generationConfig': {'responseModalities': ['IMAGE']}}
    req = urllib.request.Request('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-image:generateContent?key=' + key,
        data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
    try: data = json.load(urllib.request.urlopen(req, timeout=120))
    except Exception as e: print(name, 'ERRO', str(e)[:300]); continue
    ok = False
    for c in data.get('candidates', []):
        for p in c.get('content', {}).get('parts', []):
            inl = p.get('inlineData') or p.get('inline_data')
            if inl: open(os.path.join(out, name + '.png'), 'wb').write(base64.b64decode(inl['data'])); ok = True
    print(name, 'ok' if ok else 'sem imagem')
