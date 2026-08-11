import { useState, useEffect, useRef } from 'react';
import { BookRecord, ActiveTab } from './types';
import { loadBooksFromStorage, saveBooksToStorage, safeStorage, loadBooksFromIDB, loadMergedLocalBooks, getDeletedBookIds, addDeletedBookId, clearDeletedBookId } from './utils/helpers';
import PassbookHeader from './components/PassbookHeader';
import BookDepositForm from './components/BookDepositForm';
import PassbookLedger from './components/PassbookLedger';
import CelebrationModal from './components/CelebrationModal';
import CuteModal from './components/CuteModal';
import SyncModal from './components/SyncModal';
import { Sparkles, Star, Heart } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function App() {
  // Reading records states
  const [books, setBooks] = useState<BookRecord[]>([]);
  const booksRef = useRef<BookRecord[]>([]);

  // Keep booksRef always synced with live memory books
  useEffect(() => {
    booksRef.current = books;
  }, [books]);

  const [ownerName, setOwnerName] = useState<string>('이가연');
  const [ownerTitle, setOwnerTitle] = useState<string>('반짝반짝');
  const [activeTab, setActiveTab] = useState<ActiveTab>('deposit');

  // Milestone Celebration States
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationBookCount, setCelebrationBookCount] = useState(0);

  // Sync states
  const [syncCode, setSyncCode] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Custom alert states
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  const mergeBookRecords = (a: BookRecord, b: BookRecord): BookRecord => {
    return {
      ...a,
      ...b,
      // Retain richest properties across device states
      sceneImage: b.sceneImage || a.sceneImage || null,
      voiceRecord: b.voiceRecord || a.voiceRecord || null,
      coverImage: b.coverImage || a.coverImage || null,
      feeling: b.feeling || a.feeling || '',
      rating: b.rating || a.rating || 5,
    };
  };

  // Helper to merge local, memory and cloud books safely without duplicates or data loss
  const mergeBooks = (cloudBooks: BookRecord[], localBooks: BookRecord[], memoryBooks: BookRecord[] = []): BookRecord[] => {
    const deletedIds = getDeletedBookIds();
    const map = new Map<string, BookRecord>();

    const processBook = (b: BookRecord) => {
      if (!b || !b.id || deletedIds.includes(b.id)) return;
      if (map.has(b.id)) {
        const existing = map.get(b.id)!;
        map.set(b.id, mergeBookRecords(existing, b));
      } else {
        map.set(b.id, b);
      }
    };

    (cloudBooks || []).forEach(processBook);
    (localBooks || []).forEach(processBook);
    (memoryBooks || []).forEach(processBook);

    return Array.from(map.values());
  };

  // Helper to fetch latest data from cloud with lossless merging
  const fetchLatestFromCloud = async (silent = true) => {
    const activeEmail = safeStorage.getItem('digital_reading_user_email') || userEmail;
    const activeCode = safeStorage.getItem('digital_reading_sync_code') || syncCode;

    if (activeEmail) {
      try {
        const res = await fetch(`/api/auth/user/${encodeURIComponent(activeEmail.trim().toLowerCase())}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            const cloudBooks: BookRecord[] = data.books || [];
            const currentLocalBooks = await loadMergedLocalBooks();
            const memoryBooks = booksRef.current;
            const mergedBooks = mergeBooks(cloudBooks, currentLocalBooks, memoryBooks);

            setBooks(mergedBooks);
            setOwnerName(data.ownerName || '이가연');
            setOwnerTitle(data.ownerTitle || '반짝반짝');

            saveBooksToStorage(mergedBooks);
            safeStorage.setItem('digital_reading_owner_name', data.ownerName || '이가연');
            safeStorage.setItem('digital_reading_owner_title', data.ownerTitle || '반짝반짝');

            // If local device had new unsynced books, sync merged state back to cloud immediately
            if (mergedBooks.length > cloudBooks.length || (cloudBooks.length > 0 && mergedBooks.length < cloudBooks.length)) {
              triggerAutoSync(activeEmail, activeCode, mergedBooks, data.ownerName || ownerName, data.ownerTitle || ownerTitle);
            }

            if (!silent) {
              showCustomAlert('동기화 완료 ☁️', '최신 구름 데이터를 성공적으로 가져왔어요!', 'success');
            }
          }
        }
      } catch (e) {
        if (!silent) console.warn('Cloud fetch failed:', e);
      }
    } else if (activeCode) {
      try {
        const res = await fetch(`/api/sync/load/${encodeURIComponent(activeCode.trim().toUpperCase())}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            const cloudBooks: BookRecord[] = data.books || [];
            const currentLocalBooks = await loadMergedLocalBooks();
            const memoryBooks = booksRef.current;
            const mergedBooks = mergeBooks(cloudBooks, currentLocalBooks, memoryBooks);

            setBooks(mergedBooks);
            setOwnerName(data.ownerName || '이가연');
            setOwnerTitle(data.ownerTitle || '반짝반짝');

            saveBooksToStorage(mergedBooks);
            safeStorage.setItem('digital_reading_owner_name', data.ownerName || '이가연');
            safeStorage.setItem('digital_reading_owner_title', data.ownerTitle || '반짝반짝');

            // Sync back to server if local had additional items
            if (mergedBooks.length > cloudBooks.length || (cloudBooks.length > 0 && mergedBooks.length < cloudBooks.length)) {
              triggerAutoSync(activeEmail, activeCode, mergedBooks, data.ownerName || ownerName, data.ownerTitle || ownerTitle);
            }

            if (!silent) {
              showCustomAlert('동기화 완료 🔄', '최신 동기화 데이터를 불러왔어요!', 'success');
            }
          }
        }
      } catch (e) {
        if (!silent) console.warn('Sync code fetch failed:', e);
      }
    }
  };

  // Load books, owner name & sync code from storage on mount + Cloud fetch
  useEffect(() => {
    const initStorage = async () => {
      const mergedInitial = await loadMergedLocalBooks();

      setBooks(mergedInitial);
      saveBooksToStorage(mergedInitial);

      const storedName = safeStorage.getItem('digital_reading_owner_name');
      const storedTitle = safeStorage.getItem('digital_reading_owner_title');
      if (storedName) {
        setOwnerName(storedName);
      }
      if (storedTitle) {
        setOwnerTitle(storedTitle);
      }

      const storedSyncCode = safeStorage.getItem('digital_reading_sync_code');
      if (storedSyncCode) {
        setSyncCode(storedSyncCode);
      }

      const storedEmail = safeStorage.getItem('digital_reading_user_email');
      if (storedEmail) {
        setUserEmail(storedEmail);
      }

      // Initial cloud fetch on launch
      fetchLatestFromCloud(true);
    };

    initStorage();
  }, []);

  // Periodic cloud poll + fetch on tab focus / visibility change / pageshow / popstate (back navigation defense)
  useEffect(() => {
    const handleFocus = async () => {
      // 1. Instantly merge disk, IndexedDB & in-memory state on navigation/focus to prevent UI drops
      const currentLocal = await loadMergedLocalBooks();
      const currentMemory = booksRef.current;
      const merged = mergeBooks([], currentLocal, currentMemory);
      setBooks(merged);

      // 2. Fetch latest from cloud with lossless 3-way merging
      fetchLatestFromCloud(true);
    };

    const handleFlushState = () => {
      if (booksRef.current && booksRef.current.length > 0) {
        saveBooksToStorage(booksRef.current);
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('pageshow', handleFocus);
    window.addEventListener('popstate', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    window.addEventListener('pagehide', handleFlushState);
    window.addEventListener('beforeunload', handleFlushState);

    // Poll every 10 seconds if logged in or using sync code
    const interval = setInterval(() => {
      fetchLatestFromCloud(true);
    }, 10000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pageshow', handleFocus);
      window.removeEventListener('popstate', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('pagehide', handleFlushState);
      window.removeEventListener('beforeunload', handleFlushState);
      clearInterval(interval);
    };
  }, [userEmail, syncCode]);

  // Sync helper to push updates to the backend
  const triggerAutoSync = (
    email: string | null,
    code: string | null,
    currentBooks: BookRecord[],
    currentName: string,
    currentTitle: string,
    isClearAll = false
  ) => {
    const deletedIds = getDeletedBookIds();
    // 1. Account sync (prioritized, no manual button needed!)
    if (email) {
      fetch('/api/auth/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          books: currentBooks,
          deletedIds,
          ownerName: currentName,
          ownerTitle: currentTitle,
          isClearAll
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          console.log('[Sync] Cloud auto-saved successfully.');
        }
      })
      .catch(err => {
        console.warn('[Sync] Cloud auto-save failed:', err);
      });
    }

    // 2. Legacy code sync (backward compatibility)
    if (code) {
      fetch('/api/sync/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          syncCode: code.trim().toUpperCase(),
          books: currentBooks,
          deletedIds,
          ownerName: currentName,
          ownerTitle: currentTitle,
          isClearAll
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          console.log('[Sync] Legacy auto-saved successfully to server.');
        } else {
          console.warn('[Sync] Legacy auto-save failed:', data.error);
        }
      })
      .catch(err => {
        console.warn('[Sync] Legacy auto-save failed due to network error:', err);
      });
    }
  };

  // Sync action handlers
  const handleCreateSyncCode = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/sync/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ books, ownerName, ownerTitle })
      });
      const data = await res.json();
      if (data.success && data.syncCode) {
        setSyncCode(data.syncCode);
        safeStorage.setItem('digital_reading_sync_code', data.syncCode);
        showCustomAlert('동기화 완료 🔄', `새로운 동기화 코드가 만들어졌어요!\n코드: ${data.syncCode}`, 'success');
      } else {
        showCustomAlert('실패', '동기화 코드를 만들지 못했어요. 잠시 후 다시 시도해 주세요.', 'warning');
      }
    } catch (e) {
      showCustomAlert('오류', '네트워크 연결을 확인해 주세요.', 'warning');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConnectSyncCode = async (code: string) => {
    if (!code.trim()) {
      showCustomAlert('입력 필요', '동기화 코드를 입력해 주세요!', 'warning');
      return;
    }
    setIsSyncing(true);
    const upperInput = code.trim().toUpperCase();
    try {
      const res = await fetch(`/api/sync/load/${upperInput}`);
      if (!res.ok) {
        const errData = await res.json();
        showCustomAlert('연동 실패 ❌', errData.error || '존재하지 않는 코드예요. 다시 한 번 확인해 주세요.', 'warning');
        return;
      }
      const data = await res.json();
      if (data.success) {
        const currentLocalBooks = await loadMergedLocalBooks();
        const mergedBooks = mergeBooks(data.books || [], currentLocalBooks);

        setBooks(mergedBooks);
        setOwnerName(data.ownerName || ownerName);
        setOwnerTitle(data.ownerTitle || ownerTitle);
        setSyncCode(upperInput);

        saveBooksToStorage(mergedBooks);
        safeStorage.setItem('digital_reading_owner_name', data.ownerName || ownerName);
        safeStorage.setItem('digital_reading_owner_title', data.ownerTitle || ownerTitle);
        safeStorage.setItem('digital_reading_sync_code', upperInput);

        // Sync back merged state
        triggerAutoSync(userEmail, upperInput, mergedBooks, data.ownerName || ownerName, data.ownerTitle || ownerTitle);

        setIsSyncModalOpen(false);
        showCustomAlert('연동 성공! 🎉', `[${data.ownerName}] 책통장의 기록을 성공적으로 가져와 연동했어요!`, 'success');
      }
    } catch (e) {
      showCustomAlert('오류', '네트워크 연결을 확인해 주세요.', 'warning');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnectSync = () => {
    setSyncCode(null);
    safeStorage.removeItem('digital_reading_sync_code');
    showCustomAlert('연동 해제 완료', '기기 동기화를 해제했어요. 기기에 저장된 기록은 유지됩니다.', 'info');
  };

  // Account integration handlers
  const handleRegisterAccount = async (email: string, pass: string) => {
    setIsSyncing(true);
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password: pass.trim(), ownerName, ownerTitle, books })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUserEmail(data.email);
        safeStorage.setItem('digital_reading_user_email', data.email);
        setIsSyncModalOpen(false);
        showCustomAlert('계정 생성 완료 🎉', `[${data.email}] 계정이 만들어지고 실시간 자동 구름 동기화가 활성화되었어요!`, 'success');
      } else {
        showCustomAlert('가입 실패', data.error || '계정을 만들지 못했어요. 다시 확인해 주세요.', 'warning');
      }
    } catch (e) {
      showCustomAlert('오류', '네트워크 연결을 확인해 주세요.', 'warning');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLoginAccount = async (email: string, pass: string) => {
    setIsSyncing(true);
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password: pass.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUserEmail(data.email);

        // Merge any local offline books on this device with cloud books
        const currentLocalBooks = await loadMergedLocalBooks();
        const mergedBooks = mergeBooks(data.books || [], currentLocalBooks);

        const finalName = data.ownerName || ownerName;
        const finalTitle = data.ownerTitle || ownerTitle;

        setBooks(mergedBooks);
        setOwnerName(finalName);
        setOwnerTitle(finalTitle);

        saveBooksToStorage(mergedBooks);
        safeStorage.setItem('digital_reading_owner_name', finalName);
        safeStorage.setItem('digital_reading_owner_title', finalTitle);
        safeStorage.setItem('digital_reading_user_email', data.email);

        // Immediately sync merged books back to cloud server
        triggerAutoSync(data.email, syncCode, mergedBooks, finalName, finalTitle);

        setIsSyncModalOpen(false);
        showCustomAlert('로그인 성공! 🎉', `[${finalName}] 책통장의 모든 기록을 안전하게 불러와 연동했어요!`, 'success');
      } else {
        showCustomAlert('로그인 실패 ❌', data.error || '이메일 또는 비밀번호를 다시 확인해 주세요.', 'warning');
      }
    } catch (e) {
      showCustomAlert('오류', '네트워크 연결을 확인해 주세요.', 'warning');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogoutAccount = () => {
    setUserEmail(null);
    safeStorage.removeItem('digital_reading_user_email');
    showCustomAlert('로그아웃 완료', '안전하게 로그아웃 되었어요. 이 기기에서의 기록은 그대로 유지됩니다.', 'info');
  };

  // Sync owner info to storage
  const handleUpdateOwnerInfo = (name: string, title: string) => {
    setOwnerName(name);
    setOwnerTitle(title);
    safeStorage.setItem('digital_reading_owner_name', name);
    safeStorage.setItem('digital_reading_owner_title', title);
    triggerAutoSync(userEmail, syncCode, books, name, title);
  };

  // Trigger alert helper instead of default browser alert
  const showCustomAlert = (title: string, message: string, type: 'success' | 'warning' | 'info' = 'info') => {
    setAlertConfig({
      isOpen: true,
      title,
      message,
      type
    });
  };

  // Add new book to ledger
  const handleAddBook = (newBook: BookRecord) => {
    clearDeletedBookId(newBook.id);
    const updatedBooks = [newBook, ...books.filter(b => b.id !== newBook.id)];
    setBooks(updatedBooks);
    saveBooksToStorage(updatedBooks);
    triggerAutoSync(userEmail, syncCode, updatedBooks, ownerName, ownerTitle);

    // Direct transition to ledger view
    setActiveTab('ledger');

    // Trigger Success alert
    showCustomAlert('참 잘했어요!', `와아! [${newBook.title}] 책 저축에 성공했어요!`, 'success');

    // Mega Confetti & Certificate Milestone logic
    const targetCount = updatedBooks.length;

    // Trigger celebration when count hits any multiple of 10 books! (10, 20, 30, 40, etc.)
    if (targetCount > 0 && targetCount % 10 === 0) {
      setCelebrationBookCount(targetCount);

      // Trigger Mega Confetti explosion!
      setTimeout(() => {
        const duration = 4 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

        const randomInRange = (min: number, max: number) => {
          return Math.random() * (max - min) + min;
        };

        const interval: NodeJS.Timeout = setInterval(() => {
          const timeLeft = animationEnd - Date.now();

          if (timeLeft <= 0) {
            return clearInterval(interval);
          }

          const particleCount = 50 * (timeLeft / duration);
          // since particles fall down, animate them slightly higher than random
          confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
          confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 250);

        // Open certificate modal
        setShowCelebration(true);
      }, 800);
    }
  };

  // Delete individual book
  const handleDeleteBook = (id: string) => {
    addDeletedBookId(id);
    const updatedBooks = books.filter((b) => b.id !== id);
    setBooks(updatedBooks);
    saveBooksToStorage(updatedBooks);
    triggerAutoSync(userEmail, syncCode, updatedBooks, ownerName, ownerTitle);
    showCustomAlert('삭제 완료', '기록을 통장에서 안전하게 지웠어요.', 'info');
  };

  // Clear all book records
  const handleClearAll = () => {
    books.forEach(b => addDeletedBookId(b.id));
    setBooks([]);
    saveBooksToStorage([]);
    triggerAutoSync(userEmail, syncCode, [], ownerName, ownerTitle, true);
    showCustomAlert('초기화 완료', '독서 통장이 새 주인을 기다려요! 기록이 모두 비워졌습니다.', 'warning');
  };

  return (
    <div className="min-h-screen dot-pattern py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Passbook Header and Tab switcher */}
        <PassbookHeader
          bookCount={books.length}
          ownerName={ownerName}
          ownerTitle={ownerTitle}
          onUpdateOwnerInfo={handleUpdateOwnerInfo}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          syncCode={syncCode}
          onOpenSync={() => setIsSyncModalOpen(true)}
          userEmail={userEmail}
        />

        {/* Tab Content with animations */}
        <main className="pb-12">
          {activeTab === 'deposit' ? (
            <BookDepositForm onAddBook={handleAddBook} />
          ) : (
            <PassbookLedger
              books={books}
              onDeleteBook={handleDeleteBook}
              onClearAll={handleClearAll}
            />
          )}
        </main>

        {/* Cute footer design constraint mapping */}
        <footer className="text-center font-gaegu text-[#A19582] py-6 border-t border-dashed border-[#E6D5B8] flex flex-col items-center gap-1.5">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 font-bold text-base min-[360px]:text-lg sm:text-xl md:text-2xl">
            <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
              <Heart className="text-[#FF8B3D] fill-current shrink-0 w-5 h-5 sm:w-6 sm:h-6" />
              <span>생각이 자라나는 사랑 가득</span>
            </div>
            <span className="whitespace-nowrap">디지털 독서통장</span>
          </div>
          <p className="font-sans text-xs sm:text-sm text-[#5D5443] tracking-wider font-semibold mt-1">
            Copyright © YeoniT. All rights reserved.
          </p>
        </footer>
      </div>

      {/* 10-Book Milestone Certificate celebration Modal */}
      <CelebrationModal
        isOpen={showCelebration}
        onClose={() => setShowCelebration(false)}
        ownerName={`${ownerName} (${ownerTitle})`}
        bookCount={celebrationBookCount}
      />

      {/* Reusable Cute Custom Modal for General Alert/Message */}
      <CuteModal
        isOpen={alertConfig.isOpen}
        onClose={() => setAlertConfig((prev) => ({ ...prev, isOpen: false }))}
        title={alertConfig.title}
        type={alertConfig.type}
      >
        {alertConfig.message}
      </CuteModal>

      {/* Sync / Device link Modal */}
      <SyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        syncCode={syncCode}
        onCreateSyncCode={handleCreateSyncCode}
        onConnectSyncCode={handleConnectSyncCode}
        onDisconnectSync={handleDisconnectSync}
        isSyncing={isSyncing}
        userEmail={userEmail}
        onRegister={handleRegisterAccount}
        onLogin={handleLoginAccount}
        onLogout={handleLogoutAccount}
        onManualSync={() => fetchLatestFromCloud(false)}
      />
    </div>
  );
}
