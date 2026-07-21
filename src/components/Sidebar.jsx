import React, { useState, useEffect } from 'react';
import { Plus, MessageSquare, Settings, LogOut, User, Zap, Trash2, Sun, Moon } from 'lucide-react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

export default function Sidebar({ chatHistory, activeChatId, onSelectChat, onDeleteChat, onNewChat, user, onOpenSettings }) {
  const [isDark, setIsDark] = useState(() => {
    return document.documentElement.classList.contains('dark') || true;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <div className="w-64 bg-panel border-r border-border flex flex-col h-full flex-shrink-0">
      <div className="p-5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center shadow-lg shadow-primary/20">
          <Zap size={18} className="text-white fill-white/20" />
        </div>
        <h1 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">Powerful AI</h1>
      </div>

      <div className="px-4 pb-4">
        <button 
          onClick={onNewChat}
          className="w-full flex items-center gap-2 bg-primary hover:bg-indigo-600 text-white px-4 py-2.5 rounded-xl transition-all duration-200 shadow-lg shadow-primary/20"
        >
          <Plus size={18} />
          <span className="font-medium">New Chat</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        <h3 className="text-xs font-semibold text-textMuted uppercase tracking-wider mb-3 px-2">Recent</h3>
        {chatHistory.map((chat) => (
          <button
            key={chat.id}
            onClick={() => onSelectChat(chat.id)}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs transition-colors text-left group ${
              activeChatId === chat.id 
                ? 'bg-border/60 text-white' 
                : 'text-textMuted hover:bg-border/30 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <MessageSquare size={16} className="flex-shrink-0" />
              <span className="truncate">{chat.title}</span>
            </div>
            <Trash2 
              size={14} 
              className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all flex-shrink-0" 
              onClick={(e) => onDeleteChat(e, chat.id)}
            />
          </button>
        ))}
      </div>

      {user && (
        <div className="px-4 py-3 border-t border-border/50 flex items-center gap-3">
          {user.photoURL ? (
            <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <User size={16} className="text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{user.displayName || 'User'}</p>
            <p className="text-xs text-textMuted truncate">{user.email}</p>
          </div>
        </div>
      )}

      <div className="p-3 border-t border-border/50 flex flex-col gap-1">
        <button 
          onClick={() => setIsDark(!isDark)}
          className="flex items-center gap-3 text-textMuted hover:text-textMain transition-colors w-full px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
          <span className="text-xs font-medium">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
        </button>

        <button 
          onClick={onOpenSettings}
          className="flex items-center gap-3 text-textMuted hover:text-textMain transition-colors w-full px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
        >
          <Settings size={18} />
          <span className="text-xs font-medium">Settings</span>
        </button>
        
        <button 
          onClick={() => {
            localStorage.removeItem('mockUser');
            if (auth) {
              signOut(auth).catch(console.error);
            }
            window.location.reload();
          }}
          className="flex items-center gap-3 text-red-400 hover:text-red-500 transition-colors w-full px-3 py-2 rounded-lg hover:bg-red-500/10"
        >
          <LogOut size={18} />
          <span className="text-xs font-medium">Log out</span>
        </button>
      </div>
    </div>
  );
}
