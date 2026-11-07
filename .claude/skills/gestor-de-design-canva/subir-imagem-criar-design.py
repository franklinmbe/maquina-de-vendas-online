import json, base64, sys, time, requests
p, img, title = sys.argv[1], sys.argv[2], sys.argv[3]
s = json.load(open(p, encoding="utf-8")); env = s["env"]
auth = base64.b64encode(f"{env['CANVA_CLIENT_ID']}:{env['CANVA_CLIENT_SECRET']}".encode()).decode()
t = requests.post("https://api.canva.com/rest/v1/oauth/token", headers={"Authorization": "Basic " + auth},
    data={"grant_type": "refresh_token", "refresh_token": env["CANVA_REFRESH_TOKEN"]}, timeout=30).json()
if t.get("refresh_token"):
    env["CANVA_REFRESH_TOKEN"] = t["refresh_token"]
    json.dump(s, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
B = "https://api.canva.com/rest/v1"
h = {"Authorization": "Bearer " + t["access_token"]}
meta = {"name_base64": base64.b64encode(title.encode()).decode()}
r = requests.post(B + "/asset-uploads", headers={**h, "Content-Type": "application/octet-stream",
    "Asset-Upload-Metadata": json.dumps(meta)}, data=open(img, "rb").read(), timeout=120)
print("upload:", r.status_code); job = r.json()["job"]
while job["status"] == "in_progress":
    time.sleep(2); job = requests.get(B + "/asset-uploads/" + job["id"], headers=h, timeout=30).json()["job"]
print("job:", job["status"])
aid = job["asset"]["id"]
d = requests.post(B + "/designs", headers={**h, "Content-Type": "application/json"}, json={
    "design_type": {"type": "custom", "width": 1080, "height": 1350}, "asset_id": aid, "title": title}, timeout=60)
print("design:", d.status_code)
dz = d.json()["design"]
print("EDIT:", dz["urls"]["edit_url"])
