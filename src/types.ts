export interface BookRecord {
  id: string;
  title: string;
  coverImage: string | null; // Base64 data URL for book cover
  rating: number; // 1 to 5 stars
  feeling: string; // '😆 재밌어요' | '💖 감동이에요' | '🥰 또 읽고 싶어요'
  voiceRecord: string | null; // Base64 audio URL
  sceneImage: string | null; // Base64 data URL for memorable scene
  sceneType?: 'drawing' | 'photo'; // To distinguish drawings from uploaded photos
  createdAt: string; // Formatting like '2026년 7월 19일'
  volumeNumber?: number; // Passbook volume number (e.g. 1, 2, 3...)
}

export interface PassbookVolume {
  id: string; // e.g. 'vol_1', 'vol_2'
  volumeNumber: number; // 1, 2, 3...
  title: string; // e.g. '제 1호 독서통장'
  completedAt: string; // e.g. '2026년 8월 24일'
  ownerName: string;
  ownerTitle: string;
  books: BookRecord[];
}

export type ActiveTab = 'deposit' | 'ledger';

