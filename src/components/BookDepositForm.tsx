import React, { useState, useRef, useEffect } from 'react';
import { BookRecord } from '../types';
import { compressAndConvertToBase64, getKoreanFriendlyDate } from '../utils/helpers';
import { Camera, Star, Mic, Square, Play, Pause, Image as ImageIcon, Smile, ArrowRight, Trash2, Book, Heart, Sparkles, Sprout, Palette, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import WhiteboardModal from './WhiteboardModal';

interface BookDepositFormProps {
  onAddBook: (book: BookRecord) => void;
}

export default function BookDepositForm({ onAddBook }: BookDepositFormProps) {
  // Form States
  const [title, setTitle] = useState('');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [feeling, setFeeling] = useState<string>('재밌어요');

  // Audio Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Memorable Scene State
  const [sceneImage, setSceneImage] = useState<string | null>(null);
  const [sceneType, setSceneType] = useState<'drawing' | 'photo' | undefined>(undefined);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const sceneInputRef = useRef<HTMLInputElement>(null);
  const sceneCameraInputRef = useRef<HTMLInputElement>(null);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (playbackAudioRef.current) {
        playbackAudioRef.current.pause();
      }
    };
  }, []);

  // Handle Book Cover Upload
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await compressAndConvertToBase64(file);
        setCoverImage(base64);
      } catch (err) {
        console.error('Image upload failed', err);
      }
    }
  };

  // Handle Scene Image Upload
  const handleSceneUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await compressAndConvertToBase64(file);
        setSceneImage(base64);
        setSceneType('photo');
      } catch (err) {
        console.error('Scene image upload failed', err);
      }
    }
  };

  // Star Click Handler with Sparkle Confetti
  const handleStarClick = (score: number) => {
    setRating(score);
    // Light confetti burst
    confetti({
      particleCount: 20,
      angle: 60,
      spread: 55,
      origin: { x: 0.3, y: 0.8 },
      colors: ['#ff8fa3', '#fde047', '#a5b4fc']
    });
    confetti({
      particleCount: 20,
      angle: 120,
      spread: 55,
      origin: { x: 0.7, y: 0.8 },
      colors: ['#ff8fa3', '#fde047', '#a5b4fc']
    });
  };

  // Audio Recording Helpers
  const startRecording = async () => {
    audioChunksRef.current = [];
    setRecordingSeconds(0);
    setAudioUrl(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      let options = {};
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/webm')) {
          options = { mimeType: 'audio/webm' };
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options = { mimeType: 'audio/mp4' };
        } else if (MediaRecorder.isTypeSupported('audio/aac')) {
          options = { mimeType: 'audio/aac' };
        }
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        
        // Convert Blob to Base64 to save in storage safely
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          setAudioUrl(base64Audio);
        };

        // Stop all audio tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Start 20-seconds countdown limit timer to fit inside LocalStorage!
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 19) { // 20 seconds limit
            stopRecording();
            return 20;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err) {
      console.warn('Microphone permission denied or unsupported', err);
      alert('마이크 사용 권한을 허용해 주시면 귀여운 목소리를 녹음할 수 있어요! 마이크가 없는 환경이면 한글 소감을 적어주셔도 좋아요.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
  };

  const playRecordedAudio = () => {
    if (audioUrl) {
      if (playbackAudioRef.current) {
        playbackAudioRef.current.pause();
      }
      const audio = new Audio(audioUrl);
      playbackAudioRef.current = audio;
      setIsPlayingAudio(true);
      audio.play();
      audio.onended = () => {
        setIsPlayingAudio(false);
      };
    }
  };

  const deleteRecordedAudio = () => {
    setAudioUrl(null);
    setIsPlayingAudio(false);
    if (playbackAudioRef.current) {
      playbackAudioRef.current.pause();
    }
  };

  // Submit Form Handler
  const handleFormSubmit = () => {
    if (!title.trim()) {
      alert('어떤 책을 읽었는지 이름을 적어주세요!');
      return;
    }

    const newBook: BookRecord = {
      id: `book_${Date.now()}`,
      title: title.trim(),
      coverImage: coverImage, // Can be base64 uploaded or dynamic preset
      rating,
      feeling,
      voiceRecord: audioUrl,
      sceneImage: sceneImage,
      sceneType: sceneType,
      createdAt: getKoreanFriendlyDate()
    };

    onAddBook(newBook);

    // Reset Form
    setTitle('');
    setCoverImage(null);
    setRating(5);
    setFeeling('재밌어요');
    setAudioUrl(null);
    setSceneImage(null);
    setSceneType(undefined);
  };

  return (
    <div className="w-full bg-white rounded-[40px] border-4 border-[#E6D5B8] shadow-md p-6 sm:p-8 relative">
      {/* Decorative leaf sprout pattern background inside */}
      <div className="absolute top-4 right-4 text-[#A8D5BA] pointer-events-none opacity-20 w-16 h-16">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className="w-full h-full fill-none stroke-current" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 54 Q32 42 42 16" />
          <path d="M22 41 C12 35, 14 23, 24 31 Z" fill="currentColor" />
          <path d="M32 29 C24 18, 32 10, 38 21 Z" fill="currentColor" />
          <path d="M42 16 C48 8, 52 16, 44 22 Z" fill="currentColor" />
        </svg>
      </div>

      <h2 className="font-gaegu text-3xl font-extrabold text-[#5D5443] mb-6 flex items-center gap-2 border-b-2 border-dashed border-[#E6D5B8] pb-3">
        <Sparkles className="text-[#FF8B3D]" size={28} /> 차곡차곡 책 저축하기
      </h2>

      <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
        {/* Question 1: 어떤 책을 읽었나요? */}
        <div className="space-y-3">
          <label className="block font-gaegu text-2xl font-bold text-[#4A4439]">
            1. 어떤 책을 읽었나요?
          </label>
          
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="책 제목을 적어주세요 (예: 아기돼지 삼형제)"
            className="w-full px-5 py-4 rounded-2xl border-3 border-[#E6D5B8] outline-none focus:border-[#6BCB77] font-sans text-[#4A4439] bg-[#FDFCF0]/30 transition-colors placeholder-stone-400 text-base"
          />

          {/* Book Cover Setup */}
          <div className="mt-5 flex flex-col items-center justify-center gap-5 w-full">
            {/* Cover Preview Card */}
            <div 
              onClick={() => cameraInputRef.current?.click()}
              className="w-44 aspect-[3/4] rounded-3xl border-4 border-dashed border-[#A8D5BA] hover:border-[#6BCB77] bg-[#FDFCF0]/30 flex flex-col items-center justify-center p-4 text-center cursor-pointer overflow-hidden transition-all relative group shadow-sm hover:shadow"
            >
              {coverImage ? (
                <img 
                  src={coverImage} 
                  alt="Book Cover" 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover rounded-2xl"
                />
              ) : (
                <div className="flex flex-col items-center text-[#A19582] group-hover:text-[#6BCB77] p-2">
                  <Book size={36} className="mb-2 text-[#6BCB77]" />
                  <span className="font-gaegu text-xl font-bold text-[#4E9F57] leading-tight">책 표지</span>
                </div>
              )}
              {coverImage && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-white font-gaegu text-lg font-bold">다시 찍기</span>
                </div>
              )}
            </div>

            {/* Responsive Action buttons */}
            <div className="flex flex-row flex-wrap items-center justify-center gap-3 w-full max-w-md">
              {/* 1. Camera Take Button */}
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="px-5 py-2.5 bg-[#6BCB77] hover:bg-[#4E9F57] text-white font-gaegu text-lg font-bold rounded-xl shadow-sm hover:-translate-y-0.5 transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Camera size={18} />
                <span>카메라</span>
              </button>

              {/* 2. Photo Album Choose Button */}
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="px-5 py-2.5 bg-white hover:bg-[#FDFCF0] border-2 border-[#E6D5B8] hover:border-[#6BCB77] text-[#5D5443] font-gaegu text-lg font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <ImageIcon size={18} className="text-[#A19582]" />
                <span>사진첩</span>
              </button>

              {/* 3. Delete Cover Button (if image exists) */}
              {coverImage && (
                <button
                  type="button"
                  onClick={() => setCoverImage(null)}
                  className="px-5 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 font-gaegu text-lg font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap"
                >
                  <Trash2 size={16} />
                  <span>지우기</span>
                </button>
              )}
            </div>
          </div>

            {/* Hidden Inputs */}
            {/* 1. Direct Camera Capture Input */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleCoverUpload}
              className="hidden"
            />
            {/* 2. File Explorer Selector */}
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={handleCoverUpload}
              className="hidden"
            />
        </div>

        {/* Question 2: 별점을 주세요! */}
        <div className="space-y-3">
          <label className="block font-gaegu text-2xl font-bold text-[#4A4439]">
            2. 별점을 주세요!
          </label>
          <div className="flex flex-col items-start gap-2">
            <div className="flex items-center gap-1 sm:gap-2">
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  key={score}
                  type="button"
                  onClick={() => handleStarClick(score)}
                  onMouseEnter={() => setHoverRating(score)}
                  onMouseLeave={() => setHoverRating(null)}
                  className="p-1 text-stone-200 hover:scale-110 active:scale-95 transition-all cursor-pointer"
                >
                  <Star
                    size={40}
                    fill={score <= (hoverRating ?? rating) ? '#FFD93D' : 'none'}
                    stroke={score <= (hoverRating ?? rating) ? '#FF8B3D' : '#E6D5B8'}
                    strokeWidth={2}
                  />
                </button>
              ))}
            </div>
            <span className="font-gaegu text-2xl font-bold text-[#FF8B3D] pl-1 whitespace-nowrap min-h-[36px] flex items-center">
              {rating === 5 ? '정말 최고예요!' : rating === 4 ? '재미있어요!' : rating === 3 ? '보통이에요!' : rating === 2 ? '조금 아쉬워요' : '내 스타일이 아니에요'}
            </span>
          </div>
        </div>

        {/* Question 3: 책을 읽고 어떤 기분이 들었나요? */}
        <div className="space-y-3">
          <label className="block font-gaegu text-2xl font-bold text-[#4A4439]">
            3. 책을 읽고 어떤 기분이 들었나요?
          </label>
          <div className="flex flex-col gap-3 w-full">
            {[
              { 
                text: '재밌어요', 
                id: '재밌어요', 
                icon: <Smile size={28} className="text-amber-500 fill-amber-100 shrink-0" />, 
                selectedClass: 'bg-amber-50 border-4 border-amber-400 text-amber-900 shadow-md scale-[1.02] ring-2 ring-amber-300/30',
                normalClass: 'bg-white/40 border-2 border-[#E6D5B8] text-stone-600 hover:bg-amber-50/20 hover:border-amber-200'
              },
              { 
                text: '감동이에요', 
                id: '감동이에요', 
                icon: <Heart size={28} className="text-rose-500 fill-rose-100 shrink-0" />, 
                selectedClass: 'bg-rose-50 border-4 border-rose-400 text-rose-900 shadow-md scale-[1.02] ring-2 ring-rose-300/30',
                normalClass: 'bg-white/40 border-2 border-[#E6D5B8] text-stone-600 hover:bg-rose-50/20 hover:border-rose-200'
              },
              { 
                text: '또 읽고 싶어요', 
                id: '또 읽고 싶어요', 
                icon: <Sparkles size={28} className="text-emerald-500 fill-emerald-100 shrink-0" />, 
                selectedClass: 'bg-emerald-50 border-4 border-emerald-400 text-emerald-900 shadow-md scale-[1.02] ring-2 ring-emerald-300/30',
                normalClass: 'bg-white/40 border-2 border-[#E6D5B8] text-stone-600 hover:bg-emerald-50/20 hover:border-emerald-200'
              }
            ].map((btn) => {
              const isSelected = feeling === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setFeeling(btn.id)}
                  className={`w-full py-4 px-6 rounded-2xl ${
                    isSelected ? btn.selectedClass : btn.normalClass
                  } font-gaegu text-2xl font-bold flex items-center justify-center gap-2 transition-all cursor-pointer`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`transition-transform duration-300 ${isSelected ? 'scale-110 rotate-3' : ''}`}>
                      {btn.icon}
                    </div>
                    <span>{btn.text}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Question 4: 소감 녹음하기 */}
        <div className="space-y-3">
          <label className="block font-gaegu text-[20px] min-[360px]:text-2xl font-bold text-[#4A4439] whitespace-nowrap overflow-hidden text-ellipsis">
            4. 소감 녹음하기
          </label>
          <div className="p-5 bg-[#FDFCF0]/30 rounded-2xl border-2 border-[#E6D5B8] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 w-full text-center sm:text-left">
              <div className={`w-12 h-12 rounded-full ${isRecording ? 'bg-rose-500 animate-ping' : 'bg-[#A8D5BA]/30'} flex items-center justify-center text-[#4E9F57] shrink-0 mx-auto sm:mx-0`}>
                <Mic size={24} className={isRecording ? 'text-white' : 'text-[#4E9F57]'} />
              </div>
              <div className="flex-1 w-full">
                <h4 className="font-gaegu text-xl font-bold text-[#4A4439]">책을 읽은 느낌 말하기</h4>
                <p className="text-xs text-[#A19582] font-sans leading-relaxed">
                  녹음시간 (최대 20초)
                </p>
                <div className="mt-2 bg-white/60 border border-dashed border-[#E6D5B8] p-2.5 rounded-xl text-[11px] text-stone-600 font-sans space-y-1 text-left">
                  <p className="font-bold text-[#6BCB77] mb-1 flex items-center gap-1 justify-center sm:justify-start">
                    <Sparkles size={12} className="text-[#FF8B3D]" /> 느낌 말하기 예시
                  </p>
                  <p className="text-stone-700 leading-normal">• "아기 돼지 삼형제가 지혜롭게 늑대를 물리쳐서 정말 흥미진진했어요!"</p>
                  <p className="text-stone-700 leading-normal">• "토끼가 거북이처럼 끝까지 포기하지 않고 열심히 달리는 모습이 멋졌어요!"</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!audioUrl ? (
                !isRecording ? (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-[#6BCB77] hover:bg-[#4E9F57] text-white rounded-xl font-gaegu text-lg font-bold shadow-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Mic size={18} />
                    <span>녹음 시작</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-gaegu text-lg font-bold shadow-sm animate-pulse transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Square size={18} />
                    <span>녹음 멈춤 ({recordingSeconds}초)</span>
                  </button>
                )
              ) : (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={playRecordedAudio}
                    className={`flex items-center gap-1.5 px-4 py-2.5 ${isPlayingAudio ? 'bg-[#4E9F57]' : 'bg-[#6BCB77] hover:bg-[#4E9F57]'} text-white rounded-xl font-gaegu text-lg font-bold shadow-sm transition-colors cursor-pointer whitespace-nowrap shrink-0`}
                  >
                    {isPlayingAudio ? <Square size={18} /> : <Play size={18} />}
                    <span>{isPlayingAudio ? '재생 중' : '내 목소리 듣기'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={deleteRecordedAudio}
                    className="p-2.5 bg-stone-200 hover:bg-stone-300 text-stone-600 rounded-xl transition-colors cursor-pointer shrink-0"
                    title="지우기"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Question 5: 기억에 남는 장면이 있나요? */}
        <div className="space-y-3">
          <label className="block font-gaegu text-2xl font-bold text-[#4A4439] leading-tight">
            5. 기억에 남는 장면이 <br className="sm:hidden" /> 있나요?
          </label>
          <div className="flex flex-col items-center justify-center gap-5 w-full text-center">
            {/* Scene Image Card container */}
            <div 
              onClick={() => setIsWhiteboardOpen(true)}
              className="w-full max-w-sm aspect-video rounded-3xl border-4 border-dashed border-[#E6D5B8] hover:border-[#6BCB77] bg-[#FDFCF0]/30 flex flex-col items-center justify-center p-3 text-center cursor-pointer overflow-hidden transition-all relative group shadow-sm hover:shadow"
            >
              {sceneImage ? (
                <img 
                  src={sceneImage} 
                  alt="Memorable Scene" 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover rounded-2xl"
                />
              ) : (
                <div className="flex flex-col items-center text-[#A19582] group-hover:text-[#6BCB77]">
                  <span className="text-3xl mb-1.5 animate-bounce">🎨</span>
                  <span className="font-gaegu text-lg font-bold text-[#5D5443]">장면 그리기 / 사진</span>
                  <span className="text-[10px] text-[#A19582] font-sans mt-0.5">터치해서 그림 그리기</span>
                </div>
              )}
              {sceneImage && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-white font-gaegu text-base font-bold">다시 그리기 / 수정</span>
                </div>
              )}
            </div>

            {/* Quick buttons and description */}
            <div className="w-full flex flex-col items-center gap-3">
              <div className="flex flex-row flex-wrap justify-center items-center gap-2 w-full">
                {/* Direct Drawing Button */}
                <button
                  type="button"
                  onClick={() => setIsWhiteboardOpen(true)}
                  className="px-4 py-2.5 bg-[#FFF3E0] hover:bg-[#FFE0B2] border-2 border-[#FFB74D] text-[#E65100] font-gaegu text-lg font-bold rounded-xl shadow-sm hover:-translate-y-0.5 transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <Palette size={18} />
                  <span>직접 그리기</span>
                </button>

                {/* Direct Camera Button */}
                <button
                  type="button"
                  onClick={() => sceneCameraInputRef.current?.click()}
                  className="px-4 py-2.5 bg-[#6BCB77] hover:bg-[#4E9F57] text-white font-gaegu text-lg font-bold rounded-xl shadow-sm hover:-translate-y-0.5 transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <Camera size={18} />
                  <span>카메라</span>
                </button>

                {/* Photo Library Button */}
                <button
                  type="button"
                  onClick={() => sceneInputRef.current?.click()}
                  className="px-4 py-2.5 bg-white hover:bg-[#FDFCF0] border-2 border-[#E6D5B8] text-[#5D5443] font-gaegu text-lg font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <ImageIcon size={18} className="text-[#A19582]" />
                  <span>사진첩</span>
                </button>
              </div>

              <p className="text-xs text-[#A19582] font-sans leading-relaxed max-w-md mx-auto">
                화이트보드에 기억에 남는 장면을 직접 그리거나, 책 속의 한 장면을 카메라로 찍어요!
              </p>
            </div>
          </div>

          {/* Hidden inputs for scene */}
          <input
            ref={sceneCameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleSceneUpload}
            className="hidden"
          />
          <input
            ref={sceneInputRef}
            type="file"
            accept="image/*"
            onChange={handleSceneUpload}
            className="hidden"
          />
        </div>

        {/* Whiteboard Modal for drawing */}
        <WhiteboardModal
          isOpen={isWhiteboardOpen}
          onClose={() => setIsWhiteboardOpen(false)}
          onSave={(img) => {
            setSceneImage(img);
            setSceneType('drawing');
          }}
          initialImage={sceneImage}
        />

        {/* Submit Save Button */}
        <div className="pt-4 border-t-2 border-dashed border-[#E6D5B8] flex justify-end">
          <button
            type="button"
            onClick={handleFormSubmit}
            id="save-book-btn"
            className="w-full sm:w-auto px-10 py-5 bg-[#6BCB77] text-white font-gaegu text-3xl font-extrabold rounded-3xl shadow-[0_5px_0_#4E9F57] hover:shadow-none hover:translate-y-1 active:scale-95 transition-all flex items-center justify-center gap-3 cursor-pointer"
          >
            <Book size={28} /> 책통장에 저축하기! <ArrowRight size={28} />
          </button>
        </div>
      </form>
    </div>
  );
}
