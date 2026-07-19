import React, { useRef, useState, useEffect, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2, Check, RotateCcw, Palette, Eraser, Edit3 } from 'lucide-react';

interface WhiteboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
  initialImage?: string | null;
}

const QUICK_COLORS = [
  { value: '#4A4439', label: '색연필색' },
  { value: '#FF6B6B', label: '빨강색' },
  { value: '#FFD93D', label: '노랑색' },
  { value: '#6BCB77', label: '초록색' },
  { value: '#4D96FF', label: '파란색' },
  { value: '#000000', label: '검정색' },
];

const PALETTE_COLORS = [
  // 빨강/분홍 계열
  { value: '#FF3B30', label: '빨강색' },
  { value: '#FF6B6B', label: '밝은 빨강색' },
  { value: '#FF8787', label: '분홍 빨강색' },
  { value: '#F15BB5', label: '분홍색' },
  { value: '#FFC6FF', label: '연분홍색' },
  // 주황/살구 계열
  { value: '#FF9500', label: '주황색' },
  { value: '#FF9F43', label: '밝은 주황색' },
  { value: '#FCE1D4', label: '살구색' },
  // 노랑 계열
  { value: '#FFCC00', label: '노랑색' },
  { value: '#FFD93D', label: '밝은 노랑색' },
  { value: '#FFF3B0', label: '레몬색' },
  // 초록 계열
  { value: '#4CD964', label: '연두색' },
  { value: '#6BCB77', label: '초록색' },
  { value: '#1B5E20', label: '진초록색' },
  { value: '#A8E6CF', label: '민트색' },
  // 파랑 계열
  { value: '#5AC8FA', label: '하늘색' },
  { value: '#4D96FF', label: '파란색' },
  { value: '#0040DD', label: '진파란색' },
  { value: '#A0C4FF', label: '연하늘색' },
  // 보라 계열
  { value: '#9B5DE5', label: '보라색' },
  { value: '#D6A2E8', label: '연보라색' },
  // 갈색 계열
  { value: '#D7CCC8', label: '연갈색' },
  { value: '#8B5A2B', label: '갈색' },
  { value: '#4E3629', label: '고둥색' },
  // 무채색 계열
  { value: '#4A4439', label: '색연필색' },
  { value: '#000000', label: '검정색' },
];

const BRUSH_SIZES = [
  { value: 3, label: '얇게' },
  { value: 6, label: '중간' },
  { value: 12, label: '굵게' },
  { value: 24, label: '매우굵게' },
];

