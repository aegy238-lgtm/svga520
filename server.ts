import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

// Mock Database for Leaderboard and previous winners
const LEADERBOARD_DATA = [
  { id: 1, name: 'أحمد', score: 5420000, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ahmed&backgroundColor=ffdfbf' },
  { id: 2, name: 'سارة', score: 4150000, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sara&backgroundColor=d1d4f9' },
  { id: 3, name: 'محمد', score: 3890000, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mohamed&backgroundColor=c0aede' },
  { id: 4, name: 'عمر', score: 2100000, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Omar&backgroundColor=b6e3f4' },
  { id: 5, name: 'نورة', score: 1500000, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Noura&backgroundColor=ffd5dc' },
  { id: 6, name: 'خالد', score: 950000, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Khaled&backgroundColor=ffdfbf' },
  { id: 7, name: 'مريم', score: 820000, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Maryam&backgroundColor=d1d4f9' },
];

// Simulated other players for the win notification (making the game feel alive)
const RECENT_WINNERS = [
  { rank: 2, name: 'wahyu', bet: 29600, win: 236800, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=wahyu&backgroundColor=c0aede' },
  { rank: 1, name: 'محمد', bet: 28000, win: 64000, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mohamed&backgroundColor=ffdfbf' },
  { rank: 3, name: 'vane', bet: 7300, win: 58400, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=vane&backgroundColor=d1d4f9' },
];

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API Routes ---
  
  // Endpoint to get the global leaderboard
  app.get("/api/leaderboard", (req, res) => {
    res.json(LEADERBOARD_DATA);
  });

  // Endpoint to get recent active winners for the popup
  app.get("/api/recent-winners", (req, res) => {
    res.json(RECENT_WINNERS);
  });

  // Endpoint to record a user's bet and win
  app.post("/api/record-game", (req, res) => {
    const { user, betAmount, winAmount } = req.body;
    // In a real application, calculate balance here and save to database.
    console.log(`Game recorded for ${user}: Bet - ${betAmount}, Win - ${winAmount}`);
    res.json({ success: true, message: "Game recorded successfully" });
  });

  // --- Vite Dev Server / Static Files Setup ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // ESM workaround for __dirname
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const distPath = path.join(__dirname, '..', 'dist'); // Depending on build structure
    // We'll just use process.cwd() as recommended for simplicity if __dirname fails
    const safeDistPath = path.join(process.cwd(), 'dist');
    
    app.use(express.static(safeDistPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(safeDistPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch(console.error);
