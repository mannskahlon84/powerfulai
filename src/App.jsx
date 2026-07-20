import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatScreen from './components/ChatScreen';
import LoginScreen from './components/LoginScreen';
import SettingsModal from './components/SettingsModal';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

function App() {
  const [user, setUser] = useState(() => {
    const mock = localStorage.getItem('mockUser');
    return mock ? JSON.parse(mock) : null;
  });
  const [authLoading, setAuthLoading] = useState(!localStorage.getItem('mockUser'));
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
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
    <div className="flex h-screen bg-background text-textMain overflow-hidden">
      <Sidebar 
        chatHistory={chatHistory} 
        activeChatId={activeChatId} 
        onSelectChat={setActiveChatId}
        onDeleteChat={handleDeleteChat}
        onNewChat={handleNewChat}
        user={user}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      <div className="flex-1 flex flex-col relative h-full">
        <ChatScreen 
          messages={activeChat.messages} 
          onUpdateMessages={handleUpdateMessages} 
        />
      </div>
      
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </div>
  );
}

export default App;
