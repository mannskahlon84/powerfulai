import os
import requests

api_key = None
with open(".env", "r") as f:
    for line in f:
        if line.startswith("GEMINI_API_KEY="):
            api_key = line.strip().split("=", 1)[1].strip('"\'')

print("Fetching models...")
response = requests.get(f"https://generativelanguage.googleapis.com/v1alpha/models?key={api_key}")
data = response.json()
if "models" in data:
    for m in data["models"]:
        methods = m.get("supportedGenerationMethods", [])
        if "bidiGenerateContent" in methods:
            print(f"Supported model: {m['name']}")
else:
    print(data)
