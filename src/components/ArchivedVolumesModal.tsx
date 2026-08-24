import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PassbookVolume, BookRecord } from '../types';
import { Trophy, Award, BookOpen, Star, Heart, Sparkles, X, ChevronRight, ArrowLeft, Play, Pause, Smile, Calendar } from 'lucide-react';

interface ArchivedVolumesModalProps {
  isOpen: boolean;
  onClose: () => void;
  volumes: PassbookVolume[];
  currentVolume?: number;
}

const getFeelingIcon = (feelingText: string) => {
  const clean = feelingText.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF]/g, '').trim();
  if (clean.includes('감동')) return <Heart size={16} className="text-rose-500 fill-rose-200 shrink-0" />;
  if (clean.includes('또')) return <Sparkles size={16} className="text-[#4E9F57] fill-emerald-100 shrink-0" />;
  return <Smile size={16} className="text-amber-500 fill-amber-100 shrink-0" />;
};

export default function ArchivedVolumesModal({ isOpen, onClose, volumes, currentVolume }: ArchivedVolumesModalProps) {
  const [selectedVolume, setSelectedVolume] = useState<PassbookVolume | null>(null);
  const [viewingCertificate, setViewingCertificate] = useState(false);
  const [selectedScene, setSelectedScene] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const handlePlayVoice = (id: string, voiceUrl: string) => {
    if (playingAudioId === id) {
      audioElement?.pause();
      setPlayingAudioId(null);
      return;
    }
    if (audioElement) {
      audioElement.pause();
    }
    const audio = new Audio(voiceUrl);
    audio.onended = () => setPlayingAudioId(null);
    audio.play();
    setAudioElement(audio);
    setPlayingAudioId(id);
  };

  const handleClose = () => {
    if (audioElement) audioElement.pause();
    setSelectedVolume(null);
    setViewingCertificate(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200 }}
            className="relative w-full max-w-3xl bg-[#FFFDF0] rounded-[36px] border-4 border-[#E6D5B8] shadow-2xl z-10 overflow-hidden flex flex-col max-h-[88vh]"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-[#FFF3E0] via-[#FDFCF0] to-[#E8F5E9] p-5 sm:p-6 border-b-2 border-[#E6D5B8] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                {selectedVolume ? (
                  <button
                    onClick={() => {
                      if (audioElement) audioElement.pause();
                      setViewingCertificate(false);
                      setSelectedVolume(null);
                    }}
                    className="p-2 bg-white hover:bg-stone-100 rounded-full border border-[#E6D5B8] text-[#5D5443] transition-colors cursor-pointer flex items-center justify-center"
                    title="보관함 목록으로 돌아가기"
                  >
                    <ArrowLeft size={20} />
                  </button>
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-[#FFE0B2] border-2 border-[#FFB74D] flex items-center justify-center text-[#E65100] shadow-sm">
                    <Trophy size={26} />
                  </div>
                )}
                <div>
                  <h2 className="font-gaegu text-2xl sm:text-3xl font-black text-[#5D5443] flex items-center gap-2">
                    <span>{selectedVolume ? (viewingCertificate ? `${selectedVolume.title} 완독 상장` : selectedVolume.title) : '📚 완독 통장 명예의 전당'}</span>
                  </h2>
                  <p className="font-sans text-xs sm:text-sm text-[#8C7E6A] mt-0.5">
                    {selectedVolume 
                      ? `${selectedVolume.completedAt}에 완독한 총 ${selectedVolume.books.length}권의 소중한 기록`
                      : `30권씩 꽉 채워 완독한 소중한 역대 독서통장 보관함 (총 ${volumes.length}권 완독)`}
                  </p>
                </div>
              </div>

              <button
                onClick={handleClose}
                className="p-2 rounded-full hover:bg-[#E6D5B8]/30 text-[#A19582] hover:text-[#5D5443] transition-colors cursor-pointer"
                title="닫기"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
              {volumes.length === 0 ? (
                <div className="text-center py-12 flex flex-col items-center justify-center">
                  <div className="w-20 h-20 bg-[#FDFCF0] rounded-full border-3 border-dashed border-[#E6D5B8] flex items-center justify-center text-[#A19582] mb-3">
                    <BookOpen size={36} />
                  </div>
                  <h3 className="font-gaegu text-2xl font-bold text-[#5D5443]">아직 완독된 통장이 없어요</h3>
                  <p className="font-sans text-xs sm:text-sm text-[#8C7E6A] mt-1 max-w-sm">
                    책을 30권까지 차곡차곡 저축한 후 [새 통장 시작하기]를 누르면 여기에 영구 보관됩니다!
                  </p>
                </div>
              ) : selectedVolume === null ? (
                /* Volumes List View */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {volumes.map((vol) => (
                    <motion.div
                      key={vol.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedVolume(vol)}
                      className="bg-white rounded-3xl border-3 border-[#E6D5B8] hover:border-[#6BCB77] p-5 shadow-sm hover:shadow-md cursor-pointer transition-all flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="px-3 py-1 bg-[#E8F5E9] text-[#2E7D32] border border-[#A8D5BA] rounded-xl font-gaegu text-lg font-black flex items-center gap-1.5">
                            <Trophy size={16} className="text-[#FF8B3D]" />
                            <span>{vol.title}</span>
                          </span>
                          <span className="font-gaegu text-xl font-black text-[#E53935] bg-[#FFEBEE] px-2.5 py-0.5 rounded-lg border border-[#FFCDD2]">
                            {vol.books.length}권 완독 🍎
                          </span>
                        </div>

                        <div className="space-y-1 text-sm font-sans text-[#5D5443]">
                          <div className="flex items-center gap-1.5 text-xs text-[#8C7E6A]">
                            <Calendar size={13} className="text-[#6BCB77]" />
                            <span>완독일: {vol.completedAt}</span>
                          </div>
                          <div className="font-gaegu text-lg font-bold text-[#4E9F57] mt-2 truncate">
                            주인: {vol.ownerName} ({vol.ownerTitle})
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-dashed border-[#E6D5B8] flex items-center justify-between text-xs font-bold text-[#4E9F57] group-hover:text-[#2E7D32]">
                        <span>기록 및 상장 열어보기</span>
                        <ChevronRight size={18} className="transform group-hover:translate-x-1 transition-transform" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : viewingCertificate ? (
                /* Full Certificate View */
                <div className="border-4 border-dashed border-[#E6D5B8] rounded-3xl p-6 sm:p-8 bg-white text-center relative overflow-hidden">
                  <Trophy className="text-[#FF8B3D] w-16 h-16 mx-auto mb-3 animate-bounce" />
                  <h3 className="font-gaegu text-3xl sm:text-4xl font-black text-[#5D5443] tracking-wide">
                    {selectedVolume.title} 완독 명예상
                  </h3>
                  <div className="w-24 h-1 bg-[#E53935] mx-auto my-3" />
                  
                  <div className="font-gaegu text-2xl text-[#2E7D32] font-bold mb-3">
                    이름: {selectedVolume.ownerName} ({selectedVolume.ownerTitle}) 어린이
                  </div>

                  <p className="font-sans text-sm sm:text-base text-[#5D5443] leading-relaxed max-w-md mx-auto my-4 py-3 border-y border-[#E6D5B8]/50">
                    위 어린이는 슬기와 지혜를 가득 담아 <span className="font-black text-[#E53935]">{selectedVolume.title} ({selectedVolume.books.length}권)</span>을
                    성실하고 훌륭하게 모두 완독하여 저축하였으므로, 
                    그 눈부신 노력을 기리며 이 명예로운 완독 상장을 영구 수여합니다.
                  </p>

                  <div className="font-gaegu text-lg text-[#8C7E6A] mt-4">
                    완독일: {selectedVolume.completedAt}
                  </div>
                  <div className="font-gaegu text-xl font-bold text-[#5D5443] mt-1">
                    디지털 독서은행장 💮
                  </div>

                  <div className="mt-6 flex justify-center">
                    <button
                      onClick={() => setViewingCertificate(false)}
                      className="px-5 py-2 bg-[#6BCB77] hover:bg-[#4E9F57] text-white rounded-xl font-gaegu text-lg font-bold transition-colors cursor-pointer"
                    >
                      책 기록 목록 보기
                    </button>
                  </div>
                </div>
              ) : (
                /* Volume's 30-Book Ledger View */
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4 flex-wrap bg-[#E8F5E9]/60 p-3 rounded-2xl border border-[#A8D5BA]">
                    <span className="font-gaegu text-xl font-black text-[#2E7D32]">
                      📖 {selectedVolume.title} 저축 목록 ({selectedVolume.books.length}권)
                    </span>
                    <button
                      onClick={() => setViewingCertificate(true)}
                      className="px-3.5 py-1.5 bg-[#FF8B3D] hover:bg-[#E65100] text-white rounded-xl font-gaegu text-base font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                    >
                      <Award size={16} />
                      <span>완독 상장 보기</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {selectedVolume.books.map((book, idx) => (
                      <div
                        key={book.id || idx}
                        className="bg-white border-2 border-[#E6D5B8] rounded-2xl p-4 flex flex-col sm:flex-row gap-4 relative overflow-hidden shadow-xs"
                      >
                        <div className="flex sm:flex-col items-center justify-between sm:justify-center gap-2 shrink-0 sm:w-20 border-b sm:border-b-0 sm:border-r border-dashed border-[#E6D5B8] pb-2 sm:pb-0">
                          <span className="w-8 h-8 rounded-full bg-[#FFF3E0] border border-[#FFE0B2] text-[#FF8B3D] font-gaegu text-lg font-bold flex items-center justify-center">
                            #{idx + 1}
                          </span>
                          <span className="font-sans text-[11px] text-[#8C7E6A]">{book.createdAt.split(' (')[0]}</span>
                        </div>

                        {/* Images */}
                        <div className="flex gap-2 shrink-0 justify-center">
                          {book.coverImage && (
                            <div 
                              onClick={() => setSelectedScene(book.coverImage)}
                              className="w-16 h-22 rounded-lg overflow-hidden border border-[#E6D5B8] cursor-pointer hover:opacity-90"
                              title="표지 사진"
                            >
                              <img src={book.coverImage} alt={book.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                            </div>
                          )}
                          {book.sceneImage && (
                            <div 
                              onClick={() => setSelectedScene(book.sceneImage)}
                              className="w-16 h-22 rounded-lg overflow-hidden border border-[#E6D5B8] cursor-pointer hover:opacity-90"
                              title="장면 사진/그림"
                            >
                              <img src={book.sceneImage} alt={book.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-gaegu text-xl font-black text-[#5D5443] truncate">{book.title}</h4>
                            <div className="flex items-center gap-0.5 shrink-0">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star key={s} size={14} fill={s <= book.rating ? '#FFD93D' : 'none'} stroke={s <= book.rating ? '#FF8B3D' : '#E6D5B8'} />
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 mt-2 text-sm font-gaegu font-bold text-[#4A4439]">
                            {getFeelingIcon(book.feeling)}
                            <span>{book.feeling}</span>
                          </div>

                          {book.voiceRecord && (
                            <div className="mt-2 flex items-center gap-2 bg-[#FFFBF0] border border-[#6BCB77]/40 rounded-xl p-1.5 max-w-[220px]">
                              <button
                                onClick={() => handlePlayVoice(book.id, book.voiceRecord!)}
                                className="w-7 h-7 rounded-full bg-[#6BCB77] text-white flex items-center justify-center cursor-pointer shrink-0"
                              >
                                {playingAudioId === book.id ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" className="ml-0.5" />}
                              </button>
                              <span className="font-gaegu text-xs font-bold text-[#5D5443]">목소리 소감 듣기</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Zoom Image Modal */}
          <AnimatePresence>
            {selectedScene && (
              <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setSelectedScene(null)}
                  className="fixed inset-0 bg-stone-900/70 backdrop-blur-sm"
                />
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="relative max-w-2xl bg-white border-4 border-[#E6D5B8] rounded-3xl p-3 shadow-2xl z-10"
                >
                  <img src={selectedScene} alt="Zoomed" referrerPolicy="no-referrer" className="max-h-[75vh] w-auto max-w-full rounded-2xl object-contain" />
                  <button
                    onClick={() => setSelectedScene(null)}
                    className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-[#6BCB77] text-white flex items-center justify-center shadow-md border-2 border-white font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}
    </AnimatePresence>
  );
}
