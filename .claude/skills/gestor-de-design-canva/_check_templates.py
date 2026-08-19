import requests, json, base64, os

# Load creds from settings.local.json
settings_path = os.path.join(os.path.dirname(__file__), "..", "..", "settings.local.json")
with open(settings_path, "r", encoding="utf-8") as f:
    settings = json.load(f)
env = settings["env"]
CLIENT_ID = env["CANVA_CLIENT_ID"]
CLIENT_SECRET = env["CANVA_CLIENT_SECRET"]
REFRESH_TOKEN = env["CANVA_REFRESH_TOKEN"]

basic = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()
r = requests.post(
    "https://api.canva.com/rest/v1/oauth/token",
    headers={"Authorization": f"Basic {basic}", "Content-Type": "application/x-www-form-urlencoded"},
    data={"grant_type": "refresh_token", "refresh_token": REFRESH_TOKEN},
)
print("token refresh status:", r.status_code)
print("token refresh body:", r.text)
tok = r.json()
if "access_token" not in tok:
    raise SystemExit("no access token, stopping here")
access_token = tok["access_token"]
if "refresh_token" in tok:
    print("NOTE: new refresh_token issued, should update settings.local.json:", tok["refresh_token"][:20], "...")

r2 = requests.get(
    "https://api.canva.com/rest/v1/brand-templates",
    headers={"Authorization": f"Bearer {access_token}"},
)
print("brand-templates:", r2.status_code, r2.text)
