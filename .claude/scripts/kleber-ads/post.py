import os, json, time, uuid, urllib.request, urllib.error, datetime
key = os.environ['POSTIZ_API_KEY']
ST = 'C:/Users/rjino/OneDrive/Desktop/Franklin/MAESTROS DA IA/MÁQUINA DE VENDAS ONLINE/.claude/skills/kleber-construcao/_staging/carrossel-caixa-dagua/'
IG, FB, TT = 'cmt1l09d50fi1ow0y80kzbqb9', 'cmt1l1ptt0fimow0yu7rj049x', 'cmt1l3c1h0d8ipg0yj05dosf3'
CAPTION = ("Precisando de caixa d'água? \U0001F4A7 Na Kleber Materiais de Construção, em Madureira, você encontra caixa d'água de 2000 litros, "
           "tijolo, areia, brita e tudo pra sua obra. Chama no WhatsApp e peça o preço de hoje! \U0001F4F2\n\n"
           "#caixadagua #materialdeconstrucao #madureira #obra #reforma")
TT_TITLE = "Caixa d'água 2000 litros em Madureira! Peça o preço de hoje no WhatsApp \U0001F4A7"
def req(method, path, body=None, headers=None):
    h = {'Authorization': key}; h.update(headers or {})
    r = urllib.request.Request('https://api.postiz.com/public/v1' + path, data=body, headers=h, method=method)
    try:
        return json.load(urllib.request.urlopen(r, timeout=300))
    except urllib.error.HTTPError as e:
        return {'HTTP_ERROR': e.code, 'body': e.read().decode('utf-8', 'replace')[:600]}
def upload(fn, ctype):
    b = uuid.uuid4().hex; data = open(ST + fn, 'rb').read()
    body = (f'--{b}\r\nContent-Disposition: form-data; name="file"; filename="{fn}"\r\nContent-Type: {ctype}\r\n\r\n').encode() + data + f'\r\n--{b}--\r\n'.encode()
    r = req('POST', '/upload', body, {'Content-Type': 'multipart/form-data; boundary=' + b})
    print('upload', fn, '->', {k: r.get(k) for k in ('id', 'path', 'HTTP_ERROR', 'body') if k in r}); return r
def media(r): return {'id': r['id'], 'path': r['path']}
now = lambda: datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
def post(items):
    body = json.dumps({'type': 'now', 'shortLink': False, 'date': now(), 'tags': [], 'posts': items}).encode()
    r = req('POST', '/posts', body, {'Content-Type': 'application/json'}); print('POST posts ->', json.dumps(r)[:700]); return r
cards = [media(upload(f'card{i}.png', 'image/png')) for i in (1, 2, 3, 4)]
vid = media(upload('video-caixa-dagua.mp4', 'video/mp4'))
if not all(c.get('id') for c in cards) or not vid.get('id'): raise SystemExit('upload falhou')
print('--- CARROSSEL (Instagram + Facebook)')
post([{'integration': {'id': IG}, 'value': [{'content': CAPTION, 'image': cards}], 'settings': {'__type': 'instagram', 'post_type': 'post'}},
      {'integration': {'id': FB}, 'value': [{'content': CAPTION, 'image': cards}], 'settings': {'__type': 'facebook'}}])
time.sleep(60)
print('--- VIDEO (Instagram + Facebook)')
post([{'integration': {'id': IG}, 'value': [{'content': CAPTION, 'image': [vid]}], 'settings': {'__type': 'instagram', 'post_type': 'post'}},
      {'integration': {'id': FB}, 'value': [{'content': CAPTION, 'image': [vid]}], 'settings': {'__type': 'facebook'}}])
print('--- VIDEO (TikTok)')
post([{'integration': {'id': TT}, 'value': [{'content': TT_TITLE, 'image': [vid]}],
       'settings': {'__type': 'tiktok-business', 'title': TT_TITLE, 'privacy_level': 'PUBLIC_TO_EVERYONE', 'duet': False, 'stitch': False, 'comment': True,
                    'autoAddMusic': 'no', 'brand_content_toggle': False, 'brand_organic_toggle': False, 'content_posting_method': 'DIRECT_POST', 'video_made_with_ai': True}}])
