
import React, { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { GhostCanvas } from './components/GhostCanvas';
import { AppUser } from './types';

const App: React.FC = () => {
  const [user, setUser] = useState<AppUser>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('ghost_user');
    if (savedUser === 'Atif' || savedUser === 'Adiba') {
      setUser(savedUser as AppUser);
    }
    setLoading(false);
  }, []);

  const handleLogin = (name: AppUser) => {
    setUser(name);
    if (name) localStorage.setItem('ghost_user', name);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('ghost_user');
  };

  if (loading) return null;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-transparent">
      {!user ? (
        <Login onLogin={handleLogin} />
      ) : (
        <>
          <GhostCanvas currentUser={user} />
          
          {/* Logout Button (Hidden/Subtle) */}
          <button 
            onClick={handleLogout}
            className="fixed bottom-4 left-4 text-white/10 hover:text-white/40 text-[8px] uppercase tracking-tighter transition-all"
          >
            Switch User
          </button>
        </>
      )}
    </div>
  );
};

export default App;
