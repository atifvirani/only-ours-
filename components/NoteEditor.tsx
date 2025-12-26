import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { SyncStatus } from '../types';

interface NoteEditorProps {
  isEditable: boolean;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({ isEditable }) => {
  const [content, setContent] = useState<string>('');
  const [status, setStatus] = useState<SyncStatus>('synced');
  const [lastSavedContent, setLastSavedContent] = useState<string>('');
  
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRemoteUpdateRef = useRef<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  useEffect(() => {
    fetchNote();
    const channel = supabase
      .channel('note-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'shared_content', filter: 'id=eq.1' },
        (payload) => {
          const newText = payload.new.text_note;
          const isFocused = document.activeElement === textareaRef.current;
          
          if (newText !== content && !isFocused) {
            isRemoteUpdateRef.current = true;
            setContent(newText);
            setLastSavedContent(newText);
            setStatus('synced');
            setTimeout(() => { isRemoteUpdateRef.current = false; }, 50);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchNote, content]);

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
    if (isRemoteUpdateRef.current || content === lastSavedContent) return;
    setStatus('local-edit');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { saveNote(content); }, 1000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [content, lastSavedContent, saveNote]);

  return (
    <div className="fixed inset-0 flex items-center justify-center p-6 md:p-20 z-0 pointer-events-none pt-[calc(env(safe-area-inset-top)+2rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        readOnly={!isEditable}
        placeholder={isEditable ? "Type something..." : "Partner typing..."}
        className={`w-full h-full bg-transparent text-white text-3xl md:text-5xl font-light leading-snug outline-none border-none resize-none transition-all duration-500 placeholder-white/5 text-center ${
          isEditable ? 'pointer-events-auto cursor-text opacity-100' : 'pointer-events-none opacity-40 select-none'
        }`}
        spellCheck={false}
      />
      
      {/* Subtle Status Info */}
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] left-1/2 -translate-x-1/2 flex items-center space-x-4 opacity-10 pointer-events-none">
        <span className="text-[9px] text-white font-bold uppercase tracking-[0.3em]">
          {status === 'syncing' ? 'Cloud Syncing' : status === 'local-edit' ? 'Unsaved' : 'Synced'}
        </span>
      </div>
    </div>
  );
};