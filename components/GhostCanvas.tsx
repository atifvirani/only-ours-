import React, { useRef, useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { DrawPoint, AppUser, PresenceState } from '../types';
import { NoteEditor } from './NoteEditor';

const COLORS = ['#f43f5e', '#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#ffffff'];
const WIDTHS = [2, 6, 14, 32];

interface GhostCanvasProps {
  currentUser: AppUser;
}

export const GhostCanvas: React.FC<GhostCanvasProps> = ({ currentUser }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeMode, setActiveMode] = useState<'canvas' | 'text'>('canvas');
  const [isDrawing, setIsDrawing] = useState(false);
  const [penEnabled, setPenEnabled] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(WIDTHS[1]);
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null);
  const [partnerStatus, setPartnerStatus] = useState<{ user: string; isDrawing: boolean; isOnline: boolean } | null>(null);
  const [isPartnerPulse, setIsPartnerPulse] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  
  const channelRef = useRef<any>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savePersistenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persistence: Fetch initial drawing data
  const fetchPersistence = useCallback(async () => {
    const { data, error } = await supabase
      .from('shared_content')
      .select('drawing_data')
      .eq('id', 1)
      .single();
    
    if (!error && data?.drawing_data) {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        }
      };
      img.src = data.drawing_data;
    }
  }, []);

  const savePersistence = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const drawingData = canvas.toDataURL('image/png', 0.5); // Lower quality for faster sync
    
    await supabase
      .from('shared_content')
      .update({ drawing_data: drawingData, updated_at: new Date().toISOString() })
      .eq('id', 1);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const tempImage = ctx?.getImageData(0, 0, canvas.width, canvas.height);
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        if (tempImage) ctx?.putImageData(tempImage, 0, 0);
        else fetchPersistence(); // Initial fetch on resize/load
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [fetchPersistence]);

  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase.channel('ghost_drawing', {
      config: {
        broadcast: { self: false },
        presence: { key: currentUser },
      },
    });

    channel
      .on('broadcast', { event: 'draw' }, ({ payload }: { payload: DrawPoint }) => {
        drawOnCanvas(payload.x1, payload.y1, payload.x2, payload.y2, payload.color, payload.width);
      })
      .on('broadcast', { event: 'clear' }, () => {
        clearLocalCanvas(false); // Don't update DB locally if clear came from broadcast
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const partners = Object.values(state).flat() as unknown as PresenceState[];
        const partner = partners.find(p => p.user !== currentUser);
        
        if (partner) {
          if (!partnerStatus?.isOnline) {
            setIsPartnerPulse(true);
            setTimeout(() => setIsPartnerPulse(false), 5000);
          }
          setPartnerStatus({ user: partner.user, isDrawing: partner.isDrawing, isOnline: true });
        } else {
          setPartnerStatus(null);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setIsSubscribed(true);
          await channel.track({ user: currentUser, isDrawing: false, onlineAt: new Date().toISOString() });
        }
      });

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [currentUser, partnerStatus?.isOnline]);

  useEffect(() => {
    if (channelRef.current && currentUser) {
      channelRef.current.track({ user: currentUser, isDrawing: isDrawing, onlineAt: new Date().toISOString() });
    }
  }, [isDrawing, currentUser]);

  const drawOnCanvas = (x1: number, y1: number, x2: number, y2: number, c: string, w: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rx1 = x1 * canvas.width;
    const ry1 = y1 * canvas.height;
    const rx2 = x2 * canvas.width;
    const ry2 = y2 * canvas.height;

    ctx.beginPath();
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    const midX = (rx1 + rx2) / 2;
    const midY = (ry1 + ry2) / 2;
    
    ctx.moveTo(rx1, ry1);
    ctx.quadraticCurveTo(rx1, ry1, midX, midY);
    ctx.stroke();
  };

  const clearLocalCanvas = async (updateDB: boolean = true) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (updateDB) {
      await supabase
        .from('shared_content')
        .update({ drawing_data: null, updated_at: new Date().toISOString() })
        .eq('id', 1);
    }
  };

  const handleClear = () => {
    if (!clearConfirm) {
      setClearConfirm(true);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      clearTimerRef.current = setTimeout(() => setClearConfirm(false), 3000);
      return;
    }
    clearLocalCanvas();
    channelRef.current?.send({ type: 'broadcast', event: 'clear', payload: {} });
    setClearConfirm(false);
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!penEnabled || activeMode !== 'canvas' || !isSubscribed) return;
    const coords = getCoordinates(e);
    if (!coords) return;
    setIsDrawing(true);
    setLastPoint(coords);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !lastPoint || !penEnabled || activeMode !== 'canvas' || !isSubscribed) return;
    const coords = getCoordinates(e);
    if (!coords || !canvasRef.current) return;

    const normX1 = lastPoint.x / canvasRef.current.width;
    const normY1 = lastPoint.y / canvasRef.current.height;
    const normX2 = coords.x / canvasRef.current.width;
    const normY2 = coords.y / canvasRef.current.height;

    drawOnCanvas(normX1, normY1, normX2, normY2, color, width);

    channelRef.current?.send({
      type: 'broadcast',
      event: 'draw',
      payload: { x1: normX1, y1: normY1, x2: normX2, y2: normY2, color, width },
    });

    setLastPoint(coords);
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      setLastPoint(null);
      // Debounce persistence save
      if (savePersistenceTimerRef.current) clearTimeout(savePersistenceTimerRef.current);
      savePersistenceTimerRef.current = setTimeout(savePersistence, 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-transparent overflow-hidden select-none touch-none">
      
      {/* Ghost Card Mode UI Container */}
      <div className="absolute inset-0 z-0 m-4 rounded-[3rem] border border-white/5 overflow-hidden shadow-inner">
        {activeMode === 'canvas' ? (
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className={`absolute inset-0 block transition-all duration-700 bg-transparent ${
              penEnabled ? 'pointer-events-auto cursor-crosshair opacity-100' : 'pointer-events-none opacity-60'
            }`}
          />
        ) : (
          <NoteEditor isEditable={penEnabled} />
        )}
      </div>

      {/* Partner Status Bubble - Top Safe Area */}
      {partnerStatus && (
        <div className={`fixed top-[calc(env(safe-area-inset-top)+1rem)] left-6 right-20 flex items-center space-x-3 bg-black/40 backdrop-blur-2xl px-5 py-3 rounded-full border border-white/10 shadow-2xl transition-all duration-700 z-50 pointer-events-none ${
          isPartnerPulse ? 'ring-2 ring-rose-500/50 scale-105' : 'scale-100'
        }`}>
          <div className="relative flex-shrink-0">
            <span className="text-xl">❤️</span>
            <span className={`absolute -top-1 -right-1 flex h-2.5 w-2.5 ${isPartnerPulse ? 'scale-150' : ''}`}>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
            </span>
          </div>
          <div className="flex flex-col truncate">
            <span className="text-white text-[11px] font-bold uppercase tracking-widest truncate">{partnerStatus.user} is online</span>
            {partnerStatus.isDrawing && (
              <span className="text-rose-400 text-[9px] font-semibold animate-pulse">Ghosting right now...</span>
            )}
          </div>
        </div>
      )}

      {/* Vertical Toolbar - Mobile Friendly Right-4 */}
      <div className={`fixed right-4 top-[calc(env(safe-area-inset-top)+1rem)] bottom-[calc(env(safe-area-inset-bottom)+1rem)] flex flex-col items-center justify-center space-y-4 z-50 pointer-events-auto transition-opacity duration-500 ${!penEnabled ? 'opacity-50' : 'opacity-100'}`}>
        <div className="flex flex-col items-center space-y-4 bg-white/5 backdrop-blur-3xl p-3 rounded-full border border-white/10 shadow-2xl">
          
          {/* Main Interaction Toggle (Lock/Unlock) */}
          <button
            onClick={() => setPenEnabled(prev => !prev)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 ${
              penEnabled ? 'bg-rose-500 shadow-lg shadow-rose-500/40 text-white' : 'bg-white/10 text-white/40'
            }`}
          >
            {penEnabled ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            )}
          </button>

          {/* Mode Selector */}
          <button
            onClick={() => setActiveMode(activeMode === 'canvas' ? 'text' : 'canvas')}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 ${
              activeMode === 'text' ? 'bg-white text-black' : 'bg-white/10 text-white/50'
            }`}
          >
            <span className="text-2xl font-black">{activeMode === 'canvas' ? 'T' : '✎'}</span>
          </button>

          <div className="w-10 h-[1px] bg-white/10" />

          {activeMode === 'canvas' && (
            <>
              <div className="flex flex-col space-y-3 p-1">
                {COLORS.slice(0, 5).map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-10 h-10 rounded-full transition-all active:scale-125 border border-white/20 ${
                      color === c ? 'ring-2 ring-white ring-offset-4 ring-offset-black/20 scale-125 shadow-lg' : ''
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="w-10 h-[1px] bg-white/10" />
              <div className="flex flex-col space-y-4 py-2">
                {WIDTHS.map((w) => (
                  <button key={w} onClick={() => setWidth(w)} className="group relative flex items-center justify-center w-10 h-10">
                    <div className={`rounded-full transition-all ${width === w ? 'bg-white scale-125' : 'bg-white/20'}`} 
                         style={{ width: `${Math.max(w/3, 5)}px`, height: `${Math.max(w/3, 5)}px` }} />
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Safety Clear Button */}
          <div className="w-10 h-[1px] bg-white/10" />
          <button
            onClick={handleClear}
            className={`w-14 h-14 rounded-full transition-all flex items-center justify-center active:scale-90 overflow-hidden ${
              clearConfirm ? 'bg-rose-600 text-white animate-pulse' : 'bg-white/10 text-white/30 hover:text-rose-400'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {clearConfirm && (
              <span className="absolute inset-0 bg-white/20 scale-x-0 origin-left animate-progress-shrink"></span>
            )}
          </button>
        </div>
      </div>

      {/* Sync Watermark */}
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] right-[calc(env(safe-area-inset-right)+1rem)] text-white/5 text-[8px] font-black uppercase tracking-[0.5em] z-50 pointer-events-none">
        Ghost • {activeMode.toUpperCase()}
      </div>

      <style>{`
        @keyframes progress-shrink {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
        .animate-progress-shrink {
          animation: progress-shrink 3s linear forwards;
        }
      `}</style>
    </div>
  );
};