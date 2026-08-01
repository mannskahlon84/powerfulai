import asyncio
import websockets
import json

async def test_model(ver, model_name):
    key = "AIzaSyCap6eHoXZxzDjnt3gCF3wkUSuYVO55wNc"
    uri = f"wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.{ver}.GenerativeService.BidiGenerateContent?key={key}"
    try:
        async with websockets.connect(uri) as ws:
            await ws.send(json.dumps({"setup": {"model": model_name, "generationConfig": {"responseModalities": ["AUDIO"]}}}))
            res = await ws.recv()
            print(f"[{ver}] Model {model_name}: SUCCESS -> {res[:100]}")
            return True
    except Exception as e:
        print(f"[{ver}] Model {model_name}: FAILED -> {e}")
        return False

async def main():
    for ver in ["v1alpha", "v1beta"]:
        for m in [
            "models/gemini-2.0-flash-exp",
            "models/gemini-2.0-flash-realtime-exp",
            "models/gemini-live-2.5-flash-native-audio"
        ]:
            if await test_model(ver, m):
                break

asyncio.run(main())
