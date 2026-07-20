import { motion } from 'motion/react';
import { BookOpen, PiggyBank, Edit3, Check, Award, Sprout, RefreshCw } from 'lucide-react';
import { useState } from 'react';

interface PassbookHeaderProps {
  bookCount: number;
  ownerName: string;
  ownerTitle: string;
  onUpdateOwnerInfo: (name: string, title: string) => void;
  activeTab: 'deposit' | 'ledger';
  setActiveTab: (tab: 'deposit' | 'ledger') => void;
  syncCode: string | null;
  onOpenSync: () => void;
  userEmail?: string | null;
}

// Dynamic Grade helper based on bookCount to keep children motivated!
const getGradeInfo = (count: number) => {
  if (count >= 30) {
    return {
      title: '주렁주렁 열매 등급',
      color: '#E53935',
      bgColor: '#FFEBEE',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className="w-12 h-12">
          {/* Soil base */}
          <path d="M12 50 C20 44, 44 44, 52 50" fill="none" stroke="#E6D5B8" strokeWidth="3" strokeLinecap="round" />
          {/* Thick branch */}
          <path d="M32 48 L32 26" stroke="#8D6E63" strokeWidth="5" strokeLinecap="round" />
          {/* Leaf crown */}
          <circle cx="32" cy="20" r="12" fill="#6BCB77" stroke="#4E9F57" strokeWidth="2" />
          {/* Two shiny ripe apples */}
          <circle cx="27" cy="22" r="4.5" fill="#E53935" />
          <path d="M27 17.5 L28 15.5" stroke="#8C7E6A" strokeWidth="1" />
          <circle cx="37" cy="18" r="4" fill="#E53935" />
          <path d="M37 14 L38 12.5" stroke="#8C7E6A" strokeWidth="1" />
        </svg>
      ),
      miniIcon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-3.5 h-3.5 inline shrink-0" fill="none">
          <path d="M12 11 L12 4" stroke="#8D6E63" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M12 5 Q14.5 3, 15.5 5" fill="none" stroke="#6BCB77" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M12 7 C9 7, 7 9, 7 13 C7 18, 10 19, 12 19 C14 19, 17 18, 17 13 C17 9, 15 7, 12 7 Z" fill="#E53935" stroke="#B71C1C" strokeWidth="1" />
          <circle cx="10.5" cy="10" r="1" fill="white" opacity="0.6" />
        </svg>
      )
    };
  }
  if (count >= 20) {
    return {
      title: '든든하게 뻗어가는 나무 등급',
      color: '#2E7D32',
      bgColor: '#E8F5E9',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className="w-12 h-12">
          {/* Soil base */}
          <path d="M12 50 C20 44, 44 44, 52 50" fill="none" stroke="#E6D5B8" strokeWidth="3" strokeLinecap="round" />
          {/* Thick trunk */}
          <path d="M32 48 L32 24" stroke="#8D6E63" strokeWidth="5" strokeLinecap="round" />
          {/* Beautiful round lush green crown */}
          <circle cx="32" cy="22" r="14" fill="#4CAF50" />
          <circle cx="24" cy="26" r="10" fill="#2E7D32" />
          <circle cx="40" cy="26" r="10" fill="#2E7D32" />
          <circle cx="32" cy="14" r="10" fill="#81C784" />
        </svg>
      ),
      miniIcon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-3.5 h-3.5 inline shrink-0" fill="none">
          <path d="M12 21 L12 10" stroke="#8D6E63" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="12" cy="9" r="6.5" fill="#4CAF50" />
          <circle cx="8" cy="11" r="4.5" fill="#2E7D32" />
          <circle cx="16" cy="11" r="4.5" fill="#2E7D32" />
          <circle cx="12" cy="5" r="4.5" fill="#81C784" />
        </svg>
      )
    };
  }
  if (count >= 10) {
    return {
      title: '쑥쑥 자라는 새싹 등급',
      color: '#4CAF50',
      bgColor: '#E8F5E9',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className="w-12 h-12">
          {/* Soil base */}
          <path d="M12 50 C20 44, 44 44, 52 50" fill="none" stroke="#E6D5B8" strokeWidth="3" strokeLinecap="round" />
          {/* Cute green sprout branch */}
          <path d="M32 48 C32 30, 38 22, 44 16" fill="none" stroke="#4CAF50" strokeWidth="4" strokeLinecap="round" />
          <path d="M32 36 C18 30, 20 18, 30 26 C31 27, 32 30, 32 36 Z" fill="#6BCB77" stroke="#4E9F57" strokeWidth="2" strokeLinejoin="round" />
          <path d="M34 28 C48 24, 46 12, 38 18 C36 19, 35 22, 34 28 Z" fill="#88D66C" stroke="#4E9F57" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      ),
      miniIcon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-3.5 h-3.5 inline shrink-0" fill="none">
          <path d="M12 21 C12 13, 15 9, 18 6" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" />
          <path d="M12 15 C5 12, 6 6, 11 10 C11.5 10.5, 12 12, 12 15 Z" fill="#6BCB77" stroke="#4E9F57" strokeWidth="1" strokeLinejoin="round" />
          <path d="M13 11 C20 9, 19 3, 15 6 C14 7, 13.5 9, 13 11 Z" fill="#88D66C" stroke="#4E9F57" strokeWidth="1" strokeLinejoin="round" />
        </svg>
      )
    };
  }
  // count < 10: Seed (씨앗) starting grade
  return {
    title: '꿈을 품은 씨앗 등급',
    color: '#8D6E63',
    bgColor: '#FDFCF0',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className="w-12 h-12">
        {/* Soil base */}
        <path d="M12 50 C20 44, 44 44, 52 50" fill="none" stroke="#E6D5B8" strokeWidth="3" strokeLinecap="round" />
        {/* Seed outline and cute face */}
        <path d="M32 46 C20 46, 18 34, 32 16 C46 34, 44 46, 32 46 Z" fill="#A1887F" stroke="#8D6E63" strokeWidth="3" />
        <path d="M21 38 Q32 44 43 38" fill="none" stroke="#8D6E63" strokeWidth="2" strokeDasharray="3,3" />
        {/* Tiny green life spark indicator */}
        <circle cx="32" cy="12" r="3" fill="#81C784" className="animate-pulse" />
      </svg>
    ),
    miniIcon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-3.5 h-3.5 inline shrink-0" fill="none">
        <path d="M12 21 C6 21, 5 15, 12 7 C19 15, 18 21, 12 21 Z" fill="#A1887F" stroke="#8D6E63" strokeWidth="1.5" />
        <circle cx="12" cy="7" r="1.5" fill="#81C784" className="animate-pulse" />
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
  setActiveTab,
  syncCode,
  onOpenSync,
  userEmail
}: PassbookHeaderProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(ownerName);
  const [titleInput, setTitleInput] = useState(ownerTitle);

  const handleSaveName = () => {
    onUpdateOwnerInfo(nameInput.trim() || '이가연', titleInput.trim() || '반짝반짝');
    setIsEditingName(false);
  };

  // Retrieve current grade information based on book count
  const gradeInfo = getGradeInfo(bookCount);

  return (
    <div className="w-full bg-white rounded-[40px] border-4 border-[#E6D5B8] shadow-md overflow-hidden mb-8">
      <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-[#FDFCF0]/50">
        {/* Passbook Owner Identity in Natural Theme */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 w-full md:w-auto order-1 md:order-none">
          {/* Dynamic Interactive Level Badge & Grade Name under it */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <div 
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#E8F5E9] border-4 border-white shadow-md overflow-hidden flex items-center justify-center"
              title={gradeInfo.title}
            >
              {gradeInfo.icon}
            </div>
            
            {/* Seed/Sprout/etc. Grade Tag directly under the Profile Picture */}
            <span className="font-bold text-[#4E9F57] bg-[#E8F5E9] border border-[#C2E8C6] px-2 py-0.5 rounded-lg flex items-center gap-1 text-[11px] sm:text-xs shadow-sm">
              {gradeInfo.miniIcon}
              <span className="font-gaegu text-[12px] sm:text-xs font-black text-[#2E7D32]">{gradeInfo.title}</span>
            </span>
          </div>

          <div className="flex-1 flex flex-col items-center sm:items-start text-center sm:text-left gap-2 w-full mt-1">
            <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start w-full">
              {isEditingName ? (
                <div className="flex items-center gap-1.5 flex-wrap justify-center sm:justify-start">
                  {/* Name field (이름) */}
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    maxLength={10}
                    className="px-2.5 py-1 text-base sm:text-lg font-bold font-gaegu border-2 border-[#E6D5B8] rounded-xl outline-none focus:border-[#6BCB77] bg-white text-[#4A4439] max-w-[100px] text-center"
                    placeholder="이름 (예: 이가연)"
                    title="통장 주인 Name"
                  />
                  <span className="font-gaegu text-lg text-[#8C7E6A]">의</span>
                  {/* Title field (수식어 / 설명) */}
                  <input
                    type="text"
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    maxLength={15}
                    className="px-2.5 py-1 text-base sm:text-lg font-bold font-gaegu border-2 border-[#E6D5B8] rounded-xl outline-none focus:border-[#6BCB77] bg-white text-[#4A4439] max-w-[120px] text-center"
                    placeholder="수식어 (예: 반짝반짝)"
                    title="통장 Modifier"
                  />
                  
                  <button
                    onClick={handleSaveName}
                    id="save-name-btn"
                    className="p-1.5 bg-[#6BCB77] hover:bg-[#4E9F57] text-white rounded-xl shadow-sm transition-colors cursor-pointer flex items-center justify-center shrink-0"
                  >
                    <Check size={16} />
                  </button>
                  <span className="font-gaegu text-2xl sm:text-3xl font-bold text-[#5D5443] ml-1">
                    독서통장
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start w-full">
                  <span className="font-gaegu text-2xl sm:text-3xl font-bold text-[#5D5443] flex items-center gap-1 flex-wrap justify-center sm:justify-start">
                    <span className="text-[#4E9F57] underline decoration-wavy decoration-[#FFD93D] decoration-2">{ownerName}</span>
                    <span className="text-[#8C7E6A] text-xl sm:text-2xl">의</span>
                    <span className="text-[#FF8B3D]">{ownerTitle}</span>
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <span>독서통장</span>
                      <button
                        onClick={() => {
                          setNameInput(ownerName);
                          setTitleInput(ownerTitle);
                          setIsEditingName(true);
                        }}
                        id="edit-name-btn"
                        className="p-1 text-[#A19582] hover:text-[#5D5443] hover:bg-[#E6D5B8]/20 rounded-lg transition-colors cursor-pointer animate-pulse inline-flex items-center justify-center align-middle"
                        title="통장 이름 수정하기"
                      >
                        <Edit3 size={18} />
                      </button>
                    </span>
                  </span>
                </div>
              )}
            </div>
            
            <div className="w-full flex flex-col items-center sm:items-start gap-1">
              {/* TIP Box right under the name */}
              <div className="font-sans text-[12px] sm:text-xs text-[#A19582] flex items-center gap-1.5 justify-center sm:justify-start w-full flex-wrap">
                <span className="inline-block px-1.5 py-0.5 bg-[#FFF3E0] text-[#FF8B3D] font-gaegu font-bold text-xs rounded-md shrink-0">TIP 💡</span>
                <span className="text-stone-600 font-medium text-[12px] sm:text-xs">
                  나만의 귀여운 독서통장 <span className="font-bold text-[#FF8B3D]">이름을 지어주세요</span>
                </span>
              </div>

              {/* Connection / Sync Buttons */}
              <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start w-full mt-1.5">
                {userEmail ? (
                  <button
                    onClick={onOpenSync}
                    className="font-bold text-[#4E9F57] bg-[#E8F5E9] border border-[#A8D5BA] px-2.5 py-0.5 rounded-lg flex items-center gap-1.5 text-[11px] sm:text-xs transition-colors cursor-pointer"
                    title="클라우드 계정 정보 및 설정"
                  >
                    <span className="w-2 h-2 rounded-full bg-[#6BCB77] animate-pulse shrink-0" />
                    <span>구름 저장 완료 ☁️</span>
                  </button>
                ) : syncCode ? (
                  <button
                    onClick={onOpenSync}
                    className="font-bold text-[#2b72c4] bg-[#E1F5FE] hover:bg-[#B3E5FC] px-2 py-0.5 rounded-lg flex items-center gap-1 text-[11px] sm:text-xs transition-colors cursor-pointer"
                    title="기기 연동 및 동기화 설정"
                  >
                    <RefreshCw size={11} className="shrink-0 text-[#2b72c4] animate-[spin_4s_linear_infinite]" />
                    <span>연동됨: {syncCode}</span>
                  </button>
                ) : (
                  <button
                    onClick={onOpenSync}
                    className="font-bold text-[#FF8B3D] bg-[#FFF3E0] hover:bg-[#FFE0B2] px-2 py-0.5 rounded-lg flex items-center gap-1 text-[11px] sm:text-xs transition-colors cursor-pointer"
                    title="기기 연동 및 동기화 설정"
                  >
                    <RefreshCw size={11} className="shrink-0 text-[#FF8B3D]" />
                    <span>기기 연동 🔄</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Real-time Savings visualizer with custom cumulative journey to 30 */}
        <div className="bg-white px-5 py-4.5 rounded-3xl border-2 border-[#E6D5B8] shadow-sm flex flex-col gap-3.5 md:max-w-md w-full order-2 md:order-none">
          {/* Circular counts */}
          <div className="flex items-center justify-between gap-2 flex-wrap min-[380px]:flex-nowrap">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="font-gaegu text-xl text-[#5D5443] font-bold whitespace-nowrap shrink-0">누적 저축</span>
              <div className="flex items-baseline gap-0.5 whitespace-nowrap shrink-0">
                <span className="font-gaegu text-3xl font-extrabold text-[#6BCB77] leading-none">
                  {bookCount}
                </span>
                <span className="font-gaegu text-xl text-[#4A4439] font-bold leading-none">/ 30권</span>
              </div>
            </div>
          </div>

          {/* Gamified 0 to 30 Progress Road */}
          <div className="relative mt-1 px-1">
            {/* Base gray line */}
            <div className="w-full bg-[#F5F5F5] rounded-full h-3 overflow-hidden border border-[#E6D5B8] relative">
              {/* Green active progress */}
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((bookCount / 30) * 100, 100)}%` }}
                transition={{ type: 'spring', damping: 15 }}
                className="bg-gradient-to-r from-[#A8D5BA] to-[#6BCB77] h-full"
              />
            </div>

            {/* Milestone Markers at 10, 20, 30 books */}
            <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 flex pointer-events-none px-[3px]">
              {/* Sprout at 10 (33.33% along) */}
              <div className="absolute left-[33.33%] -translate-x-1/2 flex items-center justify-center">
                <div className={`w-6 h-6 rounded-full border-2 border-white flex items-center justify-center shadow-md transition-all duration-300 ${
                  bookCount >= 10 ? 'bg-[#4CAF50] scale-110' : 'bg-stone-300'
                }`}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none">
                    <path d="M12 20 C12 13, 15 10, 18 7" stroke={bookCount >= 10 ? '#FFFFFF' : '#757575'} strokeWidth="2.5" strokeLinecap="round" />
                    <path d="M12 15 C5 12, 6 6, 11 10 Z" fill={bookCount >= 10 ? '#81C784' : '#9E9E9E'} stroke={bookCount >= 10 ? '#FFFFFF' : '#757575'} strokeWidth="1" strokeLinejoin="round" />
                    <path d="M12 11 C18 9, 18 4, 14 6 Z" fill={bookCount >= 10 ? '#A5D6A7' : '#BDBDBD'} stroke={bookCount >= 10 ? '#FFFFFF' : '#757575'} strokeWidth="1" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>

              {/* Tree at 20 (66.66% along) */}
              <div className="absolute left-[66.66%] -translate-x-1/2 flex items-center justify-center">
                <div className={`w-6 h-6 rounded-full border-2 border-white flex items-center justify-center shadow-md transition-all duration-300 ${
                  bookCount >= 20 ? 'bg-[#2E7D32] scale-110' : 'bg-stone-300'
                }`}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none">
                    <path d="M12 21 L12 11" stroke={bookCount >= 20 ? '#FFFFFF' : '#757575'} strokeWidth="2.5" strokeLinecap="round" />
                    <circle cx="12" cy="9" r="5" fill={bookCount >= 20 ? '#4CAF50' : '#9E9E9E'} />
                    <circle cx="8" cy="11" r="3.5" fill={bookCount >= 20 ? '#2E7D32' : '#757575'} />
                    <circle cx="16" cy="11" r="3.5" fill={bookCount >= 20 ? '#2E7D32' : '#757575'} />
                    <circle cx="12" cy="5" r="3.5" fill={bookCount >= 20 ? '#81C784' : '#BDBDBD'} />
                  </svg>
                </div>
              </div>

              {/* Fruit at 30 (100% along) */}
              <div className="absolute right-0 flex items-center justify-center">
                <div className={`w-6.5 h-6.5 rounded-full border-2 border-white flex items-center justify-center shadow-md transition-all duration-300 ${
                  bookCount >= 30 ? 'bg-[#E53935] scale-110 animate-pulse' : 'bg-stone-300'
                }`}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4" fill="none">
                    <path d="M12 11 L12 4" stroke={bookCount >= 30 ? '#FFFFFF' : '#757575'} strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M12 5 Q14.5 3, 15.5 5" fill="none" stroke={bookCount >= 30 ? '#81C784' : '#BDBDBD'} strokeWidth="1" strokeLinecap="round" />
                    <path d="M12 7 C9 7, 7 9, 7 13 C7 17, 10 18, 12 17 C14 18, 17 17, 17 13 C17 9, 15 7, 12 7 Z" fill={bookCount >= 30 ? '#FF1744' : '#9E9E9E'} stroke={bookCount >= 30 ? '#FFFFFF' : '#757575'} strokeWidth="1" />
                    <circle cx="10" cy="10" r="0.8" fill="white" opacity="0.8" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Labels for landmarks */}
          <div className="flex justify-between items-center text-[10px] font-sans text-[#8C7E6A] px-1 font-bold">
            <span className="text-[#8D6E63]">씨앗 (0)</span>
            <span className={bookCount >= 10 ? 'text-[#4CAF50]' : ''}>새싹 (10)</span>
            <span className={bookCount >= 20 ? 'text-[#2E7D32]' : ''}>나무 (20)</span>
            <span className={bookCount >= 30 ? 'text-[#E53935]' : ''}>열매 (30)</span>
          </div>
        </div>
      </div>

      {/* Natural Styled Cute Tab Buttons */}
      <div className="flex border-t-4 border-[#E6D5B8]">
        <button
          onClick={() => setActiveTab('deposit')}
          id="tab-deposit-btn"
          className={`flex-1 py-3.5 sm:py-5 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 font-gaegu text-xl sm:text-2xl font-bold border-r-2 border-[#E6D5B8] transition-all duration-300 cursor-pointer ${
            activeTab === 'deposit'
              ? 'bg-[#E8F5E9] text-[#4E9F57] shadow-inner font-extrabold'
              : 'bg-white text-[#A19582] hover:text-[#5D5443] hover:bg-[#FDFCF0]'
          }`}
        >
          <BookOpen size={22} className={`shrink-0 sm:w-[28px] sm:h-[28px] ${activeTab === 'deposit' ? 'text-[#4E9F57] scale-110' : ''}`} />
          <div className="flex flex-col items-center text-center sm:flex-row sm:gap-1 font-bold">
            <span className="whitespace-nowrap text-[16px] min-[360px]:text-[17px] sm:text-3xl font-black">책통장에 저축하기</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('ledger')}
          id="tab-ledger-btn"
          className={`flex-1 py-3.5 sm:py-5 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 font-gaegu text-xl sm:text-2xl font-bold transition-all duration-300 cursor-pointer ${
            activeTab === 'ledger'
              ? 'bg-[#FFF3E0] text-[#FF8B3D] shadow-inner font-extrabold'
              : 'bg-white text-[#A19582] hover:text-[#5D5443] hover:bg-[#FDFCF0]'
          }`}
        >
          <PiggyBank size={22} className={`shrink-0 sm:w-[28px] sm:h-[28px] ${activeTab === 'ledger' ? 'text-[#FF8B3D] scale-110' : ''}`} />
          <div className="flex flex-col items-center text-center sm:flex-row sm:gap-1 font-bold">
            <span className="whitespace-nowrap text-[16px] min-[360px]:text-[17px] sm:text-3xl font-black">내 통장</span>
            <span className="whitespace-nowrap text-[16px] min-[360px]:text-[17px] sm:text-3xl font-black">보기</span>
          </div>
        </button>
      </div>
    </div>
  );
}
