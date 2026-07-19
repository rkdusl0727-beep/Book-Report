import { motion } from 'motion/react';
import { BookOpen, PiggyBank, Edit3, Check, Award, Sprout } from 'lucide-react';
import { useState } from 'react';

interface PassbookHeaderProps {
  bookCount: number;
  ownerName: string;
  ownerTitle: string;
  onUpdateOwnerInfo: (name: string, title: string) => void;
  activeTab: 'deposit' | 'ledger';
  setActiveTab: (tab: 'deposit' | 'ledger') => void;
}

// Dynamic Grade helper based on bookCount to keep children motivated!
const getGradeInfo = (count: number) => {
  if (count >= 50) {
    return {
      title: '울창하고 튼튼한 아름다운 큰나무 등급',
      color: '#388E3C', // deep green
      bgColor: '#E8F5E9',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className="w-12 h-12">
          <path d="M12 52 C20 46, 44 46, 52 52" fill="none" stroke="#E6D5B8" strokeWidth="3" strokeLinecap="round" />
          <path d="M32 50 L32 30" stroke="#8C7E6A" strokeWidth="6" strokeLinecap="round" />
          <circle cx="32" cy="22" r="16" fill="#388E3C" />
          <circle cx="22" cy="26" r="12" fill="#4E9F57" />
          <circle cx="42" cy="26" r="12" fill="#4E9F57" />
          <circle cx="32" cy="14" r="12" fill="#81C784" />
          <circle cx="24" cy="24" r="2.5" fill="#E53935" />
          <circle cx="38" cy="20" r="2.5" fill="#E53935" />
          <circle cx="30" cy="28" r="2.5" fill="#E53935" />
        </svg>
      )
    };
  }
  if (count >= 30) {
    return {
      title: '주렁주렁 열린 탐스러운 열매 등급',
      color: '#E53935',
      bgColor: '#FFEBEE',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className="w-11 h-11">
          <path d="M12 50 C20 44, 44 44, 52 50" fill="none" stroke="#E6D5B8" strokeWidth="3" strokeLinecap="round" />
          <path d="M32 48 L32 26" stroke="#8C7E6A" strokeWidth="5" strokeLinecap="round" />
          <circle cx="32" cy="20" r="12" fill="#6BCB77" stroke="#4E9F57" strokeWidth="2" />
          <circle cx="27" cy="22" r="4.5" fill="#E53935" />
          <path d="M27 17.5 L28 15.5" stroke="#8C7E6A" strokeWidth="1" />
          <circle cx="37" cy="18" r="4" fill="#E53935" />
          <path d="M37 14 L38 12.5" stroke="#8C7E6A" strokeWidth="1" />
        </svg>
      )
    };
  }
  if (count >= 20) {
    return {
      title: '알록달록 피어나는 꽃송이 등급',
      color: '#D81B60',
      bgColor: '#FCE4EC',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className="w-11 h-11">
          <path d="M12 50 C20 44, 44 44, 52 50" fill="none" stroke="#E6D5B8" strokeWidth="3" strokeLinecap="round" />
          <path d="M32 48 L32 24" stroke="#4E9F57" strokeWidth="4" />
          <path d="M32 38 Q22 36 24 30 Q32 34 32 38" fill="#6BCB77" stroke="#4E9F57" strokeWidth="2" />
          <circle cx="32" cy="16" r="6" fill="#FFD93D" />
          <circle cx="32" cy="8" r="6" fill="#FF6B6B" />
          <circle cx="32" cy="24" r="6" fill="#FF6B6B" />
          <circle cx="24" cy="16" r="6" fill="#FF6B6B" />
          <circle cx="40" cy="16" r="6" fill="#FF6B6B" />
        </svg>
      )
    };
  }
  if (count >= 10) {
    return {
      title: '무럭무럭 자라는 잎새 등급',
      color: '#43A047',
      bgColor: '#E8F5E9',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className="w-11 h-11">
          <path d="M12 50 C20 44, 44 44, 52 50" fill="none" stroke="#E6D5B8" strokeWidth="3" strokeLinecap="round" />
          <path d="M32 48 L32 22" stroke="#4E9F57" strokeWidth="4" strokeLinecap="round" />
          <path d="M32 34 C16 30, 18 16, 28 24 C29 25, 32 28, 32 34 Z" fill="#6BCB77" stroke="#4E9F57" strokeWidth="2" />
          <path d="M32 26 C48 22, 46 8, 36 16 C34 18, 32 21, 32 26 Z" fill="#6BCB77" stroke="#4E9F57" strokeWidth="2" />
        </svg>
      )
    };
  }
  return {
    title: '꿈을 키우는 새싹 등급',
    color: '#6BCB77',
    bgColor: '#E8F5E9',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className="w-11 h-11">
        <path d="M12 50 C20 44, 44 44, 52 50" fill="none" stroke="#E6D5B8" strokeWidth="3" strokeLinecap="round" />
        <path d="M32 48 C32 30, 38 22, 44 16" fill="none" stroke="#4E9F57" strokeWidth="4" strokeLinecap="round" />
        <path d="M32 36 C18 30, 20 18, 30 26 C31 27, 32 30, 32 36 Z" fill="#6BCB77" stroke="#4E9F57" strokeWidth="2" strokeLinejoin="round" />
        <path d="M34 28 C48 24, 46 12, 38 18 C36 19, 35 22, 34 28 Z" fill="#88D66C" stroke="#4E9F57" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="48" cy="12" r="2" fill="#FFD93D" />
        <path d="M48 6 L48 10 M48 14 L48 18 M44 12 L52 12" stroke="#FFD93D" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  };
};

