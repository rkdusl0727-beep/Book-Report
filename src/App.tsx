import { useState, useEffect, useRef } from 'react';
import { BookRecord, ActiveTab, PassbookVolume } from './types';
import {
  loadBooksFromStorage,
  saveBooksToStorage,
  safeStorage,
  loadBooksFromIDB,
  loadMergedLocalBooks,
  getDeletedBookIds,
  addDeletedBookId,
  clearDeletedBookId,
  getOrCreateDeviceId,
  loadMergedLocalVolumes,
  saveVolumesToStorage,
  archiveCurrentPassbook,
  getCurrentVolumeNumber,
  setCurrentVolumeNumber,
  exportPassbookBackupJSON
} from './utils/helpers';
import PassbookHeader from './components/PassbookHeader';
import BookDepositForm from './components/BookDepositForm';
import PassbookLedger from './components/PassbookLedger';
import CelebrationModal from './components/CelebrationModal';
import CuteModal from './components/CuteModal';
import SyncModal from './components/SyncModal';
import ArchivedVolumesModal from './components/ArchivedVolumesModal';
import { Sparkles, Star, Heart, Trophy } from 'lucide-react';
import confetti from 'canvas-confetti';

// Backend base URL. Empty string means "same origin as the frontend" (the default: a
// single server serving both, or local dev via the Vite proxy). Set VITE_API_BASE_URL
// at build time when the frontend and backend are deployed to different origins — e.g.
// the client on Netlify talking to the API on Render — so every /api/* call below goes
// to the right place.
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const apiUrl = (path: string) => `${API_BASE}${path}`;

