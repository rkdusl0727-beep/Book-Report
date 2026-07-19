import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // support larger payloads because children might record voice or take pictures
  app.use(express.json({ limit: '30mb' }));
  app.use(express.urlencoded({ limit: '30mb', extended: true }));

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
      return res.status(400).json({ success: false, error: '이미 등록된 이메일 계정이에요. 다른 이메일을 입력해 주세요.' });
    }

    users[trimmedEmail] = {
      password: String(password),
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

    if (!user || user.password !== String(password)) {
      return res.status(400).json({ success: false, error: '이메일 또는 비밀번호가 올바르지 않아요. 다시 한 번 확인해 주세요.' });
    }

    res.json({
      success: true,
      email: trimmedEmail,
      ownerName: user.ownerName,
      ownerTitle: user.ownerTitle,
      books: user.books
    });
  });

  // API Route: Auto-Sync save
  app.post("/api/auth/save", (req, res) => {
    const { email, books, ownerName, ownerTitle } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Missing email' });
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const users = readUsersStore();
    
    if (!users[trimmedEmail]) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    users[trimmedEmail].books = books || [];
    users[trimmedEmail].ownerName = ownerName || users[trimmedEmail].ownerName;
    users[trimmedEmail].ownerTitle = ownerTitle || users[trimmedEmail].ownerTitle;
    users[trimmedEmail].updatedAt = new Date().toISOString();

    writeUsersStore(users);
    res.json({ success: true });
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
    const { syncCode, books, ownerName, ownerTitle } = req.body;
    if (!syncCode) {
      return res.status(400).json({ success: false, error: 'Missing syncCode' });
    }
    
    const store = readStore();
    const upperCode = String(syncCode).toUpperCase().trim();
    
    store[upperCode] = {
      books: books || [],
      ownerName: ownerName || '이가연',
      ownerTitle: ownerTitle || '반짝반짝',
      updatedAt: new Date().toISOString()
    };
    
    writeStore(store);
    res.json({ success: true });
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
