import requests, json, base64, os, hashlib, secrets, http.server, urllib.parse, threading, sys

settings_path = os.path.join(os.path.dirname(__file__), "..", "..", "settings.local.json")
with open(settings_path, "r", encoding="utf-8") as f:
    settings = json.load(f)
env = settings["env"]
CLIENT_ID = env["CANVA_CLIENT_ID"]
CLIENT_SECRET = env["CANVA_CLIENT_SECRET"]

REDIRECT_URI = "http://127.0.0.1:8787/callback"
SCOPES = "asset:read asset:write brandtemplate:content:read brandtemplate:content:write brandtemplate:meta:read comment:read comment:write design:content:read design:content:write design:meta:read folder:permission:write folder:read folder:write profile:read"

code_verifier = base64.urlsafe_b64encode(secrets.token_bytes(64)).decode().rstrip("=")
code_challenge = base64.urlsafe_b64encode(hashlib.sha256(code_verifier.encode()).digest()).decode().rstrip("=")

auth_url = "https://www.canva.com/api/oauth/authorize?" + urllib.parse.urlencode({
    "code_challenge": code_challenge,
    "code_challenge_method": "s256",
    "scope": SCOPES,
    "response_type": "code",
    "client_id": CLIENT_ID,
    "redirect_uri": REDIRECT_URI,
})

print("AUTH_URL:", auth_url)
sys.stdout.flush()

result = {}

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/callback":
            qs = urllib.parse.parse_qs(parsed.query)
            code = qs.get("code", [None])[0]
            result["code"] = code
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write("<h2>Autorizado! Pode fechar esta aba e voltar pro Claude.</h2>".encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass

server = http.server.HTTPServer(("127.0.0.1", 8787), Handler)
print("Waiting for callback on http://127.0.0.1:8787/callback ...")
sys.stdout.flush()

while "code" not in result:
    server.handle_request()

code = result["code"]
print("Got code, exchanging for tokens...")
sys.stdout.flush()

basic = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()
r = requests.post(
    "https://api.canva.com/rest/v1/oauth/token",
    headers={"Authorization": f"Basic {basic}", "Content-Type": "application/x-www-form-urlencoded"},
    data={
        "grant_type": "authorization_code",
        "code": code,
        "code_verifier": code_verifier,
        "redirect_uri": REDIRECT_URI,
    },
)
print("token exchange status:", r.status_code)
print("token exchange body:", r.text)

tok = r.json()
if "refresh_token" in tok:
    env["CANVA_REFRESH_TOKEN"] = tok["refresh_token"]
    settings["env"] = env
    with open(settings_path, "w", encoding="utf-8") as f:
        json.dump(settings, f, indent=2, ensure_ascii=False)
    print("Saved new refresh token to settings.local.json")