export default function WhiteboardModal({
  isOpen,
  onClose,
  onSave,
  initialImage
}: WhiteboardModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#4A4439');
  const [brushSize, setBrushSize] = useState(6);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [history, setHistory] = useState<string[]>([]);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  // Refs to store current drawing choices to prevent re-binding event listeners on mobile
  const colorRef = useRef(color);
  const brushSizeRef = useRef(brushSize);
  const toolRef = useRef(tool);
  const isDrawingRef = useRef(false);
  const historyRef = useRef<string[]>([]);
  const lastXRef = useRef(0);
  const lastYRef = useRef(0);

  useEffect(() => {
    colorRef.current = color;
  }, [color]);

  useEffect(() => {
    brushSizeRef.current = brushSize;
  }, [brushSize]);

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  // Initialize Canvas
  const initCanvas = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  // Load initial image or fill solid white when modal is opened
  useEffect(() => {
    if (isOpen) {
      // Clear history when modal resets
      historyRef.current = [];
      setHistory([]);
      setTool('pen');

      setTimeout(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
          initCanvas(canvas, ctx);
          if (initialImage) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = initialImage;
            img.onload = () => {
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              // Save initial state to history after image loads
              const initialData = canvas.toDataURL('image/png');
              historyRef.current = [initialData];
              setHistory([...historyRef.current]);
            };
          } else {
            // Save initial white canvas state to history
            const initialData = canvas.toDataURL('image/png');
            historyRef.current = [initialData];
            setHistory([...historyRef.current]);
          }
        }
      }, 80); // slight delay to guarantee canvas element is mounted in DOM
    }
  }, [isOpen, initialImage]);

  // Unified Pointer Events Engine for iPad/Tablet touch pens, Apple Pencils, styluses, and mouse support
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isOpen) return;

    const getPointerCoords = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
      return { x, y };
    };

    const handlePointerDown = (e: PointerEvent) => {
      // Prevent browser default actions (such as elastic page scrolling, context menus, drag-and-drop)
      if (e.cancelable) {
        e.preventDefault();
      }

      // Lock pointer to canvas for seamless off-screen drawing
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (err) {
        // Safe fallback if pointer capture is not supported or fails
      }

      const coords = getPointerCoords(e);
      if (!coords) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = toolRef.current === 'eraser' ? '#FFFFFF' : colorRef.current;

      // Precision: Support stylus pressure-sensitivity!
      // On some devices, e.pressure is active for Apple Pencils or S-Pens.
      // We fall back to 0.5 (medium pressure) if not reporting, to stay smooth, or 1.0 if not a pen.
      const isPen = e.pointerType === 'pen';
      const pressureVal = (e.pressure !== undefined && e.pressure > 0) ? e.pressure : (isPen ? 0.5 : 1.0);
      const widthMultiplier = isPen ? (0.45 + pressureVal * 0.9) : 1.0;
      ctx.lineWidth = brushSizeRef.current * widthMultiplier;

      // Instantly render a single dot on pointer down
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();

      isDrawingRef.current = true;
      setIsDrawing(true);
      lastXRef.current = coords.x;
      lastYRef.current = coords.y;
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDrawingRef.current) return;

      if (e.cancelable) {
        e.preventDefault();
      }

      const coords = getPointerCoords(e);
      if (!coords) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw vector segment
      ctx.beginPath();
      ctx.moveTo(lastXRef.current, lastYRef.current);
      ctx.lineTo(coords.x, coords.y);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = toolRef.current === 'eraser' ? '#FFFFFF' : colorRef.current;

      // Stylus-optimized brush pressure logic for natural colored pencil sketching
      const isPen = e.pointerType === 'pen';
      const pressureVal = (e.pressure !== undefined && e.pressure > 0) ? e.pressure : (isPen ? 0.5 : 1.0);
      const widthMultiplier = isPen ? (0.45 + pressureVal * 0.9) : 1.0;
      ctx.lineWidth = brushSizeRef.current * widthMultiplier;

      ctx.stroke();

      lastXRef.current = coords.x;
      lastYRef.current = coords.y;
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (e.cancelable) {
        e.preventDefault();
      }

      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (err) {}

      if (isDrawingRef.current) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.closePath();
        }
        isDrawingRef.current = false;
        setIsDrawing(false);

        // Save current stroke-finished state to history
        const dataUrl = canvas.toDataURL('image/png');
        historyRef.current.push(dataUrl);
        setHistory([...historyRef.current]);
      }
    };

    // Bind native handlers as active (passive: false) to guarantee browser gesture overrides
    canvas.addEventListener('pointerdown', handlePointerDown, { passive: false });
    canvas.addEventListener('pointermove', handlePointerMove, { passive: false });
    canvas.addEventListener('pointerup', handlePointerUp, { passive: false });
    canvas.addEventListener('pointercancel', handlePointerUp, { passive: false });

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [isOpen]);

  const handleUndo = () => {
    // Need at least 2 states in history to undo (initial state + at least one stroke)
    if (historyRef.current.length <= 1) return;

    // Remove the current active state (the last stroke we drew)
    historyRef.current.pop();
    // Retrieve the previous completed state
    const previousState = historyRef.current[historyRef.current.length - 1];
    setHistory([...historyRef.current]);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx && previousState) {
      const img = new Image();
      img.src = previousState;
      img.onload = () => {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
    }
  };

  const handleClearAll = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      initCanvas(canvas, ctx);
      // Reset history to only contain the cleared solid white state
      const clearedData = canvas.toDataURL('image/png');
      historyRef.current = [clearedData];
      setHistory([...historyRef.current]);
    }
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      onSave(dataUrl);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-start sm:items-center justify-center p-2 sm:p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-stone-900/45 backdrop-blur-xs"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.95, y: 15, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 15, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-2xl bg-[#FAF6EE] rounded-[36px] border-4 border-[#E6D5B8] shadow-2xl p-4 sm:p-6 z-10 my-auto"
          >
            {/* Cute striped header border */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#6BCB77] via-[#FFD93D] to-[#FF8B3D]" />

            {/* Close Button */}
            <button
              onClick={onClose}
              id="whiteboard-close-btn"
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-stone-200/50 text-[#A19582] hover:text-[#5D5443] transition-colors cursor-pointer"
            >
              <X size={22} />
            </button>

            <div className="flex items-center gap-2 mb-4 mt-1">
              <div className="p-1.5 bg-[#FFF3E0] rounded-xl text-[#FF8B3D]">
                <Palette size={22} />
              </div>
              <h3 className="font-gaegu text-2xl sm:text-3xl font-extrabold text-[#5D5443] tracking-wide">
                기억에 남는 장면 직접 그리기 🎨
              </h3>
            </div>

            {/* Canvas Box (Whiteboard) */}
            <div className="relative w-full aspect-video bg-white rounded-2xl border-3 border-[#E6D5B8] overflow-hidden shadow-inner cursor-crosshair">
              <canvas
                ref={canvasRef}
                width={640}
                height={360}
                className="w-full h-full block bg-white touch-none"
              />
            </div>

            {/* Controls Palette */}
            <div className="mt-4 space-y-3.5">
              {/* Color list & Tool Toggle */}
              <div className="relative flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-[#E6D5B8]">
                {/* Tools (Pen / Eraser) */}
                <div className="flex gap-1 bg-stone-100 p-1 rounded-xl shrink-0">
                  <button
                    type="button"
                    onClick={() => setTool('pen')}
                    className={`px-3 py-1.5 rounded-lg font-gaegu text-base font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                      tool === 'pen'
                        ? 'bg-white text-[#4E9F57] shadow-xs'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    <Edit3 size={15} />
                    <span>색연필</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTool('eraser')}
                    className={`px-3 py-1.5 rounded-lg font-gaegu text-base font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                      tool === 'eraser'
                        ? 'bg-white text-rose-600 shadow-xs'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    <Eraser size={15} />
                    <span>지우개</span>
                  </button>
                </div>

                {/* Colors Picker & Quick List */}
                <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-full">
                  {/* Current color indicator & Trigger button */}
                  <button
                    type="button"
                    onClick={() => setIsPaletteOpen(!isPaletteOpen)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 hover:border-stone-300 rounded-xl transition-all active:scale-95 cursor-pointer shadow-xs shrink-0"
                    title="색상판 열기"
                  >
                    <div 
                      style={{ backgroundColor: tool === 'pen' ? color : '#FFFFFF' }}
                      className="w-5 h-5 rounded-full border border-stone-300 inline-block shrink-0 shadow-xs" 
                    />
                    <span className="font-gaegu text-sm font-bold text-stone-700 whitespace-nowrap">색상판 🎨</span>
                  </button>

                  {/* Divide bar */}
                  <div className="h-5 w-[1px] bg-stone-200 shrink-0" />

                  {/* Quick Colors list */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {QUICK_COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => {
                          setColor(c.value);
                          setTool('pen');
                        }}
                        style={{ backgroundColor: c.value }}
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full transition-transform active:scale-90 cursor-pointer flex items-center justify-center border-2 ${
                          tool === 'pen' && color === c.value
                            ? 'border-stone-800 scale-110 shadow-sm ring-2 ring-stone-800/20'
                            : 'border-white hover:scale-105'
                        }`}
                        title={c.label}
                      >
                        {tool === 'pen' && color === c.value && (
                          <div className="w-1.5 h-1.5 bg-white rounded-full shadow-xs" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Palette Popover Overlay */}
                <AnimatePresence>
                  {isPaletteOpen && (
                    <>
                      {/* Invisible backdrop to dismiss palette on outside click */}
                      <div 
                        className="fixed inset-0 z-40 cursor-default" 
                        onClick={() => setIsPaletteOpen(false)} 
                      />
                      
                      {/* Floating Palette Container */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="absolute bottom-full mb-3 right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 z-50 w-[290px] sm:w-[320px] bg-white border-3 border-[#E6D5B8] rounded-[24px] shadow-2xl p-4 flex flex-col gap-3"
                      >
                        {/* Popover Header */}
                        <div className="flex items-center justify-between border-b border-dashed border-[#E6D5B8] pb-2">
                          <span className="font-gaegu text-base sm:text-lg font-bold text-[#5D5443] flex items-center gap-1.5">
                            <Palette size={18} className="text-[#FF8B3D]" />
                            <span>색상판 (색연필 26색)</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsPaletteOpen(false)}
                            className="p-1 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
                          >
                            <X size={16} />
                          </button>
                        </div>
                        
                        {/* Colors Grid */}
                        <div className="grid grid-cols-6 sm:grid-cols-7 gap-2.5 max-h-48 overflow-y-auto pr-1">
                          {PALETTE_COLORS.map((c) => (
                            <button
                              key={c.value}
                              type="button"
                              onClick={() => {
                                setColor(c.value);
                                setTool('pen');
                                setIsPaletteOpen(false); // Close upon selecting
                              }}
                              style={{ backgroundColor: c.value }}
                              className={`aspect-square w-full rounded-full transition-all active:scale-90 cursor-pointer flex items-center justify-center border-2 ${
                                tool === 'pen' && color === c.value
                                  ? 'border-stone-800 scale-110 shadow-md ring-2 ring-stone-800/20'
                                  : 'border-stone-200 hover:border-stone-400 hover:scale-105'
                              }`}
                              title={c.label}
                            >
                              {tool === 'pen' && color === c.value && (
                                <div className="w-1.5 h-1.5 bg-white rounded-full shadow-xs" />
                              )}
                            </button>
                          ))}
                          
                          {/* Plus symbol custom color HTML5 input */}
                          <label 
                            className="aspect-square w-full rounded-full border-2 border-dashed border-stone-300 hover:border-[#6BCB77] bg-stone-50 flex items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95 relative group"
                            title="더 많은 색상 직접 고르기"
                          >
                            <span className="text-stone-500 font-bold group-hover:text-[#6BCB77] text-sm">+</span>
                            <input
                              type="color"
                              value={color}
                              onChange={(e) => {
                                setColor(e.target.value);
                                setTool('pen');
                              }}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            />
                          </label>
                        </div>
                        
                        {/* Footer info */}
                        <div className="flex justify-between items-center bg-stone-50 px-2.5 py-1.5 rounded-xl border border-stone-150">
                          <span className="text-[11px] text-stone-500 font-sans">마음에 드는 색을 콕 짚어보세요!</span>
                          <button
                            type="button"
                            onClick={() => setIsPaletteOpen(false)}
                            className="px-2 py-0.5 bg-[#6BCB77] hover:bg-[#4E9F57] text-white font-gaegu text-xs font-bold rounded-md transition-colors cursor-pointer"
                          >
                            확인
                          </button>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Brush Sizes & Action buttons (Undo / Clear) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Brush Size Selector */}
                <div className="flex items-center gap-3.5">
                  <span className="font-gaegu text-lg font-bold text-[#8C7E6A]">굵기:</span>
                  <div className="flex items-center gap-2">
                    {BRUSH_SIZES.map((size) => (
                      <button
                        key={size.value}
                        type="button"
                        onClick={() => setBrushSize(size.value)}
                        className={`px-2.5 py-1 rounded-lg border text-xs font-sans transition-all cursor-pointer ${
                          brushSize === size.value
                            ? 'bg-[#E8F5E9] border-[#6BCB77] text-[#4E9F57] font-bold'
                            : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'
                        }`}
                      >
                        <span className="font-gaegu text-sm font-bold">{size.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Undo / Clear Buttons */}
                <div className="flex items-center gap-2 ml-auto sm:ml-0">
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={history.length === 0}
                    className={`px-3 py-2 rounded-xl font-gaegu text-base font-bold flex items-center gap-1 transition-colors border shadow-xs ${
                      history.length > 0
                        ? 'bg-white hover:bg-stone-50 border-stone-300 text-stone-700 cursor-pointer'
                        : 'bg-stone-50 border-stone-200 text-stone-300 cursor-not-allowed'
                    }`}
                    title="방금 그린 선 취소"
                  >
                    <RotateCcw size={15} />
                    <span>되돌리기</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-xl font-gaegu text-base font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                    title="모두 지우고 새로 시작"
                  >
                    <Trash2 size={15} />
                    <span>새로 그리기</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Action Buttons (Save / Cancel) */}
            <div className="mt-6 pt-4 border-t border-dashed border-[#E6D5B8] flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-5 rounded-2xl border-2 border-[#E6D5B8] text-[#8C7E6A] hover:bg-[#FDFCF0]/50 font-gaegu text-xl font-bold transition-all duration-200 active:scale-95 cursor-pointer"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 py-3 px-5 rounded-2xl bg-[#6BCB77] hover:bg-[#4E9F57] text-white font-gaegu text-xl font-extrabold shadow-md hover:shadow-lg transition-all duration-200 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check size={20} />
                <span>장면 저장하기</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
