import asyncio
from google import genai
from google.genai import types

client = genai.Client(api_key="undefined")
async def main():
    try:
        config = types.LiveConnectConfig(
            response_modalities=["AUDIO"]
        )
        async with client.aio.live.connect(model="gemini-2.0-flash-exp", config=config) as session:
            print("Connected!")
    except Exception as e:
        print("Error:", e)

asyncio.run(main())
