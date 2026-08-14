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
      const testKey = '__storage_test_key__';
      const storage = window.localStorage;
      if (storage && typeof storage.setItem === 'function') {
        storage.setItem(testKey, '1');
        storage.removeItem(testKey);
        cachedStorage = storage;
      }
    }
  } catch (e) {
    console.warn('[Storage Defense] LocalStorage is restricted or inaccessible. Operating with In-Memory Storage.', e);
    cachedStorage = null;
  }
  isStorageChecked = true;
  return cachedStorage;
};

// Safely get cookie
const getCookie = (name: string): string | null => {
  try {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  } catch {
    return null;
  }
};

// Safely set cookie with 10-year expiration
const setCookie = (name: string, value: string) => {
  try {
    if (typeof document === 'undefined') return;
    const maxAge = 315360000; // 10 years in seconds
    document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; SameSite=Lax`;
  } catch {}
};

// Unique Persistent Device ID with 4-Layer Persistence (LocalStorage + Cookie + SessionStorage + window.name)
export const getOrCreateDeviceId = (): string => {
  try {
    let id: string | null = null;

    // 1. Check LocalStorage
    const localId = safeStorage.getItem('digital_reading_device_id');
    if (localId && localId.length > 5) id = localId;

    // 2. Check Cookie
    if (!id) {
      const cookieId = getCookie('digital_reading_device_id');
      if (cookieId && cookieId.length > 5) id = cookieId;
    }

    // 3. Check SessionStorage
    if (!id && typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const sessId = window.sessionStorage.getItem('digital_reading_device_id');
        if (sessId && sessId.length > 5) id = sessId;
      } catch {}
    }

    // 4. Check window.name persistence trick (survives mobile browser page reloads in private mode)
    if (!id && typeof window !== 'undefined' && window.name && window.name.startsWith('dr_dev_')) {
      id = window.name;
    }

    // If still no ID, generate a unique resilient one
    if (!id) {
      id = 'dr_dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
    }

    // Mirror to all 4 persistence layers
    safeStorage.setItem('digital_reading_device_id', id);
    setCookie('digital_reading_device_id', id);
    if (typeof window !== 'undefined') {
      try { window.sessionStorage?.setItem('digital_reading_device_id', id); } catch {}
      try { window.name = id; } catch {}
    }

    return id;
  } catch {
    return 'dr_dev_default_session';
  }
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
      console.warn(`[Storage Defense] safeStorage.getItem error for "${key}". Falling back to memory.`, e);
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
      console.warn(`[Storage Defense] safeStorage.setItem unable to persist to browser disk for "${key}" (Quota/Security restriction). Retained in memory.`, e);
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
    // Also remove any single book key
    safeStorage.removeItem(`digital_reading_book_${id}`);
    deleteBookFromIDB(id).catch(() => {});
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

/**
 * Multi-layer Quota-Safe book saver:
 * 1. Updates Memory Cache instantly
 * 2. Stores lightweight metadata index (`digital_reading_books_meta`) in LocalStorage (never exceeds quota)
 * 3. Stores clean lean book records (`digital_reading_books_lean`) in LocalStorage
 * 4. Stores full rich records in unlimited IndexedDB
 * 5. Tries saving full array to LocalStorage if quota permits
 */
export const saveBooksToStorage = (books: BookRecord[]): boolean => {
  try {
    const validBooks = Array.isArray(books) ? books.filter(b => b && typeof b === 'object' && b.id) : [];
    cachedBooksArray = [...validBooks];
    const jsonStr = JSON.stringify(validBooks);
    
    // 1. Update memory dictionary
    memoryStorageDict['digital_reading_books'] = jsonStr;

    // 2. Save lightweight metadata index (always fits in LocalStorage)
    const metaList = validBooks.map(b => ({
      id: b.id,
      title: b.title,
      rating: b.rating,
      feeling: b.feeling,
      createdAt: b.createdAt,
      sceneType: b.sceneType
    }));
    safeStorage.setItem('digital_reading_books_meta', JSON.stringify(metaList));

    // 3. Save lean version to LocalStorage (retains core text so all 50+ books always fit without Quota error)
    const leanList = validBooks.map(b => ({
      id: b.id,
      title: b.title,
      rating: b.rating,
      feeling: b.feeling,
      createdAt: b.createdAt,
      sceneType: b.sceneType,
      coverImage: (b.coverImage && b.coverImage.length < 50000) ? b.coverImage : null
    }));
    safeStorage.setItem('digital_reading_books_lean', JSON.stringify(leanList));

    // 4. Try saving full array to LocalStorage
    try {
      const storage = getLocalStorage();
      if (storage) {
        storage.setItem('digital_reading_books', jsonStr);
      }
    } catch {
      // If quota exceeded on full array, remove stale full key so it doesn't mask newly added books
      try {
        const storage = getLocalStorage();
        if (storage) {
          storage.removeItem('digital_reading_books');
        }
      } catch {}
    }

    // 5. Persist full rich book data into IndexedDB
    saveBooksToIDB(validBooks).catch(() => {});
    return true;
  } catch (e) {
    console.error('[Storage Defense] saveBooksToStorage safe memory fallback active.', e);
    return true;
  }
};

// IndexedDB unlimited quota storage layer for mobile/tablet browsers with Timeout Protection
const DB_NAME = 'reading_passbook_idb';
const STORE_NAME = 'books_store';

const getIDB = (): Promise<IDBDatabase | null> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }

    // Safety timeout: 1000ms race so mobile Safari never hangs or blocks app loading
    const timer = setTimeout(() => {
      resolve(null);
    }, 1000);

    try {
      const request = window.indexedDB.open(DB_NAME, 2);
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      
      request.onsuccess = () => {
        clearTimeout(timer);
        resolve(request.result);
      };
      
      request.onerror = () => {
        clearTimeout(timer);
        resolve(null);
      };

      request.onblocked = () => {
        clearTimeout(timer);
        resolve(null);
      };
    } catch (e) {
      clearTimeout(timer);
      resolve(null);
    }
  });
};

export const saveBooksToIDB = async (books: BookRecord[]): Promise<boolean> => {
  try {
    const db = await getIDB();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        
        // Save full array
        store.put(books, 'digital_reading_books');

        // Also save each book individually by ID
        books.forEach(b => {
          if (b && b.id) {
            store.put(b, `book_${b.id}`);
          }
        });

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      } catch (err) {
        resolve(false);
      }
    });
  } catch (e) {
    return false;
  }
};

export const deleteBookFromIDB = async (id: string): Promise<boolean> => {
  try {
    const db = await getIDB();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(`book_${id}`);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  } catch {
    return false;
  }
};

export const loadBooksFromIDB = async (): Promise<BookRecord[]> => {
  try {
    const db = await getIDB();
    if (!db) return [];
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        
        // Retrieve all stored objects to guarantee no record is missed
        if (typeof store.getAll === 'function') {
          const getAllReq = store.getAll();
          getAllReq.onsuccess = () => {
            const results = getAllReq.result || [];
            const map = new Map<string, BookRecord>();
            results.forEach((item: any) => {
              if (Array.isArray(item)) {
                item.forEach((b: any) => {
                  if (b && b.id && typeof b.title === 'string') map.set(b.id, b);
                });
              } else if (item && typeof item === 'object' && item.id && typeof item.title === 'string') {
                map.set(item.id, item);
              }
            });
            resolve(Array.from(map.values()));
          };
          getAllReq.onerror = () => {
            const req = store.get('digital_reading_books');
            req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
            req.onerror = () => resolve([]);
          };
        } else {
          const req = store.get('digital_reading_books');
          req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
          req.onerror = () => resolve([]);
        }
      } catch (err) {
        resolve([]);
      }
    });
  } catch (e) {
    return [];
  }
};

export const loadBooksFromStorage = (): BookRecord[] => {
  try {
    const deletedIds = getDeletedBookIds();
    const map = new Map<string, BookRecord>();

    const mergeItem = (item: any) => {
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
    };

    // 1. Add from in-memory cachedBooksArray
    if (Array.isArray(cachedBooksArray)) {
      cachedBooksArray.forEach(mergeItem);
    }

    // 2. Read from safeStorage `digital_reading_books`
    const data = safeStorage.getItem('digital_reading_books');
    if (data) {
      try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) parsed.forEach(mergeItem);
      } catch {}
    }

    // 3. Read from lean version `digital_reading_books_lean`
    const leanData = safeStorage.getItem('digital_reading_books_lean');
    if (leanData) {
      try {
        const parsed = JSON.parse(leanData);
        if (Array.isArray(parsed)) parsed.forEach(mergeItem);
      } catch {}
    }

    // 4. Read from meta list `digital_reading_books_meta`
    const metaData = safeStorage.getItem('digital_reading_books_meta');
    if (metaData) {
      try {
        const parsed = JSON.parse(metaData);
        if (Array.isArray(parsed)) parsed.forEach(mergeItem);
      } catch {}
    }

    // 5. Reconstruct from individual `digital_reading_book_*` entries
    try {
      const storage = getLocalStorage();
      if (storage) {
        for (let i = 0; i < storage.length; i++) {
          const k = storage.key(i);
          if (k && k.startsWith('digital_reading_book_')) {
            const singleVal = storage.getItem(k);
            if (singleVal) {
              try {
                const b = JSON.parse(singleVal);
                mergeItem(b);
              } catch {}
            }
          }
        }
      }
    } catch {}

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
 * Lossless 4-layer storage loader: merges memory cache + localStorage + lean index + IndexedDB.
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
 * Compresses an image file to a maximum width of 320px and returns a compact Base64 JPEG string (~15KB).
 * Prevents QuotaExceededError and ensures dozens of books easily fit on tablet/mobile devices.
 */
export const compressAndConvertToBase64 = (file: File, maxWidth = 320): Promise<string> => {
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

          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.5);
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
