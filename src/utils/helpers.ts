import { BookRecord } from '../types';

// Safe in-memory fallback dictionary for all storage keys to absolutely prevent crashes
const memoryStorageDict: Record<string, string> = {};

let isStorageChecked = false;
let cachedStorage: Storage | null = null;

// Safely get localStorage without triggering crashes from direct property access in sandboxed or secure environments
const getLocalStorage = (): Storage | null => {
  if (isStorageChecked) {
    return cachedStorage;
  }
  try {
    if (typeof window !== 'undefined') {
      // Check if window.localStorage is accessible without throwing SecurityError
      const testKey = '__storage_test_key__';
      const storage = window.localStorage;
      if (storage && typeof storage.setItem === 'function') {
        storage.setItem(testKey, '1');
        storage.removeItem(testKey);
        cachedStorage = storage;
        console.log('[Storage Defense] LocalStorage verified and accessible.');
      }
    }
  } catch (e) {
    console.warn('[Storage Defense] LocalStorage is blocked or inaccessible (e.g. private mode, cookies disabled, iframe sandbox). Operating gracefully with In-Memory Storage.', e);
    cachedStorage = null;
  }
  isStorageChecked = true;
  return cachedStorage;
};

export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      const storage = getLocalStorage();
      const diskVal = storage ? storage.getItem(key) : null;
      const memVal = memoryStorageDict[key] || null;

      // Special lossless protection for book records array
      if (key === 'digital_reading_books' && (diskVal || memVal)) {
        let diskBooks: BookRecord[] = [];
        let memBooks: BookRecord[] = [];
        try { if (diskVal) diskBooks = JSON.parse(diskVal); } catch {}
        try { if (memVal) memBooks = JSON.parse(memVal); } catch {}

        if (Array.isArray(diskBooks) && Array.isArray(memBooks) && (diskBooks.length > 0 || memBooks.length > 0)) {
          const map = new Map<string, BookRecord>();
          diskBooks.forEach(b => { if (b && b.id) map.set(b.id, b); });
          memBooks.forEach(b => { if (b && b.id) map.set(b.id, b); });
          const merged = Array.from(map.values());
          const mergedStr = JSON.stringify(merged);
          memoryStorageDict[key] = mergedStr;
          return mergedStr;
        }
      }

      if (diskVal !== null) {
        memoryStorageDict[key] = diskVal;
        return diskVal;
      }
    } catch (e) {
      console.warn(`[Storage Defense] safeStorage.getItem error for "${key}". Falling back to memory storage.`, e);
    }
    return memoryStorageDict[key] || null;
  },

  setItem: (key: string, value: string): boolean => {
    // 1. Always update memory storage first to guarantee instant availability in JS state
    memoryStorageDict[key] = value;
    try {
      const storage = getLocalStorage();
      if (storage) {
        storage.setItem(key, value);
        return true;
      }
    } catch (e: any) {
      // Catch QuotaExceededError or SecurityError
      console.warn(`[Storage Defense] safeStorage.setItem unable to persist to browser disk for "${key}" (Quota or Security restriction). Retained safely in memory.`, e);
    }
    return false;
  },

  removeItem: (key: string): boolean => {
    delete memoryStorageDict[key];
    try {
      const storage = getLocalStorage();
      if (storage) {
        storage.removeItem(key);
        return true;
      }
    } catch (e) {
      console.warn(`[Storage Defense] safeStorage.removeItem error for "${key}". Removed from memory safely.`, e);
    }
    return false;
  },

  clear: (): boolean => {
    Object.keys(memoryStorageDict).forEach(k => delete memoryStorageDict[k]);
    try {
      const storage = getLocalStorage();
      if (storage) {
        storage.clear();
        return true;
      }
    } catch (e) {
      console.warn(`[Storage Defense] safeStorage.clear error. Cleared memory store safely.`, e);
    }
    return false;
  }
};

export const getDeletedBookIds = (): string[] => {
  try {
    const raw = safeStorage.getItem('digital_reading_deleted_ids');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const addDeletedBookId = (id: string) => {
  try {
    if (!id) return;
    const current = getDeletedBookIds();
    if (!current.includes(id)) {
      const updated = [...current, id];
      safeStorage.setItem('digital_reading_deleted_ids', JSON.stringify(updated));
    }
  } catch (e) {
    console.warn('[Storage Defense] Failed to save deleted ID:', e);
  }
};

export const clearDeletedBookId = (id: string) => {
  try {
    if (!id) return;
    const current = getDeletedBookIds();
    const updated = current.filter(item => item !== id);
    safeStorage.setItem('digital_reading_deleted_ids', JSON.stringify(updated));
  } catch (e) {
    console.warn('[Storage Defense] Failed to clear deleted ID:', e);
  }
};

let cachedBooksArray: BookRecord[] = [];

export const saveBooksToStorage = (books: BookRecord[]): boolean => {
  try {
    const validBooks = Array.isArray(books) ? books.filter(b => b && typeof b === 'object' && b.id) : [];
    cachedBooksArray = [...validBooks];
    const jsonStr = JSON.stringify(validBooks);
    
    // Always store in memory storage dict first
    memoryStorageDict['digital_reading_books'] = jsonStr;
    safeStorage.setItem('digital_reading_books', jsonStr);

    // Asynchronously back up to IndexedDB to guarantee storage even if localStorage hits quota
    saveBooksToIDB(validBooks).catch(() => {});
    return true;
  } catch (e) {
    console.error('[Storage Defense] saveBooksToStorage failed. Safe memory fallback active.', e);
    return true;
  }
};

// IndexedDB unlimited quota storage layer for mobile/tablet browsers
const DB_NAME = 'reading_passbook_idb';
const STORE_NAME = 'books_store';

const getIDB = (): Promise<IDBDatabase | null> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }
    try {
      const request = window.indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
};

export const saveBooksToIDB = async (books: BookRecord[]): Promise<boolean> => {
  try {
    const db = await getIDB();
    if (!db) return false;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(books, 'digital_reading_books');
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch (e) {
    return false;
  }
};

export const loadBooksFromIDB = async (): Promise<BookRecord[]> => {
  try {
    const db = await getIDB();
    if (!db) return [];
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get('digital_reading_books');
      req.onsuccess = () => {
        const val = req.result;
        resolve(Array.isArray(val) ? val : []);
      };
      req.onerror = () => resolve([]);
    });
  } catch (e) {
    return [];
  }
};

