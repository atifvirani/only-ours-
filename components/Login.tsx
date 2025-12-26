
import React, { useState } from 'react';
import { AppUser } from '../types';

interface LoginProps {
  onLogin: (user: AppUser) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const upperName = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    if (upperName === 'Atif' || upperName === 'Adiba') {
      onLogin(upperName as AppUser);
    } else {
      alert("Only for Atif & Adiba! ❤️");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center z-[100]">
      <div className="bg-white/10 p-8 rounded-3xl border border-white/20 shadow-2xl max-w-sm w-full text-center">
        <div className="mb-6">
          <span className="text-5xl">❤️</span>
          <h1 className="text-2xl font-bold text-white mt-4">Ghost Sync</h1>
          <p className="text-white/60 text-sm mt-1">Private workspace for Atif & Adiba</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What's your name?"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-rose-500/50 transition-all text-center text-lg"
          />
          <button
            type="submit"
            className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 rounded-xl transition-all active:scale-95 shadow-lg shadow-rose-500/20"
          >
            Enter ❤️
          </button>
        </form>
      </div>
    </div>
  );
};
