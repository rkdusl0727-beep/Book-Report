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
}

export type ActiveTab = 'deposit' | 'ledger';
