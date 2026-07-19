import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, RefreshCw, Copy, Check, Link, ArrowRight, Trash2, Cloud, Mail, Lock, LogOut } from 'lucide-react';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncCode: string | null;
  onCreateSyncCode: () => Promise<void>;
  onConnectSyncCode: (code: string) => Promise<void>;
  onDisconnectSync: () => void;
  isSyncing: boolean;
  
  // Account synchronization additions
  userEmail: string | null;
  onRegister: (email: string, pass: string) => Promise<void>;
  onLogin: (email: string, pass: string) => Promise<void>;
  onLogout: () => void;
}

export default function SyncModal({
  isOpen,
  onClose,
  syncCode,
  onCreateSyncCode,
  onConnectSyncCode,
  onDisconnectSync,
  isSyncing,
  userEmail,
  onRegister,
  onLogin,
  onLogout
}: SyncModalProps) {
  // Mode selection: 'email' (new) or 'legacy' (old code sync)
  const [syncMethod, setSyncMethod] = useState<'email' | 'legacy'>('email');
  
  // Email Auth states
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Legacy states
  const [codeInput, setCodeInput] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (syncCode) {
      navigator.clipboard.writeText(syncCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLegacyConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeInput.trim()) return;
    await onConnectSyncCode(codeInput);
    setCodeInput('');
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    
    if (authMode === 'login') {
      await onLogin(email.trim(), password.trim());
    } else {
      await onRegister(email.trim(), password.trim());
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
            {/* Top decorative gradient border */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#A8D5BA] via-[#6BCB77] to-[#FF8B3D]" />

            {/* Close button */}
            <button
              onClick={onClose}
              id="sync-modal-close-btn"
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-[#FDFCF0] text-[#A19582] hover:text-[#5D5443] transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            {/* Modal Content */}
            <div className="mt-3">
              
              {userEmail ? (
                /* ☁️ Successfully Logged In & Auto-Syncing State */
                <div className="space-y-4">
                  <div className="flex justify-center mb-1">
                    <div className="w-16 h-16 rounded-full bg-[#E8F5E9] border-2 border-[#A8D5BA] flex items-center justify-center text-[#4E9F57]">
                      <Cloud size={36} className="animate-pulse" />
                    </div>
                  </div>

                  <h3 className="font-gaegu text-2xl font-black text-center text-[#4E9F57] tracking-wide">
                    실시간 구름 동기화 중 ☁️
                  </h3>
                  
                  <div className="bg-[#E8F5E9]/50 border-2 border-dashed border-[#A8D5BA] p-4 rounded-2xl text-center">
                    <span className="font-sans text-xs text-[#5D5443] font-semibold block mb-1">연결된 계정</span>
                    <span className="font-mono text-lg font-bold text-stone-700 block">{userEmail}</span>
                    <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-[#4E9F57] font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#6BCB77] animate-ping" />
                      <span>연동 버튼 없이 자동으로 실시간 저장 중이에요</span>
                    </div>
                  </div>

                  <div className="bg-[#FDFCF0] border border-[#E6D5B8] p-4 rounded-2xl text-xs text-stone-600 space-y-1.5 leading-relaxed">
                    <p className="font-bold text-[#FF8B3D] mb-1">💡 다른 폰이나 태블릿에서 사용하기:</p>
                    <p>1. 연동하려는 기기에서 똑같이 이 앱을 켭니다.</p>
                    <p>2. 오른쪽 위 [구름 연동] 또는 [기기 연동] 버튼을 누릅니다.</p>
                    <p>3. 위 계정(<strong className="text-stone-800">{userEmail}</strong>)으로 로그인하시면 통장의 모든 저축 내역이 마법처럼 그대로 나타나요!</p>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <span className="text-[11px] font-sans text-stone-400">안전하게 기기를 관리해 보세요</span>
                    <button
                      onClick={onLogout}
                      className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-gaegu text-base font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-rose-100"
                    >
                      <LogOut size={15} /> 계정 로그아웃
                    </button>
                  </div>
                </div>
              ) : (
                /* 🔒 Disconnected State: Show Sync Methods */
                <div>
                  {/* Method Tab Switcher */}
                  <div className="flex bg-[#F5F5F5] p-1 rounded-2xl border border-stone-200 mb-4 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setSyncMethod('email')}
                      className={`flex-1 py-2 rounded-xl transition-all cursor-pointer ${
                        syncMethod === 'email'
                          ? 'bg-white text-[#4E9F57] shadow-sm font-extrabold'
                          : 'text-[#A19582] hover:text-[#5D5443]'
                      }`}
                    >
                      ☁️ 이메일 계정 연동 (추천)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSyncMethod('legacy')}
                      className={`flex-1 py-2 rounded-xl transition-all cursor-pointer ${
                        syncMethod === 'legacy'
                          ? 'bg-white text-[#2b72c4] shadow-sm font-extrabold'
                          : 'text-[#A19582] hover:text-[#5D5443]'
                      }`}
                    >
                      🔄 1회성 기기코드 연동
                    </button>
                  </div>

                  {syncMethod === 'email' ? (
                    /* ☁️ METHOD 1: EMAIL AUTO-SYNC (No Linking Buttons Needed!) */
                    <div className="space-y-4">
                      <div className="text-center">
                        <h3 className="font-gaegu text-2xl font-black text-[#5D5443] tracking-wide">
                          계정 자동 동기화 ☁️
                        </h3>
                        <p className="font-sans text-[11px] sm:text-xs text-stone-500 mt-1 max-w-[340px] mx-auto leading-relaxed">
                          한 번만 가입해 두면, 스마트폰이나 태블릿 어디서든 <strong>기기연동 버튼을 누를 필요 없이</strong> 실시간으로 자동 동기화되어 저장됩니다!
                        </p>
                      </div>

                      {/* Auth Mode Toggle */}
                      <div className="flex border-b border-stone-100 font-sans text-sm font-bold text-stone-400">
                        <button
                          type="button"
                          onClick={() => setAuthMode('login')}
                          className={`flex-1 pb-2 border-b-2 transition-all cursor-pointer ${
                            authMode === 'login' ? 'border-[#6BCB77] text-[#4E9F57]' : 'border-transparent hover:text-stone-600'
                          }`}
                        >
                          기존 계정으로 로그인
                        </button>
                        <button
                          type="button"
                          onClick={() => setAuthMode('register')}
                          className={`flex-1 pb-2 border-b-2 transition-all cursor-pointer ${
                            authMode === 'register' ? 'border-[#6BCB77] text-[#4E9F57]' : 'border-transparent hover:text-stone-600'
                          }`}
                        >
                          새로운 클라우드 계정 만들기
                        </button>
                      </div>

                      {/* Credentials Form */}
                      <form onSubmit={handleAuthSubmit} className="space-y-3 font-sans">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-stone-600 flex items-center gap-1">
                            <Mail size={13} className="text-[#6BCB77]" /> 이메일 주소
                          </label>
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="user@example.com"
                            className="w-full px-4 py-2.5 border-2 border-[#E6D5B8] rounded-2xl outline-none focus:border-[#6BCB77] bg-stone-50/30 font-medium text-stone-700 text-sm"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-stone-600 flex items-center gap-1">
                            <Lock size={13} className="text-[#6BCB77]" /> 비밀번호
                          </label>
                          <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="6자리 이상의 비밀번호"
                            minLength={6}
                            className="w-full px-4 py-2.5 border-2 border-[#E6D5B8] rounded-2xl outline-none focus:border-[#6BCB77] bg-stone-50/30 font-medium text-stone-700 text-sm"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={isSyncing}
                          className="w-full py-3.5 mt-2 bg-[#6BCB77] hover:bg-[#4E9F57] disabled:opacity-50 text-white font-gaegu text-xl font-bold rounded-2xl shadow-[0_3px_0_#4E9F57] hover:shadow-none hover:translate-y-[3px] transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {isSyncing ? (
                            <RefreshCw size={18} className="animate-spin" />
                          ) : authMode === 'login' ? (
                            '구름 계정 로그인 & 연동 ☁️'
                          ) : (
                            '새로운 구름 계정 만들기 🌟'
                          )}
                        </button>
                      </form>
                    </div>
                  ) : (
                    /* 🔄 METHOD 2: LEGACY 6-DIGIT CODE SYNC */
                    <div className="space-y-4">
                      <div className="text-center">
                        <h3 className="font-gaegu text-2xl font-black text-[#5D5443] tracking-wide">
                          기기 연동 코드로 연결 🔄
                        </h3>
                        <p className="font-sans text-[11px] sm:text-xs text-stone-500 mt-1 max-w-[340px] mx-auto leading-relaxed">
                          계정 가입 없이 일회용 난수 코드로 기기를 연동합니다. 연동 시 기기 간 책 저장 내역이 일시 동기화됩니다.
                        </p>
                      </div>

                      {syncCode ? (
                        /* Connected State */
                        <div className="space-y-4">
                          <div className="bg-[#E8F5E9] border-2 border-[#A8D5BA] p-4 rounded-2xl text-center">
                            <span className="font-sans text-xs text-[#4E9F57] font-semibold block mb-1">나의 동기화 코드</span>
                            <div className="flex items-center justify-center gap-2">
                              <span className="font-mono text-3xl font-extrabold text-[#2b72c4] tracking-wider select-all">{syncCode}</span>
                              <button
                                onClick={handleCopy}
                                className="p-1.5 bg-white text-stone-600 rounded-lg hover:bg-stone-50 border border-stone-200 transition-colors cursor-pointer"
                                title="코드 복사하기"
                              >
                                {copied ? <Check size={16} className="text-[#6BCB77]" /> : <Copy size={16} />}
                              </button>
                            </div>
                            {copied && <span className="text-[11px] font-sans text-[#4E9F57] block mt-1">클립보드에 복사되었어요!</span>}
                          </div>

                          <div className="flex justify-end">
                            <button
                              onClick={onDisconnectSync}
                              className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-gaegu text-base font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-rose-100"
                            >
                              <Trash2 size={15} /> 연동 코드 해제
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Setup Flow */
                        <div className="space-y-4">
                          <div className="bg-gradient-to-br from-[#E1F5FE] to-white border-2 border-[#B3E5FC]/60 p-4 rounded-2xl text-center">
                            <p className="font-sans text-xs text-sky-600 font-semibold mb-2">이 기기의 기록으로 시작하고 싶다면</p>
                            <button
                              onClick={onCreateSyncCode}
                              disabled={isSyncing}
                              className="w-full py-3 bg-[#2b72c4] hover:bg-[#1f599c] disabled:opacity-50 text-white font-gaegu text-xl font-bold rounded-2xl shadow-[0_3px_0_#1f599c] hover:shadow-none hover:translate-y-[3px] transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <Link size={18} /> 기기 동기화 코드 만들기 🌟
                            </button>
                          </div>

                          <div className="flex items-center gap-2 text-stone-300 my-2">
                            <span className="flex-1 h-[1px] bg-stone-200"></span>
                            <span className="text-[11px] font-sans font-medium text-stone-400">또는</span>
                            <span className="flex-1 h-[1px] bg-stone-200"></span>
                          </div>

                          <form onSubmit={handleLegacyConnect} className="space-y-2.5 font-sans">
                            <label className="text-xs font-semibold text-stone-600 block">
                              다른 기기에서 만든 동기화 코드가 있다면 여기에 입력해 주세요:
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={codeInput}
                                onChange={(e) => setCodeInput(e.target.value)}
                                placeholder="예: AB82DK"
                                maxLength={10}
                                className="flex-1 px-4 py-2.5 border-2 border-[#E6D5B8] rounded-2xl focus:border-[#2b72c4] outline-none font-mono text-center text-lg font-bold uppercase text-stone-700 bg-stone-50/50"
                              />
                              <button
                                type="submit"
                                disabled={isSyncing || !codeInput.trim()}
                                className="px-4 bg-[#2b72c4] hover:bg-[#1f599c] disabled:opacity-50 text-white font-gaegu text-base font-bold rounded-2xl shadow-[0_3px_0_#1f599c] hover:shadow-none hover:translate-y-[3px] transition-all flex items-center justify-center gap-1 cursor-pointer"
                              >
                                가져오기 <ArrowRight size={16} />
                              </button>
                            </div>
                          </form>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )}

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