export default function PassbookHeader({
  bookCount,
  ownerName,
  ownerTitle,
  onUpdateOwnerInfo,
  activeTab,
  setActiveTab
}: PassbookHeaderProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(ownerName);
  const [titleInput, setTitleInput] = useState(ownerTitle);

  const handleSaveName = () => {
    onUpdateOwnerInfo(nameInput.trim() || '이가연', titleInput.trim() || '반짝반짝');
    setIsEditingName(false);
  };

  // Next milestone progress calculation (multiples of 10)
  const currentMilestone = Math.floor(bookCount / 10) * 10;
  const nextMilestone = currentMilestone + 10;
  const progressInMilestone = bookCount % 10;
  const progressPercent = (progressInMilestone / 10) * 100;

  // Retrieve current grade information based on book count
  const gradeInfo = getGradeInfo(bookCount);

  return (
    <div className="w-full bg-white rounded-[40px] border-4 border-[#E6D5B8] shadow-md overflow-hidden mb-8">
      <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-[#FDFCF0]/50">
        {/* Passbook Owner Identity in Natural Theme */}
        <div className="flex items-center gap-4">
          {/* Dynamic Interactive Level Badge */}
          <div 
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#E8F5E9] border-4 border-white shadow-md overflow-hidden flex items-center justify-center shrink-0"
            title={gradeInfo.title}
          >
            {gradeInfo.icon}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              {isEditingName ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Name field (이름) */}
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    maxLength={10}
                    className="px-2.5 py-1 text-base sm:text-lg font-bold font-gaegu border-2 border-[#E6D5B8] rounded-xl outline-none focus:border-[#6BCB77] bg-white text-[#4A4439] max-w-[110px] text-center"
                    placeholder="이름 (예: 이가연)"
                    title="통장 주인 이름"
                  />
                  <span className="font-gaegu text-lg text-[#8C7E6A]">의</span>
                  {/* Title field (수식어 / 설명) */}
                  <input
                    type="text"
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    maxLength={15}
                    className="px-2.5 py-1 text-base sm:text-lg font-bold font-gaegu border-2 border-[#E6D5B8] rounded-xl outline-none focus:border-[#6BCB77] bg-white text-[#4A4439] max-w-[140px] text-center"
                    placeholder="수식어 (예: 반짝반짝)"
                    title="통장 수식어/설명"
                  />
                  
                  <button
                    onClick={handleSaveName}
                    id="save-name-btn"
                    className="p-1.5 bg-[#6BCB77] hover:bg-[#4E9F57] text-white rounded-xl shadow-sm transition-colors cursor-pointer"
                  >
                    <Check size={16} />
                  </button>
                  <span className="font-gaegu text-2xl sm:text-3xl font-bold text-[#5D5443] ml-1">
                    독서통장
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-gaegu text-2xl sm:text-3xl font-bold text-[#5D5443] flex items-center gap-1 flex-wrap">
                    <span className="text-[#4E9F57] underline decoration-wavy decoration-[#FFD93D] decoration-2">{ownerName}</span>
                    <span className="text-[#8C7E6A] text-xl sm:text-2xl">의</span>
                    <span className="text-[#FF8B3D]">{ownerTitle}</span>
                    <span>독서통장</span>
                  </span>
                  <button
                    onClick={() => {
                      setNameInput(ownerName);
                      setTitleInput(ownerTitle);
                      setIsEditingName(true);
                    }}
                    id="edit-name-btn"
                    className="p-1.5 text-[#A19582] hover:text-[#5D5443] hover:bg-[#E6D5B8]/20 rounded-lg transition-colors cursor-pointer animate-pulse"
                    title="통장 이름 수정하기"
                  >
                    <Edit3 size={18} />
                  </button>
                </div>
              )}
            </div>
            
            <p className="font-sans text-xs text-[#A19582] mt-1 flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-[#4E9F57] bg-[#E8F5E9] px-2 py-0.5 rounded-lg flex items-center gap-1">
                <Sprout size={13} className="text-[#6BCB77] inline shrink-0" />
                {gradeInfo.title}
              </span>
              <span className="text-stone-300">|</span>
              <span className="inline-block px-1.5 py-0.5 bg-[#FFF3E0] text-[#FF8B3D] font-gaegu font-bold text-xs rounded-md">TIP 💡</span>
              <span>나만의 귀여운 독서통장 이름을 지어주세요</span>
            </p>
          </div>
        </div>

        {/* Real-time Savings visualizer with custom fruit & leaf indicators */}
        <div className="bg-white px-5 py-4 rounded-3xl border-2 border-[#E6D5B8] shadow-sm flex flex-col sm:flex-row sm:items-center gap-5 md:max-w-md w-full">
          {/* Circular counts */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="font-gaegu text-2xl text-[#5D5443] font-bold">읽은 책</span>
            <div className="flex items-baseline gap-0.5">
              <span className="font-gaegu text-4xl font-extrabold text-[#6BCB77]">
                {bookCount}
              </span>
              <span className="font-gaegu text-2xl text-[#4A4439] font-bold">권</span>
            </div>
          </div>

          {/* Progress bar to next multiple of 10 */}
          <div className="w-full">
            <div className="flex justify-between items-center text-xs font-sans text-[#8C7E6A] mb-1">
              <span className="flex items-center gap-1 font-bold">
                <Award size={14} className="text-[#FF8B3D]" /> 다음 열매까지
              </span>
              <span className="font-bold text-[#FF8B3D]">{progressInMilestone} / 10권</span>
            </div>
            <div className="w-full bg-[#F5F5F5] rounded-full h-3.5 overflow-hidden border border-[#E6D5B8]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ type: 'spring', damping: 15 }}
                className="bg-gradient-to-r from-[#A8D5BA] to-[#6BCB77] h-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Natural Styled Cute Tab Buttons */}
      <div className="flex border-t-4 border-[#E6D5B8]">
        <button
          onClick={() => setActiveTab('deposit')}
          id="tab-deposit-btn"
          className={`flex-1 py-3 sm:py-4.5 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 font-gaegu text-xl sm:text-2xl font-bold border-r-2 border-[#E6D5B8] transition-all duration-300 cursor-pointer ${
            activeTab === 'deposit'
              ? 'bg-[#E8F5E9] text-[#4E9F57] shadow-inner font-extrabold'
              : 'bg-white text-[#A19582] hover:text-[#5D5443] hover:bg-[#FDFCF0]'
          }`}
        >
          <BookOpen size={20} className={`shrink-0 sm:w-[24px] sm:h-[24px] ${activeTab === 'deposit' ? 'text-[#4E9F57] scale-110' : ''}`} />
          <span className="whitespace-nowrap text-[13px] min-[360px]:text-[14px] sm:text-2xl">
            차곡차곡 책 저축하기
          </span>
        </button>
        <button
          onClick={() => setActiveTab('ledger')}
          id="tab-ledger-btn"
          className={`flex-1 py-3 sm:py-4.5 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 font-gaegu text-xl sm:text-2xl font-bold transition-all duration-300 cursor-pointer ${
            activeTab === 'ledger'
              ? 'bg-[#FFF3E0] text-[#FF8B3D] shadow-inner font-extrabold'
              : 'bg-white text-[#A19582] hover:text-[#5D5443] hover:bg-[#FDFCF0]'
          }`}
        >
          <PiggyBank size={20} className={`shrink-0 sm:w-[24px] sm:h-[24px] ${activeTab === 'ledger' ? 'text-[#FF8B3D] scale-110' : ''}`} />
          <div className="flex flex-col items-center text-center sm:flex-row sm:gap-1">
            <span className="whitespace-nowrap text-[13px] min-[360px]:text-[14px] sm:text-2xl">내 통장</span>
            <span className="whitespace-nowrap text-[13px] min-[360px]:text-[14px] sm:text-2xl">보기</span>
          </div>
        </button>
      </div>
    </div>
  );
}
