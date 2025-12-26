
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { DrawPoint } from '../types';

const COLORS = ['#4f46e5', '#ef4444', '#10b981', '#f59e0b', '#000000'];
const WIDTHS = [2, 4, 8, 12];

export const LiveCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(WIDTHS[1]);
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const channelRef = useRef<any>(null);

  // Initialize Canvas Size
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        // Save existing content
        const tempImage = ctx?.getImageData(0, 0, canvas.width, canvas.height);
        
        canvas.width = width;
        canvas.height = height;

        // Restore content if it exists
        if (tempImage) ctx?.putImageData(tempImage, 0, 0);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Supabase Realtime Setup
  useEffect(() => {
    const channel = supabase.channel('drawing_room', {
      config: {
        broadcast: { self: false },
      },
    });

    channel
      .on('broadcast', { event: 'draw' }, ({ payload }: { payload: DrawPoint }) => {
        drawOnCanvas(payload.x1, payload.y1, payload.x2, payload.y2, payload.color, payload.width);
      })
      .on('broadcast', { event: 'clear' }, () => {
        clearLocalCanvas();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setIsConnected(true);
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
    ctx.moveTo(x1, y1);
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
    clearLocalCanvas();
    channelRef.current?.send({
      type: 'broadcast',
      event: 'clear',
      payload: {},
    });
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

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const coords = getCoordinates(e);
    if (!coords) return;
    setIsDrawing(true);
    setLastPoint(coords);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !lastPoint) return;
    const coords = getCoordinates(e);
    if (!coords) return;

    drawOnCanvas(lastPoint.x, lastPoint.y, coords.x, coords.y, color, width);

    // Broadcast the drawing action
    channelRef.current?.send({
      type: 'broadcast',
      event: 'draw',
      payload: {
        x1: lastPoint.x,
        y1: lastPoint.y,
        x2: coords.x,
        y2: coords.y,
        color: color,
        width: width,
      },
    });

    setLastPoint(coords);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    setLastPoint(null);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 px-2">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-lg transition-transform hover:scale-110 ${
                  color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="flex items-center space-x-2 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
            {WIDTHS.map((w) => (
              <button
                key={w}
                onClick={() => setWidth(w)}
                className={`flex items-center justify-center rounded-lg transition-colors hover:bg-gray-50 ${
                  width === w ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400'
                }`}
                style={{ width: '32px', height: '32px' }}
              >
                <div 
                  className="rounded-full bg-current" 
                  style={{ width: `${w}px`, height: `${w}px` }} 
                />
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleClear}
            className="px-4 py-2 text-sm font-semibold text-red-600 bg-white border border-red-100 rounded-xl hover:bg-red-50 shadow-sm transition-colors"
          >
            Clear Canvas
          </button>
          <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${
            isConnected ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
            <span>{isConnected ? 'Drawing Room Active' : 'Connecting...'}</span>
          </div>
        </div>
      </div>

      <div 
        ref={containerRef}
        className="flex-1 min-h-[500px] bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden relative cursor-crosshair touch-none"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="absolute inset-0"
        />
        {!isConnected && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center">
            <div className="bg-white px-6 py-3 rounded-2xl shadow-xl border border-gray-100 flex items-center space-x-3">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
              <span className="text-sm font-medium text-gray-600">Joining drawing room...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