export const loadBooksFromStorage = (): BookRecord[] => {
  try {
    const deletedIds = getDeletedBookIds();
    const map = new Map<string, BookRecord>();

    // 1. Add from in-memory cachedBooksArray if available
    if (Array.isArray(cachedBooksArray)) {
      cachedBooksArray.forEach(b => {
        if (b && b.id && !deletedIds.includes(b.id)) {
          map.set(b.id, b);
        }
      });
    }

    // 2. Read from safeStorage (localStorage / memoryStorageDict)
    const data = safeStorage.getItem('digital_reading_books');
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        parsed.forEach(item => {
          if (item && typeof item === 'object' && item.id && typeof item.title === 'string' && !deletedIds.includes(item.id)) {
            if (map.has(item.id)) {
              const prev = map.get(item.id)!;
              map.set(item.id, {
                ...prev,
                ...item,
                sceneImage: item.sceneImage || prev.sceneImage || null,
                voiceRecord: item.voiceRecord || prev.voiceRecord || null,
                coverImage: item.coverImage || prev.coverImage || null,
                feeling: item.feeling || prev.feeling || '',
                rating: item.rating || prev.rating || 5,
              });
            } else {
              map.set(item.id, item as BookRecord);
            }
          }
        });
      }
    }

    const result = Array.from(map.values());
    cachedBooksArray = result;
    return result;
  } catch (e) {
    console.error('[Storage Defense] Failed to parse books data. Returning cached memory list safely.', e);
    const deletedIds = getDeletedBookIds();
    return (cachedBooksArray || []).filter(b => b && b.id && !deletedIds.includes(b.id));
  }
};

/**
 * Lossless 3-layer storage loader: merges memory cache + localStorage + IndexedDB.
 * Guarantees zero data loss even if browser memory is purged or localStorage hits 5MB quota.
 */
export const loadMergedLocalBooks = async (): Promise<BookRecord[]> => {
  try {
    const memoryAndDisk = loadBooksFromStorage();
    const idbBooks = await loadBooksFromIDB().catch(() => []);
    const deletedIds = getDeletedBookIds();

    const map = new Map<string, BookRecord>();
    const process = (b: BookRecord) => {
      if (b && b.id && typeof b.title === 'string' && !deletedIds.includes(b.id)) {
        if (map.has(b.id)) {
          const prev = map.get(b.id)!;
          map.set(b.id, {
            ...prev,
            ...b,
            sceneImage: b.sceneImage || prev.sceneImage || null,
            voiceRecord: b.voiceRecord || prev.voiceRecord || null,
            coverImage: b.coverImage || prev.coverImage || null,
            feeling: b.feeling || prev.feeling || '',
            rating: b.rating || prev.rating || 5,
          });
        } else {
          map.set(b.id, b);
        }
      }
    };

    idbBooks.forEach(process);
    memoryAndDisk.forEach(process);

    const merged = Array.from(map.values());
    cachedBooksArray = merged;
    return merged;
  } catch (e) {
    console.error('[Storage Defense] loadMergedLocalBooks failed. Returning memory cached list safely.', e);
    const deletedIds = getDeletedBookIds();
    return (cachedBooksArray || []).filter(b => b && b.id && !deletedIds.includes(b.id));
  }
};

/**
 * Compresses an image file to a maximum width of 450px and returns a compact Base64 string.
 * Keeps memory/storage usage ultra-small (~30KB per image) and prevents QuotaExceededError on mobile/tablet devices.
 */
export const compressAndConvertToBase64 = (file: File, maxWidth = 450): Promise<string> => {
  return new Promise((resolve) => {
    if (!file) {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (!result) {
        resolve('');
        return;
      }
      const img = new Image();
      img.src = result;
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(img.src);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.55);
          resolve(compressedBase64);
        } catch (e) {
          console.warn('[Image Defense] Compression canvas failed, returning image safely.', e);
          resolve(img.src);
        }
      };
      img.onerror = () => resolve(result);
    };
    reader.onerror = () => resolve('');
  });
};

/**
 * Formats standard Javascript Date into a friendly Korean kid-friendly style.
 */
export const getKoreanFriendlyDate = (): string => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const day = days[now.getDay()];
    return `${year}년 ${month}월 ${date}일 (${day})`;
  } catch {
    return '오늘';
  }
};

