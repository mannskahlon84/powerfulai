import React from 'react';
import { X, Mic } from 'lucide-react';
import { useSpeech } from '../hooks/useSpeech';

export default function SettingsModal({ isOpen, onClose }) {
  const { voices, speak } = useSpeech();
  const savedVoice = localStorage.getItem('selectedVoiceURI') || '';

  if (!isOpen) return null;

  const handleVoiceChange = (e) => {
    localStorage.setItem('selectedVoiceURI', e.target.value);
    speak("Hello, I am your new voice agent.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-panel border border-border/50 rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-5 right-5 text-textMuted hover:text-white p-2 rounded-full hover:bg-border/50 transition-colors">
          <X size={20} />
        </button>
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <Mic className="text-primary" size={24} />
          Voice & Settings
        </h2>
        
        <div className="space-y-6">
          <div className="bg-background rounded-xl p-4 border border-border/50">
            <label className="block text-sm font-medium text-white mb-3">AI Voice Character</label>
            <select 
              defaultValue={savedVoice} 
              onChange={handleVoiceChange}
              className="w-full bg-panel border border-border/80 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none"
            >
              <option value="">System Default Voice</option>
              {voices.map(voice => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
            <p className="text-xs text-textMuted mt-3 leading-relaxed">
              Select the voice character used when the AI reads messages aloud. The list includes all natively supported voices on your device.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
