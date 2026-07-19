import { useState, useRef } from 'react';
import { BookRecord } from '../types';
import { Star, Play, Pause, Trash2, Heart, Search, HelpCircle, AlertCircle, Sparkles, BookOpen, Smile, Sprout } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import CuteModal from './CuteModal';

const getFeelingIcon = (feelingText: string) => {
  // If the stored value contains emojis for backward compatibility, handle them or strip them.
  const clean = feelingText.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF]/g, '').trim();
  
  if (clean.includes('감동')) {
    return <Heart size={18} className="text-rose-500 fill-rose-200 shrink-0" />;
  }
  if (clean.includes('또')) {
    return <Sparkles size={18} className="text-[#4E9F57] fill-emerald-100 shrink-0" />;
  }
  return <Smile size={18} className="text-amber-500 fill-amber-100 shrink-0" />;
};

const getFeelingTextOnly = (feelingText: string) => {
  return feelingText.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF]/g, '').trim();
};

interface PassbookLedgerProps {
  books: BookRecord[];
  onDeleteBook: (id: string) => void;
  onClearAll: () => void;
}

export default function PassbookLedger({ books, onDeleteBook, onClearAll }: PassbookLedgerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedScene, setSelectedScene] = useState<string | null>(null);
  
  // Modal states for deletes
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [showClearAllModal, setShowClearAllModal] = useState(false);

  // Audio Playback states for specific items
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioPlayersRef = useRef<{ [key: string]: HTMLAudioElement }>({});

  const handlePlayVoice = (id: string, voiceUrl: string) => {
    // If the same audio is playing, pause it
    if (playingAudioId === id) {
      audioPlayersRef.current[id]?.pause();
      setPlayingAudioId(null);
      return;
    }

    // Stop currently playing audio if any
    if (playingAudioId && audioPlayersRef.current[playingAudioId]) {
      audioPlayersRef.current[playingAudioId].pause();
    }

    // Create or reuse audio player
    if (!audioPlayersRef.current[id]) {
      audioPlayersRef.current[id] = new Audio(voiceUrl);
      audioPlayersRef.current[id].onended = () => {
        setPlayingAudioId(null);
      };
    }

    audioPlayersRef.current[id].play();
    setPlayingAudioId(id);
  };

  const filteredBooks = books.filter((book) =>
    book.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Reversing to show newest reading on top (like a real savings transaction log)
  const sortedBooks = [...filteredBooks].reverse();

  // Color mappings for stamp backgrounds in Natural Tones
  const stampColors = [
    'bg-[#E8F5E9] text-[#4E9F57] border-[#A8D5BA]',
    'bg-[#FFF9C4] text-[#8C7E6A] border-[#E6D5B8]',
    'bg-[#FFF3E0] text-[#FF8B3D] border-[#FFE0B2]',
    'bg-[#E0F2F1] text-[#00796B] border-[#80CBC4]',
    'bg-[#F5F5DC] text-[#5D5443] border-[#E6D5B8]'
  ];

  return (
    <div className="w-full bg-white rounded-[40px] border-4 border-[#E6D5B8] shadow-md p-6 sm:p-8">
      {/* Search and control header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b-2 border-stone-100">
        <h2 className="font-gaegu text-3xl font-extrabold text-[#5D5443] flex items-center gap-2">
          <BookOpen className="text-[#6BCB77]" size={28} /> 차곡차곡 모인 내 독서 통장
        </h2>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Search bar */}
          <div className="relative flex-1 sm:w-64">
            <span className="absolute inset-y-0 left-3 flex items-center text-[#A19582]">
              <Search size={18} />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="책 제목으로 찾기..."
              className="w-full pl-9 pr-4 py-2 text-sm border-2 border-[#E6D5B8] focus:border-[#6BCB77] outline-none rounded-xl bg-[#FDFCF0]/30 font-sans text-[#4A4439] transition-colors"
            />
          </div>

          {/* Clear all button */}
          {books.length > 0 && (
            <button
              onClick={() => setShowClearAllModal(true)}
              id="clear-all-btn"
              className="px-4 py-2 border-2 border-[#FF8B3D] text-[#FF8B3D] hover:bg-[#FFF3E0]/30 rounded-xl font-gaegu text-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <Trash2 size={16} /> 전체 지우기
            </button>
          )}
        </div>
      </div>

      {books.length === 0 ? (
        /* Empty ledger state */
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-24 h-24 bg-[#FDFCF0] border-4 border-dashed border-[#E6D5B8] rounded-full flex items-center justify-center text-[#A19582] mb-4 animate-pulse">
            <BookOpen size={48} />
          </div>
          <h3 className="font-gaegu text-2xl font-bold text-[#5D5443]">아직 저축한 책이 없어요!</h3>
          <p className="font-sans text-[#8C7E6A] text-sm mt-2 max-w-sm flex items-center justify-center gap-1 flex-wrap">
            <span>[책 저축하기] 탭으로 가서 오늘 읽은 책을 예쁘게 기록하고 통장에 저금해 보세요!</span>
            <Sprout size={14} className="text-[#6BCB77] inline shrink-0" />
          </p>
        </div>
      ) : (
        /* Reading records list */
        <div className="space-y-6">
          <AnimatePresence>
            {sortedBooks.map((book, idx) => {
              const stampStyle = stampColors[idx % stampColors.length];
              return (
                <motion.div
                  key={book.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: 'spring', damping: 20 }}
                  className="bg-[#FDFCF0]/20 hover:bg-[#FDFCF0]/50 border-3 border-[#E6D5B8] rounded-2xl p-4 sm:p-5 relative overflow-hidden flex flex-col md:flex-row gap-4 md:gap-6 transition-all shadow-sm hover:shadow-md"
                >
                  {/* Ledger Strip Line (natural clean leaf-green band) */}
                  <div className="absolute left-0 top-0 bottom-0 w-2 bg-[#6BCB77]" />

                  {/* Stamp & Count Indicator */}
                  <div className="flex md:flex-col items-center justify-between md:justify-center md:items-center gap-2 shrink-0 md:w-28 text-center pb-3 md:pb-0 border-b md:border-b-0 md:border-r border-dashed border-[#E6D5B8]">
                    <div className="flex items-center md:flex-col gap-2">
                      <div className={`w-14 h-14 rounded-full border-4 border-dashed flex flex-col items-center justify-center font-gaegu font-extrabold ${stampStyle} shadow-sm transform -rotate-6`}>
                        <span className="text-xs">참잘</span>
                        <span className="text-xs leading-none">했어요</span>
                      </div>
                      <div className="text-left md:text-center mt-1">
                        <span className="font-gaegu text-lg font-bold text-[#6BCB77] block">독서도장 쿵!</span>
                        <span className="font-sans text-[11px] text-[#A19582] block">{book.createdAt.split(' (')[0]}</span>
                      </div>
                    </div>
                    {/* Delete button */}
                    <button
                      onClick={() => setDeleteTargetId(book.id)}
                      id={`delete-book-btn-${book.id}`}
                      className="p-2 text-[#E6D5B8] hover:text-[#FF8B3D] hover:bg-[#FFF3E0]/20 rounded-lg transition-colors cursor-pointer md:mt-4 self-center"
                      title="이 기록 삭제하기"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Dual Images Section (Cover and Scene side-by-side or stacked on mobile) */}
                  <div className="flex flex-row md:flex-col gap-4 shrink-0 mx-auto md:mx-0 items-center justify-center">
                    {/* Cover Image Slot */}
                    <div className="flex flex-col items-center">
                      <div 
                        onClick={() => {
                          if (book.coverImage) setSelectedScene(book.coverImage);
                        }}
                        className={`w-20 h-28 sm:w-24 sm:h-32 bg-[#FDFCF0] rounded-xl overflow-hidden border-2 ${
                          book.coverImage ? 'border-[#E6D5B8] hover:border-[#6BCB77] cursor-pointer' : 'border-dashed border-stone-200'
                        } shadow-xs relative group flex items-center justify-center transition-all`}
                        title={book.coverImage ? "표지 사진 크게 보기" : "표지 사진 없음"}
                      >
                        {book.coverImage ? (
                          <>
                            <img 
                              src={book.coverImage} 
                              alt={book.title} 
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-white font-gaegu text-xs font-bold bg-black/60 px-1.5 py-0.5 rounded-md">크게 보기</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center p-2 text-center text-stone-300">
                            <BookOpen size={24} />
                            <span className="font-gaegu text-[10px] text-stone-400 mt-1 block leading-tight">표지 없음</span>
                          </div>
                        )}
                      </div>
                      <span className="font-gaegu text-[11px] sm:text-xs font-bold text-[#8C7E6A] mt-1 flex items-center gap-0.5 whitespace-nowrap">
                        <span>책 표지</span>
                        <span className="text-[10px]">📸</span>
                      </span>
                    </div>

                    {/* Scene / Drawing Image Slot (If exists) */}
                    {book.sceneImage && (
                      <div className="flex flex-col items-center">
                        <div 
                          onClick={() => setSelectedScene(book.sceneImage)}
                          className="w-20 h-28 sm:w-24 sm:h-32 bg-[#FDFCF0] rounded-xl overflow-hidden border-2 border-[#E6D5B8] hover:border-[#6BCB77] shadow-xs relative group flex items-center justify-center cursor-pointer transition-all"
                          title={book.sceneType === 'photo' ? "내가 찍은 사진 크게 보기" : "내가 그린 장면 크게 보기"}
                        >
                          <img 
                            src={book.sceneImage} 
                            alt={book.sceneType === 'photo' ? "내가 찍은 사진" : "내가 그린 그림"} 
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-white font-gaegu text-xs font-bold bg-black/60 px-1.5 py-0.5 rounded-md">크게 보기</span>
                          </div>
                        </div>
                        <span className="font-gaegu text-[11px] sm:text-xs font-bold text-[#8C7E6A] mt-1 flex items-center gap-0.5 whitespace-nowrap">
                          {book.sceneType === 'photo' ? (
                            <>
                              <span>내가 찍은 사진</span>
                              <span className="text-[10px]">📸</span>
                            </>
                          ) : book.sceneType === 'drawing' ? (
                            <>
                              <span>내가 그린 그림</span>
                              <span className="text-[10px]">🎨</span>
                            </>
                          ) : (
                            <>
                              <span>그린 그림/사진</span>
                              <span className="text-[10px]">🎨</span>
                            </>
                          )}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Transaction content / notebook sheet */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      {/* Title & Rating */}
                      <div className="flex flex-row items-center justify-between gap-2 flex-wrap mb-2">
                        <h3 className="font-gaegu text-2xl font-black text-[#5D5443] tracking-wide truncate flex-1 min-w-0">
                          {book.title}
                        </h3>
                        {/* Rating stars */}
                        <div className="flex items-center gap-0.5 shrink-0">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              size={18}
                              fill={star <= book.rating ? '#FFD93D' : 'none'}
                              stroke={star <= book.rating ? '#FF8B3D' : '#E6D5B8'}
                              strokeWidth={2}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Notebook lined notes style block */}
                      <div className="notebook-lines min-h-[4rem] p-3.5 bg-[#FDFCF0]/50 border border-[#E6D5B8] rounded-xl relative">
                        <div className="flex items-center gap-2.5 flex-wrap min-h-[2.5rem]">
                          <span className="px-2.5 py-1 rounded-lg bg-[#E8F5E9] text-[#4E9F57] font-gaegu text-lg font-bold shrink-0">
                            내 기분
                          </span>
                          <span className="font-gaegu text-xl font-bold flex items-center gap-1.5 text-[#4A4439]">
                            {getFeelingIcon(book.feeling)}
                            <span>{getFeelingTextOnly(book.feeling)}</span>
                          </span>
                        </div>
                        
                        {/* Voice recorded playback if available */}
                        {book.voiceRecord && (
                          <div className="mt-2.5 flex items-center gap-2.5 bg-[#FFFBF0] border-2 border-[#6BCB77]/30 hover:border-[#6BCB77] rounded-xl py-1.5 px-2.5 shadow-sm w-full max-w-[270px] sm:max-w-xs transition-all duration-200">
                            <button
                              onClick={() => handlePlayVoice(book.id, book.voiceRecord!)}
                              id={`play-voice-btn-${book.id}`}
                              className={`w-9 h-9 rounded-full shadow-xs shrink-0 ${
                                playingAudioId === book.id ? 'bg-[#FF8B3D] animate-pulse' : 'bg-[#6BCB77]'
                              } flex items-center justify-center text-white cursor-pointer transition-all duration-200 active:scale-95 hover:scale-105`}
                              title={playingAudioId === book.id ? "멈춤" : "소감 듣기"}
                            >
                              {playingAudioId === book.id ? (
                                <Pause size={14} className="text-white fill-current" />
                              ) : (
                                <Play size={14} className="text-white fill-current ml-0.5" />
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <span className="font-gaegu text-base font-extrabold text-[#5D5443] block leading-tight flex items-center gap-1">
                                <span>🎤 내 목소리 소감</span>
                                {playingAudioId === book.id && <span className="text-[10px] text-[#FF8B3D] font-sans animate-bounce font-normal">PLAYING</span>}
                              </span>
                              <span className="font-sans text-[10px] text-stone-400 block mt-0.5 leading-tight truncate">
                                {playingAudioId === book.id ? '귀여운 목소리를 들어봐요!' : '터치해서 소감을 들어보세요'}
                              </span>
                              {playingAudioId === book.id && (
                                <div className="flex items-center gap-0.5 mt-1 h-3">
                                  {Array.from({ length: 12 }).map((_, i) => (
                                    <span
                                      key={i}
                                      className="w-[2px] bg-[#FF8B3D] rounded-full inline-block"
                                      style={{
                                        height: `${Math.random() * 10 + 2}px`,
                                        animation: 'bounce 0.6s infinite alternate',
                                        animationDelay: `${i * 0.04}s`
                                      }}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Zoom Image Modal */}
      <AnimatePresence>
        {selectedScene && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedScene(null)}
              className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25 }}
              className="relative max-w-2xl bg-white border-4 border-[#E6D5B8] rounded-3xl p-3 shadow-2xl z-10"
            >
              <img 
                src={selectedScene} 
                alt="Memorable Scene Expanded" 
                referrerPolicy="no-referrer"
                className="max-h-[75vh] w-auto max-w-full rounded-2xl object-contain"
              />
              <button
                onClick={() => setSelectedScene(null)}
                className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-[#6BCB77] hover:bg-[#4E9F57] text-white flex items-center justify-center shadow-md border-2 border-white transition-colors font-bold cursor-pointer"
              >
                ✕
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Single Book Record Confirmation */}
      <CuteModal
        isOpen={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        title="기록을 지울까요?"
        type="confirm"
        confirmText="지울래요"
        cancelText="안 지울래요"
        onConfirm={() => {
          if (deleteTargetId) {
            onDeleteBook(deleteTargetId);
            setDeleteTargetId(null);
          }
        }}
      >
        선택한 책 저축 기록을 지우시겠습니까? 지운 기록은 돌릴 수 없어요!
      </CuteModal>

      {/* Clear All Records Confirmation */}
      <CuteModal
        isOpen={showClearAllModal}
        onClose={() => setShowClearAllModal(false)}
        title="통장을 싹 비울까요?"
        type="warning"
        confirmText="전부 지울래요"
        cancelText="안 지울래요"
        onConfirm={() => {
          onClearAll();
          setShowClearAllModal(false);
        }}
      >
        독서 통장의 모든 기록을 완전히 지우시겠습니까? <br />
        열심히 모은 {books.length}권의 보물이 사라져요!
      </CuteModal>
    </div>
  );
}
