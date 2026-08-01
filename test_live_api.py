import os
import asyncio
import logging

api_key = None
with open(".env", "r") as f:
    for line in f:
        if line.startswith("GEMINI_API_KEY="):
            api_key = line.strip().split("=", 1)[1].strip('"\'')

os.environ["GEMINI_API_KEY"] = api_key

logging.basicConfig(level=logging.DEBUG)

from google import genai
client = genai.Client()

async def main():
    try:
        from google.genai import types
        config = types.LiveConnectConfig(
            response_modalities=["AUDIO"]
        )
        async with client.aio.live.connect(model="gemini-2.0-flash-exp", config=config) as session:
            print("Connected!")
            await session.send(input={"text": "hello"})
    except Exception as e:
        print("Error:", e)

asyncio.run(main())
