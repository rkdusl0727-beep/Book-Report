import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";

async function startServer() {
  const app = express();
  // Respect the platform-assigned port (Cloud Run, Render, Railway, etc. all inject PORT
  // and expect the server to bind to it) — hardcoding 3000 would make the deployed backend
  // unreachable there, which looks exactly like "sync doesn't work / old records vanish"
  // from the client's point of view, since every /api/* call would simply never land.
  const PORT = Number(process.env.PORT) || 3000;

  // Support up to 100MB payloads so huge collections with dozens of high-res drawings & voice notes never get rejected
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // CORS: lets the frontend call this API from a different origin (e.g. a Netlify-hosted
  // client talking to this server on Render/Railway/Fly). Harmless and inert when the
  // frontend is served from this same origin instead. No cookies/credentials are used for
  // auth here (email+password and sync codes travel in the request body), so a permissive
  // origin is safe — set ALLOWED_ORIGIN to lock it down to one specific frontend URL instead.
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Global exception handling middleware to prevent server crashes under high traffic or unexpected payloads
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("[Server Defense] Unhandled Error Caught:", err);
    res.status(500).json({ success: false, error: "서버 처리 중 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." });
  });

  // DATA_DIR lets the sync store live on a mounted persistent disk (e.g. Render's paid
  // plans, which back a disk at a fixed path) instead of the app's own ephemeral working
  // directory — on hosts that wipe the filesystem between deploys/restarts, that's the
  // difference between cloud-synced data surviving and not. Defaults to cwd for local dev
  // and any host with a durable filesystem.
  const DATA_DIR = process.env.DATA_DIR || process.cwd();
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
  const STORE_FILE = path.join(DATA_DIR, 'sync_store.json');
  const BACKUP_FILE_1 = path.join(DATA_DIR, 'sync_store_snapshot_1.json');
  const BACKUP_FILE_2 = path.join(DATA_DIR, 'sync_store_snapshot_2.json');
  const PERMANENT_VAULT_FILE = path.join(DATA_DIR, 'sync_store_permanent_vault.json');

  // Helper to read sync store with multi-snapshot auto-recovery
  const readStore = () => {
    try {
      if (fs.existsSync(STORE_FILE)) {
        const content = fs.readFileSync(STORE_FILE, 'utf-8');
        if (content && content.trim().length > 0) {
          const parsed = JSON.parse(content);
          if (parsed && typeof parsed === 'object') return parsed;
        }
      }
    } catch (e) {
      console.error("[Server Defense] Error reading primary sync store. Attempting snapshot recovery...", e);
    }

    // Auto-recovery from rolling backups if primary store is ever corrupted or missing
    const backupFiles = [BACKUP_FILE_1, BACKUP_FILE_2, PERMANENT_VAULT_FILE];
    for (const bFile of backupFiles) {
      try {
        if (fs.existsSync(bFile)) {
          const bContent = fs.readFileSync(bFile, 'utf-8');
          if (bContent && bContent.trim().length > 0) {
            const parsed = JSON.parse(bContent);
            if (parsed && typeof parsed === 'object') {
              console.log(`[Server Defense] Successfully recovered data from backup snapshot: ${path.basename(bFile)}`);
              return parsed;
            }
          }
        }
      } catch {}
    }

    return {};
  };

  // Helper to write sync store atomically with rolling snapshots and permanent vault
  const writeStore = (data: any) => {
    try {
      const jsonStr = JSON.stringify(data, null, 2);
      const tmpFile = `${STORE_FILE}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 6)}`;

      // 1. Atomic write to primary file
      fs.writeFileSync(tmpFile, jsonStr, 'utf-8');
      fs.renameSync(tmpFile, STORE_FILE);

      // 2. Rolling backup snapshot rotation
      try {
        if (fs.existsSync(BACKUP_FILE_1)) {
          fs.copyFileSync(BACKUP_FILE_1, BACKUP_FILE_2);
        }
        fs.copyFileSync(STORE_FILE, BACKUP_FILE_1);
      } catch (be) {
        console.warn("[Server Defense] Rolling snapshot copy error:", be);
      }

      // 3. Permanent Volume 1 & History Vault Update
      try {
        let vault: any = {};
        if (fs.existsSync(PERMANENT_VAULT_FILE)) {
          try { vault = JSON.parse(fs.readFileSync(PERMANENT_VAULT_FILE, 'utf-8')); } catch {}
        }
        vault.lastSavedAt = new Date().toISOString();
        if (data.users) vault.users = { ...vault.users, ...data.users };
        if (data.devices) vault.devices = { ...vault.devices, ...data.devices };
        
        fs.writeFileSync(PERMANENT_VAULT_FILE, JSON.stringify(vault, null, 2), 'utf-8');
      } catch (ve) {
        console.warn("[Server Defense] Permanent vault update error:", ve);
      }
    } catch (e) {
      console.error("[Server Defense] Error writing sync store:", e);
    }
  };

  // --- New Account-Based Auto-Sync APIs ---

  // Helper to read/write users in the store
  const readUsersStore = () => {
    const store = readStore();
    if (!store.users) {
      store.users = {};
    }
    return store.users;
  };

  const writeUsersStore = (users: any) => {
    const store = readStore();
    store.users = users;
    writeStore(store);
  };

  // Helper to merge volume arrays safely with Volume 1 Permanent Protection
  const mergeVolumeArrays = (existing: any[] = [], incoming: any[] = []): any[] => {
    const map = new Map<string, any>();

    const processVolume = (v: any) => {
      if (!v || !v.id) return;
      const prev = map.get(v.id) || {};
      const existingBooks = prev.books || [];
      const incomingBooks = v.books || [];

      // Lossless merge of books inside the volume
      const bookMap = new Map<string, any>();
      existingBooks.forEach((b: any) => { if (b && b.id) bookMap.set(b.id, b); });
      incomingBooks.forEach((b: any) => {
        if (b && b.id) {
          const prevBook = bookMap.get(b.id) || {};
          bookMap.set(b.id, {
            ...prevBook,
            ...b,
            sceneImage: b.sceneImage || prevBook.sceneImage || null,
            voiceRecord: b.voiceRecord || prevBook.voiceRecord || null,
            coverImage: b.coverImage || prevBook.coverImage || null,
            feeling: b.feeling || prevBook.feeling || '',
          });
        }
      });

      const mergedBooks = Array.from(bookMap.values());

      map.set(v.id, {
        ...prev,
        ...v,
        books: mergedBooks.length > 0 ? mergedBooks : (incomingBooks.length >= existingBooks.length ? incomingBooks : existingBooks)
      });
    };

    (existing || []).forEach(processVolume);
    (incoming || []).forEach(processVolume);

    return Array.from(map.values()).sort((a, b) => (a.volumeNumber || 1) - (b.volumeNumber || 1));
  };

  // Helper to merge book arrays safely filtering out deleted IDs and preserving drawings/reviews
  const mergeBookArrays = (existing: any[] = [], incoming: any[] = [], deletedIds: string[] = []): any[] => {
    const deletedSet = new Set(deletedIds || []);
    const map = new Map<string, any>();

    // Add existing books unless deleted
    (existing || []).forEach((b) => {
      if (b && b.id && !deletedSet.has(b.id)) {
        map.set(b.id, b);
      }
    });

    // Add incoming books unless deleted (merges existing with same ID)
    (incoming || []).forEach((b) => {
      if (b && b.id && !deletedSet.has(b.id)) {
        const prev = map.get(b.id) || {};
        map.set(b.id, {
          ...prev,
          ...b,
          // Preserve scene image, voice record, cover image and feeling if present in prev but missing in incoming
          sceneImage: b.sceneImage || prev.sceneImage || null,
          voiceRecord: b.voiceRecord || prev.voiceRecord || null,
          coverImage: b.coverImage || prev.coverImage || null,
          feeling: b.feeling || prev.feeling || '',
        });
      }
    });

    return Array.from(map.values());
  };

  // Folds books from a stale write into the archived volume they actually belong to,
  // instead of letting them vanish — used only when reconcileIncomingSave (below) has
  // already decided a write's currentVolume is behind what's stored.
  const foldBooksIntoVolume = (volumes: any[], volNum: number, books: any[]): any[] => {
    const idx = volumes.findIndex((v) => v && v.volumeNumber === volNum);
    if (idx === -1) return volumes;
    const target = volumes[idx];
    const existingIds = new Set((target.books || []).map((b: any) => b && b.id));
    const missing = (books || []).filter((b) => b && b.id && !existingIds.has(b.id));
    if (missing.length === 0) return volumes;
    const updated = [...volumes];
    updated[idx] = { ...target, books: [...(target.books || []), ...missing] };
    return updated;
  };

  // Shared write-reconciliation for all three save endpoints (account/code/device).
  //
  // Every client keeps polling and auto-saving in the background, so a device that hasn't
  // yet learned about a just-completed archive (handleArchiveAndStartNextVolume on another
  // device, or even this same device a few seconds earlier) can still land a write here
  // carrying an OLDER currentVolume and that old volume's full book list. Blindly merging
  // that in — as this endpoint used to — re-adds already-archived books to "current books"
  // and, worse, stomps `currentVolume` back down to the stale value the very next time
  // anyone reads it back. That combination is exactly what shows up on the client as
  // "책 목록이 지워지기도 해": an archived passbook reappearing and the volume counter
  // rolling backwards. So: never let currentVolume regress, never merge a stale write's
  // books into "current", and never drop a book — fold anything the stale write knows
  // about but the archive doesn't into that archived volume instead.
  const reconcileIncomingSave = (
    stored: { books?: any[]; volumes?: any[]; currentVolume?: number },
    incomingBooks: any[],
    incomingVolumes: any[],
    incomingVolNum: number | undefined,
    deletedIds: string[],
    isClearAll: boolean
  ): { finalBooks: any[]; finalVolumes: any[]; nextVolNum: number } => {
    const storedVolNum = stored.currentVolume || 1;
    const nextVolNum = Math.max(incomingVolNum || 1, storedVolNum);
    const isStale = (incomingVolNum || 1) < storedVolNum;
    const currentBooks = stored.books || [];

    let finalBooks: any[];
    if (isClearAll) {
      finalBooks = [];
    } else if (isStale) {
      finalBooks = currentBooks;
    } else if (Array.isArray(incomingBooks) && incomingBooks.length === 0 && (!deletedIds || deletedIds.length === 0)) {
      // Do NOT wipe existing books on accidental empty payloads
      finalBooks = currentBooks;
    } else {
      finalBooks = mergeBookArrays(currentBooks, incomingBooks || [], deletedIds || []);
    }

    let finalVolumes = mergeVolumeArrays(stored.volumes || [], incomingVolumes || []);
    if (isStale && incomingBooks && incomingBooks.length > 0) {
      finalVolumes = foldBooksIntoVolume(finalVolumes, incomingVolNum || 1, incomingBooks);
    }

    return { finalBooks, finalVolumes, nextVolNum };
  };

  // API Route: Register
  app.post("/api/auth/register", (req, res) => {
    const { email, password, ownerName, ownerTitle, books, volumes, currentVolume } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: '이메일과 비밀번호를 입력해 주세요.' });
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const users = readUsersStore();

    if (users[trimmedEmail]) {
      return res.status(400).json({ success: false, error: '이미 등록된 이메일 계정이에요. 기존 계정으로 로그인해 주세요.' });
    }

    users[trimmedEmail] = {
      password: String(password).trim(),
      ownerName: ownerName || '이가연',
      ownerTitle: ownerTitle || '반짝반짝',
      books: books || [],
      volumes: volumes || [],
      currentVolume: currentVolume || 1,
      updatedAt: new Date().toISOString()
    };

    writeUsersStore(users);
    res.json({ success: true, email: trimmedEmail });
  });

  // API Route: Login
  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: '이메일과 비밀번호를 입력해 주세요.' });
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const users = readUsersStore();
    const user = users[trimmedEmail];

    if (!user || user.password !== String(password).trim()) {
      return res.status(400).json({ success: false, error: '이메일 또는 비밀번호가 올바르지 않아요. 회원가입을 하지 않으셨다면 [새로운 구름 계정 만들기]를 진행해 주세요.' });
    }

    res.json({
      success: true,
      email: trimmedEmail,
      ownerName: user.ownerName,
      ownerTitle: user.ownerTitle,
      books: user.books || [],
      volumes: user.volumes || [],
      currentVolume: user.currentVolume || 1
    });
  });

  // API Route: Get User Data for Cloud Auto-Sync
  app.get("/api/auth/user/:email", (req, res) => {
    const trimmedEmail = String(req.params.email).trim().toLowerCase();
    const users = readUsersStore();
    const user = users[trimmedEmail];

    if (user) {
      res.json({
        success: true,
        email: trimmedEmail,
        ownerName: user.ownerName,
        ownerTitle: user.ownerTitle,
        books: user.books || [],
        volumes: user.volumes || [],
        currentVolume: user.currentVolume || 1
      });
    } else {
      res.status(404).json({ success: false, error: '등록되지 않은 이메일 계정입니다.' });
    }
  });

  // API Route: Auto-Sync save
  app.post("/api/auth/save", (req, res) => {
    const { email, books, volumes, currentVolume, deletedIds, ownerName, ownerTitle, isClearAll } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Missing email' });
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const users = readUsersStore();
    
    if (!users[trimmedEmail]) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const { finalBooks, finalVolumes, nextVolNum } = reconcileIncomingSave(
      users[trimmedEmail], books, volumes, currentVolume, deletedIds, !!isClearAll
    );

    users[trimmedEmail].books = finalBooks;
    users[trimmedEmail].volumes = finalVolumes;
    users[trimmedEmail].currentVolume = nextVolNum;
    users[trimmedEmail].ownerName = ownerName || users[trimmedEmail].ownerName;
    users[trimmedEmail].ownerTitle = ownerTitle || users[trimmedEmail].ownerTitle;
    users[trimmedEmail].updatedAt = new Date().toISOString();

    writeUsersStore(users);
    res.json({ success: true, count: finalBooks.length, volumesCount: finalVolumes.length });
  });

  // API Route: Create new sync code
  app.post("/api/sync/create", (req, res) => {
    const { books, volumes, currentVolume, ownerName, ownerTitle } = req.body;
    
    // Generate a unique 6-character code (uppercase letters and numbers)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid easily confused chars
    let syncCode = '';
    const store = readStore();
    
    for (let attempt = 0; attempt < 10; attempt++) {
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      if (!store[code]) {
        syncCode = code;
        break;
      }
    }
    
    if (!syncCode) {
      syncCode = 'SYNC' + Math.floor(10 + Math.random() * 89);
    }

    store[syncCode] = {
      books: books || [],
      volumes: volumes || [],
      currentVolume: currentVolume || 1,
      ownerName: ownerName || '이가연',
      ownerTitle: ownerTitle || '반짝반짝',
      updatedAt: new Date().toISOString()
    };
    
    writeStore(store);
    res.json({ success: true, syncCode });
  });

  // API Route: Save progress for code
  app.post("/api/sync/save", (req, res) => {
    const { syncCode, books, volumes, currentVolume, deletedIds, ownerName, ownerTitle, isClearAll } = req.body;
    if (!syncCode) {
      return res.status(400).json({ success: false, error: 'Missing syncCode' });
    }
    
    const store = readStore();
    const upperCode = String(syncCode).toUpperCase().trim();
    
    const { finalBooks, finalVolumes, nextVolNum } = reconcileIncomingSave(
      store[upperCode] || {}, books, volumes, currentVolume, deletedIds, !!isClearAll
    );

    store[upperCode] = {
      books: finalBooks,
      volumes: finalVolumes,
      currentVolume: nextVolNum,
      ownerName: ownerName || store[upperCode]?.ownerName || '이가연',
      ownerTitle: ownerTitle || store[upperCode]?.ownerTitle || '반짝반짝',
      updatedAt: new Date().toISOString()
    };
    
    writeStore(store);
    res.json({ success: true, count: finalBooks.length, volumesCount: finalVolumes.length });
  });

  // API Route: Load progress for code
  app.get("/api/sync/load/:code", (req, res) => {
    const code = String(req.params.code).toUpperCase().trim();
    const store = readStore();
    
    if (store[code]) {
      res.json({
        success: true,
        books: store[code].books || [],
        volumes: store[code].volumes || [],
        currentVolume: store[code].currentVolume || 1,
        ownerName: store[code].ownerName || '이가연',
        ownerTitle: store[code].ownerTitle || '반짝반짝'
      });
    } else {
      res.status(404).json({ success: false, error: '존재하지 않는 코드예요. 다시 한 번 확인해 주세요.' });
    }
  });

  // --- Anonymous Device Auto-Sync APIs (Zero Configuration Lossless Backup) ---
  const readDevicesStore = () => {
    const store = readStore();
    if (!store.devices) {
      store.devices = {};
    }
    return store.devices;
  };

  const writeDevicesStore = (devices: any) => {
    const store = readStore();
    store.devices = devices;
    writeStore(store);
  };

  // API Route: Save progress for anonymous device ID
  app.post("/api/device/save", (req, res) => {
    const { deviceId, books, volumes, currentVolume, deletedIds, ownerName, ownerTitle, isClearAll } = req.body;
    if (!deviceId) {
      return res.status(400).json({ success: false, error: 'Missing deviceId' });
    }

    const trimmedId = String(deviceId).trim();
    const devices = readDevicesStore();

    const { finalBooks, finalVolumes, nextVolNum } = reconcileIncomingSave(
      devices[trimmedId] || {}, books, volumes, currentVolume, deletedIds, !!isClearAll
    );

    devices[trimmedId] = {
      books: finalBooks,
      volumes: finalVolumes,
      currentVolume: nextVolNum,
      ownerName: ownerName || devices[trimmedId]?.ownerName || '이가연',
      ownerTitle: ownerTitle || devices[trimmedId]?.ownerTitle || '반짝반짝',
      updatedAt: new Date().toISOString()
    };

    writeDevicesStore(devices);
    res.json({ success: true, count: finalBooks.length, volumesCount: finalVolumes.length });
  });

  // API Route: Load progress for anonymous device ID
  app.get("/api/device/load/:deviceId", (req, res) => {
    const trimmedId = String(req.params.deviceId).trim();
    const devices = readDevicesStore();

    if (devices[trimmedId]) {
      res.json({
        success: true,
        books: devices[trimmedId].books || [],
        volumes: devices[trimmedId].volumes || [],
        currentVolume: devices[trimmedId].currentVolume || 1,
        ownerName: devices[trimmedId].ownerName || '이가연',
        ownerTitle: devices[trimmedId].ownerTitle || '반짝반짝'
      });
    } else {
      res.json({
        success: true,
        books: [],
        volumes: [],
        currentVolume: 1,
        ownerName: '이가연',
        ownerTitle: '반짝반짝'
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Only serve the built client if it's actually present. When this server is deployed
    // as an API-only backend (e.g. on Render, with the frontend deployed separately to
    // Netlify), `dist/` was never built here — skip straight to just running the /api/*
    // routes above instead of registering a catch-all that would 500 on every request.
    const distPath = path.join(process.cwd(), 'dist');
    const distIndexHtml = path.join(distPath, 'index.html');
    if (fs.existsSync(distIndexHtml)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(distIndexHtml);
      });
    } else {
      console.log('[Server] No dist/ build found — running as an API-only backend (no static client to serve).');
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
