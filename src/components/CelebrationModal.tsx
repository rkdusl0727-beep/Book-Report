import { motion, AnimatePresence } from 'motion/react';
import { Star, Heart, Trophy, Sparkles, X } from 'lucide-react';

interface CelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  ownerName: string;
  bookCount: number;
}

// Custom Premium 3D Glossy Badge component for high visibility
function ThreeDBadge() {
  return (
    <div className="relative flex items-center justify-center select-none my-6 w-36 h-36">
      {/* Real 3D drop shadow beneath the badge */}
      <div className="absolute inset-1.5 rounded-full bg-black/15 blur-md transform translate-y-2 pointer-events-none" />
      
      {/* Outer 3D thick golden plastic/metallic bezel */}
      <div className="relative w-32 h-32 rounded-full bg-gradient-to-tr from-[#FF9800] via-[#FFD54F] to-[#FFE082] p-1.5 shadow-[inset_0_-3px_6px_rgba(0,0,0,0.25),0_3px_8px_rgba(0,0,0,0.15)] flex items-center justify-center transform hover:scale-105 active:scale-95 transition-transform duration-200 cursor-pointer">
        
        {/* Shiny gold inner rim */}
        <div className="absolute inset-[3px] rounded-full border-2 border-[#FFA726] opacity-30" />
        
        {/* Embossed inner bevel container */}
        <div className="relative w-full h-full rounded-full bg-gradient-to-b from-[#FFF9C4] via-[#FFCA28] to-[#F57C00] p-1 shadow-[inset_0_3px_5px_rgba(255,255,255,0.8)] flex items-center justify-center">
          
          {/* Crimson Red Enamel Center (Traditional Korean "참 잘했어요!" stamp style for high contrast) */}
          <div className="relative w-full h-full rounded-full bg-gradient-to-b from-[#FF5252] via-[#E53935] to-[#C62828] border-2 border-white overflow-hidden flex flex-col items-center justify-center shadow-[inset_0_3px_6px_rgba(0,0,0,0.45),0_1px_2px_rgba(0,0,0,0.15)]">
            
            {/* Gloss reflection highlight dome */}
            <div className="absolute top-0 left-0 right-0 h-[45%] bg-gradient-to-b from-white/35 via-white/10 to-transparent rounded-t-full pointer-events-none" />
            <div className="absolute top-[8%] left-[12%] w-[76%] h-[20%] bg-white/20 rounded-full blur-[1px] pointer-events-none" />
            
            {/* Bold stylized text with extreme contrast and dropshadow */}
            <div className="z-10 flex flex-col items-center text-center px-2">
              <span className="font-gaegu text-[20px] sm:text-[22px] font-black text-white tracking-widest leading-none drop-shadow-[0_2.5px_2px_rgba(0,0,0,0.95)] whitespace-nowrap">
                참 잘했어요!
              </span>
              
              {/* Cute yellow mini stars */}
              <div className="flex gap-1.5 mt-1.5 text-[#FFEB3B] drop-shadow-[0_1.5px_1.5px_rgba(0,0,0,0.9)] animate-pulse">
                <Star size={13} fill="currentColor" stroke="none" />
                <Star size={13} fill="currentColor" stroke="none" />
              </div>
            </div>

            {/* Internal glass outline */}
            <div className="absolute inset-[3px] rounded-full border border-white/15 pointer-events-none" />
            
            {/* Shadow crescent at the bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-[20%] bg-black/15 pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CelebrationModal({
  isOpen,
  onClose,
  ownerName,
  bookCount
}: CelebrationModalProps) {
  // Determine dynamic award title and customized text depending on bookCount milestone
  const getAwardDetails = (count: number) => {
    if (count >= 30) {
      const milestoneLabel = count === 30 ? '열매 등급 🍎' : `빛나는 완독 마스터 등급 ⭐ (${count}권)`;
      return {
        title: count === 30 ? '독서 열매 대장상' : '초특급 독서 마스터상',
        themeColor: '#E53935',
        description: `주렁주렁 탐스러운 열매처럼 알찬 지식과 슬기를 가득 채우며 열심히 책을 저축하여, 마침내 멋진 [${milestoneLabel}]으로 당당하게 업그레이드되었습니다!`
      };
    }
    if (count >= 20) {
      return {
        title: '독서 나무 대장상',
        themeColor: '#2E7D32',
        description: '든든하게 뻗어가는 푸른 나무처럼 깊은 생각과 마음의 키를 한 뼘 더 키우며 열심히 책을 저축하여, 멋진 [나무 등급 🌳]으로 당당하게 업그레이드되었습니다!'
      };
    }
    // 10 books or default Sprout
    return {
      title: '독서 새싹 대장상',
      themeColor: '#4CAF50',
      description: '무럭무럭 자라나는 초록 새싹처럼 고운 마음과 지혜를 쑥쑥 키우며 열심히 책을 저축하여, 드디어 꿈이 자라는 [새싹 등급 🌱]으로 당당하게 업그레이드되었습니다!'
    };
  };

  const awardDetails = getAwardDetails(bookCount);

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
            className="relative w-full max-w-lg bg-[#fffdf0] rounded-[40px] border-8 border-[#E6D5B8] shadow-2xl p-6 sm:p-8 z-10 text-[#4A4439] overflow-hidden"
          >
            {/* Cute Sprout/Fruit Ribbon/Stamp background */}
            <div className="absolute top-0 right-0 left-0 h-4 bg-gradient-to-r from-[#A8D5BA] via-[#6BCB77] to-[#A8D5BA]" />
            <div className="absolute -right-16 -bottom-16 w-48 h-48 bg-[#FFF9C4]/30 rounded-full opacity-50 pointer-events-none" />
            <div className="absolute -left-16 -top-16 w-48 h-48 bg-[#E8F5E9]/30 rounded-full opacity-50 pointer-events-none" />

            {/* Sparkle decorative circles */}
            <div className="absolute top-12 left-12 text-[#FF8B3D] animate-pulse">
              <Star size={24} fill="currentColor" stroke="none" />
            </div>
            <div className="absolute top-16 right-16 text-[#E53935] animate-bounce">
              <Heart size={20} fill="currentColor" stroke="none" />
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
            <div className="border-4 border-dashed border-[#E6D5B8] rounded-2xl p-5 sm:p-6 flex flex-col items-center text-center relative bg-white/80 backdrop-blur-sm">
              <Trophy className="text-[#FF8B3D] w-14 h-14 sm:w-16 sm:h-16 mb-4 animate-bounce" />

              <h2 className="font-gaegu text-3xl sm:text-4xl font-extrabold text-[#5D5443] tracking-wider whitespace-nowrap">
                {awardDetails.title}
              </h2>
              
              <div className="w-32 h-1 bg-[#6BCB77] my-3" style={{ backgroundColor: awardDetails.themeColor }} />

              <div className="font-gaegu text-xl sm:text-2xl text-[#4E9F57] font-bold mb-4 break-keep" style={{ color: awardDetails.themeColor }}>
                이름: {ownerName || '우리 아기'} 어린이
              </div>

              {/* Dynamic break-keep with inline-blocks to ensure postpositional particles (조사) do not break awkwardly */}
              <div className="font-sans text-[#5D5443] leading-relaxed text-sm sm:text-base max-w-sm px-2 py-4 border-y border-[#E6D5B8]/40 my-2 break-keep text-center">
                <span className="inline-block">위 어린이는 재미있는 책을 벌써</span>{' '}
                <span className="text-[#FF8B3D] font-black text-lg sm:text-xl whitespace-nowrap underline decoration-double decoration-[#FF8B3D]">{bookCount}권</span>이나{' '}
                <span className="inline-block">열심히 읽고 저축하였습니다!</span>{' '}
                <br className="hidden sm:inline" />
                <span className="inline-block">{awardDetails.description}</span>{' '}
                <br />
                <span className="inline-block">책을 가까이하며 바른 마음을 담은 생각이</span>{' '}
                <span className="inline-block">쑥쑥 자라는 멋진 어린이가 되었으므로,</span>{' '}
                <span className="inline-block">칭찬을 가득 담아 이 상장을 수여합니다.</span>
              </div>

              {/* Premium 3D Ribbon Stamp */}
              <div className="mt-2 flex flex-col items-center">
                <ThreeDBadge />

                <div className="font-gaegu text-base sm:text-lg text-[#A19582] mt-3 whitespace-nowrap">
                  {new Date().getFullYear()}년 {new Date().getMonth() + 1}월 {new Date().getDate()}일
                </div>
                
                <div className="relative mt-2 flex items-center justify-center gap-2">
                  <span className="font-gaegu text-lg sm:text-xl font-bold text-[#5D5443] whitespace-nowrap">
                    디지털 독서은행장
                  </span>
                  
                  {/* Realistic Red Square Seal (직인) */}
                  <div className="w-10 h-10 border-2 border-[#D32F2F] rounded bg-white/90 flex items-center justify-center text-[#D32F2F] font-bold select-none rotate-12 shadow-sm shrink-0">
                    <div className="grid grid-cols-3 gap-[1px] text-[7px] leading-none text-center font-serif font-extrabold p-0.5">
                      <span>디</span><span>지</span><span>털</span>
                      <span>독</span><span>서</span><span>은</span>
                      <span>행</span><span>장</span><span>인</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
