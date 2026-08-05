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

export const saveBooksToStorage = (books: BookRecord[]): boolean => {
  try {
    const validBooks = Array.isArray(books) ? books.filter(b => b && typeof b === 'object' && b.id) : [];
    const jsonStr = JSON.stringify(validBooks);
    const success = safeStorage.setItem('digital_reading_books', jsonStr);

    // Asynchronously back up to IndexedDB to guarantee storage even if localStorage hits quota
    saveBooksToIDB(validBooks);
    return success;
  } catch (e) {
    console.error('[Storage Defense] saveBooksToStorage stringify failed. Safe fallback activated.', e);
    return false;
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
    const data = safeStorage.getItem('digital_reading_books');
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        // Prevent crashes by ensuring only valid BookRecord objects are returned
        return parsed.filter(item => item && typeof item === 'object' && typeof item.title === 'string') as BookRecord[];
      }
    }
  } catch (e) {
    console.error('[Storage Defense] Failed to parse books data. Returning empty list safely without crash.', e);
  }
  return [];
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

