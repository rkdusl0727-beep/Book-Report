import { BookRecord } from '../types';

// Safe in-memory fallback dictionary for all storage keys to absolutely prevent crashes
const memoryStorageDict: Record<string, string> = {};

// Safely get localStorage without triggering crashes from direct property access in sandboxed or secure environments
const getLocalStorage = (): Storage | null => {
  try {
    if (typeof window !== 'undefined' && 'localStorage' in window) {
      // Some strict environments throw a SecurityError simply by accessing window.localStorage
      const storage = window.localStorage;
      if (storage) {
        // Double check it's usable by doing a tiny test
        const testKey = '__storage_test__';
        storage.setItem(testKey, testKey);
        storage.removeItem(testKey);
        return storage;
      }
    }
  } catch (e) {
    // In-memory will be used instead
  }
  return null;
};

export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      const storage = getLocalStorage();
      if (storage) {
        const value = storage.getItem(key);
        if (value !== null) {
          // Sync to memory dictionary to keep them aligned
          memoryStorageDict[key] = value;
          return value;
        }
      }
    } catch (e) {
      console.warn(`[Storage Defense] safeStorage.getItem failed for key "${key}". Using memory fallback.`, e);
    }
    return memoryStorageDict[key] || null;
  },

  setItem: (key: string, value: string): boolean => {
    // Sync to memory dictionary first to ensure it's always available instantly
    memoryStorageDict[key] = value;
    try {
      const storage = getLocalStorage();
      if (storage) {
        storage.setItem(key, value);
        return true;
      }
    } catch (e) {
      console.warn(`[Storage Defense] safeStorage.setItem failed for key "${key}". Saved to memory instead.`, e);
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
      console.warn(`[Storage Defense] safeStorage.removeItem failed for key "${key}". Removed from memory.`, e);
    }
    return false;
  }
};

export const saveBooksToStorage = (books: BookRecord[]): boolean => {
  return safeStorage.setItem('digital_reading_books', JSON.stringify(books));
};

export const loadBooksFromStorage = (): BookRecord[] => {
  const data = safeStorage.getItem('digital_reading_books');
  if (data) {
    try {
      return JSON.parse(data) as BookRecord[];
    } catch (e) {
      console.error('[Storage Defense] Failed to parse books data, returning empty list.', e);
      return [];
    }
  }
  return [];
};

/**
 * Compresses an image file to a maximum width of 600px and returns a Base64 string.
 * This keeps the LocalStorage usage small and prevents crashes.
 */
export const compressAndConvertToBase64 = (file: File, maxWidth = 600): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
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
          resolve(img.src); // Fallback to raw base64 if canvas context is missing
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Compress image to jpeg format with 0.7 quality to save substantial space
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        resolve(compressedBase64);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

/**
 * Formats standard Javascript Date into a friendly Korean kid-friendly style.
 */
export const getKoreanFriendlyDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const date = now.getDate();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const day = days[now.getDay()];
  return `${year}년 ${month}월 ${date}일 (${day})`;
};
