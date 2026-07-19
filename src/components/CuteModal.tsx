import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, HelpCircle, AlertCircle, Check } from 'lucide-react';

interface CuteModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type?: 'success' | 'warning' | 'confirm' | 'info';
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  children: React.ReactNode;
}

export default function CuteModal({
  isOpen,
  onClose,
  title,
  type = 'info',
  confirmText = '확인',
  cancelText = '취소',
  onConfirm,
  children
}: CuteModalProps) {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <div className="w-12 h-12 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#4E9F57] animate-bounce">
            <Check size={28} />
          </div>
        );
      case 'warning':
        return (
          <div className="w-12 h-12 rounded-full bg-[#FFF3E0] flex items-center justify-center text-[#FF8B3D] animate-pulse">
            <AlertCircle size={28} />
          </div>
        );
      case 'confirm':
        return (
          <div className="w-12 h-12 rounded-full bg-[#FFF9C4] flex items-center justify-center text-[#8C7E6A]">
            <HelpCircle size={28} />
          </div>
        );
      default:
        return (
          <div className="w-12 h-12 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#6BCB77]">
            <Sparkles size={28} />
          </div>
        );
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-md overflow-hidden bg-white rounded-[32px] border-4 border-[#E6D5B8] shadow-2xl p-6 z-10"
          >
            {/* Top wave pattern border or cute background */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#A8D5BA] via-[#6BCB77] to-[#FF8B3D]" />

            {/* Close button */}
            <button
              onClick={onClose}
              id="modal-close-btn"
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-[#FDFCF0] text-[#A19582] hover:text-[#5D5443] transition-colors"
            >
              <X size={20} />
            </button>

            {/* Modal Content */}
            <div className="flex flex-col items-center text-center mt-3">
              {getIcon()}

              <h3 className="font-gaegu text-2xl font-bold text-[#5D5443] mt-4 tracking-wide">
                {title}
              </h3>

              <div className="font-sans text-[#5D5443] mt-3 text-sm leading-relaxed whitespace-pre-line w-full">
                {children}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 w-full mt-6">
                {onConfirm && (
                  <button
                    type="button"
                    id="modal-cancel-btn"
                    onClick={onClose}
                    className="flex-1 py-3 px-4 rounded-2xl border-2 border-[#E6D5B8] text-[#8C7E6A] hover:bg-[#FDFCF0]/40 font-gaegu text-xl font-bold transition-all duration-200 active:scale-95"
                  >
                    {cancelText}
                  </button>
                )}
                <button
                  type="button"
                  id="modal-confirm-btn"
                  onClick={() => {
                    if (onConfirm) {
                      onConfirm();
                    } else {
                      onClose();
                    }
                  }}
                  className={`flex-1 py-3 px-4 rounded-2xl font-gaegu text-xl font-bold text-white shadow-md hover:shadow-lg transition-all duration-200 active:scale-95 ${
                    type === 'warning' || type === 'confirm'
                      ? 'bg-[#FF8B3D] hover:bg-[#E07A30] shadow-[#FF8B3D]/20'
                      : 'bg-[#6BCB77] hover:bg-[#4E9F57] shadow-[#6BCB77]/20'
                  }`}
                >
                  {confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
