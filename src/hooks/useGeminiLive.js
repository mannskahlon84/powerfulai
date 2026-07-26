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
    setStatus('Fetching Key...');
    let apiKey = localStorage.getItem('customGeminiApiKey') || '';
    
    if (!apiKey) {
      try {
        const res = await fetch('/api/get-voice-key', { method: 'POST' });
        if (!res.ok) throw new Error('Failed to get API key');
        const data = await res.json();
        apiKey = data.key;
      } catch (e) {
        console.error(e);
        setStatus('Failed to get API key');
        return;
      }
    }

    if (!apiKey) {
      setStatus('Missing API Key');
      return;
    }

    setStatus('Connecting Mic...');
    try {
      await initAudioPlayback();
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      mediaStreamRef.current = stream;

      setStatus('Connecting WebSocket...');
      // Note: Use 'gemini-live-2.5-flash-native-audio' as per the user's working python script
      const model = 'models/gemini-live-2.5-flash-native-audio';
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
      
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        setIsLive(true);
        setStatus('Live (Speaking & Listening)');
        
        // Send initial setup payload
        wsRef.current.send(JSON.stringify({
          setup: {
            model: model,
            generationConfig: {
              responseModalities: ["AUDIO"]
            }
          }
        }));

        // Start processing microphone input but WAIT to send until setupComplete
        const source = audioContextRef.current.createMediaStreamSource(stream);
        const processor = audioContextRef.current.createScriptProcessor(2048, 1, 1);
        audioProcessorRef.current = processor;
        
        source.connect(processor);
        processor.connect(audioContextRef.current.destination);
        
        processor.onaudioprocess = (e) => {
          if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
          if (!setupCompleteRef.current) return; // Very important: Wait for server
          
          const inputData = e.inputBuffer.getChannelData(0);
          const pcm16 = floatTo16BitPCM(inputData);
          const base64Data = int16ToBase64(pcm16);
          
          wsRef.current.send(JSON.stringify({
            realtimeInput: {
              mediaChunks: [{
                mimeType: "audio/pcm;rate=16000",
                data: base64Data
              }]
            }
          }));
        };
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data);
          
          if (response.setupComplete) {
            console.log("Setup complete received!");
            setupCompleteRef.current = true;
          }
          
          if (response.serverContent && response.serverContent.modelTurn) {
            const parts = response.serverContent.modelTurn.parts;
            for (let part of parts) {
              if (part.inlineData && part.inlineData.data) {
                const float32Audio = base64ToFloat32(part.inlineData.data);
                playAudioChunk(float32Audio);
              }
            }
          }
        } catch (err) {
          console.error("Error parsing WS message:", err);
        }
      };
      
      wsRef.current.onerror = (error) => {
        console.error("WebSocket Error:", error);
        setStatus('Connection Error');
      };
      
      wsRef.current.onclose = (event) => {
        console.log("WebSocket closed", event.code, event.reason);
        if (event.code !== 1000 && event.code !== 1005) {
          // If it was a crash/error, keep the UI up so the user can see the status
          setStatus(`Closed: ${event.code} ${event.reason}`);
          
          // Cleanup tracks but don't force isLive to false so the error stays visible
          if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
          }
          if (audioProcessorRef.current) {
            audioProcessorRef.current.disconnect();
          }
        } else {
          disconnectLive();
        }
      };

    } catch (error) {
      console.error("Failed to start live session:", error);
      setStatus('Microphone/Connection Error');
      disconnectLive();
    }
  }, [disconnectLive, initAudioPlayback, playAudioChunk]);

  return { connectLive, disconnectLive, isLive, status };
}