export default function App() {
  // Reading records states
  const [books, setBooks] = useState<BookRecord[]>([]);
  const booksRef = useRef<BookRecord[]>([]);

  // Keep booksRef always synced with live memory books
  useEffect(() => {
    booksRef.current = books;
  }, [books]);

  // Volume / Multi-passbook archival states
  const [volumes, setVolumes] = useState<PassbookVolume[]>([]);
  const volumesRef = useRef<PassbookVolume[]>([]);
  const [currentVolume, setCurrentVolume] = useState<number>(1);
  const currentVolumeRef = useRef<number>(1);

  useEffect(() => {
    volumesRef.current = volumes;
  }, [volumes]);

  useEffect(() => {
    currentVolumeRef.current = currentVolume;
  }, [currentVolume]);

  const [ownerName, setOwnerName] = useState<string>('이가연');
  const [ownerTitle, setOwnerTitle] = useState<string>('반짝반짝');
  const ownerNameRef = useRef<string>('이가연');
  const ownerTitleRef = useRef<string>('반짝반짝');
  const [activeTab, setActiveTab] = useState<ActiveTab>('deposit');

  // Keep owner refs synced so long-lived closures (e.g. the pagehide/beforeunload flush
  // below, which only rebinds when userEmail/syncCode change) never read a stale name.
  useEffect(() => {
    ownerNameRef.current = ownerName;
  }, [ownerName]);

  useEffect(() => {
    ownerTitleRef.current = ownerTitle;
  }, [ownerTitle]);

  // Modal states
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationBookCount, setCelebrationBookCount] = useState(0);
  const [isArchivedModalOpen, setIsArchivedModalOpen] = useState(false);
  const [showResetVolumeModal, setShowResetVolumeModal] = useState(false);

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
      volumeNumber: b.volumeNumber || a.volumeNumber || currentVolumeRef.current || 1,
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

  // Helper to merge volumes safely across cloud, local, and in-memory stores
  const mergeVolumes = (cloudVolumes: PassbookVolume[], localVolumes: PassbookVolume[], memoryVolumes: PassbookVolume[] = []): PassbookVolume[] => {
    const map = new Map<string, PassbookVolume>();

    const processVol = (v: PassbookVolume) => {
      if (!v || !v.id) return;
      if (map.has(v.id)) {
        const existing = map.get(v.id)!;
        map.set(v.id, {
          ...existing,
          ...v,
          books: (v.books && v.books.length >= (existing.books?.length || 0)) ? v.books : existing.books
        });
      } else {
        map.set(v.id, v);
      }
    };

    (cloudVolumes || []).forEach(processVol);
    (localVolumes || []).forEach(processVol);
    (memoryVolumes || []).forEach(processVol);

    return Array.from(map.values()).sort((a, b) => (a.volumeNumber || 1) - (b.volumeNumber || 1));
  };

  // When an incoming snapshot (cloud pull, sync-code connect, account login, or a restored
  // backup file) reports an OLDER currentVolume than this device already has, its `books`
  // describe a passbook this device already archived into [완독 보관함] — merging them into
  // the active ledger would resurrect books the user intentionally closed out (this is the
  // exact scenario that used to let an archived passbook silently reappear after a sync).
  // We must also never silently drop a book that only exists in that incoming snapshot, so
  // instead of discarding it we fold anything missing into the archived volume it actually
  // belongs to, leaving the active books/current volume completely untouched.
  const reconcileStaleSnapshotBooks = (
    incomingBooks: BookRecord[],
    incomingVolNum: number,
    volumes: PassbookVolume[]
  ): PassbookVolume[] => {
    if (!incomingBooks || incomingBooks.length === 0) return volumes;
    const idx = volumes.findIndex(v => v.volumeNumber === incomingVolNum);
    if (idx === -1) return volumes; // no local archived volume to fold these into (shouldn't normally happen)

    const target = volumes[idx];
    const existingIds = new Set((target.books || []).map(b => b && b.id));
    const missing = incomingBooks.filter(b => b && b.id && !existingIds.has(b.id));
    if (missing.length === 0) return volumes;

    const updated = [...volumes];
    updated[idx] = { ...target, books: [...(target.books || []), ...missing] };
    return updated;
  };

  // Shared merge entry point for every place we pull in an outside snapshot of books/volumes
  // (cloud poll, sync-code connect, account login, backup restore). Applies the stale-volume
  // guard above uniformly so an archived passbook can never be re-opened by an out-of-date
  // sync — the ledger can keep accumulating indefinitely past 30 books, and no past record,
  // active or archived, is ever silently lost.
  const mergeIncomingSnapshot = (
    incomingBooks: BookRecord[],
    incomingVolumes: PassbookVolume[],
    incomingVolNum: number,
    currentLocalBooks: BookRecord[],
    currentLocalVolumes: PassbookVolume[],
    memoryBooks: BookRecord[] = [],
    memoryVolumes: PassbookVolume[] = []
  ): { mergedBooks: BookRecord[]; mergedVolumes: PassbookVolume[] } => {
    const isStale = incomingVolNum < currentVolumeRef.current;
    const mergedBooks = mergeBooks(isStale ? [] : incomingBooks, currentLocalBooks, memoryBooks);
    let mergedVolumes = mergeVolumes(incomingVolumes, currentLocalVolumes, memoryVolumes);
    if (isStale) {
      mergedVolumes = reconcileStaleSnapshotBooks(incomingBooks, incomingVolNum, mergedVolumes);
    }
    return { mergedBooks, mergedVolumes };
  };

  // Helper to fetch latest data from cloud with lossless merging
  const fetchLatestFromCloud = async (silent = true) => {
    const activeEmail = safeStorage.getItem('digital_reading_user_email') || userEmail;
    const activeCode = safeStorage.getItem('digital_reading_sync_code') || syncCode;
    const deviceId = getOrCreateDeviceId();

    // 1. Account Sync
    if (activeEmail) {
      try {
        const res = await fetch(apiUrl(`/api/auth/user/${encodeURIComponent(activeEmail.trim().toLowerCase())}`));
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            const cloudBooks: BookRecord[] = data.books || [];
            const cloudVolumes: PassbookVolume[] = data.volumes || [];
            const currentLocalBooks = await loadMergedLocalBooks();
            const currentLocalVolumes = await loadMergedLocalVolumes();
            const memoryBooks = booksRef.current;
            const memoryVolumes = volumesRef.current;

            const { mergedBooks, mergedVolumes } = mergeIncomingSnapshot(
              cloudBooks, cloudVolumes, data.currentVolume || 1, currentLocalBooks, currentLocalVolumes, memoryBooks, memoryVolumes
            );
            const nextVol = Math.max(data.currentVolume || 1, currentVolumeRef.current, getCurrentVolumeNumber());

            setBooks(mergedBooks);
            setVolumes(mergedVolumes);
            setCurrentVolume(nextVol);
            setOwnerName(data.ownerName || '이가연');
            setOwnerTitle(data.ownerTitle || '반짝반짝');

            saveBooksToStorage(mergedBooks);
            saveVolumesToStorage(mergedVolumes);
            setCurrentVolumeNumber(nextVol);
            safeStorage.setItem('digital_reading_owner_name', data.ownerName || '이가연');
            safeStorage.setItem('digital_reading_owner_title', data.ownerTitle || '반짝반짝');

            if (mergedBooks.length > cloudBooks.length || mergedVolumes.length > cloudVolumes.length) {
              triggerAutoSync(activeEmail, activeCode, mergedBooks, data.ownerName || ownerName, data.ownerTitle || ownerTitle, false, mergedVolumes, nextVol);
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
      // 2. Code Sync
      try {
        const res = await fetch(apiUrl(`/api/sync/load/${encodeURIComponent(activeCode.trim().toUpperCase())}`));
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            const cloudBooks: BookRecord[] = data.books || [];
            const cloudVolumes: PassbookVolume[] = data.volumes || [];
            const currentLocalBooks = await loadMergedLocalBooks();
            const currentLocalVolumes = await loadMergedLocalVolumes();
            const memoryBooks = booksRef.current;
            const memoryVolumes = volumesRef.current;

            const { mergedBooks, mergedVolumes } = mergeIncomingSnapshot(
              cloudBooks, cloudVolumes, data.currentVolume || 1, currentLocalBooks, currentLocalVolumes, memoryBooks, memoryVolumes
            );
            const nextVol = Math.max(data.currentVolume || 1, currentVolumeRef.current, getCurrentVolumeNumber());

            setBooks(mergedBooks);
            setVolumes(mergedVolumes);
            setCurrentVolume(nextVol);
            setOwnerName(data.ownerName || '이가연');
            setOwnerTitle(data.ownerTitle || '반짝반짝');

            saveBooksToStorage(mergedBooks);
            saveVolumesToStorage(mergedVolumes);
            setCurrentVolumeNumber(nextVol);
            safeStorage.setItem('digital_reading_owner_name', data.ownerName || '이가연');
            safeStorage.setItem('digital_reading_owner_title', data.ownerTitle || '반짝반짝');

            if (mergedBooks.length > cloudBooks.length || mergedVolumes.length > cloudVolumes.length) {
              triggerAutoSync(activeEmail, activeCode, mergedBooks, data.ownerName || ownerName, data.ownerTitle || ownerTitle, false, mergedVolumes, nextVol);
            }

            if (!silent) {
              showCustomAlert('동기화 완료 🔄', '최신 동기화 데이터를 불러왔어요!', 'success');
            }
          }
        }
      } catch (e) {
        if (!silent) console.warn('Sync code fetch failed:', e);
      }
    } else {
      // 3. Anonymous Device Cloud Auto-Backup (Ensures 100% data preservation even without login)
      try {
        const res = await fetch(apiUrl(`/api/device/load/${encodeURIComponent(deviceId)}`));
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            const cloudBooks: BookRecord[] = data.books || [];
            const cloudVolumes: PassbookVolume[] = data.volumes || [];
            const currentLocalBooks = await loadMergedLocalBooks();
            const currentLocalVolumes = await loadMergedLocalVolumes();
            const memoryBooks = booksRef.current;
            const memoryVolumes = volumesRef.current;

            const { mergedBooks, mergedVolumes } = mergeIncomingSnapshot(
              cloudBooks, cloudVolumes, data.currentVolume || 1, currentLocalBooks, currentLocalVolumes, memoryBooks, memoryVolumes
            );
            const nextVol = Math.max(data.currentVolume || 1, currentVolumeRef.current, getCurrentVolumeNumber());

            if (mergedBooks.length > 0) {
              setBooks(mergedBooks);
              saveBooksToStorage(mergedBooks);
            }
            if (mergedVolumes.length > 0) {
              setVolumes(mergedVolumes);
              saveVolumesToStorage(mergedVolumes);
            }
            setCurrentVolume(nextVol);
            setCurrentVolumeNumber(nextVol);

            if (data.ownerName && !safeStorage.getItem('digital_reading_owner_name')) {
              setOwnerName(data.ownerName);
            }
            if (data.ownerTitle && !safeStorage.getItem('digital_reading_owner_title')) {
              setOwnerTitle(data.ownerTitle);
            }

            if (mergedBooks.length > cloudBooks.length || mergedVolumes.length > cloudVolumes.length) {
              triggerAutoSync(activeEmail, activeCode, mergedBooks, data.ownerName || ownerName, data.ownerTitle || ownerTitle, false, mergedVolumes, nextVol);
            }
          }
        }
      } catch (e) {
        console.warn('Anonymous device cloud load failed:', e);
      }
    }
  };

  // Load books, volumes, owner name & sync code from storage on mount + Cloud fetch
  useEffect(() => {
    const initStorage = async () => {
      const mergedInitialBooks = await loadMergedLocalBooks();
      const mergedInitialVolumes = await loadMergedLocalVolumes();
      const currentVolNum = getCurrentVolumeNumber();

      if (mergedInitialBooks.length > 0) {
        setBooks(mergedInitialBooks);
        booksRef.current = mergedInitialBooks;
        saveBooksToStorage(mergedInitialBooks);
      }

      if (mergedInitialVolumes.length > 0) {
        setVolumes(mergedInitialVolumes);
        volumesRef.current = mergedInitialVolumes;
        saveVolumesToStorage(mergedInitialVolumes);
      }

      // Sync the ref immediately (not just the state) — fetchLatestFromCloud below runs
      // later in this very same tick, before React has a chance to flush the `useEffect`
      // that normally keeps currentVolumeRef in sync with `currentVolume`. Without this,
      // the very first cloud fetch on app launch could see a stale ref stuck at the
      // default `1` and wrongly treat an already-archived volume's cloud data as current.
      setCurrentVolume(currentVolNum);
      currentVolumeRef.current = currentVolNum;

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

      // Initial cloud fetch & sync on launch
      await fetchLatestFromCloud(true);
    };

    initStorage();
  }, []);

  // Periodic cloud poll + fetch on tab focus / visibility change / pageshow / popstate (back navigation defense)
  useEffect(() => {
    // Phones/tablets often fire several of these events almost simultaneously on a single
    // "came back to the tab" moment (focus + visibilitychange + pageshow all at once).
    // Each run is async (IndexedDB + a network fetch), so without this guard, overlapping
    // runs could resolve out of order and the run based on an older `booksRef.current`
    // snapshot could win the race and clobber a newer one with setBooks — collapsing
    // concurrent calls into one in-flight promise removes that risk entirely.
    let inFlight: Promise<void> | null = null;
    const handleFocus = () => {
      if (inFlight) return inFlight;
      inFlight = (async () => {
        try {
          // 1. Instantly merge disk, IndexedDB & in-memory state on navigation/focus to
          // prevent UI drops. Re-read the memory refs AFTER the (async) disk reads, not
          // before, so a book added on this device while this merge was in flight is
          // never overwritten by a snapshot taken before it existed.
          const currentLocalBooks = await loadMergedLocalBooks();
          const mergedBooks = mergeBooks([], currentLocalBooks, booksRef.current);
          setBooks(mergedBooks);

          const currentLocalVolumes = await loadMergedLocalVolumes();
          const mergedVols = mergeVolumes([], currentLocalVolumes, volumesRef.current);
          setVolumes(mergedVols);

          // 2. Fetch latest from cloud with lossless 3-way merging
          await fetchLatestFromCloud(true);
        } finally {
          inFlight = null;
        }
      })();
      return inFlight;
    };

    const handleFlushState = () => {
      if (booksRef.current && booksRef.current.length > 0) {
        saveBooksToStorage(booksRef.current);
      }
      if (volumesRef.current && volumesRef.current.length > 0) {
        saveVolumesToStorage(volumesRef.current);
      }
      triggerAutoSync(userEmail, syncCode, booksRef.current, ownerNameRef.current, ownerTitleRef.current, false, volumesRef.current, currentVolumeRef.current);
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('pageshow', handleFocus);
    window.addEventListener('popstate', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    window.addEventListener('pagehide', handleFlushState);
    window.addEventListener('beforeunload', handleFlushState);
    window.addEventListener('online', handleFocus);

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
      window.removeEventListener('online', handleFocus);
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
    isClearAll = false,
    currentVolumes?: PassbookVolume[],
    volNumber?: number
  ) => {
    const deletedIds = getDeletedBookIds();
    const deviceId = getOrCreateDeviceId();
    const volsToSync = currentVolumes !== undefined ? currentVolumes : volumesRef.current;
    const volNumToSync = volNumber !== undefined ? volNumber : currentVolumeRef.current;

    // 0. Universal Anonymous Device Backup (Always runs in background to prevent any data loss!)
    fetch(apiUrl('/api/device/save'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        books: currentBooks,
        volumes: volsToSync,
        currentVolume: volNumToSync,
        deletedIds,
        ownerName: currentName,
        ownerTitle: currentTitle,
        isClearAll
      })
    }).catch(() => {});

    // 1. Account sync (prioritized)
    if (email) {
      fetch(apiUrl('/api/auth/save'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          books: currentBooks,
          volumes: volsToSync,
          currentVolume: volNumToSync,
          deletedIds,
          ownerName: currentName,
          ownerTitle: currentTitle,
          isClearAll
        })
      })
      .then(res => res.json())
      .catch(err => {
        console.warn('[Sync] Cloud auto-save failed:', err);
      });
    }

    // 2. Legacy code sync (backward compatibility)
    if (code) {
      fetch(apiUrl('/api/sync/save'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          syncCode: code.trim().toUpperCase(),
          books: currentBooks,
          volumes: volsToSync,
          currentVolume: volNumToSync,
          deletedIds,
          ownerName: currentName,
          ownerTitle: currentTitle,
          isClearAll
        })
      })
      .then(res => res.json())
      .catch(err => {
        console.warn('[Sync] Legacy auto-save failed:', err);
      });
    }
  };

  // Archival and Reset Milestone Action
  const handleArchiveAndStartNextVolume = () => {
    const currentBooks = booksRef.current || [];
    const currentVol = currentVolumeRef.current || 1;
    const existingVols = volumesRef.current || [];

    const { updatedVolumes, nextVolume } = archiveCurrentPassbook(
      currentBooks,
      currentVol,
      ownerName,
      ownerTitle,
      existingVols
    );

    setVolumes(updatedVolumes);
    volumesRef.current = updatedVolumes;
    setCurrentVolume(nextVolume);
    currentVolumeRef.current = nextVolume;
    setBooks([]);
    booksRef.current = [];

    // Trigger auto-sync to backend immediately.
    // isClearAll MUST be true here: the server treats an empty `books` payload with no
    // deletedIds as an "accidental empty save" and silently keeps the OLD books to protect
    // against data loss. Since we just archived those books into `volumes`, we need to tell
    // the server this empty state is intentional — otherwise the archived books resurface in
    // the new (reset) passbook on the very next cloud sync.
    triggerAutoSync(userEmail, syncCode, [], ownerName, ownerTitle, true, updatedVolumes, nextVolume);

    setShowResetVolumeModal(false);
    setShowCelebration(false);
    setActiveTab('deposit');

    // Confetti celebration!
    confetti({ particleCount: 160, spread: 100, origin: { y: 0.6 } });

    showCustomAlert(
      '🎉 완독 통장 보관 및 새 통장 시작!',
      `축하합니다! 제 ${currentVol}호 통장(${currentBooks.length}권)이 [완독 보관함]에 안전하게 영구 저장되었습니다.\n이제 제 ${nextVolume}호 새 통장이 1권부터 신나게 시작됩니다! ✨`,
      'success'
    );
  };

  // Sync action handlers
  const handleCreateSyncCode = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(apiUrl('/api/sync/create'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          books,
          volumes,
          currentVolume,
          ownerName,
          ownerTitle
        })
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
      const res = await fetch(apiUrl(`/api/sync/load/${upperInput}`));
      if (!res.ok) {
        const errData = await res.json();
        showCustomAlert('연동 실패 ❌', errData.error || '존재하지 않는 코드예요. 다시 한 번 확인해 주세요.', 'warning');
        return;
      }
      const data = await res.json();
      if (data.success) {
        const currentLocalBooks = await loadMergedLocalBooks();
        const currentLocalVolumes = await loadMergedLocalVolumes();
        const { mergedBooks, mergedVolumes } = mergeIncomingSnapshot(
          data.books || [], data.volumes || [], data.currentVolume || 1, currentLocalBooks, currentLocalVolumes
        );
        const nextVol = Math.max(data.currentVolume || 1, currentVolumeRef.current, getCurrentVolumeNumber());

        setBooks(mergedBooks);
        setVolumes(mergedVolumes);
        setCurrentVolume(nextVol);
        setOwnerName(data.ownerName || ownerName);
        setOwnerTitle(data.ownerTitle || ownerTitle);
        setSyncCode(upperInput);

        saveBooksToStorage(mergedBooks);
        saveVolumesToStorage(mergedVolumes);
        setCurrentVolumeNumber(nextVol);
        safeStorage.setItem('digital_reading_owner_name', data.ownerName || ownerName);
        safeStorage.setItem('digital_reading_owner_title', data.ownerTitle || ownerTitle);
        safeStorage.setItem('digital_reading_sync_code', upperInput);

        // Sync back merged state
        triggerAutoSync(userEmail, upperInput, mergedBooks, data.ownerName || ownerName, data.ownerTitle || ownerTitle, false, mergedVolumes, nextVol);

        setIsSyncModalOpen(false);
        showCustomAlert('연동 성공! 🎉', `[${data.ownerName}] 책통장의 모든 기록과 완독 보관함을 성공적으로 가져와 연동했어요!`, 'success');
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
      const res = await fetch(apiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          password: pass.trim(),
          ownerName,
          ownerTitle,
          books,
          volumes,
          currentVolume
        })
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
      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password: pass.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUserEmail(data.email);

        // Merge any local offline books & volumes on this device with cloud data
        const currentLocalBooks = await loadMergedLocalBooks();
        const currentLocalVolumes = await loadMergedLocalVolumes();
        const { mergedBooks, mergedVolumes } = mergeIncomingSnapshot(
          data.books || [], data.volumes || [], data.currentVolume || 1, currentLocalBooks, currentLocalVolumes
        );
        const nextVol = Math.max(data.currentVolume || 1, currentVolumeRef.current, getCurrentVolumeNumber());

        const finalName = data.ownerName || ownerName;
        const finalTitle = data.ownerTitle || ownerTitle;

        setBooks(mergedBooks);
        setVolumes(mergedVolumes);
        setCurrentVolume(nextVol);
        setOwnerName(finalName);
        setOwnerTitle(finalTitle);

        saveBooksToStorage(mergedBooks);
        saveVolumesToStorage(mergedVolumes);
        setCurrentVolumeNumber(nextVol);
        safeStorage.setItem('digital_reading_owner_name', finalName);
        safeStorage.setItem('digital_reading_owner_title', finalTitle);
        safeStorage.setItem('digital_reading_user_email', data.email);

        // Immediately sync merged state back to cloud server
        triggerAutoSync(data.email, syncCode, mergedBooks, finalName, finalTitle, false, mergedVolumes, nextVol);

        setIsSyncModalOpen(false);
        showCustomAlert('로그인 성공! 🎉', `[${finalName}] 책통장의 모든 기록과 완독 보관함을 안전하게 불러와 연동했어요!`, 'success');
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

  // Emergency local backup and file export/import
  const handleExportBackup = () => {
    try {
      const currentBooks = booksRef.current || [];
      const currentVols = volumesRef.current || [];
      const curVol = currentVolumeRef.current || 1;
      const jsonStr = exportPassbookBackupJSON(currentBooks, currentVols, curVol, ownerName, ownerTitle);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const today = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `독서통장_전체백업_${ownerName}_${today}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showCustomAlert('백업 다운로드 완료 💾', '내 기기에 제 1호 통장 및 모든 독서 기록 파일이 안전하게 저장되었습니다!', 'success');
    } catch (e) {
      showCustomAlert('백업 실패', '파일을 저장하지 못했습니다.', 'warning');
    }
  };

  const handleImportBackup = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) throw new Error('Empty file');
        const parsed = JSON.parse(text);

        if (!parsed || (!Array.isArray(parsed.books) && !Array.isArray(parsed.volumes))) {
          showCustomAlert('복원 실패', '올바른 독서통장 백업 파일(.json)이 아닙니다.', 'warning');
          return;
        }

        const incomingBooks: BookRecord[] = parsed.books || [];
        const incomingVolumes: PassbookVolume[] = parsed.volumes || [];
        const currentLocalBooks = await loadMergedLocalBooks();
        const currentLocalVolumes = await loadMergedLocalVolumes();

        const { mergedBooks, mergedVolumes } = mergeIncomingSnapshot(
          incomingBooks, incomingVolumes, parsed.currentVolume || 1, currentLocalBooks, currentLocalVolumes, booksRef.current, volumesRef.current
        );
        const nextVol = Math.max(parsed.currentVolume || 1, currentVolumeRef.current, getCurrentVolumeNumber());

        const finalName = parsed.ownerName || ownerName;
        const finalTitle = parsed.ownerTitle || ownerTitle;

        setBooks(mergedBooks);
        setVolumes(mergedVolumes);
        setCurrentVolume(nextVol);
        setOwnerName(finalName);
        setOwnerTitle(finalTitle);

        saveBooksToStorage(mergedBooks);
        saveVolumesToStorage(mergedVolumes);
        setCurrentVolumeNumber(nextVol);
        safeStorage.setItem('digital_reading_owner_name', finalName);
        safeStorage.setItem('digital_reading_owner_title', finalTitle);

        triggerAutoSync(userEmail, syncCode, mergedBooks, finalName, finalTitle, false, mergedVolumes, nextVol);

        showCustomAlert(
          '복원 완료! 🎉',
          `백업 파일로부터 제 1호 통장 및 총 ${mergedBooks.length}권의 독서 기록과 ${mergedVolumes.length}개의 완독 보관함을 안전하게 복원했어요!`,
          'success'
        );
      } catch (err) {
        showCustomAlert('복원 오류', '백업 파일을 읽는 중 문제가 발생했습니다.', 'warning');
      }
    };
    reader.readAsText(file);
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
    const stampedBook: BookRecord = {
      ...newBook,
      volumeNumber: currentVolumeRef.current || 1
    };
    const currentList = booksRef.current || [];
    const updatedBooks = [stampedBook, ...currentList.filter(b => b && b.id !== stampedBook.id)];
    setBooks(updatedBooks);
    saveBooksToStorage(updatedBooks);
    triggerAutoSync(userEmail, syncCode, updatedBooks, ownerName, ownerTitle);

    // Direct transition to ledger view
    setActiveTab('ledger');

    // Trigger Success alert
    showCustomAlert('참 잘했어요!', `와아! [${stampedBook.title}] 책 저축에 성공했어요!`, 'success');

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
    const currentList = booksRef.current || [];
    const updatedBooks = currentList.filter((b) => b && b.id !== id);
    setBooks(updatedBooks);
    saveBooksToStorage(updatedBooks);
    triggerAutoSync(userEmail, syncCode, updatedBooks, ownerName, ownerTitle);
    showCustomAlert('삭제 완료', '기록을 통장에서 안전하게 지웠어요.', 'info');
  };

  // Clear all book records
  const handleClearAll = () => {
    const currentList = booksRef.current || [];
    currentList.forEach(b => { if (b && b.id) addDeletedBookId(b.id); });
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
          currentVolume={currentVolume}
          volumesCount={volumes.length}
          onOpenVolumes={() => setIsArchivedModalOpen(true)}
          onOpenResetModal={() => setShowResetVolumeModal(true)}
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
              onOpenResetModal={() => setShowResetVolumeModal(true)}
              onOpenVolumes={() => setIsArchivedModalOpen(true)}
              volumesCount={volumes.length}
              currentVolume={currentVolume}
            />
          )}
        </main>

        {/* Cute footer */}
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

      {/* 10/20/30-Book Milestone Certificate celebration Modal */}
      <CelebrationModal
        isOpen={showCelebration}
        onClose={() => setShowCelebration(false)}
        ownerName={`${ownerName} (${ownerTitle})`}
        bookCount={celebrationBookCount}
        onStartNextVolume={() => {
          setShowCelebration(false);
          setShowResetVolumeModal(true);
        }}
      />

      {/* Archived Volumes Modal */}
      <ArchivedVolumesModal
        isOpen={isArchivedModalOpen}
        onClose={() => setIsArchivedModalOpen(false)}
        volumes={volumes}
        currentVolume={currentVolume}
      />

      {/* 30-Book Archival & Reset Confirmation Cute Modal */}
      <CuteModal
        isOpen={showResetVolumeModal}
        onClose={() => setShowResetVolumeModal(false)}
        title="🎉 30권 완독 통장 보관 & 새 통장 시작"
        type="success"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-[#FFF3E0] text-[#FF8B3D] flex items-center justify-center">
            <Trophy size={36} />
          </div>
          <div className="space-y-2">
            <p className="font-gaegu text-2xl font-bold text-[#5D5443]">
              현재 <span className="text-[#4E9F57]">제 {currentVolume}호 독서통장 ({books.length}권)</span>을<br />
              <span className="text-[#FF8B3D] underline decoration-wavy">[완독 보관함]</span>에 안전하게 보관할까요?
            </p>
            <p className="font-sans text-xs sm:text-sm text-[#8C7E6A] bg-[#FDFCF0] p-3 rounded-xl border border-[#E6D5B8]">
              💡 <strong>안내:</strong> 지금까지 읽은 30권의 책, 그림, 음성 녹음은 <strong>절대 지워지지 않고 [완독 보관함]에 영구 보존</strong>되며, 현재 통장은 <strong>제 {currentVolume + 1}호 새 통장(1권부터)</strong>으로 기분 좋게 시작됩니다!
            </p>
          </div>
          <div className="flex gap-3 w-full mt-2">
            <button
              onClick={() => setShowResetVolumeModal(false)}
              className="flex-1 py-3 bg-stone-100 hover:bg-stone-200 text-[#8C7E6A] font-gaegu text-xl font-bold rounded-2xl transition-colors cursor-pointer"
            >
              다음에 할래요
            </button>
            <button
              onClick={handleArchiveAndStartNextVolume}
              id="confirm-archive-next-volume-btn"
              className="flex-1 py-3 bg-gradient-to-r from-[#4E9F57] to-[#6BCB77] hover:from-[#3D8B46] hover:to-[#5BA867] text-white font-gaegu text-xl font-bold rounded-2xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Sparkles size={18} />
              <span>네, 새 통장 시작해요!</span>
            </button>
          </div>
        </div>
      </CuteModal>

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
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
      />
    </div>
  );
}
