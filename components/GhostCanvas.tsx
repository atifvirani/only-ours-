
import React, { useRef, useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { DrawPoint, AppUser, PresenceState } from '../types';
import { NoteEditor } from './NoteEditor';

const COLORS = ['#f43f5e', '#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#ffffff'];
const WIDTHS = [2, 6, 12, 24];

interface GhostCanvasProps {
  currentUser: AppUser;
}

export const GhostCanvas: React.FC<GhostCanvasProps> = ({ currentUser }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeMode, setActiveMode] = useState<'canvas' | 'text'>('canvas');
  const [isDrawing, setIsDrawing] = useState(false);
  const [penEnabled, setPenEnabled] = useState(false);
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(WIDTHS[1]);
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null);
  const [partnerStatus, setPartnerStatus] = useState<{ user: string; isDrawing: boolean; isOnline: boolean } | null>(null);
  const [isPartnerPulse, setIsPartnerPulse] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const channelRef = useRef<any>(null);

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const tempImage = ctx?.getImageData(0, 0, canvas.width, canvas.height);
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        if (tempImage) ctx?.putImageData(tempImage, 0, 0);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
        clearLocalCanvas();
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
          await channel.track({ user: currentUser, isDrawing: false, onlineAt: new Date().toISOString() });
        }
      });

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

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

    ctx.beginPath();
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Bezier smoothing: use midpoint logic
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(x1, y1, midX, midY);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  const clearLocalCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
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
    if (!penEnabled || activeMode !== 'canvas') return;
    const coords = getCoordinates(e);
    if (!coords) return;
    setIsDrawing(true);
    setLastPoint(coords);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !lastPoint || !penEnabled || activeMode !== 'canvas') return;
    const coords = getCoordinates(e);
    if (!coords) return;

    drawOnCanvas(lastPoint.x, lastPoint.y, coords.x, coords.y, color, width);

    channelRef.current?.send({
      type: 'broadcast',
      event: 'draw',
      payload: { x1: lastPoint.x, y1: lastPoint.y, x2: coords.x, y2: coords.y, color, width },
    });

    setLastPoint(coords);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    setLastPoint(null);
  };

  return (
    <div className="fixed inset-0 bg-transparent pointer-events-none overflow-hidden select-none">
      
      {/* Ghost Content Layer */}
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
          className={`absolute inset-0 block transition-opacity duration-700 ${
            penEnabled ? 'pointer-events-auto cursor-crosshair opacity-100' : 'pointer-events-none opacity-80'
          }`}
        />
      ) : (
        <NoteEditor isEditable={penEnabled} />
      )}

      {/* Heartbeat Status */}
      {partnerStatus && (
        <div className={`fixed top-8 left-8 flex items-center space-x-3 bg-white/10 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/20 shadow-2xl transition-all duration-1000 ${
          isPartnerPulse ? 'ring-4 ring-rose-500/50 scale-110 shadow-rose-500/30' : ''
        }`}>
          <div className="relative">
            <span className="text-xl">❤️</span>
            <span className={`absolute -top-1 -right-1 flex h-3 w-3 ${isPartnerPulse ? 'scale-150' : ''}`}>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-white text-xs font-bold uppercase tracking-wider">{partnerStatus.user} joined</span>
            {partnerStatus.isDrawing && (
              <span className="text-rose-300 text-[10px] font-medium animate-pulse">Is active now...</span>
            )}
          </div>
        </div>
      )}

      {/* Floating Toolbar */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 flex flex-col items-center space-y-5 bg-white/5 backdrop-blur-3xl p-4 rounded-[2.5rem] border border-white/10 shadow-2xl pointer-events-auto transition-all duration-300 hover:bg-white/10">
        
        {/* Mode Toggle (Pen) */}
        <button
          onClick={() => setPenEnabled(!penEnabled)}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
            penEnabled ? 'bg-rose-500 shadow-lg shadow-rose-500/40 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'
          }`}
          title={penEnabled ? 'Lock Edit' : 'Enable Edit'}
        >
          {penEnabled ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          )}
        </button>

        {/* Text Mode Toggle */}
        <button
          onClick={() => setActiveMode(activeMode === 'canvas' ? 'text' : 'canvas')}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
            activeMode === 'text' ? 'bg-white text-black shadow-lg shadow-white/20' : 'bg-white/5 text-white/50 hover:bg-white/10'
          }`}
          title="Switch between Canvas & Text"
        >
          <span className="text-xl font-black">{activeMode === 'canvas' ? 'T' : '✎'}</span>
        </button>

        <div className="w-8 h-px bg-white/10 my-1" />

        {activeMode === 'canvas' && (
          <>
            <div className="flex flex-col space-y-3">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-all hover:scale-125 border border-white/10 ${
                    color === c ? 'ring-2 ring-white ring-offset-4 ring-offset-black/20 scale-125' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="w-8 h-px bg-white/10 my-1" />
            <div className="flex flex-col space-y-4">
              {WIDTHS.map((w) => (
                <button key={w} onClick={() => setWidth(w)} className="group relative flex items-center justify-center">
                  <div className={`rounded-full transition-all ${width === w ? 'bg-white scale-125' : 'bg-white/20 group-hover:bg-white/40'}`} 
                       style={{ width: `${Math.max(w/2, 4)}px`, height: `${Math.max(w/2, 4)}px` }} />
                </button>
              ))}
            </div>
            <div className="w-8 h-px bg-white/10 my-1" />
          </>
        )}

        {/* Safety Clear Button */}
        <button
          onClick={handleClear}
          className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center relative overflow-hidden ${
            clearConfirm ? 'bg-rose-600 text-white animate-pulse' : 'bg-white/5 text-white/30 hover:bg-rose-500/20 hover:text-rose-400'
          }`}
          title="Clear (Double tap)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          {clearConfirm && (
            <span className="absolute inset-0 bg-white/20 scale-x-0 origin-left animate-progress-shrink"></span>
          )}
        </button>
      </div>

      <div className="fixed bottom-6 right-6 text-white/10 text-[9px] font-black uppercase tracking-[0.4em]">
        {currentUser} • {activeMode.toUpperCase()}
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
