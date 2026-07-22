import { useState, useEffect } from 'react';

export function useSpeech() {
  const [voices, setVoices] = useState([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    const loadVoices = () => {
      setVoices(window.speechSynthesis.getVoices());
    };
    
    loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const speak = (text, onEndCallback) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Stop anything currently speaking
      const utterance = new SpeechSynthesisUtterance(text);
      
      const savedVoiceURI = localStorage.getItem('selectedVoiceURI');
      if (savedVoiceURI) {
        const selectedVoice = voices.find(v => v.voiceURI === savedVoiceURI);
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
      }
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        if (onEndCallback) onEndCallback();
      };
      utterance.onerror = () => setIsSpeaking(false);
      
      window.speechSynthesis.speak(utterance);
    }
  };

  const listen = (onResult, onCompleteCallback) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    
    let finalTranscript = '';

    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event) => {
      finalTranscript = event.results[0][0].transcript;
      onResult((prev) => prev ? prev + ' ' + finalTranscript : finalTranscript);
    };
    
    recognition.onerror = (event) => {
      console.error(event.error);
      setIsListening(false);
      if (onCompleteCallback) onCompleteCallback(null);
    };
    
    recognition.onend = () => {
      setIsListening(false);
      if (onCompleteCallback) {
        // Wait a small bit for state to settle, then fire complete
        setTimeout(() => onCompleteCallback(finalTranscript), 100);
      }
    };
    
    recognition.start();
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  return { voices, speak, stopSpeaking, isSpeaking, listen, isListening };
}
