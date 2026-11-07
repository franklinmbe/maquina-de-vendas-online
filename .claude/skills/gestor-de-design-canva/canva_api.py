"""Helper da API do Canva. Uso: python -I canva_api.py <settings.local.json> GET|POST <caminho> [json]
Renova o token sozinho e imprime a resposta JSON."""
import json, base64, sys, requests

def token(settings):
    s = json.load(open(settings, encoding="utf-8")); env = s["env"]
    auth = base64.b64encode(f"{env['CANVA_CLIENT_ID']}:{env['CANVA_CLIENT_SECRET']}".encode()).decode()
    t = requests.post("https://api.canva.com/rest/v1/oauth/token", headers={"Authorization": "Basic " + auth},
        data={"grant_type": "refresh_token", "refresh_token": env["CANVA_REFRESH_TOKEN"]}, timeout=30).json()
    if "access_token" not in t:
        raise SystemExit("token falhou: " + json.dumps(t))
    if t.get("refresh_token"):
        env["CANVA_REFRESH_TOKEN"] = t["refresh_token"]
        json.dump(s, open(settings, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    return t["access_token"]

def call(tok, method, path, body=None):
    r = requests.request(method, "https://api.canva.com/rest/v1" + path,
        headers={"Authorization": "Bearer " + tok, "Content-Type": "application/json"},
        json=body, timeout=60)
    try: return r.status_code, r.json()
    except Exception: return r.status_code, r.text

if __name__ == "__main__":
    tok = token(sys.argv[1])
    body = json.loads(sys.argv[4]) if len(sys.argv) > 4 else None
    st, js = call(tok, sys.argv[2], sys.argv[3], body)
    print(st); print(json.dumps(js, ensure_ascii=False, indent=1)[:20000])
