import os, json, time, urllib.request, urllib.error
key = os.environ['POSTIZ_API_KEY']
ids = {'cmu8i60k803hvmi0ymrktwq5y': 'Carrossel/Instagram', 'cmu8i60uh03hwmi0yhwn5z5ue': 'Carrossel/Facebook',
       'cmu8i7bp303i9mi0y1um4bp6v': 'Video/Instagram', 'cmu8i7bsq03iami0yjeu2m44h': 'Video/Facebook', 'cmu8i7c6c03dzs40y0vkkc6km': 'Video/TikTok'}
def get():
    u = 'https://api.postiz.com/public/v1/posts?startDate=2026-09-19T00:00:00.000Z&endDate=2026-09-21T00:00:00.000Z'
    try: return json.load(urllib.request.urlopen(urllib.request.Request(u, headers={'Authorization': key}), timeout=60))
    except urllib.error.HTTPError as e: return {'HTTP_ERROR': e.code, 'body': e.read().decode()[:300]}
for attempt in range(8):
    r = get(); posts = r.get('posts', r if isinstance(r, list) else [])
    if not isinstance(posts, list): print(json.dumps(r)[:400]); break
    found = {}
    for p in posts:
        if p.get('id') in ids: found[ids[p['id']]] = (p.get('state') or p.get('status'), p.get('releaseURL') or p.get('permalink') or '')
    print(attempt, found)
    if len(found) == 5 and all(v[0] not in ('QUEUE', 'PROCESSING', None) for v in found.values()): break
    time.sleep(20)
