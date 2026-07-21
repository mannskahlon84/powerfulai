import React, { useState } from 'react';
import { auth, googleProvider, githubProvider, microsoftProvider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';
import { Sparkles } from 'lucide-react';

export default function LoginScreen() {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (provider) => {
    if (!auth) {
      setError('Firebase is not configured. Please add your credentials to the .env file.');
      return;
    }
    
    try {
      setIsLoading(true);
      setError('');
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login error:", err);
      setError(`Login failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSecretLogin = () => {
    const code = window.prompt("Owner Access Code:");
    if (code === "powerful") {
      localStorage.setItem('mockUser', JSON.stringify({
        displayName: 'Owner (Admin)',
        email: 'admin@powerfulai.com',
        photoURL: 'https://www.svgrepo.com/show/521443/crown.svg'
      }));
      window.location.reload();
    } else if (code !== null) {
      setError('Invalid owner access code.');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background text-textMain relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-primary/20 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-purple-500/20 rounded-full blur-[100px]"></div>

      <div className="z-10 bg-panel/80 backdrop-blur-xl border border-border/50 p-10 rounded-3xl shadow-2xl max-w-md w-full mx-4 flex flex-col items-center animate-fade-in">
        <div 
          onClick={handleSecretLogin}
          className="w-16 h-16 bg-primary/20 hover:bg-primary/30 transition-colors rounded-2xl flex items-center justify-center mb-6 shadow-inner cursor-pointer"
          title="Secret Admin Access"
        >
          <Sparkles className="text-primary w-8 h-8" />
        </div>
        
        <h1 className="text-3xl font-bold text-textMain mb-2">Welcome Back</h1>
        <p className="text-textMuted text-center mb-8">Sign in to access your unlimited AI dashboard.</p>

        {error && (
          <div className="w-full bg-red-500/10 border border-red-500/50 text-red-500 dark:text-red-400 text-sm p-3 rounded-lg mb-6 text-center">
            {error}
          </div>
        )}

        <div className="w-full space-y-4">
          <button 
            onClick={() => handleLogin(googleProvider)}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 bg-black/5 hover:bg-black/10 border border-black/10 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 text-textMain py-3 px-4 rounded-xl transition-all duration-200 shadow-sm disabled:opacity-50"
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
            Continue with Google
          </button>
          
          <button 
            onClick={() => handleLogin(githubProvider)}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 bg-black/5 hover:bg-black/10 border border-black/10 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 text-textMain py-3 px-4 rounded-xl transition-all duration-200 shadow-sm disabled:opacity-50"
          >
            <img src="https://www.svgrepo.com/show/512317/github-142.svg" className="w-5 h-5 dark:invert opacity-90" alt="GitHub" />
            Continue with GitHub
          </button>
          
          <button 
            onClick={() => setError('Try with another option, currently server down.')}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 bg-black/5 hover:bg-black/10 border border-black/10 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 text-textMain py-3 px-4 rounded-xl transition-all duration-200 shadow-sm disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 21 21" className="w-5 h-5">
              <path fill="#f25022" d="M1 1h9v9H1z"/>
              <path fill="#00a4ef" d="M1 11h9v9H1z"/>
              <path fill="#7fba00" d="M11 1h9v9h-9z"/>
              <path fill="#ffb900" d="M11 11h9v9h-9z"/>
            </svg>
            Login with Microsoft
          </button>
        </div>
      </div>
    </div>
  );
}
