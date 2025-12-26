
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { geminiService } from '../services/geminiService';
import { SharedNote, SyncStatus, AIAction } from '../types';

const AI_ACTIONS: AIAction[] = [
  { id: 'summarize', label: 'Summarize', icon: '📝', prompt: 'Summarize the following text into clear bullet points.' },
  { id: 'fix', label: 'Fix Grammar', icon: '✨', prompt: 'Fix any grammar or spelling mistakes while maintaining the original tone.' },
  { id: 'expand', label: 'Expand', icon: '🚀', prompt: 'Elaborate on these ideas and add professional depth.' },
  { id: 'action', label: 'Action Items', icon: '✅', prompt: 'Extract actionable tasks from this text.' },
];

export const NoteEditor: React.FC = () => {
  const [content, setContent] = useState<string>('');
  const [status, setStatus] = useState<SyncStatus>('synced');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [lastSavedContent, setLastSavedContent] = useState<string>('');
  
  // Refs for debouncing and tracking remote updates
  // Fix: Use ReturnType<typeof setTimeout> instead of NodeJS.Timeout to resolve "Cannot find namespace 'NodeJS'" error in browser environment.
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRemoteUpdateRef = useRef<boolean>(false);

  // Initial Fetch
  const fetchNote = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('shared_content')
        .select('text_note')
        .eq('id', 1)
        .single();

      if (error) throw error;
      if (data) {
        setContent(data.text_note);
        setLastSavedContent(data.text_note);
        setStatus('synced');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setStatus('error');
    }
  }, []);

  // Real-time listener
  useEffect(() => {
    fetchNote();

    const channel = supabase
      .channel('note-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'shared_content',
          filter: 'id=eq.1',
        },
        (payload) => {
          const newText = payload.new.text_note;
          // Only update if the change is different from what we currently have
          // and we are not currently typing (to avoid cursor jumps)
          if (newText !== content) {
            isRemoteUpdateRef.current = true;
            setContent(newText);
            setLastSavedContent(newText);
            setStatus('synced');
            
            // Reset remote update flag after a tick
            setTimeout(() => {
              isRemoteUpdateRef.current = false;
            }, 50);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNote, content]);

  // Debounced Save
  const saveNote = useCallback(async (text: string) => {
    setStatus('syncing');
    try {
      const { error } = await supabase
        .from('shared_content')
        .update({ text_note: text, updated_at: new Date().toISOString() })
        .eq('id', 1);

      if (error) throw error;
      
      setLastSavedContent(text);
      setStatus('synced');
    } catch (err) {
      console.error('Save error:', err);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    // Don't trigger a save if this was a remote update or if content matches last save
    if (isRemoteUpdateRef.current || content === lastSavedContent) return;

    setStatus('local-edit');
    
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    
    saveTimerRef.current = setTimeout(() => {
      saveNote(content);
    }, 1000); // 1 second debounce

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [content, lastSavedContent, saveNote]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  };

  const runAIAction = async (action: AIAction) => {
    if (!content.trim() || isAiLoading) return;
    
    setIsAiLoading(true);
    try {
      const enhanced = await geminiService.enhanceText(content, action.prompt);
      setContent(enhanced);
    } catch (err) {
      alert("AI Service failed to enhance text. Check console.");
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Editor Main Section */}
      <div className="lg:col-span-3 flex flex-col space-y-4">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-bold text-gray-800">Shared Note #1</h2>
            <StatusBadge status={status} />
          </div>
          <div className="text-xs text-gray-500 font-medium">
            {isAiLoading ? 'AI is thinking...' : 'Real-time sync active'}
          </div>
        </div>

        <div className="relative group bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500">
          <textarea
            value={content}
            onChange={handleTextChange}
            placeholder="Start typing your shared note..."
            className="w-full h-[60vh] p-6 text-gray-700 bg-transparent resize-none outline-none text-lg leading-relaxed placeholder-gray-400"
            spellCheck={false}
          />
          
          <div className="absolute bottom-4 right-4 flex items-center space-x-2">
            <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
              {content.length} characters
            </span>
          </div>
        </div>
      </div>

      {/* AI Sidebar */}
      <div className="space-y-6">
        <div className="bg-indigo-50 rounded-2xl p-6 border border-indigo-100">
          <div className="flex items-center space-x-2 mb-4">
            <span className="text-xl">✨</span>
            <h3 className="font-bold text-indigo-900">AI Assistant</h3>
          </div>
          <p className="text-sm text-indigo-700 mb-6">
            Use Gemini to instantly improve or transform your collaborative notes.
          </p>
          
          <div className="grid grid-cols-1 gap-3">
            {AI_ACTIONS.map((action) => (
              <button
                key={action.id}
                onClick={() => runAIAction(action)}
                disabled={isAiLoading || !content.trim()}
                className={`flex items-center justify-between w-full px-4 py-3 rounded-xl text-left text-sm font-semibold transition-all
                  ${isAiLoading 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                    : 'bg-white text-indigo-700 hover:bg-indigo-600 hover:text-white shadow-sm hover:shadow-md border border-indigo-100'
                  }`}
              >
                <span>{action.icon} {action.label}</span>
                <span className="opacity-0 group-hover:opacity-100">→</span>
              </button>
            ))}
          </div>

          {isAiLoading && (
            <div className="mt-6 flex justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h4 className="font-bold text-gray-800 mb-2">Collaboration Tips</h4>
          <ul className="text-xs text-gray-500 space-y-2">
            <li>• Changes sync instantly with your partner.</li>
            <li>• Avoid typing at the same time on the same line.</li>
            <li>• Use the AI Fix button for final polishing.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

const StatusBadge: React.FC<{ status: SyncStatus }> = ({ status }) => {
  const configs = {
    synced: { color: 'bg-green-100 text-green-700 border-green-200', text: 'Saved', dot: 'bg-green-500' },
    syncing: { color: 'bg-blue-100 text-blue-700 border-blue-200', text: 'Syncing...', dot: 'bg-blue-500 animate-pulse' },
    'local-edit': { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', text: 'Unsaved Changes', dot: 'bg-yellow-500' },
    error: { color: 'bg-red-100 text-red-700 border-red-200', text: 'Sync Error', dot: 'bg-red-500' },
  };

  const current = configs[status];

  return (
    <div className={`flex items-center space-x-2 px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${current.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`} />
      <span>{current.text}</span>
    </div>
  );
};
