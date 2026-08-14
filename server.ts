import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // support larger payloads because children might record voice or take pictures
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Global exception handling middleware to prevent server crashes under high traffic or unexpected payloads
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("[Server Defense] Unhandled Error Caught:", err);
    res.status(500).json({ success: false, error: "서버 처리 중 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." });
  });

  const STORE_FILE = path.join(process.cwd(), 'sync_store.json');

  // Helper to read sync store
  const readStore = () => {
    try {
      if (fs.existsSync(STORE_FILE)) {
        return JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8'));
      }
    } catch (e) {
      console.error("Error reading sync store:", e);
    }
    return {};
  };

  // Helper to write sync store
  const writeStore = (data: any) => {
    try {
      fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error("Error writing sync store:", e);
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

  // API Route: Register
  app.post("/api/auth/register", (req, res) => {
    const { email, password, ownerName, ownerTitle, books } = req.body;
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
      books: user.books || []
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
        books: user.books || []
      });
    } else {
      res.status(404).json({ success: false, error: '등록되지 않은 이메일 계정입니다.' });
    }
  });

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

  // API Route: Auto-Sync save
  app.post("/api/auth/save", (req, res) => {
    const { email, books, deletedIds, ownerName, ownerTitle, isClearAll } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Missing email' });
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const users = readUsersStore();
    
    if (!users[trimmedEmail]) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const currentBooks = users[trimmedEmail].books || [];
    
    // Only wipe if user explicitly invoked "Clear All" in UI
    let finalBooks: any[] = [];
    if (isClearAll) {
      finalBooks = [];
    } else if (Array.isArray(books) && books.length === 0 && (!deletedIds || deletedIds.length === 0)) {
      // Do NOT wipe existing books on accidental empty payloads
      finalBooks = currentBooks;
    } else {
      finalBooks = mergeBookArrays(currentBooks, books || [], deletedIds || []);
    }

    users[trimmedEmail].books = finalBooks;
    users[trimmedEmail].ownerName = ownerName || users[trimmedEmail].ownerName;
    users[trimmedEmail].ownerTitle = ownerTitle || users[trimmedEmail].ownerTitle;
    users[trimmedEmail].updatedAt = new Date().toISOString();

    writeUsersStore(users);
    res.json({ success: true, count: finalBooks.length });
  });

  // API Route: Create new sync code
  app.post("/api/sync/create", (req, res) => {
    const { books, ownerName, ownerTitle } = req.body;
    
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
      ownerName: ownerName || '이가연',
      ownerTitle: ownerTitle || '반짝반짝',
      updatedAt: new Date().toISOString()
    };
    
    writeStore(store);
    res.json({ success: true, syncCode });
  });

  // API Route: Save progress for code
  app.post("/api/sync/save", (req, res) => {
    const { syncCode, books, deletedIds, ownerName, ownerTitle, isClearAll } = req.body;
    if (!syncCode) {
      return res.status(400).json({ success: false, error: 'Missing syncCode' });
    }
    
    const store = readStore();
    const upperCode = String(syncCode).toUpperCase().trim();
    
    const currentBooks = store[upperCode]?.books || [];
    
    let finalBooks: any[] = [];
    if (isClearAll) {
      finalBooks = [];
    } else if (Array.isArray(books) && books.length === 0 && (!deletedIds || deletedIds.length === 0)) {
      finalBooks = currentBooks;
    } else {
      finalBooks = mergeBookArrays(currentBooks, books || [], deletedIds || []);
    }

    store[upperCode] = {
      books: finalBooks,
      ownerName: ownerName || store[upperCode]?.ownerName || '이가연',
      ownerTitle: ownerTitle || store[upperCode]?.ownerTitle || '반짝반짝',
      updatedAt: new Date().toISOString()
    };
    
    writeStore(store);
    res.json({ success: true, count: finalBooks.length });
  });

  // API Route: Load progress for code
  app.get("/api/sync/load/:code", (req, res) => {
    const code = String(req.params.code).toUpperCase().trim();
    const store = readStore();
    
    if (store[code]) {
      res.json({
        success: true,
        books: store[code].books || [],
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
    const { deviceId, books, deletedIds, ownerName, ownerTitle, isClearAll } = req.body;
    if (!deviceId) {
      return res.status(400).json({ success: false, error: 'Missing deviceId' });
    }

    const trimmedId = String(deviceId).trim();
    const devices = readDevicesStore();
    const currentBooks = devices[trimmedId]?.books || [];

    let finalBooks: any[] = [];
    if (isClearAll) {
      finalBooks = [];
    } else if (Array.isArray(books) && books.length === 0 && (!deletedIds || deletedIds.length === 0)) {
      finalBooks = currentBooks;
    } else {
      finalBooks = mergeBookArrays(currentBooks, books || [], deletedIds || []);
    }

    devices[trimmedId] = {
      books: finalBooks,
      ownerName: ownerName || devices[trimmedId]?.ownerName || '이가연',
      ownerTitle: ownerTitle || devices[trimmedId]?.ownerTitle || '반짝반짝',
      updatedAt: new Date().toISOString()
    };

    writeDevicesStore(devices);
    res.json({ success: true, count: finalBooks.length });
  });

  // API Route: Load progress for anonymous device ID
  app.get("/api/device/load/:deviceId", (req, res) => {
    const trimmedId = String(req.params.deviceId).trim();
    const devices = readDevicesStore();

    if (devices[trimmedId]) {
      res.json({
        success: true,
        books: devices[trimmedId].books || [],
        ownerName: devices[trimmedId].ownerName || '이가연',
        ownerTitle: devices[trimmedId].ownerTitle || '반짝반짝'
      });
    } else {
      res.json({
        success: true,
        books: [],
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
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
