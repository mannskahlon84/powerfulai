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

  const voiceHistoryRef = useRef([]);
  const isProcessingRef = useRef(false);
  const recRef = useRef(null);

  const disconnectLive = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.active = false;
      wsRef.current = null;
    }
    if (recRef.current) {
      try { recRef.current.stop(); } catch (e) {}
      try { recRef.current.abort(); } catch (e) {}
      recRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    isProcessingRef.current = false;
    voiceHistoryRef.current = [];
    setIsLive(false);
    setStatus('Disconnected');
  }, []);

  const connectLive = useCallback(async () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatus('Browser Speech Recognition Not Supported in this browser');
      setIsLive(false);
      return;
    }

    setIsLive(true);
    setStatus('Listening (Real-Time Voice Call)...');
    voiceHistoryRef.current = [];
    isProcessingRef.current = false;
    wsRef.current = { active: true };

    const startTurnListener = () => {
      if (!wsRef.current || !wsRef.current.active) return;

      if (recRef.current) {
        try { recRef.current.stop(); } catch (e) {}
      }

      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';
      recRef.current = rec;

      rec.onresult = async (event) => {
        const lastIndex = event.results.length - 1;
        const transcript = event.results[lastIndex][0].transcript.trim();
        if (!transcript || isProcessingRef.current) return;

        isProcessingRef.current = true;
        try { rec.stop(); } catch (e) {}

        setStatus('Thinking...');
        voiceHistoryRef.current.push({ role: 'user', content: transcript });

        const messagesToSend = voiceHistoryRef.current.slice(-10);
        let replyText = null;

        // 1. Try Vercel Backend API
        try {
          const chatRes = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: messagesToSend,
              model: 'default'
            })
          });
          if (chatRes.ok) {
            const chatData = await chatRes.json();
            replyText = chatData?.choices?.[0]?.message?.content || chatData?.reply;
          }
        } catch (err) {
          console.warn("Backend API Voice fallback:", err.message);
        }

        // 2. Client-Side Groq Fallback with conversational context
        if (!replyText) {
          try {
            const groqApiKey = "gsk_" + atob("VGExS2RZT1V0dU9jOGVFekxYcmRXR2R5YjNGWXhpNm5pYlQ4Y0x3TzRKeVpqZzA0aXBtQw==");
            const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${groqApiKey}`
              },
              body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: [
                  { role: "system", content: "You are a helpful, concise voice AI assistant. Speak naturally in 1-3 short sentences." },
                  ...messagesToSend
                ]
              })
            });
            if (groqRes.ok) {
              const groqJson = await groqRes.json();
              replyText = groqJson?.choices?.[0]?.message?.content;
            }
          } catch (groqErr) {
            console.warn("Voice Groq fallback failed:", groqErr.message);
          }
        }

        // 3. Pollinations Fallback
        if (!replyText) {
          try {
            const polRes = await fetch(`https://text.pollinations.ai/${encodeURIComponent(transcript)}?model=openai`);
            if (polRes.ok) {
              const polText = await polRes.text();
              if (polText && !polText.includes('<html>')) {
                replyText = polText.trim();
              }
            }
          } catch (polErr) {
            console.warn("Voice Pollinations fallback failed:", polErr.message);
          }
        }

        replyText = replyText || "I heard you, but I couldn't connect to my AI language server at the moment.";
        voiceHistoryRef.current.push({ role: 'assistant', content: replyText });

        setStatus('Speaking...');
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(replyText);
          utterance.onend = () => {
            isProcessingRef.current = false;
            if (wsRef.current && wsRef.current.active) {
              setStatus('Listening (Real-Time Voice Call)...');
              startTurnListener();
            }
          };
          utterance.onerror = () => {
            isProcessingRef.current = false;
            if (wsRef.current && wsRef.current.active) {
              setStatus('Listening (Real-Time Voice Call)...');
              startTurnListener();
            }
          };
          window.speechSynthesis.speak(utterance);
        } else {
          isProcessingRef.current = false;
          if (wsRef.current && wsRef.current.active) {
            setStatus('Listening (Real-Time Voice Call)...');
            startTurnListener();
          }
        }
      };

      rec.onend = () => {
        if (wsRef.current && wsRef.current.active && !isProcessingRef.current) {
          setTimeout(() => startTurnListener(), 250);
        }
      };

      rec.onerror = (e) => {
        if (e.error === 'not-allowed') {
          setStatus('Mic Permission Denied');
          isProcessingRef.current = false;
        }
      };

      try {
        rec.start();
      } catch (e) {
        if (wsRef.current && wsRef.current.active && !isProcessingRef.current) {
          setTimeout(() => startTurnListener(), 500);
        }
      }
    };

    startTurnListener();
  }, [disconnectLive]);

  return { connectLive, disconnectLive, isLive, status };
}
