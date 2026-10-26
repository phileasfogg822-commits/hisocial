import urllib.request
import json

data = json.dumps({"email": "admin@clinixmax.com", "password": "admin123"}).encode()
req = urllib.request.Request(
    "http://localhost:6001/api/auth/login",
    data=data,
    headers={"Content-Type": "application/json"},
    method="POST"
)
try:
    with urllib.request.urlopen(req, timeout=10) as resp:
        print("Status:", resp.status)
        print("Response:", resp.read().decode()[:500])
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code)
    print("Response:", e.read().decode()[:500])
except Exception as e:
    print("Error:", e)
