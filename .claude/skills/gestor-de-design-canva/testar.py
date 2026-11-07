import json, base64, sys, requests
p = sys.argv[1]
s = json.load(open(p, encoding="utf-8"))
env = s.get("env", {})
cid, sec, rt = env.get("CANVA_CLIENT_ID"), env.get("CANVA_CLIENT_SECRET"), env.get("CANVA_REFRESH_TOKEN")
print("credenciais presentes:", bool(cid), bool(sec), bool(rt))
auth = base64.b64encode(f"{cid}:{sec}".encode()).decode()
r = requests.post("https://api.canva.com/rest/v1/oauth/token",
    headers={"Authorization": "Basic " + auth, "Content-Type": "application/x-www-form-urlencoded"},
    data={"grant_type": "refresh_token", "refresh_token": rt}, timeout=30)
print("token:", r.status_code)
if r.status_code != 200:
    print(r.text[:500]); sys.exit(1)
t = r.json()
if t.get("refresh_token") and t["refresh_token"] != rt:
    env["CANVA_REFRESH_TOKEN"] = t["refresh_token"]
    json.dump(s, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("refresh_token novo salvo")
h = {"Authorization": "Bearer " + t["access_token"]}
me = requests.get("https://api.canva.com/rest/v1/users/me", headers=h, timeout=30)
print("users/me:", me.status_code, me.text[:300])
prof = requests.get("https://api.canva.com/rest/v1/users/me/profile", headers=h, timeout=30)
print("profile:", prof.status_code, prof.text[:300])
d = requests.get("https://api.canva.com/rest/v1/designs?limit=3", headers=h, timeout=30)
print("designs:", d.status_code)
if d.ok:
    for it in d.json().get("items", [])[:3]:
        print(" -", it.get("title"), it.get("id"))
