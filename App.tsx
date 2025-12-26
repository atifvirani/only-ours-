
import React, { useState } from 'react';
import { NoteEditor } from './components/NoteEditor';
import { LiveCanvas } from './components/LiveCanvas';

type ViewMode = 'notes' | 'canvas';

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('notes');

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 selection:bg-indigo-100 selection:text-indigo-900">
      {/* Global Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-indigo-200 shadow-lg">
              <span className="text-white text-xl font-black">S</span>
            </div>
            <div>
              <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 leading-none">
                SyncNote AI
              </h1>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Workspace</p>
            </div>
          </div>
          
          <nav className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200">
            <button
              onClick={() => setViewMode('notes')}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                viewMode === 'notes' 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Notes
            </button>
            <button
              onClick={() => setViewMode('canvas')}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                viewMode === 'canvas' 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Sketchpad
            </button>
          </nav>

          <div className="hidden lg:flex items-center space-x-4">
            <div className="text-sm font-medium text-gray-500 border-l pl-4 border-gray-200">
              v1.1 Collaborative
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 py-8 container mx-auto px-4">
        {viewMode === 'notes' ? (
          <NoteEditor />
        ) : (
          <div className="max-w-7xl mx-auto h-[calc(100vh-12rem)] min-h-[600px]">
            <LiveCanvas />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-gray-100 py-6 bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
            Broadcast Engine: Supabase Realtime • AI: Gemini 2.0
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
