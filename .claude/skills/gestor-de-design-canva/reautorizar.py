import json, base64, sys, os, secrets, hashlib, urllib.parse, requests
from http.server import BaseHTTPRequestHandler, HTTPServer

settings_path, url_out = sys.argv[1], sys.argv[2]
s = json.load(open(settings_path, encoding="utf-8"))
env = s["env"]
cid, sec = env["CANVA_CLIENT_ID"], env["CANVA_CLIENT_SECRET"]
redirect = "http://127.0.0.1:8787/callback"
scopes = "asset:read asset:write brandtemplate:content:read brandtemplate:content:write brandtemplate:meta:read comment:read comment:write design:content:read design:content:write design:meta:read folder:permission:write folder:read folder:write profile:read"
verifier = secrets.token_urlsafe(64)[:96]
challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
state = secrets.token_urlsafe(24)
url = "https://www.canva.com/api/oauth/authorize?" + urllib.parse.urlencode({
    "code_challenge_method": "s256", "response_type": "code", "client_id": cid,
    "redirect_uri": redirect, "scope": scopes, "code_challenge": challenge, "state": state})
open(url_out, "w").write(url)
print("URL pronta", flush=True)

result = {}
class H(BaseHTTPRequestHandler):
    def do_GET(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        if not self.path.startswith("/callback"):
            self.send_response(404); self.end_headers(); return
        result.update({k: v[0] for k, v in q.items()})
        self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8"); self.end_headers()
        self.wfile.write("<h1>Canva conectado! Pode fechar esta aba.</h1>".encode())
    def log_message(self, *a): pass

srv = HTTPServer(("127.0.0.1", 8787), H)
srv.timeout = 600
while "code" not in result and "error" not in result:
    srv.handle_request()
if "error" in result or result.get("state") != state:
    print("ERRO:", result); sys.exit(1)
auth = base64.b64encode(f"{cid}:{sec}".encode()).decode()
r = requests.post("https://api.canva.com/rest/v1/oauth/token",
    headers={"Authorization": "Basic " + auth, "Content-Type": "application/x-www-form-urlencoded"},
    data={"grant_type": "authorization_code", "code_verifier": verifier, "code": result["code"], "redirect_uri": redirect}, timeout=30)
print("token:", r.status_code)
if not r.ok:
    print(r.text[:500]); sys.exit(1)
t = r.json()
env["CANVA_REFRESH_TOKEN"] = t["refresh_token"]
json.dump(s, open(settings_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
me = requests.get("https://api.canva.com/rest/v1/users/me", headers={"Authorization": "Bearer " + t["access_token"]}, timeout=30)
print("users/me:", me.status_code, me.text[:200])
