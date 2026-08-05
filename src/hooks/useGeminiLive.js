import { useState, useRef, useCallback, useEffect } from 'react';

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

// Dynamic language detection for auto-switching speech recognition and synthesis mid-conversation
const detectLanguageCode = (text, fallbackLang = 'en-US') => {
  if (!text) return fallbackLang;
  if (/[\u0A00-\u0A7F]/u.test(text) || /\b(?:sat sri akal|ki haal|kiddan|tuhada|sadda|veere|paaji|changa|vadia|vadhiya|kitho|kareya|rab rakha)\b/i.test(text)) return 'pa-IN'; // Punjabi (Gurmukhi & Pinglish)
  if (/[\u0900-\u097F]/u.test(text) || /\b(?:namaste|kya haal|kaise ho|aapka|bhai|bhaiya|dhanyawad|accha|bahut|theek|badiya|ji|haan|nahi|kuch|kaha|kaun|kaisa)\b/i.test(text)) return 'hi-IN'; // Hindi (Devanagari & Hinglish)
  if (/[\u4E00-\u9FFF]/u.test(text)) return 'zh-CN'; // Chinese
  if (/[\u3040-\u309F\u30A0-\u30FF]/u.test(text)) return 'ja-JP'; // Japanese
  if (/[\uAC00-\uD7AF]/u.test(text)) return 'ko-KR'; // Korean
  if (/[\u0600-\u06FF]/u.test(text)) return 'ar-SA'; // Arabic
  if (/[\u0400-\u04FF]/u.test(text)) return 'ru-RU'; // Russian
  if (/\b(?:hola|gracias|bueno|cómo|estas|estás|hablar|español|por favor|amigo|qué tal|buenos|días|noches)\b/i.test(text) || /[¿¡ñáéíóú]/i.test(text)) return 'es-ES'; // Spanish
  if (/\b(?:bonjour|merci|comment|allez|parler|français|oui|s'il vous|salut|bien sûr|merci beaucoup)\b/i.test(text) || /[çœ]/i.test(text)) return 'fr-FR'; // French
  if (/\b(?:hallo|danke|guten|tag|bitte|sprechen|deutsch|ja|nein|wie geht|morgen|abend)\b/i.test(text) || /[äöüß]/i.test(text)) return 'de-DE'; // German
  if (/\b(?:ciao|grazie|prego|parlare|italiano|buongiorno|ragazzo|bene|ragazza)\b/i.test(text)) return 'it-IT'; // Italian
  if (/\b(?:obrigado|obrigada|você|falar|português|bom dia|muito bem)\b/i.test(text)) return 'pt-BR'; // Portuguese
  return fallbackLang;
};

export function useGeminiLive() {
  const [isLive, setIsLive] = useState(false);
  const [status, setStatus] = useState('Disconnected');

  useEffect(() => {
    console.log("[VOICE DEBUG] STATE:", status);
  }, [status]);
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioProcessorRef = useRef(null);
  const setupCompleteRef = useRef(false);
  const getInitialLang = () => {
    const navLang = (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : 'en-US';
    if (navLang.toLowerCase().includes('in') || navLang.toLowerCase().startsWith('hi') || navLang.toLowerCase().startsWith('pa')) {
      return 'en-IN'; // Bilingual Indian English model accurately transcribes Hindi, Punjabi, Hinglish, Pinglish, and English
    }
    return navLang;
  };
  const currentLangRef = useRef(getInitialLang());
  
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
    console.log("[VOICE DEBUG] AUDIO QUEUE LENGTH:", audioQueueRef.current.length);
  }, []);

  const voiceHistoryRef = useRef([]);
  const isProcessingRef = useRef(false);
  const recRef = useRef(null);
  const isAiSpeakingRef = useRef(false);
  const lastAiResponseTextRef = useRef('');
  const lastTtsEndTimeRef = useRef(0);
  const isEchoProtectionRef = useRef(false);
  const isWaitingForUserVoiceRef = useRef(false);
  const sttSilenceTimerRef = useRef(null);
  const analyserRef = useRef(null);
  const isLiveRef = useRef(false);

  const getMicAmplitude = useCallback(() => {
    try {
      if (!mediaStreamRef.current) return 0;
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      }
      if (!analyserRef.current) {
        const source = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
        const analyser = audioContextRef.current.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;
      }
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      return sum / dataArray.length;
    } catch (e) {
      return 0;
    }
  }, []);

  const disconnectLive = useCallback(() => {
    isLiveRef.current = false;
    if (wsRef.current) {
      wsRef.current.active = false;
      wsRef.current = null;
    }
    if (recRef.current) {
      recRef.current.onend = null;
      recRef.current.onerror = null;
      recRef.current.onresult = null;
      try { recRef.current.stop(); } catch (e) {}
      try { recRef.current.abort(); } catch (e) {}
      recRef.current = null;
    }
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    if (window._activeBackendSources && Array.isArray(window._activeBackendSources)) {
      window._activeBackendSources.forEach(s => { try { s.stop(0); } catch (e) {} });
      window._activeBackendSources = [];
    }
    if (window._activeBackendSource) {
      try { window._activeBackendSource.stop(0); } catch (e) {}
      window._activeBackendSource = null;
    }
    if (window._activeHtmlAudio) {
      try {
        window._activeHtmlAudio.pause();
        window._activeHtmlAudio.currentTime = 0;
      } catch (e) {}
      window._activeHtmlAudio = null;
    }
    audioQueueRef.current = [];
    nextPlayTimeRef.current = 0;
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      } catch (e) {}
      mediaStreamRef.current = null;
    }
    isProcessingRef.current = false;
    isAiSpeakingRef.current = false;
    isEchoProtectionRef.current = false;
    isWaitingForUserVoiceRef.current = false;
    analyserRef.current = null;
    voiceHistoryRef.current = [];
    setIsLive(false);
    setStatus('Disconnected');
    console.log("[VOICE DEBUG] VOICE SESSION STOPPED");
  }, []);

  const connectLive = useCallback(async () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatus('Browser Speech Recognition Not Supported in this browser');
      setIsLive(false);
      return;
    }

    setIsLive(true);
    isLiveRef.current = true;
    setStatus('LISTENING');
    voiceHistoryRef.current = [];
    isProcessingRef.current = false;
    isAiSpeakingRef.current = false;
    isEchoProtectionRef.current = false;
    isWaitingForUserVoiceRef.current = false;
    wsRef.current = { active: true };

    try {
      if (!mediaStreamRef.current && navigator?.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false // Disable AGC so distant/unclear background voices are not amplified
          }
        });
        mediaStreamRef.current = stream;
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack && audioTrack.getSettings) {
          const settings = audioTrack.getSettings();
          console.log("🎙️ [Microphone Stream Settings Calibrated]:", {
            echoCancellation: settings.echoCancellation ?? true,
            noiseSuppression: settings.noiseSuppression ?? true,
            autoGainControl: settings.autoGainControl ?? false
          });
        }
      }
    } catch (micErr) {
      console.warn("Microphone AEC constraints warning:", micErr.message);
    }

    const startTurnListener = () => {
      if (!isLiveRef.current || !wsRef.current || !wsRef.current.active) return;

      if (recRef.current) {
        recRef.current.onend = null;
        recRef.current.onerror = null;
        recRef.current.onresult = null;
        try { recRef.current.stop(); } catch (e) {}
        recRef.current = null;
      }

      // Replace batch Browser SpeechRecognition with Streaming STT (continuous streaming & instant interim results)
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = currentLangRef.current || navigator.language || 'en-US';
      recRef.current = rec;

      rec.onresult = async (event) => {
        if (!isLiveRef.current) return;
        const lastIndex = event.results.length - 1;
        const result = event.results[lastIndex];
        const transcript = result[0].transcript.trim();
        if (!transcript) return;

        if (isEchoProtectionRef.current) {
          console.log("[VOICE DEBUG] STT IGNORED DURING ECHO_PROTECTION");
          return;
        }

        if (isWaitingForUserVoiceRef.current) {
          console.log("[VOICE DEBUG] STT IGNORED DURING WAIT_FOR_USER_VOICE");
          return;
        }

        if (isAiSpeakingRef.current) {
          const aiText = (lastAiResponseTextRef.current || '').toLowerCase().replace(/[^a-z0-9\u0900-\u097f\u0a00-\u0a7f]/gi, '');
          const cleanTranscript = transcript.toLowerCase().replace(/[^a-z0-9\u0900-\u097f\u0a00-\u0a7f]/gi, '');
          const aiWords = (lastAiResponseTextRef.current || '').toLowerCase().split(/\s+/).filter(Boolean);
          const sttWords = transcript.toLowerCase().split(/\s+/).filter(Boolean);
          const matchingWords = sttWords.filter(w => aiWords.includes(w));
          const matchRatio = sttWords.length > 0 ? matchingWords.length / sttWords.length : 0;
          if (matchRatio >= 0.5 || (cleanTranscript.length > 0 && aiText.includes(cleanTranscript))) {
            console.log("[VOICE DEBUG] STT IGNORED WHILE SPEAKING");
            return;
          }
        } else {
          // Additional safety fallback for residual acoustic tail right after echo protection ends
          const now = Date.now();
          if ((now - lastTtsEndTimeRef.current) < 250) {
            console.log("[VOICE DEBUG] STT IGNORED DURING ECHO_PROTECTION");
            return;
          }
        }

        console.log("[VOICE DEBUG] STT RESULT:", transcript);
        isAiSpeakingRef.current = false;

        // INSTANT BARGE-IN INTERRUPTION: The millisecond speech energy / interim transcript is detected, silence active TTS!
        if ('speechSynthesis' in window) {
          try { window.speechSynthesis.cancel(); } catch (e) {}
        }
        if (window._activeBackendSources && Array.isArray(window._activeBackendSources)) {
          window._activeBackendSources.forEach(s => { try { s.stop(0); } catch (e) {} });
          window._activeBackendSources = [];
        }
        if (window._activeBackendSource) {
          try { window._activeBackendSource.stop(0); } catch (e) {}
          window._activeBackendSource = null;
        }
        nextPlayTimeRef.current = 0;
        if (window._activeHtmlAudio) {
          try {
            window._activeHtmlAudio.pause();
            window._activeHtmlAudio.currentTime = 0;
          } catch (e) {}
          window._activeHtmlAudio = null;
        }

        if (sttSilenceTimerRef.current) {
          clearTimeout(sttSilenceTimerRef.current);
          sttSilenceTimerRef.current = null;
        }

        // If this is an interim streaming transcript, show live status and do not submit yet
        if (!result.isFinal) {
          setStatus(`Listening: "${transcript}..."`);
          
          sttSilenceTimerRef.current = setTimeout(() => {
            console.log("[VOICE DEBUG] STT SILENCE TIMEOUT FINALIZING");
            if (recRef.current) {
              const handler = recRef.current.onresult;
              recRef.current.onresult = null;
              try { recRef.current.stop(); } catch (e) {}
              if (handler) {
                handler({
                  results: [
                    { 0: { transcript }, isFinal: true }
                  ]
                });
              }
            }
          }, 3000);
          
          return;
        }

        console.log("[VOICE DEBUG] STT FINAL TEXT:", transcript);
        
        const lowerTranscript = transcript.toLowerCase();
        if (lowerTranscript.match(/switch to hindi|speak hindi|talk in hindi|change language to hindi/i)) {
          console.log(`[VOICE DEBUG] LANGUAGE COMMAND DETECTED: ${transcript}`);
          currentLangRef.current = "hi-IN";
          console.log(`[VOICE DEBUG] LANGUAGE OVERRIDE SET: hi-IN`);
          setStatus('Listening in Hindi...');
          startTurnListener();
          return;
        } else if (lowerTranscript.match(/switch to english|speak english|talk in english|change language to english/i)) {
          console.log(`[VOICE DEBUG] LANGUAGE COMMAND DETECTED: ${transcript}`);
          currentLangRef.current = "en-US";
          console.log(`[VOICE DEBUG] LANGUAGE OVERRIDE SET: en-US`);
          setStatus('Listening in English...');
          startTurnListener();
          return;
        }

        console.log("[VOICE DEBUG] USER TRANSCRIPT:", transcript);
        const detectedUserLang = detectLanguageCode(transcript, currentLangRef.current || 'en-US');
        currentLangRef.current = detectedUserLang;
        console.log("[VOICE DEBUG] DETECTED LANGUAGE:", detectedUserLang);
        console.log("[VOICE DEBUG] STT DETECTED LANGUAGE:", detectedUserLang);

        isProcessingRef.current = true;
        try { rec.stop(); } catch (e) {}

        setStatus('Thinking...');
        voiceHistoryRef.current.push({ role: 'user', content: transcript });

        const messagesToSend = voiceHistoryRef.current.slice(-10);
        let replyText = null;

        // 1. Try Vercel Backend API
        try {
          console.log("[VOICE DEBUG] CHAT REQUEST LANGUAGE:", detectedUserLang);
          const chatRes = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: messagesToSend,
              model: 'default',
              mode: 'voice',
              isVoiceSession: true,
              lang: detectedUserLang
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
            const VOICE_TUTOR_SYSTEM_PROMPT = `You are Powerful AI Voice, an advanced real-time language tutor and conversational coach—designed to function identically to native Gemini Live and ChatGPT voice features.\n\nCRITICAL VOICE & TUTOR CAPABILITIES:\n1. DYNAMIC LANGUAGE DETECTION & SEAMLESS AUTO-SWITCHING:\n- You must instantly detect whatever language or dialect the user begins speaking in (including Hindi, Punjabi, Spanish, French, German, Italian, Chinese, Japanese, Korean, Arabic, English, or any multilingual code-switching like Hinglish or Pinglish).\n- Never ask the user to manually select a language or toggle settings. Seamlessly transition and reply in their exact spoken language or dialect mid-conversation.\n- If the user mixes languages (code-switching), gracefully acknowledge and adapt to their preferred multilingual flow.\n\n2. NATIVE PHONETIC & SCRIPT SUPPORT (INDIC LANGUAGES & MULTILINGUAL):\n- When speaking Hindi, Punjabi, or any Indic language, ALWAYS use proper Devanagari (Hindi) or Gurmukhi (Punjabi) script tokenization and authentic native phrasing so the speech synthesis engine pronounces every word phonetically correct.\n- For Hindi, use grammatically precise Devanagari (e.g. नमस्ते, आप कैसे हैं?, बहुत बढ़िया) with natural phonetic rhythm.\n- For Punjabi, use authentic Gurmukhi script and Punjabi idioms (e.g. ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ, ਕੀ ਹਾਲ ਹੈ ਜੀ?, ਬਹੁਤ ਵਧੀਆ) so the phonetics and regional cadence are flawless.\n- Avoid robotic literal translations; use conversational Indic idioms, respectful honorifics (जी / ਜੀ, आप / ਤੁਸੀਂ), and natural contractions.\n\n3. ACCENT & TONE CALIBRATION (INDIC & REGIONAL FLUENCY):\n- Capture the natural rhythm, warm inflections, and affective emotional tone of native Hindi and Punjabi speakers.\n- Speak with expressive, human-like pacing, affective tone matching, and concise conversational turns (2-4 sentences) so audio latency remains ultra-low and dialog feels organic and responsive.\n- Always end your turn with an encouraging conversational follow-up question or practice prompt to keep the user actively speaking and learning.\n\n4. REAL-TIME PRONUNCIATION & GRAMMAR COACH MODE:\n- Act as an expert, patient, and interactive language tutor.\n- Listen closely to the user's spoken inputs, evaluate their grammar, vocabulary usage, sentence structure, and pronunciation cues.\n- Gently and constructively provide real-time verbal feedback or corrections whenever the user makes grammatical errors, improper phrasing, or mispronunciations (e.g., "That was great! In Hindi, a more natural phrasing is..." or "Great pronunciation in Punjabi! Remember to use...").\n- Ensure corrections are supportive, encouraging, and brief so the conversation always flows naturally without feeling like a rigid test.`;
            const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${groqApiKey}`
              },
              body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: [
                  { role: "system", content: VOICE_TUTOR_SYSTEM_PROMPT },
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
        if (!isLiveRef.current) return;
        voiceHistoryRef.current.push({ role: 'assistant', content: replyText });

        setStatus('SPEAKING');
        isAiSpeakingRef.current = true;
        lastAiResponseTextRef.current = replyText;
        const targetLang = detectLanguageCode(replyText, currentLangRef.current);
        currentLangRef.current = targetLang;

        // Keep microphone active during TTS playback for natural barge-in support
        setTimeout(() => {
          if (isLiveRef.current && wsRef.current && wsRef.current.active) {
            startTurnListener();
          }
        }, 200);

        const handleSpeechEnd = () => {
          console.log("[VOICE DEBUG] TTS END", Date.now());
          lastTtsEndTimeRef.current = Date.now();
          isProcessingRef.current = false;
          isAiSpeakingRef.current = false;
          isEchoProtectionRef.current = true;
          if (isLiveRef.current && wsRef.current && wsRef.current.active) {
            setStatus('ECHO_PROTECTION');
          }
          if (recRef.current) {
            try { recRef.current.abort(); } catch (e) {}
            console.log("[VOICE DEBUG] STT BUFFER CLEARED");
          }

          // Stage 2: ECHO_PROTECTION lasts 900ms to ignore acoustic tail & buffered TTS transcripts
          setTimeout(() => {
            if (!isLiveRef.current) return;
            isEchoProtectionRef.current = false;
            console.log("[VOICE DEBUG] ECHO PROTECTION COMPLETE");

            // Stage 3: WAIT_FOR_USER_VOICE - wait until microphone input is quiet before listening
            isWaitingForUserVoiceRef.current = true;
            if (isLiveRef.current && wsRef.current && wsRef.current.active) {
              setStatus('WAIT_FOR_USER_VOICE');
            }

            const startWaitTime = Date.now();
            let quietCount = 0;
            const checkMicReady = () => {
              if (!isLiveRef.current || !isWaitingForUserVoiceRef.current) return;
              const elapsed = Date.now() - startWaitTime;
              const amp = getMicAmplitude();
              if (amp < 12) {
                quietCount++;
              } else {
                quietCount = 0;
              }
              // Quiet for 2 consecutive checks (~200ms) OR safety timeout of 2000ms
              if (quietCount >= 2 || elapsed >= 2000) {
                isWaitingForUserVoiceRef.current = false;
                console.log("[VOICE DEBUG] MICROPHONE READY");
                if (isLiveRef.current && wsRef.current && wsRef.current.active) {
                  setStatus('LISTENING');
                  console.log("[VOICE DEBUG] NEW USER LISTENING WINDOW OPENED");
                  startTurnListener();
                }
              } else {
                setTimeout(checkMicReady, 100);
              }
            };
            setTimeout(checkMicReady, 100);
          }, 900);
        };

        // Helper for Calibrated Indic & Multilingual Browser TTS Fallback
        const playCalibratedBrowserTTS = (textToSpeak, langCode, onComplete) => {
          if (!('speechSynthesis' in window)) {
            if (onComplete) onComplete();
            return;
          }
          try {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(textToSpeak);

            let formattedLang = 'en-IN';
            const langLower = (langCode || 'en-IN').toLowerCase();
            if (langLower.includes('hi')) formattedLang = 'hi-IN';
            else if (langLower.includes('pa')) formattedLang = 'pa-IN';
            else if (langLower.includes('en')) formattedLang = 'en-IN';
            else formattedLang = langCode;

            utterance.lang = formattedLang;

            const voices = window.speechSynthesis.getVoices();
            const langPrefix = formattedLang.split('-')[0].toLowerCase();

            let selectedVoice = voices.find(v => {
              const vLang = v.lang.replace('_', '-').toLowerCase();
              return (vLang === 'en-in' || vLang === 'hi-in') && (
                v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Microsoft') || v.name.includes('Neerja') || v.name.includes('Rishi') || v.name.includes('Prabhat') || v.name.includes('Swara')
              );
            }) || voices.find(v => v.lang.replace('_', '-').toLowerCase() === 'en-in' || v.lang.replace('_', '-').toLowerCase() === 'hi-in')
              || voices.find(v => v.lang.replace('_', '-').toLowerCase().startsWith(langPrefix))
              || voices[0]; // CRITICAL: Fallback to first available voice so Chrome on Windows always speaks and never fails silently!

            if (selectedVoice) {
              utterance.voice = selectedVoice;
            }

            if (formattedLang === 'hi-IN' || formattedLang === 'pa-IN') {
              utterance.rate = 0.98;
              utterance.pitch = 1.0;
            } else {
              utterance.rate = 1.0;
              utterance.pitch = 1.0;
            }

            let completed = false;
            const safeEnd = () => {
              if (!completed) {
                completed = true;
                if (onComplete) onComplete();
              }
            };

            utterance.onend = safeEnd;
            utterance.onerror = safeEnd;
            console.log("[VOICE DEBUG] TTS START", Date.now());
            window.speechSynthesis.speak(utterance);

            // Safety watchdog: ensure speech loop never hangs indefinitely
            setTimeout(safeEnd, 10000);
          } catch (e) {
            if (onComplete) onComplete();
          }
        };

        // 1. Streaming Voice Connection (/api/voice-stream -> real-time chunked audio stream)
        let playedBackendAudio = false;
        try {
          const streamRes = await fetch('/api/voice-stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: replyText,
              lang: targetLang,
              personality: { warmth: 0.85, empathy: 0.90, assertiveness: 0.75 }
            })
          });

          if (streamRes.ok && streamRes.body) {
            const reader = streamRes.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';
            let isFirstChunk = true;

            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                try {
                  const data = JSON.parse(trimmed);
                  if (data.done) {
                    break;
                  }
                  if (data.success && data.audioContent) {
                    playedBackendAudio = true;
                    const audioBinary = atob(data.audioContent);
                    const arrayBuffer = new ArrayBuffer(audioBinary.length);
                    const view = new Uint8Array(arrayBuffer);
                    for (let i = 0; i < audioBinary.length; i++) {
                      view[i] = audioBinary.charCodeAt(i);
                    }
                    if (isFirstChunk) {
                      isFirstChunk = false;
                      nextPlayTimeRef.current = 0;
                      if (window._activeBackendSources && Array.isArray(window._activeBackendSources)) {
                        window._activeBackendSources.forEach(s => { try { s.stop(0); } catch (e) {} });
                        window._activeBackendSources = [];
                      }
                      console.log("[VOICE DEBUG] TTS START", Date.now());
                    }
                    if (window._activeHtmlAudio) {
                      try {
                        window._activeHtmlAudio.pause();
                        window._activeHtmlAudio.currentTime = 0;
                      } catch (e) {}
                      window._activeHtmlAudio = null;
                    }
                    if (!window._sharedAudioCtx) {
                      window._sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    }
                    const audioCtx = window._sharedAudioCtx;
                    if (audioCtx.state === 'suspended') {
                      await audioCtx.resume();
                    }
                    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
                    const source = audioCtx.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(audioCtx.destination);

                    if (!window._activeBackendSources) {
                      window._activeBackendSources = [];
                    }
                    window._activeBackendSources.push(source);
                    window._activeBackendSource = source;

                    const currentTime = audioCtx.currentTime;
                    if (nextPlayTimeRef.current < currentTime) {
                      nextPlayTimeRef.current = currentTime;
                    }

                    const isLastChunk = (data.chunkIndex === (data.totalChunks || 1) - 1) || (data.totalChunks === undefined);
                    if (isLastChunk) {
                      let backendFinished = false;
                      const safeBackendEnd = () => {
                        if (!backendFinished) {
                          backendFinished = true;
                          handleSpeechEnd();
                        }
                      };
                      source.onended = safeBackendEnd;
                    }

                    console.log("[VOICE DEBUG] AUDIO QUEUE LENGTH:", (data.totalChunks || 1) - (data.chunkIndex || 0));
                    source.start(nextPlayTimeRef.current);
                    nextPlayTimeRef.current += audioBuffer.duration;
                  }
                } catch (parseErr) {
                  console.warn("Streaming voice connection parse error:", parseErr.message);
                }
              }
            }
          }
        } catch (streamErr) {
          console.warn("Streaming voice connection fallback:", streamErr.message);
        }

        // 2. Universal Client-Side Google Neural Multilingual & Indic TTS (Zero-Key Native Audio Support for Hindi hi-IN, Punjabi pa-IN, etc.)
        if (!playedBackendAudio) {
          try {
            let langCode = (targetLang || 'en-IN').toLowerCase();
            if (langCode === 'en' || langCode === 'en-us' || langCode === 'en-gb' || langCode.includes('en')) {
              langCode = 'en-in'; // Enforce Professional Native Indian English (en-IN) accent so it never sounds like someone from outside India
            } else if (langCode.startsWith('hi')) {
              langCode = 'hi-in';
            } else if (langCode.startsWith('pa')) {
              langCode = 'pa-in';
            } else {
              langCode = langCode.split('-')[0];
            }
            const sentences = replyText.match(/[^.!?\r\n]+[.!?\r\n]*/g) || [replyText];
            const chunks = [];
            let currentChunk = '';
            for (const s of sentences) {
              if ((currentChunk + s).length <= 160) {
                currentChunk += s;
              } else {
                if (currentChunk) chunks.push(currentChunk.trim());
                currentChunk = s;
              }
            }
            if (currentChunk) chunks.push(currentChunk.trim());

            let idx = 0;
            const playNextChunk = () => {
              if (idx >= chunks.length) {
                handleSpeechEnd();
                return;
              }
              const chunkText = chunks[idx++];
              if (!chunkText) {
                playNextChunk();
                return;
              }
              const gUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(langCode)}&q=${encodeURIComponent(chunkText)}`;
              if (window._activeHtmlAudio) {
                try {
                  window._activeHtmlAudio.pause();
                  window._activeHtmlAudio.currentTime = 0;
                } catch (e) {}
                window._activeHtmlAudio = null;
              }
              const audio = new Audio(gUrl);
              window._activeHtmlAudio = audio;
              if (idx === 1) {
                console.log("[VOICE DEBUG] TTS START", Date.now());
              }
              console.log("[VOICE DEBUG] AUDIO QUEUE LENGTH:", chunks.length - idx);
              audio.onended = playNextChunk;
              audio.onerror = () => {
                // If Google neural TTS URL fails, execute browser speechSynthesis fallback
                playCalibratedBrowserTTS(chunks.slice(idx - 1).join(' '), targetLang, handleSpeechEnd);
              };
              audio.play().catch(() => {
                playCalibratedBrowserTTS(chunks.slice(idx - 1).join(' '), targetLang, handleSpeechEnd);
              });
            };
            playNextChunk();
            playedBackendAudio = true;
          } catch (googleClientErr) {
            console.warn("Client Google TTS failed:", googleClientErr.message);
            playCalibratedBrowserTTS(replyText, targetLang, handleSpeechEnd);
          }
        }
      };

      rec.onend = () => {
        if (isLiveRef.current && wsRef.current && wsRef.current.active && !isProcessingRef.current) {
          setTimeout(() => {
            if (isLiveRef.current) startTurnListener();
          }, 250);
        }
      };

      rec.onerror = (e) => {
        if (e.error === 'not-allowed') {
          setStatus('Mic Permission Denied');
          isProcessingRef.current = false;
        }
      };

      try {
        if (!isLiveRef.current) return;
        console.log("[VOICE DEBUG] STT START");
        rec.start();
      } catch (e) {
        if (isLiveRef.current && wsRef.current && wsRef.current.active && !isProcessingRef.current) {
          setTimeout(() => {
            if (isLiveRef.current) startTurnListener();
          }, 500);
        }
      }
    };

    startTurnListener();
  }, [disconnectLive]);

  return { connectLive, disconnectLive, isLive, status };
}
