import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatScreen from './components/ChatScreen';
import LoginScreen from './components/LoginScreen';
import SettingsModal from './components/SettingsModal';
import { Menu, Zap } from 'lucide-react';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

function App() {
  const [user, setUser] = useState(() => {
    const mock = localStorage.getItem('mockUser');
    return mock ? JSON.parse(mock) : null;
  });
  const [authLoading, setAuthLoading] = useState(!localStorage.getItem('mockUser'));
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const [chatHistory, setChatHistory] = useState(() => {
    const saved = localStorage.getItem('chatHistory');
    return saved ? JSON.parse(saved) : [{ id: 1, title: 'New Chat', messages: [] }];
  });
  
  const [activeChatId, setActiveChatId] = useState(chatHistory[0]?.id || 1);

  useEffect(() => {
    if (localStorage.getItem('mockUser')) {
      return; // Skip firebase auth listener if logged in as Owner
    }
    if (!auth) {
      setAuthLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
  }, [chatHistory]);

  const activeChat = chatHistory.find(c => c.id === activeChatId) || chatHistory[0];

  const handleNewChat = () => {
    const newChat = { id: Date.now(), title: 'New Chat', messages: [] };
    setChatHistory([newChat, ...chatHistory]);
    setActiveChatId(newChat.id);
  };

  const handleUpdateMessages = (newMessages) => {
    const updatedHistory = chatHistory.map(chat => {
      if (chat.id === activeChatId) {
        // Simple title generator based on first message
        const title = chat.title === 'New Chat' && newMessages.length > 0 
          ? newMessages[0].content.substring(0, 30) + '...' 
          : chat.title;
        return { ...chat, title, messages: newMessages };
      }
      return chat;
    });
    setChatHistory(updatedHistory);
  };

  const handleDeleteChat = (e, idToDelete) => {
    e.stopPropagation();
    const updatedHistory = chatHistory.filter(chat => chat.id !== idToDelete);
    if (updatedHistory.length === 0) {
      const newChat = { id: Date.now(), title: 'New Chat', messages: [] };
      setChatHistory([newChat]);
      setActiveChatId(newChat.id);
    } else {
      setChatHistory(updatedHistory);
      if (activeChatId === idToDelete) {
        setActiveChatId(updatedHistory[0].id);
      }
    }
  };

  if (authLoading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className="relative flex h-screen bg-white dark:bg-[#0a0a0f] text-textMain overflow-hidden font-sans">
      {/* Floating Rainbow / Sky Blue / White Orbs Background */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-sky-300/60 dark:bg-sky-800/40 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] animate-blob"></div>
        <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] bg-pink-300/60 dark:bg-pink-800/40 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-20%] left-[20%] w-[50%] h-[50%] bg-yellow-200/60 dark:bg-yellow-800/40 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] animate-blob animation-delay-4000"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-300/60 dark:bg-purple-800/40 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] animate-blob animation-delay-6000"></div>
        <div className="absolute inset-0 bg-white/30 dark:bg-black/50 backdrop-blur-[10px]"></div>
      </div>
      
      {/* Main Content Layer */}
      <div className="relative z-10 flex h-full w-full">
        <div className={`transition-all duration-300 ease-in-out h-full flex-shrink-0 ${isSidebarOpen ? 'w-64 opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
          <Sidebar 
            chatHistory={chatHistory} 
            activeChatId={activeChatId} 
            onSelectChat={setActiveChatId}
            onDeleteChat={handleDeleteChat}
            onNewChat={handleNewChat}
            user={user}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onCloseSidebar={() => setIsSidebarOpen(false)}
          />
        </div>
        
        <div className="flex-1 flex flex-col relative h-full w-full max-w-full">
          {!isSidebarOpen && (
            <div className="absolute top-4 left-4 z-50 group flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center shadow-lg shadow-primary/20 cursor-pointer hover:opacity-90 transition-opacity"
              >
                <Zap size={20} className="text-white fill-white/20 group-hover:hidden" />
                <Menu size={20} className="text-white hidden group-hover:block" onClick={() => setIsSidebarOpen(true)} />
              </div>
            </div>
          )}
          <ChatScreen 
            messages={activeChat.messages} 
            onUpdateMessages={handleUpdateMessages} 
          />
        </div>
      </div>
      
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </div>
  );
}

export default App;
