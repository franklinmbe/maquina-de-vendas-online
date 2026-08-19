import requests

BASE = "http://127.0.0.1:9001"
DRAFT_FOLDER = r"C:\Users\rjino\AppData\Local\CapCut\User Data\Projects\com.lveditor.draft"

r = requests.post(f"{BASE}/create_draft", json={"width": 1080, "height": 1920})
print("create_draft:", r.status_code, r.text)
draft_id = r.json()["output"]["draft_id"]

r2 = requests.post(f"{BASE}/add_text", json={
    "draft_id": draft_id,
    "draft_folder": DRAFT_FOLDER,
    "text": "Teste Franklin - Maquina de Vendas Online",
    "start": 0,
    "end": 5,
    "font": "思源中宋",
    "font_color": "#FFFFFF",
    "font_size": 12.0,
    "track_name": "main_text",
    "transform_x": 0,
    "transform_y": 0,
    "width": 1080,
    "height": 1920
})
print("add_text:", r2.status_code, r2.text)

r3 = requests.post(f"{BASE}/save_draft", json={
    "draft_id": draft_id,
    "draft_folder": DRAFT_FOLDER
})
print("save_draft:", r3.status_code, r3.text)
print("DRAFT_ID:", draft_id)
