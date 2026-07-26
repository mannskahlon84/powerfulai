import { useState, useRef, useCallback } from 'react';

// Utility to convert Float32Array from microphone to Int16Array PCM
const floatTo16BitPCM = (input) => {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return output;
};

// Utility to convert Int16Array to Base64
const int16ToBase64 = (int16Array) => {
  const uint8Array = new Uint8Array(int16Array.buffer);
  let binary = '';
  for (let i = 0; i < uint8Array.byteLength; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
};

// Utility to convert Base64 back to Int16 PCM, then to Float32 for playback
const base64ToFloat32 = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7FFF);
  }
  return float32;
};

export function useGeminiLive() {
  const [isLive, setIsLive] = useState(false);
  const [status, setStatus] = useState('Disconnected');
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioProcessorRef = useRef(null);
  const setupCompleteRef = useRef(false);
  
  // Playback queue and state
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const nextPlayTimeRef = useRef(0);

  const initAudioPlayback = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
  }, []);

  const playAudioChunk = useCallback((float32Data) => {
    if (!audioContextRef.current) return;
    
    const audioBuffer = audioContextRef.current.createBuffer(1, float32Data.length, 16000);
    audioBuffer.getChannelData(0).set(float32Data);
    
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    
    const currentTime = audioContextRef.current.currentTime;
    
    // Schedule seamlessly
    if (nextPlayTimeRef.current < currentTime) {
      nextPlayTimeRef.current = currentTime;
    }
    
    source.start(nextPlayTimeRef.current);
    nextPlayTimeRef.current += audioBuffer.duration;
  }, []);

  const disconnectLive = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioProcessorRef.current) {
      audioProcessorRef.current.disconnect();
      audioProcessorRef.current = null;
    }
    setupCompleteRef.current = false;
    setIsLive(false);
    setStatus('Disconnected');
  }, []);

  const connectLive = useCallback(async () => {
    console.log('Starting Live Voice Agent exclusively via Modal Custom AI backend (/api/chat + Web Speech Engine)...');
    setIsLive(true);
    setStatus('Live (Modal Custom AI Voice Agent)');

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatus('Browser Speech Recognition Not Supported in this browser');
      setIsLive(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-US';

    rec.onresult = async (event) => {
      const lastIndex = event.results.length - 1;
      const transcript = event.results[lastIndex][0].transcript.trim();
      if (!transcript) return;

      setStatus('Thinking (Modal Custom AI)...');
      try {
        const chatRes = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: transcript }],
            model: 'default'
          })
        });
        const chatData = await chatRes.json();
        const replyText = chatData.reply || "I am listening to your request.";

        setStatus('Speaking (Modal Custom AI)...');
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(replyText);
          utterance.onend = () => {
            if (wsRef.current) setStatus('Live (Modal Custom AI Voice Agent)');
          };
          window.speechSynthesis.speak(utterance);
        }
      } catch (err) {
        console.error("Modal AI Voice Error:", err);
        setStatus('Live (Modal Custom AI Voice Agent)');
      }
    };

    rec.onerror = (e) => {
      console.warn("Speech recognition error:", e.error);
      if (e.error === 'not-allowed') setStatus('Mic Permission Denied');
    };

    try {
      rec.start();
      // Store recognition object in wsRef so disconnectLive can clean it up
      wsRef.current = {
        close: () => {
          try { rec.stop(); } catch (e) {}
          if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        }
      };
    } catch (e) {
      console.error("Failed to start speech recognition:", e);
      setStatus('Microphone Error');
      setIsLive(false);
    }
  }, [disconnectLive]);

  return { connectLive, disconnectLive, isLive, status };
}
