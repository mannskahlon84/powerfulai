import urllib.request
import urllib.error
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

urls = [
    "https://mannskahlon84--image-gen-fastapi-app.modal.run/v1/images/generations",
    "https://mannskahlon84--image-gen-fastapi-app.modal.run/images/generations",
    "https://mannskahlon84--image-gen-fastapi-app.modal.run/generate",
    "https://mannskahlon84--image-gen-fastapi-app.modal.run/docs",
    "https://mannskahlon84--image-gen-fastapi-app.modal.run/"
]

for u in urls:
    try:
        req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, context=ctx, timeout=10) as res:
            print(u, "-> STATUS:", res.status)
    except urllib.error.HTTPError as e:
        print(u, "-> HTTP ERROR:", e.code, e.reason)
    except Exception as e:
        print(u, "-> ERROR:", str(e))
