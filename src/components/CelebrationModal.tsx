import { motion, AnimatePresence } from 'motion/react';
import { Award, Star, Heart, Trophy, Sparkles, X } from 'lucide-react';

interface CelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  ownerName: string;
  bookCount: number;
}

export default function CelebrationModal({
  isOpen,
  onClose,
  ownerName,
  bookCount
}: CelebrationModalProps) {
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
            className="fixed inset-0 bg-stone-900/50 backdrop-blur-md"
          />

          {/* Certificate Container */}
          <motion.div
            initial={{ scale: 0.5, rotate: -5, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0.5, rotate: 5, opacity: 0 }}
            transition={{ type: 'spring', damping: 15, stiffness: 180 }}
            className="relative w-full max-w-lg bg-[#fffdf0] rounded-[40px] border-8 border-[#E6D5B8] shadow-2xl p-8 z-10 text-[#4A4439] overflow-hidden"
          >
            {/* Cute Green Sprout Ribbon/Stamp or Sparkle background */}
            <div className="absolute top-0 right-0 left-0 h-4 bg-gradient-to-r from-[#A8D5BA] via-[#6BCB77] to-[#A8D5BA]" />
            <div className="absolute -right-16 -bottom-16 w-48 h-48 bg-[#FFF9C4]/30 rounded-full opacity-50 pointer-events-none" />
            <div className="absolute -left-16 -top-16 w-48 h-48 bg-[#E8F5E9]/30 rounded-full opacity-50 pointer-events-none" />

            {/* Sparkle decorative circles */}
            <div className="absolute top-12 left-12 text-[#FF8B3D] animate-pulse">
              <Star size={24} fill="currentColor" />
            </div>
            <div className="absolute top-16 right-16 text-[#6BCB77] animate-bounce">
              <Heart size={20} fill="currentColor" />
            </div>
            <div className="absolute bottom-16 left-16 text-[#A8D5BA] animate-bounce delay-150">
              <Sparkles size={24} />
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              id="certificate-close-btn"
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-[#FDFCF0] text-[#A19582] hover:text-[#5D5443] transition-colors z-20"
            >
              <X size={24} />
            </button>

            {/* Inner border for classic Certificate style */}
            <div className="border-4 border-dashed border-[#E6D5B8] rounded-2xl p-6 flex flex-col items-center text-center relative bg-white/80 backdrop-blur-sm">
              <Trophy className="text-[#FF8B3D] w-16 h-16 mb-4 animate-bounce" />

              <h2 className="font-gaegu text-4xl font-extrabold text-[#5D5443] tracking-wider">
                독서 새싹 대장상
              </h2>
              
              <div className="w-32 h-1 bg-[#6BCB77] my-3" />

              <div className="font-gaegu text-2xl text-[#4E9F57] font-bold mb-4">
                이름: {ownerName || '우리 아기'} 어린이
              </div>

              <div className="font-sans text-[#5D5443] leading-relaxed text-base max-w-sm px-2 py-4 border-y border-[#E6D5B8]/40 my-2">
                위 어린이는 재미있는 책을 벌써{' '}
                <span className="text-[#FF8B3D] font-bold text-xl">{bookCount}권</span>이나 
                열심히 읽고 저축하였습니다! 
                <br />
                책을 가까이하며 고운 마음과 지혜를 가득 담은 생각이 쑥쑥 자라는 멋진 어린이가 되었으므로, 칭찬을 듬뿍 담아 이 상장을 수여합니다.
              </div>

              {/* Decorative Ribbon Stamp */}
              <div className="mt-6 flex flex-col items-center">
                <div className="relative flex items-center justify-center text-[#6BCB77] animate-spin-slow">
                  <Award size={72} fill="rgba(107,203,119,0.1)" />
                  <div className="absolute font-gaegu text-xs font-bold text-[#4E9F57] text-center">
                    참 잘했어요!
                  </div>
                </div>
                <div className="font-gaegu text-lg text-[#A19582] mt-2">
                  {new Date().getFullYear()}년 {new Date().getMonth() + 1}월 {new Date().getDate()}일
                </div>
                <div className="font-gaegu text-xl font-bold text-[#5D5443] mt-1">
                  모바일 디지털 독서은행 대장
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
