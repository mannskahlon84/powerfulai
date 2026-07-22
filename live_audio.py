import asyncio
import os
import sys
import pyaudio
import threading
import tkinter as tk
from google import genai
from google.genai import types

# Audio settings
FORMAT = pyaudio.paInt16
CHANNELS = 1
RATE = 16000  # Gemini Live API expects 16kHz PCM audio
CHUNK = 512

# Initialize PyAudio
audio = pyaudio.PyAudio()

# Global event to signal when to stop
stop_event = threading.Event()

def run_gui():
    """Runs a simple UI with a Stop button."""
    root = tk.Tk()
    root.title("Gemini Voice")
    root.geometry("250x120")
    # Make it stay on top
    root.attributes("-topmost", True)
    
    def on_stop():
        print("\n[Stop button clicked] Ending session...")
        stop_event.set()
        root.destroy()
        
    btn = tk.Button(
        root, 
        text="🛑 Stop Conversation", 
        command=on_stop, 
        bg="#ff4444", 
        fg="white", 
        font=("Arial", 12, "bold")
    )
    btn.pack(expand=True, fill=tk.BOTH, padx=20, pady=25)
    
    # Handle the window X button as well
    root.protocol("WM_DELETE_WINDOW", on_stop)
    root.mainloop()

async def receive_audio_task(session):
    """Task to receive audio responses from Gemini and play them back."""
    stream = audio.open(
        format=FORMAT,
        channels=CHANNELS,
        rate=RATE,
        output=True,
    )
    
    try:
        async for response in session.receive():
            if stop_event.is_set():
                break
            if response.server_content and response.server_content.model_turn:
                for part in response.server_content.model_turn.parts:
                    if part.inline_data and part.inline_data.data:
                        stream.write(part.inline_data.data)
                    elif part.text:
                        print(part.text, end="", flush=True)
    except asyncio.CancelledError:
        pass
    except Exception as e:
        print(f"\nError receiving from Gemini: {e}")
    finally:
        stream.stop_stream()
        stream.close()


async def main():
    if not os.environ.get("GEMINI_API_KEY"):
        print("Error: GEMINI_API_KEY environment variable is not set.")
        sys.exit(1)

    # Start the GUI in a separate thread
    gui_thread = threading.Thread(target=run_gui, daemon=True)
    gui_thread.start()

    client = genai.Client()
    model = "gemini-live-2.5-flash-native-audio"
    
    config = types.LiveConnectConfig(
        response_modalities=["AUDIO"]
    )

    print("Connecting to Gemini Live API...")
    try:
        async with client.aio.live.connect(model=model, config=config) as session:
            print("Connected! Start speaking... (A stop button window has opened)")
            
            receive_task = asyncio.create_task(receive_audio_task(session))

            mic_stream = audio.open(
                format=FORMAT,
                channels=CHANNELS,
                rate=RATE,
                input=True,
                frames_per_buffer=CHUNK,
            )
            
            try:
                while not stop_event.is_set():
                    data = mic_stream.read(CHUNK, exception_on_overflow=False)
                    await session.send(
                        input={"data": data, "mime_type": "audio/pcm;rate=16000"}
                    )
                    await asyncio.sleep(0.001)
                    
            except asyncio.CancelledError:
                pass
            finally:
                mic_stream.stop_stream()
                mic_stream.close()
                receive_task.cancel()
                
    except Exception as e:
        print(f"Failed to connect or stream: {e}")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
    finally:
        audio.terminate()
        sys.exit(0)
