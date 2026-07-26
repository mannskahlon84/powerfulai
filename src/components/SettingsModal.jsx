import React, { useState } from 'react';
import { 
  X, Mic, User, Sparkles, Activity, Sun, Moon, 
  Trash2, Download, MapPin, Sliders, HelpCircle, 
  Share2, Crown, Check
} from 'lucide-react';
import { useSpeech } from '../hooks/useSpeech';

export default function SettingsModal({ isOpen, onClose }) {
  const { voices, speak } = useSpeech();
  const [activeTab, setActiveTab] = useState('voice');
  const [customInstructions, setCustomInstructions] = useState(() => {
    return localStorage.getItem('customInstructions') || '';
  });
  const [persona, setPersona] = useState(() => {
    return localStorage.getItem('aiPersona') || 'default';
  });
  const [isDark, setIsDark] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });
  const [feedbackSent, setFeedbackSent] = useState(false);

  const savedVoice = localStorage.getItem('selectedVoiceURI') || '';

  if (!isOpen) return null;

  const handleVoiceChange = (e) => {
    localStorage.setItem('selectedVoiceURI', e.target.value);
    speak("Hello, I am your new voice agent.");
  };

  const handleSaveInstructions = (e) => {
    setCustomInstructions(e.target.value);
    localStorage.setItem('customInstructions', e.target.value);
  };

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleExportHistory = () => {
    const history = localStorage.getItem('chatHistory') || '[]';
    const blob = new Blob([history], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'powerful-ai-chat-history.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearHistory = () => {
    if (window.confirm("Are you sure you want to clear all chat history?")) {
      localStorage.removeItem('chatHistory');
      window.location.reload();
    }
  };

  const navItems = [
    { id: 'voice', label: 'Voice & Audio', icon: Mic },
    { id: 'intelligence', label: 'Personal Intelligence', icon: Sparkles },
    { id: 'avatar', label: 'Avatar & Persona', icon: User },
    { id: 'activity', label: 'Activity & Memory', icon: Activity },
    { id: 'general', label: 'Theme & Location', icon: Sliders },
    { id: 'usage', label: 'Usage limits', icon: Crown },
    { id: 'help', label: 'Help & Feedback', icon: HelpCircle },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-white dark:bg-panel border border-slate-200 dark:border-border/50 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row min-h-[500px] max-h-[85vh]">
        
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 bg-slate-50 dark:bg-background/60 p-4 border-b md:border-b-0 md:border-r border-slate-200 dark:border-border/50 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 px-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Settings</h2>
              <button 
                onClick={onClose} 
                className="md:hidden text-slate-500 dark:text-textMuted hover:text-slate-900 dark:hover:text-white p-1"
              >
                <X size={20} />
              </button>
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all text-left ${
                      isActive
                        ? 'bg-primary text-white shadow-md shadow-primary/20'
                        : 'text-slate-700 dark:text-textMuted hover:bg-slate-200/60 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="hidden md:block pt-4 border-t border-slate-200 dark:border-border/50">
            <p className="text-[11px] text-slate-500 dark:text-textMuted px-2">
              Powerful AI v2.0 • Qatar Region
            </p>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 overflow-y-auto bg-white dark:bg-panel relative">
          <button 
            onClick={onClose} 
            className="hidden md:block absolute top-5 right-5 text-slate-500 dark:text-textMuted hover:text-slate-900 dark:hover:text-white p-2 rounded-full hover:bg-slate-100 dark:hover:bg-border/50 transition-colors"
          >
            <X size={20} />
          </button>

          {/* TAB 1: VOICE & AUDIO */}
          {activeTab === 'voice' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                  <Mic className="text-primary" size={20} />
                  AI Voice Character
                </h3>
                <p className="text-xs text-slate-600 dark:text-textMuted">
                  Select the voice character used when the AI reads responses aloud.
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-background rounded-2xl p-5 border border-slate-200 dark:border-border/50">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-textMuted mb-3">
                  Voice Selection
                </label>
                <select 
                  defaultValue={savedVoice} 
                  onChange={handleVoiceChange}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-border/80 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                >
                  <option value="" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                    System Default Voice
                  </option>
                  {voices.map(voice => (
                    <option key={voice.voiceURI} value={voice.voiceURI} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 dark:text-textMuted mt-3 leading-relaxed">
                  The dropdown text colors are now automatically styled to match both Light and Dark themes for high readability.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: PERSONAL INTELLIGENCE */}
          {activeTab === 'intelligence' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                  <Sparkles className="text-primary" size={20} />
                  Personal Intelligence & Memory
                </h3>
                <p className="text-xs text-slate-600 dark:text-textMuted">
                  Customize how Powerful AI remembers instructions and responds to your queries.
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-background rounded-2xl p-5 border border-slate-200 dark:border-border/50 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-textMuted mb-2">
                    Custom Instructions (Memory)
                  </label>
                  <textarea
                    rows={4}
                    value={customInstructions}
                    onChange={handleSaveInstructions}
                    placeholder="e.g. I am a software engineer based in Qatar. Always respond concisely and provide clean Markdown code blocks."
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-border/80 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-textMuted/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  <p className="text-xs text-slate-500 dark:text-textMuted mt-2">
                    These instructions are saved in your browser and automatically personalize AI responses.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AVATAR & PERSONA */}
          {activeTab === 'avatar' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                  <User className="text-primary" size={20} />
                  Avatar & Persona
                </h3>
                <p className="text-xs text-slate-600 dark:text-textMuted">
                  Choose the personality and tone for your AI assistant.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { id: 'default', title: 'Default AI', desc: 'Balanced, intelligent, and conversational.' },
                  { id: 'pro', title: 'Professional Analyst', desc: 'Formal, concise, and structured.' },
                  { id: 'coder', title: 'Senior Software Engineer', desc: 'Optimized for clean code & architecture.' },
                  { id: 'creative', title: 'Creative Writer', desc: 'Expressive, engaging, and imaginative.' }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setPersona(item.id);
                      localStorage.setItem('aiPersona', item.id);
                    }}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      persona === item.id
                        ? 'border-primary bg-primary/10 dark:bg-primary/20 ring-1 ring-primary'
                        : 'border-slate-200 dark:border-border/50 bg-slate-50 dark:bg-background hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</span>
                      {persona === item.id && <Check size={16} className="text-primary" />}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-textMuted">{item.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: ACTIVITY & MEMORY */}
          {activeTab === 'activity' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                  <Activity className="text-primary" size={20} />
                  Activity & Shared Links
                </h3>
                <p className="text-xs text-slate-600 dark:text-textMuted">
                  Manage your conversation history, exports, and shared links.
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-background rounded-2xl p-5 border border-slate-200 dark:border-border/50 space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-border/50">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Export Chat History</p>
                    <p className="text-xs text-slate-500 dark:text-textMuted">Download all your chats as a JSON file.</p>
                  </div>
                  <button 
                    onClick={handleExportHistory}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-900 dark:text-white rounded-xl text-xs font-medium transition-all"
                  >
                    <Download size={14} />
                    Export JSON
                  </button>
                </div>

                <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-border/50">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Your public links</p>
                    <p className="text-xs text-slate-500 dark:text-textMuted">0 active shared conversation links.</p>
                  </div>
                  <button className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-border text-slate-700 dark:text-textMuted rounded-xl text-xs font-medium">
                    <Share2 size={14} />
                    Manage Links
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400">Clear Activity History</p>
                    <p className="text-xs text-slate-500 dark:text-textMuted">Permanently delete all recent conversations.</p>
                  </div>
                  <button 
                    onClick={handleClearHistory}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-medium transition-all"
                  >
                    <Trash2 size={14} />
                    Clear All
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: GENERAL (THEME & LOCATION) */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                  <Sliders className="text-primary" size={20} />
                  Theme & Location
                </h3>
                <p className="text-xs text-slate-600 dark:text-textMuted">
                  Customize appearance and regional preferences.
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-background rounded-2xl p-5 border border-slate-200 dark:border-border/50 space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-border/50">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Interface Theme</p>
                    <p className="text-xs text-slate-500 dark:text-textMuted">Switch between light pastel and dark mode.</p>
                  </div>
                  <button
                    onClick={toggleTheme}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-900 dark:text-white rounded-xl text-xs font-medium transition-all"
                  >
                    {isDark ? <Sun size={14} /> : <Moon size={14} />}
                    {isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapPin className="text-primary" size={20} />
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">Qatar</p>
                      <p className="text-xs text-slate-500 dark:text-textMuted">Based on your places (Home) • Update location</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full text-xs font-semibold">
                    Active Region
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: USAGE LIMITS */}
          {activeTab === 'usage' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                  <Crown className="text-primary" size={20} />
                  Usage limits & Plan
                </h3>
                <p className="text-xs text-slate-600 dark:text-textMuted">
                  View your active subscription and usage quotas.
                </p>
              </div>

              <div className="bg-gradient-to-br from-primary/15 to-blue-500/10 rounded-2xl p-6 border border-primary/20 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="px-3 py-1 bg-primary text-white rounded-full text-xs font-semibold">
                      Pro & Open Source Plan
                    </span>
                    <h4 className="text-xl font-bold text-slate-900 dark:text-white mt-3">Unlimited Intelligence</h4>
                  </div>
                  <Crown size={32} className="text-primary" />
                </div>
                <p className="text-xs text-slate-700 dark:text-textMuted leading-relaxed">
                  You are running Powerful AI with unlimited text messages, image generation, and multi-model failover (Groq + Gemini + OpenRouter).
                </p>
              </div>
            </div>
          )}

          {/* TAB 7: HELP & FEEDBACK */}
          {activeTab === 'help' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                  <HelpCircle className="text-primary" size={20} />
                  Help & Send Feedback
                </h3>
                <p className="text-xs text-slate-600 dark:text-textMuted">
                  Got feedback or need help with Powerful AI? Let us know.
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-background rounded-2xl p-5 border border-slate-200 dark:border-border/50 space-y-4">
                {feedbackSent ? (
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-600 dark:text-green-400 text-xs font-medium">
                    Thank you! Your feedback has been recorded.
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-textMuted mb-2">
                      Send us a message
                    </label>
                    <textarea 
                      rows={3}
                      placeholder="What would you like to improve in Powerful AI?"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-border/80 rounded-xl p-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                    <button 
                      onClick={() => setFeedbackSent(true)}
                      className="mt-3 px-4 py-2 bg-primary hover:bg-indigo-600 text-white text-xs font-medium rounded-xl transition-all shadow-md shadow-primary/20"
                    >
                      Submit Feedback
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
