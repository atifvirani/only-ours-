import React, { useState } from 'react';
import { AppUser } from '../types';

interface LoginProps {
  onLogin: (user: AppUser) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const upperName = name.trim().charAt(0).toUpperCase() + name.trim().slice(1).toLowerCase();
    if (upperName === 'Atif' || upperName === 'Adiba') {
      onLogin(upperName as AppUser);
    } else {
      alert("Private workspace! ❤️");
    }
  };

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-[100] px-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-rose-900/20 via-black to-black opacity-60"></div>
      
      <div className="relative bg-white/5 backdrop-blur-3xl p-10 rounded-[3rem] border border-white/10 shadow-2xl max-w-sm w-full text-center">
        <div className="mb-10">
          <div className="w-20 h-20 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-rose-500/30">
            <span className="text-4xl animate-pulse">❤️</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Ghost Sync</h1>
          <p className="text-white/40 text-xs mt-3 uppercase tracking-widest font-bold">Encrypted Partner Surface</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Identity?"
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder-white/20 outline-none focus:ring-2 focus:ring-rose-500/50 transition-all text-center text-xl font-medium"
          />
          <button
            type="submit"
            className="w-full bg-rose-500 hover:bg-rose-600 text-white font-black py-4 rounded-2xl transition-all active:scale-95 shadow-2xl shadow-rose-500/40 uppercase tracking-widest text-sm"
          >
            Access Surface ❤️
          </button>
        </form>
        
        <p className="text-white/10 text-[8px] mt-10 uppercase tracking-widest">Capacitor v3.0 // Native Ghost Build</p>
      </div>
    </div>
  );
};